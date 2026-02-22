

## Plan: Fix PDF Cash Report to Use Real Simulation Data

### The Problem

The PDF cash report (`exportMerchantCashReport` in `src/lib/exportUtils.ts`) has the **exact same bugs** we already fixed in the on-screen `CashBuildupSection.tsx`. The PDF export has its own independent calculation loop that uses flat static values instead of the simulation's `weeklySchedule` data.

Specifically:

| Line | Bug | Current (Wrong) | Fix |
|------|-----|-----------------|-----|
| 1013 | `weeklySchedule` not destructured | Only pulls `positionsWithDays, includedPositions, metrics, dailySchedule` | Add `weeklySchedule` to destructuring |
| 1055-1064 | Weekly projection uses flat values | `oldPayment = metrics.totalCurrentDailyPayment * 5` (constant every week) | Use `w.cashInfusion` from `weeklySchedule` |
| 1060 | New payment is flat | `newPayment = metrics.newDailyPayment * 5` (constant every week) | Use `w.totalDebits` from `weeklySchedule` |
| 1067-1070 | Milestones use flat weekly savings | `month1Savings = 4 * metrics.weeklySavings` | Sum actual net savings from `weeklySchedule` |
| 1408 | Cash at falloff uses flat daily savings | `cashAccumulatedAtFalloff = metrics.dailySavings * falloffDay` | Sum `(cashInfusion - totalDebits)` up to falloff week |

### The Fix

**1. Destructure `weeklySchedule`** (line 1013)

Add `weeklySchedule` to the destructured result from `calculateSchedules`.

**2. Replace the flat weekly projection loop** (lines 1055-1064)

Instead of generating a fake flat loop, map directly from `weeklySchedule`:

```
Weekly Credits = w.cashInfusion (decreases as positions fall off)
Your Payment = w.totalDebits (actual debits from simulation)
Net Cash Flow = cashInfusion - totalDebits
Cumulative = running sum of net cash flow
```

**3. Fix milestones** (lines 1067-1070)

Calculate from actual cumulative data at week 4, week 12, and the final week -- not from flat multipliers.

**4. Fix cash accumulated at falloff** (line 1408)

Sum actual `(cashInfusion - totalDebits)` from weekly schedule up to the falloff week.

**5. Update PDF table columns** (lines 1285-1305)

Rename columns to match the on-screen report:
- "Old Payment" becomes "Weekly Credits"
- "New Payment" becomes "Your Payment"
- "Weekly Savings" becomes "Net Cash Flow"
- "Cumulative Savings" becomes "Cumulative"

### File to Change

| File | Change |
|------|--------|
| `src/lib/exportUtils.ts` | Fix `exportMerchantCashReport` function (lines 1007-1561) |

### Technical Details

**Destructure weeklySchedule (line 1013):**

Change:
```typescript
const { positionsWithDays, includedPositions, metrics, dailySchedule } = calculateSchedules(...)
```
To:
```typescript
const { positionsWithDays, includedPositions, metrics, dailySchedule, weeklySchedule } = calculateSchedules(...)
```

**Replace weekly projection (lines 1055-1064):**

Replace the flat loop with:
```typescript
const weeklyProjection = weeklySchedule.map(w => {
  const weeklyCredits = w.cashInfusion;
  const yourPayment = w.totalDebits;
  const netCashFlow = weeklyCredits - yourPayment;
  cumulativeSavings += netCashFlow;
  return {
    week: w.week,
    weeklyCredits,
    yourPayment,
    netCashFlow,
    cumulativeSavings
  };
});
```

**Fix milestones (lines 1067-1070):**

```typescript
const month1Savings = weeklyProjection.length >= 4
  ? weeklyProjection[3].cumulativeSavings
  : weeklyProjection[weeklyProjection.length - 1]?.cumulativeSavings || 0;
const month3Savings = weeklyProjection.length >= 12
  ? weeklyProjection[11].cumulativeSavings
  : weeklyProjection[weeklyProjection.length - 1]?.cumulativeSavings || 0;
const totalSavingsToPayoff = weeklyProjection.length > 0
  ? weeklyProjection[weeklyProjection.length - 1].cumulativeSavings
  : 0;
```

**Fix cash at falloff (line 1408):**

```typescript
const falloffWeek = Math.ceil(falloffDay / 5);
const cashAccumulatedAtFalloff = weeklySchedule
  .filter(w => w.week <= falloffWeek)
  .reduce((sum, w) => sum + (w.cashInfusion - w.totalDebits), 0);
```

**Update PDF table (lines 1285-1305):**

Change column headers and body to use the new projection fields with correct labels (Weekly Credits, Your Payment, Net Cash Flow, Cumulative).

