import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Position } from '@/types/calculation';
import { DollarSign, Building2, Banknote } from 'lucide-react';

export type BreakdownEntry = {
  entity: string;
  dailyPayment: number;
  daysContributing: number;
  totalContribution: number;
  isNewMoney?: boolean;
};

type ScheduleBreakdownDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  day?: number;
  week?: number;
  newMoney: number;
  entries: BreakdownEntry[];
  total: number;
};

const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v || 0);

export function ScheduleBreakdownDialog({
  isOpen,
  onClose,
  day,
  week,
  newMoney,
  entries,
  total
}: ScheduleBreakdownDialogProps) {
  const title = day ? `Day ${day} Breakdown` : week ? `Week ${week} Breakdown` : 'Cash Infusion Breakdown';
  const description = day 
    ? `Sources of cash infusion for Day ${day}` 
    : week 
      ? `Sources of cash infusion for Week ${week}` 
      : 'Breakdown of cash sources';

  const hasNewMoney = day === 1 && newMoney > 0;
  
  return (
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
          {/* New Money Entry */}
          {hasNewMoney && (
            <div className="flex items-center justify-between p-3 bg-success/10 rounded-lg border border-success/20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-success/20 rounded-full">
                  <DollarSign className="h-4 w-4 text-success" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">New Money (Cash to Merchant)</p>
                  <p className="text-xs text-muted-foreground">Additional cash on Day 1</p>
                </div>
              </div>
              <span className="font-bold text-success">{fmt(newMoney)}</span>
            </div>
          )}

          {/* Position Entries */}
          {entries.map((entry, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-muted rounded-lg border border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-full">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{entry.entity || 'Unnamed Funder'}</p>
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

          {/* Explanation */}
          {day === 1 && (
            <div className="p-3 bg-info/10 rounded-lg border border-info/20 mt-4">
              <p className="text-xs text-muted-foreground">
                <strong>Day 1 Explained:</strong> On the first day, you collect payments from existing funders for the entire first week (5 business days) 
                plus any New Money being provided to the merchant. This creates the initial cash pool to fund the consolidation.
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
