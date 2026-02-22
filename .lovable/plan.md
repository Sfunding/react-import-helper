

## Plan: Fix PDF Cash Report Milestones and Weekly Table for Merchant-Facing Accuracy

### The Problem

The screenshot shows "BY FULL PAYOFF: -$893,061" -- a deeply negative number presented as "saved." This is because the milestones use cumulative `cashInfusion - totalDebits` (an internal simulation metric). After positions fall off, `cashInfusion` drops to zero while `totalDebits` continues, making the cumulative sum go very negative. This is not what the merchant saves -- it's just the internal deal cash flow.

The merchant's real savings = `(oldDailyPayment - newDailyPayment) x business days`. This is always positive and constant -- it's the whole point of the consolidation.

### What Changes

**File:** `src/lib/exportUtils.ts`

**1. Fix milestones to use actual merchant savings**

Replace the simulation-based milestones with merchant-facing savings:

```
month1Savings = metrics.dailySavings * 22  (22 business days)
month3Savings = metrics.dailySavings * 66  (66 business days)
totalSavingsToPayoff = metrics.dailySavings * metrics.numberOfDebits
```

These are always positive and represent what the merchant actually keeps in their pocket.

**2. Fix the weekly table to show merchant savings alongside simulation data**

The weekly table currently shows Weekly Credits, Your Payment, Net Cash Flow, and Cumulative -- all from the simulation. The problem is "Net Cash Flow" goes negative after falloff, which confuses the merchant.

Replace the weekly table with a hybrid approach:
- **Week** -- week number
- **Old Weekly Cost** -- `metrics.totalCurrentDailyPayment * 5` (constant -- what they were paying before)
- **New Weekly Cost** -- `metrics.newDailyPayment * 5` (constant -- their single payment to us)
- **Weekly Savings** -- `old - new` (constant, always positive)
- **Cumulative Savings** -- `weeklySavings * week` (steadily growing)

This gives the merchant a clear, always-positive picture of their savings over time.

**3. Keep the simulation data for the "After Positions Fall Off" section only**

The falloff section (page 4) already uses `weeklySchedule` data for `cashAccumulatedAtFalloff`. This is fine because that section is explicitly about the deal mechanics, not merchant savings. No change needed there.

### Technical Details

**Milestone fix (lines 1070-1079):**

```typescript
const month1Savings = metrics.dailySavings * 22;
const month3Savings = metrics.dailySavings * 66;
const totalSavingsToPayoff = metrics.dailySavings * metrics.numberOfDebits;
```

**Weekly projection fix (lines 1055-1068):**

```typescript
const weeklyOldPayment = metrics.totalCurrentDailyPayment * 5;
const weeklyNewPayment = metrics.newDailyPayment * 5;
const weeklySavingsAmount = weeklyOldPayment - weeklyNewPayment;

const weeklyProjection = Array.from({ length: totalWeeks }, (_, i) => {
  const week = i + 1;
  return {
    week,
    oldPayment: weeklyOldPayment,
    newPayment: weeklyNewPayment,
    savings: weeklySavingsAmount,
    cumulativeSavings: weeklySavingsAmount * week
  };
});
```

**PDF table column update (lines 1296-1314):**

Update headers and body to: `['Week', 'Old Weekly Cost', 'New Weekly Cost', 'Weekly Savings', 'Cumulative Savings']`

All values will be positive and consistent, giving the merchant confidence in the deal.
