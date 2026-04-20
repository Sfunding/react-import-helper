

## Diagnose: "After Week 18" Summary Not Appearing in PDF

The code I added in the previous step is in place and correct in `src/components/pdf/MerchantProposalPDF.tsx` (lines 414-491). The summary band renders only when `d.weeklyData.length > 18`. So one of three things is happening:

### Likely Causes

1. **Browser cached the old PDF bundle.** `@react-pdf/renderer` and the proposal component are dynamically imported (lazy-loaded). After a code change, an open tab can still hold the previous chunk. **Hard refresh the preview** (Cmd/Ctrl + Shift + R) and re-export.

2. **The deal you exported is ≤18 weeks total.** The summary intentionally hides when there's nothing past week 18 to summarize (e.g. shorter buyout-only deals). Check the on-screen Cash Buildup section — if the schedule ends on or before week 18, that's why.

3. **You opened a previously-downloaded PDF.** Make sure you're opening the new file with today's date in the filename (`*_Merchant_Proposal_2026-04-20.pdf`), not an older copy in your Downloads folder.

### Fix Plan

To remove all ambiguity and make this debuggable, I'll add two small improvements:

**`src/components/pdf/MerchantProposalPDF.tsx`**
- **Lower the threshold from `> 18` to `> 0` weeks remaining** — actually, keep `> 18` but ALSO add a fallback summary line for ≤18-week deals saying *"Your reverse consolidation is fully paid off on [date] — Week [N]."* so something always appears below the table confirming the payoff.
- **Tag the section with a clear visual marker** (a thin teal bar at the top edge) so it's unmistakable when present vs. absent.

**`src/lib/exportUtils.ts`**
- After computing `weeklyData`, log `weeklyData.length` and `maxPayoffDay` to console at export time. This way, if it still doesn't show, you can check the browser console and confirm whether the deal is actually >18 weeks, narrowing the issue immediately.

### Files Changed
| File | Change |
|------|--------|
| `src/components/pdf/MerchantProposalPDF.tsx` | Add a short payoff confirmation line for ALL deals (so something always appears under the table), keep the full After Week 18 band for >18-week deals |
| `src/lib/exportUtils.ts` | Add `console.log` of weekly count + payoff day at export time for diagnostics |

### After This Change
- Every exported PDF will show *something* under the weekly table (either the full band or a single confirmation sentence).
- If you still don't see the band on a >18-week deal, the console log will tell us exactly what `weeklyData.length` is, and we'll know whether the data or the renderer is the culprit.

