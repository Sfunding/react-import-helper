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

  const totalPositions = positionTimeline.length;
  const maxDay = totalPositions > 0 
    ? Math.max(...positionTimeline.map(p => p.daysUntilPayoff)) 
    : 0;

  // Detect falloff weeks (weeks where a position finishes paying off)
  const falloffWeekMap = new Map<number, string[]>();
  positionTimeline.forEach(p => {
    const week = Math.ceil(p.daysUntilPayoff / 5);
    if (!falloffWeekMap.has(week)) falloffWeekMap.set(week, []);
    falloffWeekMap.get(week)!.push(p.entity);
  });

  // Active positions for a given week
  const getActivePositionsForWeek = (weekNum: number) => {
    return positionTimeline.filter(p => p.daysUntilPayoff > (weekNum - 1) * 5).length;
  };

  // Weekly projection using actual simulation data
  let cumulativeSavings = 0;
  const allWeeklyProjection = weeklySchedule.map((w) => {
    const weeklyCredits = w.cashInfusion;
    const yourPayment = w.totalDebits;
    const netCashFlow = weeklyCredits - yourPayment;
    cumulativeSavings += netCashFlow;
    const activePositions = getActivePositionsForWeek(w.week);
    const falloffEntities = falloffWeekMap.get(w.week) || [];
    return {
      week: w.week,
      weeklyCredits,
      yourPayment,
      netCashFlow,
      cumulativeSavings,
      activePositions,
      falloffEntities
    };
  });

  const displayedWeeks = showAllWeeks ? allWeeklyProjection : allWeeklyProjection.slice(0, 8);
  const finalCumulativeSavings = allWeeklyProjection.length > 0 
    ? allWeeklyProjection[allWeeklyProjection.length - 1].cumulativeSavings 
    : 0;

  // Milestones: daily savings multiplied by business days, capped at falloff
  const month1Savings = dailySavings * Math.min(22, maxDay);
  const month3Savings = dailySavings * Math.min(66, maxDay);

  // Cash flow savings only during the overlap period (while old positions are active)
  const falloffWeekNum = Math.ceil(maxDay / 5);
  const totalOldPaymentsDuringOverlap = weeklySchedule
    .filter(w => w.week <= falloffWeekNum)
    .reduce((sum, w) => sum + w.cashInfusion, 0);
  const totalNewPaymentsDuringOverlap = newDailyPayment * maxDay;
  const totalSavingsToPayoff = totalOldPaymentsDuringOverlap - totalNewPaymentsDuringOverlap;
  const weeksToPayoff = falloffWeekNum;

  // Cash accumulated at falloff = same as overlap savings
  const cashAccumulatedAtFalloff = totalSavingsToPayoff;

  // Crossover detection
  const crossoverWeekData = allWeeklyProjection.find(w => w.netCashFlow < 0);
  const crossoverWeekIndex = crossoverWeekData ? allWeeklyProjection.findIndex(w => w.netCashFlow < 0) : -1;
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
    <div className="space-y-4">
      {/* ── Hero Summary Bar ── */}
      <div className="rounded-xl border bg-muted/50 p-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-success/15 p-1.5">
              <DollarSign className="h-4 w-4 text-success" />
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Daily Savings</div>
              <div className="text-base font-bold text-success">{fmt(dailySavings)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-primary/15 p-1.5">
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Deal Term</div>
              <div className="text-base font-bold text-foreground">{numberOfDebits} debits</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-success/15 p-1.5">
              <PiggyBank className="h-4 w-4 text-success" />
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Total Saved</div>
              <div className="text-base font-bold text-success">{fmt(totalSavingsToPayoff)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-primary/15 p-1.5">
              <Target className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">New Payment</div>
              <div className="text-base font-bold text-foreground">{fmt(newDailyPayment)}/day</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Position Payoff Timeline ── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-primary" />
            Position Payoff Timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="py-2 text-xs">Funder</TableHead>
                <TableHead className="py-2 text-xs text-right">Balance</TableHead>
                <TableHead className="py-2 text-xs text-right">Daily Payment</TableHead>
                <TableHead className="py-2 text-xs text-right">Days to Payoff</TableHead>
                <TableHead className="py-2 text-xs text-right">Paid Off By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positionTimeline.map((p, i) => (
                <TableRow key={i}>
                  <TableCell className="py-2 font-medium text-sm">{p.entity}</TableCell>
                  <TableCell className="py-2 text-right text-sm">{fmt(p.balance)}</TableCell>
                  <TableCell className="py-2 text-right text-sm">{fmt(p.dailyPayment)}/day</TableCell>
                  <TableCell className="py-2 text-right font-semibold text-sm">Day {p.daysUntilPayoff}</TableCell>
                  <TableCell className="py-2 text-right text-muted-foreground text-sm">{p.payoffDate}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-3 pt-3 border-t border-border grid grid-cols-1 md:grid-cols-3 gap-3 text-center text-xs">
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
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="flex items-center gap-2 text-sm">
            <PiggyBank className="h-4 w-4 text-success" />
            Savings Milestones
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative rounded-lg border p-3 text-center overflow-hidden">
              <div className="absolute inset-x-0 bottom-0 h-1 bg-success/30">
                <div className="h-full bg-success" style={{ width: totalSavingsToPayoff > 0 ? `${Math.min((month1Savings / totalSavingsToPayoff) * 100, 100)}%` : '0%' }} />
              </div>
              <div className="text-[11px] text-muted-foreground uppercase font-medium mb-1">After 1 Month</div>
              <div className="text-xl font-bold text-success">{fmt(month1Savings)}</div>
              <div className="text-[11px] text-muted-foreground">saved</div>
            </div>
            <div className="relative rounded-lg border p-3 text-center overflow-hidden">
              <div className="absolute inset-x-0 bottom-0 h-1 bg-success/30">
                <div className="h-full bg-success" style={{ width: totalSavingsToPayoff > 0 ? `${Math.min((month3Savings / totalSavingsToPayoff) * 100, 100)}%` : '0%' }} />
              </div>
              <div className="text-[11px] text-muted-foreground uppercase font-medium mb-1">After 3 Months</div>
              <div className="text-xl font-bold text-success">{fmt(month3Savings)}</div>
              <div className="text-[11px] text-muted-foreground">saved</div>
            </div>
            <div className="rounded-lg bg-primary p-3 text-center text-primary-foreground">
              <div className="text-[11px] uppercase font-medium mb-1 opacity-90">While Positions Pay Off</div>
              <div className="text-2xl font-bold">{fmt(totalSavingsToPayoff)}</div>
              <div className="text-[11px] opacity-90">cash flow savings · {weeksToPayoff} weeks</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Crossover Point (conditional) ── */}
      {crossoverWeekData && cashAccumulatedAtCrossover !== null && (
        <Card className="border-info/30 bg-info/5">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="flex items-center gap-2 text-sm text-info">
              <ShieldCheck className="h-4 w-4" />
              Around Week {crossoverWeekData.week}, Your Savings Peak at {fmt(cashAccumulatedAtCrossover)}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-sm text-muted-foreground mb-3">
              By this point, <strong>{positionsClearedByCrossover}</strong> of your <strong>{totalPositions}</strong> positions 
              are fully paid off, reducing your total debt by <strong className="text-success">{fmt(totalDebtReduced)}</strong>.
            </p>
            <p className="text-sm text-muted-foreground mb-3">
              Yes, your new payment now exceeds what we're paying out — but that's because your old debts are gone. 
              Your business keeps that <strong className="text-success">{fmt(cashAccumulatedAtCrossover)}</strong> in accumulated cash 
              and operates with far less leverage.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-card p-2 text-center border">
                <div className="text-[11px] text-muted-foreground uppercase mb-0.5">Cash Saved</div>
                <div className="text-base font-bold text-success">{fmt(cashAccumulatedAtCrossover)}</div>
              </div>
              <div className="rounded-lg bg-card p-2 text-center border">
                <div className="text-[11px] text-muted-foreground uppercase mb-0.5">Debt Eliminated</div>
                <div className="text-base font-bold text-success">{fmt(totalDebtReduced)}</div>
              </div>
              <div className="rounded-lg bg-card p-2 text-center border">
                <div className="text-[11px] text-muted-foreground uppercase mb-0.5">Positions Cleared</div>
                <div className="text-base font-bold">{positionsClearedByCrossover} of {totalPositions}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Weekly Cash Flow Projection ── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4 text-primary" />
            Weekly Cash Flow Projection
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-2 text-xs w-14">Week</TableHead>
                  <TableHead className="py-2 text-xs text-center w-20">Active</TableHead>
                  <TableHead className="py-2 text-xs text-right">Weekly Credits</TableHead>
                  <TableHead className="py-2 text-xs text-right">Your Payment</TableHead>
                  <TableHead className="py-2 text-xs text-right">Net Cash Flow</TableHead>
                  <TableHead className="py-2 text-xs text-right">Cumulative</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedWeeks.map((w) => {
                  const hasFalloff = w.falloffEntities.length > 0;
                  const isNegative = w.netCashFlow < 0;
                  return (
                    <React.Fragment key={w.week}>
                      <TableRow className={cn(
                        isNegative && "bg-destructive/5",
                        hasFalloff && "border-l-2 border-l-primary"
                      )}>
                        <TableCell className="py-2 font-medium text-sm">Wk {w.week}</TableCell>
                        <TableCell className="py-2 text-center text-sm">
                          <span className={cn(
                            "inline-block px-1.5 py-0.5 rounded text-xs font-medium",
                            w.activePositions === totalPositions ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                          )}>
                            {w.activePositions}/{totalPositions}
                          </span>
                        </TableCell>
                        <TableCell className="py-2 text-right text-sm">{fmt(w.weeklyCredits)}</TableCell>
                        <TableCell className="py-2 text-right text-sm">{fmt(w.yourPayment)}</TableCell>
                        <TableCell className={cn("py-2 text-right font-semibold text-sm", w.netCashFlow >= 0 ? "text-success" : "text-destructive")}>
                          {w.netCashFlow >= 0 ? `+${fmt(w.netCashFlow)}` : fmt(w.netCashFlow)}
                        </TableCell>
                        <TableCell className={cn("py-2 text-right font-bold text-sm", w.cumulativeSavings >= 0 ? "text-success" : "text-destructive")}>
                          {fmt(w.cumulativeSavings)}
                        </TableCell>
                      </TableRow>
                      {hasFalloff && (
                        <TableRow className="border-0">
                          <TableCell colSpan={6} className="py-0.5 px-2">
                            <div className="text-[11px] text-primary font-medium pl-2">
                              ↳ {w.falloffEntities.join(', ')} paid off
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {allWeeklyProjection.length > 8 && (
            <div className="flex justify-center mt-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowAllWeeks(!showAllWeeks)}
                className="text-muted-foreground text-xs"
              >
                {showAllWeeks ? (
                  <><ChevronUp className="h-3 w-3 mr-1" /> Show less</>
                ) : (
                  <><ChevronDown className="h-3 w-3 mr-1" /> Show all {allWeeklyProjection.length} weeks</>
                )}
              </Button>
            </div>
          )}

          <div className={cn("mt-3 p-2 rounded-lg border", finalCumulativeSavings >= 0 ? "bg-success/10 border-success/20" : "bg-destructive/10 border-destructive/20")}>
            <p className="text-center text-sm">
              <span className="text-muted-foreground">After {allWeeklyProjection.length} weeks:</span>{' '}
              <span className={cn("font-bold text-base", finalCumulativeSavings >= 0 ? "text-success" : "text-destructive")}>{fmt(finalCumulativeSavings)} saved</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
