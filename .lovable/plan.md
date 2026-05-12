The Week/Day Breakdown side panel (`ScheduleBreakdownDialog`) overflows the viewport when there are many positions (e.g., 22 funders), but the panel itself doesn't scroll — so the bottom entries and Total row are unreachable.

Fix:
- In `src/components/ScheduleBreakdownDialog.tsx`, make `SheetContent` a flex column with full height and hidden overflow, and wrap the inner content area in a scrollable container so the list, Total, RTR breakdown, and explanation can all be reached.
  - `SheetContent` className: add `flex flex-col h-full overflow-hidden`.
  - Keep `SheetHeader` non-scrolling at the top.
  - Wrap the `mt-6 space-y-4` content block in a `flex-1 overflow-y-auto pr-2` div (or use the existing `ScrollArea` component) so the entries list scrolls independently.

Acceptance:
- Opening Week 8 Breakdown with 22 positions shows a scrollbar inside the panel; user can scroll to see every funder, the Total Cash Infusion row, the RTR Calculation card (Day/Week 1), and the explanation.
- Header stays pinned at the top while scrolling.
- No changes to math or data — purely a layout/scroll fix.
