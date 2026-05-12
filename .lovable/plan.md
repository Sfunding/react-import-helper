The Payment View toggle (Daily / Weekly / Daily + Weekly) on the Merchant's Offer tab already changes the comparison cards beneath the table, but the "Positions Being Consolidated" table itself is hardcoded to a single "Daily Payment" column. That's why switching the toggle appears to do nothing — the most prominent thing on screen never updates.

Plan:

1. Make the Positions Being Consolidated table react to Payment View
   - In `src/pages/Index.tsx`, replace the static "Daily Payment" column with dynamic columns driven by `paymentView`.
     - Daily: one column "Daily Payment" showing `$X/day`.
     - Weekly: one column "Weekly Payment" showing `$X * 5/week`.
     - Daily + Weekly: two columns, "Daily Payment" and "Weekly Payment".
   - Update the TOTAL footer to match the same column set, using `totalCurrentDailyPayment` and `totalCurrentDailyPayment * 5`.
   - Apply the same dynamic columns to any sibling tables on this view (e.g., the New Position summary table if present).

2. Keep PDF export consistent (no change needed)
   - The PDF already honors `paymentView` for the Positions Being Consolidated table. No changes there, just confirming parity with the on-screen view.

Acceptance:
- On Merchant's Offer, toggling Daily / Weekly / Daily + Weekly visibly changes the Positions Being Consolidated table columns, header, per-row values, and TOTAL row.
- Daily mode: only daily values.
- Weekly mode: only weekly values (daily × 5).
- Daily + Weekly mode: both columns side by side.
- The comparison cards underneath continue to behave as they do today.