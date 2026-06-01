## Fix: Excel Summary tab drops cents (values don't match the on-screen Deal Summary)

### Root cause
The numbers are correct — they're just rounded for display. The Summary tab in `src/lib/exportUtils.ts` formats every currency value with `fmtNoDecimals` (0 decimal places), so:

- `$2,132,289.47` (screen "Advance Amount" / Excel "Total Funding") prints as `$2,132,289`
- `$2,025,675.00` (Net Advance) prints as `$2,025,675`
- `$106,614.47` (Consolidation Fees) prints as `$106,614`

The Daily/Weekly schedule tabs already preserve cents via the `CURRENCY_FMT` (`$#,##0.00`) number format, which is why only the Summary tab looks "off to the cent."

### Change (in `src/lib/exportUtils.ts`, Summary tab, ~lines 280-310)
Switch the currency values in the Summary tab from `fmtNoDecimals(...)` to the existing 2-decimal `fmt(...)` helper so they display exact cents and match the on-screen Deal Summary. Rows to update:

- MERCHANT OVERVIEW: Monthly Revenue, Total Existing Balance, Current Daily Payment, Current Weekly Payment
- DEAL STRUCTURE: Total Funding, Net Advance, Consolidation Fees
- NEW PAYMENT TERMS: New Weekly Payment, New Daily Equivalent / New Daily Payment, New Weekly Payment
- SAVINGS: Daily Savings, Weekly Savings, Monthly Savings

Non-currency rows are left unchanged: Fee Percentage and Payment Reduction stay as percentages, Rate stays at 3 decimals, the cadence label stays text, and the TIMELINE counts (# of debits/clips, weeks) stay as plain integers.

### Notes / scope
- Pure presentation change; no math is altered. The earlier `daysLeft` epsilon and weekly-payment fixes already aligned the schedule math.
- Keeps the existing key/value string layout of the Summary tab (consistent with how it's built today).

### Verification
- Export the Bergelt Optometric deal to Excel and confirm the Summary tab now reads `$2,132,289.47`, `$2,025,675.00`, `$106,614.47`, etc., matching the on-screen Deal Summary to the cent.
