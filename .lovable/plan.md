

## Updated Plan: Partial Reverse + Smart Fee Schedule + Corrected Advance Amount

### Summary of Changes

This plan combines three improvements:
1. **Advance Amount includes New Money** - Shows total cash going to merchant
2. **Partial Reverse feature** - Select which positions to include
3. **Smart Fee Schedule** - Auto-switch to "Average" when New Money is used

---

### Why Force "Average" Fees with New Money?

When you have New Money and use Upfront fees, the entire consolidation fee comes off the Day 1 cash infusion. This means the new money gets eaten up by fees before the merchant sees it.

| Fee Schedule | What Happens |
|--------------|--------------|
| **Upfront** | Full fee deducted from Day 1 cash → merchant gets less new money |
| **Average** | Fee spread across all cash infusions → fair distribution |

**Rule**: If New Money > 0, force "Average" fee schedule and disable "Upfront" option

---

### Updated Calculations

| Metric | Formula |
|--------|---------|
| **Advance Amount** | Included Position Balances + New Money |
| **Total Funding** | Advance Amount / (1 - Fee%) |
| **Total Payback (RTR)** | Total Funding × Factor Rate |

---

### Technical Changes

#### File: `src/types/calculation.ts`
Add `includeInReverse` to Position type:
```typescript
export type Position = {
  id: number;
  entity: string;
  balance: number;
  dailyPayment: number;
  isOurPosition: boolean;
  includeInReverse: boolean; // NEW - defaults to true
};
```

---

#### File: `src/pages/Index.tsx`

**Change 1: Position filtering for partial reverse**
- Create `allExternalPositions` (all non-ourPosition, for leverage metrics)
- Create `includedPositions` (only those with `includeInReverse: true`, for reverse calculations)

**Change 2: Update Advance Amount calculation**
```typescript
const includedBalance = includedPositions.reduce((sum, p) => sum + p.balance, 0);
const totalAdvanceAmount = includedBalance + settings.newMoney;
```

**Change 3: Update Total Funding calculation**
```typescript
// New money is now part of advance amount
const totalFunding = totalAdvanceAmount / (1 - settings.feePercent);
```

**Change 4: Auto-force Average fees when New Money exists**
Add a `useEffect` that watches `settings.newMoney`:
```typescript
useEffect(() => {
  if (settings.newMoney > 0 && settings.feeSchedule === 'upfront') {
    setSettings(prev => ({ ...prev, feeSchedule: 'average' }));
  }
}, [settings.newMoney, settings.feeSchedule]);
```

**Change 5: Disable Upfront option when New Money > 0**
Update the Fee Schedule dropdown:
```typescript
<select 
  value={settings.feeSchedule} 
  onChange={e => setSettings({...settings, feeSchedule: e.target.value})}
  disabled={settings.newMoney > 0 && e.target.value === 'upfront'}
>
  <option value="average">Average</option>
  <option value="upfront" disabled={settings.newMoney > 0}>
    Fee Upfront {settings.newMoney > 0 ? '(disabled with New Money)' : ''}
  </option>
</select>
```

**Change 6: Add checkbox column to positions table**
- Add "Include" column header
- Add checkbox for each external position row
- Style excluded rows with `opacity-60`

**Change 7: Update addPosition function**
Default new positions to `includeInReverse: true`

**Change 8: Split calculations by purpose**
- Leverage/SP metrics → use ALL external positions
- Advance/Funding/Schedule → use only INCLUDED positions

**Change 9: Update footer summary**
Show "Reversing X of Y positions" in the table footer

---

#### File: `src/lib/exportUtils.ts`
- Add "Include" column to position exports
- Use included positions for funding calculations
- Still show all positions in exports (marked as included/excluded)

---

### UI Changes

**Fee Schedule dropdown with New Money warning:**
```text
+----------------------------------+
| Fee Schedule                     |
| [Average              ▼]         |
+----------------------------------+
  ℹ️ Upfront fees disabled when using New Money
```

**Positions table with Include column:**
```text
+----------+----------+---------+--------+------+---------+
| Include  | Entity   | Balance | Daily  | Days | Actions |
+----------+----------+---------+--------+------+---------+
|   [✓]    | Funder A | $50,000 | $2,500 |  20  | Delete  |
|   [✓]    | Funder B | $30,000 | $1,500 |  20  | Delete  |
|   [ ]    | Funder C | $20,000 | $1,000 |  20  | Delete  | <- faded
+----------+----------+---------+--------+------+---------+
| Reversing 2 of 3    | $80,000 | $4,000 | ...             |
+----------+----------+---------+--------+------+---------+
```

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/types/calculation.ts` | Add `includeInReverse` boolean to Position type |
| `src/pages/Index.tsx` | Add partial reverse checkboxes, update advance amount calculation, add fee schedule auto-switch, disable upfront option with new money |
| `src/lib/exportUtils.ts` | Handle partial reverse in exports, add Include column |

---

### Result

1. **Advance Amount** = Included position balances + New Money
2. **Fee Schedule** = Auto-switches to "Average" when New Money > 0
3. **Upfront Option** = Disabled when New Money is used
4. **Partial Reverse** = Checkbox to include/exclude each position
5. **Leverage Metrics** = Still use all positions for accurate merchant picture

