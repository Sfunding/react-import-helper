## What the user wants

Right now Commit to Calculator works step-by-step — they click one step and snapshot the merchant's state at that moment. They want one click that commits the **whole scenario at once** — i.e., a child deal whose positions reflect *every* step having fired (all straight MCAs added, all reverses consolidated, all wait/recurring steps applied).

The math already supports this: `scenarioRun.checkpoints[scenario.steps.length]` is the final checkpoint, and `checkpointToPositions(...)` against it returns the end-state position stack.

## Change

### 1. New entry point — "Commit final state"
Add a button in the Deal Lab control bar (next to "Export PDF"), and a second one inline at the top of `ScenarioSummary`:

> **Commit final state** — opens the existing CommitScenarioDialog pre-loaded with the **last step** and **snapshotWhen = "after"**.

Disabled when:
- `originalCalc` isn't loaded yet, or
- the scenario has zero steps, or
- the simulation hasn't run (no checkpoints).

### 2. Dialog adjustments when invoked in "final state" mode
The same `CommitScenarioDialog` handles it — just opened with `stepIndex = steps.length - 1` and the right defaults. To make the UX obvious when it's a full-scenario commit (as opposed to a per-step commit), add a small `mode` prop:

- `'step'` (existing per-step behavior, unchanged).
- `'final'` — title becomes "Commit final state to Calculator", description reads "Snapshot after all N steps have fired", and the "Snapshot state (Before/After)" radio group is **hidden** (always "after"). Default name becomes `${originalCalc.name} — Final State`.

Everything else (carryover modes, settings copy, reverse-param overrides if the last step is a reverse) stays identical.

### 3. Wiring
- `DealLab.tsx`: add `commitMode: 'step' | 'final' | null` state alongside `commitStepIndex`. New button sets `commitStepIndex = steps.length - 1`, `commitMode = 'final'`. Existing per-step triggers set `commitMode = 'step'`.
- Pass `mode` into `CommitScenarioDialog`.

## Acceptance

- A scenario with 10 straights + 1 reverse → click "Commit final state" → dialog opens titled "Commit final state to Calculator", "After all 11 steps". Click Commit → new child deal in Saved Calculations whose positions include all 10 straight RTRs (with correct fundedDate per step), reverses consolidated, and the parent's surviving balances projected through the entire timeline.
- If the last step is a reverse, factor / fee / daily decrease overrides from that step apply to the new deal's settings (same as today's per-step reverse commit).
- Per-step "Commit to Calculator" continues to work exactly as before.
- Parent scenarios are auto-cloned into the child (already in place from previous change).

## Out of scope

- Picking an arbitrary range of steps (only "everything" vs "single step"). Can be added later if needed.
- Splitting one commit into multiple child deals (one per step). The per-step button already covers that one at a time.