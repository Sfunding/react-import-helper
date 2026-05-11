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
import { Position, SavedCalculation } from '@/types/calculation';
import {
  snapshot,
  stackTotals,
  simulateStraightMCA,
  simulateReverseSnapshot,
  simulateHybrid,
  HybridTrigger,
  LeverageBand,
  BUSINESS_DAYS_PER_MONTH,
} from '@/lib/leverageMath';
import { Download, TrendingDown, AlertTriangle } from 'lucide-react';
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

  const [selectedId, setSelectedId] = useState<string>('');
  const [chosenScenario, setChosenScenario] = useState<ScenarioKind | null>(null);

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
  const [straightFactor, setStraightFactor] = useState(1.49);
  const [straightFeePct, setStraightFeePct] = useState(0.09);
  const [straightTermMonths, setStraightTermMonths] = useState(6);
  const [straightPayoffs, setStraightPayoffs] = useState<Set<number>>(new Set());
  const [straightGross, setStraightGross] = useState<number | null>(null);

  // Default gross funding = payoffs + 20% cash buffer, when user hasn't overridden
  const computedStraightGross = useMemo(() => {
    if (straightGross !== null) return straightGross;
    const payoffs = positions
      .filter(p => straightPayoffs.has(p.id))
      .reduce((s, p) => s + (p.balance ?? 0), 0);
    // Need grossFunding such that netAdvance = gross*(1-fee) covers payoffs and gives 20% buffer
    if (payoffs <= 0) return 0;
    const targetNet = payoffs * 1.2;
    return targetNet / (1 - straightFeePct);
  }, [straightGross, positions, straightPayoffs, straightFeePct]);

  const straightResult = useMemo(
    () =>
      simulateStraightMCA(positions, {
        grossFunding: computedStraightGross,
        factorRate: straightFactor,
        feePercent: straightFeePct,
        termMonths: straightTermMonths,
        payoffPositionIds: Array.from(straightPayoffs),
      }),
    [positions, computedStraightGross, straightFactor, straightFeePct, straightTermMonths, straightPayoffs]
  );

  const straightAfter = snapshot(
    straightResult.newTotalBalance,
    straightResult.newTotalDailyDebits,
    monthlyRevenue
  );

  // ---------------- Scenario 3: Hybrid ----------------
  const [hybridTriggerKind, setHybridTriggerKind] = useState<'days' | 'positions-fall-off'>('positions-fall-off');
  const [hybridTriggerDays, setHybridTriggerDays] = useState(60);
  const [hybridTriggerIds, setHybridTriggerIds] = useState<Set<number>>(new Set());

  const trigger: HybridTrigger =
    hybridTriggerKind === 'days'
      ? { kind: 'days', businessDays: hybridTriggerDays }
      : { kind: 'positions-fall-off', positionIds: Array.from(hybridTriggerIds) };

  const hybridResult = useMemo(
    () =>
      simulateHybrid(positions, {
        straight: {
          grossFunding: computedStraightGross,
          factorRate: straightFactor,
          feePercent: straightFeePct,
          termMonths: straightTermMonths,
          payoffPositionIds: Array.from(straightPayoffs),
        },
        reverse: {
          factorRate: reverseFactor,
          feePercent: reverseFeePct,
          dailyDecrease: reverseDiscount,
        },
        trigger,
      }),
    [positions, computedStraightGross, straightFactor, straightFeePct, straightTermMonths, straightPayoffs,
     reverseFactor, reverseFeePct, reverseDiscount, trigger]
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
          `Straight Now → Reverse @ day ${hybridResult.triggerDay}`,
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
                      <Label className="text-xs">Term (mo)</Label>
                      <Input type="number" value={straightTermMonths}
                        onChange={e => setStraightTermMonths(parseInt(e.target.value) || 1)} />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Gross Funding ($)</Label>
                    <Input
                      type="number"
                      value={straightGross ?? Math.round(computedStraightGross)}
                      onChange={e =>
                        setStraightGross(e.target.value ? parseFloat(e.target.value) : null)
                      }
                    />
                    <div className="text-[10px] text-muted-foreground">
                      Auto-sized to payoffs + 20% buffer when blank
                    </div>
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
                    <Row
                      label="Cash to Merchant"
                      value={fmt(straightResult.cashToMerchant)}
                      bold
                      negative={straightResult.cashToMerchant < 0}
                    />
                    <Row label="New MCA Daily" value={fmt(straightResult.newDailyPayment)} />
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
                    onValueChange={(v: 'days' | 'positions-fall-off') => setHybridTriggerKind(v)}
                    className="space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="positions-fall-off" id="trig-pos" />
                      <Label htmlFor="trig-pos" className="text-xs">After selected positions fall off</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="days" id="trig-days" />
                      <Label htmlFor="trig-days" className="text-xs">After N business days</Label>
                    </div>
                  </RadioGroup>

                  {hybridTriggerKind === 'days' ? (
                    <Input
                      type="number"
                      value={hybridTriggerDays}
                      onChange={e => setHybridTriggerDays(parseInt(e.target.value) || 0)}
                    />
                  ) : (
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

                  <div className="text-sm space-y-1 border-t border-border pt-2">
                    <Row label="Phase 1 Cash" value={fmt(hybridResult.straight.cashToMerchant)} />
                    <Row label="Trigger Day" value={`Day ${hybridResult.triggerDay}`} />
                    <Row
                      label="Straight RTR @ trigger"
                      value={fmt(hybridResult.straightBalanceAtTrigger)}
                    />
                    <Row
                      label="Stack remaining"
                      value={fmt(
                        hybridResult.remainingPositionsAtTrigger.reduce(
                          (s, p) => s + (p.projectedBalance || 0),
                          0
                        )
                      )}
                    />
                    <Row label="Reverse Payback" value={fmt(hybridResult.reverseAtTrigger.totalPayback)} />
                    <Row label="Combined Profit" value={fmt(hybridResult.combinedProfit)} bold />
                  </div>

                  <MetricsBlock
                    title={`At Trigger (Day ${hybridResult.triggerDay})`}
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
