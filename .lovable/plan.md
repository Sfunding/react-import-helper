## Goal

Make the Leverage Analyzer a real deal-architecture tool. Today the Straight MCA card only takes a gross-funding number, factor, fee, and term in months. The user wants to model deals the way they actually pitch them: a defined check size on a weekly cadence at a specific factor and fee for a specific number of weeks, and then a Hybrid trigger that can fire on a specific week — chosen either because positions fall off, because the straight deal has paid down enough to lower exposure, or because peak exposure crosses a threshold.

## What's changing on the Straight MCA card

Switch the inputs from "gross funding + months" to a full deal sheet:

- **Advance amount (gross funding)** — explicit dollar field, defaults to the sum of selected payoffs (no implicit 20% buffer)
- **Factor rate** — default 1.35 (was 1.49)
- **Origination fee %** — default 5% (was 9%)
- **Term in weeks** — default 15 (was 6 months). Daily payment = total payback ÷ (term weeks × 5 business days)
- **Payment cadence** — radio: `Daily` or `Weekly`. Weekly shows a "Weekly payment" line; daily shows the daily-clip line. Both are always computed under the hood for the leverage math.
- **Positions to pay off on day 1** — unchanged checkbox list

A small read-only summary panel shows: payoffs total, net advance, cash to merchant, total payback, daily payment, weekly payment, profit, day the straight MCA itself pays off (term weeks × 5).

## What's changing on the Hybrid card (Straight now → Reverse later)

The Hybrid card already reuses the Straight MCA inputs, so it inherits everything above (factor, fee, weeks, cadence). What we're adding:

- **Trigger in weeks**, not business days. New radio:
  - `Fixed week` — number input, e.g. `Week 10`. Internally converts to `week × 5` business days.
  - `After positions fall off` — existing behavior, now also displays the answer as a week number.
  - `When straight-MCA exposure drops below $X` — new mode. We already track straight-MCA RTR per day; we find the first business day where the straight RTR is ≤ the user-entered dollar threshold and convert that to a week.
  - `When combined exposure drops below $X` — new mode. Same idea but the threshold is checked against straight RTR + projected remaining-stack balance at that day.

- **Trigger-day readout** is rewritten in week language: "Reverse fires on **week 10** (business day 50). At that point: straight RTR $X, remaining stack balance $Y, combined exposure $Z." This is what the user described — being able to see the moment exposure has dropped enough that they're comfortable layering the reverse.

- **Exposure timeline mini-chart** under the Hybrid card: a simple sparkline (no new chart library, just an inline SVG) showing weekly exposure for the first ~26 weeks, with a vertical marker on the trigger week. Hover-free; just visual context.

## Math additions in `src/lib/leverageMath.ts`

- Replace `termMonths` with `termWeeks` on `StraightMCAInputs`. Term days = `termWeeks × 5`. Weekly payment = `dailyPayment × 5` (matches the 5-biz-day/week constant already in the file).
- Add `paymentCadence: 'daily' | 'weekly'` to `StraightMCAInputs` (informational; doesn't change math, just controls what we surface).
- Add a `projectStraightMCABalance(result, businessDay)` helper that returns the straight-MCA RTR balance on a given day, capped at zero.
- Extend `HybridTrigger` with two new variants:
  - `{ kind: 'straight-exposure-below'; threshold: number }`
  - `{ kind: 'combined-exposure-below'; threshold: number }`
- Update `computeTriggerDay` to walk day-by-day (cap at, say, 30 weeks = 150 days) and resolve the first day where the condition holds. If never reached inside the window, return the cap and surface a small "threshold not reached within 30 weeks" hint in the UI.
- Add `buildExposureTimeline(positions, straightResult, weeks)` returning `[{ week, straightRTR, remainingStackBalance, combined }, …]` so the UI sparkline and Hybrid card share one source of truth.

## PDF export

Update `exportPDF()` in `Leverage.tsx`:

- Header row already shows scenario, cash, new daily debits, leverage, burden, profit, recommended. Add a second small table titled **"Straight MCA Deal Terms"** with rows: advance, factor, fee, term (weeks), daily, weekly, total payback, profit.
- Add a **"Hybrid Trigger"** line: trigger type, the resolved week, straight RTR at trigger, combined exposure at trigger.

Standard Helvetica only, no unicode (per project rule).

## Files touched

| File | Change |
|---|---|
| `src/lib/leverageMath.ts` | Switch to `termWeeks`, add cadence, add two new trigger kinds, add `projectStraightMCABalance` and `buildExposureTimeline`. |
| `src/pages/Leverage.tsx` | New Straight MCA input layout (weeks + cadence + explicit advance). New Hybrid trigger UI with fixed-week and two exposure-threshold modes. Inline SVG sparkline. Updated PDF. |
| `.lovable/plan.md` | Mark the new tasks. |

## Defaults that match the user's example

- Advance: prefilled to the merchant's selected payoffs (no 20% buffer). User can type `1,000,000` directly.
- Factor: 1.35
- Fee: 5%
- Term: 15 weeks
- Cadence: Weekly
- Hybrid trigger: `Fixed week`, week 10

So with one click on "Pay off top X positions" the user can land on exactly the deal they described and then drag the trigger week around to see where the reverse becomes safe.

## Out of scope

- Tranched / multi-draw straight MCAs (e.g. literally cutting $1M per week for 4 weeks). Today the straight MCA is one upfront advance. If the user wants real weekly tranching, that's a follow-up — call it out in the UI as "single-draw" and we can extend later.
- Changing the reverse engine, the saved-deal schema, or the recommendation logic beyond feeding it the new numbers.
- Persisting Straight/Hybrid input drafts across reloads.
