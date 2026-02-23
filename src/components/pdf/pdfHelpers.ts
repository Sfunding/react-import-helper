/**
 * PDF-specific formatting helpers
 */

export const fmtCurrency = (v: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v || 0);

export const fmtPct1 = (v: number): string => `${(v || 0).toFixed(1)}%`;

export const fmtFactor = (v: number): string => (v || 0).toFixed(3);

export const fmtDate = (date?: Date): string => {
  const d = date || new Date();
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const fmtShortDate = (date: Date): string =>
  date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
