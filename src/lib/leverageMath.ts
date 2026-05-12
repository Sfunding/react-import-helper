/**
 * Leverage Analyzer math helpers.
 *
 * Pure functions — no React, no Supabase. Reuses the project's standing
 * constants: 22 business days/month, 5 business days/week.
 */
import { Position } from '@/types/calculation';
import { getBusinessDaysBetween, addBusinessDays } from '@/lib/dateUtils';
import { format } from 'date-fns';

export const BUSINESS_DAYS_PER_MONTH = 22;
export const BUSINESS_DAYS_PER_WEEK = 5;

/** Convert an ISO date (YYYY-MM-DD) to a business-day offset from today (>=0). */
function dayOffsetFromIso(iso?: string): number | null {
  if (!iso) return null;
  const target = new Date(iso + 'T00:00:00');
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (target <= today) return 0;
  return getBusinessDaysBetween(today, target);
}

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

/**
 * Project the stack from `asOfDate` to `viewDate` using business-day decay.
 * Returns a new array of positions; balances/dailies are decayed for daily
 * positions and left untouched for weekly positions (v1 — TODO weekly projection).
 * Positions with null balance (unknown) are passed through unchanged.
 */
export function projectStackToDate(
  positions: Position[],
  asOfDate: string,
  viewDate: string
): Position[] {
  if (!asOfDate || !viewDate) return positions.map(p => ({ ...p }));
  const asOf = new Date(asOfDate + 'T00:00:00');
  const view = new Date(viewDate + 'T00:00:00');
  if (Number.isNaN(asOf.getTime()) || Number.isNaN(view.getTime()) || view <= asOf) {
    return positions.map(p => ({ ...p }));
  }
  const businessDays = getBusinessDaysBetween(asOf, view);
  if (businessDays <= 0) return positions.map(p => ({ ...p }));
  return positions.map(p => {
    if (p.frequency === 'weekly') return { ...p }; // TODO weekly projection
    if (p.balance == null) return { ...p };
    const daily = p.dailyPayment ?? 0;
    if (daily <= 0 || p.balance <= 0) return { ...p };
    const newBalance = Math.max(0, p.balance - daily * businessDays);
    return {
      ...p,
      balance: newBalance,
      dailyPayment: newBalance > 0 ? daily : 0,
    };
  });
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
  const funder = (step as { funderName?: string }).funderName;
  const datePart = (step as { runOn?: string }).runOn
    ? ` on ${new Date((step as { runOn?: string }).runOn + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
    : '';
  switch (step.kind) {
    case 'straight': {
      const f = funder ? ` (${funder})` : '';
      return `Straight MCA $${Math.round(step.grossFunding).toLocaleString()}${f}${datePart}`;
    }
    case 'recurring-straight':
      return `${step.count} x Straight ($${Math.round(step.amountEach).toLocaleString()} every ${step.cadenceWeeks}w)${datePart}`;
    case 'wait': return `Wait ${step.weeks} wk`;
    case 'add-position': return `Add: ${step.entity}${datePart}`;
    case 'reverse': {
      const f = funder ? ` (${funder})` : '';
      if (step.runOn) return `Reverse Consolidation${f}${datePart}`;
      return step.runAtWeek != null
        ? `Reverse Consolidation${f} @ wk ${step.runAtWeek}`
        : `Reverse Consolidation${f}`;
    }
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

    // If the step has an absolute run date, fast-forward active positions to it.
    if (step.kind !== 'wait') {
      const targetDay = dayOffsetFromIso((step as { runOn?: string }).runOn);
      if (targetDay != null) {
        const delta = targetDay - dayOffset;
        if (delta > 0) {
          active = advanceDays(active, delta);
          dayOffset += delta;
        }
      }
    }

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
          entity: step.funderName?.trim() || `Straight MCA (${step.termWeeks}w @ ${step.factorRate.toFixed(2)})`,
          balance: totalPayback,
          dailyPayment: daily,
          source: 'straight-rtr',
        },
      ];
      cashStep = netAdvance - payoffsTotal;
      profitStep = totalPayback - gross;
      note = `Payoffs ${payoffsTotal.toFixed(0)}, net ${netAdvance.toFixed(0)}, daily ${daily.toFixed(0)}`;
    } else if (step.kind === 'recurring-straight') {
      const count = Math.max(0, Math.floor(step.count));
      const cadDays = Math.max(0, Math.round(step.cadenceWeeks * BUSINESS_DAYS_PER_WEEK));
      const termDays = Math.max(1, Math.round(step.termWeeks * BUSINESS_DAYS_PER_WEEK));
      const gross = Math.max(0, step.amountEach);
      const netEach = gross * (1 - step.feePercent);
      const paybackEach = gross * step.factorRate;
      const dailyEach = paybackEach / termDays;
      for (let i = 0; i < count; i++) {
        if (i > 0 && cadDays > 0) {
          active = advanceDays(active, cadDays);
          dayOffset += cadDays;
        }
        active = [
          ...active,
          {
            id: `rstraight-${step.id}-${i + 1}`,
            entity: `Straight #${i + 1} ($${Math.round(gross).toLocaleString()} @ ${step.factorRate.toFixed(2)})`,
            balance: paybackEach,
            dailyPayment: dailyEach,
            source: 'straight-rtr',
          },
        ];
        cashStep += netEach;
        profitStep += paybackEach - gross;
      }
      note = `${count} infusions of $${Math.round(gross).toLocaleString()} @ ${step.factorRate.toFixed(2)} / ${step.termWeeks}w (daily +${dailyEach.toFixed(0)} each)`;
    } else if (step.kind === 'reverse') {
      // Optionally fast-forward to an absolute week before running the reverse
      if (step.runAtWeek != null && Number.isFinite(step.runAtWeek)) {
        const targetDay = Math.max(0, Math.round(step.runAtWeek * BUSINESS_DAYS_PER_WEEK));
        const delta = targetDay - dayOffset;
        if (delta > 0) {
          active = advanceDays(active, delta);
          dayOffset += delta;
        }
      }
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
          entity: step.funderName?.trim() || `Reverse RTR (${step.factorRate.toFixed(2)})`,
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
      // Honor absolute runOn date: fast-forward curDay to that target (only forwards)
      if (s.kind !== 'wait') {
        const td = dayOffsetFromIso((s as { runOn?: string }).runOn);
        if (td != null && td > curDay) curDay = td;
      }
      if (s.kind === 'wait') {
        curDay += Math.max(0, Math.round(s.weeks * BUSINESS_DAYS_PER_WEEK));
      } else if (s.kind === 'recurring-straight') {
        const count = Math.max(0, Math.floor(s.count));
        const cadDays = Math.max(0, Math.round(s.cadenceWeeks * BUSINESS_DAYS_PER_WEEK));
        for (let i = 0; i < count; i++) {
          const synthetic: ScenarioStep = {
            id: `${s.id}-${i + 1}`,
            kind: 'straight',
            grossFunding: s.amountEach,
            factorRate: s.factorRate,
            feePercent: s.feePercent,
            termWeeks: s.termWeeks,
            paymentCadence: s.paymentCadence,
            payoffPositionIds: [],
          };
          const list = stepActionsByDay.get(curDay) ?? [];
          list.push(synthetic);
          stepActionsByDay.set(curDay, list);
          if (i < count - 1) curDay += cadDays;
        }
      } else if (s.kind === 'reverse' && s.runAtWeek != null && Number.isFinite(s.runAtWeek)) {
        const targetDay = Math.max(0, Math.round(s.runAtWeek * BUSINESS_DAYS_PER_WEEK));
        if (targetDay > curDay) curDay = targetDay;
        const list = stepActionsByDay.get(curDay) ?? [];
        list.push(s);
        stepActionsByDay.set(curDay, list);
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

// -------------------- Scenario → Calculator snapshot --------------------

/**
 * Convert an `ActivePosition` checkpoint into concrete `Position[]` for the calculator.
 * - `original` positions inherit identifying metadata from `originalPositions` and overwrite balance/dailyPayment from the checkpoint.
 * - Scenario-sourced positions (`straight-rtr`, `outside-added`, `reverse-rtr`) get fresh metadata derived from the source step.
 *
 * For recurring straight programs (id `rstraight-{stepId}-{N}`), the engine emits a single checkpoint at the LAST fire,
 * so the per-N fundedDate is derived as: `firstFireOffset + (N-1) * cadenceWeeks * 5`, where
 * `firstFireOffset = checkpoints[idx+1].dayOffset - (count-1) * cadenceWeeks * 5`.
 */
export function checkpointToPositions(
  checkpoint: import('./scenarioTypes').Checkpoint,
  scenarioSteps: import('./scenarioTypes').ScenarioStep[],
  originalPositions: Position[],
  today: Date,
  checkpoints: import('./scenarioTypes').Checkpoint[]
): { positions: Position[]; asOfDate: string } {
  const fundedDateFor = (offset: number) =>
    format(addBusinessDays(today, Math.max(0, offset)), 'yyyy-MM-dd');

  // Emit-checkpoint offset for a step (the checkpoint after the step runs).
  const stepEmitOffset = (stepId: string): number => {
    const idx = scenarioSteps.findIndex(s => s.id === stepId);
    return checkpoints[idx + 1]?.dayOffset ?? checkpoint.dayOffset;
  };

  const findStep = (stepId: string) => {
    const idx = scenarioSteps.findIndex(s => s.id === stepId);
    return { idx, step: idx >= 0 ? scenarioSteps[idx] : undefined };
  };

  let nextId = Math.max(0, ...originalPositions.map(p => p.id)) + 1;

  const out: Position[] = [];

  for (const ap of checkpoint.activePositions) {
    if (ap.balance <= 0) continue;

    if (ap.source === 'original') {
      const orig = originalPositions.find(p => p.id === ap.originalId);
      if (!orig) continue;
      out.push({
        ...orig,
        balance: ap.balance,
        dailyPayment: ap.dailyPayment,
        // Lock a manual anchor at the commit date so future as-of-date moves
        // reprice from this projected snapshot (and round-trips return exactly
        // to the pre-commit balance) instead of from the funded model.
        balanceAsOfDate: fundedDateFor(checkpoint.dayOffset),
        balanceAnchor: 'manual',
      });
      continue;
    }

    if (ap.source === 'outside-added') {
      // id format: 'add-{stepId}'
      const stepId = ap.id.startsWith('add-') ? ap.id.slice(4) : ap.id;
      const { step } = findStep(stepId);
      const runOn = (step as { runOn?: string } | undefined)?.runOn;
      const fundedDate = runOn ?? fundedDateFor(stepEmitOffset(stepId));
      out.push({
        id: nextId++,
        entity: (step && step.kind === 'add-position' ? step.entity : ap.entity) || ap.entity,
        balance: ap.balance,
        dailyPayment: ap.dailyPayment,
        isOurPosition: false,
        includeInReverse: true,
        fundedDate,
        amountFunded: null,
        frequency: 'daily',
      });
      continue;
    }

    if (ap.source === 'reverse-rtr') {
      // id format: 'rev-{stepId}'
      const stepId = ap.id.startsWith('rev-') ? ap.id.slice(4) : ap.id;
      const { step } = findStep(stepId);
      const runOn = (step as { runOn?: string } | undefined)?.runOn;
      const fundedDate = runOn ?? fundedDateFor(stepEmitOffset(stepId));
      // amountFunded = totalFunding (gross of fees) reconstructed from active payback / factor
      let amountFunded: number | null = null;
      if (step && step.kind === 'reverse' && step.factorRate > 0) {
        amountFunded = ap.balance / step.factorRate;
      }
      const funderName = step && step.kind === 'reverse' ? step.funderName : undefined;
      out.push({
        id: nextId++,
        entity: funderName?.trim() || 'Reverse RTR',
        balance: ap.balance,
        dailyPayment: ap.dailyPayment,
        isOurPosition: false,
        includeInReverse: false,
        fundedDate,
        amountFunded,
        frequency: 'daily',
      });
      continue;
    }

    if (ap.source === 'straight-rtr') {
      // Single-fire: 'straight-{stepId}'
      // Recurring: 'rstraight-{stepId}-{N}'
      const isRecurring = ap.id.startsWith('rstraight-');
      let stepId: string;
      let recurringIdx = 0; // 1-indexed; 0 == not recurring
      if (isRecurring) {
        const rest = ap.id.slice('rstraight-'.length);
        const lastDash = rest.lastIndexOf('-');
        if (lastDash > 0) {
          stepId = rest.slice(0, lastDash);
          recurringIdx = parseInt(rest.slice(lastDash + 1), 10) || 1;
        } else {
          stepId = rest;
          recurringIdx = 1;
        }
      } else {
        stepId = ap.id.startsWith('straight-') ? ap.id.slice('straight-'.length) : ap.id;
      }
      const { idx: sIdx, step } = findStep(stepId);

      let fundedDate: string;
      let amountFunded: number | null = null;
      let funderName: string | undefined;
      let frequency: 'daily' | 'weekly' = 'daily';

      if (step && step.kind === 'recurring-straight') {
        const cadenceDays = Math.max(0, Math.round(step.cadenceWeeks * BUSINESS_DAYS_PER_WEEK));
        const lastFire = checkpoints[sIdx + 1]?.dayOffset ?? checkpoint.dayOffset;
        const firstFireOffset = lastFire - Math.max(0, step.count - 1) * cadenceDays;
        const n = Math.max(1, recurringIdx);
        const fundedOffset = firstFireOffset + (n - 1) * cadenceDays;
        fundedDate = fundedDateFor(fundedOffset);
        amountFunded = step.amountEach;
        frequency = step.paymentCadence === 'weekly' ? 'weekly' : 'daily';
      } else if (step && step.kind === 'straight') {
        const runOn = step.runOn;
        fundedDate = runOn ?? fundedDateFor(stepEmitOffset(stepId));
        amountFunded = step.grossFunding;
        funderName = step.funderName;
        frequency = step.paymentCadence === 'weekly' ? 'weekly' : 'daily';
      } else {
        fundedDate = fundedDateFor(checkpoint.dayOffset);
      }

      out.push({
        id: nextId++,
        entity: funderName?.trim() || (step && step.kind === 'recurring-straight' ? `Straight #${recurringIdx}` : 'Straight RTR'),
        balance: ap.balance,
        dailyPayment: ap.dailyPayment,
        isOurPosition: false,
        includeInReverse: true,
        fundedDate,
        amountFunded,
        frequency,
      });
      continue;
    }
  }

  const asOfDate = fundedDateFor(checkpoint.dayOffset);
  return { positions: out, asOfDate };
}
