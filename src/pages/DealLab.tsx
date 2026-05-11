import React, { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { useCalculations } from '@/hooks/useCalculations';
import { ArrowLeft } from 'lucide-react';
import { useDealScenarios } from '@/hooks/useDealScenarios';
import { ScenarioTabs } from '@/components/leverage/ScenarioTabs';
import { ScenarioStory } from '@/components/leverage/ScenarioStory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
  simulateStraightMCA,
  simulateReverseSnapshot,
  simulateHybrid,
  buildExposureTimeline,
  runScenario,
  HybridTrigger,
  LeverageBand,
  PaymentCadence,
  BUSINESS_DAYS_PER_WEEK,
} from '@/lib/leverageMath';
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
import { Download, TrendingDown, AlertTriangle, Plus, Save, FileDown, Layers, Zap, Clock, PlusCircle, Repeat } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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

  const totals = stackTotals(positions);
  const currentSnap = snapshot(totals.totalBalance, totals.totalDaily, monthlyRevenue);

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
    () => runScenario(positions, scenario, monthlyRevenue),
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
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-md border border-border p-3">
                  <div className="text-xs text-muted-foreground">Open Balance</div>
                  <div className="text-xl font-bold">{fmt(totals.totalBalance)}</div>
                </div>
                <div className="rounded-md border border-border p-3">
                  <div className="text-xs text-muted-foreground">Total Daily Debits</div>
                  <div className="text-xl font-bold">{fmt(totals.totalDaily)}</div>
                  <div className="text-[11px] text-muted-foreground">
                    Weekly {fmt(totals.totalDaily * 5)} / Monthly {fmt(totals.totalDaily * 22)}
                  </div>
                </div>
                <MetricsBlock
                  title="Today"
                  totalBalance={totals.totalBalance}
                  totalDaily={totals.totalDaily}
                  monthlyRevenue={monthlyRevenue}
                />
              </CardContent>
            </Card>

            {/* Recommendation banner */}
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 flex items-center justify-between">
              <div className="text-sm text-emerald-900">
                <span className="font-semibold">Recommended:</span>{' '}
                {recommendation === 'reverse' && 'Reverse Consolidation'}
                {recommendation === 'straight' && 'Straight MCA Payoff'}
                {recommendation === 'hybrid' && 'Straight MCA Now → Reverse Later'}
                <span className="text-emerald-700 ml-2">
                  (lowest payment burden with positive cash to merchant)
                </span>
              </div>
              {chosenScenario && chosenScenario !== recommendation && (
                <Badge variant="outline" className="bg-white">Override: {chosenScenario}</Badge>
              )}
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'compare' | 'builder')}>
              <TabsList className="grid grid-cols-2 w-full max-w-md">
                <TabsTrigger value="compare">Compare Scenarios</TabsTrigger>
                <TabsTrigger value="builder">
                  <Layers className="w-3.5 h-3.5 mr-1.5" />
                  Scenario Builder
                </TabsTrigger>
              </TabsList>

              <TabsContent value="compare" className="mt-4">
            {/* Three scenarios */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* --- Reverse --- */}
              <Card className={winner === 'reverse' ? 'ring-2 ring-primary' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Reverse Consolidation</CardTitle>
                    {recommendation === 'reverse' && (
                      <Badge className="bg-emerald-600 hover:bg-emerald-700">Recommended</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Factor</Label>
                      <Input type="number" step="0.01" value={reverseFactor}
                        onChange={e => setReverseFactor(parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <Label className="text-xs">Fee %</Label>
                      <Input type="number" step="0.01" value={reverseFeePct}
                        onChange={e => setReverseFeePct(parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <Label className="text-xs">Discount</Label>
                      <Input type="number" step="0.05" value={reverseDiscount}
                        onChange={e => setReverseDiscount(parseFloat(e.target.value) || 0)} />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Positions Included</Label>
                    <div className="space-y-1 max-h-32 overflow-y-auto border border-border rounded-md p-2">
                      {positions.map(p => (
                        <label key={p.id} className="flex items-center gap-2 text-xs">
                          <Checkbox
                            checked={reverseIncluded.has(p.id)}
                            onCheckedChange={() => toggleReverseIncluded(p.id)}
                          />
                          <span className="flex-1 truncate">{p.entity}</span>
                          <span className="text-muted-foreground">{fmt(p.balance || 0)}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="text-sm space-y-1 border-t border-border pt-2">
                    <Row label="Total Funding" value={fmt(reverseResult.totalFunding)} />
                    <Row label="Total Payback" value={fmt(reverseResult.totalPayback)} />
                    <Row label="New Daily" value={fmt(reverseResult.newDailyPayment)} />
                    <Row label="Term" value={`${reverseResult.termDays} days`} />
                    <Row label="Profit (est)" value={fmt(reverseResult.profit)} bold />
                  </div>

                  <MetricsBlock
                    title="After Falloff"
                    totalBalance={
                      reverseResult.totalPayback +
                      positions.filter(p => !reverseIncluded.has(p.id)).reduce((s, p) => s + (p.balance || 0), 0)
                    }
                    totalDaily={reverseResult.newDailyPayment + reverseResult.remainingExternalDaily}
                    monthlyRevenue={monthlyRevenue}
                  />

                  <Button
                    variant={chosenScenario === 'reverse' ? 'default' : 'outline'}
                    className="w-full"
                    onClick={() => setChosenScenario('reverse')}
                  >
                    {chosenScenario === 'reverse' ? 'Selected' : 'Use this scenario'}
                  </Button>
                </CardContent>
              </Card>

              {/* --- Straight MCA --- */}
              <Card className={winner === 'straight' ? 'ring-2 ring-primary' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Straight MCA Payoff</CardTitle>
                    {recommendation === 'straight' && (
                      <Badge className="bg-emerald-600 hover:bg-emerald-700">Recommended</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Factor</Label>
                      <Input type="number" step="0.01" value={straightFactor}
                        onChange={e => setStraightFactor(parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <Label className="text-xs">Fee %</Label>
                      <Input type="number" step="0.01" value={straightFeePct}
                        onChange={e => setStraightFeePct(parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <Label className="text-xs">Term (weeks)</Label>
                      <Input type="number" value={straightTermWeeks}
                        onChange={e => setStraightTermWeeks(parseInt(e.target.value) || 1)} />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Advance Amount ($)</Label>
                    <Input
                      type="number"
                      value={straightGross ?? Math.round(computedStraightGross)}
                      onChange={e =>
                        setStraightGross(e.target.value ? parseFloat(e.target.value) : null)
                      }
                    />
                    <div className="text-[10px] text-muted-foreground">
                      Defaults to sum of selected payoffs. Single-draw advance.
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Payment Cadence</Label>
                    <RadioGroup
                      value={straightCadence}
                      onValueChange={(v: PaymentCadence) => setStraightCadence(v)}
                      className="flex gap-4 mt-1"
                    >
                      <div className="flex items-center gap-1">
                        <RadioGroupItem value="daily" id="cad-d" />
                        <Label htmlFor="cad-d" className="text-xs">Daily</Label>
                      </div>
                      <div className="flex items-center gap-1">
                        <RadioGroupItem value="weekly" id="cad-w" />
                        <Label htmlFor="cad-w" className="text-xs">Weekly</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div>
                    <Label className="text-xs">Pay Off Which Positions?</Label>
                    <div className="space-y-1 max-h-32 overflow-y-auto border border-border rounded-md p-2">
                      {positions.map(p => (
                        <label key={p.id} className="flex items-center gap-2 text-xs">
                          <Checkbox
                            checked={straightPayoffs.has(p.id)}
                            onCheckedChange={() => togglePayoff(p.id)}
                          />
                          <span className="flex-1 truncate">{p.entity}</span>
                          <span className="text-muted-foreground">{fmt(p.balance || 0)}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="text-sm space-y-1 border-t border-border pt-2">
                    <Row label="Payoffs" value={fmt(straightResult.payoffsTotal)} />
                    <Row label="Net Advance" value={fmt(straightResult.netAdvance)} />
                    <Row label="Total Payback" value={fmt(straightResult.totalPayback)} />
                    <Row
                      label="Cash to Merchant"
                      value={fmt(straightResult.cashToMerchant)}
                      bold
                      negative={straightResult.cashToMerchant < 0}
                    />
                    {straightCadence === 'weekly' ? (
                      <Row label="Weekly Payment" value={fmt(straightResult.newWeeklyPayment)} bold />
                    ) : (
                      <Row label="Daily Payment" value={fmt(straightResult.newDailyPayment)} bold />
                    )}
                    <Row
                      label={straightCadence === 'weekly' ? 'Daily equiv.' : 'Weekly equiv.'}
                      value={fmt(straightCadence === 'weekly' ? straightResult.newDailyPayment : straightResult.newWeeklyPayment)}
                    />
                    <Row label="Pays off in" value={`${straightResult.termWeeks} wk (${straightResult.termDays} biz days)`} />
                    <Row label="Profit (est)" value={fmt(straightResult.profit)} bold />
                  </div>

                  <MetricsBlock
                    title="Day 1 After Deal"
                    totalBalance={straightResult.newTotalBalance}
                    totalDaily={straightResult.newTotalDailyDebits}
                    monthlyRevenue={monthlyRevenue}
                  />

                  <Button
                    variant={chosenScenario === 'straight' ? 'default' : 'outline'}
                    className="w-full"
                    onClick={() => setChosenScenario('straight')}
                  >
                    {chosenScenario === 'straight' ? 'Selected' : 'Use this scenario'}
                  </Button>
                </CardContent>
              </Card>

              {/* --- Hybrid --- */}
              <Card className={winner === 'hybrid' ? 'ring-2 ring-primary' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Straight Now → Reverse Later</CardTitle>
                    {recommendation === 'hybrid' && (
                      <Badge className="bg-emerald-600 hover:bg-emerald-700">Recommended</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    Uses the Straight MCA inputs above for Phase 1. Reverse triggers when:
                  </div>

                  <RadioGroup
                    value={hybridTriggerKind}
                    onValueChange={(v: TriggerKind) => setHybridTriggerKind(v)}
                    className="space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="week" id="trig-week" />
                      <Label htmlFor="trig-week" className="text-xs">Fixed week</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="positions-fall-off" id="trig-pos" />
                      <Label htmlFor="trig-pos" className="text-xs">After selected positions fall off</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="straight-exposure-below" id="trig-sxb" />
                      <Label htmlFor="trig-sxb" className="text-xs">When straight-MCA RTR drops below $X</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="combined-exposure-below" id="trig-cxb" />
                      <Label htmlFor="trig-cxb" className="text-xs">When combined exposure drops below $X</Label>
                    </div>
                  </RadioGroup>

                  {hybridTriggerKind === 'week' && (
                    <div>
                      <Label className="text-xs">Week #</Label>
                      <Input
                        type="number"
                        value={hybridTriggerWeek}
                        onChange={e => setHybridTriggerWeek(parseInt(e.target.value) || 0)}
                      />
                    </div>
                  )}
                  {hybridTriggerKind === 'positions-fall-off' && (
                    <div className="space-y-1 max-h-32 overflow-y-auto border border-border rounded-md p-2">
                      {positions
                        .filter(p => !straightPayoffs.has(p.id))
                        .map(p => (
                          <label key={p.id} className="flex items-center gap-2 text-xs">
                            <Checkbox
                              checked={hybridTriggerIds.has(p.id)}
                              onCheckedChange={() => toggleTriggerId(p.id)}
                            />
                            <span className="flex-1 truncate">{p.entity}</span>
                            <span className="text-muted-foreground">
                              ~{Math.ceil((p.balance || 0) / (p.dailyPayment || 1))}d
                            </span>
                          </label>
                        ))}
                    </div>
                  )}
                  {hybridTriggerKind === 'straight-exposure-below' && (
                    <div>
                      <Label className="text-xs">Threshold ($)</Label>
                      <Input
                        type="number"
                        value={hybridStraightThreshold}
                        onChange={e => setHybridStraightThreshold(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  )}
                  {hybridTriggerKind === 'combined-exposure-below' && (
                    <div>
                      <Label className="text-xs">Threshold ($)</Label>
                      <Input
                        type="number"
                        value={hybridCombinedThreshold}
                        onChange={e => setHybridCombinedThreshold(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  )}

                  {!hybridResult.triggerReached && (
                    <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                      Threshold not reached within 30 weeks — showing week 30.
                    </div>
                  )}

                  <div className="text-sm space-y-1 border-t border-border pt-2">
                    <Row label="Phase 1 Cash" value={fmt(hybridResult.straight.cashToMerchant)} />
                    <Row label="Trigger" value={`Week ${hybridResult.triggerWeek.toFixed(1)} (day ${hybridResult.triggerDay})`} />
                    <Row label="Straight RTR @ trigger" value={fmt(hybridResult.straightBalanceAtTrigger)} />
                    <Row
                      label="Stack remaining"
                      value={fmt(
                        hybridResult.remainingPositionsAtTrigger.reduce(
                          (s, p) => s + (p.projectedBalance || 0),
                          0
                        )
                      )}
                    />
                    <Row
                      label="Combined exposure"
                      value={fmt(
                        hybridResult.straightBalanceAtTrigger +
                          hybridResult.remainingPositionsAtTrigger.reduce(
                            (s, p) => s + (p.projectedBalance || 0),
                            0
                          )
                      )}
                      bold
                    />
                    <Row label="Reverse Payback" value={fmt(hybridResult.reverseAtTrigger.totalPayback)} />
                    <Row label="Combined Profit" value={fmt(hybridResult.combinedProfit)} bold />
                  </div>

                  {/* Exposure sparkline */}
                  <ExposureSparkline
                    timeline={exposureTimeline}
                    triggerWeek={hybridResult.triggerWeek}
                  />

                  <MetricsBlock
                    title={`At Trigger (Week ${hybridResult.triggerWeek.toFixed(1)})`}
                    totalBalance={
                      hybridResult.straightBalanceAtTrigger + hybridResult.reverseAtTrigger.totalPayback
                    }
                    totalDaily={
                      hybridResult.straightDailyAtTrigger + hybridResult.reverseAtTrigger.newDailyPayment
                    }
                    monthlyRevenue={monthlyRevenue}
                  />

                  <Button
                    variant={chosenScenario === 'hybrid' ? 'default' : 'outline'}
                    className="w-full"
                    onClick={() => setChosenScenario('hybrid')}
                  >
                    {chosenScenario === 'hybrid' ? 'Selected' : 'Use this scenario'}
                  </Button>
                </CardContent>
              </Card>
            </div>
              </TabsContent>

              <TabsContent value="builder" className="mt-4 space-y-4">
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

                <ScenarioBuilderPanel
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
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  negative,
}: {
  label: string;
  value: string;
  bold?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={`${bold ? 'font-bold' : 'font-medium'} ${negative ? 'text-rose-600' : 'text-foreground'}`}
      >
        {value}
      </span>
    </div>
  );
}

function ExposureSparkline({
  timeline,
  triggerWeek,
}: {
  timeline: Array<{ week: number; straightRTR: number; remainingStackBalance: number; combined: number }>;
  triggerWeek: number;
}) {
  if (!timeline.length) return null;
  const W = 280;
  const H = 70;
  const pad = 6;
  const maxY = Math.max(1, ...timeline.map(t => t.combined));
  const xs = (w: number) => pad + (w / (timeline.length - 1 || 1)) * (W - pad * 2);
  const ys = (v: number) => H - pad - (v / maxY) * (H - pad * 2);

  const linePath = (key: 'combined' | 'straightRTR') =>
    timeline
      .map((t, i) => `${i === 0 ? 'M' : 'L'}${xs(t.week).toFixed(1)},${ys(t[key]).toFixed(1)}`)
      .join(' ');

  const triggerX = xs(Math.min(triggerWeek, timeline.length - 1));

  return (
    <div className="rounded-md border border-border p-2 bg-card">
      <div className="text-[10px] text-muted-foreground mb-1 flex justify-between">
        <span>Exposure timeline (26 wks)</span>
        <span>
          <span className="inline-block w-2 h-2 bg-primary mr-1 rounded-sm" />Combined
          <span className="inline-block w-2 h-2 bg-emerald-500 ml-2 mr-1 rounded-sm" />Straight RTR
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="block">
        <path d={linePath('combined')} fill="none" stroke="hsl(var(--primary))" strokeWidth={1.5} />
        <path d={linePath('straightRTR')} fill="none" stroke="rgb(16 185 129)" strokeWidth={1.5} />
        <line
          x1={triggerX}
          x2={triggerX}
          y1={pad}
          y2={H - pad}
          stroke="rgb(244 63 94)"
          strokeWidth={1}
          strokeDasharray="3 2"
        />
        <text x={Math.min(triggerX + 3, W - 30)} y={pad + 8} fontSize="9" fill="rgb(244 63 94)">
          wk {triggerWeek.toFixed(1)}
        </text>
      </svg>
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
