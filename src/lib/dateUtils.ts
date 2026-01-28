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
