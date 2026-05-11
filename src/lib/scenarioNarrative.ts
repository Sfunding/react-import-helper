/**
 * Pure helpers to translate a Scenario + its computed Checkpoints into a
 * plain-English narrative ("If you do X on Y, balance goes from A to B").
 */
import { ScenarioStep, Scenario, Checkpoint } from '@/lib/scenarioTypes';

const fmtMoney = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v || 0);
const fmtX = (v: number) => `${v.toFixed(2)}x`;
const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

function fmtDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export interface StoryEntry {
  stepIndex: number; // -1 for baseline
  title: string;
  dateLabel: string | null;
  dayOffset: number;
  sentence: string;
  before: Checkpoint;
  after: Checkpoint;
  /** Cadence for display purposes ('weekly' shows weekly debit figures). */
  displayCadence: 'daily' | 'weekly';
}

const funderFor = (step: ScenarioStep): string | null => {
  if (step.kind === 'straight' || step.kind === 'reverse') {
    return step.funderName?.trim() || null;
  }
  if (step.kind === 'add-position') return step.entity?.trim() || null;
  return null;
};

function sentenceFor(step: ScenarioStep, before: Checkpoint, after: Checkpoint): string {
  const funder = funderFor(step);
  switch (step.kind) {
    case 'straight': {
      const payoffs = before.activePositions.filter(p => step.payoffPositionIds.includes(p.id));
      const payoffsTotal = payoffs.reduce((s, p) => s + p.balance, 0);
      const gross = step.grossFunding > 0 ? step.grossFunding : payoffsTotal;
      const cashStep = after.cashToMerchantStep;
      const totalPayback = gross * step.factorRate;
      const termDays = Math.max(1, Math.round(step.termWeeks * 5));
      const daily = totalPayback / termDays;
      const paymentPhrase = step.paymentCadence === 'weekly'
        ? `a weekly payment of ${fmtMoney(daily * 5)}`
        : `a daily debit of ${fmtMoney(daily)}`;
      const parts: string[] = [];
      parts.push(`Take a straight MCA of ${fmtMoney(gross)}${funder ? ` from ${funder}` : ''} at a ${step.factorRate.toFixed(2)} factor over ${step.termWeeks} weeks with ${paymentPhrase}.`);
      if (payoffs.length > 0) {
        parts.push(`This pays off ${payoffs.length} position${payoffs.length === 1 ? '' : 's'} totaling ${fmtMoney(payoffsTotal)}.`);
      }
      parts.push(`Net cash to the merchant after fees and payoffs: ${fmtMoney(cashStep)}.`);
      return parts.join(' ');
    }
    case 'recurring-straight': {
      const totalPayback = step.amountEach * step.factorRate;
      const termDays = Math.max(1, Math.round(step.termWeeks * 5));
      const dailyEach = totalPayback / termDays;
      const perInfusion = step.paymentCadence === 'weekly'
        ? `${fmtMoney(dailyEach * 5)}/wk each`
        : `${fmtMoney(dailyEach)}/day each`;
      return `Fire ${step.count} straight MCAs of ${fmtMoney(step.amountEach)} every ${step.cadenceWeeks} week${step.cadenceWeeks === 1 ? '' : 's'} at a ${step.factorRate.toFixed(2)} factor (${step.termWeeks}-week term, ${perInfusion}). Total net cash delivered this step: ${fmtMoney(after.cashToMerchantStep)}.`;
    }
    case 'add-position': {
      return `${funder || 'A new funder'} comes in with a balance of ${fmtMoney(step.balance)} and a daily debit of ${fmtMoney(step.dailyPayment)}.`;
    }
    case 'reverse': {
      const included = before.activePositions.filter(p => step.includedPositionIds.includes(p.id));
      const totalAdvance = included.reduce((s, p) => s + p.balance, 0);
      return `Reverse-consolidate ${included.length} position${included.length === 1 ? '' : 's'} (${fmtMoney(totalAdvance)} of open balance)${funder ? ` with ${funder}` : ''} at a ${step.factorRate.toFixed(2)} factor and a ${(step.dailyDecrease * 100).toFixed(0)}% daily-payment discount. New daily debits drop to ${fmtMoney(after.totalDaily)}.`;
    }
    case 'wait': {
      return `Wait ${step.weeks} week${step.weeks === 1 ? '' : 's'} (${step.weeks * 5} business days) while active positions keep paying down.`;
    }
  }
}

function titleFor(step: ScenarioStep, idx: number): string {
  const kindLabel: Record<ScenarioStep['kind'], string> = {
    'straight': 'Straight MCA',
    'recurring-straight': 'Recurring program',
    'wait': 'Wait',
    'add-position': 'Add position',
    'reverse': 'Reverse',
  };
  const auto = kindLabel[step.kind];
  const nickname = step.label?.trim();
  return `Step ${idx + 1} · ${nickname || auto}`;
}

export function buildStory(scenario: Scenario, checkpoints: Checkpoint[]): StoryEntry[] {
  const out: StoryEntry[] = [];
  // checkpoints[0] is "Today" baseline. Each subsequent is the state AFTER step i.
  for (let i = 0; i < scenario.steps.length; i++) {
    const step = scenario.steps[i];
    const before = checkpoints[i];        // state before this step
    const after = checkpoints[i + 1];     // state after
    if (!before || !after) continue;
    const displayCadence: 'daily' | 'weekly' =
      (step.kind === 'straight' || step.kind === 'recurring-straight')
        ? step.paymentCadence
        : 'daily';
    out.push({
      stepIndex: i,
      title: titleFor(step, i),
      dateLabel: fmtDate((step as { runOn?: string }).runOn),
      dayOffset: after.dayOffset,
      sentence: sentenceFor(step, before, after),
      before,
      after,
      displayCadence,
    });
  }
  return out;
}

export const storyFormatters = { fmtMoney, fmtX, fmtPct };
