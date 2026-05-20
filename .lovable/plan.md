# Plan: Weekly-Cadence Reverse Deals

Today the reverse is hard-wired to daily debits — internally everything is stored as `dailyPayment` and the simulation clips Mon–Fri. We need to let a deal be structured as **weekly** so the merchant only gets pulled once per week (on the funding/anchor weekday), with the term, summary, and exports speaking in weeks instead of days.

## 1. Data model

Extend `Settings` in `src/types/calculation.ts`:

- `reverseCadence: 'daily' | 'weekly'` (default `'daily'`).
- Repurpose existing override fields without breaking persistence:
  - `termDays` still stores the user-entered term, but it is interpreted as **# of weekly clips** when `reverseCadence === 'weekly'`.
  - `dailyPaymentOverride` still stores the user-entered payment; in weekly mode it is the **weekly clip amount**.
  - (No rename to avoid breaking saved calculations; we add JSDoc and an internal `termUnit` helper instead.)

## 2. Settings UI (`src/pages/Index.tsx`, Settings Section ~line 1287)

Add a small `Daily | Weekly` segmented control at the top of the Settings block labeled "Reverse Cadence". When toggled:

- Relabel the two editable inputs:
  - Daily mode → "Term (Debits)" + "Daily Payment" (today's behavior).
  - Weekly mode → "Term (Weeks)" + "Weekly Payment".
- Discount % label stays, but its tooltip/SP line switches to weekly basis (`payment * 52 / 12` ≈ monthly burden, or simply `weeklyPayment * 4.33`).
- Switching cadence does **not** wipe the override; we convert: daily→weekly multiplies the payment by 5 and divides the term by 5 (round up), and the reverse on the way back. Show a confirmation toast so the user knows the conversion happened.

## 3. Math (`src/pages/Index.tsx` ~line 429)

Introduce a derived `cadenceMultiplier` (1 for daily, 5 for weekly — i.e. one weekly clip equals five business days of dailyPayment-equivalent).

- `basePayback` stays anchored to `totalFunding × factorRate` (unchanged — this is a Core rule).
- Replace the three-branch payment/term derivation with a cadence-aware version:
  - In weekly mode: `newWeeklyPayment` is the primary variable; `newDailyPayment = newWeeklyPayment / 5` is kept for downstream compatibility (SP, monthly savings, etc. already use the `daily × 5 / × 22` constants from Core rules).
  - Term is `# of weekly clips = ceil(basePayback / newWeeklyPayment)`.
- Discount % default in weekly mode compares `includedWeeklyPayment` (= `includedDailyPayment × 5`) against `newWeeklyPayment`.
- Savings widgets keep computing daily/weekly/monthly correctly because `newDailyPayment` stays consistent.

## 4. Schedule simulation (`dailySchedule` memo ~line 487)

The current loop already only debits on `isPayDay` (Monday) for the inflow tally. We need to make the *outflow* (`dailyWithdrawal`) also weekly when cadence is weekly:

- Daily mode → unchanged.
- Weekly mode → only debit on the anchor weekday (derived from `asOfDate`, matching `DealStructureHelper`'s rollover-to-Monday rule), and pull `min(newWeeklyPayment, rtrBeforeDebit)` on that day.
- Final day capping rule from the Position-Payoff-Capping memory still applies (last clip can be partial).

`totalDays` for display becomes `totalWeeks = ceil(totalDays / 5)` when shown in weekly contexts; the underlying day-resolution array remains so other widgets keep working.

## 5. Deal Summary / Merchant's Offer

- "New Payment" / "New Debits" card already supports daily/weekly/both via `paymentView`. When `reverseCadence === 'weekly'`, force `paymentView` away from "daily-only" (auto-switch to "weekly", remembered separately), and hide the "/day" subline. Keep the weekly-funding-clip callout on by default.
- Term display: `"{N} weekly debits"` vs current `"{N} daily debits"`.
- Day1SummaryCard and any "X days" copy switches to weeks when weekly.

## 6. Exports (`src/lib/exportUtils.ts`)

- Excel summary tab: add a "Reverse Cadence" cell and swap the `# of Debits (simulation)` label to `# of Weekly Clips` in weekly mode.
- Excel schedule tab: in weekly mode, collapse the day-level rows to one row per anchor-weekday clip (cash infusion accumulated for the week, single outflow on the pull day).
- PDF (Merchant Proposal): use the existing payment-view honoring code; force weekly column visible and hide the "Daily Payment" row when cadence is weekly.

## 7. Deal Structure Helper (`src/components/DealStructureHelper.tsx`)

Currently flags weekly positions whose pull day ≠ anchor weekday. In weekly-reverse mode the message becomes stronger: **every** included position (daily or weekly) needs to be re-papered to the anchor weekday, because the reverse itself only pulls once a week. Update the popover copy to reflect that and list daily positions in the "needs realignment" group when cadence is weekly.

## 8. Persistence / backward compatibility

- Default `reverseCadence` to `'daily'` for any saved calculation lacking the field — no migration required since Settings is JSON.
- PDF/Excel export options dialog gains no new toggle; cadence is intrinsic to the deal.

## Technical Snippet

```ts
// Index.tsx derivation, cadence-aware
const cadenceWeekly = settings.reverseCadence === 'weekly';
const includedClip = cadenceWeekly ? includedDailyPayment * 5 : includedDailyPayment;

let newClip: number;     // weekly clip OR daily payment depending on mode
let termCount: number;   // weekly clips OR daily debits

if (settings.dailyPaymentOverride !== null && settings.dailyPaymentOverride > 0) {
  newClip = settings.dailyPaymentOverride;
  termCount = Math.ceil(basePayback / newClip);
} else if (settings.termDays !== null && settings.termDays > 0) {
  termCount = settings.termDays;
  newClip = basePayback / termCount;
} else {
  newClip = includedClip * (1 - settings.dailyPaymentDecrease);
  termCount = Math.ceil(basePayback / newClip);
}

const newDailyPayment = cadenceWeekly ? newClip / 5 : newClip;
const newWeeklyPayment = cadenceWeekly ? newClip : newClip * 5;
```

## Out of scope

- DealLab / ScenarioBuilder — keeps its own cadence selectors per step.
- Changing the factor-rate or fee math.
- Renaming the persisted `dailyPaymentOverride` / `termDays` fields.
