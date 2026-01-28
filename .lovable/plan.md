

## Plan: Fix Excel/PDF Export to Use New Calculation Logic

### The Problem

The `calculateSchedules` function in `src/lib/exportUtils.ts` uses the **OLD calculation logic**:

```typescript
// Line 77 - OLD logic (ignores termDays/dailyPaymentOverride)
const newDailyPayment = includedDailyPayment * (1 - settings.dailyPaymentDecrease);
```

And the metrics don't include `totalPayback` or `numberOfDebits`, causing:
- Line 835 to use `metrics.totalFunding * settings.rate` instead of the correct `totalPayback`
- Math not tying out in exports

---

### Files to Change

**File: `src/lib/exportUtils.ts`**

---

### Technical Changes

**Change 1: Update `newDailyPayment` calculation (lines 73-83)**

Replace the old discount-based calculation with the new priority logic that respects `termDays` and `dailyPaymentOverride`:

```typescript
// Total Funding = Advance Amount / (1 - Fee%)
const totalFunding = totalAdvanceAmount / (1 - settings.feePercent);
const netAdvance = totalFunding * (1 - settings.feePercent);
const consolidationFees = totalFunding * settings.feePercent;

// Base payback calculation from funding × rate (used as default reference)
const basePayback = totalFunding * settings.rate;

// Determine Daily Payment and Term based on which is set
// Priority: dailyPaymentOverride > termDays > discount-based calculation
let newDailyPayment: number;
let numberOfDebits: number;

if (settings.dailyPaymentOverride !== null && settings.dailyPaymentOverride > 0) {
  // User specified daily payment → derive term from base payback
  newDailyPayment = settings.dailyPaymentOverride;
  numberOfDebits = newDailyPayment > 0 ? Math.ceil(basePayback / newDailyPayment) : 0;
} else if (settings.termDays !== null && settings.termDays > 0) {
  // User specified term → derive daily payment from base payback
  numberOfDebits = settings.termDays;
  newDailyPayment = numberOfDebits > 0 ? basePayback / numberOfDebits : 0;
} else {
  // Default: use discount to calculate payment, derive term
  newDailyPayment = includedDailyPayment * (1 - settings.dailyPaymentDecrease);
  numberOfDebits = newDailyPayment > 0 ? Math.ceil(basePayback / newDailyPayment) : 0;
}

// CRITICAL: Total Payback ALWAYS equals Daily Payment × # of Debits
const totalPayback = newDailyPayment * numberOfDebits;

// Derive the implied discount for display
const impliedDiscount = includedDailyPayment > 0 
  ? 1 - (newDailyPayment / includedDailyPayment) 
  : 0;

const newWeeklyPayment = newDailyPayment * 5;
```

**Change 2: Add new metrics to the return object (lines 173-195)**

Add `totalPayback`, `numberOfDebits`, and `impliedDiscount` to the metrics:

```typescript
metrics: {
  totalBalance,
  totalAdvanceAmount,
  totalCurrentDailyPayment,
  totalFunding,
  netAdvance,
  consolidationFees,
  newDailyPayment,
  newWeeklyPayment,
  totalPayback,        // NEW
  numberOfDebits,      // NEW
  impliedDiscount,     // NEW
  dailySavings,
  weeklySavings,
  monthlySavings,
  sp,
  totalDays,
  maxExposure,
  maxExposureDay,
  lastDayExposed,
  totalCashInfusion,
  actualPaybackCollected,
  profit,
  dealTrueFactor,
  currentLeverage
}
```

**Change 3: Update Excel Summary tab to use new metrics (line 239)**

Change the "Payment Reduction" line to show implied discount:

```typescript
['Payment Reduction', fmtPct(metrics.impliedDiscount * 100)],
```

**Change 4: Update Excel Offer Details tab (around line 332)**

Add the number of debits and total payback to the metrics display.

**Change 5: Fix PDF export Total Payback display (line 835)**

Change from:
```typescript
fmtNoDecimals(metrics.totalFunding * settings.rate),
```

To:
```typescript
fmtNoDecimals(metrics.totalPayback),
```

**Change 6: Update other PDF displays using Rate formula**

Search and replace any other instances of `settings.rate * totalFunding` to use `metrics.totalPayback`.

---

### Summary

| Location | Old Code | New Code |
|----------|----------|----------|
| Line 77 | `includedDailyPayment * (1 - discount)` | Priority logic with overrides |
| metrics object | Missing totalPayback | Add `totalPayback`, `numberOfDebits`, `impliedDiscount` |
| Line 239 | `settings.dailyPaymentDecrease` | `metrics.impliedDiscount` |
| Line 835 | `metrics.totalFunding * settings.rate` | `metrics.totalPayback` |

### Result

After these changes:
- Excel export will show **$1,013,688** for Total Payback (matching 8,664 × 117)
- PDF export will show the same correct value
- Math will tie out in all exports just like it does in the UI

