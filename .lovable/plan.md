

## Fix: On-Screen "Total Saved" and Milestones Showing Negative Values

### The Problem

The `CashBuildupSection.tsx` component calculates `totalSavingsToPayoff` by summing `cashInfusion - totalDebits` across ALL weeks of the schedule (line 117-121). After positions fall off, `cashInfusion` drops to zero while `totalDebits` (the new payment) continues, making the cumulative sum deeply negative (-$1,220,299).

The month 1 and month 3 milestones (lines 110-115) pull from the same cumulative simulation data, which can also go negative.

The `cashAccumulatedAtFalloff` (lines 126-128) has the same issue.

### The Fix

Apply the same overlap-based savings logic that was already applied to the PDF export.

**File:** `src/components/CashBuildupSection.tsx`

**1. Fix `totalSavingsToPayoff` (lines 117-122)**

Replace the full-schedule sum with overlap-only savings:

```typescript
// Cash flow savings only during the overlap period (while old positions are active)
const falloffWeekNum = Math.ceil(maxDay / 5);
const totalOldPaymentsDuringOverlap = weeklySchedule
  .filter(w => w.week <= falloffWeekNum)
  .reduce((sum, w) => sum + w.cashInfusion, 0);
const totalNewPaymentsDuringOverlap = newDailyPayment * maxDay;
const totalSavingsToPayoff = totalOldPaymentsDuringOverlap - totalNewPaymentsDuringOverlap;
const weeksToPayoff = falloffWeekNum;
```

This shows savings only while old positions are being paid off -- always positive.

**2. Fix milestones (lines 110-115)**

Replace cumulative simulation lookups with simple daily savings multipliers (same as PDF):

```typescript
const month1Savings = dailySavings * Math.min(22, maxDay);
const month3Savings = dailySavings * Math.min(66, maxDay);
```

These are always positive and represent actual cash the merchant keeps.

**3. Fix `cashAccumulatedAtFalloff` (lines 125-128)**

Replace the simulation sum with the overlap savings value:

```typescript
const cashAccumulatedAtFalloff = totalSavingsToPayoff;
```

Since `totalSavingsToPayoff` now represents savings during the overlap period (which ends at falloff), this is the same number and always positive.

**4. Update "By Full Payoff" label (line 274-276)**

Change the label from "By Full Payoff" to "While Positions Pay Off" to match the PDF and accurately describe the metric:

```
By Full Payoff -> While Positions Pay Off
total saved · {weeksToPayoff} weeks -> cash flow savings · {weeksToPayoff} weeks
```

### What Won't Change

- The weekly cash flow projection table stays as-is (it correctly shows the simulation data with negative values after crossover -- that's informative for internal use)
- The crossover point card stays as-is (it explains why net cash flow goes negative)
- Daily/Weekly/Monthly savings in the hero bar stay as-is (those are correct constant values)

