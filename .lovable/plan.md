## Goal
Stamp every saved deal with an "as-of date" so balances don't go silently stale. When the deal is reopened, project the stack forward to today and use the projected state everywhere downstream.

## Note on scope
The Compare Scenarios tab (Reverse / Straight / Hybrid lenses) was removed in the previous round — Deal Lab now renders only the Scenario Builder. The acceptance line about "Reverse, Straight, Hybrid, and Builder tabs all compute against $95k" is reduced to: **Current Position card + Scenario Builder both compute against the projected stack.**

## Changes

### 1. Schema — migration
- Add `as_of_date date` column on `saved_calculations`, nullable.
- Backfill: `UPDATE saved_calculations SET as_of_date = updated_at::date WHERE as_of_date IS NULL` (closer to "when these numbers were last true" than `created_at`).
- Default for new rows: `DEFAULT (now() AT TIME ZONE 'utc')::date`.

### 2. Types — `src/types/calculation.ts`
- Add `as_of_date: string | null` to `SavedCalculation`.

### 3. Persistence — `src/hooks/useCalculations.ts`
- Extend `saveMutation` and `updateMutation` params with `asOfDate: string` (YYYY-MM-DD); write to `as_of_date`.
- `duplicateMutation`: set `as_of_date` to today (fresh deal).

### 4. Index.tsx — date picker
- New state `asOfDate: string` defaulting to `format(new Date(), 'yyyy-MM-dd')`. When loading a saved deal, hydrate from `calc.as_of_date ?? calc.created_at`.
- Render a small **"Positions as of [date]"** control near merchant info, using shadcn `Popover` + `Calendar` with `pointer-events-auto`.
- Pass through to `saveCalculation` / `updateCalculation`. Include in dirty-state hash.

### 5. Engine helper — `src/lib/leverageMath.ts`
```ts
export function projectStackToDate(
  positions: Position[],
  asOfDate: string,
  viewDate: string
): Position[]
```
- Use `getBusinessDaysBetween` from `src/lib/dateUtils.ts`.
- If `viewDate <= asOfDate` → return clone unchanged.
- Per position: `paid = dailyPayment * businessDays`; `newBalance = max(0, balance - paid)`; if `newBalance === 0` set `dailyPayment = 0`.
- Skip positions with `balance == null` (unknown) — leave as-is.
- Weekly-frequency positions (`frequency === 'weekly'`): leave untouched in v1 (with `// TODO weekly projection` note).

### 6. Deal Lab header — `src/pages/DealLab.tsx`
- Read `selectedCalc.as_of_date` (fallback to `created_at::date`).
- `projectedPositions = useMemo(() => projectStackToDate(positions, asOf, today), …)`.
- In the "Current Position" card show:
  - Line 1: `As of {asOf}: ${storedBalance} balance / ${storedDaily}/day`
  - Line 2 (only when `businessDays > 0`): `Projected to today ({N} business days later): ${projBalance} / ${projDaily}/day`
  - Below the projected line, list any position with `frequency === 'weekly'` with a small muted tag `(weekly — not projected)` so the v1 gap reads as intentional, not a bug.

### 7. Plumbing — `src/pages/DealLab.tsx`
- Feed `projectedPositions` into `runScenario(...)` (Scenario Builder) and into `stackTotals` / `snapshot` for the Current Position metrics so leverage bands reflect today.
- Auto-saved scenario steps unaffected (steps store deltas, not absolute balances).

## Out of scope
- `fundedDate` / `amountFunded` per-position auto-balance logic.
- Position entry UI, summary view, scenario step UI.
- Weekly-frequency projection.

## Acceptance
- Saved deals carry an `as_of_date` (today on new save; `updated_at::date` for legacy rows).
- Index shows a "Positions as of …" date picker defaulting to today; chosen date persists.
- Deal saved 5 business days ago with $100k @ $1,000/day → Current Position card shows stored ($100k / $1,000) and projected ($95k / $1,000); Scenario Builder runs against $95k.
- When `as_of_date == today`, only the stored line shows.
- Weekly-frequency positions render with the `(weekly — not projected)` tag under the projected line.
