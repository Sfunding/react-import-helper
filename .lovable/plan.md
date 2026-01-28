

## Plan: Merchant's Offer Tab with PDF Export (Revised)

### Overview

Add a new dedicated tab called "Merchant's Offer" that displays a clean, client-facing view of the consolidation offer. Includes fee percentage AND amount funded for transparency.

---

### What the Merchant Sees

1. **Positions Being Consolidated** - List of funders being paid off with balances and old payments
2. **Payment Comparison** - Old daily/weekly vs new payment with savings highlighted
3. **Cash Upfront** - New Money amount they receive on Day 1
4. **Deal Terms**:
   - **Amount Funded** (Total Advance Amount)
   - Total Payback Amount
   - Factor Rate
   - Origination Fee %
   - Term Length / Number of Payments
5. **Savings Breakdown** - Daily, weekly, and monthly savings

### What is Hidden from Merchant

- Fee dollar amount (ORG Amount)
- Net Funding (internal breakdown)
- Financing Cost
- Our Profit
- Exposure metrics
- Broker commission

---

### Technical Changes

#### File: `src/pages/Index.tsx`

**Change 1: Update TabType**

```typescript
type TabType = 'positions' | 'metrics' | 'daily' | 'weekly' | 'offer' | 'merchantOffer';
```

**Change 2: Add new tab to tabs array**

```typescript
{ key: 'merchantOffer', label: "Merchant's Offer" },
```

**Change 3: Add Merchant's Offer tab content**

- Header with "Your Consolidation Offer" title and Export PDF button
- Positions table showing funders being paid off
- Payment comparison (old vs new)
- Cash You Receive card
- Savings breakdown
- Deal Terms card including **Amount Funded**

---

#### File: `src/lib/exportUtils.ts`

**Add new function: `exportMerchantPDF`**

Creates a professional PDF including Amount Funded but excluding internal profit metrics.

---

### UI Preview

```
┌─────────────────────────────────────────────────────────────────┐
│  Your Consolidation Offer               [Export Merchant PDF]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  POSITIONS BEING CONSOLIDATED                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Funder           │ Balance    │ Daily Payment               ││
│  │ Funder A         │ $50,000    │ $2,500/day                  ││
│  │ Funder B         │ $30,000    │ $1,500/day                  ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ TOTAL            │ $80,000    │ $4,000/day                  ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌───────────────────────┐  ┌───────────────────────┐          │
│  │   OLD PAYMENT         │  │   NEW PAYMENT         │          │
│  │   $4,000/day          │  │   $2,800/day          │          │
│  │   $20,000/week        │  │   $14,000/week        │          │
│  └───────────────────────┘  └───────────────────────┘          │
│                                                                 │
│               ▼ 30% PAYMENT REDUCTION ▼                         │
│                                                                 │
│  ┌───────────────────┐  ┌───────────────────────────────────────┐
│  │ CASH YOU          │  │ YOUR SAVINGS                         ││
│  │ RECEIVE           │  │                                      ││
│  │                   │  │ Daily:   $1,200/day                  ││
│  │   $10,000         │  │ Weekly:  $6,000/week                 ││
│  │   on Day 1        │  │ Monthly: $26,400/month               ││
│  └───────────────────┘  └───────────────────────────────────────┘│
│                                                                 │
│  DEAL TERMS                                                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Amount Funded │ Total Payback │ Factor │ Fee  │ Payments    ││
│  │   $79,860     │   $119,700    │ 1.499  │ 9%   │ 43 debits   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Index.tsx` | Add 'merchantOffer' tab with positions table, payment comparison, savings, deal terms (including Amount Funded and fee %), and PDF export button |
| `src/lib/exportUtils.ts` | Add `exportMerchantPDF` function for client-facing PDF |

---

### Summary

1. **New "Merchant's Offer" tab** alongside existing tabs
2. **Positions table** - Funders being paid off with balances
3. **Payment comparison** - Old vs new with reduction percentage
4. **Cash upfront** - New Money displayed prominently
5. **Savings breakdown** - Daily, weekly, monthly
6. **Deal terms including Amount Funded** - Shows funding amount, payback, factor rate, fee %
7. **Merchant PDF export** - Client-facing proposal document

