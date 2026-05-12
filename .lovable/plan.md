## Plan

1. **Make Excel use the same position view as the app**
   - Update the export calculation helper to respect the calculation `as_of_date`.
   - Positions with a future funded date will be excluded/zeroed in Excel the same way they are on-screen.
   - Totals, included balances, daily payments, days left, and schedule infusions will all derive from that normalized position list.

2. **Preserve cents for position money columns**
   - Change the Excel Positions tab money cells from rounded strings to real numeric values where possible.
   - Apply the same two-decimal currency format used on the schedule tabs to Amount Funded, Balance, Daily Payment, and totals.
   - Keep non-numeric markers like `Unknown`, `-`, and auto labels readable without breaking Excel sums.

3. **Include the as-of date in all export paths**
   - Add `as_of_date` to exports generated directly from the current calculator.
   - Add `as_of_date` to the saved/updated calculation object used by the post-save Excel buttons.
   - Saved Calculations exports already carry `as_of_date`; this will make all export entry points consistent.

4. **Verify the tie-out behavior**
   - Confirm the Weekly Schedule cash infusion sum equals the included position balances / Net Advance with cents preserved.
   - Confirm the Positions tab balance totals match the Summary/Offer Details and app values.

## Technical details

- Main files: `src/lib/exportUtils.ts` and `src/pages/Index.tsx`.
- The current app normalizes positions using `asOfDate` before totals/schedules, but the Excel export currently calculates from raw positions and often omits `as_of_date` from current-state exports.
- Excel Positions currently uses `fmtNoDecimals(...)`, which rounds cents and converts values to strings. I’ll change those cells to numeric values plus Excel number formats.