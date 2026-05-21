
## Problem

The Excel export's `calculateSchedules` in `src/lib/exportUtils.ts` does not read `settings.reverseCadence`. In weekly mode the calculator stores the **weekly clip** in `dailyPaymentOverride` and the **# of weekly clips** in `termDays` (per the Weekly Reverse Cadence design). The export blindly treats both as daily values, which is why the screenshot shows:

- "New Daily Payment $857,261" (actually the weekly clip)
- "New Weekly Payment $4,286,304" (= weekly_clip × 5 — nonsense)
- "Daily Savings -$611,824" / "Weekly Savings -$3,059,118" (current daily minus weekly clip — meaningless)
- "# of Debits 40" labeled as days when it should be 40 weekly clips

## Fix

### 1. Make `calculateSchedules` cadence-aware (`src/lib/exportUtils.ts` lines 86–118)

Mirror the Index.tsx math:

```ts
const cadenceWeekly = settings.reverseCadence === 'weekly';
const includedClip = cadenceWeekly ? includedDailyPayment * 5 : includedDailyPayment;

let newClip: number;       // weekly clip OR daily payment depending on mode
let termCount: number;     // weekly clips OR daily debits

if (settings.dailyPaymentOverride !== null && settings.dailyPaymentOverride > 0) {
  newClip = settings.dailyPaymentOverride;
  termCount = newClip > 0 ? Math.ceil(basePayback / newClip) : 0;
} else if (settings.termDays !== null && settings.termDays > 0) {
  termCount = settings.termDays;
  newClip = termCount > 0 ? basePayback / termCount : 0;
} else {
  newClip = includedClip * (1 - settings.dailyPaymentDecrease);
  termCount = newClip > 0 ? Math.ceil(basePayback / newClip) : 0;
}

const newDailyPayment   = cadenceWeekly ? newClip / 5 : newClip;
const newWeeklyPayment  = cadenceWeekly ? newClip     : newClip * 5;
const numberOfDebits    = termCount;                       // clips OR daily debits
const numberOfDailyDebits = cadenceWeekly ? termCount * 5 : termCount;

const impliedDiscount = includedClip > 0 ? 1 - (newClip / includedClip) : 0;

const dailySavings   = (includedDailyPayment) - newDailyPayment;
const weeklySavings  = dailySavings * 5;
const monthlySavings = dailySavings * 22;
```

The schedule loop already only debits on Mondays via `isPayDay`. In weekly mode the outflow `dailyWithdrawal` must also fire only on the pay day and pull the full `newWeeklyPayment` (capped). Replace the current single-line `dailyWithdrawal = min(newDailyPayment, rtrBeforeDebit)` with:

```ts
let dailyWithdrawal = 0;
if (!debitsComplete && rtrBeforeDebit > 0) {
  if (cadenceWeekly) {
    if (isPayDay) dailyWithdrawal = Math.min(newWeeklyPayment, rtrBeforeDebit);
  } else {
    dailyWithdrawal = Math.min(newDailyPayment, rtrBeforeDebit);
  }
}
```

Return both `newDailyPayment`, `newWeeklyPayment`, `numberOfDebits` (clips when weekly), and `numberOfDailyDebits` (raw day count) from `metrics`, plus expose `cadenceWeekly`.

### 2. Summary tab labels (`exportToExcel` ~lines 262–296)

In weekly mode, rebuild the NEW PAYMENT TERMS + TIMELINE blocks:

- Title rows in weekly mode:
  - `New Weekly Payment` first, `New Daily Equivalent` second (instead of "New Daily Payment" first).
  - `Payment Reduction` keeps the implied discount (now correctly computed against the weekly clip).
- SAVINGS unchanged (numbers now correct because `dailySavings` is recomputed).
- TIMELINE in weekly mode:
  - `# of Weekly Clips` = `metrics.numberOfDebits`
  - `Weeks to Payoff` = `metrics.numberOfDebits` (not `/5`)
  - Add `# of Daily Debits (simulation)` = `metrics.numberOfDailyDebits` for reference.

In daily mode the existing labels stay.

### 3. Offer Details tab (~lines 408–416)

`# of Debits (simulation)` already exists. Make it always show `numberOfDailyDebits` (the raw schedule day count) so the underlying simulation is auditable in both modes.

### 4. Positions tab (no change to math)

The per-position `isWeekly` flag (line 316) is independent of reverse cadence and already correct for showing each funder's frequency.

## Out of scope

- PDF (`exportToPDF`) cadence handling — separate pass if requested.
- DealLab / ScenarioBuilder exports.
- Changing persisted field names.

## Files touched

- `src/lib/exportUtils.ts` (only)
