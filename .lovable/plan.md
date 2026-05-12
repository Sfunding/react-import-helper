## Plan

1. Update the Excel export to write schedule currency values as real numbers instead of pre-formatted whole-dollar strings.
2. Apply a two-decimal currency number format to the Daily Schedule, Weekly Schedule, Summary, Positions, and Offer Details money cells so cents are preserved and visible in Excel.
3. Keep PDF/export displays that intentionally use whole dollars unchanged unless they affect Excel tie-outs.
4. Verify the exported Weekly Schedule values will carry cents, so week 25 shows `$10,027.25` and summing Weekly Cash Infusion ties to Net Advance/Net to Merchant within rounding tolerance.

## Technical details

- The current Excel export uses `fmtNoDecimals(...)` before creating sheets, which converts numbers like `10027.25` into the string `"$10,027"`.
- I’ll introduce numeric currency handling for XLSX rows and set Excel cell formats such as `$#,##0.00;($#,##0.00);-` rather than rounding values in TypeScript.