

## Plan: Fix Position Over-Collection in Weekly Schedule

### The Problem

The simulation collects a **full daily payment on every day** of a position's life, including the last day — even when the remaining balance is less than one full payment.

Example for one position:
- Balance: $53,000 | Daily Payment: $5,000
- Days Left: ceil(53000 / 5000) = 11
- Collected: 11 x $5,000 = $55,000
- Actual owed: $53,000
- **Over-collected: $2,000**

This happens for every position where the balance doesn't divide evenly by the daily payment. The sum of all over-collections explains the $9,033 gap ($1,069,626 collected vs $1,060,593 net amount).

### The Fix

On the **last day** of each position's payoff (`d == daysLeft`), collect only the **remainder** (`balance % dailyPayment`) instead of the full payment. If balance divides evenly, the remainder is zero, so the full payment is correct.

```
lastDayPayment = balance % dailyPayment
if lastDayPayment == 0:
    lastDayPayment = dailyPayment  // evenly divisible
```

### Files to Change

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Fix cash infusion loop (line ~278) and breakdown loop (line ~340, ~364) to cap last-day payment |
| `src/lib/exportUtils.ts` | Same fix in the PDF schedule generation |

### Technical Details

**1. Index.tsx - Main simulation loop (line 278-281)**

Current:
```typescript
const dayPayment = includedPositionsWithDays
  .filter(p => p.balance > 0 && d <= p.daysLeft)
  .reduce((sum, p) => sum + p.dailyPayment, 0);
```

Fixed:
```typescript
const dayPayment = includedPositionsWithDays
  .filter(p => p.balance > 0 && d <= p.daysLeft)
  .reduce((sum, p) => {
    if (d === p.daysLeft) {
      // Last day: collect only the remainder
      const remainder = p.balance % p.dailyPayment;
      return sum + (remainder === 0 ? p.dailyPayment : remainder);
    }
    return sum + p.dailyPayment;
  }, 0);
```

**2. Same fix in the second simulation loop** (line ~442-446, the "what-if" scenario loop).

**3. Same fix in the breakdown helpers** (lines ~338-351 and ~362-375) where `totalContribution = p.dailyPayment * daysContributing` needs to account for a partial last day.

**4. exportUtils.ts** - Apply the same partial-last-day logic in the PDF schedule generation loop.

### What This Fixes

| Metric | Before | After |
|--------|--------|-------|
| Total Weekly Credits | $1,069,626 (over-collected) | $1,060,593 (matches net amount exactly) |
| Individual position payoffs | Collect more than owed | Collect exactly the balance |
| Weekly tab vs Deal Summary | Contradicts | Ties out |

### Verification

After the fix, the sum of all cash infusions across the entire schedule will equal the sum of all included position balances (the "Net to Merchant" / net advance amount). Every number ties out.

