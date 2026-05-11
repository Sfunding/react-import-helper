## Problem

When the user clicks **Commit to Calculator** on a scenario step, we:

1. Create a new child `saved_calculation` with the snapshot positions.
2. Navigate them to `/deal/<child-id>/lab`.

The child has **no scenarios** of its own. Worse, the Lab auto-creates an "Untitled Scenario" on first load, which makes it look like the user landed on a fresh deal and lost everything. The parent's scenarios are still safe in the database but completely invisible from this page.

The breadcrumb "↩ Derived from …" exists but is small and the user blew right past it.

## Fix — three changes, in order of importance

### 1. Auto-copy the parent's scenarios into the child on commit (high impact)

In `commitScenarioMutation` (`src/hooks/useCalculations.ts`), after inserting the child row:

- Read **all** `deal_scenarios` rows for the parent (`calculation_id = parentId`).
- For each one, insert a clone with `calculation_id = newChildId`, same `name`, same `scenario` JSON, `is_pinned: false`, `sort_order` preserved.
- Optionally prefix the cloned scenario name with `"↩ "` so it's obvious it came from the parent.

This means when the user lands on the child Lab, they immediately see the same scenarios they were just working on, ready to keep iterating.

### 2. Suppress the auto-create-on-empty for derived deals

`DealLab.tsx` (or wherever the empty-scenarios auto-create lives) currently inserts an "Untitled Scenario" when the deal has zero scenarios. When `parent_calculation_id` is set, **skip** this auto-create — the user just arrived, let them see exactly what was copied over instead of a spurious blank scenario.

(Bonus cleanup: the two empty "Untitled Scenario" / "New scenario" rows that exist on the current child deal can be silently deleted by the migration so the user sees a clean slate.)

### 3. Make the parent breadcrumb impossible to miss

In `Index.tsx` and `DealLab.tsx`, upgrade the "↩ Derived from [parent name]" line from a small caption into a visible banner above the page header:

```
[← Back to parent] Derived from "ONEflight WO AVION Consolidation WO AVION"
```

- Left-aligned banner, accent-bg, single line.
- Whole banner is clickable, navigates to `/deal/<parent-id>/lab` (Lab → Lab, Calc → Calc).
- Includes a small "Open parent" button as a secondary affordance.

## Acceptance

- Commit to Calculator on a parent that has Scenario A (11 steps) and Scenario B (3 steps) → child deal opens with **the same two scenarios** copied in, same step counts, ready to edit.
- The child does **not** auto-create an empty "Untitled Scenario" on load.
- A clearly visible banner at the top of the child deal's Lab and Calculator says "Derived from …" and clicking it returns to the parent.
- Parent deal's scenarios are untouched (cloning is a copy, not a move).

## Out of scope

- Two-way sync between parent and child scenarios — they diverge after commit, intentionally.
- A "children" list on the parent (nice to have, not blocking).
- Undoing a commit (the child can always just be deleted from Saved Calculations).