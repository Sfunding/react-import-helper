

## Enhanced RTR & Exposure Visibility

### Overview
Add comprehensive visibility into RTR (Return to Repay) and Exposure calculations throughout the application, making it clear how the contract amount is calculated including fees on Day 1.

---

### What You'll See

**1. Day 1 Contract Summary Card (New)**
A prominent card above the Daily Schedule showing:
- **Cash Infusion**: How much cash went in on Day 1
- **+ Fees Included**: The consolidation fees added
- **= Gross Contract**: Total funding + fees (what RTR is based on)
- **× Rate**: The factor rate applied
- **= Day 1 RTR**: The full return-to-repay amount

This makes it crystal clear that the RTR is based on (cash + fees) × rate.

**2. Enhanced Daily Schedule Table**
Add columns showing the full picture:
| Day | Cash In | Cumulative Cash | + Fees | = Gross | Daily Debit | RTR Balance | Exposure |

Currently the table shows: Day, Cash Infusion, Daily Withdrawal, Exposure, RTR Balance
Will add: **Cumulative Net Funded**, **Gross (w/ Fees)** columns

**3. Remove 200-row limit**
Show the full schedule instead of truncating at 200 days - all days will be visible with a scroll.

**4. ScheduleBreakdownDialog Enhancement**
When clicking Day 1's Cash Infusion, the breakdown dialog will also show:
- How the fees are incorporated
- What the Gross Contract amount becomes
- The RTR calculation for that day

---

### Technical Changes

#### File: `src/pages/Index.tsx`

**Change 1: Add Day 1 Summary Card**
Add a summary card above the daily schedule table (when activeTab === 'daily') showing:
```text
┌────────────────────────────────────────────────────────────┐
│  📊 Day 1 Contract Formation                               │
│                                                            │
│  Cash Infused:    $85,000    (New Money + Position Pays)   │
│  + Orig Fee:      $ 9,000    (9% of Total Funding)         │
│  ─────────────────────────────                             │
│  Gross Contract:  $94,000                                  │
│  × Factor Rate:   1.499                                    │
│  ─────────────────────────────                             │
│  Day 1 RTR:       $140,906   (What we're collecting)       │
└────────────────────────────────────────────────────────────┘
```

**Change 2: Enhance Daily Table Columns**
Current columns:
- Day | Cash Infusion | Daily Withdrawal | Exposure | RTR Balance

New columns:
- Day | Cash In | Cum. Funded | Gross | Daily Debit | RTR Balance | Exposure

This adds cumulative and gross visibility so users can trace the math.

**Change 3: Remove 200-row slice**
On line 884:
```tsx
// Before:
{dailySchedule.slice(0, 200).map((d, i) => ...

// After:
{dailySchedule.map((d, i) => ...
```

This shows the complete schedule.

---

#### File: `src/components/ScheduleBreakdownDialog.tsx`

**Change: Add RTR/Fee Breakdown for Day 1**
When viewing Day 1 breakdown, add a section showing:
- The origination fee being added
- How Gross Contract is calculated
- What the RTR amount is for that day

This will use props passed from the parent to show fee and rate info.

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Index.tsx` | Add Day 1 summary card, enhance daily table columns, remove 200-row limit |
| `src/components/ScheduleBreakdownDialog.tsx` | Add RTR/fee breakdown section for Day 1 |

---

### Summary

1. **Day 1 Summary Card**: Shows how Cash + Fees = Gross → RTR
2. **Enhanced Table Columns**: Shows cumulative and gross amounts per row  
3. **Full Schedule**: No more 200-day limit - see entire payoff timeline
4. **Fee Visibility in Breakdown**: Day 1 dialog explains fee contribution to RTR

This gives you complete transparency into how the RTR is formed and how exposure changes day by day.

