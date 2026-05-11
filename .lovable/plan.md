# Scenario Builder — Multi-Step Deal Timeline

Today the Leverage page has three fixed scenarios (Reverse / Straight / Hybrid). The user wants to compose a timeline: e.g. "give a 4‑week straight, wait, add a new outside position, then run a reverse on whatever the stack looks like at that point." This plan adds that.

## What the user sees

A new tab on `/leverage` called **Scenario Builder** alongside the existing cards.

Top of the panel: the live stack snapshot (balances, daily debits, leverage, burden) — this is **Step 0**, "Today".

Below it, an ordered list of **steps** the user adds. Each step is a card. Available step types:

1. **Straight MCA** — same input set as the existing Straight card (advance, factor, fee, term weeks, cadence, payoff selection). Day 1 of this step is "now" relative to the previous step's end.
2. **Wait** — N weeks of no action; just lets balances pay down.
3. **Add outside position** — hypothetical new debt the merchant takes on mid‑timeline (balance, daily, funder name).
4. **Reverse** — runs on the projected state at this point. Has a checkbox **"Also pay off the open Straight MCA from step X"** (per the user's choice — toggle per scenario). Inputs: factor, fee, daily decrease, and a checkbox list of positions present at that moment (existing survivors + any added outside positions + optionally the running straight RTR as a synthetic position).

At the bottom: **State at end of timeline** — total balance, daily debits, leverage, burden, peak exposure, total cash to merchant across all steps, total profit. And a **timeline sparkline** showing combined exposure week-by-week with vertical markers at each step.

Actions on each step: drag to reorder, duplicate, delete, collapse. A "Save scenario" button writes the whole timeline into `saved_calculations.recommended_scenario` (column already exists). A "Load scenario" picker reads it back. PDF export adds a Scenario Builder section.

## How the math works

A single forward simulator walks the timeline day by day, keeping per-position state `{ balance, daily, source }` where `source` is `original | straight-rtr | outside-added | reverse-rtr`.

For each step the engine:

- **Straight**: marks the selected payoff positions to zero on day 1, credits payoffsTotal toward "cash deployed", spawns a new synthetic `straight-rtr` position with balance = total payback and daily = total payback / (weeks × 5). Advances the clock by 0 days (the straight starts immediately and runs in parallel).
- **Wait**: advances the clock by `weeks × 5` business days, decrementing each active position's balance by `daily × days` (cap at 0; zero daily once balance hits 0).
- **Add outside position**: appends a new active position. No clock advance.
- **Reverse**: snapshots active positions, runs `simulateReverseSnapshot` on the user-selected subset (including the straight-rtr if the toggle is on). Replaces those positions with a new `reverse-rtr` synthetic position; the rest stay running. No clock advance unless the user adds a Wait after it.

After each step the engine emits a checkpoint: `{ stepIndex, dayOffset, weekOffset, activePositions, totalBalance, totalDaily, leverage, burden, cashToMerchant, profit }`. The bottom panel reads the last checkpoint; the sparkline reads all of them.

## State, persistence, types

`Scenario = { id, name, steps: ScenarioStep[] }` where `ScenarioStep` is a discriminated union (`straight | wait | add-position | reverse`). Lives in component state via `useState` while editing; on Save we write `{ scenario, checkpoints }` into `saved_calculations.recommended_scenario` (jsonb, no migration needed). Each step has a stable `id` (uuid) so reorder/duplicate are clean.

## Files touched

| File | Change |
|---|---|
| `src/lib/leverageMath.ts` | Add `runScenario(positions, scenario)` that returns `{ checkpoints, finalState, weeklyExposure }`. Reuses existing `simulateStraightMCA`, `simulateReverseSnapshot`, `projectPosition`. Adds the active-position state machine described above. |
| `src/lib/scenarioTypes.ts` (new) | `Scenario`, `ScenarioStep` (discriminated union), `Checkpoint`, helpers (`makeStep`, `reorder`). |
| `src/pages/Leverage.tsx` | New `<Tabs>` with "Compare" (current 3 cards) and "Scenario Builder". Builder UI: step list, add-step menu, per-step editors, final-state panel, sparkline, Save/Load/PDF buttons. |
| `src/components/leverage/StepCard.tsx` (new) | Renders one step with the right editor based on `step.kind`. |
| `src/components/leverage/ScenarioSparkline.tsx` (new) | SVG line chart of `weeklyExposure` with step markers. Inline, no chart library. |
| `.lovable/plan.md` | Replace the current plan with the scenario-builder plan. |

No DB migration — `recommended_scenario jsonb` already exists.

## Defaults so the example "just works"

Clicking **+ Add step → Straight** pre-fills factor 1.35, fee 5%, term 4 weeks, cadence weekly, advance prefilled to sum of selected payoffs. Then **+ Add step → Reverse** pre-fills with all positions still active at that moment selected, factor 1.49, fee 9%, 30% daily decrease, and "Pay off the open Straight MCA" checked.

## Out of scope

- Real tranched multi-draw straights (still one upfront advance per Straight step — user can add multiple Straight steps spaced by Wait steps to approximate).
- Editing the actual reverse engine on the main calculator page.
- A library of preset scenarios — saving/loading per-deal only for now.
- Sensitivity sliders / Monte Carlo. This is deterministic projection only.

## After implementation

- Smoke-test the user's example: stack of N positions → Straight 4 weeks @ 1.35/5% paying off top 2 → Wait 0 → Reverse including straight-rtr. Confirm checkpoints show projected balances correctly and final leverage/burden numbers tie out by hand on a small case.
- Confirm Save → reload roundtrips the scenario.
