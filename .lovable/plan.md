

## Plan: Fix Weekly Cash Flow Projection to Use Real Schedule Data

### The Problem

The "Weekly Cash Flow Projection" on the Merchant's Offer tab shows **the same flat numbers every week** (e.g., $97K old payment, same savings). But the Weekly tab shows the real simulation where cash infusion drops as positions get paid off. These two views directly contradict each other.

**Root cause** in `CashBuildupSection.tsx` (lines 77-89):
```
for (let week = 1; week <= totalWeeks; week++) {
  const oldPayment = totalCurrentDailyPayment * 5;  // STATIC - same every week
  const newPayment = newDailyPayment * 5;            // STATIC - same every week
  const savings = weeklySavings;                     // STATIC - same every week
}
```

The real weekly schedule (used on the Weekly tab) already has the correct declining cash infusion values. The fix is to pass the real weekly schedule data to the Merchant Offer tab and use it.

---

### The Fix

Pass the actual `weeklySummary` data into `CashBuildupSection` and use real cash infusion numbers instead of fabricated flat ones.

**What changes per week:**
- **Old Payment** = the actual weekly cash infusion from the simulation (declines as positions fall off)
- **New Payment** = `newDailyPayment x 5` (stays flat, this is the reverse payment)
- **Savings** = Old Payment - New Payment (declines as positions fall off)

---

### Files to Change

| File | Changes |
|------|---------|
| `src/components/CashBuildupSection.tsx` | Accept weekly schedule data as a prop, replace flat projection with real numbers |
| `src/pages/Index.tsx` | Pass `weeklySummary` to the `CashBuildupSection` component |

---

### Technical Details

**1. CashBuildupSection.tsx - New prop and updated projection**

Add a new prop for the real weekly data:
```typescript
type WeeklyData = {
  week: number;
  cashInfusion: number;
  totalDebits: number;
  endExposure: number;
};

type CashBuildupSectionProps = {
  // ... existing props
  weeklySchedule: WeeklyData[];  // Real weekly schedule from simulation
};
```

Replace the static loop (lines 72-90) with real data:
```typescript
const weeklyProjection = weeklySchedule
  .slice(0, 12)  // Show first 12 weeks
  .map((w, i) => {
    const oldPayment = w.cashInfusion;  // What funders take (declines over time)
    const newPayment = newDailyPayment * 5;  // What we take (stays flat)
    const savings = oldPayment - newPayment;  // Real savings that week
    cumulativeSavings += savings;
    return {
      week: w.week,
      oldPayment,
      newPayment,
      savings,
      cumulativeSavings
    };
  });
```

Also update the milestone savings (lines 98-100) to use real cumulative numbers instead of flat `weeklySavings` multiplied by weeks.

**2. Index.tsx - Pass weeklySummary**

In the CashBuildupSection usage, add:
```typescript
<CashBuildupSection
  // ... existing props
  weeklySchedule={weeklySummary}
/>
```

---

### What This Fixes

| Issue | Before | After |
|-------|--------|-------|
| Weekly projection | Same $97K "old payment" every week | Real declining amounts matching the Weekly tab |
| Weekly savings | Same flat amount every week | Declines as positions fall off |
| Cumulative savings | Inflated (flat rate x weeks) | Accurate running total |
| Milestone savings (1mo, 3mo) | Overstated | Based on real schedule data |
| Consistency with Weekly tab | Contradicts it | Matches exactly |

### Summary

One simple rule: **The Merchant Offer tab must use the same underlying data as the Weekly tab.** No more fabricated flat projections.

