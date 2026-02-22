

## Fix: PDF Layout and Savings Sign Formatting

### Problems Found

1. **Page 2 is wasted space**: The Deal Terms table overflows from page 1 onto page 2, leaving page 2 with just a tiny table and nothing else. This happens because page 1 has too much vertical padding (large payment boxes, savings section, "Position Buyout Only" label all take up space before the deal terms).

2. **"+-$27,960" bug**: Line 2047 in exportUtils.ts always prepends `+` to the weekly savings: `+${fmtNoDecimals(w.savings)}`. When savings are negative, `fmtNoDecimals` already includes the `-` sign, so it renders as `+-$27,960`.

3. **5 pages instead of 4**: Because of the overflow, we get 5 pages instead of the planned 4.

### The Fix

**File: `src/lib/exportUtils.ts`**

**Fix 1 -- Tighten Page 1 spacing** to keep Deal Terms on the same page:
- Reduce payment comparison box height from 45 to 38
- Reduce savings section height from 70 to 60
- Reduce "Position Buyout Only" box height from 40 to 30
- Reduce spacing gaps between sections (10 to 8, 25 to 18, 15 to 10, etc.)
- This should save ~40px, enough to keep the Deal Terms table on page 1

**Fix 2 -- Fix the weekly savings sign** (line 2047):
- Replace `+${fmtNoDecimals(w.savings)}` with conditional logic:
  - If savings >= 0: `+$33,044`
  - If savings < 0: `-$27,960`
- Also apply proper red coloring for negative rows in the table styling

**Fix 3 -- Color negative cumulative savings red** in the table (column 4):
- Currently column 4 is always green. Use `didParseCell` hook to check the value and set red text for negative cumulative savings rows.

### Result
- 4-page PDF as originally planned (Deal Terms stays on page 1)
- No more "+-" formatting glitch
- Negative savings show correctly with proper sign and color
