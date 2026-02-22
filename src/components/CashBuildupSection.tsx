import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { TrendingUp, Calendar, PiggyBank, ShieldCheck, ChevronDown, ChevronUp, DollarSign, Clock, Target } from 'lucide-react';
import { Position, WeekScheduleExport } from '@/types/calculation';
import { cn } from '@/lib/utils';
import { getFormattedLastPaymentDate } from '@/lib/dateUtils';

type CashBuildupSectionProps = {
  positions: Position[];
  totalCurrentDailyPayment: number;
  newDailyPayment: number;
  dailySavings: number;
  weeklySavings: number;
  monthlySavings: number;
  numberOfDebits: number;
  totalPayback: number;
  rtrAtFalloff: number;
  daysRemainingAfterFalloff: number;
  weeklySchedule: WeekScheduleExport[];
};

const fmt = (v: number) => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v || 0);

const getEffectiveBalance = (p: Position): number | null => p.balance;

export function CashBuildupSection({
  positions,
  totalCurrentDailyPayment,
  newDailyPayment,
  dailySavings,
  weeklySavings,
  monthlySavings,
  numberOfDebits,
  totalPayback,
  rtrAtFalloff,
  daysRemainingAfterFalloff,
  weeklySchedule
}: CashBuildupSectionProps) {
  const [showAllWeeks, setShowAllWeeks] = useState(false);

  const includedPositions = positions.filter(p => {
    const effectiveBalance = getEffectiveBalance(p);
    return !p.isOurPosition && p.includeInReverse !== false && effectiveBalance !== null && effectiveBalance > 0;
  });

  // Position timeline
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

  const maxDay = positionTimeline.length > 0 
    ? Math.max(...positionTimeline.map(p => p.daysUntilPayoff)) 
    : 0;

  // ── BUG FIX: Use actual w.totalDebits instead of newDailyPayment * 5 ──
  let cumulativeSavings = 0;
  const allWeeklyProjection = weeklySchedule.map((w) => {
    const oldPayment = w.cashInfusion;
    const newPayment = w.totalDebits; // ← actual debits from simulation
    const savings = oldPayment - newPayment;
    cumulativeSavings += savings;
    return {
      week: w.week,
      oldPayment,
      newPayment,
      savings,
      cumulativeSavings
    };
  });

  const displayedWeeks = showAllWeeks ? allWeeklyProjection : allWeeklyProjection.slice(0, 8);
  const finalCumulativeSavings = allWeeklyProjection.length > 0 
    ? allWeeklyProjection[allWeeklyProjection.length - 1].cumulativeSavings 
    : 0;

  // Milestones from real cumulative data
  const month1Savings = allWeeklyProjection.length >= 4 
    ? allWeeklyProjection[3].cumulativeSavings 
    : allWeeklyProjection.length > 0 ? allWeeklyProjection[allWeeklyProjection.length - 1].cumulativeSavings : 0;
  const month3Savings = allWeeklyProjection.length >= 12 
    ? allWeeklyProjection[11].cumulativeSavings 
    : allWeeklyProjection.length > 0 ? allWeeklyProjection[allWeeklyProjection.length - 1].cumulativeSavings : 0;

  // ── BUG FIX: Total savings uses actual debits ──
  let totalSavingsToPayoff = 0;
  weeklySchedule.forEach((w) => {
    totalSavingsToPayoff += w.cashInfusion - w.totalDebits;
  });
  const weeksToPayoff = weeklySchedule.length;

  // ── BUG FIX: Cash accumulated at falloff from real schedule ──
  const falloffWeek = Math.ceil(maxDay / 5);
  const cashAccumulatedAtFalloff = weeklySchedule
    .filter(w => w.week <= falloffWeek)
    .reduce((sum, w) => sum + (w.cashInfusion - w.totalDebits), 0);

  // Crossover detection from real data
  const crossoverWeekData = allWeeklyProjection.find(w => w.savings < 0);
  const crossoverWeekIndex = crossoverWeekData ? allWeeklyProjection.findIndex(w => w.savings < 0) : -1;
  const cashAccumulatedAtCrossover = crossoverWeekIndex > 0 
    ? allWeeklyProjection[crossoverWeekIndex - 1].cumulativeSavings 
    : crossoverWeekIndex === 0 ? 0 : null;

  const crossoverDay = crossoverWeekData ? crossoverWeekData.week * 5 : null;
  const positionsClearedByCrossover = crossoverDay !== null 
    ? positionTimeline.filter(p => p.daysUntilPayoff <= crossoverDay).length 
    : 0;
  const totalDebtReduced = crossoverDay !== null 
    ? positionTimeline.filter(p => p.daysUntilPayoff <= crossoverDay).reduce((sum, p) => sum + p.balance, 0) 
    : 0;

  if (includedPositions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Add positions to see cash buildup projections
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Hero Summary Bar ── */}
      <div className="rounded-xl border bg-gradient-to-r from-primary/10 via-accent/30 to-success/10 p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-success/15 p-2">
              <DollarSign className="h-5 w-5 text-success" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Daily Savings</div>
              <div className="text-lg font-bold text-success">{fmt(dailySavings)}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/15 p-2">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Deal Term</div>
              <div className="text-lg font-bold text-foreground">{numberOfDebits} debits</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-success/15 p-2">
              <PiggyBank className="h-5 w-5 text-success" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Saved</div>
              <div className="text-lg font-bold text-success">{fmt(totalSavingsToPayoff)}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/15 p-2">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">New Payment</div>
              <div className="text-lg font-bold text-foreground">{fmt(newDailyPayment)}/day</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Position Payoff Timeline ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
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
          {/* Footer with falloff stats folded in */}
          <div className="mt-3 pt-3 border-t border-border grid grid-cols-1 md:grid-cols-3 gap-3 text-center text-sm">
            <div>
              <span className="text-muted-foreground">All clear by </span>
              <span className="font-semibold text-foreground">Day {maxDay}</span>
              <span className="text-muted-foreground"> ({getFormattedLastPaymentDate(maxDay)})</span>
            </div>
            <div>
              <span className="text-muted-foreground">Cash accumulated: </span>
              <span className="font-semibold text-success">{fmt(cashAccumulatedAtFalloff)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Remaining with us: </span>
              <span className="font-semibold text-foreground">{fmt(rtrAtFalloff)}</span>
              <span className="text-muted-foreground"> ({daysRemainingAfterFalloff} days)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Savings Milestones ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <PiggyBank className="h-5 w-5 text-success" />
            Savings Milestones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative rounded-lg border p-4 text-center overflow-hidden">
              <div className="absolute inset-x-0 bottom-0 h-1 bg-success/30">
                <div className="h-full bg-success" style={{ width: totalSavingsToPayoff > 0 ? `${Math.min((month1Savings / totalSavingsToPayoff) * 100, 100)}%` : '0%' }} />
              </div>
              <div className="text-xs text-muted-foreground uppercase font-medium mb-1">After 1 Month</div>
              <div className="text-2xl font-bold text-success">{fmt(month1Savings)}</div>
              <div className="text-xs text-muted-foreground">saved</div>
            </div>
            <div className="relative rounded-lg border p-4 text-center overflow-hidden">
              <div className="absolute inset-x-0 bottom-0 h-1 bg-success/30">
                <div className="h-full bg-success" style={{ width: totalSavingsToPayoff > 0 ? `${Math.min((month3Savings / totalSavingsToPayoff) * 100, 100)}%` : '0%' }} />
              </div>
              <div className="text-xs text-muted-foreground uppercase font-medium mb-1">After 3 Months</div>
              <div className="text-2xl font-bold text-success">{fmt(month3Savings)}</div>
              <div className="text-xs text-muted-foreground">saved</div>
            </div>
            <div className="rounded-lg bg-success p-4 text-center text-success-foreground">
              <div className="text-xs uppercase font-medium mb-1 opacity-90">By Full Payoff</div>
              <div className="text-3xl font-bold">{fmt(totalSavingsToPayoff)}</div>
              <div className="text-xs opacity-90">total saved · {weeksToPayoff} weeks</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Crossover Point (conditional) ── */}
      {crossoverWeekData && cashAccumulatedAtCrossover !== null && (
        <Card className="border-info/30 bg-info/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-info">
              <ShieldCheck className="h-5 w-5" />
              Around Week {crossoverWeekData.week}, Your Savings Peak at {fmt(cashAccumulatedAtCrossover)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              By this point, <strong>{positionsClearedByCrossover}</strong> of your <strong>{includedPositions.length}</strong> positions 
              are fully paid off, reducing your total debt by <strong className="text-success">{fmt(totalDebtReduced)}</strong>.
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Yes, your new payment now exceeds what we're paying out — but that's because your old debts are gone. 
              Your business keeps that <strong className="text-success">{fmt(cashAccumulatedAtCrossover)}</strong> in accumulated cash 
              and operates with far less leverage.
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-card p-3 text-center border">
                <div className="text-xs text-muted-foreground uppercase mb-1">Cash Saved</div>
                <div className="text-lg font-bold text-success">{fmt(cashAccumulatedAtCrossover)}</div>
              </div>
              <div className="rounded-lg bg-card p-3 text-center border">
                <div className="text-xs text-muted-foreground uppercase mb-1">Debt Eliminated</div>
                <div className="text-lg font-bold text-success">{fmt(totalDebtReduced)}</div>
              </div>
              <div className="rounded-lg bg-card p-3 text-center border">
                <div className="text-xs text-muted-foreground uppercase mb-1">Positions Cleared</div>
                <div className="text-lg font-bold">{positionsClearedByCrossover} of {includedPositions.length}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Weekly Cash Flow Projection ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
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
                {displayedWeeks.map((w) => (
                  <TableRow key={w.week}>
                    <TableCell className="font-medium">Week {w.week}</TableCell>
                    <TableCell className="text-right text-destructive">{fmt(w.oldPayment)}</TableCell>
                    <TableCell className="text-right text-success">{fmt(w.newPayment)}</TableCell>
                    <TableCell className={cn("text-right font-semibold", w.savings >= 0 ? "text-success" : "text-destructive")}>
                      {w.savings >= 0 ? `+${fmt(w.savings)}` : fmt(w.savings)}
                    </TableCell>
                    <TableCell className={cn("text-right font-bold", w.cumulativeSavings >= 0 ? "text-success" : "text-destructive")}>
                      {fmt(w.cumulativeSavings)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {allWeeklyProjection.length > 8 && (
            <div className="flex justify-center mt-3">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowAllWeeks(!showAllWeeks)}
                className="text-muted-foreground"
              >
                {showAllWeeks ? (
                  <><ChevronUp className="h-4 w-4 mr-1" /> Show less</>
                ) : (
                  <><ChevronDown className="h-4 w-4 mr-1" /> Show all {allWeeklyProjection.length} weeks</>
                )}
              </Button>
            </div>
          )}

          <div className={cn("mt-4 p-3 rounded-lg border", finalCumulativeSavings >= 0 ? "bg-success/10 border-success/20" : "bg-destructive/10 border-destructive/20")}>
            <p className="text-center text-sm">
              <span className="text-muted-foreground">After {allWeeklyProjection.length} weeks:</span>{' '}
              <span className={cn("font-bold text-lg", finalCumulativeSavings >= 0 ? "text-success" : "text-destructive")}>{fmt(finalCumulativeSavings)} saved</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
