
## Plan: Fix Merchant Cash Report PDF Numbers

### The Problem

When you adjust the deal settings (Term Days, Daily Payment, Discount %), the PDF export shows **different numbers** than what you see in the UI. This happens because:

1. **The UI (Index.tsx)** uses the **stored balance** directly from each position
2. **The PDF export** tries to **auto-calculate** the balance from funded date/amount, which can produce different values

Additionally, the savings calculations depend on accurate `newDailyPayment` and `totalCurrentDailyPayment` values, which must be consistent between the UI and export.

---

### Files to Change

| File | Changes |
|------|---------|
| `src/lib/exportUtils.ts` | Fix `getEffectiveBalance()` to match Index.tsx behavior - use stored balance |
| `src/components/CashBuildupSection.tsx` | Fix `getEffectiveBalance()` to match Index.tsx behavior |

---

### Technical Details

**Change 1: Fix `exportUtils.ts` - `getEffectiveBalance()` (line 37-40)**

The export function should use the same logic as Index.tsx - prioritize the stored balance:

```typescript
// CURRENT (incorrect):
const getEffectiveBalance = (p: Position): number | null => {
  const autoCalc = calculateRemainingBalance(p.fundedDate, p.amountFunded, p.dailyPayment);
  return autoCalc !== null ? autoCalc : p.balance;
};

// FIXED:
const getEffectiveBalance = (p: Position): number | null => {
  // Use the stored balance directly - this matches the UI behavior
  // The auto-calculation is only used during data entry in Index.tsx
  return p.balance;
};
```

**Change 2: Fix `CashBuildupSection.tsx` - `getEffectiveBalance()` (line 30-33)**

Same fix - use the stored balance to match the UI:

```typescript
// CURRENT (incorrect):
const getEffectiveBalance = (p: Position): number | null => {
  const autoCalc = calculateRemainingBalance(p.fundedDate, p.amountFunded, p.dailyPayment);
  return autoCalc !== null ? autoCalc : p.balance;
};

// FIXED:
const getEffectiveBalance = (p: Position): number | null => {
  return p.balance;
};
```

---

### Why This Works

The balance auto-calculation in Index.tsx (lines 234-247) is a **one-time population** that only fills in `balance` when:
- Balance is `null` or `0`
- AND a calculated value exists and is `> 0`

Once the balance is populated, it becomes the "source of truth" stored in the position. The UI then always reads from `p.balance`. By making the export and CashBuildupSection also read directly from `p.balance`, we ensure consistency.

---

### Result

After these changes:
- Daily Savings, Weekly Savings, and Monthly Savings in the PDF will match the UI exactly
- Position balances will be consistent between UI and export
- All "Money Back in Your Pocket" milestone calculations will be accurate
- The Weekly Cash Flow Projection table will show correct values
