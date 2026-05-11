# Builder Tab Summary-First Restructure

## Goal
Make the Builder tab open to a clean underwriter-friendly summary (start → sequence → end), with the existing step-card editor hidden behind a "Show steps" toggle.

## Files touched
- `src/pages/DealLab.tsx` (rename existing panel + add new summary + toggle wiring)
- `src/components/leverage/ScenarioSummary.tsx` (new)

## 1. Rename existing builder
In `src/pages/DealLab.tsx`, rename `ScenarioBuilderPanel` → `ScenarioStepEditor`. Strip from this component:
- the header card with the Add Step dropdown + Export PDF (lines ~586–617) — these move to the always-visible top bar in section 3
- the 5-tile end-state strip (lines ~619–645) — moves into the new summary
- the `ScenarioSparkline` (line ~647) — moves into the new summary

Keep: the empty-state card and the per-step `StepCard` + `AfterStepRow` rendering loop.

## 2. New `ScenarioSummary` component
Props: `{ scenario, scenarioRun, monthlyRevenue, onJumpToStep(idx) }`.

Three stacked sections plus the existing sparkline:

**a. Starting state card** — single card titled "Starting state · As of today". Source: `scenarioRun.checkpoints[0]`. Show: Total Balance, Daily, Weekly (= daily × 5), Leverage badge (band coloring reused from `AfterStepRow`), Burden badge.

**b. Sequence panel** — card titled "Sequence".
- If `scenario.steps.length === 0`: muted "Add a step above to start modeling".
- Otherwise: one button-row per step. Layout: `<date> · <action> → <delta>`.
  - Date: `step.runOn` if set; else compute by accumulating prior-step durations using `addBusinessDays(today, checkpoint.dayOffset)` from `dateUtils`. For wait steps, render the after-checkpoint date.
  - Action: the engine-emitted `Checkpoint.stepLabel` (fallback: step.kind label).
  - Delta: two pieces — `cashToMerchantStep` (signed, colored) and Δdaily = `after.totalDaily - before.totalDaily` (signed; negative is good).
- Each row is a button (keyboard accessible) calling `onJumpToStep(idx)`.

**c. Sparkline** — render `<ScenarioSparkline>` between Sequence and Ending state, with `weeklyExposure` + `stepMarkers` (move marker-build logic out of `ScenarioStepEditor` into the summary).

**d. Ending state card** — titled "Ending state". Two-column side-by-side: left = starting metrics, right = `scenarioRun.finalState` metrics (balance/daily/weekly/leverage/burden). Below, a 3-tile journey-stats row:
- Peak Combined Exposure → `scenarioRun.peakCombinedExposure`
- Total Cash to Merchant → `finalState.cashToMerchantCumulative` (color emerald/rose by sign)
- Total Profit → `finalState.profitCumulative`

Hide sparkline + ending state when `scenario.steps.length === 0`.

## 3. Builder tab wiring (DealLab.tsx, around lines 527–540)
Replace the single `<ScenarioBuilderPanel …/>` with:

```text
<TopActionsBar>   // single always-visible card: Add Step dropdown + Export PDF + "Show steps" Switch
<ScenarioSummary scenario scenarioRun monthlyRevenue onJumpToStep />
{showSteps && <ScenarioStepEditor … />}
<ScenarioStory … />   // unchanged
```

State: `const [showSteps, setShowSteps] = useState(false)`. Toggle is a shadcn `Switch` labeled "Show steps". The Add Step dropdown and Export PDF button live **only** in this top bar — they no longer appear inside `ScenarioStepEditor`.

## 4. Click-through from sequence row
- Lift `stepRefs = useRef<Record<string, HTMLDivElement | null>>({})` into the DealLab Builder block. Pass it down to `ScenarioStepEditor`, which attaches `ref={el => stepRefs.current[step.id] = el}` on the wrapper div around each `StepCard`.
- `onJumpToStep(idx)`:
  1. `setShowSteps(true)`
  2. `requestAnimationFrame(() => stepRefs.current[scenario.steps[idx].id]?.scrollIntoView({ behavior:'smooth', block:'center' }))`
  3. Set `focusedStepId` state, cleared after ~1.5s; `StepCard` wrapper applies `ring-2 ring-primary` while matched.

## 5. Acceptance
- 3-step scenario, default view: start card → 3 sequence rows → sparkline → end card with side-by-side + 3 journey tiles. Step cards hidden.
- Toggle Switch on → step cards render below summary.
- Click a sequence row → toggle flips on, target step scrolls into view with ring highlight.
- 0-step scenario → start card + "Add a step above to start modeling"; sparkline + ending card hidden.

## Out of scope
Engine math, new step kinds, Current Position card, as-of-date display, ScenarioStory, ScenarioTabs.
