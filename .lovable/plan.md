## Hide Weekly/Cumulative Savings Columns Option

The merchant PDF's Page 3 weekly schedule currently shows: Week | Old Weekly Cost | New Weekly Cost | Weekly Savings | Cumulative Savings. Once cash infusions stop and the merchant resumes paying us back, the savings columns go negative — visually noisy and a bad sales look. Add a toggle to drop those two columns.

### Behavior

- New checkbox in the Export Options dialog: **"Show Weekly Savings & Cumulative Savings columns"** — defaults **OFF** (cleaner look by default).
- When OFF:
  - Page 3 table renders only 3 columns: **Week | Old Weekly Cost | New Weekly Cost**.
  - The red row highlight for negative-savings weeks is also dropped (no need to flag rows when the savings columns aren't shown).
  - The **Key Milestones** trio (After 1 Month / After 3 Months / **Peak Savings**) is force-shown so the merchant still sees the savings story via the bubbles — even if "Key Milestones" was unchecked. The peak-savings card stays the visual anchor.
  - The intro line above the table softens from "See how your savings accumulate week by week..." to "Here's your full week-by-week cash flow through final payoff:"
- When ON: current 5-column layout is preserved exactly.

### Files

| File | Change |
|---|---|
| `src/components/pdf/ExportOptionsDialog.tsx` | Add `showSavingsColumns: boolean` to `MerchantPDFOptions` (default `false`). Add checkbox under "Page 3 — Cash Flow" section with hint: "When off, only Week / Old / New columns are shown — Peak Savings bubble still appears." |
| `src/components/pdf/MerchantProposalPDF.tsx` | In Page 3: read `showSavingsColumns` from options. Conditionally render the two savings header cells, the two savings body cells, and the negative-row red background. Adjust `flex` weights so the 3-column layout looks balanced (e.g. Week:1, Old:2, New:2). When `showSavingsColumns` is false, treat `showMilestones` as forced true. |

### Out of Scope

- Page 4 "Bottom Line" savings figures — unchanged (those are aggregate, not week-by-week, and stay positive).
- The "Daily/Weekly/Monthly Savings" cards on Page 1 — unchanged.
- Excel and internal cash report exports — unchanged.
