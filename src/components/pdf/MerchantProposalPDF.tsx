import React from 'react';
import { Document, Page, View, Text } from '@react-pdf/renderer';
import { COLORS, PAGE, CONTENT_WIDTH, s } from './pdfStyles';
import { fmtCurrency, fmtPct1, fmtFactor, fmtDate } from './pdfHelpers';
import { addBusinessDays, formatBusinessDate } from '@/lib/dateUtils';

// ===== Types =====
export type PDFPosition = {
  entity: string;
  balance: number;
  dailyPayment: number;
  daysToPayoff: number;
  payoffDate: string;
};

export type PDFWeek = {
  week: number;
  oldWeeklyCost: number;
  newWeeklyCost: number;
  weeklySavings: number;
  cumulativeSavings: number;
};

export type PDFProps = {
  companyName: string;
  merchantName: string;
  preparedDate: string;
  // Deal terms
  amountFunded: number;
  totalPayback: number;
  factorRate: number;
  originationFeePct: number;
  numPayments: number;
  consolidationType: string;
  // Payment comparison
  oldDailyPayment: number;
  newDailyPayment: number;
  reductionPct: number;
  dailySavings: number;
  cashToMerchant: number;
  // Positions
  positions: PDFPosition[];
  maxPayoffDay: number;
  maxPayoffDate: string;
  // Weekly projection
  weeklyData: PDFWeek[];
  // Milestones
  month1Savings: number;
  month3Savings: number;
  peakSavings: number;
  peakWeek: number;
  // Page 4 data
  falloffDay: number;
  cashAccumulated: number;
  balanceWithUs: number;
  daysRemainingAfterFalloff: number;
  // Comparison
  numPositions: number;
  // Early payoff options
  earlyPayOptions?: {
    enabled: boolean;
    tiers: Array<{
      daysAfterFalloff: number;
      discountPercent: number;
      payoffDeadline: number;
      payoffAmount: number;
      savings: number;
    }>;
  };
};

// ===== Footer Component =====
const Footer = ({ companyName, merchantName, date, pageNum, totalPages }: {
  companyName: string; merchantName: string; date: string; pageNum: number; totalPages: number;
}) => (
  <View style={s.footer} fixed>
    <Text style={s.footerText}>{companyName} | {merchantName} | Prepared {date}</Text>
    <Text style={s.footerText}>Page {pageNum} of {totalPages}</Text>
  </View>
);

// ===== PAGE 1: COVER / SUMMARY =====
const Page1Cover = ({ d, totalPages }: { d: PDFProps; totalPages: number }) => {
  const oldWeekly = d.oldDailyPayment * 5;
  const newWeekly = d.newDailyPayment * 5;
  const monthlySavings = d.dailySavings * 5 * (52 / 12);

  return (
    <Page size="LETTER" style={s.page}>
      {/* Hero Section */}
      <View style={{
        height: 200, backgroundColor: COLORS.NAVY, paddingHorizontal: PAGE.MARGIN,
        paddingTop: 30, position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative circles */}
        <View style={{ position: 'absolute', top: -40, right: -30, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.03)' }} />
        <View style={{ position: 'absolute', bottom: -60, left: 80, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.02)' }} />

        {/* Top row: label left, company right */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: COLORS.ACCENT, marginBottom: 2 }}>YOUR CONSOLIDATION OFFER</Text>
            <View style={{ width: 40, height: 2, backgroundColor: COLORS.ACCENT, marginBottom: 14 }} />
            <Text style={{
              fontSize: d.merchantName.length > 35 ? 20 : 26,
              fontFamily: 'Helvetica-Bold', color: COLORS.WHITE, marginBottom: 8,
            }}>{d.merchantName}</Text>
            <Text style={{ fontSize: 10, color: COLORS.MUTED_BLUE }}>Prepared: {d.preparedDate}</Text>
          </View>
          <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: COLORS.ACCENT }}>{d.companyName}</Text>
        </View>
      </View>

      <View style={s.content}>
        {/* Old vs New Payment */}
        <View style={{ flexDirection: 'row', marginTop: 16, gap: 0, alignItems: 'center' }}>
          {/* OLD PAYMENT card */}
          <View style={{
            flex: 1, borderRadius: 8, borderWidth: 1, borderColor: COLORS.RED_BORDER,
            backgroundColor: COLORS.WHITE, padding: 12, alignItems: 'center',
          }}>
            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: COLORS.RED, marginBottom: 6 }}>OLD PAYMENT</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={{ fontSize: 26, fontFamily: 'Helvetica-Bold', color: COLORS.TEXT_DARK }}>{fmtCurrency(d.oldDailyPayment)}</Text>
              <Text style={{ fontSize: 11, color: COLORS.TEXT_MED }}>/day</Text>
            </View>
            <Text style={{ fontSize: 10, color: COLORS.DARK_GRAY, marginTop: 4 }}>{fmtCurrency(oldWeekly)}/week</Text>
          </View>

          {/* Reduction badge */}
          <View style={{
            width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.ACCENT,
            alignItems: 'center', justifyContent: 'center', marginHorizontal: -8, zIndex: 1,
          }}>
            <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: COLORS.WHITE }}>{fmtPct1(d.reductionPct)}</Text>
            <Text style={{ fontSize: 5, color: COLORS.WHITE, fontFamily: 'Helvetica-Bold' }}>REDUCTION</Text>
          </View>

          {/* NEW PAYMENT card */}
          <View style={{
            flex: 1, borderRadius: 8, borderWidth: 1, borderColor: COLORS.GREEN_BORDER,
            backgroundColor: COLORS.WHITE, padding: 12, alignItems: 'center',
          }}>
            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: COLORS.ACCENT_DK, marginBottom: 6 }}>NEW PAYMENT</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={{ fontSize: 26, fontFamily: 'Helvetica-Bold', color: COLORS.TEXT_DARK }}>{fmtCurrency(d.newDailyPayment)}</Text>
              <Text style={{ fontSize: 11, color: COLORS.TEXT_MED }}>/day</Text>
            </View>
            <Text style={{ fontSize: 10, color: COLORS.DARK_GRAY, marginTop: 4 }}>{fmtCurrency(newWeekly)}/week</Text>
          </View>
        </View>

        {/* YOUR SAVINGS row */}
        <Text style={[s.sectionHeader, { marginTop: 14 }]}>YOUR SAVINGS</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[
            { label: 'DAILY', value: fmtCurrency(d.dailySavings), color: COLORS.GREEN },
            { label: 'WEEKLY', value: fmtCurrency(d.dailySavings * 5), color: COLORS.GREEN },
            { label: 'MONTHLY', value: fmtCurrency(monthlySavings), color: COLORS.GREEN },
            { label: 'CONSOLIDATION', value: d.consolidationType, color: COLORS.GOLD, isText: true },
          ].map((item, i) => (
            <View key={i} style={[s.statCard, { flex: 1 }]}>
              <View style={[s.statCardAccentTop, { backgroundColor: item.color }]} />
              <Text style={[s.statCardValue, { color: item.color, fontSize: (item as any).isText ? 10 : 18 }]}>{item.value}</Text>
              <Text style={s.statCardLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* DEAL TERMS */}
        <Text style={[s.sectionHeader, { marginTop: 14 }]}>DEAL TERMS</Text>
        <View style={{
          backgroundColor: COLORS.LIGHT_GRAY, borderRadius: 6, flexDirection: 'row',
          paddingVertical: 10, paddingHorizontal: 8,
        }}>
          {[
            { label: 'AMOUNT FUNDED', value: fmtCurrency(d.amountFunded) },
            { label: 'TOTAL PAYBACK', value: fmtCurrency(d.totalPayback) },
            { label: 'FACTOR RATE', value: fmtFactor(d.factorRate) },
            { label: 'ORIGINATION', value: fmtPct1(d.originationFeePct) },
            { label: '# PAYMENTS', value: d.numPayments.toString() },
          ].map((item, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 7, color: COLORS.DARK_GRAY, textTransform: 'uppercase', marginBottom: 4 }}>{item.label}</Text>
              <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: COLORS.TEXT_DARK }}>{item.value}</Text>
            </View>
          ))}
        </View>

        {/* Cash to Merchant banner (conditional) */}
        {d.cashToMerchant > 0 && (
          <View style={{
            backgroundColor: COLORS.LIGHT_GREEN_BG, borderRadius: 6,
            paddingVertical: 8, alignItems: 'center', marginTop: 10,
          }}>
            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: COLORS.ACCENT_DK }}>
              CASH TO MERCHANT: {fmtCurrency(d.cashToMerchant)}
            </Text>
          </View>
        )}
      </View>

      <Footer companyName={d.companyName} merchantName={d.merchantName} date={d.preparedDate} pageNum={1} totalPages={totalPages} />
    </Page>
  );
};

// ===== PAGE 2: POSITIONS & PAYOFF SCHEDULE =====
const Page2Positions = ({ d, totalPages }: { d: PDFProps; totalPages: number }) => {
  const sorted = [...d.positions].sort((a, b) => a.daysToPayoff - b.daysToPayoff);
  const totalBalance = d.positions.reduce((s, p) => s + p.balance, 0);
  const totalDaily = d.positions.reduce((s, p) => s + p.dailyPayment, 0);

  // Stagger logic for timeline
  const barWidth = CONTENT_WIDTH;
  const maxDay = d.maxPayoffDay || 1;
  const markers = sorted.map(p => ({
    entity: p.entity,
    day: p.daysToPayoff,
    x: (p.daysToPayoff / maxDay) * barWidth,
  }));

  // Assign levels for staggering (check 48px proximity)
  const levels: number[] = [];
  const levelLastX = [0, 0, 0];
  markers.forEach((m, i) => {
    let assigned = 0;
    for (let l = 0; l < 3; l++) {
      if (m.x - levelLastX[l] >= 48 || levelLastX[l] === 0) {
        assigned = l;
        break;
      }
      if (l < 2) assigned = l + 1;
    }
    levels.push(assigned);
    levelLastX[assigned] = m.x;
  });

  const labelOffsets = [16, 36, 56];

  return (
    <Page size="LETTER" style={s.page}>
      {/* Header bar */}
      <View style={s.headerBar}>
        <Text style={s.headerBarTitle}>{d.companyName}</Text>
        <Text style={s.headerBarSubtitle}>POSITIONS & PAYOFF SCHEDULE</Text>
      </View>

      <View style={s.content}>
        {/* Positions Being Consolidated */}
        <Text style={[s.sectionHeader, { marginTop: 14 }]}>POSITIONS BEING CONSOLIDATED</Text>

        {/* Table Header */}
        <View style={s.tableHeader}>
          <Text style={[s.tableHeaderCell, { flex: 3 }]}>Funder</Text>
          <Text style={[s.tableHeaderCell, { flex: 2, textAlign: 'right' }]}>Current Balance</Text>
          <Text style={[s.tableHeaderCell, { flex: 2, textAlign: 'right' }]}>Daily Payment</Text>
        </View>
        {d.positions.map((p, i) => (
          <View key={i} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
            <Text style={[s.tableCell, { flex: 3 }]}>{p.entity}</Text>
            <Text style={[s.tableCell, { flex: 2, textAlign: 'right' }]}>{fmtCurrency(p.balance)}</Text>
            <Text style={[s.tableCell, { flex: 2, textAlign: 'right', color: COLORS.RED, fontFamily: 'Helvetica-Bold' }]}>{fmtCurrency(p.dailyPayment)}</Text>
          </View>
        ))}
        {/* Total row */}
        <View style={s.tableTotalRow}>
          <Text style={[s.tableTotalCell, { flex: 3 }]}>TOTAL</Text>
          <Text style={[s.tableTotalCell, { flex: 2, textAlign: 'right' }]}>{fmtCurrency(totalBalance)}</Text>
          <Text style={[s.tableTotalCellAccent, { flex: 2, textAlign: 'right' }]}>{fmtCurrency(totalDaily)}</Text>
        </View>

        {/* Payoff Timeline Table */}
        <Text style={[s.sectionHeader, { marginTop: 16 }]}>POSITION PAYOFF TIMELINE</Text>
        <View style={s.tableHeader}>
          <Text style={[s.tableHeaderCell, { flex: 2.5 }]}>Funder</Text>
          <Text style={[s.tableHeaderCell, { flex: 1.5, textAlign: 'right' }]}>Balance</Text>
          <Text style={[s.tableHeaderCell, { flex: 1.5, textAlign: 'right' }]}>Daily Payment</Text>
          <Text style={[s.tableHeaderCell, { flex: 1.5, textAlign: 'right' }]}>Days to Payoff</Text>
          <Text style={[s.tableHeaderCell, { flex: 1.5, textAlign: 'right' }]}>Paid Off By</Text>
        </View>
        {sorted.map((p, i) => (
          <View key={i} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
            <Text style={[s.tableCell, { flex: 2.5 }]}>{p.entity}</Text>
            <Text style={[s.tableCell, { flex: 1.5, textAlign: 'right' }]}>{fmtCurrency(p.balance)}</Text>
            <Text style={[s.tableCell, { flex: 1.5, textAlign: 'right' }]}>{fmtCurrency(p.dailyPayment)}</Text>
            <Text style={[s.tableCellBold, { flex: 1.5, textAlign: 'right', color: COLORS.DARK_BLUE }]}>Day {p.daysToPayoff}</Text>
            <Text style={[s.tableCell, { flex: 1.5, textAlign: 'right', color: COLORS.TEXT_MED }]}>{p.payoffDate}</Text>
          </View>
        ))}

        {/* ALL POSITIONS CLEAR banner */}
        <View style={[s.banner, { backgroundColor: COLORS.ACCENT, marginTop: 12 }]}>
          <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: COLORS.WHITE }}>ALL POSITIONS CLEAR</Text>
          <Text style={{ fontSize: 11, color: COLORS.WHITE, marginTop: 2 }}>Day {d.maxPayoffDay}</Text>
        </View>

        {/* Visual Payoff Timeline Bar */}
        <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: COLORS.TEXT_DARK, marginTop: 14, marginBottom: 6 }}>VISUAL PAYOFF TIMELINE</Text>
        <View style={{ position: 'relative', height: 80, marginBottom: 10 }}>
          {/* Bar */}
          <View style={{
            height: 16, backgroundColor: COLORS.ACCENT, borderRadius: 8,
            width: CONTENT_WIDTH, position: 'absolute', top: 0,
          }} />
          {/* Markers */}
          {markers.map((m, i) => (
            <React.Fragment key={i}>
              {/* Dot */}
              <View style={{
                position: 'absolute', top: 3, left: m.x - 5,
                width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.WHITE,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.NAVY }} />
              </View>
              {/* Connector line */}
              <View style={{
                position: 'absolute', top: 16, left: m.x,
                width: 0.5, height: labelOffsets[levels[i]] - 2,
                backgroundColor: COLORS.MED_GRAY,
              }} />
              {/* Label */}
              <View style={{ position: 'absolute', top: 16 + labelOffsets[levels[i]], left: m.x - 25, width: 50, alignItems: 'center' }}>
                <Text style={{ fontSize: 6.5, color: COLORS.TEXT_MED }}>{m.entity.substring(0, 12)}</Text>
                <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: COLORS.TEXT_DARK }}>Day {m.day}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* Early Payoff Options */}
        {d.earlyPayOptions?.enabled && d.earlyPayOptions.tiers.length > 0 && (
          <>
            <Text style={[s.sectionHeader, { marginTop: 8 }]}>EARLY PAYOFF OPTIONS</Text>
            <Text style={{ fontSize: 9, color: COLORS.TEXT_MED, marginBottom: 6 }}>Pay off your balance early after positions clear and save:</Text>
            <View style={s.tableHeader}>
              <Text style={[s.tableHeaderCell, { flex: 2 }]}>Pay By</Text>
              <Text style={[s.tableHeaderCell, { flex: 1.5, textAlign: 'right' }]}>Payoff Amount</Text>
              <Text style={[s.tableHeaderCell, { flex: 1.5, textAlign: 'right' }]}>You Save</Text>
            </View>
            {d.earlyPayOptions.tiers.map((tier, i) => (
              <View key={i} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
                <Text style={[s.tableCell, { flex: 2 }]}>Day {tier.payoffDeadline} ({tier.daysAfterFalloff} days after)</Text>
                <Text style={[s.tableCell, { flex: 1.5, textAlign: 'right' }]}>{fmtCurrency(tier.payoffAmount)}</Text>
                <Text style={[s.tableCell, { flex: 1.5, textAlign: 'right', color: COLORS.GREEN, fontFamily: 'Helvetica-Bold' }]}>
                  {fmtCurrency(tier.savings)} ({fmtPct1(tier.discountPercent * 100)} off)
                </Text>
              </View>
            ))}
            <Text style={{ fontSize: 8, color: COLORS.MED_GRAY, marginTop: 4 }}>
              * Positions fall off on Day {d.falloffDay}. Days are business days from deal start.
            </Text>
          </>
        )}
      </View>

      <Footer companyName={d.companyName} merchantName={d.merchantName} date={d.preparedDate} pageNum={2} totalPages={totalPages} />
    </Page>
  );
};

// ===== PAGE 3: WEEKLY CASH FLOW PROJECTION =====
const Page3Weekly = ({ d, totalPages }: { d: PDFProps; totalPages: number }) => {
  const displayWeeks = d.weeklyData.slice(0, 18);

  return (
    <Page size="LETTER" style={s.page}>
      <View style={s.headerBar}>
        <Text style={s.headerBarTitle}>{d.companyName}</Text>
        <Text style={s.headerBarSubtitle}>WEEKLY CASH FLOW PROJECTION</Text>
      </View>

      <View style={s.content}>
        <Text style={{ fontSize: 9, color: COLORS.TEXT_MED, marginTop: 10, marginBottom: 8 }}>
          See how your savings accumulate week by week:
        </Text>

        {/* Table */}
        <View style={s.tableHeader}>
          <Text style={[s.tableHeaderCell, { flex: 1 }]}>Week</Text>
          <Text style={[s.tableHeaderCell, { flex: 1.5, textAlign: 'right' }]}>Old Weekly Cost</Text>
          <Text style={[s.tableHeaderCell, { flex: 1.5, textAlign: 'right' }]}>New Weekly Cost</Text>
          <Text style={[s.tableHeaderCell, { flex: 1.5, textAlign: 'right' }]}>Weekly Savings</Text>
          <Text style={[s.tableHeaderCell, { flex: 1.5, textAlign: 'right' }]}>Cumulative Savings</Text>
        </View>
        {displayWeeks.map((w, i) => {
          const isNeg = w.weeklySavings < 0;
          return (
            <View key={i} style={[
              s.tableRow,
              i % 2 === 1 ? s.tableRowAlt : {},
              isNeg ? { backgroundColor: COLORS.LIGHT_RED_BG } : {},
            ]}>
              <Text style={[s.tableCell, { flex: 1 }]}>Week {w.week}</Text>
              <Text style={[s.tableCell, { flex: 1.5, textAlign: 'right' }]}>{fmtCurrency(w.oldWeeklyCost)}</Text>
              <Text style={[s.tableCell, { flex: 1.5, textAlign: 'right' }]}>{fmtCurrency(w.newWeeklyCost)}</Text>
              <Text style={[s.tableCellBold, {
                flex: 1.5, textAlign: 'right',
                color: isNeg ? COLORS.RED : COLORS.GREEN,
              }]}>
                {isNeg ? '' : '+'}{fmtCurrency(w.weeklySavings)}
              </Text>
              <Text style={[s.tableCellBold, {
                flex: 1.5, textAlign: 'right',
                color: w.cumulativeSavings < 0 ? COLORS.RED : COLORS.GREEN,
              }]}>
                {fmtCurrency(w.cumulativeSavings)}
              </Text>
            </View>
          );
        })}

        {/* KEY MILESTONES */}
        <Text style={[s.sectionHeader, { marginTop: 16 }]}>KEY MILESTONES</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {/* After 1 Month */}
          <View style={[s.statCard, { flex: 1 }]}>
            <View style={[s.statCardAccentTop, { backgroundColor: COLORS.ACCENT }]} />
            <Text style={[s.statCardValue, { color: COLORS.GREEN }]}>{fmtCurrency(d.month1Savings)}</Text>
            <Text style={s.statCardLabel}>After 1 Month</Text>
          </View>
          {/* After 3 Months */}
          <View style={[s.statCard, { flex: 1 }]}>
            <View style={[s.statCardAccentTop, { backgroundColor: COLORS.ACCENT }]} />
            <Text style={[s.statCardValue, { color: COLORS.GREEN }]}>{fmtCurrency(d.month3Savings)}</Text>
            <Text style={s.statCardLabel}>After 3 Months</Text>
          </View>
          {/* Peak Savings */}
          <View style={[s.statCard, { flex: 1 }]}>
            <View style={[s.statCardAccentTop, { backgroundColor: COLORS.GOLD }]} />
            <Text style={[s.statCardValue, { color: COLORS.GOLD }]}>{fmtCurrency(d.peakSavings)}</Text>
            <Text style={s.statCardLabel}>Peak Savings (Wk {d.peakWeek})</Text>
          </View>
        </View>
      </View>

      <Footer companyName={d.companyName} merchantName={d.merchantName} date={d.preparedDate} pageNum={3} totalPages={totalPages} />
    </Page>
  );
};

// ===== PAGE 4: THE BOTTOM LINE =====
const Page4BottomLine = ({ d, totalPages }: { d: PDFProps; totalPages: number }) => {
  const oldMonthly = d.oldDailyPayment * 5 * (52 / 12);
  const newMonthly = d.newDailyPayment * 5 * (52 / 12);

  return (
    <Page size="LETTER" style={s.page}>
      <View style={s.headerBar}>
        <Text style={s.headerBarTitle}>{d.companyName}</Text>
        <Text style={s.headerBarSubtitle}>THE BOTTOM LINE</Text>
      </View>

      <View style={s.content}>
        {/* Hero Banner */}
        <View style={{
          backgroundColor: COLORS.NAVY, borderRadius: 8, borderWidth: 1.5,
          borderColor: COLORS.ACCENT, paddingVertical: 16, alignItems: 'center', marginTop: 16,
        }}>
          <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: COLORS.WHITE }}>
            AFTER ALL POSITIONS FALL OFF (Day {d.falloffDay})
          </Text>
          <Text style={{ fontSize: 10, color: COLORS.ACCENT, marginTop: 4 }}>
            All existing funders paid off. Here's where you'll stand:
          </Text>
        </View>

        {/* Three Status Cards */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          {/* Cash Accumulated */}
          <View style={{
            flex: 1, borderRadius: 8, backgroundColor: COLORS.LIGHT_GREEN_BG,
            borderWidth: 1, borderColor: COLORS.GREEN, padding: 12, alignItems: 'center',
          }}>
            <Text style={{ fontSize: 8, color: COLORS.DARK_GRAY, textTransform: 'uppercase', marginBottom: 4 }}>CASH ACCUMULATED</Text>
            <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold', color: COLORS.GREEN }}>{fmtCurrency(d.cashAccumulated)}</Text>
          </View>
          {/* Balance With Us */}
          <View style={{
            flex: 1, borderRadius: 8, backgroundColor: COLORS.LIGHT_YELLOW_BG,
            borderWidth: 1, borderColor: COLORS.GOLD, padding: 12, alignItems: 'center',
          }}>
            <Text style={{ fontSize: 8, color: COLORS.DARK_GRAY, textTransform: 'uppercase', marginBottom: 4 }}>BALANCE WITH US</Text>
            <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold', color: COLORS.GOLD }}>{fmtCurrency(d.balanceWithUs)}</Text>
          </View>
          {/* Single Payment Forward */}
          <View style={{
            flex: 1, borderRadius: 8, backgroundColor: COLORS.LIGHT_BLUE_BG,
            borderWidth: 1, borderColor: COLORS.DARK_BLUE, padding: 12, alignItems: 'center',
          }}>
            <Text style={{ fontSize: 8, color: COLORS.DARK_GRAY, textTransform: 'uppercase', marginBottom: 4 }}>SINGLE PAYMENT FORWARD</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold', color: COLORS.DARK_BLUE }}>{fmtCurrency(d.newDailyPayment)}</Text>
              <Text style={{ fontSize: 9, color: COLORS.TEXT_MED }}>/day</Text>
            </View>
            <Text style={{ fontSize: 8, color: COLORS.TEXT_MED, marginTop: 2 }}>for {d.daysRemainingAfterFalloff} more days</Text>
          </View>
        </View>

        {/* Teal callout */}
        <View style={[s.banner, { backgroundColor: COLORS.ACCENT, marginTop: 14 }]}>
          <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: COLORS.WHITE }}>
            No more multiple funders — 1 simple payment!
          </Text>
        </View>

        {/* Without vs With */}
        <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: COLORS.TEXT_DARK, textAlign: 'center', marginTop: 20, marginBottom: 10 }}>
          Without vs. With Consolidation
        </Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {/* WITHOUT */}
          <View style={{
            flex: 1, borderRadius: 8, borderWidth: 1.5, borderColor: COLORS.RED,
            backgroundColor: COLORS.LIGHT_RED_BG, overflow: 'hidden',
          }}>
            <View style={{ backgroundColor: COLORS.RED, paddingVertical: 8, alignItems: 'center' }}>
              <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: COLORS.WHITE }}>WITHOUT CONSOLIDATION</Text>
            </View>
            <View style={{ padding: 12, alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 10, color: COLORS.RED }}>{fmtCurrency(d.oldDailyPayment)}/day</Text>
              <Text style={{ fontSize: 10, color: COLORS.RED }}>{fmtCurrency(d.oldDailyPayment * 5)}/week</Text>
              <Text style={{ fontSize: 10, color: COLORS.RED }}>{fmtCurrency(oldMonthly)}/month</Text>
              <Text style={{ fontSize: 9, color: COLORS.RED, marginTop: 4 }}>{d.numPositions} separate payments</Text>
            </View>
          </View>
          {/* WITH */}
          <View style={{
            flex: 1, borderRadius: 8, borderWidth: 1.5, borderColor: COLORS.GREEN,
            backgroundColor: COLORS.LIGHT_GREEN_BG, overflow: 'hidden',
          }}>
            <View style={{ backgroundColor: COLORS.GREEN, paddingVertical: 8, alignItems: 'center' }}>
              <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: COLORS.WHITE }}>WITH CONSOLIDATION</Text>
            </View>
            <View style={{ padding: 12, alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 10, color: COLORS.GREEN, fontFamily: 'Helvetica-Bold' }}>{fmtCurrency(d.newDailyPayment)}/day</Text>
              <Text style={{ fontSize: 10, color: COLORS.GREEN, fontFamily: 'Helvetica-Bold' }}>{fmtCurrency(d.newDailyPayment * 5)}/week</Text>
              <Text style={{ fontSize: 10, color: COLORS.GREEN, fontFamily: 'Helvetica-Bold' }}>{fmtCurrency(newMonthly)}/month</Text>
              <Text style={{ fontSize: 9, color: COLORS.GREEN, fontFamily: 'Helvetica-Bold', marginTop: 4 }}>1 simple payment</Text>
            </View>
          </View>
        </View>
      </View>

      <Footer companyName={d.companyName} merchantName={d.merchantName} date={d.preparedDate} pageNum={4} totalPages={totalPages} />
    </Page>
  );
};

// ===== MAIN DOCUMENT =====
const MerchantProposalPDF: React.FC<{ data: PDFProps }> = ({ data }) => {
  const totalPages = 4;
  return (
    <Document>
      <Page1Cover d={data} totalPages={totalPages} />
      <Page2Positions d={data} totalPages={totalPages} />
      <Page3Weekly d={data} totalPages={totalPages} />
      <Page4BottomLine d={data} totalPages={totalPages} />
    </Document>
  );
};

export default MerchantProposalPDF;
