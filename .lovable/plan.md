## Goal

Page 2 of the Merchant Proposal PDF (Positions & Payoff Schedule) currently shows position payments as **daily only**. Honor the export dialog's Payment View setting on Page 2 so weekly payments appear alongside (or instead of) daily.

## What changes

Page 2 has two tables that show per-position payment amounts:

1. **Positions Being Consolidated** — columns: Funder | Current Balance | Daily Payment
2. **Position Payoff Timeline** — columns: Funder | Balance | Daily Payment | Days to Payoff | Paid Off By

Both will respect `opts.paymentView`:

| Mode | Payment column(s) |
|---|---|
| Daily | `Daily Payment` only (today's behavior) |
| Weekly | `Weekly Payment` only — value = `dailyPayment × 5` |
| Both (default) | `Daily Payment` **and** `Weekly Payment` side-by-side |

The TOTAL row at the bottom of "Positions Being Consolidated" gets the same treatment (sum of dailies, sum of weeklies).

In Both mode the two tables get an extra column; flex weights will be re-balanced so nothing clips. In Weekly-only mode the existing Daily column is simply relabeled and recomputed (no width change).

A small italic note — *"Weekly = daily × 5 business days."* — is added under the first table when weekly is shown, to keep the math transparent.

## Files

| File | Change |
|---|---|
| `src/components/pdf/MerchantProposalPDF.tsx` | In `Page2Positions`, read `opts.paymentView` (same pattern used on Page 1). Conditionally render Daily and/or Weekly payment columns and totals on both tables. Adjust `flex` weights for the Both case. Add small caption under the first table when weekly is shown. |

## Out of scope

- Page 1, Page 3, Page 4 — already honor Payment View.
- Visual Payoff Timeline bar / "ALL POSITIONS CLEAR" banner — unchanged.
- App UI (Merchant's Offer tab) — unchanged.
- The default Payment View stays **Both**.
