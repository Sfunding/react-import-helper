

## Revert: Make Advance Amount Auto-Calculate from Balance + New Money

### The Problem
Currently, the Advance Amount is stored separately in `settings.advanceAmount` and doesn't update when positions are added. The user wants to revert this behavior so that:

**Advance Amount = Total Position Balance + New Money (always)**

This means removing the editable nature of the advance amount and making it purely calculated.

---

### What Will Change

| Current (Adjustable) | Fixed (Auto-Calculate) |
|---------------------|------------------------|
| Advance Amount stored in `settings.advanceAmount` | Advance Amount calculated as `totalBalance + newMoney` |
| Doesn't update when positions added | Automatically updates when positions change |
| User can edit it in Deal Summary | Display-only (not editable) |
| Triggers confirmation dialog on change | No dialog needed - it's automatic |

---

### Technical Changes

#### File: `src/types/calculation.ts`
- Remove `advanceAmount?: number` from the `Settings` type
- No longer needed since it will be calculated

---

#### File: `src/pages/Index.tsx`

**Change 1: Update totalAdvanceAmount calculation**
```typescript
// Current:
const totalAdvanceAmount = settings.advanceAmount ?? totalBalance;

// Fixed:
const totalAdvanceAmount = totalBalance; // Just use balance directly
```

The Total Funding calculation already adds `settings.newMoney`:
```typescript
const totalFunding = (settings.newMoney + totalAdvanceAmount) / (1 - settings.feePercent);
```

So `totalAdvanceAmount` should just equal `totalBalance` (which updates automatically).

**Change 2: Remove handleAdvanceChange function**
- Delete the `handleAdvanceChange` function (no longer needed)

**Change 3: Update Deal Summary section**
- Make the Advance Amount field display-only (not an input)
- Or remove it if it's redundant with "Total Funding"

**Change 4: Update confirmation dialog references**
- Remove advance-related confirmation logic
- Keep only discount confirmation

**Change 5: Remove advance-related state from pending changes**
- Simplify the `PendingChange` type to only handle discount changes

---

#### File: `src/components/AdjustmentConfirmDialog.tsx`
- Remove `AdvanceChange` type and related UI
- Keep only `DiscountChange` type and UI

---

#### File: `src/lib/exportUtils.ts`
- Remove any references to `settings.advanceAmount`
- Use `totalBalance` directly in exports

---

### Result After Fix

| Metric | Source |
|--------|--------|
| **Advance Amount** | Auto-calculated: Sum of all position balances |
| **Total Funding** | (Advance Amount + New Money) / (1 - Fee %) |
| **Total Payback (RTR)** | Total Funding × Factor Rate |

When you add/remove positions, the Advance Amount and all dependent calculations will automatically update.

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/types/calculation.ts` | Remove `advanceAmount` from Settings type |
| `src/pages/Index.tsx` | Remove advance editing logic, make it auto-calculate |
| `src/components/AdjustmentConfirmDialog.tsx` | Remove advance change UI (keep discount only) |
| `src/lib/exportUtils.ts` | Remove settings.advanceAmount references |

---

### Summary

1. Remove `advanceAmount` field from Settings type
2. Change `totalAdvanceAmount` to simply equal `totalBalance`
3. Make the Advance Amount in Deal Summary display-only (shows totalBalance)
4. Remove the advance amount confirmation dialog logic
5. Keep the discount % confirmation dialog (still useful)

The advance amount will now always equal the sum of position balances and will update automatically when positions are added or removed.

