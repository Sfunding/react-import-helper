

## Plan: Fix PDF Emoji/Special Character Rendering

### Problem Identified

The Merchant PDF export shows garbled characters (`Ø=Ü°` instead of 💰, and `&` instead of ★) because jsPDF's default Helvetica font doesn't support Unicode emoji or special characters.

**Affected Lines in `src/lib/exportUtils.ts`:**
- Line 735: `doc.text('💰  YOUR SAVINGS  💰', ...)`
- Line 788: `doc.text('★ MONTHLY ★', ...)`

---

### Solution

Replace emoji and special Unicode characters with plain text alternatives that render correctly in PDF:

| Current | Replacement |
|---------|-------------|
| `💰  YOUR SAVINGS  💰` | `YOUR SAVINGS` |
| `★ MONTHLY ★` | `** MONTHLY **` or just `MONTHLY` with visual emphasis |

To make the savings section still stand out without emoji, we'll use:
1. **Larger font size** for the header
2. **Visual emphasis** through styling (the green background already provides strong emphasis)
3. **Text-based accents** like `***` or `---` if needed

---

### Technical Changes

**File: `src/lib/exportUtils.ts`**

**Change 1: Remove emoji from savings header (line 735)**

```typescript
// Before
doc.text('💰  YOUR SAVINGS  💰', pageWidth / 2, currentY + 12, { align: 'center' });

// After  
doc.text('YOUR SAVINGS', pageWidth / 2, currentY + 12, { align: 'center' });
```

**Change 2: Replace star symbols in monthly label (line 788)**

```typescript
// Before
doc.text('★ MONTHLY ★', monthlyX + savingsColWidth/2, innerY + 12, { align: 'center' });

// After
doc.text('MONTHLY', monthlyX + savingsColWidth/2, innerY + 12, { align: 'center' });
```

The visual hierarchy is already established by:
- Green gradient background on the savings section
- Larger font size (18pt) for the monthly amount vs 16pt for daily/weekly
- Border emphasis around the monthly box
- Bold text styling

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/lib/exportUtils.ts` | Replace emoji characters on lines 735 and 788 with plain text equivalents |

---

### Summary

1. Remove `💰` emoji from "YOUR SAVINGS" header - replace with plain text
2. Remove `★` symbols from "MONTHLY" label - the border and styling already provide emphasis
3. The visual hierarchy remains intact through colors, font sizes, and box styling

