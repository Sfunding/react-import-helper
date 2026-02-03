import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Building2, Banknote } from 'lucide-react';
import { PositionDetailDialog } from './PositionDetailDialog';

export type BreakdownEntry = {
  entity: string;
  dailyPayment: number;
  daysContributing: number;
  totalContribution: number;
  isNewMoney?: boolean;
  // Additional fields for drill-down
  remainingBalance: number;
  totalDaysLeft: number;
};

type ScheduleBreakdownDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  day?: number;
  week?: number;
  entries: BreakdownEntry[];
  total: number;
  // RTR/Fee info for Day 1 breakdown
  originationFee?: number;
  feePercent?: number;
  grossContract?: number;
  factorRate?: number;
  day1Rtr?: number;
  feeSchedule?: string;
};

const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v || 0);

export function ScheduleBreakdownDialog({
  isOpen,
  onClose,
  day,
  week,
  entries,
  total,
  originationFee = 0,
  feePercent = 0,
  grossContract = 0,
  factorRate = 0,
  day1Rtr = 0,
  feeSchedule = 'average'
}: ScheduleBreakdownDialogProps) {
  const [selectedPosition, setSelectedPosition] = useState<BreakdownEntry | null>(null);
  const title = day ? `Day ${day} Breakdown` : week ? `Week ${week} Breakdown` : 'Cash Infusion Breakdown';
  const description = day 
    ? `Sources of cash infusion for Day ${day}` 
    : week 
      ? `Sources of cash infusion for Week ${week}` 
      : 'Breakdown of cash sources';
  
  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-primary">
              <Banknote className="h-5 w-5" />
              {title}
            </SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>
          
        <div className="mt-6 space-y-4">
            {/* Position Entries - now clickable */}
            {entries.map((entry, i) => (
              <div 
                key={i} 
                className="flex items-center justify-between p-3 bg-muted rounded-lg border border-border cursor-pointer hover:bg-muted/80 hover:border-primary/50 transition-all"
                onClick={() => setSelectedPosition(entry)}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-full">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground flex items-center gap-1">
                      {entry.entity || 'Unnamed Funder'}
                      <span className="text-xs text-primary">→ View details</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fmt(entry.dailyPayment)}/day × {entry.daysContributing} day{entry.daysContributing !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <span className="font-bold text-foreground">{fmt(entry.totalContribution)}</span>
              </div>
            ))}

            {/* Total */}
            <div className="border-t-2 border-border pt-4 mt-4">
              <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg border-2 border-primary/20">
                <span className="font-bold text-primary text-lg">Total Cash Infusion</span>
                <span className="font-bold text-primary text-xl">{fmt(total)}</span>
              </div>
            </div>

            {/* RTR/Fee Breakdown for Day 1 */}
            {(day === 1 || week === 1) && originationFee > 0 && (
              <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 mt-4">
                <p className="text-sm font-semibold text-primary mb-2">📊 RTR Calculation</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cash Infused:</span>
                    <span className="font-medium">{fmt(total)}</span>
                  </div>
                  <div className="flex justify-between text-destructive">
                    <span>+ {feeSchedule === 'upfront' ? 'Full Fee' : 'Proportional Fee'} ({(feePercent * 100).toFixed(0)}%):</span>
                    <span className="font-medium">{fmt(originationFee)}</span>
                  </div>
                  <div className="border-t border-dashed border-border pt-1 flex justify-between">
                    <span className="font-medium">= Gross Contract:</span>
                    <span className="font-bold text-primary">{fmt(grossContract)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">× Factor Rate:</span>
                    <span className="font-medium">{factorRate.toFixed(3)}</span>
                  </div>
                  <div className="border-t border-dashed border-border pt-1 flex justify-between">
                    <span className="font-medium">= Day 1 RTR:</span>
                    <span className="font-bold text-success">{fmt(day1Rtr)}</span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Explanation */}
            {(day === 1 || week === 1) && (
              <div className="p-3 bg-info/10 rounded-lg border border-info/20 mt-4">
                <p className="text-xs text-muted-foreground">
                  <strong>Day 1 Explained:</strong> On the first day, you collect payments from existing funders for the entire first week (5 business days). 
                  This creates the initial cash pool to fund the consolidation.
                </p>
              </div>
            )}

            {/* Click hint */}
            {entries.length > 0 && (
              <p className="text-xs text-muted-foreground text-center italic">
                Click on any funder above to see remaining balance & payoff date
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Position Detail Dialog */}
      {selectedPosition && (
        <PositionDetailDialog
          isOpen={!!selectedPosition}
          onClose={() => setSelectedPosition(null)}
          entity={selectedPosition.entity}
          dailyPayment={selectedPosition.dailyPayment}
          remainingBalance={selectedPosition.remainingBalance}
          daysLeft={selectedPosition.totalDaysLeft}
          contextDay={day}
          contextWeek={week}
        />
      )}
    </>
  );
}
