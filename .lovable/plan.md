

## Plan: Fix Weekly Savings Display and Add Crossover Point Card

### Issues to Fix

**1. "+- $27,960" formatting bug (line 282)**
The savings column hardcodes a "+" prefix: `+{fmt(w.savings)}`. When savings goes negative, `fmt()` adds a minus sign, producing "+- $27,960". Fix: conditionally show "+" only when positive, and use proper red/green coloring based on sign.

**2. Colors always green even when negative**
Both the "Weekly Savings" and "Cumulative Savings" columns always use `text-success` (green). When savings turn negative or cumulative drops, these should turn red.

**3. Add a "Crossover Point" info card**
When positions start falling off and cash infused drops below the new payment, the merchant needs reassurance. Add a card that detects the crossover week and explains:
- How much cash they already accumulated before the crossover
- How much their total debt/leverage was reduced by that point
- That even though they're now paying more than they receive, their business is stable because the debt burden is significantly lower

### Files to Change

| File | Change |
|------|--------|
| `src/components/CashBuildupSection.tsx` | Fix formatting, colors, and add crossover card |

### Technical Details

**1. Fix savings formatting (line 282)**

Replace:
```typescript
<TableCell className="text-right font-semibold text-success">+{fmt(w.savings)}</TableCell>
```
With conditional formatting:
```typescript
<TableCell className={cn("text-right font-semibold", w.savings >= 0 ? "text-success" : "text-destructive")}>
  {w.savings >= 0 ? `+${fmt(w.savings)}` : fmt(w.savings)}
</TableCell>
```

**2. Fix cumulative savings color (line 283)**

Same pattern -- green when positive, red when negative.

**3. Fix summary bar color** -- the "After 12 weeks" bar at the bottom should also reflect positive/negative.

**4. Add Crossover Point card**

Detect the first week where `oldPayment < newPayment` (savings goes negative). Calculate:
- `cashAccumulatedAtCrossover`: cumulative savings up to that point (the peak)
- `totalDebtReduced`: sum of all position balances that were fully paid off before crossover
- `positionsClearedByCrossover`: count of positions cleared

Insert a new card between the "Money Back in Your Pocket" and "Position Payoff Timeline" sections with a calming message like:

> **Around Week 9, your savings peak at $286,395**
> By this point, X of your Y positions are fully paid off, reducing your total debt by $Z. Yes, your new payment now exceeds what we're paying out -- but that's because your old debts are gone. Your business keeps that accumulated cash and operates with far less leverage.

This card only appears when a crossover actually exists (i.e., when positions fall off before the deal ends).
