## Goal

Make the calculator's "Positions as of" date a **live re-pricing control**. Whenever the as-of date changes (forward or back), every position with enough info to be re-priced updates its balance automatically — so you can move the date in either direction and see real, honest balances.

## Today vs target behavior

Today:
- Each position stores a single `balance` and (optionally) `fundedDate` + `amountFunded`.
- `asOfDate` exists at the top of the calculator, but changing it does NOT reprice balances. The only repricing that happens is a one-shot adjustment when loading a funded deal (`businessDaysElapsed` since `funded_at`), and inside Deal Lab.
- If you change the as-of date today, totals stay the same — which makes the date a label, not a control.

Target:
- Every position has an anchor: a known balance on a known date.
- Changing `asOfDate` reprices every anchored position by `(business days between anchor date and as-of date) × dailyPayment` — moving forward decreases balance, moving back increases it (clamped at the original funded amount when known, never below 0).
- Positions without an anchor (no funded date AND no "as of" history) stay manual.

## Anchor model (per position)

Add two optional fields (frontend type only — JSONB column, no DB migration):

- `balanceAsOfDate: string | null` — the date the stored `balance` is true on.
- `balanceAnchor: 'funded' | 'manual' | null` — how the anchor was set.

Anchor rules:
1. **Funded-date anchor.** If `fundedDate` + `amountFunded` are set, anchor = `fundedDate` with balance = `amountFunded`. This is the strongest anchor — repricing can go all the way back to funding and forward to today (or any as-of date).
2. **Manual anchor.** If the user types a balance for a position without a funded date, we stamp `balanceAsOfDate = currentAsOfDate` and `balanceAnchor = 'manual'`. From then on, changing the calculator's as-of date reprices off that stamp.
3. **Legacy positions** (no anchor saved): on load, treat `balanceAsOfDate = saved_calculations.as_of_date` (or today) as the manual anchor so existing deals keep working.

Repricing formula (single source of truth, in a new helper):

```
repricedBalance(p, asOfDate):
  anchor = p.fundedDate && p.amountFunded ? { date: fundedDate, bal: amountFunded }
         : p.balanceAsOfDate && p.balance != null ? { date: balanceAsOfDate, bal: balance }
         : null
  if !anchor: return p.balance              // can't reprice, leave manual
  days = businessDaysBetween(anchor.date, asOfDate)   // signed
  newBal = anchor.bal - days * p.dailyPayment
  cap at anchor.bal (never grow past it); floor at 0
  return round(newBal, 2)
```

## UX changes

- **Positions table:** keep editable balance cell, but when the user edits it, stamp `balanceAsOfDate = asOfDate` and `balanceAnchor = 'manual'` on that row.
- **As-of date picker:** unchanged UI, but on change → run repricing across all positions (only the `balance` field updates; daily payment, funded date, amount funded untouched).
- **Per-row indicator:** small muted caption under the balance: "as of {date}" (uses `balanceAsOfDate` or `fundedDate`) so it's obvious which positions are live-priced.
- **Helper text under date picker:** replace the "balances will be projected forward… in the Deal Lab" line with "Move this date to reprice balances. Funded positions reprice from their funding date; manually-entered balances reprice from when you entered them."
- **Allow future as-of dates?** Yes — capping at today is removed so you can model "what's the balance Friday?". (Easy to revert if undesired.)

## Edge cases

- **Weekly-pay positions:** business-day-based math is wrong for weekly; for `frequency === 'weekly'` use full-week increments — `weeks × dailyPayment × 5` between anchor and as-of, snapping to the position's `weeklyPullDay` if set. Same clamp rules.
- **Unknown balance positions (`balance === null`):** never reprice; leave null.
- **Going backward past the anchor:** clamp to `anchor.bal` so we don't invent balance the merchant never owed.
- **Going forward past payoff:** clamp at 0 (already standard).

## Persistence

- New fields ride inside `positions` JSONB — no schema change.
- `saved_calculations.as_of_date` keeps tracking the calculator's current as-of for re-load continuity.
- On load: hydrate anchors from saved positions, fall back to legacy rule above.

## Files to touch

- `src/types/calculation.ts` — add `balanceAsOfDate`, `balanceAnchor` to `Position`.
- `src/lib/dateUtils.ts` — add `repricePositionBalance(position, fromDate, toDate, frequency)` and a signed `businessDaysBetweenSigned`.
- `src/pages/Index.tsx`:
  - `setAsOfDate` becomes a wrapper that also reprices all positions from `oldAsOfDate` → `newAsOfDate`.
  - Balance input `onChange` stamps `balanceAsOfDate = asOfDate`, `balanceAnchor = 'manual'`.
  - Add new-position default includes `balanceAsOfDate: asOfDate, balanceAnchor: null`.
  - Load path: hydrate anchors; drop the one-shot "funded_at" adjustment (the new system covers it).
  - Remove `disabled={(date) => date > new Date()}` on the calendar (or keep — open question).
  - Add the per-row "as of {date}" caption.
- `src/hooks/useCalculations.ts` — no change (JSONB carries the new fields).
- `src/components/leverage/CommitScenarioDialog.tsx` — when committing, stamp the committed positions with `balanceAsOfDate = asOfDate` so the new child deal is anchored correctly.
- Deal Lab (`src/pages/DealLab.tsx`) — read anchors when projecting; existing forward-projection already does the right thing, just needs to start from each position's anchor rather than assuming "today".

## Out of scope

- No backend migration; everything piggybacks on the existing `positions` JSONB and `as_of_date` columns.
- No change to scenario math, EPO, or PDF export formulas — they continue to consume `balance` at the current `asOfDate` and stay accurate.
- No bulk "re-anchor all positions to today" button (can add later if needed).

## Open questions

1. Should the as-of date be allowed to go past today (model future balances)?
2. For weekly positions, do you want repricing snapped to the configured `weeklyPullDay`, or just "weeks × daily × 5"?
3. When a user edits a position's `dailyPayment`, should we re-stamp the anchor to "today as-of" or keep the original anchor? (Default in this plan: keep original — only balance edits restamp.)