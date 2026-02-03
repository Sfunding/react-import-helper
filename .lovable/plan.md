
## Plan: Remove "New Money" Feature ✅ COMPLETED

The "New Money" feature has been fully removed from the application.

---

### What Was Removed

The "New Money" feature allowed adding additional cash to the merchant on Day 1, on top of paying off their existing positions. It was removed from:
- ✅ Settings type and DEFAULT_SETTINGS in `src/types/calculation.ts`
- ✅ ScheduleBreakdown type (removed newMoney field)
- ✅ All calculation logic in `src/pages/Index.tsx`
- ✅ The input field and related UI in the settings panel
- ✅ Cash infusion calculations for Day 1/Week 1
- ✅ ScheduleBreakdownDialog component props and display
- ✅ Excel export summaries in `src/lib/exportUtils.ts`
- ✅ PDF export displays

---

### Result

- The "New Money" input field is completely removed from the settings panel
- All calculations are based purely on existing position consolidation
- Exports (Excel/PDF) no longer include New Money references
- The codebase is cleaner and focused on the consolidation-only use case
