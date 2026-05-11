## Bug
The "Back to {merchant}" link in the Deal Lab header is a plain `<Link to="/">`. The home route (`Index.tsx`) only loads a specific deal into the calculator when `sessionStorage.loadCalculation` is set (the same mechanism `SavedCalculations.handleLoad` uses). Because the Deal Lab back link doesn't set that key, hitting it lands the user on a fresh, blank calculator — not the deal they were just leveraging.

## Fix

Replace the back `<Link>` in `src/pages/DealLab.tsx` (around lines 655–661) with a button that:

1. Builds the same `loadCalculation` payload `SavedCalculations.handleLoad` builds, but from `selectedCalc`:
   ```ts
   sessionStorage.setItem('loadCalculation', JSON.stringify({
     id: selectedCalc.id,
     name: selectedCalc.name,
     merchant: {
       name: selectedCalc.merchant_name || '',
       businessType: selectedCalc.merchant_business_type || '',
       monthlyRevenue: selectedCalc.merchant_monthly_revenue || 0,
     },
     settings: selectedCalc.settings,
     positions: selectedCalc.positions,
     funded_at: (selectedCalc as any).funded_at || null,
   }));
   navigate('/');
   ```
2. Falls back to a plain `navigate('/')` if `selectedCalc` isn't loaded yet (rare — the page already redirects in that case).
3. Keeps the existing visual treatment (small muted link with `ArrowLeft` icon and "Back to {merchant_name}" label).

## Out of scope
- The Navbar "Calculator" link will still go to a blank `/` — that's intentional global nav. Only the in-context "Back to {merchant}" affordance is fixed.
- No changes to scenario persistence; scenarios were already saved in `deal_scenarios` and will still be there on return to the lab.

## Acceptance
- Open a deal → click Leverage → land on Deal Lab → click "Back to {merchant}" → calculator opens with that merchant's data pre-loaded, exactly like clicking the deal from Saved Calculations.