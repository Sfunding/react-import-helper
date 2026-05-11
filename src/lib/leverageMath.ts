/**
 * Leverage Analyzer math helpers.
 *
 * Pure functions — no React, no Supabase. Reuses the project's standing
 * constants: 22 business days/month, 5 business days/week.
 */
import { Position } from '@/types/calculation';

export const BUSINESS_DAYS_PER_MONTH = 22;
export const BUSINESS_DAYS_PER_WEEK = 5;

// -------------------- Leverage ratios --------------------

export type LeverageBand = 'green' | 'amber' | 'red';

export interface LeverageSnapshot {
  /** total open balance / monthly revenue */
  balanceLeverage: number;
  /** daily debits / daily revenue */
  paymentBurden: number;
  balanceBand: LeverageBand;
  burdenBand: LeverageBand;
}

export function bandForBalance(ratio: number): LeverageBand {
  if (ratio < 0.5) return 'green';
  if (ratio < 1.0) return 'amber';
  return 'red';
}

export function bandForBurden(ratio: number): LeverageBand {
  if (ratio < 0.15) return 'green';
  if (ratio < 0.30) return 'amber';
  return 'red';
}

export function snapshot(
  totalBalance: number,
  totalDailyDebits: number,
  monthlyRevenue: number
): LeverageSnapshot {
  const safeRev = monthlyRevenue > 0 ? monthlyRevenue : 0;
  const dailyRev = safeRev / BUSINESS_DAYS_PER_MONTH;
  const balanceLeverage = safeRev > 0 ? totalBalance / safeRev : 0;
  const paymentBurden = dailyRev > 0 ? totalDailyDebits / dailyRev : 0;
  return {
    balanceLeverage,
    paymentBurden,
    balanceBand: bandForBalance(balanceLeverage),
    burdenBand: bandForBurden(paymentBurden),
  };
}

// -------------------- Stack helpers --------------------

export interface StackTotals {
  totalBalance: number;
  totalDaily: number;
}

export function stackTotals(positions: Position[]): StackTotals {
  let totalBalance = 0;
  let totalDaily = 0;
  for (const p of positions) {
    totalBalance += p.balance ?? 0;
    totalDaily += p.dailyPayment ?? 0;
  }
  return { totalBalance, totalDaily };
}

/**
 * Project a position's remaining balance & active daily payment after N business days.
 * If the position has paid off within that window, balance=0 daily=0.
 */
export function projectPosition(p: Position, businessDays: number) {
  const bal = p.balance ?? 0;
  const daily = p.dailyPayment ?? 0;
  if (daily <= 0 || bal <= 0) return { balance: bal, daily };
  const paid = daily * businessDays;
  const remaining = Math.max(0, bal - paid);
  return {
    balance: remaining,
    daily: remaining > 0 ? daily : 0,
  };
}

export function projectStack(positions: Position[], businessDays: number): StackTotals {
  let totalBalance = 0;
  let totalDaily = 0;
  for (const p of positions) {
    const r = projectPosition(p, businessDays);
    totalBalance += r.balance;
    totalDaily += r.daily;
  }
  return { totalBalance, totalDaily };
}

// -------------------- Scenario: Straight MCA --------------------

export interface StraightMCAInputs {
  grossFunding: number;     // total advance (gross of fees)
  factorRate: number;       // e.g. 1.49
  feePercent: number;       // 0.09 = 9%
  termMonths: number;       // amortization length in months (22 biz days each)
  payoffPositionIds: number[]; // ids of positions paid off on day 1
}

export interface StraightMCAResult {
  payoffsTotal: number;
  netAdvance: number;
  cashToMerchant: number;
  totalPayback: number;
  termDays: number;
  newDailyPayment: number;
  remainingStackBalance: number;   // unselected positions, before the new MCA
  remainingStackDaily: number;
  newTotalBalance: number;         // remaining stack + new MCA payback
  newTotalDailyDebits: number;     // remaining stack daily + new MCA daily
  profit: number;                  // gross of operating costs
}

export function simulateStraightMCA(
  positions: Position[],
  inputs: StraightMCAInputs
): StraightMCAResult {
  const payoffSet = new Set(inputs.payoffPositionIds);
  const paidOff = positions.filter(p => payoffSet.has(p.id));
  const remaining = positions.filter(p => !payoffSet.has(p.id));

  const payoffsTotal = paidOff.reduce((s, p) => s + (p.balance ?? 0), 0);
  const netAdvance = inputs.grossFunding * (1 - inputs.feePercent);
  const cashToMerchant = netAdvance - payoffsTotal;
  const totalPayback = inputs.grossFunding * inputs.factorRate;
  const termDays = Math.max(1, Math.round(inputs.termMonths * BUSINESS_DAYS_PER_MONTH));
  const newDailyPayment = totalPayback / termDays;

  const rem = stackTotals(remaining);

  return {
    payoffsTotal,
    netAdvance,
    cashToMerchant,
    totalPayback,
    termDays,
    newDailyPayment,
    remainingStackBalance: rem.totalBalance,
    remainingStackDaily: rem.totalDaily,
    newTotalBalance: rem.totalBalance + totalPayback,
    newTotalDailyDebits: rem.totalDaily + newDailyPayment,
    profit: totalPayback - inputs.grossFunding,
  };
}

// -------------------- Scenario: Reverse (snapshot only) --------------------

export interface ReverseSnapshotInputs {
  factorRate: number;
  feePercent: number;
  /** target discount on daily payments, e.g. 0.30 = 30% off */
  dailyDecrease: number;
  /** ids included in the reverse */
  includedPositionIds: number[];
}

export interface ReverseSnapshotResult {
  totalAdvance: number;       // sum of included balances
  totalFunding: number;       // gross (advance / (1-fee))
  netAdvance: number;
  totalPayback: number;
  newDailyPayment: number;
  termDays: number;
  remainingExternalDaily: number;  // non-included positions still pulling
  /** the day all included positions hit zero (max days-left across included) */
  consolidatedFalloffDay: number;
  profit: number;
}

export function simulateReverseSnapshot(
  positions: Position[],
  inputs: ReverseSnapshotInputs
): ReverseSnapshotResult {
  const incSet = new Set(inputs.includedPositionIds);
  const included = positions.filter(p => incSet.has(p.id));
  const notIncluded = positions.filter(p => !incSet.has(p.id));

  const totalAdvance = included.reduce((s, p) => s + (p.balance ?? 0), 0);
  const includedDaily = included.reduce((s, p) => s + (p.dailyPayment ?? 0), 0);
  const totalFunding = inputs.feePercent < 1 ? totalAdvance / (1 - inputs.feePercent) : totalAdvance;
  const netAdvance = totalFunding * (1 - inputs.feePercent);
  const totalPayback = totalFunding * inputs.factorRate;
  const newDailyPayment = includedDaily * (1 - inputs.dailyDecrease);
  const termDays = newDailyPayment > 0 ? Math.ceil(totalPayback / newDailyPayment) : 0;

  const consolidatedFalloffDay = included.reduce((max, p) => {
    const daily = p.dailyPayment ?? 0;
    const bal = p.balance ?? 0;
    const days = daily > 0 && bal > 0 ? Math.ceil(bal / daily) : 0;
    return Math.max(max, days);
  }, 0);

  const remainingExternalDaily = notIncluded.reduce((s, p) => s + (p.dailyPayment ?? 0), 0);

  return {
    totalAdvance,
    totalFunding,
    netAdvance,
    totalPayback,
    newDailyPayment,
    termDays,
    remainingExternalDaily,
    consolidatedFalloffDay,
    profit: totalPayback - totalFunding,
  };
}

// -------------------- Scenario: Hybrid (straight now, reverse later) --------------------

export type HybridTrigger =
  | { kind: 'days'; businessDays: number }
  | { kind: 'positions-fall-off'; positionIds: number[] };

export interface HybridInputs {
  straight: StraightMCAInputs;
  reverse: Omit<ReverseSnapshotInputs, 'includedPositionIds'>;
  trigger: HybridTrigger;
}

export interface HybridResult {
  straight: StraightMCAResult;
  triggerDay: number;
  /** straight-MCA RTR balance still outstanding at trigger day */
  straightBalanceAtTrigger: number;
  /** straight-MCA daily payment, still active at trigger day (or 0 if paid off) */
  straightDailyAtTrigger: number;
  /** projected non-paid-off positions at trigger day */
  remainingPositionsAtTrigger: Array<Position & { projectedBalance: number; projectedDaily: number }>;
  /** what a reverse on the remaining stack looks like at the trigger */
  reverseAtTrigger: ReverseSnapshotResult;
  /** total cash to merchant across both phases */
  totalCashToMerchant: number;
  /** combined profit estimate */
  combinedProfit: number;
}

function computeTriggerDay(positions: Position[], trigger: HybridTrigger): number {
  if (trigger.kind === 'days') return Math.max(0, Math.round(trigger.businessDays));
  const idSet = new Set(trigger.positionIds);
  const days = positions
    .filter(p => idSet.has(p.id))
    .map(p => {
      const d = p.dailyPayment ?? 0;
      const b = p.balance ?? 0;
      return d > 0 && b > 0 ? Math.ceil(b / d) : 0;
    });
  return days.length ? Math.max(...days) : 0;
}

export function simulateHybrid(
  positions: Position[],
  inputs: HybridInputs
): HybridResult {
  const straight = simulateStraightMCA(positions, inputs.straight);

  // Positions not paid off on day 1
  const paidOffIds = new Set(inputs.straight.payoffPositionIds);
  const survivingPositions = positions.filter(p => !paidOffIds.has(p.id));

  const triggerDay = computeTriggerDay(positions, inputs.trigger);

  // Project surviving positions to trigger day
  const remainingPositionsAtTrigger = survivingPositions
    .map(p => {
      const r = projectPosition(p, triggerDay);
      return { ...p, projectedBalance: r.balance, projectedDaily: r.daily };
    })
    .filter(p => p.projectedBalance > 0);

  // Straight MCA state at trigger day
  const straightTotalPaid = Math.min(straight.totalPayback, straight.newDailyPayment * triggerDay);
  const straightBalanceAtTrigger = Math.max(0, straight.totalPayback - straightTotalPaid);
  const straightDailyAtTrigger = straightBalanceAtTrigger > 0 ? straight.newDailyPayment : 0;

  // Reverse on the remaining stack as-of trigger day.
  // Synthesize trigger-day positions for the reverse simulator.
  const triggerPositions: Position[] = remainingPositionsAtTrigger.map(p => ({
    ...p,
    balance: p.projectedBalance,
    dailyPayment: p.projectedDaily,
  }));
  const reverseAtTrigger = simulateReverseSnapshot(triggerPositions, {
    ...inputs.reverse,
    includedPositionIds: triggerPositions.map(p => p.id),
  });

  const totalCashToMerchant = straight.cashToMerchant; // reverse adds no new cash
  const combinedProfit = straight.profit + reverseAtTrigger.profit;

  return {
    straight,
    triggerDay,
    straightBalanceAtTrigger,
    straightDailyAtTrigger,
    remainingPositionsAtTrigger,
    reverseAtTrigger,
    totalCashToMerchant,
    combinedProfit,
  };
}
