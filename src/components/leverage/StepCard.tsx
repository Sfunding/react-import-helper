import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { ArrowUp, ArrowDown, Copy, Trash2, Zap, Clock, PlusCircle, Repeat } from 'lucide-react';
import { ScenarioStep, ActivePosition } from '@/lib/scenarioTypes';
import { PaymentCadence } from '@/lib/leverageMath';

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v || 0);

const KIND_META: Record<ScenarioStep['kind'], { icon: React.ReactNode; label: string; color: string }> = {
  straight:       { icon: <Zap className="w-4 h-4" />,        label: 'Straight MCA',     color: 'bg-amber-100 text-amber-900 border-amber-300' },
  wait:           { icon: <Clock className="w-4 h-4" />,      label: 'Wait',             color: 'bg-slate-100 text-slate-800 border-slate-300' },
  'add-position': { icon: <PlusCircle className="w-4 h-4" />, label: 'Add Position',     color: 'bg-rose-100 text-rose-900 border-rose-300' },
  reverse:        { icon: <Repeat className="w-4 h-4" />,     label: 'Reverse',          color: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
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
}

export function StepCard({
  step, index, total, activeBeforeStep, checkpointNote,
  onChange, onMove, onDuplicate, onDelete,
}: StepCardProps) {
  const meta = KIND_META[step.kind];

  return (
    <Card className="border-l-4" style={{ borderLeftColor: 'hsl(var(--primary))' }}>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={meta.color}>
            <span className="mr-1 inline-flex">{meta.icon}</span>
            Step {index + 1} · {meta.label}
          </Badge>
          <div className="flex-1" />
          <Button size="icon" variant="ghost" onClick={() => onMove(-1)} disabled={index === 0}>
            <ArrowUp className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => onMove(1)} disabled={index === total - 1}>
            <ArrowDown className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onDuplicate}>
            <Copy className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onDelete}>
            <Trash2 className="w-4 h-4 text-rose-600" />
          </Button>
        </div>

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
        <div><span className="text-muted-foreground">Daily: </span><b>{fmt(daily)}</b></div>
        <div><span className="text-muted-foreground">Weekly: </span><b>{fmt(daily * 5)}</b></div>
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
      <div className="grid grid-cols-3 gap-2">
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
        <div className="col-span-2">
          <span className="text-muted-foreground">Term: </span><b>{termDays} biz days (~{(termDays / 5).toFixed(1)} wk)</b>
        </div>
      </div>
    </div>
  );
}
