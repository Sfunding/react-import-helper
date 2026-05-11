## Editable Days / Weeks Left on MCA Positions

Add the ability to view AND adjust days-left or weeks-left for each position. Editing either field re-derives the balance from `dailyPayment × days`.

### Current behavior
In the Positions tab, the "Days Left / Last Pay" column is read-only:
```
daysLeft = ceil(balance / dailyPayment)
```
Only `Balance` is editable; `Days Left` is computed display text.

### Proposed behavior

**Column rename:** "Days Left / Last Pay" → "Days / Weeks Left"

**Inside the cell (stacked, both editable):**
```
[  45  ] days
[   9  ] weeks
Last pay: Jan 14, 2026
```

- Two small numeric inputs (days input + weeks input), each ~60px wide.
- `weeks = ceil(days / 5)`; editing weeks sets `days = weeks × 5`.
- On change of either, recompute:
  ```
  newBalance = days * dailyPayment
  ```
  and update `position.balance` (which then cascades to all dependent metrics — schedule, reverse calc, deal length, etc. — automatically since they all read from `positions`).
- Last-payment date label stays below, recomputed live via existing `getFormattedLastPaymentDate(daysLeft)`.
- Hot-pink "over deal length" pill style (`daysLeft > 186`) preserved by coloring the inputs' border/background when over threshold.

### Edge cases
- `dailyPayment === 0` → inputs disabled with tooltip "Set daily first".
- `balance === null` (Unknown) → cell still shows "?" as today; no edit until balance is set via existing "Set" button.
- `isOurPosition` → editable like any other.
- Empty input → treated as `0`, balance becomes `0`.
- Whole-number constraint: days input is integer; weeks input is integer.

### Files to touch
- `src/pages/Index.tsx` — replace the "Days Left / Last Pay" `<td>` (lines ~1411-1427) with two small editable inputs + recompute handler that calls `updatePosition(p.id, 'balance', days * p.dailyPayment)`. Update the column header.

### Out of scope
- No schema change (balance remains the source of truth; days/weeks are derived inputs that write back to balance).
- No new "remaining term" field on the Position type.
- No changes to PDF, leverage page, or scenario builder.