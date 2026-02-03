
## Plan: Remove "New Money" Feature

Since your system does not support adding extra cash on top of position consolidations, we'll remove this feature entirely from the application.

---

### What This Feature Did

The "New Money" feature allowed adding additional cash to the merchant on Day 1, on top of paying off their existing positions. It was factored into:
- Total Advance Amount calculations
- Day 1 cash infusion in payment schedules  
- Breakdown dialogs
- Excel and PDF exports
- The Merchant's Offer tab display

---

### Files to Change

| File | Changes |
|------|---------|
| `src/types/calculation.ts` | Remove `newMoney` from Settings type and DEFAULT_SETTINGS |
| `src/pages/Index.tsx` | Remove New Money input field, related logic, and conditional UI displays |
| `src/lib/exportUtils.ts` | Remove New Money from calculations and exports |
| `src/components/ScheduleBreakdownDialog.tsx` | Remove New Money display section |

---

### Technical Details

**1. `src/types/calculation.ts`**
- Remove `newMoney: number;` from the `Settings` type (line 13)
- Remove `newMoney: 0,` from `DEFAULT_SETTINGS` (line 85)
- Remove `newMoney: number;` from `ScheduleBreakdown` type (line 93)

**2. `src/pages/Index.tsx`**
- **Line 80**: Remove `settings.newMoney > 0` from unsaved changes check
- **Line 173**: Change `totalAdvanceAmount` to just use `includedBalance` (no + newMoney)
- **Lines 232-237**: Remove the `useEffect` that auto-forces Average fees when New Money exists
- **Line 256**: Remove `&& settings.newMoney === 0` from early return condition
- **Line 275**: Remove `if (day === 1) cashInfusion = settings.newMoney;` 
- **Lines 355-357**: Remove adding new money on day 1 in breakdown
- **Lines 384-386**: Remove adding new money on week 1 in breakdown
- **Line 432**: Remove `&& settings.newMoney === 0` check
- **Line 451**: Remove adding new money on day 1 in discount calculation
- **Lines 906-914**: Remove disabled state and message for Upfront fees related to New Money
- **Lines 946-969**: Remove the entire New Money input field section
- **Lines 1783-1789**: Remove "Cash You Receive on Day 1" display in Merchant's Offer tab
- **Line 1951**: Pass `newMoney={0}` instead of `settings.newMoney`

**3. `src/lib/exportUtils.ts`**
- **Line 59**: Change `totalAdvanceAmount = includedBalance + settings.newMoney` to just `includedBalance`
- **Line 134**: Remove adding newMoney to cash infusion on day 1
- **Line 267**: Remove New Money row from Excel summary
- **Line 500**: Remove New Money from PDF summary table
- **Lines 847-851**: Remove conditional New Money display in PDF export

**4. `src/components/ScheduleBreakdownDialog.tsx`**
- **Line 28**: Remove `newMoney` prop
- **Line 65**: Remove `hasNewMoney` calculation
- **Lines 81-94**: Remove the "New Money" entry display section
- **Line 163**: Update explanation text to remove mention of New Money

---

### Result After Changes

- The "New Money" input field will be completely removed from the settings panel
- All calculations will be based purely on existing position consolidation
- Exports (Excel/PDF) will no longer include New Money references
- The codebase will be cleaner and focused on your actual use case

