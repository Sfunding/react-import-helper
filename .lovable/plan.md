

## Add "After Week 18" Payoff Summary to Proposal PDF

### What You'll See

Right below the 18-row weekly table on Page 3 of the Merchant Proposal PDF, a new highlighted summary band appears. It tells the merchant exactly how much longer until they're fully paid off and what happens between week 18 and the end of the deal.

### Layout (inserted between table and "KEY MILESTONES")

```text
┌──────────────────────────────────────────────────────────────────────┐
│  AFTER WEEK 18                                                       │
│                                                                      │
│  Weeks Remaining   Final Payoff Date    Remaining Payments  Savings  │
│      14 weeks         Jul 24, 2026         $1,189,720       $X,XXX   │
└──────────────────────────────────────────────────────────────────────┘
```

Four compact stat cells in a navy/teal band matching the existing design system:

1. **Weeks Remaining** -- `totalWeeks - 18` (e.g. "14 more weeks")
2. **Final Payoff Date** -- formatted from `maxPayoffDay` using `addBusinessDays(today, maxPayoffDay)`
3. **Remaining Payments** -- sum of `newWeeklyCost` for weeks 19 → end
4. **Additional Savings After Wk 18** -- sum of `weeklySavings` from week 19 → end (green if positive, red if negative)

A short sentence below: *"Your reverse consolidation is fully paid off on **Jul 24, 2026** -- 14 weeks after this projection ends."*

If the deal is ≤18 weeks total, the summary is hidden (nothing to summarize).

### File Changes

**`src/components/pdf/MerchantProposalPDF.tsx`** -- only file touched
- In `Page3Weekly`, after the `displayWeeks.map(...)` block and before `KEY MILESTONES`, compute:
  - `remainingWeeks = d.weeklyData.slice(18)`
  - `weeksRemaining = remainingWeeks.length`
  - `remainingPayments = sum(remainingWeeks.newWeeklyCost)`
  - `remainingSavings = sum(remainingWeeks.weeklySavings)`
- Render the summary band only when `weeksRemaining > 0`
- Use existing `d.maxPayoffDate` for the final payoff date (already in props)
- Reuse existing styles (`s.statCard`, `COLORS.NAVY`, `COLORS.ACCENT`, `COLORS.GREEN`, `COLORS.RED`)

No new props, no data plumbing changes -- everything needed is already on `PDFProps`.

### Out of Scope

- The legacy `exportUtils.ts` jsPDF export (only shows 12 weeks, older path) is unchanged unless you want it updated too.
- The on-screen `CashBuildupSection` already shows the full weekly schedule; no change there.

