
## Plan: Enhanced Merchant Cash Buildup Report

### Overview

Create a comprehensive merchant-facing report that clearly demonstrates:
1. How consolidating positions saves money daily, weekly, and monthly
2. How cash accumulates over time with reduced payments
3. When each position gets paid off
4. The long-term financial impact

---

### New Features

**1. Cash Accumulation Timeline**
Show the merchant exactly how their savings compound over time:
- Week 1: $X saved
- Week 4: $Y saved (cumulative)
- Month 3: $Z saved (cumulative)

**2. Position Payoff Timeline**
Visual breakdown of when each consolidated position falls off:
- Funder A: Paid off by Day 25
- Funder B: Paid off by Day 45
- All positions clear by Day X

**3. Cash Flow Projection Table**
A simple table showing:
| Period | Old Payment | New Payment | Savings | Cumulative Savings |
|--------|-------------|-------------|---------|-------------------|
| Week 1 | $X | $Y | $Z | $Z |
| Week 2 | $X | $Y | $Z | $Z × 2 |
| ... | ... | ... | ... | ... |

**4. "Money Back in Your Pocket" Summary**
Highlight key milestones:
- After 1 month: $X saved
- After 3 months: $Y saved  
- By payoff: $Z total saved

---

### Files to Create/Modify

| File | Changes |
|------|---------|
| `src/lib/exportUtils.ts` | Add `exportMerchantCashReport()` function with enhanced PDF generation |
| `src/pages/Index.tsx` | Add new "Cash Report" export button in Merchant's Offer tab |
| `src/components/CashBuildupSection.tsx` | New component showing cash accumulation in UI |

---

### Technical Details

**1. New Export Function: `exportMerchantCashReport()`**

```typescript
export async function exportMerchantCashReport(calculation: SavedCalculation) {
  // Page 1: Executive Summary
  // - Big "Your Savings at a Glance" section
  // - Monthly savings prominently displayed
  // - Position count and total debt being consolidated
  
  // Page 2: Position Breakdown & Timeline
  // - Table of all positions with payoff dates
  // - Visual timeline showing when each falls off
  
  // Page 3: Cash Flow Projection
  // - Week-by-week savings accumulation
  // - Cumulative savings running total
  // - Key milestones highlighted (1 month, 3 months, 6 months)
  
  // Page 4: The Bottom Line
  // - Total savings over life of deal
  // - Simple comparison: "Without consolidation" vs "With consolidation"
  // - Call to action
}
```

**2. Cash Accumulation Calculation**

```typescript
// Calculate cumulative savings at each week
const weeklyProjection = [];
let cumulativeSavings = 0;

for (let week = 1; week <= totalWeeks; week++) {
  cumulativeSavings += weeklySavings;
  weeklyProjection.push({
    week,
    oldPayment: totalCurrentDailyPayment * 5,
    newPayment: newDailyPayment * 5,
    weeklySavings,
    cumulativeSavings
  });
}
```

**3. Position Timeline Data**

```typescript
// Sort positions by days until payoff
const positionTimeline = includedPositions
  .map(p => ({
    entity: p.entity,
    balance: getEffectiveBalance(p),
    dailyPayment: p.dailyPayment,
    daysUntilPayoff: Math.ceil(balance / dailyPayment),
    payoffDate: getFormattedLastPaymentDate(daysUntilPayoff)
  }))
  .sort((a, b) => a.daysUntilPayoff - b.daysUntilPayoff);
```

**4. UI Enhancement in Merchant's Offer Tab**

Add a new section showing:
- Cash accumulation preview (interactive)
- Position payoff timeline visualization
- Additional export button for the full cash report

**5. PDF Layout (Multi-page)**

**Page 1 - Executive Summary:**
```text
┌────────────────────────────────────────┐
│  [COMPANY LOGO/NAME]                   │
│  Cash Flow Analysis for [Merchant]     │
├────────────────────────────────────────┤
│  ┌──────────────────────────────────┐  │
│  │  YOUR MONTHLY SAVINGS            │  │
│  │       $X,XXX                     │  │
│  │  That's $XX,XXX over [Y] months  │  │
│  └──────────────────────────────────┘  │
│                                        │
│  Consolidating [N] positions           │
│  Total debt: $XXX,XXX                  │
│  Old payment: $X,XXX/day               │
│  New payment: $X,XXX/day               │
└────────────────────────────────────────┘
```

**Page 2 - Position Timeline:**
```text
┌────────────────────────────────────────┐
│  POSITION PAYOFF SCHEDULE              │
├────────────────────────────────────────┤
│  Funder A    $XX,XXX   Paid by Day 25  │
│  Funder B    $XX,XXX   Paid by Day 45  │
│  Funder C    $XX,XXX   Paid by Day 60  │
│  ──────────────────────────────────    │
│  All positions clear by [Date]         │
└────────────────────────────────────────┘
```

**Page 3 - Cash Flow Table:**
```text
┌────────────────────────────────────────┐
│  WEEKLY CASH FLOW PROJECTION           │
├────────────────────────────────────────┤
│  Week | Old | New | Saved | Cumulative │
│  1    | $X  | $Y  | $Z    | $Z         │
│  2    | $X  | $Y  | $Z    | $2Z        │
│  ...  | ... | ... | ...   | ...        │
│  12   | $X  | $Y  | $Z    | $12Z       │
├────────────────────────────────────────┤
│  After 3 months: $XX,XXX in savings!   │
└────────────────────────────────────────┘
```

---

### Result

The merchant receives a professional, easy-to-understand report that:
- Shows exactly how much money stays in their pocket each period
- Displays when each funder is paid off
- Projects cumulative savings over time
- Provides a clear picture of long-term financial benefit
- Can be printed or emailed as a persuasive sales tool
