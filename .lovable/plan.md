

## Improve Current Positions Table

### What Changes

1. **Entity name column** -- Make it wider and show full text. Currently the input is constrained; we'll increase the min-width and allow the text to wrap or use a tooltip on hover for very long names.

2. **New "Frequency" field on Position** -- Add a `frequency` field (`'daily'` | `'weekly'`) and a `weeklyPullDay` field (`'Monday'` | `'Tuesday'` | ... | `'Friday'` | `null`) to the `Position` type. When frequency is "weekly", show a day-of-week selector. When weekly, the "Daily" column shows the per-day equivalent and the "Weekly" column shows the actual weekly pull amount.

### File Changes

**`src/types/calculation.ts`**
- Add `frequency?: 'daily' | 'weekly'` (defaults to `'daily'`)
- Add `weeklyPullDay?: string | null` (e.g. `'Monday'`, only relevant when frequency is `'weekly'`)

**`src/pages/Index.tsx`**
- Widen the Entity column (remove fixed width constraint, set `min-w-[200px]`)
- Add a new "Freq" column after Entity with a small toggle or select (`D` / `W`)
- When "W" is selected, show a day-of-week dropdown (Mon-Fri) in the same cell or an adjacent mini-cell
- Update `addPosition` to include default `frequency: 'daily'` and `weeklyPullDay: null`
- Update `updatePosition` calls for the new fields
- Adjust the daily/weekly payment display logic: if frequency is weekly, the entered value in "Weekly" is the actual pull, and "Daily" shows `weeklyPayment / 5`
- Update footer totals to account for frequency

**Calculations throughout `Index.tsx`**
- Where `dailyPayment` is used for schedule generation, respect the frequency: weekly positions only debit on their specified day, not every day

### No database migration needed
The `positions` field is stored as JSONB in `saved_calculations`, so adding new fields to the Position type is backward-compatible. Existing positions without `frequency` default to `'daily'`.

