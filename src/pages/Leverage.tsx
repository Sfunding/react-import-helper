import React, { useMemo, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { useCalculations } from '@/hooks/useCalculations';
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

type ScenarioKind = 'reverse' | 'straight' | 'hybrid';

export default function LeveragePage() {
  const { calculations, isLoading, updateCalculation } = useCalculations();
  const { toast } = useToast();

  const [selectedId, setSelectedId] = useState<string>('');
  const [chosenScenario, setChosenScenario] = useState<ScenarioKind | null>(null);
  const [activeTab, setActiveTab] = useState<'compare' | 'builder'>('compare');

  // Scenario Builder state
  const [scenario, setScenario] = useState<Scenario>(() => newScenario());

  const selectedCalc: SavedCalculation | undefined = useMemo(
    () => calculations.find(c => c.id === selectedId),
    [calculations, selectedId]
  );

  // Manual overrides when no deal is loaded
  const [manualRevenue, setManualRevenue] = useState<number>(0);
  const monthlyRevenue =
    selectedCalc?.merchant_monthly_revenue && selectedCalc.merchant_monthly_revenue > 0
      ? selectedCalc.merchant_monthly_revenue
      : manualRevenue;

  const positions: Position[] = useMemo(
    () =>
      (selectedCalc?.positions || []).filter(
        p => !p.isOurPosition && (p.balance ?? 0) > 0 && (p.dailyPayment ?? 0) > 0
      ),
    [selectedCalc]
  );

  const totals = stackTotals(positions);
  const currentSnap = snapshot(totals.totalBalance, totals.totalDaily, monthlyRevenue);

  // ---------------- Scenario 1: Reverse ----------------
  const [reverseFactor, setReverseFactor] = useState(1.499);
  const [reverseFeePct, setReverseFeePct] = useState(0.09);
  const [reverseDiscount, setReverseDiscount] = useState(0.3);
  const [reverseIncluded, setReverseIncluded] = useState<Set<number>>(new Set());

  // Seed reverse inclusion to all positions when stack changes
  React.useEffect(() => {
    setReverseIncluded(new Set(positions.map(p => p.id)));
    setStraightPayoffs(new Set());
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const reverseResult = useMemo(
    () =>
      simulateReverseSnapshot(positions, {
        factorRate: reverseFactor,
        feePercent: reverseFeePct,
        dailyDecrease: reverseDiscount,
        includedPositionIds: Array.from(reverseIncluded),
      }),
    [positions, reverseFactor, reverseFeePct, reverseDiscount, reverseIncluded]
  );

  // After-reverse leverage: the included balances are replaced by reverse RTR; non-included
  // positions stay. Daily debits = newDailyPayment + remaining external dailies.
  const reverseAfter = useMemo(() => {
    const newBalance = reverseResult.totalPayback + positions.filter(p => !reverseIncluded.has(p.id))
      .reduce((s, p) => s + (p.balance ?? 0), 0);
    const newDaily = reverseResult.newDailyPayment + reverseResult.remainingExternalDaily;
    return snapshot(newBalance, newDaily, monthlyRevenue);
  }, [reverseResult, positions, reverseIncluded, monthlyRevenue]);

  // ---------------- Scenario 2: Straight MCA ----------------
  const [straightFactor, setStraightFactor] = useState(1.35);
  const [straightFeePct, setStraightFeePct] = useState(0.05);
  const [straightTermWeeks, setStraightTermWeeks] = useState(15);
  const [straightCadence, setStraightCadence] = useState<PaymentCadence>('weekly');
  const [straightPayoffs, setStraightPayoffs] = useState<Set<number>>(new Set());
  const [straightGross, setStraightGross] = useState<number | null>(null);

  // Default gross funding = payoffs (no buffer), when user hasn't overridden
  const computedStraightGross = useMemo(() => {
    if (straightGross !== null) return straightGross;
    const payoffs = positions
      .filter(p => straightPayoffs.has(p.id))
      .reduce((s, p) => s + (p.balance ?? 0), 0);
    return payoffs;
  }, [straightGross, positions, straightPayoffs]);

  const straightResult = useMemo(
    () =>
      simulateStraightMCA(positions, {
        grossFunding: computedStraightGross,
        factorRate: straightFactor,
        feePercent: straightFeePct,
        termWeeks: straightTermWeeks,
        payoffPositionIds: Array.from(straightPayoffs),
        paymentCadence: straightCadence,
      }),
    [positions, computedStraightGross, straightFactor, straightFeePct, straightTermWeeks, straightPayoffs, straightCadence]
  );

  const straightAfter = snapshot(
    straightResult.newTotalBalance,
    straightResult.newTotalDailyDebits,
    monthlyRevenue
  );

  // ---------------- Scenario 3: Hybrid ----------------
  type TriggerKind = 'week' | 'positions-fall-off' | 'straight-exposure-below' | 'combined-exposure-below';
  const [hybridTriggerKind, setHybridTriggerKind] = useState<TriggerKind>('week');
  const [hybridTriggerWeek, setHybridTriggerWeek] = useState(10);
  const [hybridTriggerIds, setHybridTriggerIds] = useState<Set<number>>(new Set());
  const [hybridStraightThreshold, setHybridStraightThreshold] = useState(500000);
  const [hybridCombinedThreshold, setHybridCombinedThreshold] = useState(750000);

  const trigger: HybridTrigger = useMemo(() => {
    switch (hybridTriggerKind) {
      case 'week': return { kind: 'week', week: hybridTriggerWeek };
      case 'positions-fall-off': return { kind: 'positions-fall-off', positionIds: Array.from(hybridTriggerIds) };
      case 'straight-exposure-below': return { kind: 'straight-exposure-below', threshold: hybridStraightThreshold };
      case 'combined-exposure-below': return { kind: 'combined-exposure-below', threshold: hybridCombinedThreshold };
    }
  }, [hybridTriggerKind, hybridTriggerWeek, hybridTriggerIds, hybridStraightThreshold, hybridCombinedThreshold]);

  const hybridResult = useMemo(
    () =>
      simulateHybrid(positions, {
        straight: {
          grossFunding: computedStraightGross,
          factorRate: straightFactor,
          feePercent: straightFeePct,
          termWeeks: straightTermWeeks,
          payoffPositionIds: Array.from(straightPayoffs),
          paymentCadence: straightCadence,
        },
        reverse: {
          factorRate: reverseFactor,
          feePercent: reverseFeePct,
          dailyDecrease: reverseDiscount,
        },
        trigger,
      }),
    [positions, computedStraightGross, straightFactor, straightFeePct, straightTermWeeks, straightPayoffs, straightCadence,
     reverseFactor, reverseFeePct, reverseDiscount, trigger]
  );

  const exposureTimeline = useMemo(
    () => buildExposureTimeline(positions, straightResult, Array.from(straightPayoffs), 26),
    [positions, straightResult, straightPayoffs]
  );

  // After-hybrid snapshot at trigger day: straight RTR + reverse RTR
  const hybridAfter = useMemo(() => {
    const r = hybridResult;
    const newBalance = r.straightBalanceAtTrigger + r.reverseAtTrigger.totalPayback;
    const newDaily = r.straightDailyAtTrigger + r.reverseAtTrigger.newDailyPayment;
    return snapshot(newBalance, newDaily, monthlyRevenue);
  }, [hybridResult, monthlyRevenue]);

  // ---------------- Recommendation ----------------
  const recommendation = useMemo((): ScenarioKind => {
    const candidates: Array<{ kind: ScenarioKind; burden: number; cash: number }> = [
      { kind: 'reverse', burden: reverseAfter.paymentBurden, cash: 0 },
      { kind: 'straight', burden: straightAfter.paymentBurden, cash: straightResult.cashToMerchant },
      { kind: 'hybrid', burden: hybridAfter.paymentBurden, cash: hybridResult.totalCashToMerchant },
    ];
    // pick lowest burden with non-negative cash; fall back to lowest burden overall
    const positiveCash = candidates.filter(c => c.cash >= 0);
    const pool = positiveCash.length ? positiveCash : candidates;
    return pool.reduce((a, b) => (a.burden <= b.burden ? a : b)).kind;
  }, [reverseAfter, straightAfter, hybridAfter, straightResult, hybridResult]);

  const winner: ScenarioKind = chosenScenario ?? recommendation;

  const togglePayoff = (id: number) => {
    setStraightPayoffs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleReverseIncluded = (id: number) => {
    setReverseIncluded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleTriggerId = (id: number) => {
    setHybridTriggerIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSaveChoice = async () => {
    if (!selectedCalc) return;
    await updateCalculation({
      id: selectedCalc.id,
      name: selectedCalc.name,
      merchant: {
        name: selectedCalc.merchant_name || '',
        businessType: selectedCalc.merchant_business_type || '',
        monthlyRevenue: selectedCalc.merchant_monthly_revenue || 0,
      },
      settings: selectedCalc.settings,
      positions: selectedCalc.positions,
      totalBalance: selectedCalc.total_balance || 0,
      totalDailyPayment: selectedCalc.total_daily_payment || 0,
    });
  };

  const exportPDF = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Leverage Analysis — Scenario Comparison', 40, 50);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Merchant: ${selectedCalc?.merchant_name || '—'}   Monthly Revenue: ${fmt(monthlyRevenue)}`,
      40,
      68
    );
    doc.text(
      `Current Balance Leverage: ${fmtX(currentSnap.balanceLeverage)}   Current Payment Burden: ${fmtPct(currentSnap.paymentBurden)}`,
      40,
      82
    );

    autoTable(doc, {
      startY: 100,
      head: [['Scenario', 'Cash to Merchant', 'New Daily Debits', 'Balance Leverage', 'Payment Burden', 'Profit', 'Recommended']],
      body: [
        [
          'Reverse Consolidation',
          fmt(0),
          fmt(reverseResult.newDailyPayment + reverseResult.remainingExternalDaily),
          fmtX(reverseAfter.balanceLeverage),
          fmtPct(reverseAfter.paymentBurden),
          fmt(reverseResult.profit),
          winner === 'reverse' ? 'YES' : '',
        ],
        [
          'Straight MCA Payoff',
          fmt(straightResult.cashToMerchant),
          fmt(straightResult.newTotalDailyDebits),
          fmtX(straightAfter.balanceLeverage),
          fmtPct(straightAfter.paymentBurden),
          fmt(straightResult.profit),
          winner === 'straight' ? 'YES' : '',
        ],
        [
          `Straight Now -> Reverse @ wk ${hybridResult.triggerWeek.toFixed(1)}`,
          fmt(hybridResult.totalCashToMerchant),
          fmt(hybridResult.straightDailyAtTrigger + hybridResult.reverseAtTrigger.newDailyPayment),
          fmtX(hybridAfter.balanceLeverage),
          fmtPct(hybridAfter.paymentBurden),
          fmt(hybridResult.combinedProfit),
          winner === 'hybrid' ? 'YES' : '',
        ],
      ],
      styles: { fontSize: 9, font: 'helvetica' },
      headStyles: { fillColor: [11, 29, 58] },
    });

    // Straight MCA Deal Terms
    const afterMain = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Straight MCA Deal Terms', 40, afterMain);
    autoTable(doc, {
      startY: afterMain + 8,
      head: [['Field', 'Value']],
      body: [
        ['Advance Amount', fmt(straightResult.payoffsTotal > 0 ? computedStraightGross : computedStraightGross)],
        ['Factor Rate', straightFactor.toFixed(3)],
        ['Origination Fee', fmtPct(straightFeePct)],
        ['Term', `${straightResult.termWeeks} weeks (${straightResult.termDays} business days)`],
        ['Payment Cadence', straightCadence],
        ['Daily Payment', fmt(straightResult.newDailyPayment)],
        ['Weekly Payment', fmt(straightResult.newWeeklyPayment)],
        ['Total Payback', fmt(straightResult.totalPayback)],
        ['Net Advance', fmt(straightResult.netAdvance)],
        ['Cash to Merchant', fmt(straightResult.cashToMerchant)],
        ['Profit (est)', fmt(straightResult.profit)],
      ],
      styles: { fontSize: 9, font: 'helvetica' },
      headStyles: { fillColor: [11, 29, 58] },
    });

    // Hybrid Trigger
    const afterStraight = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Hybrid Trigger', 40, afterStraight);
    const triggerLabel =
      trigger.kind === 'week' ? `Fixed week ${trigger.week}` :
      trigger.kind === 'positions-fall-off' ? 'After selected positions fall off' :
      trigger.kind === 'straight-exposure-below' ? `Straight RTR below ${fmt(trigger.threshold)}` :
      trigger.kind === 'combined-exposure-below' ? `Combined exposure below ${fmt(trigger.threshold)}` :
      'Custom';
    const combinedAtTrigger =
      hybridResult.straightBalanceAtTrigger +
      hybridResult.remainingPositionsAtTrigger.reduce((s, p) => s + (p.projectedBalance || 0), 0);
    autoTable(doc, {
      startY: afterStraight + 8,
      head: [['Field', 'Value']],
      body: [
        ['Trigger Type', triggerLabel],
        ['Resolved Week', hybridResult.triggerWeek.toFixed(1)],
        ['Resolved Business Day', String(hybridResult.triggerDay)],
        ['Threshold Reached', hybridResult.triggerReached ? 'Yes' : 'No (capped at week 30)'],
        ['Straight RTR @ trigger', fmt(hybridResult.straightBalanceAtTrigger)],
        ['Combined Exposure @ trigger', fmt(combinedAtTrigger)],
        ['Reverse Payback', fmt(hybridResult.reverseAtTrigger.totalPayback)],
        ['Combined Profit', fmt(hybridResult.combinedProfit)],
      ],
      styles: { fontSize: 9, font: 'helvetica' },
      headStyles: { fillColor: [11, 29, 58] },
    });

    doc.save(`leverage_${(selectedCalc?.merchant_name || 'analysis').replace(/[^a-z0-9]/gi, '_')}.pdf`);
  };

  const noData = positions.length === 0 || monthlyRevenue <= 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <TrendingDown className="w-6 h-6 text-primary" />
              Leverage Analyzer
            </h1>
            <p className="text-sm text-muted-foreground">
              Compare ways to bring this merchant's leverage down.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={exportPDF} disabled={noData}>
              <Download className="w-4 h-4 mr-2" />
              Export Comparison
            </Button>
            {selectedCalc && chosenScenario && (
              <Button onClick={handleSaveChoice}>Save Selection to Deal</Button>
            )}
          </div>
        </div>

        {/* Source picker */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Load a saved deal</Label>
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger>
                    <SelectValue placeholder={isLoading ? 'Loading…' : 'Pick a saved calculation'} />
                  </SelectTrigger>
                  <SelectContent>
                    {calculations.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.merchant_name ? `— ${c.merchant_name}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Monthly Revenue (override)</Label>
                <Input
                  inputMode="decimal"
                  type="number"
                  value={manualRevenue || ''}
                  onChange={e => setManualRevenue(parseFloat(e.target.value) || 0)}
                  placeholder={
                    selectedCalc?.merchant_monthly_revenue
                      ? fmt(selectedCalc.merchant_monthly_revenue)
                      : 'Enter monthly revenue'
                  }
                  disabled={!!selectedCalc?.merchant_monthly_revenue && selectedCalc.merchant_monthly_revenue > 0}
                />
              </div>
            </div>

            {noData && (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  Pick a saved deal with positions and a monthly revenue to start analyzing leverage.
                </div>
              </div>
            )}
          </CardContent>
        </Card>

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
