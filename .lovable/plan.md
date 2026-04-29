## Merchant Proposal: Export Options Dialog + Extended Cash Flow Schedule

Three things, bundled into one cohesive change:

1. Show the merchant the **full cash-infusion period** (not capped at week 18) on Page 3.
2. **Hide Factor Rate and Origination Fee** from the merchant by default.
3. Add a **pre-export options dialog** so the user picks what's included on the PDF every time they export.

---

### 1. Export Options Dialog (new)

When the user clicks "Export Merchant Proposal" on the Merchant Offer tab, a modal opens **before** the PDF generates. The user toggles which sections/fields appear, then clicks "Generate PDF."

**Toggleable items** (each a checkbox, with sensible defaults):

| Section | Default | Notes |
|---|---|---|
| Factor Rate (in Deal Terms strip on Page 1) | **OFF** | Newly hidden by default |
| Origination Fee (in Deal Terms strip on Page 1) | **OFF** | Newly hidden by default |
| Total Payback (in Deal Terms strip on Page 1) | ON | |
| Amount Funded (in Deal Terms strip on Page 1) | ON | |
| Number of Payments (in Deal Terms strip on Page 1) | ON | |
| Cash to Merchant banner (Page 1) | ON (auto-hidden if $0) | |
| Position Payoff Timeline visual bar (Page 2) | ON | |
| Early Payoff Options table (Page 2) | ON if EPO is enabled in settings | |
| **Full weekly cash-flow schedule (Page 3)** | ON | See section 2 |
| Key Milestones (1mo / 3mo / Peak) (Page 3) | ON | |
| Page 4: The Bottom Line | ON | Whole page can be excluded |

The dialog also remembers the last selection in `localStorage` per user, so common configurations stick.

### 2. Page 3 — Show the Full Cash-Infusion Window

Today, Page 3 hard-caps the weekly table at 18 rows (`d.weeklyData.slice(0, 18)`) and uses the "After Week 18" summary band for anything longer. The user wants the merchant to see every week through final payoff.

**New behavior:**

- Render **every week** in `d.weeklyData` (no slice).
- Use `react-pdf`'s `wrap` so the table flows onto additional pages automatically when it overflows. The header row repeats on each continuation page (using `View fixed` on the header row inside a wrapping container).
- The "After Week 18" summary band is **removed** (the full table makes it redundant).
- The "Fully paid off on …" teal confirmation banner stays — now shown for **all** deals at the bottom of the schedule, since the table always reaches the final week.
- "Key Milestones" stays on the last page of the schedule, after the table ends.

If the schedule needs to spill onto a 5th page, the footer still renders correctly because it's already `fixed`. Total page count in the footer becomes dynamic (the current hard-coded `totalPages = 4` becomes `4 + extraWeeklyPages` based on row count, computed before render: roughly `Math.max(0, Math.ceil((weeks - 22) / 28))` extra pages where 22 fits comfortably on Page 3 and ~28 fit per overflow page).

### 3. Default-Hide Factor Rate & Origination Fee

The "Deal Terms" horizontal strip on Page 1 currently shows 5 cells: Amount Funded | Total Payback | **Factor Rate** | **Origination** | # Payments.

- Render the strip from the user's selections in the export dialog, not a fixed array.
- With Factor Rate and Origination both off by default, the strip becomes 3 cells (Amount Funded | Total Payback | # Payments), which still looks balanced because `flex: 1` distributes width.

### Files Changed

| File | Change |
|---|---|
| `src/components/pdf/ExportOptionsDialog.tsx` | **New.** Modal with checkboxes, "Generate PDF" / "Cancel" buttons. Uses existing `Dialog`, `Checkbox`, `Label`, `Button` UI primitives. Persists last selection to `localStorage`. |
| `src/components/pdf/MerchantProposalPDF.tsx` | (a) Add `options` to `PDFProps`. (b) Page 1: render Deal Terms cells conditionally based on `options`. Conditionally render Cash-to-Merchant banner. (c) Page 3: remove the 18-row slice; render the full weekly table with `wrap`; remove the After-Week-18 band; show payoff confirmation banner for all deals. (d) Make `totalPages` dynamic. (e) Conditionally render Page 4. |
| `src/lib/exportUtils.ts` | `exportMerchantProposal` accepts an `options` argument and forwards it into `pdfData`. Remove the `slice`-based assumptions; pass full `weeklyData`. Compute dynamic `totalPages` and pass to the document. |
| `src/pages/Index.tsx` | The Export button opens `ExportOptionsDialog` instead of calling `exportMerchantProposal` directly. The dialog's "Generate" handler invokes `exportMerchantProposal(tempCalc, options)`. |

### Out of Scope

- The internal Excel export and the legacy jsPDF `exportToPDF` cash report — unchanged.
- The on-screen Cash Buildup section in the app UI — unchanged.
- Adding/removing entirely new content sections beyond the existing four pages.

### Open Question

Should the "Daily Savings" / "Weekly Savings" / "Monthly Savings" cards on Page 1 also be toggleable, or always shown? My default is **always shown** since they're the merchant's primary value proposition — but easy to make optional if you want full control. Let me know before approval, or I'll proceed with always-on.