

## Combine Merchant PDF + Cash Report Into One Unified PDF

### Current State

There are two separate merchant-facing PDFs with overlapping content:

1. **Merchant PDF** (1 page): Payment comparison, savings boxes, deal terms table, positions table, EPO options
2. **Cash Report** (5 pages): Executive summary, position payoff schedule, weekly cash flow, "full picture" transparency, bottom line comparison

Both show the same payment comparison, savings figures, and positions -- just laid out differently. The user wants one clean PDF to hand to a merchant.

### Combined PDF Structure (4 pages)

**Page 1 -- The Offer**
- Company header bar (white-labeled)
- Merchant name + date
- Payment comparison boxes (OLD vs NEW with reduction badge)
- Savings boxes (Daily / Weekly / Monthly) in the green container
- "Position Buyout Only" label
- Deal Terms table (Amount Funded, Payback, Factor Rate, Fee, # Payments)

**Page 2 -- Current Positions + Payoff Schedule**
- "Positions Being Consolidated" table (Funder, Balance, Daily Payment)
- "Position Payoff Timeline" table (Funder, Balance, Daily Payment, Days to Payoff, Paid Off By)
- "All Positions Clear" callout with date
- Key bullet points ("What This Means For You")
- Early Payoff Options table (if EPO is enabled)

**Page 3 -- Weekly Cash Flow Projection**
- Weekly table (first 12 weeks) using real simulation data (declining old payments)
- Key Milestones boxes (1 Month, 3 Months, Peak Savings) -- all capped at peak
- Peak savings summary bar

**Page 4 -- The Bottom Line**
- "After All Positions Fall Off" snapshot (Cash Accumulated + Balance With Us)
- Single payment going forward callout
- Without vs With Consolidation side-by-side comparison
- Big green "Peak Cash Flow Savings" box
- Call to action

### Technical Changes

**File: `src/lib/exportUtils.ts`**
- Create a new `exportMerchantProposal()` function that combines the best content from both existing functions into the 4-page layout above
- Keep `exportMerchantPDF` and `exportMerchantCashReport` for now (can remove later) but they won't be called from the UI
- Uses real simulation data for the weekly table (already fixed)
- All milestones capped at peakSavings (already fixed)

**File: `src/pages/Index.tsx`**
- Replace the two separate export buttons ("Cash Report" + "Export Merchant PDF") with a single "Export Merchant Proposal" button
- Import and call the new `exportMerchantProposal` function

**File: `src/pages/SavedCalculations.tsx`** (if it has export buttons too)
- Update any export buttons there to use the new combined function

### Result
- One button, one PDF, everything the merchant needs to see in a clean 4-page document
- No more confusion about which PDF to send
- All the deal terms, positions, savings, and cash flow projections in one place

