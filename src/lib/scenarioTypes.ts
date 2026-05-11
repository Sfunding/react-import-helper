/**
 * Scenario Builder types — a timeline of steps a merchant could move through.
 */
import { PaymentCadence } from '@/lib/leverageMath';

export type StepKind = 'straight' | 'recurring-straight' | 'wait' | 'add-position' | 'reverse';

export interface StraightStep {
  id: string;
  kind: 'straight';
  label?: string;
  grossFunding: number;
  factorRate: number;
  feePercent: number;
  termWeeks: number;
  paymentCadence: PaymentCadence;
  /** IDs of currently-active positions to pay off on day 1 of this step */
  payoffPositionIds: string[];
}

export interface WaitStep {
  id: string;
  kind: 'wait';
  label?: string;
  weeks: number;
}

export interface AddPositionStep {
  id: string;
  kind: 'add-position';
  label?: string;
  entity: string;
  balance: number;
  dailyPayment: number;
}

export interface ReverseStep {
  id: string;
  kind: 'reverse';
  label?: string;
  factorRate: number;
  feePercent: number;
  dailyDecrease: number;
  /** IDs of currently-active positions to roll into the reverse */
  includedPositionIds: string[];
  /** Optional: run the reverse at this absolute week offset from t=0. If undefined, runs immediately. */
  runAtWeek?: number;
}

/** A program of N identical straight MCAs fired on a fixed cadence. Pure cash infusions — no payoffs. */
export interface RecurringStraightStep {
  id: string;
  kind: 'recurring-straight';
  label?: string;
  count: number;            // number of infusions
  cadenceWeeks: number;     // weeks between each infusion (1 = weekly)
  amountEach: number;       // gross funding per infusion
  factorRate: number;
  feePercent: number;
  termWeeks: number;
  paymentCadence: PaymentCadence;
}

export type ScenarioStep =
  | StraightStep
  | RecurringStraightStep
  | WaitStep
  | AddPositionStep
  | ReverseStep;

export interface Scenario {
  id: string;
  name: string;
  steps: ScenarioStep[];
}

/** An active position inside the scenario engine. ids are scenario-scoped strings. */
export interface ActivePosition {
  id: string;            // scenario-scoped id (e.g. 'orig-12', 'straight-<stepId>', 'rev-<stepId>', 'add-<stepId>')
  originalId?: number;   // matches original Position.id when sourced from the stack
  entity: string;
  balance: number;
  dailyPayment: number;
  source: 'original' | 'straight-rtr' | 'outside-added' | 'reverse-rtr';
}

export interface Checkpoint {
  stepIndex: number;            // -1 = start
  stepLabel: string;
  dayOffset: number;            // business days from t=0
  weekOffset: number;
  activePositions: ActivePosition[];
  totalBalance: number;
  totalDaily: number;
  balanceLeverage: number;
  paymentBurden: number;
  cashToMerchantStep: number;   // cash delivered by THIS step
  profitStep: number;           // profit booked by THIS step (gross)
  cashToMerchantCumulative: number;
  profitCumulative: number;
  note?: string;
}

export interface ScenarioRunResult {
  checkpoints: Checkpoint[];
  /** Per-week combined exposure across the whole timeline. */
  weeklyExposure: Array<{ week: number; combined: number }>;
  finalState: Checkpoint;
  peakCombinedExposure: number;
}

// ---- helpers ----

const rid = () => Math.random().toString(36).slice(2, 10);

export function makeStep(kind: StepKind): ScenarioStep {
  switch (kind) {
    case 'straight':
      return {
        id: rid(),
        kind: 'straight',
        grossFunding: 0,
        factorRate: 1.35,
        feePercent: 0.05,
        termWeeks: 4,
        paymentCadence: 'weekly',
        payoffPositionIds: [],
      };
    case 'wait':
      return { id: rid(), kind: 'wait', weeks: 4 };
    case 'add-position':
      return { id: rid(), kind: 'add-position', entity: 'New Position', balance: 0, dailyPayment: 0 };
    case 'recurring-straight':
      return {
        id: rid(),
        kind: 'recurring-straight',
        count: 7,
        cadenceWeeks: 1,
        amountEach: 1_000_000,
        factorRate: 1.35,
        feePercent: 0.05,
        termWeeks: 15,
        paymentCadence: 'weekly',
      };
    case 'reverse':
      return {
        id: rid(),
        kind: 'reverse',
        factorRate: 1.499,
        feePercent: 0.09,
        dailyDecrease: 0.30,
        includedPositionIds: [],
      };
  }
}

export function reorderSteps<T extends { id: string }>(steps: T[], from: number, to: number): T[] {
  const next = steps.slice();
  const [m] = next.splice(from, 1);
  next.splice(to, 0, m);
  return next;
}

export function newScenario(): Scenario {
  return { id: rid(), name: 'Untitled Scenario', steps: [] };
}
