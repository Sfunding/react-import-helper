## Goal

Add a new top-level **Leverage Analyzer** page that takes the merchant's current stack (balances, daily debits, monthly revenue) and shows side-by-side scenarios for bringing leverage down — including a **Straight MCA now + Reverse later** option that lets you pick when the reverse kicks in (e.g. after specific positions fall off).

## New route

`/leverage` — top-level page, added to navbar next to Saved Calculations.

Inputs are pre-filled from the active deal on `/` (positions, monthly revenue, settings) but fully editable on the page so a user can model "what if".

## Leverage metric (shown on every scenario)

Two ratios side-by-side, before and after:

| Ratio | Formula |
|---|---|
| **Balance Leverage** | total open MCA balance ÷ monthly revenue |
| **Payment Burden** | total daily debits ÷ (monthly revenue ÷ 22) |

A small color band (green / amber / red) classifies each: <0.5 / 0.5–1.0 / >1.0 for balance; <15% / 15–30% / >30% for burden.

## Scenarios compared

Three cards rendered side-by-side (stacked on mobile):

### 1. Reverse Consolidation (today's tool)
Pulled straight from the active deal on `/`. Shows post-deal balance leverage and payment burden the day the reverse starts and on the day all consolidated positions fall off.

### 2. Straight MCA Payoff
We give a new advance that pays off selected positions in full on day 1 (no daily clip back from the merchant — it's a standard MCA with its own daily).

User controls per scenario:
- **Which positions to pay off** (checkbox list — defaults to top-cost positions)
- **New advance factor rate** (default 1.49)
- **Term in months** (default 6)
- **Origination fee %** (default 9%)

Outputs:
- Cash to merchant (advance − payoffs − fees)
- New daily payment on the MCA
- Net daily debit change (old debits removed + new MCA daily)
- Balance leverage & payment burden, today

### 3. Straight MCA Now → Reverse Later (the new idea)
Phase 1: straight MCA exactly like scenario 2. Phase 2: at a user-chosen trigger, switch into a reverse consolidation on whatever stack remains.

Trigger options (radio):
- **Fixed date** — date picker
- **After N positions fall off** — pick which ones, computed via existing payoff date logic
- **When payment burden drops below X%** — auto-detect from simulated cash flow

The page simulates the timeline day-by-day and reports:
- Day-1 leverage / burden (right after straight MCA)
- Trigger-day leverage / burden (what the reverse starts on top of)
- Post-reverse-falloff leverage / burden (clean slate)
- Total cash to merchant across both phases
- Total profit to us across both phases

## Recommendation banner

At the top: a green "Recommended" badge on the scenario with the lowest **post-deal payment burden** that still delivers positive cash to merchant. User can click "Use this scenario" on any other card to override the recommendation. The chosen scenario is saved to the deal record (new `recommended_scenario` JSONB column) so it persists.

## Output

- On-screen comparison view (interactive sliders + inputs)
- "Export comparison" button → reuses the existing `MerchantProposalPDF` renderer with a new 1-page comparison layout showing all three scenarios in a table

## Files

| File | Change |
|---|---|
| `src/App.tsx` | Add `/leverage` route, guarded by `AuthGuard`. |
| `src/components/Navbar.tsx` | Add "Leverage Analyzer" link. |
| `src/pages/Leverage.tsx` | **New.** Page shell + state, pulls active deal from a shared store or query string. |
| `src/components/leverage/LeverageMetrics.tsx` | **New.** The two-ratio card with color bands. |
| `src/components/leverage/ScenarioReverse.tsx` | **New.** Read-only card sourced from the existing reverse calc engine. |
| `src/components/leverage/ScenarioStraightMCA.tsx` | **New.** Editable inputs, computes payoff math. |
| `src/components/leverage/ScenarioHybrid.tsx` | **New.** Straight-now-reverse-later with trigger picker. |
| `src/lib/leverageMath.ts` | **New.** Pure helpers: `balanceLeverage`, `paymentBurden`, `simulateStraightMCA`, `simulateHybrid` (reuses existing payoff-date helpers from `dateUtils`/`exportUtils`). |
| `src/components/pdf/LeverageComparisonPDF.tsx` | **New.** 1-page PDF for the comparison export. |
| Migration | Add `recommended_scenario JSONB` column on `saved_calculations` (nullable). |

## Out of scope (call out, don't build)

- LOC / term-loan style products — only straight MCA + reverse for now.
- Changing the existing reverse engine.
- Multi-merchant portfolio leverage view.
- Auto-pulling external bank/revenue data.

## Open call-outs for after first pass

- Whether to surface the recommendation on the main `/` page too (small badge on Merchant's Offer).
- Whether saved scenarios should be shareable via the existing `deal_shares` flow.
