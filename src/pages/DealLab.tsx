import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { useCalculations } from '@/hooks/useCalculations';
import { ArrowLeft } from 'lucide-react';
import { useDealScenarios } from '@/hooks/useDealScenarios';
import { ScenarioTabs } from '@/components/leverage/ScenarioTabs';
import { ScenarioStory } from '@/components/leverage/ScenarioStory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Position, SavedCalculation } from '@/types/calculation';
import {
  snapshot,
  stackTotals,
  runScenario,
  projectStackToDate,
  LeverageBand,
} from '@/lib/leverageMath';
import { format } from 'date-fns';
import { getBusinessDaysBetween } from '@/lib/dateUtils';
import {
  Scenario,
  ScenarioStep,
  StepKind,
  makeStep,
  newScenario,
  reorderSteps,
} from '@/lib/scenarioTypes';
import { StepCard } from '@/components/leverage/StepCard';
import { ScenarioSparkline } from '@/components/leverage/ScenarioSparkline';
import { ScenarioSummary } from '@/components/leverage/ScenarioSummary';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { TrendingDown, AlertTriangle, Plus, FileDown, Layers, Zap, PlusCircle, Repeat } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v || 0);
const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;
const fmtX = (v: number) => `${v.toFixed(2)}x`;

const bandClass = (b: LeverageBand) =>
  b === 'green'
    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
    : b === 'amber'
    ? 'bg-amber-100 text-amber-800 border-amber-300'
    : 'bg-rose-100 text-rose-800 border-rose-300';

function MetricsBlock({
  title,
  totalBalance,
  totalDaily,
  monthlyRevenue,
}: {
  title: string;
  totalBalance: number;
  totalDaily: number;
  monthlyRevenue: number;
}) {
  const s = snapshot(totalBalance, totalDaily, monthlyRevenue);
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{title}</div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[10px] text-muted-foreground">Balance Leverage</div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">{fmtX(s.balanceLeverage)}</span>
            <Badge variant="outline" className={bandClass(s.balanceBand)}>
              {s.balanceBand}
            </Badge>
          </div>
          <div className="text-[10px] text-muted-foreground">balance ÷ monthly rev</div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground">Payment Burden</div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">{fmtPct(s.paymentBurden)}</span>
            <Badge variant="outline" className={bandClass(s.burdenBand)}>
              {s.burdenBand}
            </Badge>
          </div>
          <div className="text-[10px] text-muted-foreground">daily debits ÷ daily rev</div>
        </div>
      </div>
    </div>
  );
}

export default function DealLabPage() {
  const { id: routeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { calculations, isLoading } = useCalculations();
  const { toast } = useToast();

  const selectedId = routeId ?? '';

  // Scenario Builder state
  const [scenario, setScenario] = useState<Scenario>(() => newScenario());

  const selectedCalc: SavedCalculation | undefined = useMemo(
    () => calculations.find(c => c.id === selectedId),
    [calculations, selectedId]
  );

  // If finished loading and the deal doesn't exist, bounce back to calculator
  useEffect(() => {
    if (!isLoading && selectedId && !selectedCalc) {
      toast({ title: 'Deal not found', description: 'Returning to the calculator.', variant: 'destructive' });
      navigate('/', { replace: true });
    }
  }, [isLoading, selectedId, selectedCalc, navigate, toast]);

  // Revenue is always sourced from the loaded deal
  const monthlyRevenue = selectedCalc?.merchant_monthly_revenue ?? 0;

  const positions: Position[] = useMemo(
    () =>
      (selectedCalc?.positions || []).filter(
        p => !p.isOurPosition && (p.balance ?? 0) > 0 && (p.dailyPayment ?? 0) > 0
      ),
    [selectedCalc]
  );

  // As-of date stamped on the deal (fallback to created_at::date for legacy rows)
  const asOfDate: string = useMemo(() => {
    const stamped = (selectedCalc as unknown as { as_of_date?: string | null } | undefined)?.as_of_date;
    if (stamped) return stamped;
    const created = selectedCalc?.created_at;
    return created ? String(created).slice(0, 10) : format(new Date(), 'yyyy-MM-dd');
  }, [selectedCalc]);

  const todayIso = format(new Date(), 'yyyy-MM-dd');

  // Project the saved stack forward to today. All downstream lenses run against this.
  const projectedPositions = useMemo(
    () => projectStackToDate(positions, asOfDate, todayIso),
    [positions, asOfDate, todayIso]
  );

  const businessDaysSinceAsOf = useMemo(() => {
    const a = new Date(asOfDate + 'T00:00:00');
    const t = new Date(todayIso + 'T00:00:00');
    if (Number.isNaN(a.getTime()) || t <= a) return 0;
    return getBusinessDaysBetween(a, t);
  }, [asOfDate, todayIso]);

  const totals = stackTotals(positions);              // stored
  const projectedTotals = stackTotals(projectedPositions); // projected to today
  const weeklyPositions = positions.filter(p => p.frequency === 'weekly');


  // ---------------- Scenario Builder ----------------

  // ---------------- Multi-scenario plumbing ----------------
  const {
    rows: scenarioRows,
    isLoading: scenariosLoading,
    createScenario: createScenarioRow,
    updateScenario: updateScenarioRow,
    deleteScenario: deleteScenarioRow,
  } = useDealScenarios(selectedCalc?.id);

  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [lastSavedJson, setLastSavedJson] = useState<string>('');
  const [hasBootstrappedLegacy, setHasBootstrappedLegacy] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // When the deal loads, pick a scenario to display:
  React.useEffect(() => {
    if (!selectedCalc || scenariosLoading) return;
    if (activeScenarioId && scenarioRows.some(r => r.id === activeScenarioId)) return;
    if (scenarioRows.length > 0) {
      const pinned = scenarioRows.find(r => r.is_pinned) ?? scenarioRows[0];
      setActiveScenarioId(pinned.id);
      setScenario(pinned.scenario);
      setLastSavedJson(JSON.stringify(pinned.scenario));
      return;
    }
    if (hasBootstrappedLegacy) return;
    setHasBootstrappedLegacy(true);
    const legacy = (selectedCalc as unknown as { recommended_scenario?: { scenario?: Scenario } | null })
      .recommended_scenario;
    const seed = (legacy?.scenario && Array.isArray(legacy.scenario.steps)) ? legacy.scenario : newScenario();
    (async () => {
      const created = await createScenarioRow(legacy?.scenario ? 'Saved scenario' : 'Untitled Scenario', seed);
      if (created) {
        setActiveScenarioId(created.id);
        setScenario(created.scenario);
        setLastSavedJson(JSON.stringify(created.scenario));
      }
    })();
  }, [selectedCalc, scenariosLoading, scenarioRows, activeScenarioId, hasBootstrappedLegacy, createScenarioRow]);

  // Flush pending in-memory edits to the row before swapping away
  const flushPendingSave = React.useCallback(async () => {
    if (!activeScenarioId) return;
    const json = JSON.stringify(scenario);
    if (json === lastSavedJson) return;
    setSaveStatus('saving');
    const ok = await updateScenarioRow(activeScenarioId, { scenario, name: scenario.name });
    if (ok) {
      setLastSavedJson(json);
      setSaveStatus('saved');
    } else {
      setSaveStatus('error');
    }
  }, [activeScenarioId, scenario, lastSavedJson, updateScenarioRow]);

  // Switch active scenario → flush, then load
  const handleSelectScenario = async (id: string) => {
    if (id === activeScenarioId) return;
    await flushPendingSave();
    const row = scenarioRows.find(r => r.id === id);
    if (!row) return;
    setActiveScenarioId(id);
    setScenario(row.scenario);
    setLastSavedJson(JSON.stringify(row.scenario));
    setSaveStatus('idle');
  };

  const handleCreateScenario = async () => {
    await flushPendingSave();
    const created = await createScenarioRow('New scenario', newScenario());
    if (created) {
      setActiveScenarioId(created.id);
      setScenario(created.scenario);
      setLastSavedJson(JSON.stringify(created.scenario));
      setSaveStatus('idle');
    }
  };

  const handleDuplicateScenario = async (id: string) => {
    await flushPendingSave();
    const src = scenarioRows.find(r => r.id === id);
    if (!src) return;
    const copy: Scenario = { ...src.scenario, id: Math.random().toString(36).slice(2, 10) };
    const created = await createScenarioRow(`${src.name} (copy)`, copy);
    if (created) {
      setActiveScenarioId(created.id);
      setScenario(created.scenario);
      setLastSavedJson(JSON.stringify(created.scenario));
      setSaveStatus('idle');
    }
  };

  // Inline rename → update both row name and scenario.name (single source of truth)
  const handleRenameScenario = async (id: string, name: string) => {
    if (id === activeScenarioId) {
      setScenario(s => ({ ...s, name }));
    }
    const nextScenario = id === activeScenarioId ? { ...scenario, name } : undefined;
    const ok = await updateScenarioRow(id, nextScenario ? { name, scenario: nextScenario } : { name });
    if (ok && id === activeScenarioId && nextScenario) {
      setLastSavedJson(JSON.stringify(nextScenario));
    }
  };

  const handleDeleteScenario = async (id: string) => {
    if (scenarioRows.length <= 1) return;
    const ok = await deleteScenarioRow(id);
    if (ok && id === activeScenarioId) {
      const remaining = scenarioRows.filter(r => r.id !== id);
      const next = remaining[0];
      if (next) {
        setActiveScenarioId(next.id);
        setScenario(next.scenario);
        setLastSavedJson(JSON.stringify(next.scenario));
        setSaveStatus('idle');
      }
    }
  };

  const scenarioRun = useMemo(
    () => runScenario(projectedPositions, scenario, monthlyRevenue),
    [positions, scenario, monthlyRevenue]
  );

  const isDirty = activeScenarioId !== null && JSON.stringify(scenario) !== lastSavedJson;

  // Debounced auto-save: whenever scenario changes for the active row, save ~800ms later
  React.useEffect(() => {
    if (!activeScenarioId) return;
    const json = JSON.stringify(scenario);
    if (json === lastSavedJson) return;
    setSaveStatus('saving');
    const handle = setTimeout(async () => {
      const ok = await updateScenarioRow(activeScenarioId, { scenario, name: scenario.name });
      if (ok) {
        setLastSavedJson(json);
        setSaveStatus('saved');
      } else {
        setSaveStatus('error');
      }
    }, 800);
    return () => clearTimeout(handle);
  }, [scenario, activeScenarioId, lastSavedJson, updateScenarioRow]);

  const updateStep = (idx: number, next: ScenarioStep) =>
    setScenario(s => ({ ...s, steps: s.steps.map((st, i) => (i === idx ? next : st)) }));

  const addStep = (kind: StepKind) => {
    const newStep = makeStep(kind);
    if (newStep.kind === 'reverse') {
      const activeBefore = scenarioRun.checkpoints[scenarioRun.checkpoints.length - 1]?.activePositions ?? [];
      newStep.includedPositionIds = activeBefore.map(p => p.id);
    }
    setScenario(s => ({ ...s, steps: [...s.steps, newStep] }));
  };

  const moveStep = (idx: number, dir: -1 | 1) =>
    setScenario(s => ({ ...s, steps: reorderSteps(s.steps, idx, Math.max(0, Math.min(s.steps.length - 1, idx + dir))) }));

  const duplicateStep = (idx: number) =>
    setScenario(s => {
      const dup = { ...s.steps[idx], id: Math.random().toString(36).slice(2, 10) } as ScenarioStep;
      const next = s.steps.slice();
      next.splice(idx + 1, 0, dup);
      return { ...s, steps: next };
    });

  const deleteStep = (idx: number) =>
    setScenario(s => ({ ...s, steps: s.steps.filter((_, i) => i !== idx) }));

  const retrySave = async () => {
    if (!activeScenarioId) return;
    setSaveStatus('saving');
    const ok = await updateScenarioRow(activeScenarioId, { scenario, name: scenario.name });
    if (ok) {
      setLastSavedJson(JSON.stringify(scenario));
      setSaveStatus('saved');
    } else {
      setSaveStatus('error');
    }
  };

  const exportScenarioPDF = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Scenario Builder — Timeline', 40, 50);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Merchant: ${selectedCalc?.merchant_name || '-'}   Monthly Revenue: ${fmt(monthlyRevenue)}`,
      40, 68
    );
    doc.text(`Scenario: ${scenario.name}`, 40, 82);

    autoTable(doc, {
      startY: 100,
      head: [['#', 'Step', 'Week', 'Total Bal', 'Daily', 'Leverage', 'Burden', 'Cash (step)', 'Profit (step)']],
      body: scenarioRun.checkpoints.map(c => [
        c.stepIndex < 0 ? 'Start' : String(c.stepIndex + 1),
        c.stepLabel,
        c.weekOffset.toFixed(1),
        fmt(c.totalBalance),
        fmt(c.totalDaily),
        fmtX(c.balanceLeverage),
        fmtPct(c.paymentBurden),
        fmt(c.cashToMerchantStep),
        fmt(c.profitStep),
      ]),
      styles: { fontSize: 8, font: 'helvetica' },
      headStyles: { fillColor: [11, 29, 58] },
    });

    const afterTbl = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Final State', 40, afterTbl);
    const fs = scenarioRun.finalState;
    autoTable(doc, {
      startY: afterTbl + 6,
      head: [['Metric', 'Value']],
      body: [
        ['Total Balance', fmt(fs.totalBalance)],
        ['Total Daily Debits', fmt(fs.totalDaily)],
        ['Balance Leverage', fmtX(fs.balanceLeverage)],
        ['Payment Burden', fmtPct(fs.paymentBurden)],
        ['Cumulative Cash to Merchant', fmt(fs.cashToMerchantCumulative)],
        ['Cumulative Profit (est)', fmt(fs.profitCumulative)],
        ['Peak Combined Exposure', fmt(scenarioRun.peakCombinedExposure)],
        ['Timeline Length', `${fs.weekOffset.toFixed(1)} weeks (${fs.dayOffset} biz days)`],
      ],
      styles: { fontSize: 9, font: 'helvetica' },
      headStyles: { fillColor: [11, 29, 58] },
    });

    doc.save(`scenario_${(selectedCalc?.merchant_name || 'deal').replace(/[^a-z0-9]/gi, '_')}.pdf`);
  };


  const noData = positions.length === 0 || monthlyRevenue <= 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <button
              type="button"
              onClick={() => {
                if (selectedCalc) {
                  sessionStorage.setItem('loadCalculation', JSON.stringify({
                    id: selectedCalc.id,
                    name: selectedCalc.name,
                    merchant: {
                      name: selectedCalc.merchant_name || '',
                      businessType: selectedCalc.merchant_business_type || '',
                      monthlyRevenue: selectedCalc.merchant_monthly_revenue || 0,
                    },
                    settings: selectedCalc.settings,
                    positions: selectedCalc.positions,
                    funded_at: (selectedCalc as unknown as { funded_at?: string | null }).funded_at || null,
                    as_of_date: (selectedCalc as unknown as { as_of_date?: string | null }).as_of_date || null,
                  }));
                }
                navigate('/');
              }}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to {selectedCalc?.merchant_name || 'calculator'}
            </button>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <TrendingDown className="w-6 h-6 text-primary" />
              Deal Lab
              {selectedCalc?.merchant_name && (
                <span className="text-base font-normal text-muted-foreground">
                  · {selectedCalc.merchant_name}
                </span>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">
              Understand the ins and outs of this deal — straight, reverse, or a mix on your timeline.
            </p>
          </div>
          <div />

        </div>

        {isLoading && !selectedCalc && (
          <Card><CardContent className="pt-6 text-sm text-muted-foreground">Loading deal…</CardContent></Card>
        )}

        {!isLoading && selectedCalc && noData && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              This deal needs at least one position with a balance and a monthly revenue set on the merchant to use the Deal Lab.
            </div>
          </div>
        )}

        {!noData && (
          <>
            {/* Current state */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Current Position</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs text-muted-foreground">
                  <span className="font-semibold">As of {format(new Date(asOfDate + 'T00:00:00'), 'MMM d, yyyy')}:</span>{' '}
                  {fmt(totals.totalBalance)} balance / {fmt(totals.totalDaily)}/day
                </div>
                {businessDaysSinceAsOf > 0 && (
                  <>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        Projected to today ({businessDaysSinceAsOf} business {businessDaysSinceAsOf === 1 ? 'day' : 'days'} later):
                      </span>{' '}
                      {fmt(projectedTotals.totalBalance)} / {fmt(projectedTotals.totalDaily)}/day
                    </div>
                    {weeklyPositions.length > 0 && (
                      <div className="text-[11px] text-muted-foreground italic">
                        {weeklyPositions.map(p => p.entity || `Position ${p.id}`).join(', ')}{' '}
                        <span className="opacity-70">(weekly — not projected)</span>
                      </div>
                    )}
                  </>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                  <div className="rounded-md border border-border p-3">
                    <div className="text-xs text-muted-foreground">Open Balance</div>
                    <div className="text-xl font-bold">{fmt(projectedTotals.totalBalance)}</div>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <div className="text-xs text-muted-foreground">Total Daily Debits</div>
                    <div className="text-xl font-bold">{fmt(projectedTotals.totalDaily)}</div>
                    <div className="text-[11px] text-muted-foreground">
                      Weekly {fmt(projectedTotals.totalDaily * 5)} / Monthly {fmt(projectedTotals.totalDaily * 22)}
                    </div>
                  </div>
                  <MetricsBlock
                    title="Today"
                    totalBalance={projectedTotals.totalBalance}
                    totalDaily={projectedTotals.totalDaily}
                    monthlyRevenue={monthlyRevenue}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <ScenarioTabs
                rows={scenarioRows}
                activeId={activeScenarioId}
                dirty={isDirty}
                saveStatus={saveStatus}
                onRetrySave={retrySave}
                onSelect={handleSelectScenario}
                onCreate={handleCreateScenario}
                onRename={handleRenameScenario}
                onDuplicate={handleDuplicateScenario}
                onDelete={handleDeleteScenario}
              />

              <BuilderTab
                scenario={scenario}
                setScenario={setScenario}
                scenarioRun={scenarioRun}
                monthlyRevenue={monthlyRevenue}
                onAddStep={addStep}
                onUpdateStep={updateStep}
                onMoveStep={moveStep}
                onDuplicateStep={duplicateStep}
                onDeleteStep={deleteStep}
                onExport={exportScenarioPDF}
              />
              <ScenarioStory scenario={scenario} checkpoints={scenarioRun.checkpoints} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}


// ---------------- Scenario Builder Panel ----------------

import type { ScenarioRunResult } from '@/lib/scenarioTypes';
type ScenarioRunResultLite = ScenarioRunResult;

function ScenarioBuilderPanel({
  scenario, setScenario, scenarioRun, monthlyRevenue,
  onAddStep, onUpdateStep, onMoveStep, onDuplicateStep, onDeleteStep,
  onExport,
}: {
  scenario: Scenario;
  setScenario: React.Dispatch<React.SetStateAction<Scenario>>;
  scenarioRun: ScenarioRunResultLite;
  monthlyRevenue: number;
  onAddStep: (k: StepKind) => void;
  onUpdateStep: (idx: number, s: ScenarioStep) => void;
  onMoveStep: (idx: number, dir: -1 | 1) => void;
  onDuplicateStep: (idx: number) => void;
  onDeleteStep: (idx: number) => void;
  onExport: () => void;
}) {
  const fs = scenarioRun.finalState;
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

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] text-sm text-muted-foreground">
            Edits auto-save to this deal. Rename the scenario from its tab above.
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-1.5" />
                Add Step
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => onAddStep('straight')}>
                <Zap className="w-4 h-4 mr-2 text-amber-600" /> Straight MCA on…
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAddStep('recurring-straight')}>
                <Layers className="w-4 h-4 mr-2 text-orange-600" /> Recurring program starting…
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAddStep('add-position')}>
                <PlusCircle className="w-4 h-4 mr-2 text-rose-600" /> Add outside position on…
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAddStep('reverse')}>
                <Repeat className="w-4 h-4 mr-2 text-emerald-600" /> Reverse on…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" onClick={onExport}>
            <FileDown className="w-4 h-4 mr-1.5" /> Export PDF
          </Button>
        </CardContent>
      </Card>

      {/* Final state summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-md border border-border bg-card p-3">
          <div className="text-[10px] text-muted-foreground uppercase">End Balance</div>
          <div className="text-lg font-bold">{fmt(fs.totalBalance)}</div>
        </div>
        <div className="rounded-md border border-border bg-card p-3">
          <div className="text-[10px] text-muted-foreground uppercase">End Daily</div>
          <div className="text-lg font-bold">{fmt(fs.totalDaily)}</div>
        </div>
        <div className="rounded-md border border-border bg-card p-3">
          <div className="text-[10px] text-muted-foreground uppercase">End Leverage</div>
          <div className="text-lg font-bold">{fmtX(fs.balanceLeverage)}</div>
          <div className="text-[10px] text-muted-foreground">{fmtPct(fs.paymentBurden)} burden</div>
        </div>
        <div className="rounded-md border border-border bg-card p-3">
          <div className="text-[10px] text-muted-foreground uppercase">Total Cash to Merchant</div>
          <div className={`text-lg font-bold ${fs.cashToMerchantCumulative < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
            {fmt(fs.cashToMerchantCumulative)}
          </div>
        </div>
        <div className="rounded-md border border-border bg-card p-3">
          <div className="text-[10px] text-muted-foreground uppercase">Cumulative Profit</div>
          <div className="text-lg font-bold">{fmt(fs.profitCumulative)}</div>
          <div className="text-[10px] text-muted-foreground">Peak: {fmt(scenarioRun.peakCombinedExposure)}</div>
        </div>
      </div>

      <ScenarioSparkline weekly={scenarioRun.weeklyExposure} stepMarkers={stepMarkers} />

      {/* Step cards */}
      {scenario.steps.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Add steps above to build a multi-stage scenario.
            <br />
            Example: <b>Straight MCA</b> (4 wks, $1M, 1.35, 5%) -&gt; <b>Wait</b> 10 wks -&gt; <b>Reverse</b> on whatever remains.
          </CardContent>
        </Card>
      )}

      {scenario.steps.map((step, idx) => {
        // Active positions BEFORE this step = checkpoint at idx-1 (or start = checkpoints[0])
        const beforeCp = scenarioRun.checkpoints[idx]; // start checkpoint is at index 0, step 0 sees that
        const note = scenarioRun.checkpoints[idx + 1]?.note;
        return (
          <div key={step.id} className="space-y-2">
            <StepCard
              step={step}
              index={idx}
              total={scenario.steps.length}
              activeBeforeStep={beforeCp?.activePositions ?? []}
              checkpointNote={note}
              onChange={next => onUpdateStep(idx, next)}
              onMove={dir => onMoveStep(idx, dir)}
              onDuplicate={() => onDuplicateStep(idx)}
              onDelete={() => onDeleteStep(idx)}
            />
            {/* After-step snapshot */}
            <AfterStepRow checkpoint={scenarioRun.checkpoints[idx + 1]} monthlyRevenue={monthlyRevenue} />
          </div>
        );
      })}
    </div>
  );
}

function AfterStepRow({
  checkpoint, monthlyRevenue,
}: {
  checkpoint?: ScenarioRunResultLite['checkpoints'][number];
  monthlyRevenue: number;
}) {
  if (!checkpoint) return null;
  const lev: LeverageBand =
    checkpoint.balanceLeverage < 0.5 ? 'green' : checkpoint.balanceLeverage < 1.0 ? 'amber' : 'red';
  const bur: LeverageBand =
    checkpoint.paymentBurden < 0.15 ? 'green' : checkpoint.paymentBurden < 0.30 ? 'amber' : 'red';
  const cls = (b: LeverageBand) =>
    b === 'green' ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
    : b === 'amber' ? 'bg-amber-100 text-amber-800 border-amber-300'
    : 'bg-rose-100 text-rose-800 border-rose-300';
  return (
    <div className="ml-2 pl-4 border-l-2 border-dashed border-muted-foreground/30 grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
      <div>
        <span className="text-muted-foreground">After step · wk {checkpoint.weekOffset.toFixed(1)}</span>
      </div>
      <div>
        <span className="text-muted-foreground">Bal: </span>
        <b>{fmt(checkpoint.totalBalance)}</b>
      </div>
      <div>
        <span className="text-muted-foreground">Daily: </span>
        <b>{fmt(checkpoint.totalDaily)}</b>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground">Lev:</span>
        <Badge variant="outline" className={cls(lev)}>{fmtX(checkpoint.balanceLeverage)}</Badge>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground">Burd:</span>
        <Badge variant="outline" className={cls(bur)}>{fmtPct(checkpoint.paymentBurden)}</Badge>
      </div>
    </div>
  );
}
