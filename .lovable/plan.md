

## Plan: Fix Mathematical Consistency for Daily Payment × # of Debits = Total Payback

### Root Cause Analysis

I traced through the calculations and found **two distinct problems**:

**Problem 1: # of Debits calculation is wrong**

| What We Have | Issue |
|--------------|-------|
| `calculatedNumberOfDebits = Math.ceil(totalPayback / newDailyPayment)` | Ceiling rounds up, causing overshoot |

Example with your numbers:
- Total Payback: $1,000,137.64
- Daily Payment: $8,664.75
- Division: $1,000,137.64 ÷ $8,664.75 = **115.43**
- With `Math.ceil`: **116 debits**
- Check: $8,664.75 × 116 = $1,005,111 (overshoots by ~$5,000!)

The correct approach: Use `Math.floor` + 1 partial last payment, OR calculate the exact daily payment that makes it tie out.

**Problem 2: "Our Profit" in Offer tab uses wrong formula**

Line 1600 currently calculates:
```typescript
{fmt((totalFunding * settings.rate) - totalFunding - (totalFunding * settings.brokerCommission))}
```

This is: `Total Payback - Advance Amount - Broker Commission`

But this **ignores** what we actually fund out (cash infusion to merchant). The correct profit should come from the simulation: `actualPaybackCollected - totalCashInfusion` which is what `metrics.profit` already calculates.

---

### Solution: Make Numbers Mathematically Consistent

**Approach**: Instead of calculating `# of Debits` from a simple division, we derive it properly:

1. **# of Debits** = number of actual withdrawal days (Day 2 onwards until RTR is paid off)
2. Since the last payment can differ, we count: `floor(Total Payback / Daily Payment)` full payments + 1 partial
3. This ensures: `(# of Debits - 1) × Daily Payment + Last Payment = Total Payback`

Or more simply:
- **# of Debits** = `Math.ceil(totalPayback / newDailyPayment)` is correct
- But we acknowledge the **last payment is partial**
- The displayed numbers are mathematically consistent because: `(# Debits - 1) × Payment + Remainder = Total`

---

### Technical Changes

**File: `src/pages/Index.tsx`**

**Change 1: Fix # of Debits calculation (around line 196-198)**

Replace the current ceiling calculation with one that excludes Day 1 and handles the math correctly:

```typescript
// Current
const calculatedNumberOfDebits = newDailyPayment > 0 ? Math.ceil(totalPayback / newDailyPayment) : 0;

// Fixed: Use floor for full payments, the last one is partial
// Also exclude Day 1 since no debit happens on funding day
const fullDebits = newDailyPayment > 0 ? Math.floor(totalPayback / newDailyPayment) : 0;
const remainder = totalPayback - (fullDebits * newDailyPayment);
const calculatedNumberOfDebits = fullDebits + (remainder > 0.01 ? 1 : 0);
```

Actually, simpler approach - the issue is that we want:
- **Daily Payment × (# Debits - 1) + Last Payment = Total Payback**

So `# of Debits` should be `Math.ceil(totalPayback / newDailyPayment)` BUT since ceiling can overshoot by almost a full payment, we use the simulation-derived count which is more accurate.

**Best Fix**: Use the simulation's actual debit count (days with withdrawal > 0):

```typescript
// Count actual debit days from simulation (days with withdrawal > 0)
const actualDebitCount = dailySchedule.filter(d => d.dailyWithdrawal > 0).length;
```

This is the **accurate** number because it's derived from the simulation that runs until RTR = 0.

**Change 2: Fix "Our Profit" display (line 1600)**

Replace the incorrect formula with the simulation-derived profit:

```typescript
// Current (WRONG)
{fmt((totalFunding * settings.rate) - totalFunding - (totalFunding * settings.brokerCommission))}

// Fixed - use actual profit from simulation
{fmt(metrics.profit || 0)}
```

---

### Complete Technical Changes

| Location | Current | Fixed |
|----------|---------|-------|
| Line 196-198 | `Math.ceil(totalPayback / newDailyPayment)` | `dailySchedule.filter(d => d.dailyWithdrawal > 0).length` |
| Line 1600 | Complex formula | `{fmt(metrics.profit || 0)}` |

**New calculation block (replace lines 196-198):**

```typescript
// Count actual debit days from simulation (excludes Day 1, counts only days with withdrawals)
const actualDebitCount = dailySchedule.filter(d => d.dailyWithdrawal > 0).length;
const calculatedNumberOfDebits = actualDebitCount;
```

**Fixed Offer tab profit (line 1600):**

```typescript
<div className="p-4 text-center text-lg font-bold text-success">{fmt(metrics.profit || 0)}</div>
```

---

### Math Verification

After these changes, the numbers will tie out:

| Metric | Source | Value |
|--------|--------|-------|
| Total Payback | `totalFunding × rate` | $1,000,137.64 |
| Daily Payment | `includedDailyPayment × (1 - discount)` | $8,664.75 |
| # of Debits | Simulation (actual days with withdrawals) | ~116-117 |
| Total Collected | Sum of all `dailyWithdrawal` from simulation | ~$1,000,137 |
| Last Payment | Partial (remainder amount) | ~$4,000-$5,000 |
| Profit | `actualPaybackCollected - totalCashInfusion` | Actual calculated |

The simulation already handles the partial last payment (line 264: `Math.min(newDailyPayment, rtrBeforeDebit)`), so the count from simulation is accurate.

---

### Why This Works

1. **# of Debits** comes from the actual simulation, not a simple division
2. **Day 1 is excluded** because the simulation starts debits on Day 2+
3. **Last payment is partial** - the simulation caps it at `Math.min(newDailyPayment, rtrBalance)`
4. **Profit is accurate** - derived from actual cash in vs cash collected
5. **Math ties out** - because we're using simulation results, not approximations

