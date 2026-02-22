

## Fix: Replace Fake "Total Savings" with Real Cash Flow Savings During Overlap

### The Problem

`totalSavingsToPayoff = dailySavings * numberOfDebits` is wrong because:
- `numberOfDebits` is the term of the NEW deal (e.g., 600+ days)
- But the old positions pay off in ~135 days (`maxDay`)
- After old positions are gone, there's no "old payment" to compare against
- So the $892,184 number counts "savings" for 400+ days when the merchant would have been paying $0 anyway

### The Correct Calculation

The real cash flow savings = `dailySavings * maxDay` (where `maxDay` is when the last old position falls off). But even that overstates it slightly because positions fall off at different times, reducing the "old payment" gradually.

The most accurate approach: use the simulation data. Sum up `cashInfusion` from the weekly schedule up to the falloff week. That represents the total old payments made during the overlap. The merchant's new payments during that same period = `newDailyPayment * falloffDay`. The real savings = `totalOldPaymentsDuringOverlap - totalNewPaymentsDuringOverlap`.

### Changes in `src/lib/exportUtils.ts`

**1. Fix `totalSavingsToPayoff` (line 1074)**

Replace:
```
const totalSavingsToPayoff = metrics.dailySavings * metrics.numberOfDebits;
```

With a calculation based on actual overlap period. Sum old payments from the weekly schedule during the overlap, subtract the new payments during that same period:
```typescript
const falloffDayForSavings = Math.max(
  ...positionsWithDays
    .filter(p => !p.isOurPosition && p.includeInReverse !== false && p.balance > 0)
    .map(p => p.daysLeft || 0)
);
const totalOldPaymentsDuringOverlap = weeklySchedule
  .filter(w => w.week <= Math.ceil(falloffDayForSavings / 5))
  .reduce((sum, w) => sum + w.cashInfusion, 0);
const totalNewPaymentsDuringOverlap = metrics.newDailyPayment * falloffDayForSavings;
const totalSavingsToPayoff = totalOldPaymentsDuringOverlap - totalNewPaymentsDuringOverlap;
```

This gives the real cash the merchant keeps in their pocket during the period their old positions are being paid off.

**2. Fix `month1Savings` and `month3Savings` (lines 1072-1073)**

These should also use the simulation data for accuracy, since positions may fall off within the first 1-3 months:

```typescript
const week4 = weeklySchedule.filter(w => w.week <= 4);
const month1OldPayments = week4.reduce((sum, w) => sum + w.cashInfusion, 0);
const month1NewPayments = metrics.newDailyPayment * Math.min(falloffDayForSavings, 22);
const month1Savings = month1OldPayments - Math.min(22, falloffDayForSavings) * metrics.newDailyPayment;

// Similar for month3 using week 12
```

Actually, for simplicity and because positions likely last longer than 1-3 months, we can keep `month1Savings = dailySavings * 22` and `month3Savings = dailySavings * 66` as reasonable approximations (all positions are still active in months 1-3). Only `totalSavingsToPayoff` needs the overlap fix since that's where the term extends far beyond the falloff.

**3. Fix "WITH CONSOLIDATION" monthly payment (line 1522)**

This existing bug where both boxes show the same number:

Replace:
```
Monthly Payment: ${fmtNoDecimals(metrics.monthlySavings + metrics.newDailyPayment * 22)}
```
With:
```
Monthly Payment: ${fmtNoDecimals(metrics.newDailyPayment * 22)}
```

**4. Rename the big green box (line 1534)**

Change "TOTAL SAVINGS OVER LIFE OF DEAL" to "CASH FLOW SAVINGS WHILE POSITIONS PAY OFF" to accurately describe what's being shown.

**5. Fix `cashAccumulatedAtFalloff` on page 4 (line 1413-1415)**

This currently sums `cashInfusion - totalDebits` which goes negative. Replace with the same overlap savings logic:
```typescript
const cashAccumulatedAtFalloff = totalOldPaymentsDuringOverlap - totalNewPaymentsDuringOverlap;
```

### Summary

| Item | Before (wrong) | After (correct) |
|------|----------------|-----------------|
| Total savings | $892,184 (dailySavings x 600+ days) | ~$X (savings only during 135-day overlap) |
| Month 1/3 savings | Keep as-is (reasonable approximation) | No change |
| "With Consolidation" monthly | Same as "Without" (bug) | Correct lower amount |
| Big green box label | "TOTAL SAVINGS OVER LIFE OF DEAL" | "CASH FLOW SAVINGS WHILE POSITIONS PAY OFF" |
| Cash at falloff (page 4) | Negative simulation number | Positive overlap savings |

