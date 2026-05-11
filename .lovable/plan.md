
# Recurring Straight Program → Projected Reverse

## What you'll be able to do

On the Leverage page → **Scenario Builder** tab, add a single new step type that captures the exact workflow you described:

**Step: "Recurring Straight Program"**
- Number of straights (e.g. **7**)
- Cadence between them (e.g. **every 1 week**)
- Amount per straight (e.g. **$1,000,000**)
- Factor rate, fee %, term (weeks)
- Daily vs weekly cadence
- (No payoffs — these are **pure cash infusions**, per your call. Each adds a new straight-RTR position alongside everything else.)

Then add a single **Reverse** step with a **"Run reverse at week N"** input. The engine fast-forwards all originals + all 7 straight-RTRs to week N, then runs the reverse.

The Reverse step gets a checkbox list of what's still alive at week N — originals + each of the 7 straight RTRs that hasn't paid out — so you can **toggle which to consolidate** (your "include/exclude straights" answer).

## What the output looks like

Right under the program step, an inline **infusion ladder** table shows each of the 7 straights:
- Week fired, RTR added, daily debit added, balance remaining at week N

A new **"State at Week N (pre-reverse)"** panel shows:
- Projected total balance across all surviving positions
- Projected total daily / weekly debit (this is the scary number — 7 straights stacked = big weekly debit)
- Per-position table with balance + daily as of week N

Then the **Reverse step output** shows the new reverse against that projected stack:
- Total funding (gross), payback, new daily, new term
- Cash to merchant after paying off selected positions
- Final leverage / burden / peak exposure across the entire timeline

The existing sparkline picks up every infusion as a bump and the reverse as the drop.

## Technical details

**New step kind** in `scenarioTypes.ts`:
```
RecurringStraightStep = {
  kind: 'recurring-straight',
  count, cadenceWeeks, amountEach,
  factorRate, feePercent, termWeeks, paymentCadence
}
```

**Engine change** in `leverageMath.ts` → `runScenario`:
- When a `recurring-straight` step is hit, the simulator loops `count` times:
  - At sub-step `i`: advance clock `cadenceWeeks * 5` business days (so balances decay between infusions), then spawn a new `straight-rtr` ActivePosition with id `straight-<stepId>-<i>`, balance = `amount * factor`, daily = `(amount * factor) / (termWeeks * 5)`, entity = `Straight #i`.
  - Emits one micro-checkpoint per infusion so the sparkline and ladder render every week.
- The clock ends at `count * cadenceWeeks` weeks after the step starts.

**Reverse step gets a `runAtWeek?: number` field.** If set, the engine inserts an implicit wait so the reverse runs at that absolute week offset. The reverse's included-positions list auto-includes all surviving positions at that moment (user can uncheck any).

**StepCard.tsx**: new `RecurringStraightEditor` with the inputs above, plus a read-only mini-table of the 7 infusion rows (week, RTR, daily). The existing `ReverseEditor` gets a "Run at week" input.

**Persistence**: still `recommended_scenario` jsonb on `saved_calculations` — no migration. The new step kind is just additional discriminant.

## Files touched

| File | Change |
|---|---|
| `src/lib/scenarioTypes.ts` | Add `RecurringStraightStep`, extend `ScenarioStep` union, add `runAtWeek?` to `ReverseStep`, update `makeStep('recurring-straight')` defaults (count=7, cadence=1, amount=1_000_000, factor=1.35, fee=0.05, term=15). |
| `src/lib/leverageMath.ts` | Extend `runScenario` to handle `recurring-straight` (loop + advance + spawn) and `reverse.runAtWeek` (implicit wait). |
| `src/components/leverage/StepCard.tsx` | New `RecurringStraightEditor` + infusion ladder table. Update `ReverseEditor` with "Run at week N" field and surface surviving-position list at that week. |
| `src/pages/Leverage.tsx` | Add menu item **"+ Add step → Recurring Straight Program"**. Display the new pre-reverse projected state panel. |
| `.lovable/plan.md` | Replace with this plan. |

## Out of scope

- Straights that pay off existing positions (we agreed: pure infusions only).
- Different factor/fee/term per infusion within the program — all 7 share the same terms. (Workaround: add multiple recurring-straight steps.)
- Optimization ("what week minimizes peak exposure?") — pure deterministic projection.

## After implementation

Smoke test your exact example: stack of N positions → Recurring Straight (7 × $1M, weekly, 1.35, 5%, 15-week term) → Reverse at week 10. Confirm:
- 7 straight-RTRs appear in the projected-state table.
- Balances at week 10 = each RTR's balance after `(10 - fireWeek) * 5` business days of decay (until paid off).
- Reverse totals match hand calc against that projected stack.
