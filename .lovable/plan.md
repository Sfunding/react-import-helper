

## Plan: Improve Number Input UX - Remove Spinners, Add Formatting

### The Problem

All numeric inputs use `type="number"` which shows browser-native increment/decrement arrows (spinners). These are frustrating for entering large dollar amounts like $579,650 or precise values like 1.499.

### The Fix

Two changes:

1. **Hide the spinner arrows** globally via CSS -- keeps `type="number"` for mobile keyboard benefits but removes the visual arrows
2. **Switch position dollar inputs to text with formatting** -- the balance, daily payment, and weekly payment fields will display formatted numbers (e.g., "579,650") and accept plain number input, making large values much easier to read and enter

### Files to Change

| File | Change |
|------|---------|
| `src/index.css` | Add global CSS to hide number input spinners across all browsers |
| `src/pages/Index.tsx` | Switch key dollar-amount inputs from `type="number"` to `type="text"` with `inputMode="decimal"` for mobile keyboard support, and add comma formatting on blur |

### Technical Details

**1. index.css - Global spinner removal**

Add CSS rules to hide spinners for all number inputs:
```css
/* Hide number input spinners */
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type="number"] {
  -moz-appearance: textfield;
}
```

This immediately fixes ALL number inputs (settings fields like Fee %, Rate, Broker %, Term, EPO tiers) without changing their behavior.

**2. Index.tsx - Formatted currency inputs for key fields**

For the main dollar-amount fields (Monthly Revenue, Balance, Amount Funded, Daily Payment, Weekly Payment), switch to `type="text"` with `inputMode="decimal"` so mobile users still get a numeric keyboard.

On focus: strip formatting so the user edits a plain number.
On blur: format with commas (e.g., "579,650.00").
On change: strip non-numeric characters except decimal point, then parse.

This applies to approximately 6 input fields:
- Monthly Revenue
- Amount Funded (per position)
- Balance (per position)
- Daily Payment (per position)
- Weekly Payment (per position)
- Current Exposure

Settings fields (Fee %, Rate, Broker %, Term) keep `type="number"` but lose the spinners via CSS -- these are small values where plain number entry is fine.

### What Improves

| Before | After |
|--------|-------|
| Annoying spinner arrows on every field | No spinners anywhere |
| Raw numbers like "579650" hard to read | Formatted as "579,650" when not editing |
| Desktop and mobile both show spinners | Clean input on both platforms |
| Accidentally scrolling changes values | No scroll-to-change behavior |

