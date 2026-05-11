
## Deal Lab — embedded scenario planning per deal

Rename "Leverage" to **Deal Lab** and stop treating it as a separate destination. Every deal opens its own Lab pre-loaded with that merchant's positions, revenue, and stack. The Scenario Builder timeline switches to real calendar dates so you can say "this Friday, give him a straight" and "4 weeks from then, reverse him."

### 1. Routing & navigation

- New route: `/deal/:id/lab` → renders the current `Leverage.tsx` logic but locked to one calculation.
- Remove the standalone `/leverage` route and the global "Leverage" nav link in `Navbar.tsx`.
- On the calculator (`Index.tsx`), the existing Leverage button becomes **"Open Deal Lab"** and navigates to `/deal/{currentCalcId}/lab`.
  - If the deal has unsaved changes → trigger the existing unsaved-changes flow first (save, then navigate), so the Lab always reads the latest persisted state.
  - If the deal has never been saved → button is disabled with tooltip "Save the deal first to open the Lab."
- Add a back link in the Lab header: "← Back to {Merchant Name}" returns to `/` with the deal loaded.

### 2. Deal Lab page (replaces current Leverage page)

A trimmed `DealLab.tsx`:

- Reads `:id` from the URL via `useParams`, fetches the calc from `useCalculations`, and **removes** the deal-picker dropdown / "select a deal" state entirely.
- Header shows merchant name, monthly revenue, current total balance, current daily debits, current leverage/burden badges — sourced automatically from the loaded deal.
- Keeps two tabs: **Compare** (Reverse / Straight / Hybrid side-by-side, unchanged math) and **Scenario Builder** (the timeline).
- Save-to-deal and PDF export buttons stay; the manual-revenue fallback input is removed (revenue always comes from the deal).

### 3. Scenario Builder → calendar dates

Currently steps are positioned by relative weeks (`runAtWeek`, `weeks`). We move to absolute dates while keeping the math engine identical:

- Each step gets a `runOn: string` (ISO date) instead of (or alongside) week offsets. Internally, the engine converts `runOn` → business-day offset from "today" before calling `runScenario`.
- Step cards (`StepCard.tsx`) get a shadcn `<Popover>` + `<Calendar>` date picker labelled e.g. "Fund on" / "Reverse on" / "Wait until". Default smart-snaps to the next Friday when the step is added.
- `WaitStep` is replaced/augmented: instead of "wait N weeks," the next step's date implicitly defines the gap. We keep `WaitStep` for backward compat but hide it from the "Add step" menu; existing saved scenarios still render.
- Checkpoint table and exposure timeline display real dates ("Fri, Nov 14") next to the existing week-offset column.
- "Add step" menu copy updated: "Straight MCA on…", "Reverse on…", "Recurring program starting…", "Add outside position on…".

### 4. Naming sweep

- Nav link, button labels, page titles, PDF export titles: `Leverage → Deal Lab`.
- File renames: `src/pages/Leverage.tsx` → `src/pages/DealLab.tsx`. `leverageMath.ts` stays (internal module, no user-visible name).
- Update `App.tsx` route, `Navbar.tsx` (remove link), the calculator's Leverage button label, and any leftover copy in `StepCard.tsx` / `ScenarioSparkline.tsx`.

### 5. Data model

No schema changes. `recommended_scenario` jsonb already stores the full `Scenario` object — we just add the optional `runOn` field per step. Old scenarios without `runOn` fall back to their existing `runAtWeek`/`weeks` values, so saved deals keep working.

### Files to touch

```text
src/App.tsx                                — swap /leverage route for /deal/:id/lab
src/components/Navbar.tsx                  — remove Leverage nav link
src/pages/Index.tsx                        — rename button, navigate to /deal/:id/lab, guard on unsaved/never-saved
src/pages/Leverage.tsx → src/pages/DealLab.tsx
                                             — read :id, drop picker, drop manual-revenue input,
                                               update titles, add "Back to deal" link
src/lib/scenarioTypes.ts                   — add optional runOn?: string to step types
src/lib/leverageMath.ts                    — runScenario: convert runOn → business-day offset
src/components/leverage/StepCard.tsx       — date picker per step, hide WaitStep from add menu,
                                               relabel actions
src/components/leverage/ScenarioSparkline.tsx — render date labels along x-axis
```

### Out of scope
- No changes to the Reverse / Straight / Hybrid math itself.
- No multi-deal Lab (e.g. comparing two merchants) — explicitly one deal per Lab page.
- No new database tables; `recommended_scenario` keeps holding everything.
