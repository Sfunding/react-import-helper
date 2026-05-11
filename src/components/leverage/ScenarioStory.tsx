import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkpoint, Scenario } from '@/lib/scenarioTypes';
import { buildStory, storyFormatters } from '@/lib/scenarioNarrative';
import { CalendarDays } from 'lucide-react';

const { fmtMoney, fmtX, fmtPct } = storyFormatters;

function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

interface MetricRowProps {
  label: string;
  before: string;
  after: string;
  changeBetter?: boolean;
}
const MetricRow = ({ label, before, after, changeBetter }: MetricRowProps) => (
  <tr className="border-t border-border">
    <td className="py-1.5 text-muted-foreground">{label}</td>
    <td className="py-1.5 text-right tabular-nums">{before}</td>
    <td className="py-1.5 text-right tabular-nums font-semibold">
      <span className={changeBetter === undefined ? '' : changeBetter ? 'text-emerald-700' : 'text-rose-700'}>
        {after}
      </span>
    </td>
  </tr>
);

interface ScenarioStoryProps {
  scenario: Scenario;
  checkpoints: Checkpoint[];
}

export function ScenarioStory({ scenario, checkpoints }: ScenarioStoryProps) {
  const entries = buildStory(scenario, checkpoints);
  const baseline = checkpoints[0];
  const final = checkpoints[checkpoints.length - 1];
  const lastCadence: 'daily' | 'weekly' = entries.length > 0 ? entries[entries.length - 1].displayCadence : 'daily';

  if (!baseline) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" />
          Step-by-step Story
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
          <div className="font-semibold mb-1">Today · {todayLabel()}</div>
          <div className="text-muted-foreground">
            The merchant currently owes <b className="text-foreground">{fmtMoney(baseline.totalBalance)}</b> across
            their stack and pays <b className="text-foreground">{fmtMoney(baseline.totalDaily)}</b> daily
            (~{fmtMoney(baseline.totalDaily * 5)} weekly). Balance leverage{' '}
            <b className="text-foreground">{fmtX(baseline.balanceLeverage)}</b>, payment burden{' '}
            <b className="text-foreground">{fmtPct(baseline.paymentBurden)}</b>.
          </div>
        </div>

        {entries.length === 0 && (
          <div className="text-sm text-muted-foreground italic">
            Add a step to the scenario builder to start telling the story.
          </div>
        )}

        {entries.map((e) => (
          <div key={e.stepIndex} className="rounded-md border border-border p-3 space-y-3">
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <div className="font-semibold text-sm">{e.title}</div>
              <div className="text-xs text-muted-foreground">
                {e.dateLabel ? `${e.dateLabel} · Day ${e.dayOffset}` : `Day ${e.dayOffset}`}
              </div>
            </div>
            <p className="text-sm text-foreground/90 leading-relaxed">{e.sentence}</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left font-normal pb-1">Metric</th>
                  <th className="text-right font-normal pb-1">Before</th>
                  <th className="text-right font-normal pb-1">After</th>
                </tr>
              </thead>
              <tbody>
                <MetricRow
                  label="Total balance"
                  before={fmtMoney(e.before.totalBalance)}
                  after={fmtMoney(e.after.totalBalance)}
                  changeBetter={e.after.totalBalance < e.before.totalBalance}
                />
                <MetricRow
                  label={e.displayCadence === 'weekly' ? 'Weekly debits' : 'Daily debits'}
                  before={fmtMoney(e.displayCadence === 'weekly' ? e.before.totalDaily * 5 : e.before.totalDaily)}
                  after={fmtMoney(e.displayCadence === 'weekly' ? e.after.totalDaily * 5 : e.after.totalDaily)}
                  changeBetter={e.after.totalDaily < e.before.totalDaily}
                />
                <MetricRow
                  label="Balance leverage"
                  before={fmtX(e.before.balanceLeverage)}
                  after={fmtX(e.after.balanceLeverage)}
                  changeBetter={e.after.balanceLeverage < e.before.balanceLeverage}
                />
                <MetricRow
                  label="Payment burden"
                  before={fmtPct(e.before.paymentBurden)}
                  after={fmtPct(e.after.paymentBurden)}
                  changeBetter={e.after.paymentBurden < e.before.paymentBurden}
                />
              </tbody>
            </table>
          </div>
        ))}

        {final && entries.length > 0 && (
          <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm space-y-1">
            <div className="font-semibold text-emerald-900">Final state</div>
            <div className="text-emerald-900/80">
              After {entries.length} step{entries.length === 1 ? '' : 's'} ({final.weekOffset.toFixed(1)} weeks), the
              merchant's balance settles at <b>{fmtMoney(final.totalBalance)}</b> with daily debits of{' '}
              <b>{fmtMoney(final.totalDaily)}</b>. Total cash delivered: <b>{fmtMoney(final.cashToMerchantCumulative)}</b>.
              Gross profit booked: <b>{fmtMoney(final.profitCumulative)}</b>.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
