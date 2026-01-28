

## Plan: Fix Daily Payment & # of Debits Mathematical Consistency

### Problem Analysis

The current calculations are mathematically inconsistent:

| Metric | Current Value | How It's Calculated |
|--------|--------------|---------------------|
| Total Payback | $1,000,137.64 | `totalFunding × rate` |
| Daily Payment | $8,664.75 | `includedDailyPayment × (1 - discount)` |
| # of Debits | 118 | From schedule simulation |

**Math Check:** $1,000,137.64 ÷ 118 = **$8,475.74** (not $8,664.75)

The issue: Daily Payment is calculated from the discount, but # of Debits comes from the simulation which runs until RTR hits zero. These two approaches give inconsistent results.

### User's Requirement

The numbers must be mathematically consistent:
- **Daily Payment** = Derived from the discount percentage (user's primary input)
- **# of Debits** = `Math.ceil(Total Payback / Daily Payment)` (mathematical derivation)

Using the example:
- Total Payback: $1,000,137.64
- Daily Payment (25% discount): $8,664.75
- # of Debits: $1,000,137.64 ÷ $8,664.75 = **115.5 → 116 days** (not 118)

OR if we want a clean payoff:
- # of Debits: 117
- Daily Payment: $1,000,137.64 ÷ 117 = **$8,548.18**

---

### Solution Design

**Option A: Derive # of Debits from Daily Payment (Recommended)**

Keep the discount-driven daily payment as the primary calculation, then derive # of debits:

```typescript
// Current
const newDailyPayment = includedDailyPayment * (1 - settings.dailyPaymentDecrease);
const totalDays = dailySchedule.length; // From simulation

// Proposed
const newDailyPayment = includedDailyPayment * (1 - settings.dailyPaymentDecrease);
const totalPayback = totalFunding * settings.rate;
const numberOfDebits = newDailyPayment > 0 ? Math.ceil(totalPayback / newDailyPayment) : 0;
```

**Displayed Values:**
- Daily Payment: $8,664.75 (from discount)
- # of Debits: 116 (calculated: $1,000,137 / $8,664.75 = 115.5 → 116)
- Total Payback: $1,000,137.64 (unchanged)

**Note:** The last payment would be partial (~$4,622) to make the math work exactly.

---

### Technical Changes

**File: `src/pages/Index.tsx`**

**Change 1: Add calculated # of debits (after line 193)**

```typescript
// Line 193 - existing
const newDailyPayment = includedDailyPayment * (1 - settings.dailyPaymentDecrease);

// Add new calculated value
const totalPayback = totalFunding * settings.rate;
const calculatedNumberOfDebits = newDailyPayment > 0 ? Math.ceil(totalPayback / newDailyPayment) : 0;
```

**Change 2: Update header display (line 1124)**

Replace `totalDays` with `calculatedNumberOfDebits`:

```typescript
// Before
<div className="text-2xl font-bold text-primary-foreground">{totalDays}</div>

// After
<div className="text-2xl font-bold text-primary-foreground">{calculatedNumberOfDebits}</div>
```

**Change 3: Update Offer tab display (line 1584)**

Replace `totalDays` with `calculatedNumberOfDebits`:

```typescript
// Before
<div className="p-4 text-center text-lg font-bold">{totalDays}</div>

// After
<div className="p-4 text-center text-lg font-bold">{calculatedNumberOfDebits}</div>
```

---

### Important Notes

1. **The simulation (`dailySchedule`) remains unchanged** - it's still used for exposure tracking, daily/weekly schedule views, and profit calculations

2. **Only the displayed "# of Debits" changes** - it now shows the mathematically consistent value rather than the simulation length

3. **The simulation and calculated debits may differ slightly** because:
   - Simulation accounts for partial last payment
   - Simulation tracks actual RTR balance depletion
   - The calculated value is a clean mathematical division

4. **This ensures:** `Total Payback ÷ Daily Payment = # of Debits` (exactly)

---

### Summary

| Location | Change |
|----------|--------|
| After line 193 | Add `totalPayback` and `calculatedNumberOfDebits` calculations |
| Line 1124 | Change `{totalDays}` to `{calculatedNumberOfDebits}` |
| Line 1584 | Change `{totalDays}` to `{calculatedNumberOfDebits}` |

After these changes:
- **Daily Payment** = $8,664.75 (from 25% discount on $11,553)
- **# of Debits** = 116 (from $1,000,137 ÷ $8,664.75)
- **Total Payback** = $1,000,137.64 (unchanged)
- Math checks out: $8,664.75 × 116 = $1,005,111 (slightly over due to ceiling, last payment partial)

