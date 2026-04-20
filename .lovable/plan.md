

## Redesign Current Positions Table

### What's Wrong Today

Too many columns crammed into one row: Ours, Include, Entity, Freq, Pull Day, Funded Date, Amount Funded, Balance, Daily, Weekly, Days Left, Last Payment, Actions = **13 columns**. Even at wide viewports it's noisy, and "Funded Date" / "Amount Funded" eat the most space while being used rarely.

### The Plan

**1. Remove rarely-used columns from the main row**
- Remove **Funded Date** column
- Remove **Amount Funded** column
- Remove the "discrepancy" warning UI tied to those fields (Expected balance, sync 🔄 button) -- it only exists to compare manual balance vs. calculated-from-funded-date

These fields stay on the `Position` type for backward compatibility with already-saved deals, but the UI no longer surfaces them. The auto-populate effect that fills balance from `fundedDate + amountFunded` is removed too, since the inputs are gone.

**2. Tighter main row -- 9 columns instead of 13**

| Ours | Include | Entity | Schedule | Balance | Daily | Weekly | Days Left / Last Pay | Actions |

- **Schedule** combines Freq + Pull Day into one cell. Default shows "Daily". When toggled to weekly, it becomes a compact pill: `Weekly · Mon ▾` with the day editable inline.
- **Days Left / Last Pay** stacks the two values vertically in one column (they're related and short).
- **Entity** column gets `min-w-[260px]` so long names like "Mask C Consolidation" never clip.

**3. Row layout improvements**
- Increase row vertical padding (`py-3`) so inputs breathe
- "Ours" + "Include" become a single narrower column with two stacked checkboxes labeled `O` / `I` (saves ~80px)
- Remove the inline `?` "mark unknown" and `🔄` sync buttons -- move "mark unknown" into the row's Actions menu (3-dot dropdown) alongside Delete

**4. Actions cell -> dropdown menu**
Replace the bare delete button with a small `⋯` dropdown containing: **Mark balance unknown**, **Delete position**. Cleaner and leaves room for future actions.

### File Changes

**`src/pages/Index.tsx`**
- Remove `<th>` for Funded Date and Amount Funded
- Remove the corresponding `<td>` cells in the row map
- Remove the discrepancy detection block (`expectedBalance`, `hasDiscrepancy`, sync button, warning row)
- Remove the `useEffect` that auto-fills balance from `fundedDate + amountFunded` (lines ~266-280)
- Combine Freq + Pull Day cells into one "Schedule" cell with conditional inline day picker
- Combine Ours + Include into one stacked-checkbox cell
- Combine Days Left + Last Payment into one stacked cell
- Replace delete `<button>` with a `DropdownMenu` (Mark unknown / Delete)
- Remove unused imports: `CalendarIcon`, `Calendar`, `Popover`, `PopoverContent`, `PopoverTrigger`, `calculateRemainingBalance`, `TooltipProvider/Tooltip` if no longer used elsewhere in this section

**`src/types/calculation.ts`**
- No changes. `fundedDate` and `amountFunded` stay as optional fields so existing saved deals don't break (the DB JSONB still has them; we just don't render inputs).

### Result

A clean, scannable 9-column table where the most-used fields (Entity, Balance, Daily, Days Left) get the room they deserve, and the rare fields are gone from view.

