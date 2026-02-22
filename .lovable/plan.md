

## Fix: Milestones Cannot Exceed Peak Savings

### The Problem

"After 3 Months" shows $330,439 but "Peak Cash Flow Savings" shows $306,975. The milestone can't be higher than the peak -- it's the same savings curve.

The milestones use a flat formula (`dailySavings x days`) which assumes constant savings every day. But savings actually decline as positions fall off, so the real peak (from simulation) is lower.

### The Fix

**File:** `src/components/CashBuildupSection.tsx` (line 125-126)

Cap both milestones at `peakSavings`:

```typescript
const month1Savings = Math.min(dailySavings * Math.min(22, savingsDays), peakSavings);
const month3Savings = Math.min(dailySavings * Math.min(66, savingsDays), peakSavings);
```

**File:** `src/lib/exportUtils.ts` (same milestone calculation)

Apply the same cap in the PDF export so the report matches the on-screen display.

### Result

- If the flat formula gives a number higher than peak savings, it gets capped to peak savings
- "After 3 Months" will never exceed "Peak Cash Flow Savings"
- Both on-screen and PDF will be consistent

