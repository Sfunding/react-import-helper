# Fix: Week 1 should show 5 debits, not 4

## Problem
On a reverse, today the schedule treats Monday (day 1) as funding-only and starts debits on day 2 (`if (day >= 2 ...)`). That gives week 1 only 4 debits (Tue–Fri), while every other week has 5.

In reality, the merchant is debited every business day from day 1 onward. On the second Monday the daily pull is taken **before** the next clip is wired — so by the time clip #2 lands, 5 daily debits have already cleared. The schedule should reflect that: 5 debits in week 1, with exposure/RTR computed accordingly.

## Fix
Start the daily debit on day 1 in every place that simulates the reverse schedule:

1. **`src/pages/Index.tsx`** — main `dailySchedule` (line ~516): change
   ```
   if (day >= 2 && rtrBeforeDebit > 0) { ... }
   ```
   to
   ```
   if (rtrBeforeDebit > 0) { ... }
   ```

2. **`src/pages/Index.tsx`** — `calculateDaysWithDiscount` simulator (line ~757): same change, so term-from-discount derivations stay consistent with the displayed schedule.

3. **`src/lib/exportUtils.ts`** — `calculateSchedules` (line ~162): same change, so XLSX/PDF exports match the on-screen schedule.

Everything downstream (weekly summary, exposure peak, total debits, deal-length, EPO falloff days, merchant proposal weekly clip math, profit) reads from these three loops, so no other code needs to change.

## What the user will see
- Week 1 row in both the daily and weekly schedule shows 5 debits (day 1 included).
- `Exposure on Reverse` on day 1 = `cashInfusion − newDailyPayment` instead of `cashInfusion`.
- Peak exposure drops by roughly one daily payment.
- Deal length shortens by 1 business day in most cases (one extra debit up front).
- Day 1 Summary card and PDF/Excel exports stay in sync automatically.

## Out of scope
- No change to leverage math, scenario engine (`leverageMath.ts`), or weekly-frequency positions.
- No UI/labeling changes; only the underlying simulation loop is adjusted.
