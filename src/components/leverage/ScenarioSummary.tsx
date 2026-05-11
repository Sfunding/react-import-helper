import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Scenario, ScenarioRunResult } from '@/lib/scenarioTypes';
import { ScenarioSparkline } from '@/components/leverage/ScenarioSparkline';
import { LeverageBand, snapshot } from '@/lib/leverageMath';
import { addBusinessDays } from '@/lib/dateUtils';
import { format } from 'date-fns';
import { ArrowRight, CalendarDays, GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v || 0);
const fmtSigned = (v: number) => `${v >= 0 ? '+' : ''}${fmt(v)}`;
const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;
const fmtX = (v: number) => `${v.toFixed(2)}x`;

const bandClass = (b: LeverageBand) =>
  b === 'green'
    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
    : b === 'amber'
    ? 'bg-amber-100 text-amber-800 border-amber-300'
    : 'bg-rose-100 text-rose-800 border-rose-300';

interface StateColumnProps {
  title: string;
  subtitle?: string;
  totalBalance: number;
  totalDaily: number;
  monthlyRevenue: number;
}

function StateColumn({ title, subtitle, totalBalance, totalDaily, monthlyRevenue }: StateColumnProps) {
  const s = snapshot(totalBalance, totalDaily, monthlyRevenue);
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</div>
        {subtitle && <div className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</div>}
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-[10px] text-muted-foreground uppercase">Balance</div>
          <div className="text-base font-bold">{fmt(totalBalance)}</div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground uppercase">Daily</div>
          <div className="text-base font-bold">{fmt(totalDaily)}</div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground uppercase">Weekly</div>
          <div className="text-base font-bold">{fmt(totalDaily * 5)}</div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground uppercase">Monthly</div>
          <div className="text-base font-bold">{fmt(totalDaily * 22)}</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground uppercase">Lev:</span>
          <Badge variant="outline" className={bandClass(s.balanceBand)}>{fmtX(s.balanceLeverage)}</Badge>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground uppercase">Burd:</span>
          <Badge variant="outline" className={bandClass(s.burdenBand)}>{fmtPct(s.paymentBurden)}</Badge>
        </div>
      </div>
    </div>
  );
}

interface ScenarioSummaryProps {
  scenario: Scenario;
  scenarioRun: ScenarioRunResult;
  monthlyRevenue: number;
  onJumpToStep: (idx: number) => void;
}

export function ScenarioSummary({ scenario, scenarioRun, monthlyRevenue, onJumpToStep }: ScenarioSummaryProps) {
  const start = scenarioRun.checkpoints[0];
  const end = scenarioRun.finalState;
  const hasSteps = scenario.steps.length > 0;
  const today = useMemo(() => new Date(), []);

  const stepMarkers = useMemo(() => {
    return scenarioRun.checkpoints
      .filter(c => c.stepIndex >= 0)
      .map(c => {
        const step = scenario.steps[c.stepIndex];
        return {
          week: c.weekOffset,
          label: step ? `S${c.stepIndex + 1}` : '',
          kind: step?.kind || 'wait',
        };
      });
  }, [scenario.steps, scenarioRun.checkpoints]);

  if (!start) return null;

  return (
    <div className="space-y-4">
      {/* Starting state */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Starting state · As of today</CardTitle>
        </CardHeader>
        <CardContent>
          <StateColumn
            title="Today"
            totalBalance={start.totalBalance}
            totalDaily={start.totalDaily}
            monthlyRevenue={monthlyRevenue}
          />
        </CardContent>
      </Card>

      {/* Sequence */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" />
            Sequence
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!hasSteps ? (
            <div className="text-sm text-muted-foreground italic py-4 text-center">
              Add a step above to start modeling.
            </div>
          ) : (
            <ol className="space-y-2">
              {scenario.steps.map((step, idx) => {
                const before = scenarioRun.checkpoints[idx];
                const after = scenarioRun.checkpoints[idx + 1];
                if (!after) return null;
                const cash = after.cashToMerchantStep;
                const dDaily = after.totalDaily - (before?.totalDaily ?? 0);
                const stepDate = (step as { runOn?: string }).runOn
                  ? new Date((step as { runOn?: string }).runOn + 'T00:00:00')
                  : addBusinessDays(today, after.dayOffset);
                const dateLabel = format(stepDate, 'MMM d, yyyy');
                const action = after.stepLabel || step.kind;
                return (
                  <li key={step.id}>
                    <button
                      type="button"
                      onClick={() => onJumpToStep(idx)}
                      className="w-full text-left rounded-md border border-border bg-card hover:bg-accent hover:border-primary/40 transition-colors p-3 group"
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2 text-sm min-w-0">
                          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                            {dateLabel}
                          </span>
                          <span className="text-muted-foreground">·</span>
                          <span className="font-semibold truncate">Step {idx + 1}: {action}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs tabular-nums">
                          {cash !== 0 && (
                            <span className={cash >= 0 ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'}>
                              Cash {fmtSigned(cash)}
                            </span>
                          )}
                          {Math.abs(dDaily) > 0.5 && (
                            <span className={dDaily <= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                              Daily {fmtSigned(dDaily)}
                            </span>
                          )}
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      {/* Sparkline */}
      {hasSteps && (
        <ScenarioSparkline weekly={scenarioRun.weeklyExposure} stepMarkers={stepMarkers} />
      )}

      {/* Ending state */}
      {hasSteps && end && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ending state · Before / After</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <StateColumn
                title="Start"
                subtitle="Today"
                totalBalance={start.totalBalance}
                totalDaily={start.totalDaily}
                monthlyRevenue={monthlyRevenue}
              />
              <StateColumn
                title="End"
                subtitle={`After ${scenario.steps.length} step${scenario.steps.length === 1 ? '' : 's'} · ${end.weekOffset.toFixed(1)} wks`}
                totalBalance={end.totalBalance}
                totalDaily={end.totalDaily}
                monthlyRevenue={monthlyRevenue}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-md border border-border bg-card p-3">
                <div className="text-[10px] text-muted-foreground uppercase">Peak Combined Exposure</div>
                <div className="text-lg font-bold">{fmt(scenarioRun.peakCombinedExposure)}</div>
              </div>
              <div className="rounded-md border border-border bg-card p-3">
                <div className="text-[10px] text-muted-foreground uppercase">Total Cash to Merchant</div>
                <div className={`text-lg font-bold ${end.cashToMerchantCumulative < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {fmt(end.cashToMerchantCumulative)}
                </div>
              </div>
              <div className="rounded-md border border-border bg-card p-3">
                <div className="text-[10px] text-muted-foreground uppercase">Total Profit</div>
                <div className="text-lg font-bold">{fmt(end.profitCumulative)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
