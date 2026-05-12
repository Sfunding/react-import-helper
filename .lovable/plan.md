## Root cause (confirmed by simulation against your TNB MEELAP REVERSE deal)

The schedule loops compute the last-day payment for each funder like this:

```ts
if (d === p.daysLeft) {
  const remainder = p.balance % p.dailyPayment;
  return sum + (remainder === 0 ? p.dailyPayment : remainder);
}
return sum + p.dailyPayment;
```

That `%` is **floating-point modulo**, and it lies whenever `balance / dailyPayment` is an exact integer in math but not in IEEE‑754. Example from your deal:

- `29064 % 415.2` returns **`7.96e-13`** (not `0`)
- So the code thinks the last day's payment is ~$0 instead of $415.20
- Total paid on that position: 69 × 415.20 = **$28,648.80** instead of **$29,064.00** — short exactly one daily payment

Eight of your 22 included positions hit this case (Gig Harbor FORA, Gig Harbor Avion, TSA rapid, TSA SQ Advance, TSA 1st Merchant, TSA Avion, Cancapital, Forward). Combined shortfall: **$2,986.20**, which is exactly the gap between $841,561.62 (Net to Merchant) and ~$838,575 (sum of weekly Cash Infusion).

The previous fix only ensured the loop didn't exit early — it didn't address this per-position underpayment, so the total still doesn't reconcile.

## Fix

Replace the float-modulo remainder with a deterministic formula that mathematically guarantees `(daysLeft − 1) × dailyPayment + lastPayment === balance`.

```ts
// Last business day for this position
if (d === p.daysLeft) {
  const lastPayment = p.balance - (p.daysLeft - 1) * p.dailyPayment;
  // Clamp to (0, dailyPayment] to absorb tiny float drift either direction
  const safe = Math.min(p.dailyPayment, Math.max(0, lastPayment));
  return sum + safe;
}
return sum + p.dailyPayment;
```

This pays exactly `balance` per position over `daysLeft` business days, with no float-modulo trap.

### Files to update (all 5 occurrences of the same pattern)

1. `src/lib/exportUtils.ts` line 141 — Excel/PDF export schedule
2. `src/pages/Index.tsx` line 404 — main on-screen daily schedule
3. `src/pages/Index.tsx` line 480 — secondary schedule (likely metrics/sim)
4. `src/pages/Index.tsx` line 515 — secondary schedule
5. `src/pages/Index.tsx` line 652 — secondary schedule (PDF/proposal sim)

All five use the identical pattern; the replacement is mechanical.

## Verification

- Re-export Excel for **TNB MEELAP REVERSE**. Sum the **Weekly Cash Infusion** column → should equal **$841,561.62** (within a cent).
- On-screen Daily/Weekly schedule cash-infusion totals should match Net to Merchant.
- Spot-check the 8 affected positions individually: each should now pay its full balance over its `daysLeft`.
- No change to debits, RTR, factor rate, fees, EPO, profit, or any UI metric — this is purely a per-day cash-infusion math fix.

## Out of scope

- No change to factor rate, fee schedule, EPO tiers, RTR, or merchant proposal layout.
- No backend / schema changes.
- No change to `daysLeft` derivation (it's already correct).
