

## Plan: Fix Funded Amount Display + Manual Balance Override with Discrepancy Indicator

### Problem Summary

1. **Funded Amount**: Currently the Amount Funded column is there, but the footer shows "-" instead of a total, and the display may not be clear
2. **Balance Override**: When funded date and amount funded are set, the balance becomes **read-only** (displayed as a badge). Users need to manually adjust balances when funders paused or lowered payments, even if it doesn't match the calculated value

### Solution

Make the balance **always editable** with a smart discrepancy indicator that shows when the entered value differs from what the contract/dates would calculate.

---

### Technical Changes

#### File: `src/pages/Index.tsx`

**Change 1: Update Balance Cell Logic**

Replace the current conditional rendering (lines 1114-1166) with:
- Always show an editable balance input
- Calculate the "expected balance" from funded date/amount/payment
- If actual balance differs from expected, show a warning indicator
- Add a "Sync" button to reset balance to calculated value

**New balance cell structure:**
```
+-------------------------------------------+
| $ [    12,500.00    ] ⚠️ 🔄               |
|   Expected: $15,000 (based on contract)   |
+-------------------------------------------+
```

**Change 2: Update `getEffectiveBalance` helper**

Current logic returns auto-calculated if available, otherwise manual. 
New logic: Always use `p.balance` if it's set, showing the discrepancy indicator for UI purposes only.

```typescript
// Always use the stored balance for calculations
const getEffectiveBalance = (p: Position): number | null => {
  return p.balance;
};

// Separate function to calculate expected balance for comparison
const getExpectedBalance = (p: Position): number | null => {
  return calculateRemainingBalance(p.fundedDate, p.amountFunded, p.dailyPayment);
};
```

**Change 3: Auto-populate balance when funding data is entered**

Add logic so that when user enters funded date + amount funded + daily payment, if the balance is still null/0, auto-fill it with the calculated value. But once they manually edit it, respect their value.

```typescript
useEffect(() => {
  // For each position with funding data but no balance, auto-populate
  const updated = positions.map(p => {
    const expected = calculateRemainingBalance(p.fundedDate, p.amountFunded, p.dailyPayment);
    // Only auto-fill if balance is null or 0 and we have calculated value
    if ((p.balance === null || p.balance === 0) && expected !== null && expected > 0) {
      return { ...p, balance: expected };
    }
    return p;
  });
  // Only update if something changed
  if (JSON.stringify(updated) !== JSON.stringify(positions)) {
    setPositions(updated);
  }
}, [positions.map(p => `${p.fundedDate}-${p.amountFunded}-${p.dailyPayment}`).join(',')]);
```

**Change 4: Update balance cell UI**

```tsx
<td className="p-2">
  <div className="space-y-1">
    {/* Always editable balance input */}
    <div className="relative flex items-center gap-1">
      <div className="relative flex-1">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
        <input 
          type="number" 
          value={p.balance ?? ''} 
          onChange={e => {
            const val = e.target.value;
            updatePosition(p.id, 'balance', val === '' ? null : parseFloat(val) || 0);
          }} 
          placeholder="Unknown" 
          className={`w-full p-2 pl-5 border rounded-md text-right bg-background 
            ${hasDiscrepancy ? 'border-warning' : 'border-input'}
            ${isExcluded ? 'text-muted-foreground' : ''}`}
        />
      </div>
      {/* Unknown marker button */}
      <button 
        onClick={() => updatePosition(p.id, 'balance', null)}
        className="text-xs text-muted-foreground hover:text-warning font-bold"
        title="Mark as unknown"
      >
        ?
      </button>
      {/* Sync to calculated button (only shown when discrepancy exists) */}
      {hasDiscrepancy && expectedBalance !== null && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              onClick={() => updatePosition(p.id, 'balance', expectedBalance)}
              className="text-xs text-warning hover:text-warning/80"
              title="Sync to calculated balance"
            >
              🔄
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Reset to calculated: {fmt(expectedBalance)}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
    
    {/* Discrepancy indicator */}
    {hasDiscrepancy && expectedBalance !== null && (
      <div className="flex items-center gap-1 text-xs text-warning">
        <span>⚠️</span>
        <span>Expected: {fmt(expectedBalance)}</span>
      </div>
    )}
  </div>
</td>
```

**Change 5: Add footer totals for Amount Funded**

Update the footer row (line 1236-1237) to show total funded amount:
```tsx
<td className="p-3 text-right">
  {fmt(positions.reduce((sum, p) => sum + (p.amountFunded || 0), 0))}
</td>
```

---

### UI Preview

**Normal state (balance matches calculation):**
```
| Funded Date  | Amount Funded | Balance      | Daily  |
| Jan 15, 2025 | $50,000.00    | $35,000.00   | $500   |
```

**Discrepancy state (balance differs from calculation):**
```
| Funded Date  | Amount Funded | Balance               | Daily  |
| Jan 15, 2025 | $50,000.00    | $ [30,000.00] ⚠️ 🔄   | $500   |
|              |               | ⚠️ Expected: $35,000  |        |
```

The warning border, indicator text, and sync button clearly show the user that:
- Their entered balance ($30,000) differs from what the contract math says ($35,000)
- They can click 🔄 to sync back to the calculated value
- The system respects their manual entry for all calculations

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Index.tsx` | Update balance cell to always be editable, add discrepancy indicator, add auto-populate effect, update footer totals |

---

### Summary

1. **Balance is always editable** - No more read-only badge when funding data exists
2. **Auto-populate on first entry** - When funded data is added, balance auto-fills with calculated value
3. **Discrepancy indicator** - Yellow warning border + "Expected: $X" text when balance differs from calculation
4. **Sync button** - Easy way to reset balance to calculated value if desired
5. **Footer totals** - Show sum of Amount Funded in the footer row

