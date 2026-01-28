

## Feature: "Our Position" Marker + Unknown Balance Support

### Overview

Two additions to position tracking:
1. **Mark positions as "our own"** - These are your company's existing positions on this merchant. They appear in the table but are never included in the reverse (you're not buying out yourself).
2. **Unknown balance** - Track positions where you know they exist but don't know the exact balance. Shows "Unknown" in UI and excluded from calculations.

---

### Feature 1: "Our Position" Toggle

**The Problem**: The `isOurPosition` field exists in the data model but there's no UI to set it.

**The Solution**: Add a toggle/checkbox to mark positions as "ours" with visual distinction.

#### How It Will Work

- Add an "Ours" checkbox column to the positions table
- When checked, the position is visually highlighted (different background color)
- "Our positions" are automatically excluded from the reverse (they don't need the "Include" checkbox)
- They still count toward leverage metrics (merchant's total debt picture)

---

### Feature 2: Unknown Balance

**The Problem**: Sometimes you know a merchant has a position but don't know the exact balance.

**The Solution**: Allow entering "unknown" or leaving balance blank with a special indicator.

#### Technical Approach

Change the `balance` field in Position type to allow `null`:
- `balance: number | null` where `null` means "unknown"
- Display "Unknown" badge in the UI when balance is null
- Unknown balances are excluded from total calculations
- Show a warning if unknown positions exist

---

### Technical Changes

#### File: `src/types/calculation.ts`

Update Position type to allow null balance:
```typescript
export type Position = {
  id: number;
  entity: string;
  balance: number | null;  // null = unknown
  dailyPayment: number;
  isOurPosition: boolean;
  includeInReverse: boolean;
};
```

---

#### File: `src/pages/Index.tsx`

**Change 1: Add "Ours" checkbox column**

Update table header:
```typescript
<th className="p-3 text-center border-b-2 border-border font-semibold w-16">Ours</th>
<th className="p-3 text-center border-b-2 border-border font-semibold w-16">Include</th>
// ... rest of columns
```

Add checkbox for each position:
```typescript
<td className="p-2 text-center">
  <Checkbox
    checked={p.isOurPosition}
    onCheckedChange={(checked) => updatePosition(p.id, 'isOurPosition', !!checked)}
    className="mx-auto"
  />
</td>
```

**Change 2: Show ALL positions in table (not just external)**

Remove the filter that hides our positions:
```typescript
// Before: positions.filter(p => !p.isOurPosition).map(...)
// After: positions.map(...)
```

**Change 3: Conditional "Include" checkbox**

Only show Include checkbox for non-our positions:
```typescript
<td className="p-2 text-center">
  {!p.isOurPosition ? (
    <Checkbox
      checked={isIncluded}
      onCheckedChange={(checked) => updatePosition(p.id, 'includeInReverse', !!checked)}
    />
  ) : (
    <span className="text-xs text-muted-foreground">-</span>
  )}
</td>
```

**Change 4: Visual distinction for "our" positions**

Apply a distinct style for our positions:
```typescript
<tr className={`border-b border-border hover:bg-muted/50 transition-colors 
  ${p.isOurPosition ? 'bg-primary/10 border-l-4 border-l-primary' : ''} 
  ${!isIncluded && !p.isOurPosition ? 'opacity-50' : ''}`}
>
```

**Change 5: Unknown balance input handling**

Change balance input to support null:
```typescript
<td className="p-2">
  <div className="relative">
    {p.balance === null ? (
      <div className="flex items-center gap-2">
        <span className="px-2 py-1 bg-warning/10 text-warning rounded text-xs font-semibold">
          Unknown
        </span>
        <button 
          onClick={() => updatePosition(p.id, 'balance', 0)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Set value
        </button>
      </div>
    ) : (
      <>
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
        <input 
          type="number" 
          value={p.balance || ''} 
          onChange={e => {
            const val = e.target.value;
            updatePosition(p.id, 'balance', val === '' ? null : parseFloat(val) || 0);
          }} 
          placeholder="Unknown" 
          className="w-full p-2 pl-5 border border-input rounded-md text-right bg-background"
        />
      </>
    )}
  </div>
</td>
```

**Change 6: Add "Unknown Balance" button**

Add a small button or option to explicitly set balance as unknown:
```typescript
// In the balance cell, add a right-click context or small icon
<button 
  onClick={() => updatePosition(p.id, 'balance', null)}
  className="ml-1 text-xs text-muted-foreground hover:text-warning"
  title="Mark as unknown"
>
  ?
</button>
```

**Change 7: Update calculations to handle null balances**

```typescript
// Filter out null balances from calculations
const allExternalPositions = positions.filter(p => !p.isOurPosition && p.balance !== null);
const includedPositions = allExternalPositions.filter(p => p.includeInReverse !== false);

// Count unknown positions for warning
const unknownBalanceCount = positions.filter(p => p.balance === null).length;
```

**Change 8: Update footer to show our positions count**

```typescript
<td className="p-3">
  {`REVERSING ${includedPositions.length} of ${allExternalPositions.length} positions`}
  {ourPositionsCount > 0 && ` (${ourPositionsCount} ours)`}
  {unknownBalanceCount > 0 && ` (${unknownBalanceCount} unknown)`}
</td>
```

---

### UI Preview

**Positions table with Ours column and Unknown balance:**

```text
+------+----------+----------+-----------+--------+--------+------+---------+
| Ours | Include  | Entity   | Balance   | Daily  | Weekly | Days | Actions |
+------+----------+----------+-----------+--------+--------+------+---------+
|  [ ] |   [✓]    | Funder A | $50,000   | $2,500 |$12,500 |  20  | Delete  |
|  [ ] |   [✓]    | Funder B | $30,000   | $1,500 | $7,500 |  20  | Delete  |
|  [ ] |   [ ]    | Funder C | [Unknown] | $1,000 | $5,000 |  ?   | Delete  | <- faded
|  [✓] |    -     | Avion    | $25,000   | $1,250 | $6,250 |  20  | Delete  | <- highlighted
+------+----------+----------+-----------+--------+--------+------+---------+
| REVERSING 2 of 3 positions (1 ours, 1 unknown)                             |
+------+----------+----------+-----------+--------+--------+------+---------+
```

- **Ours checkbox**: Marks your company's position on this merchant
- **Include checkbox**: Only shown for external positions (not ours)
- **Unknown badge**: Shown when balance is null
- **Highlighted row**: "Our" positions have a distinct background/border

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/types/calculation.ts` | Change `balance: number` to `balance: number \| null` |
| `src/pages/Index.tsx` | Add Ours column, show all positions, handle unknown balance UI, update calculations |
| `src/lib/exportUtils.ts` | Handle null balance in exports (show "Unknown") |

---

### Summary

1. Add "Ours" checkbox column to mark your company's positions
2. Show all positions in table (our positions highlighted with border)
3. "Include" checkbox only appears for external (non-ours) positions
4. Allow clearing balance input to set as "Unknown" (null)
5. Display "Unknown" badge for null balances
6. Exclude unknown balances from calculations
7. Update footer to show position breakdown (reversing X, Y ours, Z unknown)

