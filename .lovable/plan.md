

## Plan: Fix Total Payback Display — Replace Old Formula with Correct Variable

### The Problem

The calculation logic was fixed correctly:
```typescript
const totalPayback = newDailyPayment * calculatedNumberOfDebits;
// 8,664 × 117 = 1,013,688 ✓
```

But the **UI is still using the OLD formula** in 4 places:
```typescript
{fmt(totalFunding * settings.rate)}  // Shows $1,011,008.70 (WRONG!)
```

Instead of:
```typescript
{fmt(totalPayback)}  // Should show $1,013,688 (CORRECT!)
```

---

### Files to Change

**File: `src/pages/Index.tsx`**

| Line | Current Code | New Code |
|------|-------------|----------|
| 1170 | `{fmt(totalFunding * settings.rate)}` | `{fmt(totalPayback)}` |
| 1640 | `{fmt(totalFunding * settings.rate)}` | `{fmt(totalPayback)}` |
| 1653 | `{fmt((totalFunding * settings.rate) - totalFunding)}` | `{fmt(totalPayback - totalFunding)}` |
| 1803 | `{fmt(totalFunding * settings.rate)}` | `{fmt(totalPayback)}` |

---

### Technical Details

**Line 1170** — Summary panel Total Payback:
```tsx
// Before
<div className="text-2xl font-bold text-primary-foreground">{fmt(totalFunding * settings.rate)}</div>

// After  
<div className="text-2xl font-bold text-primary-foreground">{fmt(totalPayback)}</div>
```

**Line 1640** — Grid table Total Payback:
```tsx
// Before
<div className="p-4 text-center text-lg font-bold">{fmt(totalFunding * settings.rate)}</div>

// After
<div className="p-4 text-center text-lg font-bold">{fmt(totalPayback)}</div>
```

**Line 1653** — Financing Cost calculation (Total Payback - Funding):
```tsx
// Before
<div className="p-4 text-center text-lg font-bold">{fmt((totalFunding * settings.rate) - totalFunding)}</div>

// After
<div className="p-4 text-center text-lg font-bold">{fmt(totalPayback - totalFunding)}</div>
```

**Line 1803** — Secondary view Total Payback:
```tsx
// Before
<div className="text-lg font-bold">{fmt(totalFunding * settings.rate)}</div>

// After
<div className="text-lg font-bold">{fmt(totalPayback)}</div>
```

---

### Result After Fix

| Metric | Value | Source |
|--------|-------|--------|
| Daily Payment | $8,664 | User input or derived |
| # of Debits | 117 | User input or derived |
| **Total Payback** | **$1,013,688** | `8,664 × 117` ✓ |

**Math Check:** $8,664 × 117 = $1,013,688 ✓

