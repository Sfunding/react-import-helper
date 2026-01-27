

## ✅ COMPLETED: Move Advance Amount to Deal Summary

### What Changed

1. **Removed per-position Advance column** from the positions table
2. **Added Deal Summary section** with blue background showing key metrics:
   - **Advance Amount** (editable with confirmation dialog)
   - Factor Rate
   - Total Payback (RTR)
   - Daily Payment
   - Number of Debits
3. **Moved `advanceAmount` from Position type to Settings type** - now a deal-level field
4. **Updated confirmation dialog** to show deal-level impact (not position-level)
5. **Updated exports** (Excel/PDF) to remove per-position advance references

### Files Modified

| File | Changes |
|------|---------|
| `src/types/calculation.ts` | Moved `advanceAmount` from Position to Settings |
| `src/components/AdjustmentConfirmDialog.tsx` | Updated to handle deal-level advance changes |
| `src/pages/Index.tsx` | Removed advance column, added Deal Summary section |
| `src/lib/exportUtils.ts` | Updated to use single deal-level advance amount |

### How It Works

- The **Advance Amount** defaults to the total position balance
- When you edit it, a confirmation dialog shows the impact on Total Funding and RTR
- The positions table now only shows: Entity, Balance, Daily Payment, Days Left, Last Payment, Actions
