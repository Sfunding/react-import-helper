

## Fix: PDF Cash Flow Table Shows Flat "Old Weekly Cost" Instead of Declining

### The Problem

The PDF "Weekly Cash Flow Projection" table uses a **static** `weeklyProjection` array (line 1060-1069 in `exportUtils.ts`) that repeats the same `weeklyOldPayment` every week. It never decreases as positions fall off.

Meanwhile, the on-screen table in `CashBuildupSection.tsx` correctly uses the real simulation data (`weeklySchedule`) which shows declining credits as positions pay off.

### The Fix

**File:** `src/lib/exportUtils.ts`

Replace the static `weeklyProjection` (lines 1060-1069) with data derived from the real `weeklySchedule` simulation -- the same approach the on-screen component uses.

```typescript
// Replace static weeklyProjection with real simulation data
let cumulativeSavingsForTable = 0;
const weeklyProjection = weeklySchedule.map((w) => {
  const oldPayment = w.cashInfusion;       // Old positions' payments (declines as they fall off)
  const newPayment = w.totalDebits;         // New consolidated payment (constant)
  const savings = oldPayment - newPayment;
  cumulativeSavingsForTable += savings;
  return {
    week: w.week,
    oldPayment,
    newPayment,
    savings,
    cumulativeSavings: cumulativeSavingsForTable
  };
});
```

This single change makes the PDF table match the on-screen table -- "Old Weekly Cost" will decrease as positions pay off, "Weekly Savings" will decrease (and eventually go negative), and "Cumulative Savings" will peak then decline.

The rest of the PDF (milestones, peak savings, etc.) already uses the real simulation data via `allWeeklyProjectionForPeak`, so no other changes are needed.

### Technical Detail

- Only `weeklyProjection` in `exportUtils.ts` lines 1060-1069 needs to change
- The variables `weeklyOldPayment`, `weeklyNewPayment`, `weeklySavingsAmount` (lines 1056-1058) are still used elsewhere for the hero bar stats, so they stay
- The table column headers stay the same
