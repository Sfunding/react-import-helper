# Commit Scenario Snapshot to Calculator

Spec as previously approved, with Section 3 recurring-straight fundedDate fix applied.

## Files

- `supabase/migrations/*` — add `parent_calculation_id`
- `src/types/calculation.ts` — add field to `SavedCalculation`
- `src/lib/leverageMath.ts` — add `checkpointToPositions`
- `src/hooks/useCalculations.ts` — add `commitScenarioMutation`
- `src/components/leverage/CommitScenarioDialog.tsx` — new
- `src/pages/DealLab.tsx` — wire commit triggers in sequence rows + step card menus
- `src/pages/SavedCalculations.tsx` — include `parent_calculation_id` and parent name in load payload
- `src/pages/Index.tsx` — render "↩ Derived from …" breadcrumb when present

## 1. Schema
```sql
ALTER TABLE saved_calculations
  ADD COLUMN parent_calculation_id uuid REFERENCES saved_calculations(id) ON DELETE SET NULL;
CREATE INDEX idx_saved_calculations_parent ON saved_calculations(parent_calculation_id);
```

## 2. Types
`SavedCalculation.parent_calculation_id: string | null`.

## 3. `checkpointToPositions(checkpoint, scenarioSteps, originalPositions, today, checkpoints)`

```ts
export function checkpointToPositions(
  checkpoint: Checkpoint,
  scenarioSteps: ScenarioStep[],
  originalPositions: Position[],
  today: Date,
  checkpoints: Checkpoint[]
): { positions: Position[]; asOfDate: string }
```

Helpers inside:
```ts
const stepEmitOffset = (stepId: string) => {
  const idx = scenarioSteps.findIndex(s => s.id === stepId);
  // Engine emits one checkpoint per step at checkpoints[idx + 1] (checkpoints[0] is the start state).
  // For instant steps this offset IS the fire offset. For recurring, it's the LAST fire offset.
  return checkpoints[idx + 1]?.dayOffset ?? checkpoint.dayOffset;
};
const fundedDateFor = (offset: number) => format(addBusinessDays(today, offset), 'yyyy-MM-dd');
```

Per `ActivePosition` (skip when `balance <= 0`):

- **`original`**: match by `originalId`. Carry `entity, fundedDate, amountFunded, isOurPosition, frequency, weeklyPullDay, includeInReverse`. Overwrite `balance` and `dailyPayment` from active.

- **`straight-rtr` single-fire** (id `straight-{stepId}`):
  - `fundedOffset = stepEmitOffset(stepId)` (instant — emit-checkpoint == fire).
  - `fundedDate = step.runOn ?? fundedDateFor(fundedOffset)`.

- **`straight-rtr` recurring** (id `rstraight-{stepId}-{N}`, N is 1-indexed):
  - Find step + `idx`.
  - **Fix:** `firstFireOffset = checkpoints[idx + 1].dayOffset - (step.count - 1) * step.cadenceWeeks * 5`. (The emit-checkpoint sits at the LAST fire, not the first.)
  - `fundedOffset = firstFireOffset + (N - 1) * step.cadenceWeeks * 5`.
  - `fundedDate = fundedDateFor(fundedOffset)` — recurring always uses computed per-N offset; `step.runOn` is not honored for recurring fires.

  Both straight cases: `entity` = step.funderName || 'Straight RTR'; `amountFunded` = step.grossFunding || step.amountEach; `isOurPosition: false`; `includeInReverse: true`; `frequency` from step.paymentCadence.

- **`outside-added`** (`add-{stepId}`): instant. `fundedDate = step.runOn ?? fundedDateFor(stepEmitOffset(stepId))`. `entity` = step.entity; `amountFunded: null`; `isOurPosition: false`; `includeInReverse: true`; `frequency: 'daily'`.

- **`reverse-rtr`** (`rev-{stepId}`): instant. `fundedDate = step.runOn ?? fundedDateFor(stepEmitOffset(stepId))`. `entity` = step.funderName || 'Reverse RTR'; `amountFunded` = totalFunding (gross of fees); `isOurPosition: false`; `includeInReverse: false`; `frequency: 'daily'`.

New numeric ids start at `Math.max(...originalPositions.map(p => p.id), 0) + 1`. `asOfDate = fundedDateFor(checkpoint.dayOffset)`.

All scenario-sourced positions land with `isOurPosition: false` regardless of funder name strings.

## 4. `commitScenarioMutation` in `useCalculations.ts`
Inserts a row with `parent_calculation_id = params.parentId`. On success: invalidate `saved-calculations`, log `commit_scenario` audit event, return the new row.

## 5. `CommitScenarioDialog`
Props: `{ open, onOpenChange, scenario, scenarioRun, stepIndex, originalCalc }`.

Body:
- Read-only: `Snapshot at: Step {N} — {step label}`
- **Snapshot state** radio: "Before this step fires" (default for reverse) / "After this step fires" (default for everything else).
- **Settings carryover** radio:
  - "Reverse params only" — defaults + step's reverse params (factor/fee/dailyDecrease) if reverse.
  - "All settings from original deal" (default) — copy `originalCalc.settings`; if reverse, override factor/fee/dailyDecrease with step values.
  - "Custom" — checkbox list (rate, feePercent, dailyPaymentDecrease, brokerCommission, fee schedule, fee schedule percent, earlyPayOptions, whiteLabelCompany). Checked = original, unchecked = default. If reverse, factor/fee/dailyDecrease pre-checked and overridden with step values.
- **Name** text input, prefilled `"{originalCalc.name} @ {snapshotDate} {stepLabel}"`.
- Footer: Cancel / Commit to Calculator.

On commit:
1. `checkpoint = scenarioRun.checkpoints[ before ? stepIndex : stepIndex + 1 ]`.
2. `{positions, asOfDate} = checkpointToPositions(checkpoint, scenario.steps, originalCalc.positions, new Date(), scenarioRun.checkpoints)`.
3. Build `settings` per carryover.
4. `merchant` from `originalCalc.merchant_*`.
5. `stackTotals(positions)` for totals.
6. Call mutation. On success: write `loadCalculation` payload to `sessionStorage` (id/name/merchant/settings/positions/as_of_date/parent_calculation_id/parent_name), `navigate('/')`, close dialog.

## 6. DealLab triggers
Shared state: `const [commitStepIndex, setCommitStepIndex] = useState<number | null>(null)`.
- `ScenarioSummary` Sequence row: small Lucide `GitBranch` icon button on far right, tooltip "Commit to Calculator".
- `StepCard` per-step dropdown menu: new "Commit to Calculator" item.
- Render `<CommitScenarioDialog open={commitStepIndex != null} stepIndex={commitStepIndex ?? 0} … />`.
- Disabled when `originalCalc` isn't loaded yet (unsaved Deal Lab session).

## 7. "Derived from" breadcrumb in Index
Above merchant info, when loaded calc has `parent_calculation_id`: muted line `↩ Derived from <parent name>`. Parent name is a button that triggers the same `loadCalculation` flow against the parent id. Parent name comes via the `loadCalculation` payload on commit; on hard refresh, fetch by id from `saved_calculations`.

## Acceptance
Per spec: 3-step scenario, Commit on reverse row → dialog defaults to "Before"/"All settings"/prefilled name → Calculator opens with projected positions, as-of = step date, factor/fee/decrease from the reverse, other settings from parent, breadcrumb visible and navigates back. Add-position step defaults to "After". A 4-fire weekly recurring straight produces 4 positions with `fundedDate` at D_first, D_first+5, D_first+10, D_first+15 (last fire = step's emit-checkpoint offset). All scenario-sourced positions land with `isOurPosition: false`. New deal appears in Saved Calculations.

## Out of scope
Children list on parent, cascading-commit UI, bulk commit, auto-detection of `isOurPosition`.
