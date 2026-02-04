import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  SavedCalculation, 
  Settings, 
  Position, 
  DayScheduleExport, 
  WeekScheduleExport,
  EarlyPaySettings
} from '@/types/calculation';
import { getFormattedLastPaymentDate, calculateRemainingBalance } from '@/lib/dateUtils';
import { format } from 'date-fns';

// Helper to format currency
const fmt = (v: number) => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v || 0);

const fmtNoDecimals = (v: number) => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v || 0);

const fmtPct = (v: number) => `${(v || 0).toFixed(2)}%`;

// Generate safe filename
const sanitizeFilename = (name: string) => {
  return name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
};

// Calculate all schedules and metrics from saved calculation data
export function calculateSchedules(
  positions: Position[],
  settings: Settings,
  merchantMonthlyRevenue: number
) {
  // Helper to get effective balance (auto-calculated or manual)
  const getEffectiveBalance = (p: Position): number | null => {
    const autoCalc = calculateRemainingBalance(p.fundedDate, p.amountFunded, p.dailyPayment);
    return autoCalc !== null ? autoCalc : p.balance;
  };

  // All external positions with known balances (for leverage calculations)
  const allExternalPositions = positions.filter(p => {
    const effectiveBalance = getEffectiveBalance(p);
    return !p.isOurPosition && effectiveBalance !== null && effectiveBalance > 0;
  });
  // Only included positions (for reverse calculations)
  const includedPositions = allExternalPositions.filter(p => p.includeInReverse !== false);
  
  // Use ALL positions for leverage metrics
  const totalBalanceAll = allExternalPositions.reduce((sum, p) => sum + (getEffectiveBalance(p) || 0), 0);
  const totalCurrentDailyPaymentAll = allExternalPositions.reduce((sum, p) => sum + (p.dailyPayment || 0), 0);
  
  // Use INCLUDED positions for reverse calculations
  const includedBalance = includedPositions.reduce((sum, p) => sum + (getEffectiveBalance(p) || 0), 0);
  const includedDailyPayment = includedPositions.reduce((sum, p) => sum + (p.dailyPayment || 0), 0);
  
  // Advance Amount = Included positions only (no new money on top)
  const totalAdvanceAmount = includedBalance;
  // For display purposes
  const totalBalance = includedBalance;
  const totalCurrentDailyPayment = includedDailyPayment;
  
  const positionsWithDays = positions.map(p => {
    const effectiveBalance = getEffectiveBalance(p);
    return {
      ...p,
      balance: effectiveBalance, // Use effective balance for calculations
      daysLeft: p.dailyPayment > 0 && effectiveBalance !== null && effectiveBalance > 0 ? Math.ceil(effectiveBalance / p.dailyPayment) : 0
    };
  });

  // Total Funding = Advance Amount / (1 - Fee%) since new money is already in advance amount
  const totalFunding = totalAdvanceAmount / (1 - settings.feePercent);
  const netAdvance = totalFunding * (1 - settings.feePercent);
  const consolidationFees = totalFunding * settings.feePercent;
  
  // Base payback calculation from funding × rate (used as default reference)
  const basePayback = totalFunding * settings.rate;

  // Determine Daily Payment and Term based on which is set
  // Priority: dailyPaymentOverride > termDays > discount-based calculation
  let newDailyPayment: number;
  let numberOfDebits: number;

  if (settings.dailyPaymentOverride !== null && settings.dailyPaymentOverride > 0) {
    // User specified daily payment → derive term from base payback
    newDailyPayment = settings.dailyPaymentOverride;
    numberOfDebits = newDailyPayment > 0 ? Math.ceil(basePayback / newDailyPayment) : 0;
  } else if (settings.termDays !== null && settings.termDays > 0) {
    // User specified term → derive daily payment from base payback
    numberOfDebits = settings.termDays;
    newDailyPayment = numberOfDebits > 0 ? basePayback / numberOfDebits : 0;
  } else {
    // Default: use discount to calculate payment, derive term
    newDailyPayment = includedDailyPayment * (1 - settings.dailyPaymentDecrease);
    numberOfDebits = newDailyPayment > 0 ? Math.ceil(basePayback / newDailyPayment) : 0;
  }

  // CRITICAL: Total Payback ALWAYS equals Daily Payment × # of Debits
  const totalPayback = newDailyPayment * numberOfDebits;

  // Derive the implied discount for display
  const impliedDiscount = includedDailyPayment > 0 
    ? 1 - (newDailyPayment / includedDailyPayment) 
    : 0;

  const newWeeklyPayment = newDailyPayment * 5;
  const sp = merchantMonthlyRevenue > 0 ? (newDailyPayment * 22) / merchantMonthlyRevenue : 0;
  
  const dailySavings = totalCurrentDailyPayment - newDailyPayment;
  const weeklySavings = dailySavings * 5;
  const monthlySavings = dailySavings * 22;

  // Generate daily schedule - only use INCLUDED positions
  const dailySchedule: DayScheduleExport[] = [];
  let cumulativeNetFunded = 0;
  let cumulativeDebits = 0;
  let dealComplete = false;
  const maxDays = 500;
  const originationFee = consolidationFees;
  
  // Only use INCLUDED positions for the schedule
  const includedPositionsWithDays = positionsWithDays.filter(p => !p.isOurPosition && p.includeInReverse !== false);

  for (let day = 1; day <= maxDays; day++) {
    if (dealComplete) break;
    const week = Math.ceil(day / 5);
    const dayOfWeek = ((day - 1) % 5) + 1;
    const isPayDay = dayOfWeek === 1;

    let cashInfusion = 0;
    if (isPayDay) {
      for (let d = day; d <= day + 4 && d <= maxDays; d++) {
        const dayPayment = includedPositionsWithDays
          .filter(p => p.balance > 0 && d <= p.daysLeft)
          .reduce((sum, p) => sum + p.dailyPayment, 0);
        cashInfusion += dayPayment;
      }
    }

    cumulativeNetFunded += cashInfusion;
    const cumulativeGross = cumulativeNetFunded + originationFee;
    const rtrBeforeDebit = (cumulativeGross * settings.rate) - cumulativeDebits;

    let dailyWithdrawal = 0;
    if (day >= 2 && rtrBeforeDebit > 0) {
      dailyWithdrawal = Math.min(newDailyPayment, rtrBeforeDebit);
    }
    cumulativeDebits += dailyWithdrawal;

    const exposureOnReverse = cumulativeNetFunded - cumulativeDebits;
    const rtrBalance = (cumulativeGross * settings.rate) - cumulativeDebits;

    dailySchedule.push({
      day,
      week,
      cashInfusion,
      dailyWithdrawal,
      exposureOnReverse,
      rtrBalance
    });

    if (rtrBalance <= 0) dealComplete = true;
  }

  // Generate weekly summary
  const weekMap = new Map<number, WeekScheduleExport>();
  dailySchedule.forEach(d => {
    if (!weekMap.has(d.week)) {
      weekMap.set(d.week, { week: d.week, cashInfusion: 0, totalDebits: 0, endExposure: d.exposureOnReverse });
    }
    const w = weekMap.get(d.week)!;
    w.cashInfusion += d.cashInfusion;
    w.totalDebits += d.dailyWithdrawal;
    w.endExposure = d.exposureOnReverse;
  });
  const weeklySchedule = Array.from(weekMap.values());

  // Calculate metrics
  const totalDays = dailySchedule.length;
  const lastDay = dailySchedule[dailySchedule.length - 1];
  const exposures = dailySchedule.map(d => d.exposureOnReverse);
  const maxExposure = exposures.length > 0 ? Math.max(...exposures) : 0;
  const maxExposureDay = dailySchedule.find(d => d.exposureOnReverse === maxExposure)?.day || 0;
  const lastDayExposed = dailySchedule.filter(d => d.exposureOnReverse > 0).pop()?.day || 0;
  const totalCashInfusion = dailySchedule.reduce((sum, d) => sum + d.cashInfusion, 0);
  const actualPaybackCollected = lastDay?.dailyWithdrawal ? dailySchedule.reduce((sum, d) => sum + d.dailyWithdrawal, 0) : 0;
  const profit = actualPaybackCollected - totalCashInfusion;
  const dealTrueFactor = maxExposure > 0 ? 1 + ((profit - consolidationFees) / (maxExposure + consolidationFees)) : 0;
  // Use ALL positions for leverage calculation (full merchant debt picture)
  const currentLeverage = merchantMonthlyRevenue > 0 ? (totalCurrentDailyPaymentAll * 22) / merchantMonthlyRevenue * 100 : 0;

  return {
    dailySchedule,
    weeklySchedule,
    positionsWithDays,
    allExternalPositions,
    includedPositions,
    totalBalanceAll,
    totalCurrentDailyPaymentAll,
    metrics: {
      totalBalance,
      totalAdvanceAmount,
      totalCurrentDailyPayment,
      totalFunding,
      netAdvance,
      consolidationFees,
      newDailyPayment,
      newWeeklyPayment,
      totalPayback,
      numberOfDebits,
      impliedDiscount,
      dailySavings,
      weeklySavings,
      monthlySavings,
      sp,
      totalDays,
      maxExposure,
      maxExposureDay,
      lastDayExposed,
      totalCashInfusion,
      actualPaybackCollected,
      profit,
      dealTrueFactor,
      currentLeverage
    }
  };
}

// Export to Excel with multiple tabs
export function exportToExcel(calculation: SavedCalculation) {
  const settings = calculation.settings as Settings;
  const positions = calculation.positions as Position[];
  const merchantRevenue = calculation.merchant_monthly_revenue || 0;
  
  const { dailySchedule, weeklySchedule, positionsWithDays, allExternalPositions, includedPositions, totalBalanceAll, totalCurrentDailyPaymentAll, metrics } = calculateSchedules(
    positions,
    settings,
    merchantRevenue
  );

  const workbook = XLSX.utils.book_new();
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Tab 1: Summary
  const summaryData = [
    ['REVERSE CONSOLIDATION PROPOSAL'],
    [''],
    ['Prepared for:', calculation.merchant_name || 'N/A'],
    ['Business Type:', calculation.merchant_business_type || 'N/A'],
    ['Date:', dateStr],
    [''],
    ['MERCHANT OVERVIEW'],
    ['Monthly Revenue', fmtNoDecimals(merchantRevenue)],
    ['Total Existing Balance', fmtNoDecimals(metrics.totalBalance)],
    ['Current Daily Payment', fmtNoDecimals(metrics.totalCurrentDailyPayment)],
    ['Current Weekly Payment', fmtNoDecimals(metrics.totalCurrentDailyPayment * 5)],
    [''],
    ['DEAL STRUCTURE'],
    ['Total Funding', fmtNoDecimals(metrics.totalFunding)],
    ['Net Advance', fmtNoDecimals(metrics.netAdvance)],
    ['Consolidation Fees', fmtNoDecimals(metrics.consolidationFees)],
    ['Fee Percentage', fmtPct(settings.feePercent * 100)],
    ['Rate', settings.rate.toFixed(3)],
    ['Rate', settings.rate.toFixed(3)],
    [''],
    ['NEW PAYMENT TERMS'],
    ['New Daily Payment', fmtNoDecimals(metrics.newDailyPayment)],
    ['New Weekly Payment', fmtNoDecimals(metrics.newWeeklyPayment)],
    ['Payment Reduction', fmtPct(metrics.impliedDiscount * 100)],
    [''],
    ['SAVINGS'],
    ['Daily Savings', fmtNoDecimals(metrics.dailySavings)],
    ['Weekly Savings', fmtNoDecimals(metrics.weeklySavings)],
    ['Monthly Savings', fmtNoDecimals(metrics.monthlySavings)],
    [''],
    ['TIMELINE'],
    ['Days to Payoff', metrics.totalDays],
    ['Weeks to Payoff', Math.ceil(metrics.totalDays / 5)],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet['!cols'] = [{ wch: 25 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // Tab 2: Current Positions (show all positions with Include status)
  const ourPositions = positions.filter(p => p.isOurPosition);
  const unknownBalancePositions = positions.filter(p => {
    const autoCalc = calculateRemainingBalance(p.fundedDate, p.amountFunded, p.dailyPayment);
    return autoCalc === null && p.balance === null;
  });
  const positionsData = [
    ['CURRENT MCA POSITIONS'],
    [''],
    ['Ours', 'Include', 'Entity', 'Funded Date', 'Amount Funded', 'Balance', 'Daily Payment', 'Days Left', 'Last Payment Date'],
    ...positions.map(p => {
      const posWithDays = positionsWithDays.find(pwd => pwd.id === p.id);
      const isOurs = p.isOurPosition;
      const effectiveBalance = posWithDays?.balance;
      const isUnknown = effectiveBalance === null;
      const hasAutoCalc = p.fundedDate && p.amountFunded !== null;
      return [
        isOurs ? 'Yes' : 'No',
        isOurs ? '-' : (p.includeInReverse !== false ? 'Yes' : 'No'),
        p.entity || 'Unknown',
        p.fundedDate ? format(new Date(p.fundedDate), 'MMM d, yyyy') : '-',
        p.amountFunded !== null ? fmtNoDecimals(p.amountFunded) : '-',
        isUnknown ? 'Unknown' : (hasAutoCalc ? `${fmtNoDecimals(effectiveBalance || 0)} (auto)` : fmtNoDecimals(effectiveBalance || 0)),
        fmtNoDecimals(p.dailyPayment),
        isUnknown ? '?' : (posWithDays?.daysLeft || 0),
        isUnknown ? '-' : getFormattedLastPaymentDate(posWithDays?.daysLeft || 0)
      ];
    }),
    [''],
    ['', '', `REVERSING ${includedPositions.length} of ${allExternalPositions.length}${ourPositions.length > 0 ? ` (${ourPositions.length} ours)` : ''}${unknownBalancePositions.length > 0 ? ` (${unknownBalancePositions.length} unknown)` : ''}`, '', '', fmtNoDecimals(metrics.totalBalance), fmtNoDecimals(metrics.totalCurrentDailyPayment), '', '']
  ];
  const positionsSheet = XLSX.utils.aoa_to_sheet(positionsData);
  positionsSheet['!cols'] = [{ wch: 8 }, { wch: 10 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 12 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, positionsSheet, 'Positions');

  // Tab 3: Daily Schedule
  const dailyData = [
    ['DAILY PAYMENT SCHEDULE'],
    [''],
    ['Day', 'Week', 'Cash Infusion', 'Daily Withdrawal', 'Exposure', 'RTR Balance'],
    ...dailySchedule.map(d => [
      d.day,
      d.week,
      d.cashInfusion > 0 ? fmtNoDecimals(d.cashInfusion) : '-',
      d.dailyWithdrawal > 0 ? fmtNoDecimals(d.dailyWithdrawal) : '-',
      fmtNoDecimals(d.exposureOnReverse),
      fmtNoDecimals(d.rtrBalance)
    ])
  ];
  const dailySheet = XLSX.utils.aoa_to_sheet(dailyData);
  dailySheet['!cols'] = [{ wch: 8 }, { wch: 8 }, { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(workbook, dailySheet, 'Daily Schedule');

  // Tab 4: Weekly Schedule
  const weeklyData = [
    ['WEEKLY PAYMENT SCHEDULE'],
    [''],
    ['Week', 'Cash Infusion', 'Total Debits', 'End Exposure'],
    ...weeklySchedule.map(w => [
      w.week,
      fmtNoDecimals(w.cashInfusion),
      fmtNoDecimals(w.totalDebits),
      fmtNoDecimals(w.endExposure)
    ])
  ];
  const weeklySheet = XLSX.utils.aoa_to_sheet(weeklyData);
  weeklySheet['!cols'] = [{ wch: 8 }, { wch: 18 }, { wch: 15 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(workbook, weeklySheet, 'Weekly Schedule');

  // Tab 5: Offer Details
  const offerData = [
    ['OFFER DETAILS & METRICS'],
    [''],
    ['DEAL METRICS'],
    ['Total Funding', fmtNoDecimals(metrics.totalFunding)],
    ['Net Advance', fmtNoDecimals(metrics.netAdvance)],
    ['Consolidation Fees', fmtNoDecimals(metrics.consolidationFees)],
    ['Rate', settings.rate.toFixed(3)],
    ['Total Payback', fmtNoDecimals(metrics.totalPayback)],
    ['# of Debits', metrics.numberOfDebits],
    ['Days to Payoff', metrics.totalDays],
    [''],
    ['EXPOSURE ANALYSIS'],
    ['Max Exposure', fmtNoDecimals(metrics.maxExposure)],
    ['Max Exposure Day', metrics.maxExposureDay],
    ['Last Day Exposed', metrics.lastDayExposed],
    [''],
    ['PROFIT ANALYSIS'],
    ['Total Cash Infused', fmtNoDecimals(metrics.totalCashInfusion)],
    ['Total Payback Collected', fmtNoDecimals(metrics.actualPaybackCollected)],
    ['Gross Profit', fmtNoDecimals(metrics.profit)],
    ['Deal True Factor', metrics.dealTrueFactor.toFixed(3)],
    [''],
    ['LEVERAGE ANALYSIS'],
    ['Current Leverage', fmtPct(metrics.currentLeverage)],
    ['New Leverage (SP)', fmtPct(metrics.sp * 100)],
  ];
  const offerSheet = XLSX.utils.aoa_to_sheet(offerData);
  offerSheet['!cols'] = [{ wch: 25 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(workbook, offerSheet, 'Offer Details');

  // Generate and save file
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const filename = `${sanitizeFilename(calculation.merchant_name || calculation.name)}_Reverse_Proposal_${new Date().toISOString().split('T')[0]}.xlsx`;
  saveAs(blob, filename);
}

// Export to PDF with branding
export async function exportToPDF(calculation: SavedCalculation) {
  const settings = calculation.settings as Settings;
  const positions = calculation.positions as Position[];
  const merchantRevenue = calculation.merchant_monthly_revenue || 0;
  
  const { dailySchedule, weeklySchedule, positionsWithDays, allExternalPositions, includedPositions, totalBalanceAll, totalCurrentDailyPaymentAll, metrics } = calculateSchedules(
    positions,
    settings,
    merchantRevenue
  );

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Colors - Avion branding
  const primaryColor: [number, number, number] = [30, 58, 138]; // Avion dark blue
  const accentColor: [number, number, number] = [59, 130, 246]; // Avion mid blue
  const lightBlue: [number, number, number] = [239, 246, 255]; // Light blue bg

  // Page 1: Cover and Summary
  // Header bar
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('AVION FUNDING', margin, 25);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Reverse Consolidation Proposal', margin, 35);

  // Merchant info
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(calculation.merchant_name || 'Merchant Proposal', margin, 65);
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Business Type: ${calculation.merchant_business_type || 'N/A'}`, margin, 75);
  doc.text(`Prepared: ${dateStr}`, margin, 82);

  // Summary boxes
  const boxWidth = (pageWidth - margin * 2 - 20) / 3;
  const boxY = 95;
  const boxHeight = 40;

  // Box 1: Total Funding
  doc.setFillColor(...lightBlue);
  doc.roundedRect(margin, boxY, boxWidth, boxHeight, 3, 3, 'F');
  doc.setTextColor(...primaryColor);
  doc.setFontSize(10);
  doc.text('TOTAL FUNDING', margin + boxWidth/2, boxY + 12, { align: 'center' });
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(fmtNoDecimals(metrics.totalFunding), margin + boxWidth/2, boxY + 28, { align: 'center' });

  // Box 2: New Daily Payment
  doc.setFillColor(...lightBlue);
  doc.roundedRect(margin + boxWidth + 10, boxY, boxWidth, boxHeight, 3, 3, 'F');
  doc.setTextColor(...primaryColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('NEW DAILY PAYMENT', margin + boxWidth + 10 + boxWidth/2, boxY + 12, { align: 'center' });
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(fmtNoDecimals(metrics.newDailyPayment), margin + boxWidth + 10 + boxWidth/2, boxY + 28, { align: 'center' });

  // Box 3: Weekly Savings
  doc.setFillColor(220, 252, 231);
  doc.roundedRect(margin + (boxWidth + 10) * 2, boxY, boxWidth, boxHeight, 3, 3, 'F');
  doc.setTextColor(22, 101, 52);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('WEEKLY SAVINGS', margin + (boxWidth + 10) * 2 + boxWidth/2, boxY + 12, { align: 'center' });
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(fmtNoDecimals(metrics.weeklySavings), margin + (boxWidth + 10) * 2 + boxWidth/2, boxY + 28, { align: 'center' });

  // Deal Summary Table
  doc.setFont('helvetica', 'normal');
  let currentY = 150;

  doc.setFillColor(...primaryColor);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.rect(margin, currentY, pageWidth - margin * 2, 10, 'F');
  doc.text('Deal Summary', margin + 5, currentY + 7);
  currentY += 15;

  autoTable(doc, {
    startY: currentY,
    head: [],
    body: [
      ['Net Advance', fmtNoDecimals(metrics.netAdvance), 'New Daily Payment', fmtNoDecimals(metrics.newDailyPayment)],
      ['Consolidation Fees', fmtNoDecimals(metrics.consolidationFees), 'New Weekly Payment', fmtNoDecimals(metrics.newWeeklyPayment)],
      ['Rate', settings.rate.toFixed(3), 'Payment Reduction', fmtPct(metrics.impliedDiscount * 100)],
      ['Term (Days)', metrics.numberOfDebits.toString(), 'Total Payback', fmtNoDecimals(metrics.totalPayback)],
    ],
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 5 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 40 },
      1: { cellWidth: 35 },
      2: { fontStyle: 'bold', cellWidth: 45 },
      3: { cellWidth: 35 },
    },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 15;

  // Savings highlight
  doc.setFillColor(220, 252, 231);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 35, 3, 3, 'F');
  doc.setTextColor(22, 101, 52);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('MONTHLY SAVINGS', margin + 10, currentY + 15);
  doc.setFontSize(20);
  doc.text(fmtNoDecimals(metrics.monthlySavings), margin + 10, currentY + 28);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Daily: ${fmtNoDecimals(metrics.dailySavings)}  |  Weekly: ${fmtNoDecimals(metrics.weeklySavings)}`, pageWidth - margin - 10, currentY + 22, { align: 'right' });

  // Page 2: Positions
  doc.addPage();
  
  // Header
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 25, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Current MCA Positions', margin, 17);

  autoTable(doc, {
    startY: 35,
    head: [['Include', 'Entity', 'Funded', 'Funded Amt', 'Balance', 'Daily', 'Days', 'Last Pay']],
    body: allExternalPositions.map(p => {
      const posWithDays = positionsWithDays.find(pwd => pwd.id === p.id);
      const hasAutoCalc = p.fundedDate && p.amountFunded !== null;
      return [
        p.includeInReverse !== false ? '✓' : '-',
        p.entity || 'Unknown',
        p.fundedDate ? format(new Date(p.fundedDate), 'MM/dd/yy') : '-',
        p.amountFunded !== null ? fmtNoDecimals(p.amountFunded) : '-',
        hasAutoCalc ? `${fmtNoDecimals(posWithDays?.balance || 0)}*` : fmtNoDecimals(posWithDays?.balance || 0),
        fmtNoDecimals(p.dailyPayment),
        (posWithDays?.daysLeft || 0).toString(),
        getFormattedLastPaymentDate(posWithDays?.daysLeft || 0)
      ];
    }),
    foot: [
      [`${includedPositions.length}/${allExternalPositions.length}`, 'REVERSING', '', '', fmtNoDecimals(metrics.totalBalance), fmtNoDecimals(metrics.totalCurrentDailyPayment), '', ''],
      ['', 'ALL POSITIONS', '', '', fmtNoDecimals(totalBalanceAll), fmtNoDecimals(totalCurrentDailyPaymentAll), '', '']
    ],
    theme: 'striped',
    headStyles: { fillColor: primaryColor, fontSize: 8 },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 15 },
      1: { cellWidth: 35 },
      2: { cellWidth: 22 },
      3: { cellWidth: 22 },
      4: { cellWidth: 25 },
      5: { cellWidth: 22 },
      6: { cellWidth: 15 },
      7: { cellWidth: 25 }
    },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 20;

  // Metrics section on same page if space
  if (currentY < pageHeight - 100) {
    doc.setFillColor(...primaryColor);
    doc.rect(margin, currentY, pageWidth - margin * 2, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Deal Metrics', margin + 5, currentY + 7);
    currentY += 15;

    autoTable(doc, {
      startY: currentY,
      head: [],
      body: [
        ['Max Exposure', fmtNoDecimals(metrics.maxExposure), 'Max Exposure Day', metrics.maxExposureDay.toString()],
        ['Total Cash Infused', fmtNoDecimals(metrics.totalCashInfusion), 'Payback Collected', fmtNoDecimals(metrics.actualPaybackCollected)],
        ['Gross Profit', fmtNoDecimals(metrics.profit), 'Deal True Factor', metrics.dealTrueFactor.toFixed(3)],
        ['Current Leverage', fmtPct(metrics.currentLeverage), 'New Leverage (SP)', fmtPct(metrics.sp * 100)],
      ],
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 5 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 40 },
        1: { cellWidth: 35 },
        2: { fontStyle: 'bold', cellWidth: 40 },
        3: { cellWidth: 35 },
      },
      margin: { left: margin, right: margin },
    });
  }

  // Page 3: Weekly Schedule
  doc.addPage();
  
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 25, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Weekly Payment Schedule', margin, 17);

  autoTable(doc, {
    startY: 35,
    head: [['Week', 'Cash Infusion', 'Total Debits', 'End Exposure']],
    body: weeklySchedule.slice(0, 52).map(w => [
      w.week.toString(),
      fmtNoDecimals(w.cashInfusion),
      fmtNoDecimals(w.totalDebits),
      fmtNoDecimals(w.endExposure)
    ]),
    theme: 'striped',
    headStyles: { fillColor: primaryColor, fontSize: 10 },
    styles: { fontSize: 9, cellPadding: 3 },
    margin: { left: margin, right: margin },
  });

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Avion Funding | ${calculation.name} | Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // Save PDF
  const filename = `${sanitizeFilename(calculation.merchant_name || calculation.name)}_Reverse_Proposal_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}

// Export Merchant-facing PDF (hides internal metrics)
export async function exportMerchantPDF(calculation: SavedCalculation) {
  const settings = calculation.settings as Settings;
  const positions = calculation.positions as Position[];
  const merchantRevenue = calculation.merchant_monthly_revenue || 0;
  
  const { positionsWithDays, includedPositions, metrics } = calculateSchedules(
    positions,
    settings,
    merchantRevenue
  );

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Colors - Avion branding
  const primaryColor: [number, number, number] = [30, 58, 138]; // Avion dark blue
  const successColor: [number, number, number] = [22, 163, 74]; // Green
  const lightBlue: [number, number, number] = [239, 246, 255]; // Light blue bg
  const lightGreen: [number, number, number] = [220, 252, 231]; // Light green bg
  const darkGreen: [number, number, number] = [21, 128, 61]; // Darker green for gradient effect

  // White label company name
  const companyName = settings.whiteLabelCompany?.trim() || 'AVION FUNDING';

  // Page 1: Main Offer
  // Header bar
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(companyName.toUpperCase(), margin, 25);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Your Consolidation Offer', margin, 35);

  // Merchant info
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(calculation.merchant_name || 'Merchant Proposal', margin, 60);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Prepared: ${dateStr}`, margin, 70);

  let currentY = 85;

  // Payment Comparison Section
  const boxWidth = (pageWidth - margin * 2 - 15) / 2;
  const boxHeight = 45;

  // Old Payment Box
  doc.setFillColor(254, 226, 226); // Light red
  doc.roundedRect(margin, currentY, boxWidth, boxHeight, 3, 3, 'F');
  doc.setTextColor(185, 28, 28); // Red
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('OLD PAYMENT', margin + boxWidth/2, currentY + 12, { align: 'center' });
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(`${fmtNoDecimals(metrics.totalCurrentDailyPayment)}/day`, margin + boxWidth/2, currentY + 28, { align: 'center' });
  doc.setFontSize(12);
  doc.text(`${fmtNoDecimals(metrics.totalCurrentDailyPayment * 5)}/week`, margin + boxWidth/2, currentY + 40, { align: 'center' });

  // New Payment Box
  doc.setFillColor(...lightGreen);
  doc.roundedRect(margin + boxWidth + 15, currentY, boxWidth, boxHeight, 3, 3, 'F');
  doc.setTextColor(...successColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('NEW PAYMENT', margin + boxWidth + 15 + boxWidth/2, currentY + 12, { align: 'center' });
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(`${fmtNoDecimals(metrics.newDailyPayment)}/day`, margin + boxWidth + 15 + boxWidth/2, currentY + 28, { align: 'center' });
  doc.setFontSize(12);
  doc.text(`${fmtNoDecimals(metrics.newWeeklyPayment)}/week`, margin + boxWidth + 15 + boxWidth/2, currentY + 40, { align: 'center' });

  currentY += boxHeight + 10;

  // Payment Reduction Badge
  doc.setFillColor(...successColor);
  const badgeWidth = 100;
  doc.roundedRect((pageWidth - badgeWidth) / 2, currentY, badgeWidth, 15, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`${(settings.dailyPaymentDecrease * 100).toFixed(0)}% PAYMENT REDUCTION`, pageWidth / 2, currentY + 10, { align: 'center' });

  currentY += 25;

  // ========== PROMINENT SAVINGS SECTION ==========
  const savingsBoxHeight = 70;
  const savingsFullWidth = pageWidth - margin * 2;
  
  // Full-width green gradient background
  doc.setFillColor(...successColor);
  doc.roundedRect(margin, currentY, savingsFullWidth, savingsBoxHeight, 5, 5, 'F');
  
  // Add a darker accent stripe at top
  doc.setFillColor(...darkGreen);
  doc.roundedRect(margin, currentY, savingsFullWidth, 18, 5, 5, 'F');
  doc.rect(margin, currentY + 10, savingsFullWidth, 8, 'F'); // Fill bottom corners
  
  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('YOUR SAVINGS', pageWidth / 2, currentY + 12, { align: 'center' });
  
  // Savings boxes inside
  const innerPadding = 10;
  const innerY = currentY + 22;
  const innerHeight = savingsBoxHeight - 28;
  const savingsColWidth = (savingsFullWidth - innerPadding * 4) / 3;
  
  // Daily Savings Box
  const dailyX = margin + innerPadding;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(dailyX, innerY, savingsColWidth, innerHeight, 3, 3, 'F');
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('DAILY', dailyX + savingsColWidth/2, innerY + 12, { align: 'center' });
  doc.setTextColor(...successColor);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(fmtNoDecimals(metrics.dailySavings), dailyX + savingsColWidth/2, innerY + 28, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text('per day', dailyX + savingsColWidth/2, innerY + 38, { align: 'center' });
  
  // Weekly Savings Box
  const weeklyX = dailyX + savingsColWidth + innerPadding;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(weeklyX, innerY, savingsColWidth, innerHeight, 3, 3, 'F');
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('WEEKLY', weeklyX + savingsColWidth/2, innerY + 12, { align: 'center' });
  doc.setTextColor(...successColor);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(fmtNoDecimals(metrics.weeklySavings), weeklyX + savingsColWidth/2, innerY + 28, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text('per week', weeklyX + savingsColWidth/2, innerY + 38, { align: 'center' });
  
  // Monthly Savings Box (larger emphasis)
  const monthlyX = weeklyX + savingsColWidth + innerPadding;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(monthlyX, innerY, savingsColWidth, innerHeight, 3, 3, 'F');
  // Add border for emphasis
  doc.setDrawColor(...darkGreen);
  doc.setLineWidth(2);
  doc.roundedRect(monthlyX, innerY, savingsColWidth, innerHeight, 3, 3, 'S');
  doc.setTextColor(...darkGreen);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('MONTHLY', monthlyX + savingsColWidth/2, innerY + 12, { align: 'center' });
  doc.setTextColor(...successColor);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(fmtNoDecimals(metrics.monthlySavings), monthlyX + savingsColWidth/2, innerY + 28, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text('per month', monthlyX + savingsColWidth/2, innerY + 38, { align: 'center' });

  currentY += savingsBoxHeight + 12;

  // Cash You Receive (below savings)
  const cashBoxWidth = 140;
  const cashBoxHeight = 40;
  const cashX = (pageWidth - cashBoxWidth) / 2;
  doc.setFillColor(...lightBlue);
  doc.roundedRect(cashX, currentY, cashBoxWidth, cashBoxHeight, 3, 3, 'F');
  doc.setTextColor(...primaryColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('CONSOLIDATION', cashX + cashBoxWidth/2, currentY + 12, { align: 'center' });
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Position Buyout Only', cashX + cashBoxWidth/2, currentY + 28, { align: 'center' });

  currentY += cashBoxHeight + 15;

  // Deal Terms Section
  doc.setFillColor(...primaryColor);
  doc.rect(margin, currentY, pageWidth - margin * 2, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('DEAL TERMS', margin + 5, currentY + 8);
  currentY += 12;

  autoTable(doc, {
    startY: currentY,
    head: [['Amount Funded', 'Total Payback', 'Factor Rate', 'Origination Fee', '# of Payments']],
    body: [[
      fmtNoDecimals(metrics.totalFunding),
      fmtNoDecimals(metrics.totalPayback),
      settings.rate.toFixed(3),
      `${(settings.feePercent * 100).toFixed(1)}%`,
      metrics.numberOfDebits.toString()
    ]],
    theme: 'grid',
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 9, halign: 'center' },
    bodyStyles: { fontSize: 12, fontStyle: 'bold', halign: 'center' },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 20;

  // Positions Being Consolidated Section
  doc.setFillColor(...primaryColor);
  doc.rect(margin, currentY, pageWidth - margin * 2, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('POSITIONS BEING CONSOLIDATED', margin + 5, currentY + 8);
  currentY += 12;

  autoTable(doc, {
    startY: currentY,
    head: [['Funder', 'Current Balance', 'Daily Payment']],
    body: includedPositions.map(p => {
      const posWithDays = positionsWithDays.find(pwd => pwd.id === p.id);
      return [
        p.entity || 'Unknown Funder',
        fmtNoDecimals(posWithDays?.balance || 0),
        `${fmtNoDecimals(p.dailyPayment)}/day`
      ];
    }),
    foot: [[
      'TOTAL',
      fmtNoDecimals(metrics.totalBalance),
      `${fmtNoDecimals(metrics.totalCurrentDailyPayment)}/day`
    ]],
    theme: 'striped',
    headStyles: { fillColor: primaryColor, fontSize: 10 },
    footStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 4 },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 15;

  // Early Payoff Options Section (if enabled)
  if (settings.earlyPayOptions?.enabled && (settings.earlyPayOptions?.tiers || []).length > 0) {
    // Calculate when positions fall off
    const includedWithDays = positionsWithDays.filter(p => !p.isOurPosition && p.includeInReverse !== false && p.balance !== null && p.balance > 0);
    const falloffDay = includedWithDays.length > 0 ? Math.max(...includedWithDays.map(p => p.daysLeft || 0)) : 0;
    
    // Helper to get RTR balance at a specific day
    const getRtrAtDay = (day: number): number => {
      const { dailySchedule } = calculateSchedules(positions, settings, merchantRevenue);
      if (dailySchedule.length === 0) return 0;
      if (day >= dailySchedule.length) {
        const lastDay = dailySchedule[dailySchedule.length - 1];
        const daysAfterSchedule = day - dailySchedule.length;
        return Math.max(0, lastDay.rtrBalance - (daysAfterSchedule * metrics.newDailyPayment));
      }
      return dailySchedule[day - 1]?.rtrBalance || 0;
    };
    
    const tiers = (settings.earlyPayOptions?.tiers || []).sort((a, b) => a.daysAfterFalloff - b.daysAfterFalloff);
    
    // Check if we need a new page
    if (currentY > pageHeight - 100) {
      doc.addPage();
      currentY = 20;
    }
    
    // EPO Header
    doc.setFillColor(...successColor);
    doc.rect(margin, currentY, pageWidth - margin * 2, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('💸 EARLY PAYOFF OPTIONS', margin + 5, currentY + 8);
    currentY += 12;
    
    // EPO description
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Pay off your balance early after positions clear and save:', margin, currentY + 8);
    currentY += 15;
    
    // EPO table
    autoTable(doc, {
      startY: currentY,
      head: [['Pay By', 'Payoff Amount', 'You Save']],
      body: tiers.map(tier => {
        const payoffDeadline = falloffDay + tier.daysAfterFalloff;
        const rtrAtDeadline = getRtrAtDay(payoffDeadline);
        const discountedPayoff = rtrAtDeadline * (1 - tier.discountPercent);
        const savings = rtrAtDeadline * tier.discountPercent;
        
        return [
          `Day ${payoffDeadline} (${tier.daysAfterFalloff} days after)`,
          fmtNoDecimals(discountedPayoff),
          `${fmtNoDecimals(savings)} (${(tier.discountPercent * 100).toFixed(0)}% off)`
        ];
      }),
      theme: 'striped',
      headStyles: { fillColor: successColor, fontSize: 10 },
      bodyStyles: { fontSize: 10 },
      styles: { cellPadding: 4 },
      margin: { left: margin, right: margin },
    });
    
    currentY = (doc as any).lastAutoTable.finalY + 5;
    
    // EPO footnote
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`* Positions fall off on Day ${falloffDay}. Days are business days from deal start.`, margin, currentY + 5);
  }

  // Footer (use white label company name)
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `${companyName} | ${calculation.merchant_name || calculation.name} | ${dateStr}`,
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  );

  // Save PDF
  const filename = `${sanitizeFilename(calculation.merchant_name || calculation.name)}_Merchant_Offer_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}

// Export Enhanced Merchant Cash Buildup Report PDF (multi-page with savings focus)
export async function exportMerchantCashReport(calculation: SavedCalculation) {
  const settings = calculation.settings as Settings;
  const positions = calculation.positions as Position[];
  const merchantRevenue = calculation.merchant_monthly_revenue || 0;
  
  const { positionsWithDays, includedPositions, metrics, dailySchedule } = calculateSchedules(
    positions,
    settings,
    merchantRevenue
  );

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Colors
  const primaryColor: [number, number, number] = [30, 58, 138];
  const successColor: [number, number, number] = [22, 163, 74];
  const lightGreen: [number, number, number] = [220, 252, 231];
  const darkGreen: [number, number, number] = [21, 128, 61];

  // White label company name
  const companyName = settings.whiteLabelCompany?.trim() || 'AVION FUNDING';

  // Calculate position timeline
  const positionTimeline = includedPositions
    .map(p => {
      const posWithDays = positionsWithDays.find(pwd => pwd.id === p.id);
      const balance = posWithDays?.balance || 0;
      const daysUntilPayoff = posWithDays?.daysLeft || 0;
      return {
        entity: p.entity || 'Unknown Funder',
        balance,
        dailyPayment: p.dailyPayment,
        daysUntilPayoff,
        payoffDate: getFormattedLastPaymentDate(daysUntilPayoff)
      };
    })
    .sort((a, b) => a.daysUntilPayoff - b.daysUntilPayoff);

  // Calculate weekly projection
  const maxDay = positionTimeline.length > 0 
    ? Math.max(...positionTimeline.map(p => p.daysUntilPayoff)) 
    : 0;
  const totalWeeks = Math.ceil(maxDay / 5);
  const weeklyProjection: Array<{week: number; oldPayment: number; newPayment: number; savings: number; cumulativeSavings: number}> = [];
  let cumulativeSavings = 0;

  for (let week = 1; week <= Math.min(totalWeeks, 26); week++) {
    const oldPayment = metrics.totalCurrentDailyPayment * 5;
    const newPayment = metrics.newDailyPayment * 5;
    const savings = metrics.weeklySavings;
    cumulativeSavings += savings;
    weeklyProjection.push({ week, oldPayment, newPayment, savings, cumulativeSavings });
  }

  // Milestone calculations
  const month1Savings = Math.min(4, totalWeeks) * metrics.weeklySavings;
  const month3Savings = Math.min(12, totalWeeks) * metrics.weeklySavings;
  const month6Savings = Math.min(26, totalWeeks) * metrics.weeklySavings;
  const totalSavingsToPayoff = totalWeeks * metrics.weeklySavings;

  // ========== PAGE 1: EXECUTIVE SUMMARY ==========
  
  // Header bar
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(companyName.toUpperCase(), margin, 25);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Cash Flow Analysis', margin, 35);

  // Merchant info
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(calculation.merchant_name || 'Merchant Report', margin, 60);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Prepared: ${dateStr}`, margin, 70);

  let currentY = 85;

  // Big savings highlight box
  const savingsBoxHeight = 80;
  doc.setFillColor(...successColor);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, savingsBoxHeight, 5, 5, 'F');
  
  // Title stripe
  doc.setFillColor(...darkGreen);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 22, 5, 5, 'F');
  doc.rect(margin, currentY + 12, pageWidth - margin * 2, 10, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('YOUR SAVINGS AT A GLANCE', pageWidth / 2, currentY + 14, { align: 'center' });

  // Monthly savings (big number)
  doc.setFontSize(36);
  doc.text(fmtNoDecimals(metrics.monthlySavings), pageWidth / 2, currentY + 50, { align: 'center' });
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('PER MONTH', pageWidth / 2, currentY + 65, { align: 'center' });
  
  doc.setFontSize(11);
  doc.text(`That's ${fmtNoDecimals(totalSavingsToPayoff)} over ${totalWeeks} weeks!`, pageWidth / 2, currentY + 77, { align: 'center' });

  currentY += savingsBoxHeight + 15;

  // Quick stats row
  const statWidth = (pageWidth - margin * 2 - 20) / 3;
  const statHeight = 45;
  
  // Positions consolidated
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(margin, currentY, statWidth, statHeight, 3, 3, 'F');
  doc.setTextColor(...primaryColor);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('POSITIONS CONSOLIDATED', margin + statWidth/2, currentY + 12, { align: 'center' });
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(includedPositions.length.toString(), margin + statWidth/2, currentY + 32, { align: 'center' });

  // Total debt
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(margin + statWidth + 10, currentY, statWidth, statHeight, 3, 3, 'F');
  doc.setTextColor(...primaryColor);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('TOTAL DEBT BEING PAID', margin + statWidth + 10 + statWidth/2, currentY + 12, { align: 'center' });
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(fmtNoDecimals(metrics.totalBalance), margin + statWidth + 10 + statWidth/2, currentY + 32, { align: 'center' });

  // Days to clear
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(margin + (statWidth + 10) * 2, currentY, statWidth, statHeight, 3, 3, 'F');
  doc.setTextColor(...primaryColor);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('DAYS TO CLEAR ALL', margin + (statWidth + 10) * 2 + statWidth/2, currentY + 12, { align: 'center' });
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(maxDay.toString(), margin + (statWidth + 10) * 2 + statWidth/2, currentY + 32, { align: 'center' });

  currentY += statHeight + 15;

  // Payment comparison
  const compBoxWidth = (pageWidth - margin * 2 - 15) / 2;
  const compBoxHeight = 40;
  
  doc.setFillColor(254, 226, 226);
  doc.roundedRect(margin, currentY, compBoxWidth, compBoxHeight, 3, 3, 'F');
  doc.setTextColor(185, 28, 28);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('OLD PAYMENT', margin + compBoxWidth/2, currentY + 12, { align: 'center' });
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`${fmtNoDecimals(metrics.totalCurrentDailyPayment)}/day`, margin + compBoxWidth/2, currentY + 28, { align: 'center' });
  doc.setFontSize(10);
  doc.text(`${fmtNoDecimals(metrics.totalCurrentDailyPayment * 5)}/week`, margin + compBoxWidth/2, currentY + 38, { align: 'center' });

  doc.setFillColor(...lightGreen);
  doc.roundedRect(margin + compBoxWidth + 15, currentY, compBoxWidth, compBoxHeight, 3, 3, 'F');
  doc.setTextColor(...successColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('NEW PAYMENT', margin + compBoxWidth + 15 + compBoxWidth/2, currentY + 12, { align: 'center' });
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`${fmtNoDecimals(metrics.newDailyPayment)}/day`, margin + compBoxWidth + 15 + compBoxWidth/2, currentY + 28, { align: 'center' });
  doc.setFontSize(10);
  doc.text(`${fmtNoDecimals(metrics.newWeeklyPayment)}/week`, margin + compBoxWidth + 15 + compBoxWidth/2, currentY + 38, { align: 'center' });

  // ========== PAGE 2: POSITION PAYOFF SCHEDULE ==========
  doc.addPage();
  
  // Header
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('POSITION PAYOFF SCHEDULE', margin, 20);

  currentY = 45;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Each position will be paid off according to this schedule:', margin, currentY);
  currentY += 12;

  // Position table
  autoTable(doc, {
    startY: currentY,
    head: [['Funder', 'Balance', 'Daily Payment', 'Days to Payoff', 'Paid Off By']],
    body: positionTimeline.map(p => [
      p.entity,
      fmtNoDecimals(p.balance),
      `${fmtNoDecimals(p.dailyPayment)}/day`,
      `Day ${p.daysUntilPayoff}`,
      p.payoffDate
    ]),
    theme: 'striped',
    headStyles: { fillColor: primaryColor, fontSize: 10 },
    styles: { fontSize: 10, cellPadding: 5 },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 15;

  // All positions clear callout
  doc.setFillColor(...lightGreen);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 35, 3, 3, 'F');
  doc.setTextColor(...successColor);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('ALL POSITIONS CLEAR', margin + 10, currentY + 15);
  doc.setFontSize(18);
  doc.text(`Day ${maxDay}`, margin + 10, currentY + 28);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`(${getFormattedLastPaymentDate(maxDay)})`, margin + 60, currentY + 28);

  currentY += 50;

  // What this means section
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('What This Means For You', margin, currentY);
  currentY += 12;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const explanations = [
    `After Day ${maxDay}, all your existing funders will be fully paid off.`,
    `You'll continue with just ONE payment of ${fmtNoDecimals(metrics.newDailyPayment)}/day.`,
    `Your cash flow immediately improves by ${fmtNoDecimals(metrics.dailySavings)}/day.`,
    `Total savings by payoff: ${fmtNoDecimals(totalSavingsToPayoff)}`
  ];
  explanations.forEach((text, i) => {
    doc.text(`${i + 1}. ${text}`, margin + 5, currentY);
    currentY += 10;
  });

  // ========== PAGE 3: WEEKLY CASH FLOW PROJECTION ==========
  doc.addPage();
  
  // Header
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('WEEKLY CASH FLOW PROJECTION', margin, 20);

  currentY = 45;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('See how your savings accumulate week by week:', margin, currentY);
  currentY += 12;

  // Weekly table (show first 12 weeks)
  const displayWeeks = weeklyProjection.slice(0, 12);
  autoTable(doc, {
    startY: currentY,
    head: [['Week', 'Old Payment', 'New Payment', 'Weekly Savings', 'Cumulative Savings']],
    body: displayWeeks.map(w => [
      `Week ${w.week}`,
      fmtNoDecimals(w.oldPayment),
      fmtNoDecimals(w.newPayment),
      `+${fmtNoDecimals(w.savings)}`,
      fmtNoDecimals(w.cumulativeSavings)
    ]),
    theme: 'striped',
    headStyles: { fillColor: primaryColor, fontSize: 10 },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: {
      3: { textColor: successColor, fontStyle: 'bold' },
      4: { textColor: successColor, fontStyle: 'bold' }
    },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 20;

  // Milestone savings boxes
  doc.setFillColor(...successColor);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 15, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('KEY MILESTONES', margin + 5, currentY + 10);
  currentY += 20;

  const milestoneWidth = (pageWidth - margin * 2 - 20) / 3;
  const milestoneHeight = 50;

  // 1 Month
  doc.setFillColor(...lightGreen);
  doc.roundedRect(margin, currentY, milestoneWidth, milestoneHeight, 3, 3, 'F');
  doc.setTextColor(...successColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('AFTER 1 MONTH', margin + milestoneWidth/2, currentY + 12, { align: 'center' });
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(fmtNoDecimals(month1Savings), margin + milestoneWidth/2, currentY + 32, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('saved', margin + milestoneWidth/2, currentY + 44, { align: 'center' });

  // 3 Months
  doc.setFillColor(...lightGreen);
  doc.roundedRect(margin + milestoneWidth + 10, currentY, milestoneWidth, milestoneHeight, 3, 3, 'F');
  doc.setTextColor(...successColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('AFTER 3 MONTHS', margin + milestoneWidth + 10 + milestoneWidth/2, currentY + 12, { align: 'center' });
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(fmtNoDecimals(month3Savings), margin + milestoneWidth + 10 + milestoneWidth/2, currentY + 32, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('saved', margin + milestoneWidth + 10 + milestoneWidth/2, currentY + 44, { align: 'center' });

  // By payoff
  doc.setFillColor(...successColor);
  doc.roundedRect(margin + (milestoneWidth + 10) * 2, currentY, milestoneWidth, milestoneHeight, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('BY FULL PAYOFF', margin + (milestoneWidth + 10) * 2 + milestoneWidth/2, currentY + 12, { align: 'center' });
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(fmtNoDecimals(totalSavingsToPayoff), margin + (milestoneWidth + 10) * 2 + milestoneWidth/2, currentY + 32, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`(${totalWeeks} weeks)`, margin + (milestoneWidth + 10) * 2 + milestoneWidth/2, currentY + 44, { align: 'center' });

  // ========== PAGE 4: THE BOTTOM LINE ==========
  doc.addPage();
  
  // Header
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('THE BOTTOM LINE', margin, 20);

  currentY = 50;

  // Comparison section
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Without Consolidation vs. With Consolidation', pageWidth / 2, currentY, { align: 'center' });
  currentY += 15;

  const halfWidth = (pageWidth - margin * 2 - 10) / 2;
  const compareHeight = 80;

  // Without consolidation
  doc.setFillColor(254, 226, 226);
  doc.roundedRect(margin, currentY, halfWidth, compareHeight, 5, 5, 'F');
  doc.setTextColor(185, 28, 28);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('WITHOUT CONSOLIDATION', margin + halfWidth/2, currentY + 15, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Daily Payment: ${fmtNoDecimals(metrics.totalCurrentDailyPayment)}`, margin + halfWidth/2, currentY + 35, { align: 'center' });
  doc.text(`Weekly Payment: ${fmtNoDecimals(metrics.totalCurrentDailyPayment * 5)}`, margin + halfWidth/2, currentY + 48, { align: 'center' });
  doc.text(`Monthly Payment: ${fmtNoDecimals(metrics.totalCurrentDailyPayment * 22)}`, margin + halfWidth/2, currentY + 61, { align: 'center' });
  doc.text(`${includedPositions.length} separate payments to manage`, margin + halfWidth/2, currentY + 74, { align: 'center' });

  // With consolidation
  doc.setFillColor(...lightGreen);
  doc.roundedRect(margin + halfWidth + 10, currentY, halfWidth, compareHeight, 5, 5, 'F');
  doc.setTextColor(...successColor);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('WITH CONSOLIDATION', margin + halfWidth + 10 + halfWidth/2, currentY + 15, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Daily Payment: ${fmtNoDecimals(metrics.newDailyPayment)}`, margin + halfWidth + 10 + halfWidth/2, currentY + 35, { align: 'center' });
  doc.text(`Weekly Payment: ${fmtNoDecimals(metrics.newWeeklyPayment)}`, margin + halfWidth + 10 + halfWidth/2, currentY + 48, { align: 'center' });
  doc.text(`Monthly Payment: ${fmtNoDecimals(metrics.monthlySavings + metrics.newDailyPayment * 22)}`, margin + halfWidth + 10 + halfWidth/2, currentY + 61, { align: 'center' });
  doc.text('1 simple payment', margin + halfWidth + 10 + halfWidth/2, currentY + 74, { align: 'center' });

  currentY += compareHeight + 20;

  // Big total savings callout
  const bigBoxHeight = 70;
  doc.setFillColor(...successColor);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, bigBoxHeight, 5, 5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL SAVINGS OVER LIFE OF DEAL', pageWidth / 2, currentY + 20, { align: 'center' });
  doc.setFontSize(36);
  doc.text(fmtNoDecimals(totalSavingsToPayoff), pageWidth / 2, currentY + 50, { align: 'center' });

  currentY += bigBoxHeight + 25;

  // Call to action
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 40, 5, 5, 'F');
  doc.setTextColor(...primaryColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Ready to improve your cash flow?', pageWidth / 2, currentY + 18, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Contact us today to get started with your consolidation.', pageWidth / 2, currentY + 32, { align: 'center' });

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `${companyName} | Cash Flow Analysis for ${calculation.merchant_name || 'Merchant'} | Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // Save PDF
  const filename = `${sanitizeFilename(calculation.merchant_name || calculation.name)}_Cash_Report_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}
