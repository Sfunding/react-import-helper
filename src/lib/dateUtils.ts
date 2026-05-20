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
  weeklyPullDay?: string | null;
};

const WEEKDAY_INDEX: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
};

/**
 * Count occurrences of a given weekday (e.g. "Wednesday") between two dates.
 * Signed: negative when `to` < `from`. Excludes `from`, includes `to` —
 * matching the convention used by `businessDaysBetweenSigned`.
 */
export function countWeekdayOccurrencesBetweenSigned(from: Date, to: Date, weekdayName: string): number {
  const target = WEEKDAY_INDEX[weekdayName];
  if (target === undefined) return 0;
  if (from.getTime() === to.getTime()) return 0;
  const sign = to < from ? -1 : 1;
  const [start, end] = sign === 1 ? [from, to] : [to, from];
  const cur = new Date(start); cur.setHours(0, 0, 0, 0);
  const stop = new Date(end); stop.setHours(0, 0, 0, 0);
  let count = 0;
  while (cur < stop) {
    cur.setDate(cur.getDate() + 1);
    if (cur.getDay() === target) count++;
  }
  return sign * count;
}

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

  let paid: number;
  if (p.frequency === 'weekly' && p.weeklyPullDay) {
    // Weekly position: only drops by a full weekly clip (5 × dailyPayment)
    // for each occurrence of its pull weekday strictly between anchor and as-of.
    const occurrences = countWeekdayOccurrencesBetweenSigned(from, to, p.weeklyPullDay);
    paid = occurrences * (p.dailyPayment || 0) * 5;
  } else {
    // Daily position: one daily-payment per business day elapsed (signed).
    const days = businessDaysBetweenSigned(from, to);
    paid = days * (p.dailyPayment || 0);
  }

  const raw = anchorBal - paid;
  // No upper cap: rolling the as-of date BACKWARD from the anchor must allow the balance
  // to grow. Only clamp at zero on the lower end.
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
