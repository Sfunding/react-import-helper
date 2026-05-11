## Goal
When a step in the Deal Lab Scenario Builder has its **Cadence** set to **Weekly**, surface weekly payment figures as the primary numbers (with daily as the secondary "equiv."), instead of always showing daily as the headline.

Today the cadence radio exists on Straight and Recurring-Straight steps but the math summary inside each card still leads with `Daily: $X` and only mentions weekly as a derived line. Reverse steps also always say "New Daily". The narrative + before/after table in the Story panel always say "Daily debits".

## Scope (UI only — no math changes)

### 1. `StepCard.tsx` — per-step editors
- **StraightEditor footer grid**: when `step.paymentCadence === 'weekly'`, lead with **Weekly: `daily*5`** (bold), and show **Daily equiv.: `daily`** as the secondary row. Default (daily) stays as today.
- **RecurringStraightEditor footer**: same swap — "Weekly Added per Straight" / "Peak Weekly Stack" lead when cadence is weekly; daily becomes the secondary "equiv." line. Update Infusion Ladder column header from `Daily Added` → `Weekly Added` and value `+$X/wk` when weekly.
- **ReverseEditor footer**: reverse steps don't carry their own cadence field, but they inherit the merchant's current rhythm. Add a small "Show as" toggle (Daily / Weekly) defaulting to Daily, and when Weekly is picked: show **New Weekly: `newDaily*5`** as the lead with Daily as equiv. (Term display in business days stays.) — *alternative:* skip the toggle on reverse and leave as-is. Default plan: add the toggle for parity.

### 2. `ScenarioStory.tsx` — narrative + before/after table
- Each step has access to its `paymentCadence` (straight/recurring-straight) or inherits 'daily' otherwise. For the **per-step row** in the before/after table:
  - If that step is weekly, the `Daily debits` row becomes `Weekly debits` and values are `totalDaily * 5`.
  - Other rows (Balance, Leverage, Burden) unchanged.
- For the **header baseline** and **final state** sentences (which describe the overall stack, not one step): keep showing daily as primary, but switch to weekly-primary if **the last action step** in the scenario was weekly. Otherwise daily.

### 3. `scenarioNarrative.ts`
- Straight step sentence: if `paymentCadence === 'weekly'`, phrase as `…weekly payment of $X` (= daily*5) instead of `daily debits of $X`.
- Reverse step sentence: append `(≈ $Y weekly)` when relevant, but keep "daily debits" as the canonical phrasing since reverse cadence isn't tracked per-step.
- Recurring-straight: same as straight — swap to weekly phrasing when cadence is weekly.

### 4. Out of scope
- No changes to `leverageMath.ts` — `totalDaily`, schedule math, sparkline, PDF exports, checkpoint storage all stay daily-denominated internally. This is purely a display-layer toggle driven by each step's `paymentCadence` field.
- The summary "End Daily" tile and PDF tables stay as-is (those are cross-scenario aggregates where daily is the lowest common denominator). Can revisit in a follow-up if desired.

## Acceptance
- Set a Straight step's Cadence to Weekly → its card's footer leads with the weekly number, and the Story row for that step says `Weekly debits` with `daily*5`.
- Flip back to Daily → original behavior.
- No regressions to math, schedule, sparkline, or PDF output.