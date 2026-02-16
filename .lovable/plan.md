
## Plan: Make Fee Schedule Actually Affect the Daily Simulation

### The Problem

The "Fee Schedule" dropdown (Upfront vs Average) changes a label in the Day 1 Summary Card but has **zero effect** on the actual simulation math. Both modes produce identical daily schedules, RTR balances, and cash flows.

**Root cause** in Index.tsx line 292 and exportUtils.ts line 149:
```typescript
const cumulativeGross = cumulativeNetFunded + originationFee;  // ALWAYS adds full fee from Day 1
```

This is the "upfront" behavior hardcoded regardless of the setting.

### How It Should Work

- **Upfront**: Full fee is added to gross on Day 1. RTR is larger from the start.
  - `cumulativeGross = cumulativeNetFunded + totalFee`
- **Average**: Fee accumulates proportionally as cash is infused. RTR grows gradually.
  - `cumulativeGross = cumulativeNetFunded / (1 - feePercent)`
  - This spreads the fee proportionally across all cash infusions

Both modes produce the same total fee by the end of the deal, but the RTR trajectory differs.

### Files to Change

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Line ~292: Branch `cumulativeGross` calculation based on `settings.feeSchedule` |
| `src/lib/exportUtils.ts` | Line ~149: Same branch in the PDF export simulation |

### Technical Details

**1. Index.tsx - Main simulation loop (line 292)**

Replace:
```typescript
const cumulativeGross = cumulativeNetFunded + originationFee;
```

With:
```typescript
const cumulativeGross = settings.feeSchedule === 'upfront'
  ? cumulativeNetFunded + originationFee          // Full fee from Day 1
  : cumulativeNetFunded / (1 - settings.feePercent); // Fee proportional to cash infused
```

**2. Index.tsx - Second simulation loop (line ~460)**

Apply the same branching logic to the "what-if" scenario loop if it exists.

**3. exportUtils.ts - PDF schedule generation (line 149)**

Same fix:
```typescript
const cumulativeGross = settings.feeSchedule === 'upfront'
  ? cumulativeNetFunded + originationFee
  : cumulativeNetFunded / (1 - settings.feePercent);
```

**4. Day1SummaryCard.tsx - Already correct**

The Day1SummaryCard receives `grossContract` from `dailySchedule[0]?.cumulativeGross`, so once the simulation math changes, the card will automatically show different values for each mode.

### What This Fixes

| Aspect | Before | After |
|--------|--------|-------|
| Switching fee schedule | No visible change anywhere | RTR trajectory, Day 1 gross, and daily schedule all update |
| Upfront mode | Same as average | Full fee front-loaded, larger Day 1 RTR |
| Average mode | Same as upfront | Fee spreads proportionally, smaller Day 1 RTR |
| Day 1 Summary Card | Shows correct label but wrong numbers | Numbers match the selected mode |
| PDF export | Ignores fee schedule | Matches dashboard exactly |
