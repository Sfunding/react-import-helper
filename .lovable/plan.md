## Goal

Make the funding/anchor day actually matter: (1) reprice weekly positions accurately based on their pull day, (2) add a floating "Deal Structuring" helper bubble that recommends the merchant move every debit to the funding day, and (3) flag positions whose pull day doesn't match the anchor.

---

## 1. Pull-day-aware repricing (`src/lib/dateUtils.ts`)

Today `repricedBalance` does `days * dailyPayment` for both daily and weekly positions. That's wrong for weekly: a weekly merchant only drops by one weekly clip when the as-of date crosses their `weeklyPullDay`.

Change: when `p.frequency === 'weekly'` and `p.weeklyPullDay` is set, count how many of that weekday occur strictly between the anchor date and the new as-of date (signed; negative when rolling backward). Decrement balance by `count * dailyPayment * 5` (one weekly clip per occurrence). Daily-frequency positions keep current behavior.

Add helper `countWeekdayOccurrencesBetween(from, to, weekdayName)` next to the other date utils.

Apply this to both `repricedBalance` and `calculateRemainingBalance` so the auto-calculated balance on the position card also respects pull day.

## 2. Anchor day = the as-of / funding date

Treat `asOfDate` as the anchor. Derive `anchorWeekday` (Mon–Fri) from it. Weekend dates fall back to the nearest business day for the suggestion. No new field needed.

## 3. Mismatch warning on positions (`src/pages/Index.tsx`)

In the positions list, for each weekly position where `weeklyPullDay !== anchorWeekday`, render a small amber badge next to the pull-day select: "Pulls {day} — anchor is {anchorDay}". Reuses existing badge tokens; no layout shift.

## 4. Floating "Deal Structuring" helper bubble

New component `src/components/DealStructureHelper.tsx`. Fixed bottom-right button (icon: `Lightbulb` from lucide). Click opens a `Popover` panel anchored bottom-right with:

- **Anchor day**: shows the derived weekday from `asOfDate` and a one-line explanation: "Fund on {date} ({weekday}). Recommend the merchant move every weekly debit to {weekday} so all positions clip together with our wire."
- **Mismatch list**: bullets each weekly position whose pull day ≠ anchor weekday ("Funder A pulls Tuesday → move to Wednesday").
- **Daily reminder**: short note when any daily positions exist ("Daily debits will continue every business day — no move needed.").
- **Empty state**: when everything aligns, a green check + "All weekly debits are aligned with your funding day."

Non-destructive — read-only suggestions. No auto-mutation of `weeklyPullDay`.

Mount once inside `src/pages/Index.tsx` so it only appears on the calculator route. Hide when no positions exist.

## 5. Verification

- Move `asOfDate` forward across a Wednesday with a weekly-Wed position → balance drops by exactly one weekly clip (5 × daily).
- Move it forward by 3 business days that don't include the pull day → weekly balance unchanged; daily balance drops by 3 × daily.
- Move date backward across the pull day → weekly balance grows by one clip.
- Floating bubble lists mismatches accurately; clears to green state when all weekly `pullDay` match the anchor weekday.

## Out of scope

- No edits to `leverageMath.ts`, scenario engine, PDF export, or schedule simulation (those already model the post-funding world where everything pulls on the anchor day).
- No auto-rewrite of `weeklyPullDay`; user keeps full control.
- No new DB columns.