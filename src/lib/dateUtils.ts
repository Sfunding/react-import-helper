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
