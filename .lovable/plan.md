
## Fix: Discount Percentage Input Not Working

### The Problem
The Discount % number input is broken because of a conflicting controlled component implementation:

- The input has `value={(settings.dailyPaymentDecrease * 100).toFixed(0)}` making it controlled
- BUT `onChange={e => {}}` does nothing, preventing the user from actually changing the displayed value
- When `onBlur` fires, the input value hasn't changed, so `handleDiscountChange` is never triggered

The slider works correctly because it properly calls `handleDiscountChange` on each change.

---

### Solution
Convert the number input to properly allow typing while still triggering the confirmation dialog. We need to:

1. Track a local "editing" value while the user types
2. Only trigger the confirmation dialog on blur (when they finish editing)
3. Reset the local value when the dialog is cancelled

---

### Technical Changes

#### File: `src/pages/Index.tsx`

**Change 1: Add local state for discount input**
Add a local state variable to track the discount value while editing:

```typescript
const [discountInputValue, setDiscountInputValue] = useState<string>('');
```

Initialize it from settings and sync when settings change.

**Change 2: Update the discount number input**
Replace the current broken input with one that:
- Uses local state for the displayed value (allowing typing)
- Updates local state on `onChange` (so typing works)
- Triggers confirmation dialog on `onBlur` (when user finishes editing)
- Resets to the actual value if the dialog is cancelled

**Change 3: Update cancelChange function**
When the user cancels the confirmation dialog, reset the input value back to the current settings value.

---

### Code Changes

| Location | Current | Fixed |
|----------|---------|-------|
| Line 726 | `value={(settings.dailyPaymentDecrease * 100).toFixed(0)}` | Use local `discountInputValue` state |
| Line 733 | `onChange={e => {}}` | `onChange={e => setDiscountInputValue(e.target.value)}` |
| Line 735 | `key={settings.dailyPaymentDecrease}` | Remove - no longer needed |
| Cancel handler | Just close dialog | Also reset `discountInputValue` to current value |

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Index.tsx` | Add local state for discount input, fix onChange handler, sync state on cancel |

---

### Summary

1. Add `discountInputValue` local state to track what the user is typing
2. Allow `onChange` to update local state so typing works
3. Trigger `handleDiscountChange` on blur with the typed value
4. Reset local state to actual value when dialog is cancelled
5. Sync local state when `settings.dailyPaymentDecrease` changes externally

This will allow the user to type a new discount value, see the confirmation dialog with the impact, and either confirm or cancel the change.
