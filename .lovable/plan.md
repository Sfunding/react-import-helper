
## Multi-scenario Deal Lab + named steps + plain-English summary

Today every deal has exactly one scenario stored in `saved_calculations.recommended_scenario`. We're upgrading the Deal Lab so you can build, save, and switch between many named scenarios on the same deal, label every step and funder, and read a clear "if you do this, then this happens" story.

### 1. Multiple scenarios per deal

**New table `deal_scenarios`** (one row per scenario):

```text
id              uuid pk
calculation_id  uuid  → saved_calculations.id (indexed)
user_id         uuid  (owner, for RLS)
name            text  ('Bridge then reverse', 'Aggressive payoff', ...)
scenario        jsonb (the full Scenario object: steps, runOn dates, labels)
is_pinned       boolean default false   (sticky tab, default scenario)
sort_order      int default 0           (tab order)
created_at, updated_at timestamps
```

RLS: same shape as `saved_calculations` — owner sees own, admins see all, shared-edit users can read/write through the existing `deal_shares` link on the parent calculation.

**Migration path:** existing `saved_calculations.recommended_scenario` stays as-is and is treated as a "legacy fallback" — on Lab load, if no rows exist in `deal_scenarios` for this deal but `recommended_scenario` has data, we surface it as a single scenario named "Saved scenario" and offer to migrate it on first save.

### 2. Switcher UI — tabs + side-by-side compare

Above the Scenario Builder section:

```text
[ Bridge then reverse ▾ ] [ Aggressive payoff ] [ + New ]    [ ⇆ Compare ]
                              Rename · Duplicate · Delete
```

- **Tab strip** of all saved scenarios for this deal. Click to switch. Long names truncate, the right-click / chevron opens rename / duplicate / delete / pin.
- **+ New** prompts for a name and creates a blank scenario.
- **⇆ Compare** flips the layout to two columns: pick a second scenario from a dropdown; the builder is hidden and you see two read-only summary panels (final state metrics + step-by-step narrative) next to each other. One click to swap which is "left" / "right". Exit Compare to return to single-edit mode.
- A small **● Unsaved** dot appears on the active tab while you have local edits; **Save scenario** persists the row. Auto-save toggle reuses the existing hook for the active scenario.

### 3. Named steps + named funders

- **Step nickname:** the step card title becomes editable inline. Click `Step 1 · Straight MCA` → cursor lands in a text input that holds `step.label`. On blur, save. Empty clears back to the auto label. This already exists in the data model (`ScenarioStep.label`) — just no UI today.
- **Funder name per step:** straight and reverse steps gain a `funderName?: string` field rendered as a small `Funder` input next to the date picker. The active position list, the auto-label, the checkpoint label, and the summary narrative all use this name (falls back to "Straight MCA"/"Reverse RTR").
- `AddPositionStep.entity` is already a name input — we just relabel it "Funder name" for consistency.

### 4. Step-by-step plain-English summary

A new **Story** panel below the builder (and the primary view inside Compare mode):

For each checkpoint, render:

```text
─────────────────────────────────────────────────────────────
Step 1 · "Bridge funding"  ·  Fri, Nov 14, 2026  ·  Day 14
Straight MCA $200,000 with Velocity Capital
You pay off 2 positions ($95k total). Net cash to merchant: $93,000.

| Metric              | Before    | After     |
|---------------------|-----------|-----------|
| Total balance       | $312,400  | $477,400  |
| Daily debits        | $4,820    | $6,150    |
| Balance leverage    | 0.78x     | 1.19x     |
| Payment burden      | 24.1%     | 30.7%     |
─────────────────────────────────────────────────────────────
Step 2 · "Wait for cleanup"  ·  Fri, Dec 12, 2026  ·  Day 34
...
```

Each block is one sentence describing the action (templated per step kind, plugging in the funder name, dollar amounts, date, and any payoffs/added positions), plus a compact 4-row before/after table sourced from the existing `Checkpoint` data — so no new math, just new rendering.

A header at the top of the Story sets the baseline:

```text
Today (Mon, Nov 10, 2026): balance $312,400 · daily $4,820 · 0.78x · 24% burden.
```

A footer summarizes the final state and cumulative cash + profit.

### Files to touch

```text
NEW  supabase migration                       — deal_scenarios table + RLS
NEW  src/hooks/useDealScenarios.ts            — fetch / create / update / delete / reorder
NEW  src/components/leverage/ScenarioTabs.tsx — tab strip + rename/duplicate/delete + Compare toggle
NEW  src/components/leverage/ScenarioStory.tsx— renders the narrative + before/after tables
NEW  src/lib/scenarioNarrative.ts             — pure helpers: buildStorySentences(scenario, checkpoints)

EDIT src/lib/scenarioTypes.ts                 — add `funderName?: string` to straight + reverse step types
EDIT src/components/leverage/StepCard.tsx     — inline-editable step label, funderName input
EDIT src/lib/leverageMath.ts                  — stepLabel uses funderName/label; checkpoint note enriched
EDIT src/pages/DealLab.tsx                    — scenarios state list, tabs, Compare mode,
                                                 Story panel, swap save/load to deal_scenarios,
                                                 legacy `recommended_scenario` migration on first save
```

### Data backfill / compatibility
- Old saved scenario blob keeps loading (read-only, surfaced as one tab).
- First save in the new system migrates that blob into a `deal_scenarios` row and clears the legacy field (optional second migration later — not blocking).
- PDF export emits the Story for the currently-active scenario.

### Out of scope
- Cross-deal scenario templates (copy a scenario from deal A to deal B).
- Auto-recommendation across multiple custom scenarios (the existing reverse/straight/hybrid recommender stays untouched).
- Real-time multiplayer editing.
