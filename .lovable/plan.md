

## Plan: Fix Advance Amount & Net to Merchant Definitions

### Current Problem

There's inconsistency in how "Advance Amount" is displayed:
- **Header Bar**: Shows `$620,499.00` (which is `totalAdvanceAmount` = position balances + new money)
- **Offer Tab**: Shows `$667,203.23` (which is `totalFunding` = gross including fees)

### User's Requirements

| Term | Definition | Current Variable | Value |
|------|------------|------------------|-------|
| **Advance Amount** | Gross contract amount (includes fees) | `totalFunding` | $667,203.23 |
| **Net to Merchant** | Position balances + New Money (what merchant actually receives) | `totalAdvanceAmount` | $620,499.00 |

The "Net to Merchant" is calculated as: Balances to positions being reversed + $125K New Money = $620,499

---

### Technical Changes

**File: `src/pages/Index.tsx`**

**Change 1: Update Header Bar (lines 1082-1094)**

Change the "Advance Amount" display in the header to show `totalFunding` (gross) instead of `totalAdvanceAmount`:

```typescript
// Current (line 1093)
{fmt(totalAdvanceAmount)}

// Change to
{fmt(totalFunding)}
```

Also update the tooltip text to reflect the gross definition.

**Change 2: Add "Net to Merchant" to Header Bar (after line 1095)**

Add a new metric box showing "Net to Merchant" with `totalAdvanceAmount`:

```typescript
<div className="bg-primary-foreground/10 rounded-lg p-3 text-center">
  <div className="text-xs text-primary-foreground/80 font-medium uppercase mb-1">Net to Merchant</div>
  <div className="text-2xl font-bold text-primary-foreground">{fmt(totalAdvanceAmount)}</div>
</div>
```

**Change 3: Fix # of Debits in Offer Tab (line 1578)**

The Offer tab currently calculates debits differently than the header. Update to use `totalDays` for consistency:

```typescript
// Current
{newDailyPayment > 0 ? Math.ceil((totalFunding * settings.rate) / newDailyPayment) : 0}

// Change to
{totalDays}
```

**Change 4: Update "Net Funding" label in Offer Tab (line 1581)**

Change the label from "Net Funding" to "Net to Merchant" for clarity:

```typescript
// Current row headers
['Orig Fee', 'ORG Amount', 'Net Funding', 'Financing Cost', 'Our Profit']

// Change to
['Orig Fee', 'ORG Amount', 'Net to Merchant', 'Financing Cost', 'Our Profit']
```

---

### Updated Layout

**Header Bar (after changes):**
```text
┌──────────────────┬───────────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│ Advance Amount   │ Net to Merchant   │ Factor Rate  │ Total Payback│ Daily Payment│ # of Debits  │
│ $667,203.23      │ $620,499.00       │ 1.499        │ $1,000,137   │ $8,480       │ 118          │
│ (Gross w/ fees)  │ (Positions + New$)│              │              │              │              │
└──────────────────┴───────────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

**Offer Tab Deal Summary (unchanged values, consistent):**
```text
Row 1: Advance Amount = $667,203.23 (matches header)
       # of Debits = 118 (matches header)

Row 2: Net to Merchant = $620,499.00 (matches header)
```

---

### Summary

| Location | Change |
|----------|--------|
| Line 1093 | Change `{fmt(totalAdvanceAmount)}` to `{fmt(totalFunding)}` |
| After Line 1095 | Add new "Net to Merchant" metric showing `totalAdvanceAmount` |
| Line 1578 | Change calculation to `{totalDays}` |
| Line 1581 | Rename "Net Funding" to "Net to Merchant" |
| Line 1088 | Update tooltip to describe gross amount |

After these changes:
- **Advance Amount** = $667,203.23 (gross, includes fees) - same everywhere
- **Net to Merchant** = $620,499.00 (what merchant gets: balances + $125K)
- **# of Debits** = 118 (consistent from schedule simulation)

