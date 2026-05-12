/**
 * Date utilities for business day calculations
 */

/**
 * Adds business days to a date (excludes weekends)
 */
export function addBusinessDays(startDate: Date, businessDays: number): Date {
  const date = new Date(startDate);
  let daysAdded = 0;
  
  while (daysAdded < businessDays) {
    date.setDate(date.getDate() + 1);
    const dayOfWeek = date.getDay();
    // Skip Saturday (6) and Sunday (0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      daysAdded++;
    }
  }
  
  return date;
}

/**
 * Calculates the last payment date for a position based on days left
 */
export function getLastPaymentDate(daysLeft: number): Date {
  return addBusinessDays(new Date(), daysLeft);
}

/**
 * Formats a date as a readable string (e.g., "Mar 15, 2026")
 */
export function formatBusinessDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Gets a formatted last payment date string from days left
 */
export function getFormattedLastPaymentDate(daysLeft: number): string {
  if (daysLeft <= 0) return '-';
  const date = getLastPaymentDate(daysLeft);
  return formatBusinessDate(date);
}

/**
 * Calculates the number of business days between two dates (excludes weekends)
 */
export function getBusinessDaysBetween(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  
  while (current < end) {
    current.setDate(current.getDate() + 1);
    const dayOfWeek = current.getDay();
    // Count only weekdays (Monday-Friday)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
  }
  
  return count;
}

/**
 * Signed business-day delta from `from` to `to`. Negative when `to` < `from`.
 */
export function businessDaysBetweenSigned(from: Date, to: Date): number {
  if (from.getTime() === to.getTime()) return 0;
  if (to < from) return -getBusinessDaysBetween(to, from);
  return getBusinessDaysBetween(from, to);
}

/**
 * Parse an ISO-like yyyy-MM-dd string into a local Date at midnight.
 */
export function parseISODateLocal(iso: string): Date {
  return new Date(iso + 'T00:00:00');
}

/**
 * Returns true if ISO date `a` is strictly before ISO date `b` (yyyy-MM-dd).
 * Safe lexicographic compare since both strings are zero-padded.
 */
export function isBeforeISODate(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a < b;
}

type RepriceablePosition = {
  balance: number | null;
  dailyPayment: number;
  fundedDate?: string | null;
  amountFunded?: number | null;
  balanceAsOfDate?: string | null;
  balanceAnchor?: 'funded' | 'manual' | null;
  frequency?: 'daily' | 'weekly';
};

/**
 * Re-prices a position's balance to a new as-of date based on its anchor.
 * - Funded anchor (fundedDate + amountFunded): cap = amountFunded, anchor date = fundedDate
 * - Manual anchor (balanceAsOfDate + balance): cap = anchor balance, anchor date = balanceAsOfDate
 * Returns the new balance (rounded to cents), or the original balance if no anchor.
 * For weekly positions, uses 5 daily-payment equivalents per week of elapsed business days.
 */
export function repricedBalance(p: RepriceablePosition, asOfDateISO: string): number | null {
  if (p.balance === null) return null;

  let anchorDate: string | null = null;
  let anchorBal: number | null = null;

  // Manual anchor wins when explicitly set — it represents a confirmed snapshot
  // (e.g., user-entered balance, or a projected balance locked in at scenario commit)
  // and reflects reality more faithfully than the linear funded model.
  const manualAnchored = p.balanceAnchor === 'manual' && !!p.balanceAsOfDate && p.balance != null;
  if (manualAnchored) {
    anchorDate = p.balanceAsOfDate!;
    anchorBal = p.balance!;
  } else if (p.fundedDate && p.amountFunded != null && p.amountFunded > 0) {
    anchorDate = p.fundedDate;
    anchorBal = p.amountFunded;
  } else if (p.balanceAsOfDate && p.balance != null) {
    anchorDate = p.balanceAsOfDate;
    anchorBal = p.balance;
  } else {
    return p.balance;
  }

  const from = parseISODateLocal(anchorDate);
  const to = parseISODateLocal(asOfDateISO);
  const days = businessDaysBetweenSigned(from, to);
  // Weekly positions still pay business-day equivalents (dailyPayment IS the daily-equivalent in this app's model)
  const paid = days * (p.dailyPayment || 0);
  const raw = anchorBal - paid;
  // No upper cap: rolling the as-of date BACKWARD from the anchor must allow the balance
  // to grow (the position had more balance owed in the past). Only clamp at zero on the
  // lower end. For funded anchors `anchorBal = amountFunded` so "before fundedDate" cases
  // are handled separately by the "not started yet" check in the calculator.
  const repriced = Math.max(0, raw);
  return Math.round(repriced * 100) / 100;
}

/**
 * Calculates remaining balance based on funded amount, daily payment, and business days elapsed
 */
export function calculateRemainingBalance(
  fundedDate: string | null,
  amountFunded: number | null,
  dailyPayment: number
): number | null {
  if (!fundedDate || amountFunded === null || amountFunded <= 0) {
    return null;
  }
  
  const funded = new Date(fundedDate);
  const today = new Date();
  const businessDaysElapsed = getBusinessDaysBetween(funded, today);
  const totalPaid = businessDaysElapsed * dailyPayment;
  const remaining = Math.max(0, amountFunded - totalPaid);
  
  return remaining;
}
