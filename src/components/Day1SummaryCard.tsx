import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calculator } from 'lucide-react';

type Day1SummaryCardProps = {
  cashInfused: number;
  originationFee: number;
  feePercent: number;
  grossContract: number;
  factorRate: number;
  day1Rtr: number;
  feeSchedule: string;
};

const fmt = (v: number) => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v || 0);

export function Day1SummaryCard({
  cashInfused,
  originationFee,
  feePercent,
  grossContract,
  factorRate,
  day1Rtr,
  feeSchedule
}: Day1SummaryCardProps) {
  const feeLabel = feeSchedule === 'upfront' ? 'Full Fee (Upfront)' : 'Proportional Fee';
  
  return (
    <Card className="mb-4 border-2 border-primary/20 bg-gradient-to-br from-muted to-muted/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-primary text-base">
          <Calculator className="h-4 w-4" />
          Day 1 Contract Formation
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left side: Cash + Fees = Gross */}
          <div className="space-y-2">
            <div className="flex justify-between items-center py-1">
              <span className="text-sm text-muted-foreground">Cash Infused</span>
              <span className="font-semibold">{fmt(cashInfused)}</span>
            </div>
            <div className="flex justify-between items-center py-1 text-destructive">
              <span className="text-sm">+ {feeLabel} ({(feePercent * 100).toFixed(0)}%)</span>
              <span className="font-semibold">{fmt(originationFee)}</span>
            </div>
            <div className="border-t-2 border-dashed border-border pt-2 flex justify-between items-center">
              <span className="text-sm font-medium">= Gross Contract</span>
              <span className="font-bold text-primary">{fmt(grossContract)}</span>
            </div>
          </div>
          
          {/* Right side: Gross × Rate = RTR */}
          <div className="space-y-2 md:border-l md:pl-4 border-border">
            <div className="flex justify-between items-center py-1">
              <span className="text-sm text-muted-foreground">Gross Contract</span>
              <span className="font-semibold">{fmt(grossContract)}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-sm text-muted-foreground">× Factor Rate</span>
              <span className="font-semibold">{factorRate.toFixed(3)}</span>
            </div>
            <div className="border-t-2 border-dashed border-border pt-2 flex justify-between items-center">
              <span className="text-sm font-medium">= Day 1 RTR</span>
              <span className="font-bold text-lg text-success">{fmt(day1Rtr)}</span>
            </div>
          </div>
        </div>
        
        <p className="text-xs text-muted-foreground mt-3 italic">
          RTR (Return to Repay) = (Cash + Fees) × Rate. This is the total amount to be collected.
        </p>
      </CardContent>
    </Card>
  );
}
