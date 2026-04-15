

## "Funded" Status and Live Position Balance Tracking

### The Problem

When you save a deal and fund it (e.g. in February), then come back months later, the position balances are frozen at their saved values. The "Last Payment" and "Days Left" columns are calculated from **today** using those stale balances, so they're wrong -- you can't see which positions are about to fall off.

### Solution

**1. Add a `funded_at` date field to `saved_calculations`**

A new nullable `funded_at` column on the `saved_calculations` table. When null, the deal is "unfunded." When set, it records the date the reverse consolidation was actually funded.

**2. "Mark as Funded" button on Saved Calculations page**

- A new button on each deal card (e.g. a checkmark icon labeled "Funded")
- Clicking it sets `funded_at` to today (or lets you pick a past date like February)
- Once funded, the card shows a green "Funded" badge with the date
- Can be un-funded by admin if needed

**3. When loading a funded deal, auto-adjust position balances**

When a funded deal is loaded into the calculator (via the "Load" button):
- For each position, calculate how many business days have elapsed since `funded_at`
- Subtract `dailyPayment × businessDaysElapsed` from the saved balance
- This gives a **live estimated balance** so "Days Left" and "Last Payment" dates are accurate
- The original saved balance is preserved in the database; the adjustment is applied on load

This reuses the existing `getBusinessDaysBetween` function from `dateUtils.ts`.

### Database Migration

```sql
ALTER TABLE public.saved_calculations
ADD COLUMN funded_at timestamptz DEFAULT NULL;
```

No RLS changes needed -- same policies apply.

### File Changes

| File | Change |
|------|--------|
| `saved_calculations` table | Add `funded_at` column |
| `src/types/calculation.ts` | Add `funded_at?: string \| null` to `SavedCalculation` |
| `src/hooks/useCalculations.ts` | Add `markAsFunded` mutation (updates `funded_at`) |
| `src/pages/SavedCalculations.tsx` | Add "Funded" button, date picker for funding date, "Funded" badge on cards |
| `src/pages/Index.tsx` | On load, if `funded_at` is set, adjust each position's balance by subtracting payments since that date |

### UX Flow

1. User creates and saves a deal as usual
2. When the deal is actually funded, user clicks **"Mark Funded"** on the saved deal card
3. A small dialog asks for the funding date (defaults to today, can backdate)
4. The card now shows a green **"Funded · Feb 15, 2026"** badge
5. When loading the deal later, positions show adjusted balances reflecting payments already made, so Days Left and Last Payment dates are accurate

