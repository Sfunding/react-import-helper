

## Plan: Rebuild Cash Report with Accurate Math and Better Design

### The Core Math Problems

The cash report has **three major calculation bugs** that produce fake numbers:

**Bug 1: "New Payment" uses a flat estimate instead of actual debits**
- Current: `newPayment = newDailyPayment * 5` (constant every week)
- Reality: The simulation already calculates actual weekly debits (`w.totalDebits`) which handles partial payments, early termination, etc.
- Fix: Use `w.totalDebits` from the weekly schedule

**Bug 2: "Cash Accumulated at Falloff" uses a flat daily savings multiplied by days**
- Current: `cashAccumulatedAtFalloff = dailySavings * maxDay` (line 115) -- assumes savings is constant every day
- Reality: As positions fall off, the cash infused drops, so savings change every week
- Fix: Sum actual `(cashInfusion - totalDebits)` from the weekly schedule up to the falloff week

**Bug 3: "Total Savings to Payoff" also uses `newDailyPayment * 5` instead of actual debits**
- Current: `totalSavingsToPayoff += w.cashInfusion - (newDailyPayment * 5)`
- Fix: `totalSavingsToPayoff += w.cashInfusion - w.totalDebits`

All three bugs stem from the same root cause: using a static approximation (`newDailyPayment * 5`) when the actual simulation data (`w.totalDebits`) is already available as a prop.

### Design Improvements

The current layout has 6 separate cards stacked vertically which feels cluttered. Here is the improved structure:

1. **Hero Summary Bar** -- Single compact banner at the top with 3-4 key stats (daily savings, total saved, deal term) instead of the wordy "Important Information" card
2. **Position Payoff Timeline** -- Move up to be the first detailed section (most relevant to the merchant)
3. **Savings Milestones** -- Cleaner 3-column layout with subtle progress indicators
4. **Crossover Point** -- Keep but refine the messaging
5. **Weekly Cash Flow Table** -- Keep at bottom as the detailed breakdown, but show fewer rows by default with an expand option

Remove the "Important Information" card (generic warnings) and the "When All Positions Clear" card (fold those stats into the crossover/timeline sections where they're more contextual).

### Files to Change

| File | Change |
|------|--------|
| `src/components/CashBuildupSection.tsx` | Fix all 3 math bugs, redesign layout |

### Technical Details

**1. Fix weekly projection math (lines 77-92)**

Replace:
```typescript
const oldPayment = w.cashInfusion;
const newPayment = newDailyPayment * 5;
const savings = oldPayment - newPayment;
```
With:
```typescript
const oldPayment = w.cashInfusion;
const newPayment = w.totalDebits;  // Actual debits from simulation
const savings = oldPayment - newPayment;
```

**2. Fix cash accumulated at falloff (line 115)**

Replace:
```typescript
const cashAccumulatedAtFalloff = dailySavings * maxDay;
```
With:
```typescript
const falloffWeek = Math.ceil(maxDay / 5);
const cashAccumulatedAtFalloff = weeklySchedule
  .filter(w => w.week <= falloffWeek)
  .reduce((sum, w) => sum + (w.cashInfusion - w.totalDebits), 0);
```

**3. Fix total savings to payoff (lines 108-111)**

Replace:
```typescript
totalSavingsToPayoff += w.cashInfusion - (newDailyPayment * 5);
```
With:
```typescript
totalSavingsToPayoff += w.cashInfusion - w.totalDebits;
```

**4. Redesign the layout**

- Replace the 6-card stack with a cleaner flow:
  - Top: Compact hero bar with key numbers (daily savings, total term, total saved)
  - Position Timeline table (currently card 5, move to top)
  - Savings milestones (1 month, 3 months, full payoff) in a cleaner grid
  - Crossover point card (when applicable)
  - Weekly projection table with a "Show all weeks" toggle (default to 8 rows)
- Remove the "Important Information" card (the info is covered elsewhere in the offer)
- Fold "When All Positions Clear" stats into the position timeline footer

### What This Fixes

| Metric | Before (Fake) | After (Accurate) |
|--------|---------------|-------------------|
| Weekly "New Payment" | Static `dailyPayment * 5` every week | Actual debits from simulation (handles partials, last day) |
| Cash at Falloff | `dailySavings * maxDay` (flat) | Sum of real weekly net savings from schedule |
| Total Savings | Uses flat weekly estimate | Uses actual schedule debits |
| Crossover detection | Based on flat estimate | Based on real schedule data |

