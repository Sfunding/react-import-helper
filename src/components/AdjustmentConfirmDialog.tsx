import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v || 0);

const fmtPct = (v: number) => `${(v * 100).toFixed(0)}%`;

export type AdjustmentType = 'discount' | 'advance';

export interface DiscountChange {
  type: 'discount';
  oldValue: number;
  newValue: number;
  oldDailyPayment: number;
  newDailyPayment: number;
  oldDaysToPayoff: number;
  newDaysToPayoff: number;
}

export interface AdvanceChange {
  type: 'advance';
  oldAdvance: number;
  newAdvance: number;
  totalBalance: number;
  oldTotalFunding: number;
  newTotalFunding: number;
  oldRtr: number;
  newRtr: number;
  newDailyPayment: number;
  daysToPayoff: number;
}

export type PendingChange = DiscountChange | AdvanceChange;

interface AdjustmentConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingChange: PendingChange | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function AdjustmentConfirmDialog({
  open,
  onOpenChange,
  pendingChange,
  onConfirm,
  onCancel,
}: AdjustmentConfirmDialogProps) {
  if (!pendingChange) return null;

  const isDiscount = pendingChange.type === 'discount';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isDiscount ? 'Confirm Discount Adjustment' : 'Confirm Advance Adjustment'}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              {isDiscount ? (
                <>
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground uppercase">Current Discount</div>
                      <div className="text-lg font-bold text-foreground">{fmtPct(pendingChange.oldValue)}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground uppercase">New Discount</div>
                      <div className="text-lg font-bold text-primary">{fmtPct(pendingChange.newValue)}</div>
                    </div>
                  </div>
                  
                  <div className="bg-muted rounded-lg p-3 space-y-2">
                    <div className="text-xs font-semibold uppercase text-muted-foreground">Impact</div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">New Daily Payment:</span>
                      <span className="font-medium">
                        {fmt(pendingChange.oldDailyPayment)} → <span className="text-primary">{fmt(pendingChange.newDailyPayment)}</span>
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Days to Payoff:</span>
                      <span className="font-medium">
                        {pendingChange.oldDaysToPayoff} → <span className="text-primary">{pendingChange.newDaysToPayoff}</span>
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground uppercase">Current Advance</div>
                      <div className="text-lg font-bold text-foreground">{fmt(pendingChange.oldAdvance)}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground uppercase">New Advance</div>
                      <div className="text-lg font-bold text-primary">{fmt(pendingChange.newAdvance)}</div>
                    </div>
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    Total Position Balance (unchanged): <span className="font-semibold">{fmt(pendingChange.totalBalance)}</span>
                  </div>
                  
                  <div className="bg-muted rounded-lg p-3 space-y-2">
                    <div className="text-xs font-semibold uppercase text-muted-foreground">Impact</div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Total Funding:</span>
                      <span className="font-medium">
                        {fmt(pendingChange.oldTotalFunding)} → <span className="text-primary">{fmt(pendingChange.newTotalFunding)}</span>
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">RTR (Total Payback):</span>
                      <span className="font-medium">
                        {fmt(pendingChange.oldRtr)} → <span className="text-primary">{fmt(pendingChange.newRtr)}</span>
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Daily Payment:</span>
                      <span className="font-medium">{fmt(pendingChange.newDailyPayment)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Days to Payoff:</span>
                      <span className="font-medium">{pendingChange.daysToPayoff}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Confirm Change</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
