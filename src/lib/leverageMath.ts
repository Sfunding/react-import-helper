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

export type PaymentCadence = 'daily' | 'weekly';

export interface StraightMCAInputs {
  grossFunding: number;     // total advance (gross of fees)
  factorRate: number;       // e.g. 1.35
  feePercent: number;       // 0.05 = 5%
  termWeeks: number;        // amortization length in weeks (5 biz days each)
  payoffPositionIds: number[]; // ids of positions paid off on day 1
  paymentCadence?: PaymentCadence; // informational; default 'daily'
}

export interface StraightMCAResult {
  payoffsTotal: number;
  netAdvance: number;
  cashToMerchant: number;
  totalPayback: number;
  termDays: number;
  termWeeks: number;
  newDailyPayment: number;
  newWeeklyPayment: number;
  paymentCadence: PaymentCadence;
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
  const termWeeks = Math.max(1, inputs.termWeeks || 1);
  const termDays = Math.max(1, Math.round(termWeeks * BUSINESS_DAYS_PER_WEEK));
  const newDailyPayment = totalPayback / termDays;
  const newWeeklyPayment = newDailyPayment * BUSINESS_DAYS_PER_WEEK;

  const rem = stackTotals(remaining);

  return {
    payoffsTotal,
    netAdvance,
    cashToMerchant,
    totalPayback,
    termDays,
    termWeeks,
    newDailyPayment,
    newWeeklyPayment,
    paymentCadence: inputs.paymentCadence ?? 'daily',
    remainingStackBalance: rem.totalBalance,
    remainingStackDaily: rem.totalDaily,
    newTotalBalance: rem.totalBalance + totalPayback,
    newTotalDailyDebits: rem.totalDaily + newDailyPayment,
    profit: totalPayback - inputs.grossFunding,
  };
}

/** Straight-MCA RTR balance on a given business day (cap at 0). */
export function projectStraightMCABalance(
  result: StraightMCAResult,
  businessDay: number
): number {
  const paid = Math.min(result.totalPayback, result.newDailyPayment * Math.max(0, businessDay));
  return Math.max(0, result.totalPayback - paid);
}

/** Week-by-week exposure for the hybrid timeline chart. */
export interface ExposurePoint {
  week: number;
  straightRTR: number;
  remainingStackBalance: number;
  combined: number;
}

export function buildExposureTimeline(
  positions: Position[],
  straightResult: StraightMCAResult,
  payoffPositionIds: number[],
  weeks: number
): ExposurePoint[] {
  const paidOff = new Set(payoffPositionIds);
  const surviving = positions.filter(p => !paidOff.has(p.id));
  const out: ExposurePoint[] = [];
  for (let w = 0; w <= weeks; w++) {
    const day = w * BUSINESS_DAYS_PER_WEEK;
    const straightRTR = projectStraightMCABalance(straightResult, day);
    const stack = projectStack(surviving, day);
    out.push({
      week: w,
      straightRTR,
      remainingStackBalance: stack.totalBalance,
      combined: straightRTR + stack.totalBalance,
    });
  }
  return out;
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
  | { kind: 'week'; week: number }
  | { kind: 'positions-fall-off'; positionIds: number[] }
  | { kind: 'straight-exposure-below'; threshold: number }
  | { kind: 'combined-exposure-below'; threshold: number };

export interface HybridInputs {
  straight: StraightMCAInputs;
  reverse: Omit<ReverseSnapshotInputs, 'includedPositionIds'>;
  trigger: HybridTrigger;
}

export interface HybridResult {
  straight: StraightMCAResult;
  triggerDay: number;
  triggerWeek: number;
  triggerReached: boolean;
  straightBalanceAtTrigger: number;
  straightDailyAtTrigger: number;
  remainingPositionsAtTrigger: Array<Position & { projectedBalance: number; projectedDaily: number }>;
  reverseAtTrigger: ReverseSnapshotResult;
  totalCashToMerchant: number;
  combinedProfit: number;
}

const HYBRID_TRIGGER_CAP_DAYS = 30 * BUSINESS_DAYS_PER_WEEK; // 150 business days

function computeTriggerDay(
  positions: Position[],
  straight: StraightMCAResult,
  payoffIds: number[],
  trigger: HybridTrigger
): { day: number; reached: boolean } {
  if (trigger.kind === 'days') return { day: Math.max(0, Math.round(trigger.businessDays)), reached: true };
  if (trigger.kind === 'week') return { day: Math.max(0, Math.round(trigger.week * BUSINESS_DAYS_PER_WEEK)), reached: true };
  if (trigger.kind === 'positions-fall-off') {
    const idSet = new Set(trigger.positionIds);
    const days = positions
      .filter(p => idSet.has(p.id))
      .map(p => {
        const d = p.dailyPayment ?? 0;
        const b = p.balance ?? 0;
        return d > 0 && b > 0 ? Math.ceil(b / d) : 0;
      });
    return { day: days.length ? Math.max(...days) : 0, reached: true };
  }
  const paidOff = new Set(payoffIds);
  const surviving = positions.filter(p => !paidOff.has(p.id));
  for (let d = 0; d <= HYBRID_TRIGGER_CAP_DAYS; d++) {
    const straightRTR = projectStraightMCABalance(straight, d);
    if (trigger.kind === 'straight-exposure-below') {
      if (straightRTR <= trigger.threshold) return { day: d, reached: true };
    } else {
      const stack = projectStack(surviving, d);
      if (straightRTR + stack.totalBalance <= trigger.threshold) return { day: d, reached: true };
    }
  }
  return { day: HYBRID_TRIGGER_CAP_DAYS, reached: false };
}

export function simulateHybrid(
  positions: Position[],
  inputs: HybridInputs
): HybridResult {
  const straight = simulateStraightMCA(positions, inputs.straight);

  const paidOffIds = new Set(inputs.straight.payoffPositionIds);
  const survivingPositions = positions.filter(p => !paidOffIds.has(p.id));

  const { day: triggerDay, reached: triggerReached } = computeTriggerDay(
    positions,
    straight,
    inputs.straight.payoffPositionIds,
    inputs.trigger
  );
  const triggerWeek = triggerDay / BUSINESS_DAYS_PER_WEEK;

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
    triggerWeek,
    triggerReached,
    straightBalanceAtTrigger,
    straightDailyAtTrigger,
    remainingPositionsAtTrigger,
    reverseAtTrigger,
    totalCashToMerchant,
    combinedProfit,
  };
}

// -------------------- Scenario Builder engine --------------------

import type { Scenario, ScenarioStep, ActivePosition, Checkpoint, ScenarioRunResult } from './scenarioTypes';

function advanceDays(active: ActivePosition[], days: number): ActivePosition[] {
  if (days <= 0) return active;
  return active.map(p => {
    const paid = p.dailyPayment * days;
    const newBal = Math.max(0, p.balance - paid);
    return { ...p, balance: newBal, dailyPayment: newBal > 0 ? p.dailyPayment : 0 };
  });
}

function activeTotals(active: ActivePosition[]) {
  let tb = 0, td = 0;
  for (const p of active) {
    if (p.balance > 0) { tb += p.balance; td += p.dailyPayment; }
  }
  return { totalBalance: tb, totalDaily: td };
}

function makeCheckpoint(
  stepIndex: number,
  stepLabel: string,
  dayOffset: number,
  active: ActivePosition[],
  monthlyRevenue: number,
  cashThisStep: number,
  profitThisStep: number,
  cashCum: number,
  profitCum: number,
  note?: string
): Checkpoint {
  const totals = activeTotals(active);
  const snap = snapshot(totals.totalBalance, totals.totalDaily, monthlyRevenue);
  return {
    stepIndex,
    stepLabel,
    dayOffset,
    weekOffset: dayOffset / BUSINESS_DAYS_PER_WEEK,
    activePositions: active.filter(p => p.balance > 0),
    totalBalance: totals.totalBalance,
    totalDaily: totals.totalDaily,
    balanceLeverage: snap.balanceLeverage,
    paymentBurden: snap.paymentBurden,
    cashToMerchantStep: cashThisStep,
    profitStep: profitThisStep,
    cashToMerchantCumulative: cashCum,
    profitCumulative: profitCum,
    note,
  };
}

function stepLabel(step: ScenarioStep): string {
  if (step.label) return step.label;
  switch (step.kind) {
    case 'straight': return `Straight MCA $${Math.round(step.grossFunding).toLocaleString()}`;
    case 'wait': return `Wait ${step.weeks} wk`;
    case 'add-position': return `Add: ${step.entity}`;
    case 'reverse': return 'Reverse Consolidation';
  }
}

export function runScenario(
  positions: Position[],
  scenario: Scenario,
  monthlyRevenue: number
): ScenarioRunResult {
  // Seed active positions from the stack
  let active: ActivePosition[] = positions
    .filter(p => (p.balance ?? 0) > 0 && (p.dailyPayment ?? 0) > 0)
    .map(p => ({
      id: `orig-${p.id}`,
      originalId: p.id,
      entity: p.entity,
      balance: p.balance ?? 0,
      dailyPayment: p.dailyPayment ?? 0,
      source: 'original' as const,
    }));

  let dayOffset = 0;
  let cashCum = 0;
  let profitCum = 0;

  const checkpoints: Checkpoint[] = [];
  checkpoints.push(
    makeCheckpoint(-1, 'Today', 0, active, monthlyRevenue, 0, 0, 0, 0)
  );

  scenario.steps.forEach((step, idx) => {
    let cashStep = 0;
    let profitStep = 0;
    let note: string | undefined;

    if (step.kind === 'wait') {
      const days = Math.max(0, Math.round(step.weeks * BUSINESS_DAYS_PER_WEEK));
      active = advanceDays(active, days);
      dayOffset += days;
    } else if (step.kind === 'add-position') {
      active = [
        ...active,
        {
          id: `add-${step.id}`,
          entity: step.entity || 'New Position',
          balance: Math.max(0, step.balance),
          dailyPayment: Math.max(0, step.dailyPayment),
          source: 'outside-added',
        },
      ];
    } else if (step.kind === 'straight') {
      const payoffSet = new Set(step.payoffPositionIds);
      const payoffsTotal = active
        .filter(p => payoffSet.has(p.id))
        .reduce((s, p) => s + p.balance, 0);
      // Pay off
      active = active.map(p =>
        payoffSet.has(p.id) ? { ...p, balance: 0, dailyPayment: 0 } : p
      );
      const gross = step.grossFunding > 0 ? step.grossFunding : payoffsTotal;
      const netAdvance = gross * (1 - step.feePercent);
      const totalPayback = gross * step.factorRate;
      const termDays = Math.max(1, Math.round(step.termWeeks * BUSINESS_DAYS_PER_WEEK));
      const daily = totalPayback / termDays;
      active = [
        ...active,
        {
          id: `straight-${step.id}`,
          entity: `Straight MCA (${step.termWeeks}w @ ${step.factorRate.toFixed(2)})`,
          balance: totalPayback,
          dailyPayment: daily,
          source: 'straight-rtr',
        },
      ];
      cashStep = netAdvance - payoffsTotal;
      profitStep = totalPayback - gross;
      note = `Payoffs ${payoffsTotal.toFixed(0)}, net ${netAdvance.toFixed(0)}, daily ${daily.toFixed(0)}`;
    } else if (step.kind === 'reverse') {
      const incSet = new Set(step.includedPositionIds);
      const included = active.filter(p => incSet.has(p.id) && p.balance > 0);
      const totalAdvance = included.reduce((s, p) => s + p.balance, 0);
      const includedDaily = included.reduce((s, p) => s + p.dailyPayment, 0);
      const totalFunding = step.feePercent < 1 ? totalAdvance / (1 - step.feePercent) : totalAdvance;
      const totalPayback = totalFunding * step.factorRate;
      const newDaily = includedDaily * (1 - step.dailyDecrease);

      // Remove included from active
      active = active.filter(p => !incSet.has(p.id));
      // Append reverse RTR as synthetic position
      if (totalPayback > 0) {
        active.push({
          id: `rev-${step.id}`,
          entity: `Reverse RTR (${step.factorRate.toFixed(2)})`,
          balance: totalPayback,
          dailyPayment: newDaily,
          source: 'reverse-rtr',
        });
      }
      profitStep = totalPayback - totalFunding;
      note = `Advance ${totalAdvance.toFixed(0)}, gross ${totalFunding.toFixed(0)}, daily ${newDaily.toFixed(0)}`;
    }

    cashCum += cashStep;
    profitCum += profitStep;
    checkpoints.push(
      makeCheckpoint(idx, stepLabel(step), dayOffset, active, monthlyRevenue,
        cashStep, profitStep, cashCum, profitCum, note)
    );
  });

  // Weekly exposure: walk in lock-step with steps, project between step day-offsets
  const totalWeeks = Math.max(4, Math.ceil((dayOffset || 0) / BUSINESS_DAYS_PER_WEEK) + 26);
  const weeklyExposure: Array<{ week: number; combined: number }> = [];
  // Replay timeline incrementally to compute weekly samples
  let replayActive: ActivePosition[] = positions
    .filter(p => (p.balance ?? 0) > 0 && (p.dailyPayment ?? 0) > 0)
    .map(p => ({
      id: `orig-${p.id}`, originalId: p.id, entity: p.entity,
      balance: p.balance ?? 0, dailyPayment: p.dailyPayment ?? 0, source: 'original' as const,
    }));
  let replayDay = 0;
  // Build sequential list of (atDay, fn) instant actions plus continuous decay.
  // We'll process each business day; cap to keep cheap.
  const stepActionsByDay = new Map<number, ScenarioStep[]>();
  {
    let curDay = 0;
    for (const s of scenario.steps) {
      if (s.kind === 'wait') {
        // Wait happens AFTER instant actions queued for curDay
        curDay += Math.max(0, Math.round(s.weeks * BUSINESS_DAYS_PER_WEEK));
      } else {
        const list = stepActionsByDay.get(curDay) ?? [];
        list.push(s);
        stepActionsByDay.set(curDay, list);
      }
    }
  }

  let peak = 0;
  const sampleWeeks = totalWeeks;
  for (let w = 0; w <= sampleWeeks; w++) {
    const targetDay = w * BUSINESS_DAYS_PER_WEEK;
    while (replayDay < targetDay) {
      // Run instant actions queued at replayDay
      const acts = stepActionsByDay.get(replayDay);
      if (acts) {
        for (const step of acts) {
          if (step.kind === 'add-position') {
            replayActive.push({
              id: `add-${step.id}`, entity: step.entity, balance: Math.max(0, step.balance),
              dailyPayment: Math.max(0, step.dailyPayment), source: 'outside-added',
            });
          } else if (step.kind === 'straight') {
            const payoffSet = new Set(step.payoffPositionIds);
            const payoffsTotal = replayActive.filter(p => payoffSet.has(p.id)).reduce((s, p) => s + p.balance, 0);
            replayActive = replayActive.map(p =>
              payoffSet.has(p.id) ? { ...p, balance: 0, dailyPayment: 0 } : p
            );
            const gross = step.grossFunding > 0 ? step.grossFunding : payoffsTotal;
            const totalPayback = gross * step.factorRate;
            const termDays = Math.max(1, Math.round(step.termWeeks * BUSINESS_DAYS_PER_WEEK));
            replayActive.push({
              id: `straight-${step.id}`, entity: 'Straight RTR',
              balance: totalPayback, dailyPayment: totalPayback / termDays, source: 'straight-rtr',
            });
          } else if (step.kind === 'reverse') {
            const incSet = new Set(step.includedPositionIds);
            const included = replayActive.filter(p => incSet.has(p.id) && p.balance > 0);
            const totalAdvance = included.reduce((s, p) => s + p.balance, 0);
            const includedDaily = included.reduce((s, p) => s + p.dailyPayment, 0);
            const totalFunding = step.feePercent < 1 ? totalAdvance / (1 - step.feePercent) : totalAdvance;
            const totalPayback = totalFunding * step.factorRate;
            const newDaily = includedDaily * (1 - step.dailyDecrease);
            replayActive = replayActive.filter(p => !incSet.has(p.id));
            if (totalPayback > 0) {
              replayActive.push({
                id: `rev-${step.id}`, entity: 'Reverse RTR',
                balance: totalPayback, dailyPayment: newDaily, source: 'reverse-rtr',
              });
            }
          }
        }
        stepActionsByDay.delete(replayDay);
      }
      // Advance one day
      replayActive = advanceDays(replayActive, 1);
      replayDay++;
    }
    // Run any actions exactly at targetDay before sampling
    const acts = stepActionsByDay.get(replayDay);
    if (acts) {
      for (const step of acts) {
        if (step.kind === 'add-position') {
          replayActive.push({
            id: `add-${step.id}`, entity: step.entity, balance: Math.max(0, step.balance),
            dailyPayment: Math.max(0, step.dailyPayment), source: 'outside-added',
          });
        } else if (step.kind === 'straight') {
          const payoffSet = new Set(step.payoffPositionIds);
          const payoffsTotal = replayActive.filter(p => payoffSet.has(p.id)).reduce((s, p) => s + p.balance, 0);
          replayActive = replayActive.map(p =>
            payoffSet.has(p.id) ? { ...p, balance: 0, dailyPayment: 0 } : p
          );
          const gross = step.grossFunding > 0 ? step.grossFunding : payoffsTotal;
          const totalPayback = gross * step.factorRate;
          const termDays = Math.max(1, Math.round(step.termWeeks * BUSINESS_DAYS_PER_WEEK));
          replayActive.push({
            id: `straight-${step.id}`, entity: 'Straight RTR',
            balance: totalPayback, dailyPayment: totalPayback / termDays, source: 'straight-rtr',
          });
        } else if (step.kind === 'reverse') {
          const incSet = new Set(step.includedPositionIds);
          const included = replayActive.filter(p => incSet.has(p.id) && p.balance > 0);
          const totalAdvance = included.reduce((s, p) => s + p.balance, 0);
          const includedDaily = included.reduce((s, p) => s + p.dailyPayment, 0);
          const totalFunding = step.feePercent < 1 ? totalAdvance / (1 - step.feePercent) : totalAdvance;
          const totalPayback = totalFunding * step.factorRate;
          const newDaily = includedDaily * (1 - step.dailyDecrease);
          replayActive = replayActive.filter(p => !incSet.has(p.id));
          if (totalPayback > 0) {
            replayActive.push({
              id: `rev-${step.id}`, entity: 'Reverse RTR',
              balance: totalPayback, dailyPayment: newDaily, source: 'reverse-rtr',
            });
          }
        }
      }
      stepActionsByDay.delete(replayDay);
    }
    const t = activeTotals(replayActive);
    weeklyExposure.push({ week: w, combined: t.totalBalance });
    if (t.totalBalance > peak) peak = t.totalBalance;
  }

  const finalState = checkpoints[checkpoints.length - 1];
  return { checkpoints, weeklyExposure, finalState, peakCombinedExposure: peak };
}
