import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { TrendingUp, Calendar, PiggyBank } from 'lucide-react';
import { Position } from '@/types/calculation';
import { getFormattedLastPaymentDate, calculateRemainingBalance } from '@/lib/dateUtils';

type CashBuildupSectionProps = {
  positions: Position[];
  totalCurrentDailyPayment: number;
  newDailyPayment: number;
  dailySavings: number;
  weeklySavings: number;
  monthlySavings: number;
  totalDays: number;
};

// Helper to format currency
const fmt = (v: number) => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v || 0);

// Helper to get effective balance
const getEffectiveBalance = (p: Position): number | null => {
  const autoCalc = calculateRemainingBalance(p.fundedDate, p.amountFunded, p.dailyPayment);
  return autoCalc !== null ? autoCalc : p.balance;
};

export function CashBuildupSection({
  positions,
  totalCurrentDailyPayment,
  newDailyPayment,
  dailySavings,
  weeklySavings,
  monthlySavings,
  totalDays
}: CashBuildupSectionProps) {
  // Get only included positions with known balances
  const includedPositions = positions.filter(p => {
    const effectiveBalance = getEffectiveBalance(p);
    return !p.isOurPosition && p.includeInReverse !== false && effectiveBalance !== null && effectiveBalance > 0;
  });

  // Calculate position timeline (sorted by days to payoff)
  const positionTimeline = includedPositions
    .map(p => {
      const balance = getEffectiveBalance(p) || 0;
      const daysUntilPayoff = p.dailyPayment > 0 ? Math.ceil(balance / p.dailyPayment) : 0;
      return {
        entity: p.entity || 'Unknown Funder',
        balance,
        dailyPayment: p.dailyPayment,
        daysUntilPayoff,
        payoffDate: getFormattedLastPaymentDate(daysUntilPayoff)
      };
    })
    .sort((a, b) => a.daysUntilPayoff - b.daysUntilPayoff);

  // Calculate weekly cash flow projection (first 12 weeks)
  const totalWeeks = Math.min(Math.ceil(totalDays / 5), 12);
  const weeklyProjection = [];
  let cumulativeSavings = 0;

  for (let week = 1; week <= totalWeeks; week++) {
    const oldPayment = totalCurrentDailyPayment * 5;
    const newPayment = newDailyPayment * 5;
    const savings = weeklySavings;
    cumulativeSavings += savings;
    
    weeklyProjection.push({
      week,
      oldPayment,
      newPayment,
      savings,
      cumulativeSavings
    });
  }

  // Calculate milestone savings
  const maxDay = positionTimeline.length > 0 
    ? Math.max(...positionTimeline.map(p => p.daysUntilPayoff)) 
    : 0;
  const weeksToPayoff = Math.ceil(maxDay / 5);
  
  const month1Savings = Math.min(4, weeksToPayoff) * weeklySavings;
  const month3Savings = Math.min(12, weeksToPayoff) * weeklySavings;
  const totalSavingsToPayoff = weeksToPayoff * weeklySavings;

  if (includedPositions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Add positions to see cash buildup projections
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Milestones */}
      <Card className="border-2 border-success/30 bg-success/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-success">
            <PiggyBank className="h-5 w-5" />
            Money Back in Your Pocket
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card rounded-lg p-4 text-center border border-success/20">
              <div className="text-sm text-muted-foreground uppercase mb-1">After 1 Month</div>
              <div className="text-2xl font-bold text-success">{fmt(month1Savings)}</div>
              <div className="text-xs text-muted-foreground">saved</div>
            </div>
            <div className="bg-card rounded-lg p-4 text-center border border-success/20">
              <div className="text-sm text-muted-foreground uppercase mb-1">After 3 Months</div>
              <div className="text-2xl font-bold text-success">{fmt(month3Savings)}</div>
              <div className="text-xs text-muted-foreground">saved</div>
            </div>
            <div className="bg-success rounded-lg p-4 text-center text-success-foreground">
              <div className="text-sm uppercase mb-1 opacity-90">By Full Payoff</div>
              <div className="text-3xl font-bold">{fmt(totalSavingsToPayoff)}</div>
              <div className="text-xs opacity-90">total saved ({weeksToPayoff} weeks)</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Position Payoff Timeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Position Payoff Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funder</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Daily Payment</TableHead>
                <TableHead className="text-right">Days to Payoff</TableHead>
                <TableHead className="text-right">Paid Off By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positionTimeline.map((p, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{p.entity}</TableCell>
                  <TableCell className="text-right">{fmt(p.balance)}</TableCell>
                  <TableCell className="text-right">{fmt(p.dailyPayment)}/day</TableCell>
                  <TableCell className="text-right font-semibold">Day {p.daysUntilPayoff}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{p.payoffDate}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-sm text-muted-foreground text-center">
              All positions clear by <span className="font-semibold text-foreground">Day {maxDay}</span> ({getFormattedLastPaymentDate(maxDay)})
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Cash Flow Projection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Weekly Cash Flow Projection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Week</TableHead>
                  <TableHead className="text-right">Old Payment</TableHead>
                  <TableHead className="text-right">New Payment</TableHead>
                  <TableHead className="text-right">Weekly Savings</TableHead>
                  <TableHead className="text-right">Cumulative Savings</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {weeklyProjection.map((w) => (
                  <TableRow key={w.week}>
                    <TableCell className="font-medium">Week {w.week}</TableCell>
                    <TableCell className="text-right text-destructive">{fmt(w.oldPayment)}</TableCell>
                    <TableCell className="text-right text-success">{fmt(w.newPayment)}</TableCell>
                    <TableCell className="text-right font-semibold text-success">+{fmt(w.savings)}</TableCell>
                    <TableCell className="text-right font-bold text-success">{fmt(w.cumulativeSavings)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 p-3 bg-success/10 rounded-lg border border-success/20">
            <p className="text-center text-sm">
              <span className="text-muted-foreground">After {weeklyProjection.length} weeks:</span>{' '}
              <span className="font-bold text-success text-lg">{fmt(cumulativeSavings)} saved</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
