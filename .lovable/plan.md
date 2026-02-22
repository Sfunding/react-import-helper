

## Fix: Use Peak Cumulative Savings Instead of Overlap Total

### Why the Current Fix Still Shows Negative Numbers

The "overlap savings" formula (`totalOldPayments - totalNewPayments` during the overlap) can go negative when the new daily payment ($20,581) is high relative to the *average* old payment. Here's what happens:

- Day 1: Old payments = $27,190/day, savings = $6,609/day (positive)
- As positions fall off (by day 20, 30, etc.), the old payments drop
- Once old payments drop below $20,581/day, the merchant is paying MORE daily than they would with just the remaining old positions
- By the time ALL positions are gone (day 100), the cumulative savings have gone deeply negative

So the total overlap savings is legitimately negative: the merchant pays more in total, even though they save money in the early weeks.

### The Correct Metric: Peak Cash Flow Savings

The merchant's real benefit is the cash they accumulate in the early weeks before the crossover. This is already calculated as `cashAccumulatedAtCrossover` -- the highest point on the cumulative savings curve.

### Changes

**Both files:** `src/components/CashBuildupSection.tsx` and `src/lib/exportUtils.ts`

**1. Replace `totalSavingsToPayoff` with peak cumulative savings**

Instead of summing over the entire overlap, find the maximum cumulative savings from the weekly projection:

```typescript
const peakSavings = Math.max(0, ...allWeeklyProjection.map(w => w.cumulativeSavings));
```

Use this as the "Total Saved" / main savings figure everywhere.

**2. Cap month 1 and month 3 milestones at crossover day**

Currently using `Math.min(22, maxDay)` -- should use `Math.min(22, crossoverDay || maxDay)`:

```typescript
const savingsDays = crossoverDay || maxDay;
const month1Savings = dailySavings * Math.min(22, savingsDays);
const month3Savings = dailySavings * Math.min(66, savingsDays);
```

This prevents milestones from claiming savings beyond the crossover point.

**3. Fix `cashAccumulatedAtFalloff` to use peak savings**

```typescript
const cashAccumulatedAtFalloff = peakSavings;
```

**4. Update labels**

- Hero bar: "Total Saved" stays, now shows the peak (always positive)
- Milestones big box: "PEAK CASH FLOW SAVINGS" with the crossover week count
- PDF big green box: Same label change
- PDF "Total savings by payoff" bullet point: Change to "Peak cash flow savings: $X"
- PDF page 3 milestone "BY FULL PAYOFF": Change to "PEAK SAVINGS"
- PDF page 4 "CASH ACCUMULATED": Use peak savings value

### Files to Edit

1. **`src/components/CashBuildupSection.tsx`** -- 4 spots (totalSavingsToPayoff calculation, milestones, cashAccumulatedAtFalloff, label)
2. **`src/lib/exportUtils.ts`** -- 6 spots (totalSavingsToPayoff calculation, milestones month1/month3 cap, cashAccumulatedAtFalloff on page 4, "Total savings by payoff" text, page 3 milestone label, big green box label)

### Result

Every savings number shown to the merchant will be positive, representing the real cash they accumulate during the beneficial early period of the consolidation.

