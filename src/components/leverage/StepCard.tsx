import React from 'react';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ArrowUp, ArrowDown, Copy, Trash2, Zap, Clock, PlusCircle, Repeat, Layers, CalendarIcon, GitBranch } from 'lucide-react';
import { ScenarioStep, ActivePosition } from '@/lib/scenarioTypes';
import { PaymentCadence } from '@/lib/leverageMath';
import { cn } from '@/lib/utils';

const RUN_LABEL: Record<Exclude<ScenarioStep['kind'], 'wait'>, string> = {
  straight: 'Fund on',
  'recurring-straight': 'First infusion on',
  'add-position': 'Position starts on',
  reverse: 'Reverse on',
};

function StepDatePicker({ step, onChange }: {
  step: Exclude<ScenarioStep, { kind: 'wait' }>;
  onChange: (s: ScenarioStep) => void;
}) {
  const runOn = step.runOn ? new Date(step.runOn + 'T00:00:00') : undefined;
  return (
    <div className="flex items-center gap-2">
      <Label className="text-xs whitespace-nowrap">{RUN_LABEL[step.kind]}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn('h-8 justify-start font-normal', !runOn && 'text-muted-foreground')}
          >
            <CalendarIcon className="w-3.5 h-3.5 mr-1.5" />
            {runOn ? format(runOn, 'EEE, MMM d, yyyy') : 'Immediate (after prior step)'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={runOn}
            onSelect={(d) => {
              if (!d) return;
              const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              onChange({ ...step, runOn: iso } as ScenarioStep);
            }}
            initialFocus
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
      {runOn && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-muted-foreground"
          onClick={() => onChange({ ...step, runOn: undefined } as ScenarioStep)}
        >
          Clear
        </Button>
      )}
    </div>
  );
}

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v || 0);

const KIND_META: Record<ScenarioStep['kind'], { icon: React.ReactNode; label: string; color: string }> = {
  straight:              { icon: <Zap className="w-4 h-4" />,        label: 'Straight MCA',           color: 'bg-amber-100 text-amber-900 border-amber-300' },
  'recurring-straight':  { icon: <Layers className="w-4 h-4" />,     label: 'Recurring Straight Program', color: 'bg-orange-100 text-orange-900 border-orange-300' },
  wait:                  { icon: <Clock className="w-4 h-4" />,      label: 'Wait',                   color: 'bg-slate-100 text-slate-800 border-slate-300' },
  'add-position':        { icon: <PlusCircle className="w-4 h-4" />, label: 'Add Position',           color: 'bg-rose-100 text-rose-900 border-rose-300' },
  reverse:               { icon: <Repeat className="w-4 h-4" />,     label: 'Reverse',                color: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
};

interface StepCardProps {
  step: ScenarioStep;
  index: number;
  total: number;
  activeBeforeStep: ActivePosition[];
  checkpointNote?: string;
  onChange: (next: ScenarioStep) => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onCommit?: () => void;
}

export function StepCard({
  step, index, total, activeBeforeStep, checkpointNote,
  onChange, onMove, onDuplicate, onDelete, onCommit,
}: StepCardProps) {
  const meta = KIND_META[step.kind];

  return (
    <Card className="border-l-4" style={{ borderLeftColor: 'hsl(var(--primary))' }}>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={meta.color}>
            <span className="mr-1 inline-flex">{meta.icon}</span>
            Step {index + 1} · {meta.label}
          </Badge>
          <Input
            value={step.label ?? ''}
            placeholder="Add a nickname (e.g. 'Bridge funding')"
            onChange={(e) => onChange({ ...step, label: e.target.value || undefined } as ScenarioStep)}
            className="h-8 text-sm max-w-xs flex-1 min-w-[160px]"
          />
          <div className="flex items-center">
            <Button size="icon" variant="ghost" onClick={() => onMove(-1)} disabled={index === 0}>
              <ArrowUp className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => onMove(1)} disabled={index === total - 1}>
              <ArrowDown className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={onDuplicate}>
              <Copy className="w-4 h-4" />
            </Button>
            {onCommit && (
              <Button size="icon" variant="ghost" onClick={onCommit} title="Commit to Calculator">
                <GitBranch className="w-4 h-4 text-primary" />
              </Button>
            )}
            <Button size="icon" variant="ghost" onClick={onDelete}>
              <Trash2 className="w-4 h-4 text-rose-600" />
            </Button>
          </div>
        </div>

        {step.kind !== 'wait' && (
          <div className="flex flex-wrap items-end gap-3">
            <StepDatePicker step={step} onChange={onChange} />
            {(step.kind === 'straight' || step.kind === 'reverse') && (
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Funder</Label>
                <Input
                  value={step.funderName ?? ''}
                  placeholder={step.kind === 'reverse' ? 'e.g. Avion Funding' : 'e.g. Velocity Capital'}
                  onChange={(e) => onChange({ ...step, funderName: e.target.value || undefined } as ScenarioStep)}
                  className="h-8 text-sm w-48"
                />
              </div>
            )}
          </div>
        )}

        {step.kind === 'straight' && (
          <StraightEditor
            step={step}
            active={activeBeforeStep}
            onChange={onChange}
          />
        )}
        {step.kind === 'wait' && (
          <WaitEditor step={step} onChange={onChange} />
        )}
        {step.kind === 'add-position' && (
          <AddPositionEditor step={step} onChange={onChange} />
        )}
        {step.kind === 'recurring-straight' && (
          <RecurringStraightEditor step={step} onChange={onChange} />
        )}
        {step.kind === 'reverse' && (
          <ReverseEditor step={step} active={activeBeforeStep} onChange={onChange} />
        )}

        {checkpointNote && (
          <div className="text-[11px] text-muted-foreground border-t border-border pt-2">
            {checkpointNote}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StraightEditor({ step, active, onChange }: {
  step: Extract<ScenarioStep, { kind: 'straight' }>;
  active: ActivePosition[];
  onChange: (s: ScenarioStep) => void;
}) {
  const payoffSet = new Set(step.payoffPositionIds);
  const togglePayoff = (id: string) => {
    const next = new Set(payoffSet);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange({ ...step, payoffPositionIds: Array.from(next) });
  };
  const payoffsTotal = active
    .filter(p => payoffSet.has(p.id))
    .reduce((s, p) => s + p.balance, 0);
  const grossDisplay = step.grossFunding > 0 ? step.grossFunding : payoffsTotal;
  const totalPayback = grossDisplay * step.factorRate;
  const termDays = Math.max(1, Math.round(step.termWeeks * 5));
  const daily = totalPayback / termDays;
  const netAdvance = grossDisplay * (1 - step.feePercent);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        <div>
          <Label className="text-xs">Advance ($)</Label>
          <Input type="number" value={step.grossFunding || ''}
            placeholder={fmt(payoffsTotal)}
            onChange={e => onChange({ ...step, grossFunding: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div>
          <Label className="text-xs">Factor</Label>
          <Input type="number" step="0.01" value={step.factorRate}
            onChange={e => onChange({ ...step, factorRate: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div>
          <Label className="text-xs">Fee %</Label>
          <Input type="number" step="0.01" value={step.feePercent}
            onChange={e => onChange({ ...step, feePercent: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div>
          <Label className="text-xs">Term (weeks)</Label>
          <Input type="number" value={step.termWeeks}
            onChange={e => onChange({ ...step, termWeeks: parseInt(e.target.value) || 1 })}
          />
        </div>
      </div>
      <div>
        <Label className="text-xs">Cadence</Label>
        <RadioGroup
          value={step.paymentCadence}
          onValueChange={(v: PaymentCadence) => onChange({ ...step, paymentCadence: v })}
          className="flex gap-4 mt-1"
        >
          <div className="flex items-center gap-1">
            <RadioGroupItem value="daily" id={`cad-d-${step.id}`} />
            <Label htmlFor={`cad-d-${step.id}`} className="text-xs">Daily</Label>
          </div>
          <div className="flex items-center gap-1">
            <RadioGroupItem value="weekly" id={`cad-w-${step.id}`} />
            <Label htmlFor={`cad-w-${step.id}`} className="text-xs">Weekly</Label>
          </div>
        </RadioGroup>
      </div>
      <div>
        <Label className="text-xs">Pay off (from active positions)</Label>
        <div className="space-y-1 max-h-36 overflow-y-auto border border-border rounded-md p-2">
          {active.length === 0 && <div className="text-xs text-muted-foreground">No active positions.</div>}
          {active.map(p => (
            <label key={p.id} className="flex items-center gap-2 text-xs">
              <Checkbox checked={payoffSet.has(p.id)} onCheckedChange={() => togglePayoff(p.id)} />
              <span className="flex-1 truncate">{p.entity}</span>
              <span className="text-muted-foreground">{fmt(p.balance)}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs border-t border-border pt-2">
        <div><span className="text-muted-foreground">Total Payback: </span><b>{fmt(totalPayback)}</b></div>
        <div><span className="text-muted-foreground">Net Advance: </span><b>{fmt(netAdvance)}</b></div>
        {step.paymentCadence === 'weekly' ? (
          <>
            <div><span className="text-muted-foreground">Weekly: </span><b className="text-primary">{fmt(daily * 5)}</b></div>
            <div><span className="text-muted-foreground">Daily equiv.: </span><b>{fmt(daily)}</b></div>
          </>
        ) : (
          <>
            <div><span className="text-muted-foreground">Daily: </span><b className="text-primary">{fmt(daily)}</b></div>
            <div><span className="text-muted-foreground">Weekly equiv.: </span><b>{fmt(daily * 5)}</b></div>
          </>
        )}
        <div className="col-span-2">
          <span className="text-muted-foreground">Cash to merchant this step: </span>
          <b className={netAdvance - payoffsTotal < 0 ? 'text-rose-600' : 'text-emerald-700'}>
            {fmt(netAdvance - payoffsTotal)}
          </b>
        </div>
      </div>
    </div>
  );
}

function WaitEditor({ step, onChange }: {
  step: Extract<ScenarioStep, { kind: 'wait' }>;
  onChange: (s: ScenarioStep) => void;
}) {
  return (
    <div>
      <Label className="text-xs">Wait duration (weeks)</Label>
      <Input type="number" value={step.weeks}
        onChange={e => onChange({ ...step, weeks: parseInt(e.target.value) || 0 })}
      />
      <div className="text-[11px] text-muted-foreground mt-1">
        Active positions pay down for {step.weeks} weeks ({step.weeks * 5} business days).
      </div>
    </div>
  );
}

function AddPositionEditor({ step, onChange }: {
  step: Extract<ScenarioStep, { kind: 'add-position' }>;
  onChange: (s: ScenarioStep) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div>
        <Label className="text-xs">Funder / Entity</Label>
        <Input value={step.entity} onChange={e => onChange({ ...step, entity: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs">Balance</Label>
        <Input type="number" value={step.balance || ''}
          onChange={e => onChange({ ...step, balance: parseFloat(e.target.value) || 0 })}
        />
      </div>
      <div>
        <Label className="text-xs">Daily Payment</Label>
        <Input type="number" value={step.dailyPayment || ''}
          onChange={e => onChange({ ...step, dailyPayment: parseFloat(e.target.value) || 0 })}
        />
      </div>
    </div>
  );
}

function ReverseEditor({ step, active, onChange }: {
  step: Extract<ScenarioStep, { kind: 'reverse' }>;
  active: ActivePosition[];
  onChange: (s: ScenarioStep) => void;
}) {
  const incSet = new Set(step.includedPositionIds);
  const toggle = (id: string) => {
    const next = new Set(incSet);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange({ ...step, includedPositionIds: Array.from(next) });
  };
  const included = active.filter(p => incSet.has(p.id) && p.balance > 0);
  const totalAdvance = included.reduce((s, p) => s + p.balance, 0);
  const totalDailyInc = included.reduce((s, p) => s + p.dailyPayment, 0);
  const totalFunding = step.feePercent < 1 ? totalAdvance / (1 - step.feePercent) : totalAdvance;
  const totalPayback = totalFunding * step.factorRate;
  const newDaily = totalDailyInc * (1 - step.dailyDecrease);
  const termDays = newDaily > 0 ? Math.ceil(totalPayback / newDaily) : 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        <div>
          <Label className="text-xs">Factor</Label>
          <Input type="number" step="0.01" value={step.factorRate}
            onChange={e => onChange({ ...step, factorRate: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div>
          <Label className="text-xs">Fee %</Label>
          <Input type="number" step="0.01" value={step.feePercent}
            onChange={e => onChange({ ...step, feePercent: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div>
          <Label className="text-xs">Daily Discount</Label>
          <Input type="number" step="0.05" value={step.dailyDecrease}
            onChange={e => onChange({ ...step, dailyDecrease: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div>
          <Label className="text-xs">Run at week (optional)</Label>
          <Input
            type="number"
            step="1"
            placeholder="immediate"
            value={step.runAtWeek ?? ''}
            onChange={e => {
              const v = e.target.value;
              onChange({ ...step, runAtWeek: v === '' ? undefined : Math.max(0, parseFloat(v) || 0) });
            }}
          />
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Fast-forward all positions to this week, then run.
          </div>
        </div>
      </div>
      <div>
        <Label className="text-xs">Positions consolidated (active at this point)</Label>
        <div className="space-y-1 max-h-44 overflow-y-auto border border-border rounded-md p-2">
          {active.length === 0 && <div className="text-xs text-muted-foreground">No active positions.</div>}
          {active.map(p => (
            <label key={p.id} className="flex items-center gap-2 text-xs">
              <Checkbox checked={incSet.has(p.id)} onCheckedChange={() => toggle(p.id)} />
              <span className="flex-1 truncate">
                {p.entity}
                {p.source === 'straight-rtr' && (
                  <Badge variant="outline" className="ml-1 bg-amber-50 text-amber-900 border-amber-300 text-[10px]">straight</Badge>
                )}
                {p.source === 'outside-added' && (
                  <Badge variant="outline" className="ml-1 bg-rose-50 text-rose-900 border-rose-300 text-[10px]">new</Badge>
                )}
              </span>
              <span className="text-muted-foreground">{fmt(p.balance)}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs border-t border-border pt-2">
        <div><span className="text-muted-foreground">Total Advance: </span><b>{fmt(totalAdvance)}</b></div>
        <div><span className="text-muted-foreground">Total Funding (Gross): </span><b>{fmt(totalFunding)}</b></div>
        <div><span className="text-muted-foreground">Total Payback: </span><b>{fmt(totalPayback)}</b></div>
        <div><span className="text-muted-foreground">New Daily: </span><b>{fmt(newDaily)}</b></div>
        <div><span className="text-muted-foreground">New Weekly: </span><b>{fmt(newDaily * 5)}</b></div>
        <div className="col-span-2">
          <span className="text-muted-foreground">Term: </span><b>{termDays} biz days (~{(termDays / 5).toFixed(1)} wk)</b>
        </div>
      </div>
    </div>
  );
}

function RecurringStraightEditor({ step, onChange }: {
  step: Extract<ScenarioStep, { kind: 'recurring-straight' }>;
  onChange: (s: ScenarioStep) => void;
}) {
  const count = Math.max(0, Math.floor(step.count));
  const termDays = Math.max(1, Math.round(step.termWeeks * 5));
  const paybackEach = step.amountEach * step.factorRate;
  const dailyEach = paybackEach / termDays;
  const netEach = step.amountEach * (1 - step.feePercent);
  const totalGross = step.amountEach * count;
  const totalPayback = paybackEach * count;
  const totalNet = netEach * count;
  const programWeeks = count > 0 ? (count - 1) * step.cadenceWeeks : 0;

  // Build the infusion ladder
  const ladder: Array<{ idx: number; weekFired: number; balanceAtEnd: number; daily: number }> = [];
  for (let i = 0; i < count; i++) {
    const weekFired = i * step.cadenceWeeks;
    // weeks left until program end (relative to last infusion)
    const businessDaysSinceFire = (programWeeks - weekFired) * 5;
    const paidDown = Math.min(paybackEach, dailyEach * businessDaysSinceFire);
    ladder.push({
      idx: i + 1,
      weekFired,
      balanceAtEnd: Math.max(0, paybackEach - paidDown),
      daily: paybackEach - paidDown > 0 ? dailyEach : 0,
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-xs"># of Straights</Label>
          <Input type="number" min={1} value={step.count}
            onChange={e => onChange({ ...step, count: Math.max(1, parseInt(e.target.value) || 1) })}
          />
        </div>
        <div>
          <Label className="text-xs">Every N weeks</Label>
          <Input type="number" step="0.5" min={0.5} value={step.cadenceWeeks}
            onChange={e => onChange({ ...step, cadenceWeeks: Math.max(0.5, parseFloat(e.target.value) || 1) })}
          />
        </div>
        <div>
          <Label className="text-xs">Amount each ($)</Label>
          <Input type="number" value={step.amountEach || ''}
            onChange={e => onChange({ ...step, amountEach: parseFloat(e.target.value) || 0 })}
          />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <div>
          <Label className="text-xs">Factor</Label>
          <Input type="number" step="0.01" value={step.factorRate}
            onChange={e => onChange({ ...step, factorRate: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div>
          <Label className="text-xs">Fee %</Label>
          <Input type="number" step="0.01" value={step.feePercent}
            onChange={e => onChange({ ...step, feePercent: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div>
          <Label className="text-xs">Term (weeks)</Label>
          <Input type="number" value={step.termWeeks}
            onChange={e => onChange({ ...step, termWeeks: Math.max(1, parseInt(e.target.value) || 1) })}
          />
        </div>
        <div>
          <Label className="text-xs">Cadence</Label>
          <RadioGroup
            value={step.paymentCadence}
            onValueChange={(v: PaymentCadence) => onChange({ ...step, paymentCadence: v })}
            className="flex gap-3 mt-2"
          >
            <div className="flex items-center gap-1">
              <RadioGroupItem value="daily" id={`rs-d-${step.id}`} />
              <Label htmlFor={`rs-d-${step.id}`} className="text-xs">Daily</Label>
            </div>
            <div className="flex items-center gap-1">
              <RadioGroupItem value="weekly" id={`rs-w-${step.id}`} />
              <Label htmlFor={`rs-w-${step.id}`} className="text-xs">Wk</Label>
            </div>
          </RadioGroup>
        </div>
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50/50 p-2">
        <div className="text-[11px] font-semibold text-amber-900 mb-1">Infusion Ladder</div>
        <div className="grid grid-cols-4 gap-x-2 text-[10px] font-semibold text-muted-foreground border-b border-amber-200 pb-1 mb-1">
          <div>#</div><div>Wk Fired</div><div>RTR Added</div><div>{step.paymentCadence === 'weekly' ? 'Weekly Added' : 'Daily Added'}</div>
        </div>
        <div className="max-h-40 overflow-y-auto">
          {ladder.map(r => (
            <div key={r.idx} className="grid grid-cols-4 gap-x-2 text-[11px] py-0.5">
              <div>#{r.idx}</div>
              <div>wk {r.weekFired}</div>
              <div>{fmt(paybackEach)}</div>
              <div>+{fmt(step.paymentCadence === 'weekly' ? dailyEach * 5 : dailyEach)}/{step.paymentCadence === 'weekly' ? 'wk' : 'd'}</div>
            </div>
          ))}
          {ladder.length === 0 && <div className="text-[11px] text-muted-foreground">No infusions.</div>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs border-t border-border pt-2">
        <div><span className="text-muted-foreground">Total Gross Funded: </span><b>{fmt(totalGross)}</b></div>
        <div><span className="text-muted-foreground">Total Net to Merchant: </span><b className="text-emerald-700">{fmt(totalNet)}</b></div>
        <div><span className="text-muted-foreground">Total Payback (all RTRs): </span><b>{fmt(totalPayback)}</b></div>
        <div><span className="text-muted-foreground">Program Length: </span><b>{programWeeks} wks</b></div>
        {step.paymentCadence === 'weekly' ? (
          <>
            <div><span className="text-muted-foreground">Weekly Added per Straight: </span><b className="text-primary">{fmt(dailyEach * 5)}</b></div>
            <div><span className="text-muted-foreground">Peak Weekly Stack (all open): </span><b className="text-rose-600">{fmt(dailyEach * 5 * count)}</b></div>
          </>
        ) : (
          <>
            <div><span className="text-muted-foreground">Daily Added per Straight: </span><b className="text-primary">{fmt(dailyEach)}</b></div>
            <div><span className="text-muted-foreground">Peak Daily Stack (all open): </span><b className="text-rose-600">{fmt(dailyEach * count)}</b></div>
          </>
        )}
      </div>
    </div>
  );
}
