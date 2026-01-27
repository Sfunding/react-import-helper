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
  newMoney: number;
  currentExposure: number;
  advanceAmount?: number; // Deal-level advance amount - defaults to totalBalance if not set
};

export type Position = {
  id: number;
  entity: string;
  balance: number;
  dailyPayment: number;
  isOurPosition: boolean;
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

export const DEFAULT_SETTINGS: Settings = {
  dailyPaymentDecrease: 0.30,
  feeSchedule: 'average',
  feePercent: 0.09,
  rate: 1.499,
  brokerCommission: 0.00,
  newMoney: 0,
  currentExposure: 0
};

export type ScheduleBreakdown = {
  newMoney: number;
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
