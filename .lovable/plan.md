

## Plan: Invert Calculation Flow — Term and Payment Drive Everything, Discount Becomes Derived

### Current Problem

The current flow:
1. **User sets Discount %** (e.g., 25%)
2. **Daily Payment derived**: `includedDailyPayment × (1 - discount)` = $8,664.75
3. **# of Debits from simulation**: 118 days (counts actual withdrawals)
4. **Math check fails**: $8,664.75 × 118 = $1,022,440 ≠ $1,011,008 (Total Payback)

The numbers don't tie out because they're calculated independently.

---

### New Approach: Make the Math Tie Out by Design

**New Flow:**
1. User sets **# of Debits** (term length) — this is a direct input
2. User can optionally adjust **Daily Payment** — this is also a direct input  
3. **Discount %** becomes a **derived display value**: `1 - (dailyPayment / includedDailyPayment)`
4. **Total Payback** = `Daily Payment × (# of Debits - 1) + Last Payment` OR simply derive from `Funding × Rate`

**The math will ALWAYS tie out** because:
```
Daily Payment = Total Payback / # of Debits
```
OR
```
# of Debits = Total Payback / Daily Payment
```

One is calculated from the other, so multiplication always equals the source.

---

### User Input Options

I'll add two new input fields:
1. **Term (# of Debits)** — editable input field
2. **Daily Payment** — editable input field

When the user changes one:
- **Term changes** → Daily Payment recalculates: `Total Payback / Term`
- **Daily Payment changes** → Term recalculates: `Math.ceil(Total Payback / Daily Payment)`

The **Discount %** becomes read-only, showing what discount percentage the current daily payment represents.

---

### Technical Changes

**1. Add new settings field for term (or calculate it)**

Option A: Store term in settings (makes it persistent)
Option B: Let user toggle which is the "driver" (term or payment)

I'll go with **Option A** — add `termDays` to settings, defaulting to a calculated value.

**File: `src/types/calculation.ts`**

Add to Settings type:
```typescript
export type Settings = {
  // ... existing fields
  termDays: number | null;  // null = auto-calculate from discount, number = user-set term
  dailyPaymentOverride: number | null;  // null = auto-calculate, number = user-set payment
};
```

Update DEFAULT_SETTINGS:
```typescript
export const DEFAULT_SETTINGS: Settings = {
  // ... existing
  termDays: null,
  dailyPaymentOverride: null
};
```

**File: `src/pages/Index.tsx`**

**Change 1: Calculate values in new order (around lines 189-198)**

```typescript
// Calculate Total Payback (always derived from funding × rate)
const totalPayback = totalFunding * settings.rate;

// Determine Daily Payment and Term based on which is set
let newDailyPayment: number;
let calculatedNumberOfDebits: number;

if (settings.dailyPaymentOverride !== null && settings.dailyPaymentOverride > 0) {
  // User specified daily payment → derive term
  newDailyPayment = settings.dailyPaymentOverride;
  calculatedNumberOfDebits = Math.ceil(totalPayback / newDailyPayment);
} else if (settings.termDays !== null && settings.termDays > 0) {
  // User specified term → derive daily payment
  calculatedNumberOfDebits = settings.termDays;
  newDailyPayment = totalPayback / calculatedNumberOfDebits;
} else {
  // Default: use discount to calculate payment, derive term
  newDailyPayment = includedDailyPayment * (1 - settings.dailyPaymentDecrease);
  calculatedNumberOfDebits = newDailyPayment > 0 ? Math.ceil(totalPayback / newDailyPayment) : 0;
}

// Derive the implied discount for display
const impliedDiscount = includedDailyPayment > 0 
  ? 1 - (newDailyPayment / includedDailyPayment) 
  : 0;

const newWeeklyPayment = newDailyPayment * 5;
```

**Change 2: Add input fields for Term and Daily Payment (Settings section, around line 815)**

Add after the current Discount input:
```tsx
{/* Term (# of Debits) - Editable Input */}
<div>
  <label className="block mb-1 text-xs font-semibold text-muted-foreground uppercase">
    Term (Debits)
  </label>
  <input 
    type="number" 
    min="1" 
    step="1" 
    value={settings.termDays ?? calculatedNumberOfDebits}
    onChange={e => {
      const term = parseInt(e.target.value) || 0;
      if (term > 0) {
        setSettings({
          ...settings, 
          termDays: term,
          dailyPaymentOverride: null // Clear payment override when term is set
        });
      }
    }}
    className="w-full p-2.5 border border-input rounded-md text-sm bg-card"
  />
</div>

{/* Daily Payment - Editable Input */}
<div>
  <label className="block mb-1 text-xs font-semibold text-muted-foreground uppercase">
    Daily Payment
  </label>
  <div className="relative">
    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
    <input 
      type="number" 
      min="0" 
      step="100" 
      value={settings.dailyPaymentOverride ?? newDailyPayment}
      onChange={e => {
        const payment = parseFloat(e.target.value) || 0;
        if (payment > 0) {
          setSettings({
            ...settings, 
            dailyPaymentOverride: payment,
            termDays: null // Clear term override when payment is set
          });
        }
      }}
      className="w-full p-2.5 pl-7 border border-input rounded-md text-sm bg-card"
    />
  </div>
</div>
```

**Change 3: Make Discount read-only (or bidirectional)**

The Discount % input becomes a **display of the implied discount**, OR we can keep it editable as a third way to set the payment:

```tsx
{/* Discount % becomes derived display */}
<div className="col-span-2 md:col-span-1">
  <label className="block mb-2 font-bold text-foreground">
    Implied Discount %: <span className="text-xs text-muted-foreground ml-1">(SP: {(sp * 100).toFixed(1)}%)</span>
  </label>
  <div className="text-2xl font-bold text-destructive">
    {(impliedDiscount * 100).toFixed(1)}%
  </div>
</div>
```

OR keep it editable (user can still use discount as input):
```tsx
{/* If user changes discount, it clears the overrides and recalculates */}
onChange={e => {
  const newDiscount = parseFloat(e.target.value) / 100;
  setSettings({
    ...settings,
    dailyPaymentDecrease: newDiscount,
    termDays: null,          // Clear overrides
    dailyPaymentOverride: null
  });
}}
```

**Change 4: Remove the simulation-derived debit count (line 387-389)**

Since we now calculate `calculatedNumberOfDebits` in the main calculation block, remove:
```typescript
// DELETE these lines
const actualDebitCount = dailySchedule.filter(d => d.dailyWithdrawal > 0).length;
const calculatedNumberOfDebits = actualDebitCount;
```

**Change 5: Update simulation to use the calculated term**

The simulation should use `calculatedNumberOfDebits` as its target length, not run indefinitely until RTR = 0.

---

### Math Verification

After these changes:

| Metric | Source | Ties Out? |
|--------|--------|-----------|
| Total Payback | `totalFunding × rate` | Anchor value |
| Daily Payment | User input OR `totalPayback / term` | ✓ Derived |
| # of Debits | User input OR `ceil(totalPayback / payment)` | ✓ Derived |
| Discount % | `1 - (dailyPayment / originalPayment)` | ✓ Derived |

**Check:** `Daily Payment × # of Debits = Total Payback` (exactly, with last payment partial if needed)

---

### Summary of Files to Change

| File | Changes |
|------|---------|
| `src/types/calculation.ts` | Add `termDays` and `dailyPaymentOverride` to Settings type |
| `src/pages/Index.tsx` | Invert calculation logic, add input fields, derive discount |

---

### User Experience

1. **Default behavior unchanged** — If user doesn't touch Term or Payment fields, discount slider still works
2. **Set Term directly** — User enters 100 days, Daily Payment auto-calculates to `$10,110.09`
3. **Set Payment directly** — User enters $8,000/day, Term auto-calculates to `127 days`
4. **Math always ties out** — Because one value is derived from the other

This approach gives full flexibility while guaranteeing mathematical consistency.

