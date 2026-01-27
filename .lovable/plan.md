
## Add Adjustable Advance Amount with Confirmation Prompts

### Overview
Add an **Advance Amount** field to each position that allows adjusting how the deal is structured. When you change the advance amount, it affects the net funding and therefore the daily debits, while the weekly cash infusions (based on balance payoffs) remain unchanged. Additionally, both the Discount % and Advance Amount adjustments will trigger a confirmation prompt showing what changed before applying.

---

### What Changes

| Field | Effect When Adjusted |
|-------|---------------------|
| **Balance** | Affects weekly cash infusions (payoff schedule stays the same) |
| **Advance Amount** (NEW) | Affects daily debits (how much we collect back) |
| **Discount %** | Also affects daily debits calculation |

---

### How It Works

1. **New "Advance Amount" Column**: Add an "Advance" column to the positions table
   - Default: Same as balance (so current behavior is preserved)
   - When adjusted: The advance amount is used for calculating the daily debit schedule
   - Balance still drives the weekly infusions (position payoffs)

2. **Daily Debit Calculation Changes**:
   - Currently: `newDailyPayment = totalCurrentDailyPayment * (1 - discount%)`
   - Updated: The calculation will be based on total advance amounts instead of balances when calculating the RTR and daily debits

3. **Confirmation Prompt**: When you change either:
   - **Discount %** (the slider/input in settings)
   - **Advance Amount** (on any position)
   
   A dialog appears showing:
   - What the previous value was
   - What the new value is
   - How it affects the calculation (e.g., "New Daily Payment: $X -> $Y")
   - Confirm or Cancel buttons

---

### Technical Implementation

#### File: `src/types/calculation.ts`

**Add new field to Position type:**

| Field | Type | Description |
|-------|------|-------------|
| `advanceAmount` | number | Optional - defaults to balance if not set |

---

#### File: `src/components/AdjustmentConfirmDialog.tsx` (NEW)

Create a reusable confirmation dialog that shows:
- Field being adjusted (Discount % or Advance Amount)
- Previous value vs New value
- Impact on calculations (old vs new daily payment, RTR, etc.)
- Confirm / Cancel buttons

---

#### File: `src/pages/Index.tsx`

**Change 1: Track pending adjustments**
Add state to track:
- `pendingDiscountChange`: Holds the new discount value pending confirmation
- `pendingAdvanceChange`: Holds { positionId, newAmount } pending confirmation

**Change 2: Intercept discount % changes**
Instead of immediately applying `setSettings({...settings, dailyPaymentDecrease: newValue})`:
- Store the pending value
- Open the confirmation dialog
- Only apply if user confirms

**Change 3: Add Advance Amount column to positions table**
- Add an input field for advance amount (next to balance)
- Default display: use balance if advanceAmount is not set
- On change: store pending value and open confirmation dialog

**Change 4: Update calculations to use advance amounts**
- `totalFunding` calculation should consider advance amounts
- RTR calculations should be based on advance amounts

**Change 5: Update position table footer**
- Show total balance AND total advance amount

---

### User Experience

**When you adjust Discount %:**

```text
+------------------------------------------+
|  Confirm Discount Adjustment             |
|------------------------------------------|
|  Current Discount:    30%                |
|  New Discount:        35%                |
|                                          |
|  Impact:                                 |
|  • New Daily Payment: $850 -> $780       |
|  • Days to Payoff:    187 -> 203         |
|                                          |
|  [Cancel]              [Confirm Change]  |
+------------------------------------------+
```

**When you adjust Advance Amount:**

```text
+------------------------------------------+
|  Confirm Advance Adjustment              |
|------------------------------------------|
|  Position: ABC Funding                   |
|                                          |
|  Current Advance:     $50,000            |
|  New Advance:         $45,000            |
|  Balance (unchanged): $50,000            |
|                                          |
|  Impact:                                 |
|  • Total Funding: $100,000 -> $95,000    |
|  • New Daily Debit: $850 -> $807         |
|                                          |
|  [Cancel]              [Confirm Change]  |
+------------------------------------------+
```

---

### Files to Create/Modify

| File | Changes |
|------|---------|
| `src/types/calculation.ts` | Add `advanceAmount` field to Position type |
| `src/components/AdjustmentConfirmDialog.tsx` | NEW - Reusable confirmation dialog |
| `src/pages/Index.tsx` | Add pending state, intercept changes, show dialog, update calculations |
| `src/lib/exportUtils.ts` | Update exports to include advance amounts |

---

### Summary

1. Add `advanceAmount` field to positions (defaults to balance)
2. Create confirmation dialog component showing before/after impact
3. Intercept Discount % and Advance Amount changes to show confirmation
4. Update RTR/debit calculations to use advance amounts
5. Keep balance-based weekly infusions unchanged

This gives you full control over the deal structure while ensuring you consciously approve any changes that affect the payment calculations.
