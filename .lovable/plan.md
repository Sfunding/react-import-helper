## Goal
Strip the top "Compare Scenarios" tab from Deal Lab so the page lands directly on the Scenario Builder. Keep all math/types intact in case we bring it back later.

## Changes — `src/pages/DealLab.tsx`

1. **Remove the tab shell** (lines ~799–1179): delete the `<Tabs>` wrapper, the `<TabsList>`, the `<TabsContent value="compare">` block (the three Reverse / Straight / Hybrid cards), and the `<TabsContent value="builder">` wrapper. Render the Scenario Builder content directly.
2. **Remove the recommendation banner** (lines ~783–797) and the "Override: …" badge — they only made sense alongside the comparison.
3. **Remove the header actions tied to compare:**
   - "Export Comparison" button (lines ~732–735) and its `exportPDF` handler (CSV/PDF that builds the three-scenario table). The Scenario Builder has its own Export PDF.
   - "Save Selection to Deal" button (lines ~736–738) and `handleSaveChoice` — saving a `chosenScenario` is only meaningful in the comparison view.
4. **Drop now-unused state and memos:**
   - `activeTab` / `setActiveTab`
   - `chosenScenario` / `setChosenScenario`
   - `recommendation`, `winner`
   - `reverseFactor / reverseFeePct / reverseDiscount / reverseIncluded / reverseResult / toggleReverseIncluded`
   - `straightFactor / straightFeePct / straightTermWeeks / straightPayoffs / straightCadence / computedStraightGross / straightResult`
   - `hybrid*` equivalents
   - `trigger` (only used by the hybrid memo, if so)
   - `MetricsBlock`, `Row`, `ScenarioKind` imports/locals if they become unused. Keep anything still referenced by the builder.
5. **Imports cleanup:** remove `Tabs, TabsList, TabsTrigger, TabsContent`, `Download`, `AlertTriangle` (if only used by the compare/banner blocks), `Checkbox`, `Layers` if no longer used. Verify with a final grep before finalizing.

## Out of scope
- No changes to Scenario Builder, auto-save, or scenario tabs.
- No math file changes (`leverageMath.ts` stays — the helpers may still be used by the builder; we only drop the page-level callers).
- "Back to {merchant}" navigation untouched.

## Acceptance
- Opening `/deal/:id/lab` shows only the "Current Position" card followed immediately by the Scenario Builder (with its scenario tabs + Saving pill).
- No "Compare Scenarios" tab, no "Recommended: …" banner, no "Export Comparison" or "Save Selection to Deal" buttons.
- Build passes; no unused-import or dead-state warnings.
