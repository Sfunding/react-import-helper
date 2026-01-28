
# Reverse Consolidation Calculator - Feature Plan

## Completed Features

### Position Status Markers ✓
- **"Our Position" toggle**: Mark positions as company-owned, visually highlighted, excluded from reverse
- **Unknown Balance**: Track positions with unknown balances, excluded from calculations

### Funding Tracking ✓
- **Funded Date**: Date picker to record when position was funded
- **Amount Funded**: Original funded amount for the position
- **Auto-Balance Calculation**: Balance automatically calculated from funded date, amount funded, and daily payment using business days elapsed

### Export Without Saving ✓
- Excel and PDF export buttons directly in calculator header
- Export current state without requiring save first

### Dual Payment Input ✓
- Enter either Daily or Weekly payment amount
- Auto-syncs bi-directionally (Weekly = Daily × 5)

---

## Technical Implementation Notes

### Position Type (`src/types/calculation.ts`)
```typescript
export type Position = {
  id: number;
  entity: string;
  balance: number | null;  // null = unknown
  dailyPayment: number;
  isOurPosition: boolean;
  includeInReverse: boolean;
  fundedDate: string | null;  // ISO date string
  amountFunded: number | null;  // Original funded amount
};
```

### Balance Calculation Logic
When `fundedDate` and `amountFunded` are provided:
1. Calculate business days elapsed since funded date
2. Remaining balance = amountFunded - (businessDaysElapsed × dailyPayment)
3. Auto-calculated balance overrides manual balance entry

### Position Filtering
- **All External**: `!isOurPosition && effectiveBalance > 0`
- **Included**: All external positions where `includeInReverse !== false`
- **Unknown**: Positions where effective balance is null
