export type Merchant = {
  name: string;
  businessType: string;
  monthlyRevenue: number;
};

export type Settings = {
  dailyPaymentDecrease: number;
  feeSchedule: string;
  feePercent: number;
  rate: number;
  brokerCommission: number;
  currentExposure: number;
  earlyPayOptions?: EarlyPaySettings;
  whiteLabelCompany?: string;  // Custom company name for PDF export (defaults to "Avion Funding")
  termDays: number | null;  // null = auto-calculate from discount, number = user-set term
  dailyPaymentOverride: number | null;  // null = auto-calculate, number = user-set payment
};

export type Position = {
  id: number;
  entity: string;
  balance: number | null;  // null = unknown balance
  dailyPayment: number;
  isOurPosition: boolean;
  includeInReverse: boolean;
  fundedDate: string | null;  // ISO date string when the position was funded
  amountFunded: number | null;  // Original funded amount for auto-balance calculation
};

export type SavedCalculation = {
  id: string;
  user_id: string;
  name: string;
  merchant_name: string | null;
  merchant_business_type: string | null;
  merchant_monthly_revenue: number | null;
  settings: Settings;
  positions: Position[];
  total_balance: number | null;
  total_daily_payment: number | null;
  created_at: string;
  updated_at: string;
};

export type CalculationState = {
  merchant: Merchant;
  settings: Settings;
  positions: Position[];
};

export const DEFAULT_MERCHANT: Merchant = {
  name: '',
  businessType: '',
  monthlyRevenue: 0
};

export type EarlyPayTier = {
  id: number;
  daysAfterFalloff: number;  // Days after all positions fall off
  discountPercent: number;   // Discount on remaining balance (0.10 = 10%)
};

export type EarlyPaySettings = {
  enabled: boolean;
  tiers: EarlyPayTier[];
};

export const DEFAULT_EPO_SETTINGS: EarlyPaySettings = {
  enabled: false,
  tiers: [
    { id: 1, daysAfterFalloff: 30, discountPercent: 0.10 },
    { id: 2, daysAfterFalloff: 60, discountPercent: 0.07 },
    { id: 3, daysAfterFalloff: 90, discountPercent: 0.05 },
  ]
};

export const DEFAULT_SETTINGS: Settings = {
  dailyPaymentDecrease: 0.30,
  feeSchedule: 'average',
  feePercent: 0.09,
  rate: 1.499,
  brokerCommission: 0.00,
  currentExposure: 0,
  earlyPayOptions: DEFAULT_EPO_SETTINGS,
  termDays: null,
  dailyPaymentOverride: null
};

export type ScheduleBreakdown = {
  entries: Array<{
    entity: string;
    dailyPayment: number;
    daysContributing: number;
    totalContribution: number;
  }>;
  total: number;
};

export type DayScheduleExport = {
  day: number;
  week: number;
  cashInfusion: number;
  dailyWithdrawal: number;
  exposureOnReverse: number;
  rtrBalance: number;
};

export type WeekScheduleExport = {
  week: number;
  cashInfusion: number;
  totalDebits: number;
  endExposure: number;
};
