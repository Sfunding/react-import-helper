

## Plan: Early Pay Options (EPO) Feature

### Overview

Add an Early Pay Options feature that allows configuring discount tiers for merchants who pay off their balance early. The EPO section will appear below the settings row when enabled, and will display on the Merchant's Offer tab showing what discounts they can earn.

---

### How Early Pay Options Work

The concept: After all the positions being consolidated fall off (are fully paid), if the merchant pays the remaining RTR balance within X days, they receive a discount on the remaining balance.

**Example EPO Tiers:**
- Pay within 30 days after positions fall off: 10% discount on remaining balance
- Pay within 60 days after positions fall off: 7% discount on remaining balance
- Pay within 90 days after positions fall off: 5% discount on remaining balance

---

### Technical Changes

#### File: `src/types/calculation.ts`

**Add new types for EPO:**

```typescript
export type EarlyPayTier = {
  id: number;
  daysAfterFalloff: number;  // Days after all positions fall off
  discountPercent: number;   // Discount on remaining balance
};

export type EarlyPaySettings = {
  enabled: boolean;
  tiers: EarlyPayTier[];
};

export const DEFAULT_EPO_SETTINGS: EarlyPaySettings = {
  enabled: false,
  tiers: [
    { id: 1, daysAfterFalloff: 30, discountPercent: 0.10 },
    { id: 2, daysAfterFalloff: 60, discountPercent: 0.07 },
    { id: 3, daysAfterFalloff: 90, discountPercent: 0.05 },
  ]
};
```

**Update Settings type:**

```typescript
export type Settings = {
  dailyPaymentDecrease: number;
  feeSchedule: string;
  feePercent: number;
  rate: number;
  brokerCommission: number;
  newMoney: number;
  currentExposure: number;
  earlyPayOptions: EarlyPaySettings;  // NEW
};
```

---

#### File: `src/pages/Index.tsx`

**Change 1: Add EPO to state initialization**

Update `DEFAULT_SETTINGS` import and initialize with EPO defaults.

**Change 2: Add EPO dropdown and configuration box below settings row (after line ~910)**

Below the existing settings grid, add:

```
┌─────────────────────────────────────────────────────────────────┐
│  [Discount %] [Fee Schedule] [Fee %] [Rate] [Broker] [New $]    │
├─────────────────────────────────────────────────────────────────┤
│  Early Pay Options:  [ No ▼ ]                                   │
│                                                                 │
│  (When "Yes" selected, shows:)                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  EARLY PAYOFF DISCOUNT TIERS                                ││
│  │  ┌─────────────────────────────────────────────────────────┐││
│  │  │ Days After Positions Fall Off │ Discount on Balance     │││
│  │  │ 30 days                        │ 10%                     │││
│  │  │ 60 days                        │ 7%                      │││
│  │  │ 90 days                        │ 5%                      │││
│  │  └─────────────────────────────────────────────────────────┘││
│  │  [+ Add Tier]                                               ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

UI Elements:
- Dropdown: "Early Pay Options: [No / Yes]"
- When "Yes": Show editable tier table
- Each tier has: Days input, Discount % input, Delete button
- Add Tier button to add more tiers

**Change 3: Calculate EPO values based on schedule**

After positions fall off (determined by when the last included position reaches 0 balance based on days left), calculate:
- Day when all positions fall off
- Remaining RTR balance at that point
- For each tier: payoff deadline (falloff day + tier days) and discounted amount

**Change 4: Update Merchant's Offer tab to show EPO section**

After the "Deal Terms" section, add (only if EPO is enabled):

```
┌─────────────────────────────────────────────────────────────────┐
│  💸 EARLY PAYOFF OPTIONS 💸                                     │
│                                                                 │
│  Once all your consolidated positions have been paid off,      │
│  you can save even more by paying off your balance early:      │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ PAY BY           │ REMAINING BALANCE │ YOU SAVE            ││
│  │ Day 45 (30 days) │ $85,000           │ $8,500 (10% off)    ││
│  │ Day 75 (60 days) │ $91,000           │ $6,370 (7% off)     ││
│  │ Day 105 (90 days)│ $95,000           │ $4,750 (5% off)     ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  * Days shown are business days from deal start                 │
└─────────────────────────────────────────────────────────────────┘
```

---

#### File: `src/lib/exportUtils.ts`

**Update `exportMerchantPDF` to include EPO section**

When EPO is enabled, add a section to the PDF showing:
- "Early Payoff Options" header
- Explanation of how it works
- Table of tiers with dates, amounts, and savings

---

### Calculation Logic

1. **Find when positions fall off:**
   - Look at all included positions
   - Find the maximum `daysLeft` value (when the last position is paid off)
   - This is the "falloff day"

2. **Calculate remaining RTR balance at falloff:**
   - Use the existing `dailySchedule` to find `rtrBalance` at the falloff day
   - If falloff day > schedule length, use the last day's balance

3. **For each EPO tier, calculate:**
   - Payoff deadline = falloff day + tier.daysAfterFalloff
   - RTR balance at deadline = find from schedule or extrapolate
   - Discounted payoff = balance * (1 - tier.discountPercent)
   - Savings = balance - discounted payoff

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/types/calculation.ts` | Add `EarlyPayTier`, `EarlyPaySettings` types, `DEFAULT_EPO_SETTINGS`, update `Settings` type and `DEFAULT_SETTINGS` |
| `src/pages/Index.tsx` | Add EPO dropdown below settings, EPO tier editor UI, EPO calculations, EPO section in Merchant's Offer tab |
| `src/lib/exportUtils.ts` | Update `exportMerchantPDF` to include EPO section when enabled |

---

### Summary

1. **EPO toggle dropdown** - "Early Pay Options: Yes/No" appears below the settings row (Discount, Fee, Rate, Broker, New Money)
2. **Tier configuration** - When enabled, shows editable table of discount tiers (days after falloff + discount %)
3. **Automatic calculations** - Calculates when positions fall off, remaining balances at each tier deadline, and savings amounts
4. **Merchant's Offer display** - Shows EPO options prominently with clear deadlines and savings
5. **PDF export** - Includes EPO information in the merchant-facing PDF

