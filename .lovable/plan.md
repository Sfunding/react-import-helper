

## Fix: Move Advance Amount to Deal Summary

### The Problem
The Advance Amount was incorrectly added as a column in the positions table. Based on your reference images, you want it as a **single field in the Deal Summary section** - similar to how "Total Funding" is displayed prominently.

---

### What Will Change

| Current (Wrong) | Fixed (Correct) |
|-----------------|-----------------|
| "Advance" column in positions table | Single "Advance Amount" in Deal Summary |
| Each position has its own advance input | One advance amount for the entire deal |
| Shows in positions table footer | Shows in Deal Summary like your reference |

---

### How It Should Work

The Deal Summary will show these key metrics in a prominent header style (like your reference image with the blue background):

| Metric | Description |
|--------|-------------|
| **Advance Amount** | Editable - controls daily debit calculations |
| Factor Rate | The rate multiplier |
| Total Payback | Advance Amount x Factor Rate |
| Payment | New daily payment amount |
| Number of Debits | Days to payoff |

When you adjust the Advance Amount, the confirmation dialog will still appear showing the before/after impact.

---

### Technical Changes

#### File: `src/types/calculation.ts`
- Remove `advanceAmount` field from the `Position` type
- No longer needed per-position

#### File: `src/pages/Index.tsx`

**Change 1: Remove the Advance column from positions table**
- Remove the "Advance" header column (lines 893-907)
- Remove the advance input cell from each position row (lines 940-958)  
- Remove the advance total from the footer (line 1000)
- Remove the `handleAdvanceChange` function that handles per-position changes

**Change 2: Add Advance Amount to Settings or Deal Summary**
- Add a single `advanceAmount` input field in the Deal Summary/Settings area
- This will be an editable field that defaults to `totalBalance` (sum of position balances)
- When changed, triggers the confirmation dialog

**Change 3: Update calculations**
- `totalAdvanceAmount` will come from this single settings value instead of summing per-position
- The rest of the calculations (Total Funding, RTR, daily debits) remain the same but use this single value

**Change 4: Add Deal Summary Header**
Create a prominent "Deal Summary" section styled like your reference (blue header with key metrics):
- Advance Amount (editable with confirmation)
- Factor Rate
- Total Payback (RTR)
- Payment (new daily)
- Number of Debits (days)

---

#### File: `src/lib/exportUtils.ts`
- Remove per-position advance amount references
- Use the single advance amount from settings

---

### Visual Result

Your Deal Summary will look similar to your reference image:

```text
+------------------------------------------------------------------+
|                        DEAL SUMMARY                               |
|------------------------------------------------------------------|
| Advance Amount | Factor Rate | Total Payback | Payment | # Debits |
|    $954,031    |    1.45     | $1,383,345    | $9,970  |   139    |
+------------------------------------------------------------------+
```

The "Advance Amount" will be editable (with confirmation prompt on change), while the other fields calculate automatically.

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/types/calculation.ts` | Remove `advanceAmount` from Position type |
| `src/pages/Index.tsx` | Remove position-level advance column, add single Advance Amount to Deal Summary |
| `src/lib/exportUtils.ts` | Update to use single advance amount |

---

### Summary

1. Remove the "Advance" column from the positions table entirely
2. Add a single, prominent "Advance Amount" field in the Deal Summary section
3. Style it like your reference image with key deal metrics in a header row
4. Keep the confirmation dialog when the advance amount is changed
5. The advance amount still drives the daily debit/RTR calculations, but now it's a deal-level field, not per-position

