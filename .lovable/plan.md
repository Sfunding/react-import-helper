

## Rebuild Merchant Proposal PDF with @react-pdf/renderer

### What's Changing
Replace the current jsPDF-based `exportMerchantProposal` with `@react-pdf/renderer` for a premium, pixel-perfect 4-page PDF. The new approach uses React components to define the PDF layout, giving much better control over typography, colors, gradients, and spacing.

### New Dependency
- Install `@react-pdf/renderer` (replaces jsPDF for this export only; existing Excel and internal PDF exports stay on jsPDF)

### New Files

**1. `src/components/pdf/MerchantProposalPDF.tsx`** (~500 lines)
The core React PDF document component with all 4 pages, using the specified color theme:

- **Page 1 -- Cover / Summary**: Navy gradient hero with merchant name, old vs new payment cards with reduction badge, savings row (daily/weekly/monthly + consolidation type), deal terms table, and conditional "Cash to Merchant" banner
- **Page 2 -- Positions & Payoff Schedule**: Positions table with red daily payments and teal totals, payoff timeline sorted by days (ascending), "All Positions Clear" teal banner, visual payoff timeline bar with staggered labels when markers overlap
- **Page 3 -- Weekly Cash Flow Projection**: Up to 18-week table using REAL simulation data (old weekly = `w.cashInfusion`, new weekly = `w.totalDebits`), green/red conditional formatting, negative rows get light red background, key milestones cards (1 month, 3 months, peak savings)
- **Page 4 -- The Bottom Line**: Navy hero banner for falloff day, three status cards (Cash Accumulated, Balance With Us, Single Payment Forward), teal callout banner, side-by-side Without vs With comparison boxes, call to action

**2. `src/components/pdf/pdfStyles.ts`** (~150 lines)
Shared StyleSheet with the full color palette and reusable styles (header bars, stat cards, table rows, footer).

**3. `src/components/pdf/pdfHelpers.ts`** (~50 lines)
Currency formatting (no decimals, commas), percentage formatting, date helpers specific to the PDF context.

### Modified Files

**4. `src/lib/exportUtils.ts`**
- Rewrite `exportMerchantProposal` to use `@react-pdf/renderer`'s `pdf()` function to generate and download the blob
- Keep all existing calculation logic (`calculateSchedules`) untouched
- The function still accepts `SavedCalculation` and triggers a download
- Remove the ~600 lines of jsPDF drawing code for this export

**5. `src/pages/Index.tsx`** and **`src/pages/SavedCalculations.tsx`**
- No changes needed -- they already call `exportMerchantProposal(calc)` which will use the new renderer internally

### Data Flow (unchanged)
All numbers come from the existing `calculateSchedules()` function using real simulation data. No simplified/flat models. Weekly projections use actual `weeklySchedule` entries where:
- Old Weekly Cost = `w.cashInfusion` (sum of position payments that week)
- New Weekly Cost = `w.totalDebits` (actual debits collected)
- Savings can go negative after positions clear (shown in red)

### Key Design Details from the Spec

- **Color theme**: Navy #0B1D3A, Teal accent #00C9A7, Gold #F0B94D, Red #E8555A, Green #2ECC71
- **Page size**: US Letter (612 x 792 points)
- **Margins**: ~43pt (0.6 inches)
- **Font**: Helvetica (built into @react-pdf/renderer)
- **Currency**: No decimals, commas (e.g. "$1,984,580")
- **Weekly = Daily x 5**, Monthly = Weekly x (52/12)
- **Days to payoff**: ceil(balance / daily_payment)
- **Visual timeline bar** on page 2 with staggered labels when markers are within 48px
- **Footer** on every page: "Company | Merchant | Prepared date | Page X of 4"

### What Stays the Same
- `exportToExcel` -- unchanged (still uses xlsx)
- `exportToPDF` (internal cash report) -- unchanged (still uses jsPDF)
- `calculateSchedules` -- unchanged
- All form inputs and UI -- unchanged
- Early payoff options section on page 2 (if enabled) -- will be included

