

## Plan: Fix All Calculation Tie-Outs (Total Payback, Debits, Days)

### The Core Problem

There are **two conflicting math systems** in the app right now:

1. **Factor-based**: Total Payback = Advance Amount x Factor Rate (the correct one)
2. **Payment-based**: Total Payback = Daily Payment x # of Debits (the one currently used)

The payment-based approach rounds up the number of debits (ceil), which creates a Total Payback that's HIGHER than Advance x Rate. This also causes day counts to diverge across different views.

### The Fix (Single Source of Truth)

**Rule: Total Payback = Advance Amount (Total Funding) x Factor Rate. Always. Exactly.**

The last debit is a partial payment to make the math tie out perfectly. The "# of Debits" includes that partial final debit.

Using the user's example:
- Advance Amount = $840,759.78
- Factor Rate = 1.475
- Total Payback = $840,759.78 x 1.475 = **$1,240,120.68** (exact)
- Daily Payment = $11,200
- Full debits = floor(1,240,120.68 / 11,200) = 110
- Remainder = $8,120.68 (last partial debit)
- **# of Debits = 111** (110 full + 1 partial)
- This ties out: (110 x $11,200) + $8,120.68 = $1,240,120.68

Additionally, if the # of Debits is fewer days than the longest position payoff, a **blocking warning** is shown requiring the user to adjust their inputs.

---

### Files to Change

| File | Changes |
|------|---------|
| `src/pages/Index.tsx` | Fix totalPayback formula, replace all merchant-facing "totalDays" with "calculatedNumberOfDebits", add blocking warning |
| `src/lib/exportUtils.ts` | Fix totalPayback formula in calculateSchedules(), fix rtrAtFalloff lookup |
| `src/components/CashBuildupSection.tsx` | Accept and use calculatedNumberOfDebits instead of totalDays |

---

### Technical Details

**1. Index.tsx - Fix totalPayback (line 215-216)**

Current (wrong):
```typescript
const totalPayback = newDailyPayment * calculatedNumberOfDebits;
```

Fixed:
```typescript
// Total Payback is ALWAYS Advance Amount x Factor Rate (exact)
const totalPayback = totalFunding * settings.rate;
// # of Debits includes partial last payment
calculatedNumberOfDebits = newDailyPayment > 0 ? Math.ceil(totalPayback / newDailyPayment) : 0;
```

Note: When user sets `termDays`, the daily payment is derived from `totalPayback / termDays`, so it ties out exactly. When user sets `dailyPaymentOverride`, debits are ceil'd but totalPayback stays factor-based.

**2. Index.tsx - Add Blocking Warning**

After calculating `calculatedNumberOfDebits`, compare against the maximum position falloff day:

```typescript
const maxPositionDays = Math.max(
  ...positionsWithDays
    .filter(p => !p.isOurPosition && p.includeInReverse !== false && (p.balance || 0) > 0)
    .map(p => p.daysLeft),
  0
);
const dealTooShort = calculatedNumberOfDebits > 0 && maxPositionDays > 0 && calculatedNumberOfDebits < maxPositionDays;
```

Display a red warning banner in the settings area and merchant offer tab when `dealTooShort` is true.

**3. Index.tsx - Replace "totalDays" with "calculatedNumberOfDebits" in merchant-facing displays**

| Location | Current | Fixed |
|----------|---------|-------|
| "# of Payments" in Deal Terms (line 1808) | `{totalDays}` | `{calculatedNumberOfDebits}` |
| "Days to Payoff" in Offer tab (line 1459) | `{totalDays}` | `{calculatedNumberOfDebits}` |

Keep `totalDays` (simulation length) for internal metrics only (exposure analysis, profit tracking).

**4. Index.tsx - Fix rtrAtFalloff lookup (lines 1770-1781)**

The falloff day can exceed the simulation length. Handle this by looking up the last available day or extrapolating:

```typescript
rtrAtFalloff={(() => {
  const includedWithDays = positionsWithDays.filter(p => ...);
  const falloffDay = includedWithDays.length > 0 ? Math.max(...includedWithDays.map(p => p.daysLeft)) : 0;
  if (falloffDay <= 0 || dailySchedule.length === 0) return 0;
  // If falloff day is within schedule, use it directly
  if (falloffDay <= dailySchedule.length) {
    return dailySchedule[falloffDay - 1]?.rtrBalance || 0;
  }
  // If falloff day exceeds schedule, extrapolate from last day
  const lastDay = dailySchedule[dailySchedule.length - 1];
  const daysAfter = falloffDay - dailySchedule.length;
  return Math.max(0, lastDay.rtrBalance - (daysAfter * newDailyPayment));
})()}
```

**5. exportUtils.ts - Same totalPayback fix (line 100-101)**

Current:
```typescript
const totalPayback = newDailyPayment * numberOfDebits;
```

Fixed:
```typescript
const totalPayback = totalFunding * settings.rate;
numberOfDebits = newDailyPayment > 0 ? Math.ceil(totalPayback / newDailyPayment) : 0;
```

Also fix the same rtrAtFalloff lookup issue (line 1399).

**6. CashBuildupSection.tsx - Use # of Debits instead of totalDays**

Rename prop from `totalDays` to `numberOfDebits` and use it for the weekly projection cap and any display that says "days" or "payments".

---

### What This Fixes

| Issue | Before | After |
|-------|--------|-------|
| Total Payback | $1,243,200 (payment x debits) | $1,240,120.68 (advance x rate, exact) |
| # of Debits | 111 (from ceil of wrong payback) | 111 (from ceil of correct payback) |
| "# of Payments" in Merchant Offer | Shows simulation days (113) | Shows # of Debits (111) |
| "Days to Payoff" in Internal Offer | Shows simulation days (113) | Shows # of Debits (111) |
| "When All Positions Clear" balance | $0 (out of bounds lookup) | Correct RTR at that day |
| Deal shorter than positions | Silently broken | Blocked with warning |

### Summary

Three simple rules enforced everywhere:
1. **Total Payback = Advance Amount x Factor Rate** (never payment x debits)
2. **# of Debits = ceil(Total Payback / Daily Payment)** (last debit is partial)
3. **If # of Debits < longest position, block with warning** (deal can never end before positions fall off)

