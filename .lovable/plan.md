## Goal
Make saved deal loading reliable by removing the fragile `sessionStorage -> /` handoff, and restructure the app so `/` is a dashboard instead of the calculator.

## Proposed routing
- `/` = new homepage dashboard.
- `/deal/new` = new unsaved calculation.
- `/deal/:id` = saved calculation editor.
- Existing `/saved` can remain as the full saved-deals library/list view.
- Existing `/deal/:id/lab` remains Deal Lab.

## Dashboard homepage
Build a dashboard at `/` with:
- Portfolio KPI cards: total deals, total balances, total daily payments, funded count / recent activity.
- Recent deals list sorted by `updated_at`.
- Pinned/favorite area using local pinned IDs first, with a database-backed favorite table as a later enhancement if desired.
- Quick actions: New Calculation, Saved Library, Settings for admins.

## Reliable saved-deal loading fix
Replace the current saved-deal loading mechanism:
- Stop writing full deals into `sessionStorage.loadCalculation` and navigating back to `/`.
- When a saved deal is opened, route directly to `/deal/:id`.
- The calculator page reads `id` from the route and fetches that calculation by ID from the existing cached/queried saved calculations.
- While loading, show a stable loading state instead of rendering a new blank calculator.
- If the deal is not found after loading, show an error and return to dashboard or saved library.
- Clear local draft only when intentionally starting `/deal/new` or when the user discards it, not during saved-deal route hydration.

## Calculator refactor
Update `Index.tsx` into a route-aware calculator editor:
- Use `useParams` to determine `new` vs saved deal.
- Add a `hydrateCalculation(calc)` helper to populate merchant/settings/positions/as-of date/parent metadata.
- Add a guard ref so hydration runs once per deal ID and does not get overwritten by draft restore or auto-save.
- Disable draft-restore prompts for saved deal routes during initial hydration.
- Make `New Calculation` reset state and navigate to `/deal/new`.
- Save behavior:
  - `/deal/new` creates a row, then navigates to `/deal/:newId`.
  - `/deal/:id` updates that row.

## Browser-style in-app tabs
Add an app-level open-calculation tabs bar:
- Store open tabs in localStorage, keyed by deal ID plus a special `new` tab.
- Opening a saved deal adds/activates a tab and navigates to `/deal/:id`.
- `/deal/new` opens/activates the New Calculation tab.
- Tabs display deal name/merchant name, close buttons, and active state.
- Closing the active tab routes to another open deal tab, `/deal/new`, or dashboard if no deal tabs remain.
- The tabs bar appears on dashboard/calculator/saved pages so users can switch deals without relying on browser tabs.

## Update existing navigation points
- `SavedCalculations.handleLoad` routes to `/deal/:id` instead of `sessionStorage + /`.
- Navbar Calculator link routes to dashboard `/`, with a separate New Calculation action to `/deal/new`.
- Deal Lab “Back to calculator” routes to `/deal/:id`.
- Scenario commit routes to the newly created child deal at `/deal/:id`.
- Parent breadcrumb opens `/deal/:parentId` instead of using `sessionStorage` and reloading.

## Technical notes
- No database schema change is required for the first version.
- This change is mainly in routing/components/state management:
  - `src/App.tsx`
  - `src/pages/Index.tsx`
  - `src/pages/SavedCalculations.tsx`
  - `src/pages/DealLab.tsx`
  - `src/components/Navbar.tsx`
  - new dashboard/tabs helper components/hooks as needed
- The current root cause is still the old architecture: a saved deal briefly hydrates from `sessionStorage`, then local draft/blank calculator state can win during navigation/render timing. Dedicated deal URLs remove that entire class of bugs.

## Validation
- Open a saved calculation from `/saved`; URL becomes `/deal/:id` and stays loaded.
- Refresh `/deal/:id`; the same deal reloads correctly.
- Open multiple saved deals; each appears in the in-app tab bar and switches cleanly.
- Open `/deal/new`; it never overwrites an existing saved deal tab.
- Save a new calculation; URL changes from `/deal/new` to `/deal/:id`.
- Deal Lab and committed scenarios return to the correct deal URL.