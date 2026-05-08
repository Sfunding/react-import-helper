## Goal

Right now the Merchant's Offer tab and PDF lean heavily on **daily** numbers. Add a "Payment View" control so we can show **Daily / Weekly / Both** for both Old (current) and New (Avion) payments — in the app and in the PDF — and make the **New Debits** view explicitly call out that funding goes out *weekly* while debits come back *daily*.

## What changes

### 1. New "Payment View" toggle (app)

On the Merchant's Offer tab, add a small segmented control near the top-right ("Payment View: Daily | Weekly | Both", default **Both**). Persisted to `localStorage` under `merchantOfferPaymentView:v1`.

It controls the rendering of:

- **Old Payment** card (red box, top-left of the comparison)
- **New Payment** card (green box, top-right) — relabeled as **"New Debits"**
- **Your Savings** highlighted block (Daily / Weekly / Monthly cards)
- The **Without vs With Consolidation** mini-cards downstream (consistent)

Behavior per mode:

| Mode | Old Payment | New Debits | Savings cards |
|---|---|---|---|
| Daily | `$X/day` only | `$X/day` only | Daily + Monthly |
| Weekly | `$X/week` only | `$X/week` (debits) + `$X/week funded in` callout | Weekly + Monthly |
| Both | `$X/day` + `$X/week` (current) | `$X/day debited` + `$X/week debited` + `$X/week funded in` | Daily + Weekly + Monthly (current) |

### 2. "New Debits" framing — funding vs. debits

The New Payment card becomes **"New Debits"** with a small subtitle: *"We fund you weekly, debit you daily."* In Weekly and Both modes it shows two distinct lines:

- **Debited:** `$X/day` and/or `$X/week` (= daily × 5)
- **Funded in:** `$Y/week` (the weekly clip = `cashInfusion` from the schedule, averaged or first-week — see Technical)

This makes clear the merchant pays daily but receives a weekly clip.

### 3. PDF Export Options dialog

In `ExportOptionsDialog.tsx`, add a new section **"Payment View"** above the page sections, with a 3-way radio:

- Daily only
- Weekly only
- Both (default)

Stored in `MerchantPDFOptions` as `paymentView: 'daily' | 'weekly' | 'both'` and persisted with the rest of the export options. Defaults to **Both**.

### 4. PDF rendering

- **Page 1 — Old/New cards**: respect `paymentView`. In Weekly/Both, the New card adds the "Funded weekly: $Y" line.
- **Page 1 — Your Savings strip**: Daily card hidden in Weekly mode; Weekly card hidden in Daily mode; Monthly always visible. Consolidation card unchanged.
- **Page 4 — Without vs With Consolidation**: same daily/weekly/monthly visibility rules as Page 1.
- **Page 3 — Weekly Cash Flow** table: unchanged (it's already weekly).

The Old/New card subtitle on Page 1 also gets the *"We fund you weekly, debit you daily."* line in Weekly/Both modes.

## Files

| File | Change |
|---|---|
| `src/pages/Index.tsx` | Add `paymentView` state + segmented control in the Merchant's Offer tab header. Conditionally render daily/weekly lines on Old Payment, New Debits, Savings block. Compute `weeklyFundingClip` from `dailySchedule` (first non-zero `cashInfusion`) and pass to PDF + display. |
| `src/components/pdf/ExportOptionsDialog.tsx` | Add `paymentView: 'daily' \| 'weekly' \| 'both'` to `MerchantPDFOptions` (default `'both'`). Render a radio group at the top of the dialog. Update default + storage merge. |
| `src/components/pdf/MerchantProposalPDF.tsx` | Read `opts.paymentView`. Update Page 1 Old/New cards, Page 1 "Your Savings" strip, and Page 4 Without/With cards to honor it. Add `weeklyFundingClip: number` to `PDFProps` and render the "Funded weekly: $Y" line on the New card in Weekly/Both. |
| `src/lib/exportUtils.ts` | Pass the computed `weeklyFundingClip` through to `MerchantProposalPDF` props. |

## Technical notes

- `weeklyFundingClip` = the weekly cash infusion the merchant receives. Use `dailySchedule[0].cashInfusion` (first payday's clip) as the representative number; it equals the sum of 5 daily debits the merchant *would have paid* the prior week. If the schedule is empty, fall back to `totalCurrentDailyPayment * 5`.
- All weekly amounts use the existing convention: `daily × 5` (5 business days/week, per project memory).
- Default behavior with no user interaction = **Both**, so existing exports look the same except for the added "Funded weekly" line on the New card.
- "New Payment" label changes to **"New Debits"** in both UI and PDF — this is intentional and reinforces the framing.

## Out of scope

- The Daily/Weekly internal calculator tabs (`'daily'`, `'weekly'`) — unchanged.
- Excel and internal cash report exports — unchanged.
- Cash Buildup section — unchanged (already weekly-oriented).
