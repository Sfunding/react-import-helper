

## Fix: Cash to Merchant Calculation Bug

### The Problem
The "CASH TO MERCHANT" banner on Page 1 is showing $99,229 incorrectly. This amount is actually the origination fee, not cash going to the merchant.

The bug is on line 1680 of `src/lib/exportUtils.ts`:
```
cashToMerchant = metrics.totalFunding - metrics.totalBalance
```

- `totalFunding` = position balances grossed up by the fee (e.g. $1,000,000 / 0.91 = $1,098,901)
- `totalBalance` = sum of position balances ($1,000,000)
- Result: $98,901 = the origination fee, NOT cash to merchant

### The Fix

**File: `src/lib/exportUtils.ts` (line 1680)**

Change to:
```
const netAdvance = metrics.totalFunding * (1 - settings.feePercent);
const cashToMerchant = Math.max(0, netAdvance - metrics.totalBalance);
```

In a pure buyout scenario (no extra cash), `netAdvance` equals `totalBalance`, so `cashToMerchant = 0` and the banner won't appear.

The banner will only show when the deal genuinely includes extra cash to the merchant beyond what's needed to pay off positions.

### No other files need changes
The `MerchantProposalPDF.tsx` component already conditionally renders the banner only when `cashToMerchant > 0`, so once the value is correct, the banner will simply disappear for pure buyout deals.
