

## Redesign Merchant Proposal PDF to Match Claude's Layout

The current PDF has layout overflow issues (Deal Terms spilling to page 2, creating wasted space) and the `+-$` formatting bug persists. The user provided a reference PDF from Claude that they prefer. This plan replaces the current `exportMerchantProposal` function with a completely new layout modeled after that reference.

### New 5-Page Structure

**Page 1 -- "Cash Flow Analysis" (Executive Summary)**
- Blue header bar with company name + "Cash Flow Analysis" subtitle
- Merchant name + prepared date
- Big green "YOUR SAVINGS AT A GLANCE" box: `$145,393 PER MONTH` + "That's $X over Y weeks!"
- Three stat boxes: Positions Consolidated | Total Debt Being Paid | Days to Clear All
- OLD PAYMENT vs NEW PAYMENT comparison boxes at bottom

**Page 2 -- "Position Payoff Schedule"**
- Single combined payoff table (Funder, Balance, Daily Payment, Days to Payoff, Paid Off By)
- "ALL POSITIONS CLEAR" callout box with Day + Date
- "What This Means For You" numbered bullet points:
  1. After Day X, all funders paid off
  2. One payment of $X/day
  3. Cash flow improves by $X/day
  4. Total savings by payoff: $X

**Page 3 -- "Weekly Cash Flow Projection"**
- 12-week table using SIMPLIFIED flat model (old payment stays constant = totalCurrentDailyPayment * 5 for all weeks)
- This avoids the negative savings / `+-$` issue entirely
- Weekly Savings and Cumulative Savings columns in green
- KEY MILESTONES: After 1 Month | After 3 Months | By Full Payoff
- "By Full Payoff" = dailySavings * numberOfDebits (total lifetime savings)

**Page 4 -- "The Full Picture" (Transparency)**
- Orange/yellow "IMPORTANT: WHAT YOU SHOULD KNOW" box with bullet points:
  - You can stop at any time
  - Total payback amount (higher due to fees/factor)
  - But daily cash flow improves by $X/day
- "AFTER ALL POSITIONS FALL OFF" section with Cash Accumulated + Balance With Us boxes
- "YOUR SINGLE PAYMENT GOING FORWARD" green box

**Page 5 -- "The Bottom Line"**
- Side-by-side: WITHOUT vs WITH CONSOLIDATION (Daily, Weekly, Monthly, # payments)
- Big green "TOTAL SAVINGS OVER LIFE OF DEAL" box with the total amount
- Call to action: "Ready to improve your cash flow?"

### Technical Details

**File: `src/lib/exportUtils.ts`**

- Rewrite the `exportMerchantProposal` function completely (~550 lines replacing current ~650 lines)
- Key change in weekly projection: use flat `metrics.totalCurrentDailyPayment * 5` as "Old Weekly Cost" for all weeks instead of the simulation-based declining `cashInfusion`. This matches what merchants expect to see (their current payment stays constant for comparison purposes)
- Total savings calculation: `metrics.dailySavings * metrics.numberOfDebits` for lifetime savings figure
- All savings figures use simple arithmetic (dailySavings * days), never negative
- Proper formatting: no `+-$` possible since old payment is always >= new payment in this model
- Footer on every page: `COMPANY NAME | Cash Flow Analysis for MERCHANT | Page X of 5`

**Files: `src/pages/Index.tsx` and `src/pages/SavedCalculations.tsx`**
- No changes needed -- they already call `exportMerchantProposal`

### Why This Approach Works

The previous version used real simulation data where old payments decline as positions get paid off. While technically accurate, this created confusing negative savings weeks and the `+-$` formatting bug. The Claude approach uses a **simplified comparison model** -- "what you're paying now vs what you'll pay with us" -- which is what merchants actually care about. The transparency page (page 4) still shows the real numbers (total payback, balance remaining) for full disclosure.
