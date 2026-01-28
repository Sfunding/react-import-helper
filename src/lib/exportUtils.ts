import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  SavedCalculation, 
  Settings, 
  Position, 
  DayScheduleExport, 
  WeekScheduleExport 
} from '@/types/calculation';
import { getFormattedLastPaymentDate } from '@/lib/dateUtils';

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
  const externalPositions = positions.filter(p => !p.isOurPosition && p.balance > 0);
  const totalBalance = externalPositions.reduce((sum, p) => sum + (p.balance || 0), 0);
  // Advance amount is always equal to totalBalance (auto-calculated)
  const totalAdvanceAmount = totalBalance;
  const totalCurrentDailyPayment = externalPositions.reduce((sum, p) => sum + (p.dailyPayment || 0), 0);
  
  const positionsWithDays = positions.map(p => ({
    ...p,
    daysLeft: p.dailyPayment > 0 && p.balance > 0 ? Math.ceil(p.balance / p.dailyPayment) : 0
  }));

  // Use totalAdvanceAmount instead of totalBalance for funding calculations
  const totalFunding = (settings.newMoney + totalAdvanceAmount) / (1 - settings.feePercent);
  const netAdvance = totalFunding * (1 - settings.feePercent);
  const consolidationFees = totalFunding * settings.feePercent;
  const newDailyPayment = totalCurrentDailyPayment * (1 - settings.dailyPaymentDecrease);
  const newWeeklyPayment = newDailyPayment * 5;
  const sp = merchantMonthlyRevenue > 0 ? (newDailyPayment * 22) / merchantMonthlyRevenue : 0;
  
  const dailySavings = totalCurrentDailyPayment - newDailyPayment;
  const weeklySavings = dailySavings * 5;
  const monthlySavings = dailySavings * 22;

  // Generate daily schedule
  const dailySchedule: DayScheduleExport[] = [];
  let cumulativeNetFunded = 0;
  let cumulativeDebits = 0;
  let dealComplete = false;
  const maxDays = 500;
  const originationFee = consolidationFees;

  for (let day = 1; day <= maxDays; day++) {
    if (dealComplete) break;
    const week = Math.ceil(day / 5);
    const dayOfWeek = ((day - 1) % 5) + 1;
    const isPayDay = dayOfWeek === 1;

    let cashInfusion = 0;
    if (isPayDay) {
      if (day === 1) cashInfusion = settings.newMoney;
      for (let d = day; d <= day + 4 && d <= maxDays; d++) {
        const dayPayment = positionsWithDays
          .filter(p => !p.isOurPosition && p.balance > 0 && d <= p.daysLeft)
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
  const currentLeverage = merchantMonthlyRevenue > 0 ? (totalCurrentDailyPayment * 22) / merchantMonthlyRevenue * 100 : 0;

  return {
    dailySchedule,
    weeklySchedule,
    positionsWithDays,
    metrics: {
      totalBalance,
      totalAdvanceAmount,
      totalCurrentDailyPayment,
      totalFunding,
      netAdvance,
      consolidationFees,
      newDailyPayment,
      newWeeklyPayment,
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
  
  const { dailySchedule, weeklySchedule, positionsWithDays, metrics } = calculateSchedules(
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
    ['New Money', fmtNoDecimals(settings.newMoney)],
    [''],
    ['NEW PAYMENT TERMS'],
    ['New Daily Payment', fmtNoDecimals(metrics.newDailyPayment)],
    ['New Weekly Payment', fmtNoDecimals(metrics.newWeeklyPayment)],
    ['Payment Reduction', fmtPct(settings.dailyPaymentDecrease * 100)],
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

  // Tab 2: Current Positions
  const externalPositions = positionsWithDays.filter(p => !p.isOurPosition && p.balance > 0);
  const positionsData = [
    ['CURRENT MCA POSITIONS'],
    [''],
    ['Entity', 'Balance', 'Daily Payment', 'Days Left', 'Last Payment Date'],
    ...externalPositions.map(p => [
      p.entity || 'Unknown',
      fmtNoDecimals(p.balance),
      fmtNoDecimals(p.dailyPayment),
      p.daysLeft,
      getFormattedLastPaymentDate(p.daysLeft)
    ]),
    [''],
    ['TOTAL', fmtNoDecimals(metrics.totalBalance), fmtNoDecimals(metrics.totalCurrentDailyPayment), '', '']
  ];
  const positionsSheet = XLSX.utils.aoa_to_sheet(positionsData);
  positionsSheet['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 18 }];
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
  
  const { dailySchedule, weeklySchedule, positionsWithDays, metrics } = calculateSchedules(
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
      ['Rate', settings.rate.toFixed(3), 'Payment Reduction', fmtPct(settings.dailyPaymentDecrease * 100)],
      ['New Money', fmtNoDecimals(settings.newMoney), 'Days to Payoff', metrics.totalDays.toString()],
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

  const externalPositions = positionsWithDays.filter(p => !p.isOurPosition && p.balance > 0);
  
  autoTable(doc, {
    startY: 35,
    head: [['Entity', 'Balance', 'Daily Payment', 'Days Left', 'Last Payment']],
    body: externalPositions.map(p => [
      p.entity || 'Unknown',
      fmtNoDecimals(p.balance),
      fmtNoDecimals(p.dailyPayment),
      p.daysLeft.toString(),
      getFormattedLastPaymentDate(p.daysLeft)
    ]),
    foot: [['TOTAL', fmtNoDecimals(metrics.totalBalance), fmtNoDecimals(metrics.totalCurrentDailyPayment), '', '']],
    theme: 'striped',
    headStyles: { fillColor: primaryColor, fontSize: 10 },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 4 },
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
