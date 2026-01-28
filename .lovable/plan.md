

## Plan: Enhanced Merchant PDF Savings & White Label Support

### Overview

This plan addresses two enhancements:
1. **Enhanced Savings Display in Merchant PDF** - Make savings stand out prominently in the PDF export, matching the visual impact of the Merchant's Offer tab
2. **White Label Capability** - Allow the Merchant PDF to display a custom company name instead of "Avion Funding"

---

### Part 1: Enhanced Savings Display in Merchant PDF

Currently, the Merchant PDF has a small "Your Savings" box that shows daily, weekly, and monthly savings in a compact format. The web UI, however, has a large, gradient-styled section with prominent typography that really emphasizes the savings.

**Changes to `src/lib/exportUtils.ts` - `exportMerchantPDF` function:**

**Current Layout:**
```text
┌───────────────────────┐  ┌───────────────────────┐
│ CASH YOU RECEIVE      │  │ YOUR SAVINGS          │
│ $10,000               │  │ Daily: $1,200         │
│ on Day 1              │  │ Weekly: $6,000        │
│                       │  │ Monthly: $26,400      │
└───────────────────────┘  └───────────────────────┘
```

**Proposed Layout:**
```text
╔═══════════════════════════════════════════════════════════════╗
║                 💰 YOUR SAVINGS 💰                            ║
║                                                               ║
║   ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐     ║
║   │   DAILY     │ │   WEEKLY    │ │     MONTHLY         │     ║
║   │  $1,200     │ │  $6,000     │ │   $26,400           │     ║
║   │  per day    │ │  per week   │ │   per month         │     ║
║   └─────────────┘ └─────────────┘ └─────────────────────┘     ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

           ┌───────────────────────────────┐
           │  CASH YOU RECEIVE ON DAY 1    │
           │        $10,000                │
           └───────────────────────────────┘
```

**Enhancements:**
- Full-width savings section with green gradient background
- Larger font sizes for savings amounts
- Monthly savings emphasized with bold styling and larger box
- "Cash You Receive" moved below savings section
- Better visual hierarchy to draw attention to savings first

---

### Part 2: White Label Capability

Add a `whiteLabelCompany` field that can be set in the settings and will be used in place of "Avion Funding" in the Merchant PDF.

**File: `src/types/calculation.ts`**

Add new type for white label settings:

```typescript
export type Settings = {
  dailyPaymentDecrease: number;
  feeSchedule: string;
  feePercent: number;
  rate: number;
  brokerCommission: number;
  newMoney: number;
  currentExposure: number;
  earlyPayOptions?: EarlyPaySettings;
  whiteLabelCompany?: string;  // NEW - Custom company name for PDF export
};
```

**File: `src/pages/Index.tsx`**

Add white label input field in the settings section (near New Money / Broker Commission):

```text
┌─────────────────────────────────────────────────────────────────┐
│  [Discount %] [Fee Schedule] [Fee %] [Rate] [Broker] [New $]    │
│  Early Pay Options: [No ▼]                                      │
│  White Label Company: [________________________]                │
│                       (Leave blank to use "Avion Funding")      │
└─────────────────────────────────────────────────────────────────┘
```

**File: `src/lib/exportUtils.ts`**

Update `exportMerchantPDF` to use white label company name:

- Replace hardcoded `'AVION FUNDING'` with `settings.whiteLabelCompany || 'AVION FUNDING'`
- Update header text
- Update footer text

---

### Technical Changes Summary

| File | Changes |
|------|---------|
| `src/types/calculation.ts` | Add optional `whiteLabelCompany?: string` to Settings type |
| `src/pages/Index.tsx` | Add white label input field in settings section |
| `src/lib/exportUtils.ts` | 1) Redesign savings section with full-width prominent display, 2) Use `whiteLabelCompany` from settings for company name in PDF header/footer |

---

### Updated PDF Layout

```text
Page 1:
┌─────────────────────────────────────────────────────────────────┐
│  [COMPANY NAME]                          (White label or Avion) │
│  Your Consolidation Offer                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Merchant Name]                                                │
│  Prepared: [Date]                                               │
│                                                                 │
│  ┌───────────────────────┐  ┌───────────────────────┐          │
│  │   OLD PAYMENT         │  │   NEW PAYMENT         │          │
│  │   $4,000/day          │  │   $2,800/day          │          │
│  │   $20,000/week        │  │   $14,000/week        │          │
│  └───────────────────────┘  └───────────────────────┘          │
│                                                                 │
│           ┌─────────────────────────────┐                       │
│           │  30% PAYMENT REDUCTION      │                       │
│           └─────────────────────────────┘                       │
│                                                                 │
│  ╔═════════════════════════════════════════════════════════════╗│
│  ║                  💰 YOUR SAVINGS 💰                         ║│
│  ║  ┌────────────┐ ┌────────────┐ ┌───────────────────────┐   ║│
│  ║  │  DAILY     │ │  WEEKLY    │ │      MONTHLY          │   ║│
│  ║  │  $1,200    │ │  $6,000    │ │   ** $26,400 **       │   ║│
│  ║  │  per day   │ │  per week  │ │     per month         │   ║│
│  ║  └────────────┘ └────────────┘ └───────────────────────────┘│
│  ╚═════════════════════════════════════════════════════════════╝│
│                                                                 │
│           ┌───────────────────────────────┐                     │
│           │  CASH YOU RECEIVE ON DAY 1    │                     │
│           │        $10,000                │                     │
│           └───────────────────────────────┘                     │
│                                                                 │
│  DEAL TERMS                                                     │
│  [Amount Funded] [Total Payback] [Factor] [Fee %] [# Payments]  │
│                                                                 │
│  POSITIONS BEING CONSOLIDATED                                   │
│  [Table of positions]                                           │
│                                                                 │
│  EARLY PAYOFF OPTIONS (if enabled)                              │
│  [EPO table]                                                    │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  [Company Name] | [Merchant Name] | [Date]                      │
└─────────────────────────────────────────────────────────────────┘
```

---

### Summary

1. **Prominent Savings Section** - Full-width green gradient box with three sub-boxes (Daily, Weekly, Monthly), with Monthly emphasized as the largest
2. **White Label Input** - New text field in settings for custom company name
3. **Dynamic PDF Branding** - PDF header and footer use the custom company name if provided, otherwise defaults to "Avion Funding"
4. **Layout Reorder** - Savings section appears before Cash You Receive to emphasize the benefit first

