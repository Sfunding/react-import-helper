

## Feature 1: Export Without Saving + Weekly/Daily Payment Input

### Overview

Two improvements to streamline the workflow:
1. **Export directly from calculator** - Add Excel and PDF export buttons without requiring a save first
2. **Weekly OR Daily payment input** - Enter either value and auto-calculate the other

---

### Feature 1: Export Without Saving

**The Problem**: Currently you must save a calculation before you can export it to Excel or PDF. This is inefficient when you just want to quickly generate a proposal.

**The Solution**: Add export buttons directly in the calculator header that create a temporary `SavedCalculation` object from the current state and pass it to the existing export functions.

#### Technical Changes

**File: `src/pages/Index.tsx`**

1. **Add a helper function** to create a `SavedCalculation` from current state:
```typescript
const createExportData = (): SavedCalculation => ({
  id: loadedCalculationId || 'temp',
  user_id: 'export',
  name: merchant.name ? `${merchant.name} Consolidation` : 'Consolidation Proposal',
  merchant_name: merchant.name,
  merchant_business_type: merchant.businessType,
  merchant_monthly_revenue: merchant.monthlyRevenue,
  settings,
  positions,
  total_balance: totalBalance,
  total_daily_payment: totalCurrentDailyPayment,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
});
```

2. **Add export buttons** next to the Save button in the header:
```tsx
<div className="flex gap-2">
  <Button variant="outline" onClick={handleNewCalculation}>
    <FilePlus className="w-4 h-4 mr-2" />
    New
  </Button>
  <Button 
    variant="outline" 
    onClick={() => exportToExcel(createExportData())}
    disabled={positions.length === 0}
  >
    <FileSpreadsheet className="w-4 h-4 mr-2" />
    Excel
  </Button>
  <Button 
    variant="outline" 
    onClick={() => exportToPDF(createExportData())}
    disabled={positions.length === 0}
  >
    <FileText className="w-4 h-4 mr-2" />
    PDF
  </Button>
  <Button onClick={() => setSaveDialogOpen(true)}>
    <Save className="w-4 h-4 mr-2" />
    Save
  </Button>
</div>
```

---

### Feature 2: Weekly OR Daily Payment Input

**The Problem**: Currently you can only enter daily payment per position. Sometimes you know the weekly payment amount instead.

**The Solution**: Add a toggle or dual-input that allows entering either daily or weekly payment, with automatic calculation of the other.

#### Technical Approach

**Option A: Add Weekly Payment Column (Recommended)**
Add a "Weekly Payment" column that auto-calculates when daily is entered, and vice versa.

**Option B: Toggle Between Daily/Weekly**
Single input field with a toggle to switch between daily and weekly entry mode.

#### Technical Changes

**File: `src/pages/Index.tsx`**

1. **Add a state for input mode per position** (optional) or just add both columns:
   - Daily Payment column (existing)
   - Weekly Payment column (new, = daily × 5)

2. **Update the positions table** to include both columns with bi-directional sync:

```tsx
// Daily Payment column
<td className="p-2">
  <div className="relative">
    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
    <input 
      type="number" 
      value={p.dailyPayment || ''} 
      onChange={e => updatePosition(p.id, 'dailyPayment', parseFloat(e.target.value) || 0)} 
      placeholder="0.00" 
      className="w-full p-2 pl-5 border border-input rounded-md text-right bg-background"
    />
  </div>
</td>

// Weekly Payment column (NEW)
<td className="p-2">
  <div className="relative">
    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
    <input 
      type="number" 
      value={p.dailyPayment ? (p.dailyPayment * 5) : ''} 
      onChange={e => {
        const weekly = parseFloat(e.target.value) || 0;
        updatePosition(p.id, 'dailyPayment', weekly / 5);
      }} 
      placeholder="0.00" 
      className="w-full p-2 pl-5 border border-input rounded-md text-right bg-background"
    />
  </div>
</td>
```

3. **Update table header** to include both columns:
```tsx
<th className="p-3 text-right border-b-2 border-border font-semibold">Daily</th>
<th className="p-3 text-right border-b-2 border-border font-semibold">Weekly</th>
```

4. **Update table footer** to show both daily and weekly totals.

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Index.tsx` | Add export buttons in header, add weekly payment column to positions table |

---

### UI Preview

**Header with export buttons:**
```text
+--------------------------------------------------+
| Reverse Consolidation Calculator                 |
|                    [New] [Excel] [PDF] [Save]    |
+--------------------------------------------------+
```

**Positions table with both payment columns:**
```text
+--------+----------+---------+--------+--------+------+----------+---------+
|Include | Entity   | Balance | Daily  | Weekly | Days | Last Pay | Actions |
+--------+----------+---------+--------+--------+------+----------+---------+
|  [✓]   | Funder A | $50,000 | $2,500 | $12,500|  20  | Feb 28   | Delete  |
|  [✓]   | Funder B | $30,000 | $1,500 | $7,500 |  20  | Feb 28   | Delete  |
+--------+----------+---------+--------+--------+------+----------+---------+
```

When you enter $2,500 in Daily, Weekly auto-fills to $12,500.
When you enter $12,500 in Weekly, Daily auto-fills to $2,500.

---

### Summary

1. **Export without saving**: Add Excel and PDF buttons in header that export current state directly
2. **Weekly/Daily input**: Add weekly payment column that syncs bi-directionally with daily payment
3. No database changes needed - all UI/logic changes in `src/pages/Index.tsx`

