

## Plan: Fix Cash Report to Reflect Changing Weekly Credits

### The Problem

The cash report's weekly table currently shows the same "Old Payment" and "New Payment" every week. But in reality, the **weekly credits** (cash flowing in from old positions) decrease after positions fall off (around week 8 in the user's scenario). The internal weekly schedule tab already shows this change correctly, but the cash report doesn't reflect it.

The root cause: the code uses `w.cashInfusion` (which does change) and `w.totalDebits` (which is roughly constant), but the user's screenshot shows flat values -- meaning either the build hasn't caught up or there's a data issue. Regardless, the labels "Old Payment" and "New Payment" misrepresent what these columns are.

### The Fix

Rename and restructure the weekly table columns to accurately represent the cash flow:

| Column | Source | Meaning |
|--------|--------|---------|
| Week | `w.week` | Week number |
| Weekly Credits | `w.cashInfusion` | Cash flowing in from positions (decreases as positions fall off) |
| Your Payment | `w.totalDebits` | What the merchant pays us (roughly constant) |
| Net Cash Flow | difference | Weekly credits minus payment (positive = savings, negative = paying more than receiving) |
| Cumulative | running total | Total cash accumulated |

Additionally, add a "Positions Active" indicator to each row so the merchant can see WHY weekly credits change (e.g., "5 of 5" dropping to "3 of 5").

### Design Improvements

1. **Weekly table**: Add a subtle row highlight/separator at the week where positions start falling off. Add a small annotation like "Position X paid off" at the transition points.

2. **Hero summary bar**: Clean up -- remove gradient, use a subtle `bg-muted/50` border, tighter spacing.

3. **Savings milestones**: Use the actual cumulative data from the weekly projection (already correct in current code).

4. **Crossover card**: Keep but ensure it references the correct week where net cash flow turns negative.

### File to Change

| File | Change |
|------|--------|
| `src/components/CashBuildupSection.tsx` | Rename columns, add position-active count per week, add falloff annotations, clean up styling |

### Technical Details

**1. Add position-active count per week**

For each week in the projection, calculate how many positions are still active:

```
const getActivePositionsForWeek = (weekNum: number) => {
  const dayInWeek = weekNum * 5;
  return positionTimeline.filter(p => p.daysUntilPayoff > (weekNum - 1) * 5).length;
};
```

**2. Detect falloff weeks**

Find weeks where a position finishes paying off and annotate those rows:

```
const falloffWeeks = positionTimeline.map(p => Math.ceil(p.daysUntilPayoff / 5));
// Use this to add visual markers in the table
```

**3. Column rename and restructure**

- "Old Payment" becomes "Weekly Credits" (what flows in from old positions)
- "New Payment" becomes "Your Payment" (what merchant pays)
- "Weekly Savings" becomes "Net Cash Flow"
- Keep "Cumulative Savings" as "Cumulative"

**4. Styling cleanup**

- Hero bar: Replace `bg-gradient-to-r from-primary/10 via-accent/30 to-success/10` with `bg-muted/50 border`
- Table rows with position falloff get a subtle left-border accent
- Negative net cash flow rows use `text-destructive` with `bg-destructive/5` background
- Tighter padding throughout (`p-2` instead of defaults)

