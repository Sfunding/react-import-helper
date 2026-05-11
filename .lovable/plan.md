## Problem

The Deal Lab loads positions from the saved calculation but ignores the `includeInReverse` flag. So if a user excluded a position in the Calculator (the "Include in Reverse" checkbox), it still shows up in Lab simulations, scenario steps, and projections.

Every other surface in the app (Calculator totals, exports, PDFs, cash buildup) already respects `p.includeInReverse !== false`. Deal Lab is the only outlier.

## Fix

In `src/pages/DealLab.tsx`, the single `positions` memo (line ~127) currently filters:

```ts
(selectedCalc?.positions || []).filter(
  p => !p.isOurPosition && (p.balance ?? 0) > 0 && (p.dailyPayment ?? 0) > 0
)
```

Add the same exclusion clause used everywhere else:

```ts
(selectedCalc?.positions || []).filter(
  p =>
    !p.isOurPosition &&
    p.includeInReverse !== false &&
    (p.balance ?? 0) > 0 &&
    (p.dailyPayment ?? 0) > 0
)
```

That single change propagates through everything downstream (no other DealLab code needs to touch position selection):

- `projectedPositions` (projection to today)
- `totals` / `projectedTotals` (header metrics)
- `weeklyPositions` (weekly debit clip)
- All scenario step inputs and simulation engine calls (`useMemo` at line ~286)
- `ScenarioSummary`, `ScenarioStory`, `StepCard` position pickers, and the new `CommitScenarioDialog` snapshot

## Acceptance

- In the Calculator, uncheck "Include in Reverse" on a position → open Deal Lab for that deal.
- The excluded position is gone from the position list, header totals, sequence row, and is not selectable as a payoff target in any scenario step.
- Simulations and the Final State card reflect totals without the excluded position.
- Re-checking the box in Calculator and reopening Lab restores it.

## Out of scope

- No UI inside Deal Lab to toggle inclusion (still managed in Calculator).
- No change to `Position` shape, DB schema, or saved scenarios.
- Already-saved scenarios that reference an excluded position ID will simply find no match at runtime — same behavior as if the position were deleted; no migration needed.