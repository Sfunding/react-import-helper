

## Implement Fee Schedule Logic (Upfront vs Average)

### Overview
Currently the Fee Schedule dropdown ("Average" / "Fee Upfront") is cosmetic only. This plan implements the actual logic so that:

- **Fee Upfront**: The full fee is deducted from the Day 1 cash infusion. The RTR (Return to Repay) on Day 1 is larger because it's calculated on the full funding amount. Net to merchant stays the same.
- **Average**: The fee is spread proportionally across all cash infusions throughout the deal.

---

### How It Works

| Mode | Day 1 Cash Infusion | RTR Calculation | Contract Size |
|------|---------------------|-----------------|---------------|
| **Fee Upfront** | Normal (new money + position payoffs) | RTR = (cumulative cash + FULL fee) x rate | Larger upfront |
| **Average** | Normal (new money + position payoffs) | RTR = (cumulative cash + proportional fee) x rate | Spread out |

**Example with $100,000 total funding and 9% fee ($9,000):**

- **Fee Upfront**: Day 1 RTR includes the full $9,000 fee immediately
- **Average**: If Day 1 infusion is 40% of total, only $3,600 of fee is included in RTR

---

### Technical Implementation

#### File: `src/pages/Index.tsx`

**Change 1: Modify Daily Schedule Calculation (lines 142-186)**

Current logic uses a fixed `originationFee = consolidationFees` that's added to every day's cumulative gross calculation.

New logic:
```text
if (feeSchedule === 'upfront'):
    - Day 1: Add full consolidationFees to cumulativeGross
    - Day 2+: No additional fee added
    
if (feeSchedule === 'average'):
    - Track what proportion of total expected cash has been collected
    - Add proportional fee: (cumulativeNetFunded / totalExpectedCash) x consolidationFees
```

**Change 2: Calculate Total Expected Cash Infusion**

Before the daily loop, calculate the total expected cash infusion (new money + all position daily payments x their remaining days). This is needed for the "average" proportional calculation.

---

#### File: `src/lib/exportUtils.ts`

**Change: Update `calculateSchedules` function (lines 54-102)**

Mirror the same logic changes from Index.tsx so that exports (Excel/PDF) reflect the correct fee schedule behavior.

---

### Visual Indicator

Add a tooltip or helper text to the Fee Schedule dropdown explaining:
- **Fee Upfront**: "Fee collected Day 1 - larger initial contract"
- **Average**: "Fee spread across all cash infusions"

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Index.tsx` | Update dailySchedule calculation to respect feeSchedule setting |
| `src/lib/exportUtils.ts` | Update calculateSchedules to match Index.tsx logic |

---

### Summary

1. Calculate total expected cash infusion before the schedule loop
2. In the daily schedule loop:
   - **Upfront**: Add full fee on Day 1 only
   - **Average**: Add proportional fee based on cash collected so far
3. Update both Index.tsx and exportUtils.ts to keep them in sync
4. Add helpful tooltips to the dropdown options

