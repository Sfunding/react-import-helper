import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Building2, Calendar, Clock, DollarSign, TrendingDown } from 'lucide-react';
import { getFormattedLastPaymentDate } from '@/lib/dateUtils';

type PositionDetailDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  entity: string;
  dailyPayment: number;
  remainingBalance: number;
  daysLeft: number;
  contextDay?: number;
  contextWeek?: number;
};

const fmt = (v: number) => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v || 0);

export function PositionDetailDialog({
  isOpen,
  onClose,
  entity,
  dailyPayment,
  remainingBalance,
  daysLeft,
  contextDay,
  contextWeek,
}: PositionDetailDialogProps) {
  const weeklyPayment = dailyPayment * 5;
  
  // Calculate context-specific remaining balance if viewing from a specific day/week
  let balanceAtContext = remainingBalance;
  let daysLeftAtContext = daysLeft;
  
  if (contextDay !== undefined && contextDay > 1) {
    // Subtract payments already made before this day
    const daysPaid = contextDay - 1;
    balanceAtContext = Math.max(0, remainingBalance - (dailyPayment * daysPaid));
    daysLeftAtContext = Math.max(0, daysLeft - daysPaid);
  } else if (contextWeek !== undefined && contextWeek > 1) {
    // Subtract payments already made before this week
    const daysPaid = (contextWeek - 1) * 5;
    balanceAtContext = Math.max(0, remainingBalance - (dailyPayment * daysPaid));
    daysLeftAtContext = Math.max(0, daysLeft - daysPaid);
  }
  
  const weeksLeftAtContext = Math.ceil(daysLeftAtContext / 5);
  const lastPaymentFromContext = getFormattedLastPaymentDate(daysLeftAtContext);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Building2 className="h-5 w-5" />
            {entity || 'Unnamed Funder'}
          </DialogTitle>
          <DialogDescription>
            {contextDay 
              ? `Position status as of Day ${contextDay}` 
              : contextWeek 
                ? `Position status as of Week ${contextWeek}`
                : 'Position details and payoff timeline'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Remaining Balance */}
          <div className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg border border-destructive/20">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/20 rounded-full">
                <TrendingDown className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <p className="font-medium text-foreground">Remaining Balance</p>
                <p className="text-xs text-muted-foreground">
                  {contextDay || contextWeek ? 'At this point' : 'Current balance'}
                </p>
              </div>
            </div>
            <span className="font-bold text-destructive text-lg">{fmt(balanceAtContext)}</span>
          </div>

          {/* Daily Payment */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg border border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-full">
                <DollarSign className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Daily Payment</p>
                <p className="text-xs text-muted-foreground">Weekly: {fmt(weeklyPayment)}</p>
              </div>
            </div>
            <span className="font-bold text-foreground">{fmt(dailyPayment)}</span>
          </div>

          {/* Days/Weeks Until Payoff */}
          <div className="flex items-center justify-between p-3 bg-info/10 rounded-lg border border-info/20">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-info/20 rounded-full">
                <Clock className="h-4 w-4 text-info" />
              </div>
              <div>
                <p className="font-medium text-foreground">Time Until Payoff</p>
                <p className="text-xs text-muted-foreground">
                  {daysLeftAtContext} business day{daysLeftAtContext !== 1 ? 's' : ''} remaining
                </p>
              </div>
            </div>
            <span className="font-bold text-info">{weeksLeftAtContext} week{weeksLeftAtContext !== 1 ? 's' : ''}</span>
          </div>

          {/* Last Payment Date */}
          <div className="flex items-center justify-between p-3 bg-success/10 rounded-lg border border-success/20">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success/20 rounded-full">
                <Calendar className="h-4 w-4 text-success" />
              </div>
              <div>
                <p className="font-medium text-foreground">Projected Payoff Date</p>
                <p className="text-xs text-muted-foreground">Based on business days</p>
              </div>
            </div>
            <span className="font-bold text-success">{lastPaymentFromContext}</span>
          </div>

          {/* Progress indicator */}
          {remainingBalance > 0 && balanceAtContext < remainingBalance && (
            <div className="p-3 bg-secondary/20 rounded-lg border border-secondary">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-muted-foreground">Payment Progress</span>
                <span className="font-medium">
                  {((1 - balanceAtContext / remainingBalance) * 100).toFixed(1)}% paid
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-success h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (1 - balanceAtContext / remainingBalance) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
