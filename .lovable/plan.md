## Fix the "After Week 18" Band on the Merchant Proposal PDF

### The Problem

The "Add'l Savings" stat in the After Week 18 band is showing a large negative number in red (e.g. -$160,121). This happens because:

- By week 18, the merchant's old MCA stack has fully paid off in the comparison baseline.
- The reverse consolidation, however, still has weeks of payments remaining.
- So `weeklySavings = oldWeeklyCost (0) - newWeeklyCost (positive)` goes negative every week after the old stack would have ended.

Mathematically true. **Strategically terrible** to show a merchant. It frames the back half of their deal as "you're losing $160K" when in reality they've already pocketed massive savings during the consolidation period and are simply finishing out the term they agreed to.

### The Fix

Reframe the After Week 18 band to focus on **payoff certainty**, not a misleading savings comparison.

**Remove:** the "Add'l Savings" stat entirely (the red -$160K box).

**Keep:** Weeks Remaining, Final Payoff Date, Remaining Payments — these are useful, factual, and merchant-friendly.

**Restructure** to a 3-column layout (instead of 4) so the remaining stats breathe better.

**Update the italic summary line** to be purely positive/factual:
> *"Your reverse consolidation is fully paid off on Oct 1, 2026 — just 31 weeks after this projection ends."*

(Drop any savings framing here too.)

### Also: Payoff Confirmation Banner

The teal "Fully paid off on..." banner above the After Week 18 band is now redundant when the After Week 18 band is showing (same date appears twice). Hide the teal banner when the After Week 18 band renders; keep it for deals ≤ 18 weeks where the band doesn't show.

### Files Changed

| File | Change |
|------|--------|
| `src/components/pdf/MerchantProposalPDF.tsx` | Remove "Add'l Savings" column from After Week 18 band; switch to 3-column layout; rewrite italic summary line; hide teal payoff confirmation banner when After Week 18 band is visible |

### Out of Scope

- Internal/broker-facing views and the on-screen Cash Buildup section still show full savings math (negative weekly savings post-falloff is fine for internal users who understand the model).
- No changes to calculation logic — only what's rendered on the merchant PDF.
