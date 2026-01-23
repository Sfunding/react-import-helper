import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, FilePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/Navbar';
import { SaveCalculationDialog } from '@/components/SaveCalculationDialog';
import { useAuth } from '@/hooks/useAuth';
import { useCalculations } from '@/hooks/useCalculations';
import { useToast } from '@/hooks/use-toast';
import { 
  Merchant, 
  Settings, 
  Position, 
  DEFAULT_MERCHANT, 
  DEFAULT_SETTINGS 
} from '@/types/calculation';

type TabType = 'positions' | 'metrics' | 'daily' | 'weekly' | 'offer';

export default function Index() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { saveCalculation, isSaving } = useCalculations();
  const { toast } = useToast();

  const [merchant, setMerchant] = useState<Merchant>(DEFAULT_MERCHANT);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [positions, setPositions] = useState<Position[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('positions');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  // Load calculation from sessionStorage if available
  useEffect(() => {
    const stored = sessionStorage.getItem('loadCalculation');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        if (data.merchant) setMerchant(data.merchant);
        if (data.settings) setSettings(data.settings);
        if (data.positions) setPositions(data.positions);
        sessionStorage.removeItem('loadCalculation');
        toast({
          title: 'Calculation loaded',
          description: 'Your saved calculation has been loaded.'
        });
      } catch (e) {
        console.error('Failed to parse stored calculation:', e);
      }
    }
  }, [toast]);

  const externalPositions = positions.filter(p => !p.isOurPosition && p.balance > 0);
  
  const totalBalance = externalPositions.reduce((sum, p) => sum + (p.balance || 0), 0);
  const totalCurrentDailyPayment = externalPositions.reduce((sum, p) => sum + (p.dailyPayment || 0), 0);
  const totalCurrentWeeklyPayment = totalCurrentDailyPayment * 5;
  
  const positionsWithDays = positions.map(p => ({
    ...p,
    daysLeft: p.dailyPayment > 0 && p.balance > 0 ? Math.ceil(p.balance / p.dailyPayment) : 0
  }));

  const totalFunding = (settings.newMoney + totalBalance) / (1 - settings.feePercent);
  const netAdvance = totalFunding * (1 - settings.feePercent);
  const consolidationFees = totalFunding * settings.feePercent;
  
  const newDailyPayment = totalCurrentDailyPayment * (1 - settings.dailyPaymentDecrease);
  const newWeeklyPayment = newDailyPayment * 5;
  const sp = merchant.monthlyRevenue > 0 ? (newDailyPayment * 22) / merchant.monthlyRevenue : 0;
  
  const dailySavings = totalCurrentDailyPayment - newDailyPayment;
  const weeklySavings = dailySavings * 5;
  const monthlySavings = dailySavings * 22;

  const dailySchedule = useMemo(() => {
    if (totalBalance === 0) return [];
    const schedule: any[] = [];
    let cumulativeNetFunded = 0;
    let cumulativeDebits = 0;
    let dealComplete = false;
    const maxDays = 500;
    const originationFee = consolidationFees;
    
    for (let day = 1; day <= maxDays; day++) {
      if (dealComplete) break;
      const week = Math.ceil(day / 5);
      const dayOfWeek = ((day - 1) % 5) + 1;
      const isPayDay = dayOfWeek === 1;
      
      let cashInfusion = 0;
      if (isPayDay) {
        if (day === 1) cashInfusion = settings.newMoney;
        for (let d = day; d <= day + 4 && d <= maxDays; d++) {
          const dayPayment = positionsWithDays
            .filter(p => !p.isOurPosition && p.balance > 0 && d <= p.daysLeft)
            .reduce((sum, p) => sum + p.dailyPayment, 0);
          cashInfusion += dayPayment;
        }
      }
      
      cumulativeNetFunded += cashInfusion;
      const cumulativeGross = cumulativeNetFunded + originationFee;
      const rtrBeforeDebit = (cumulativeGross * settings.rate) - cumulativeDebits;
      
      let dailyWithdrawal = 0;
      if (day >= 2 && rtrBeforeDebit > 0) {
        dailyWithdrawal = Math.min(newDailyPayment, rtrBeforeDebit);
      }
      cumulativeDebits += dailyWithdrawal;
      
      const exposureOnReverse = cumulativeNetFunded - cumulativeDebits;
      const rtrBalance = (cumulativeGross * settings.rate) - cumulativeDebits;
      
      schedule.push({ day, week, dayOfWeek, isPayDay, cashInfusion, dailyWithdrawal, exposureOnReverse, rtrBalance, cumulativeNetFunded, cumulativeGross, cumulativeDebits });
      
      if (rtrBalance <= 0) dealComplete = true;
    }
    return schedule;
  }, [positionsWithDays, settings, newDailyPayment, consolidationFees, totalBalance]);

  const totalDays = dailySchedule.length;

  const weeklySummary = useMemo(() => {
    const weekMap = new Map<number, any>();
    dailySchedule.forEach(day => {
      if (!weekMap.has(day.week)) {
        weekMap.set(day.week, { week: day.week, cashInfusion: 0, totalDebits: 0, endExposure: day.exposureOnReverse });
      }
      const w = weekMap.get(day.week);
      w.cashInfusion += day.cashInfusion;
      w.totalDebits += day.dailyWithdrawal;
      w.endExposure = day.exposureOnReverse;
    });
    return Array.from(weekMap.values());
  }, [dailySchedule]);

  const metrics = useMemo(() => {
    if (dailySchedule.length === 0) return {} as any;
    const lastDay = dailySchedule[dailySchedule.length - 1];
    const exposures = dailySchedule.map(d => d.exposureOnReverse);
    const maxExposure = Math.max(...exposures);
    const maxExposureDay = dailySchedule.find(d => d.exposureOnReverse === maxExposure)?.day || 0;
    const lastDayExposed = dailySchedule.filter(d => d.exposureOnReverse > 0).pop()?.day || 0;
    const totalCashInfusion = dailySchedule.reduce((sum, d) => sum + d.cashInfusion, 0);
    const actualPaybackCollected = lastDay?.cumulativeDebits || 0;
    const profit = actualPaybackCollected - totalCashInfusion;
    const dealTrueFactor = maxExposure > 0 ? 1 + ((profit - consolidationFees) / (maxExposure + consolidationFees)) : 0;
    const currentLeverage = merchant.monthlyRevenue > 0 ? (totalCurrentDailyPayment * 22) / merchant.monthlyRevenue * 100 : 0;
    const percentDaysInRed = dailySchedule.length > 0 ? (lastDayExposed / dailySchedule.length) * 100 : 0;
    return { maxExposure, maxExposureDay, lastDayExposed, profit, dealTrueFactor, currentLeverage, totalCashInfusion, actualPaybackCollected, percentDaysInRed };
  }, [dailySchedule, consolidationFees, totalCurrentDailyPayment, merchant.monthlyRevenue]);

  const addPosition = () => {
    const newId = positions.length > 0 ? Math.max(...positions.map(p => p.id)) + 1 : 1;
    setPositions([...positions, { id: newId, entity: '', balance: 0, dailyPayment: 0, isOurPosition: false }]);
  };

  const deletePosition = (id: number) => setPositions(positions.filter(p => p.id !== id));
  const updatePosition = (id: number, field: keyof Position, value: string | number | boolean) => 
    setPositions(positions.map(p => p.id === id ? { ...p, [field]: value } : p));

  const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v || 0);
  const fmtPct = (v: number) => `${(v || 0).toFixed(2)}%`;

  const handleNewCalculation = () => {
    setMerchant(DEFAULT_MERCHANT);
    setSettings(DEFAULT_SETTINGS);
    setPositions([]);
    setActiveTab('positions');
  };

  const handleSave = async (name: string) => {
    if (!isAuthenticated) {
      navigate('/auth');
      return;
    }
    await saveCalculation({
      name,
      merchant,
      settings,
      positions,
      totalBalance,
      totalDailyPayment: totalCurrentDailyPayment
    });
  };

  const tabs: { key: TabType; label: string }[] = [
    { key: 'positions', label: `Positions (${externalPositions.length})` },
    { key: 'metrics', label: 'Metrics' },
    { key: 'daily', label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'offer', label: 'Offer' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <h1 className="text-primary text-2xl md:text-3xl font-bold">
            Reverse Consolidation Calculator
          </h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleNewCalculation}>
              <FilePlus className="w-4 h-4 mr-2" />
              New
            </Button>
            <Button onClick={() => isAuthenticated ? setSaveDialogOpen(true) : navigate('/auth')}>
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
        </div>

        <SaveCalculationDialog
          open={saveDialogOpen}
          onOpenChange={setSaveDialogOpen}
          onSave={handleSave}
          isSaving={isSaving}
          defaultName={merchant.name ? `${merchant.name} Consolidation` : ''}
        />
      
      {/* Merchant Info Section */}
      <div className="mb-4 p-4 bg-card rounded-lg border border-border shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Merchant Name
            </label>
            <input 
              value={merchant.name} 
              onChange={e => setMerchant({...merchant, name: e.target.value})} 
              placeholder="Enter merchant name" 
              className="w-full p-2.5 border border-input rounded-md text-sm bg-background focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Business Type
            </label>
            <input 
              value={merchant.businessType} 
              onChange={e => setMerchant({...merchant, businessType: e.target.value})} 
              placeholder="Enter business type" 
              className="w-full p-2.5 border border-input rounded-md text-sm bg-background focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Monthly Revenue
            </label>
            <input 
              type="number" 
              value={merchant.monthlyRevenue || ''} 
              onChange={e => setMerchant({...merchant, monthlyRevenue: parseFloat(e.target.value) || 0})} 
              placeholder="0" 
              className="w-full p-2.5 border-2 border-secondary rounded-md text-sm bg-accent focus:ring-2 focus:ring-ring focus:border-transparent transition-all font-medium"
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="px-4 py-2.5 bg-destructive text-destructive-foreground rounded-lg text-center shadow-sm">
              <div className="text-xs opacity-90">Total Balance</div>
              <div className="text-lg font-bold">{fmt(totalBalance)}</div>
            </div>
            <div className="px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-center shadow-sm">
              <div className="text-xs opacity-90">Current Daily</div>
              <div className="text-lg font-bold">{fmt(totalCurrentDailyPayment)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Section */}
      <div className="mb-4 p-4 bg-accent rounded-lg border-2 border-secondary">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 items-end">
          <div className="col-span-2 md:col-span-1">
            <label className="block mb-2 font-bold text-foreground">
              Discount %: <span className="text-xs text-muted-foreground ml-1">(SP: {(sp * 100).toFixed(1)}%)</span>
            </label>
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                min="5" 
                max="50" 
                step="1" 
                value={(settings.dailyPaymentDecrease * 100).toFixed(0)} 
                onChange={e => setSettings({...settings, dailyPaymentDecrease: (parseFloat(e.target.value) || 0) / 100})} 
                className="w-16 p-2 border-2 border-destructive rounded-md text-lg font-bold text-center text-destructive bg-card"
              />
              <span className="font-bold text-destructive">%</span>
            </div>
            <input 
              type="range" 
              min="0.05" 
              max="0.50" 
              step="0.01" 
              value={settings.dailyPaymentDecrease} 
              onChange={e => setSettings({...settings, dailyPaymentDecrease: parseFloat(e.target.value)})} 
              className="w-full mt-2 accent-destructive"
            />
          </div>
          <div>
            <label className="block mb-1 text-xs font-semibold text-muted-foreground uppercase">Fee Schedule</label>
            <select 
              value={settings.feeSchedule} 
              onChange={e => setSettings({...settings, feeSchedule: e.target.value})} 
              className="w-full p-2.5 border border-input rounded-md text-sm bg-card"
            >
              <option value="average">Average</option>
              <option value="upfront">Fee Upfront</option>
            </select>
          </div>
          <div>
            <label className="block mb-1 text-xs font-semibold text-muted-foreground uppercase">Fee %</label>
            <input 
              type="number" 
              step="0.01" 
              value={settings.feePercent} 
              onChange={e => setSettings({...settings, feePercent: parseFloat(e.target.value) || 0})} 
              className="w-full p-2.5 border border-input rounded-md text-sm bg-card"
            />
          </div>
          <div>
            <label className="block mb-1 text-xs font-semibold text-muted-foreground uppercase">Rate</label>
            <input 
              type="number" 
              step="0.001" 
              value={settings.rate} 
              onChange={e => setSettings({...settings, rate: parseFloat(e.target.value) || 1})} 
              className="w-full p-2.5 border border-input rounded-md text-sm bg-card"
            />
          </div>
          <div>
            <label className="block mb-1 text-xs font-semibold text-muted-foreground uppercase">Broker %</label>
            <input 
              type="number" 
              step="0.01" 
              value={settings.brokerCommission} 
              onChange={e => setSettings({...settings, brokerCommission: parseFloat(e.target.value) || 0})} 
              className="w-full p-2.5 border border-input rounded-md text-sm bg-card"
            />
          </div>
          <div>
            <label className="block mb-1 text-xs font-semibold text-muted-foreground uppercase">New Money</label>
            <input 
              type="number" 
              value={settings.newMoney} 
              onChange={e => setSettings({...settings, newMoney: parseFloat(e.target.value) || 0})} 
              className="w-full p-2.5 border border-input rounded-md text-sm bg-card"
            />
          </div>
        </div>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 p-4 bg-card rounded-lg border-2 border-secondary shadow-sm">
          <div className="text-center p-3 bg-destructive/10 rounded-lg">
            <div className="text-xs text-muted-foreground font-medium">Current Weekly</div>
            <div className="text-xl font-bold text-destructive">{fmt(totalCurrentWeeklyPayment)}</div>
          </div>
          <div className="text-center p-3 bg-success/10 rounded-lg">
            <div className="text-xs text-muted-foreground font-medium">New Weekly</div>
            <div className="text-xl font-bold text-success">{fmt(newWeeklyPayment)}</div>
          </div>
          <div className="text-center p-3 bg-info/10 rounded-lg">
            <div className="text-xs text-muted-foreground font-medium">Weekly Savings</div>
            <div className="text-xl font-bold text-info">{fmt(weeklySavings)}</div>
          </div>
          <div className="text-center p-3 bg-primary/10 rounded-lg">
            <div className="text-xs text-muted-foreground font-medium">Monthly Savings</div>
            <div className="text-xl font-bold text-primary">{fmt(monthlySavings)}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 border-b-2 border-border overflow-x-auto">
        {tabs.map(tab => (
          <button 
            key={tab.key} 
            onClick={() => setActiveTab(tab.key)} 
            className={`px-4 md:px-6 py-3 border-none font-semibold rounded-t-lg capitalize cursor-pointer transition-all whitespace-nowrap ${
              activeTab === tab.key 
                ? 'bg-primary text-primary-foreground shadow-sm' 
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-card border border-border border-t-0 rounded-b-lg p-4 md:p-6 shadow-sm">
        
        {activeTab === 'positions' && (
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <h3 className="text-primary font-bold text-lg">MCA Positions</h3>
              <button 
                onClick={addPosition} 
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-semibold cursor-pointer hover:opacity-90 transition-opacity"
              >
                + Add Position
              </button>
            </div>
            
            {positions.length === 0 ? (
              <div className="text-center py-12 bg-muted rounded-lg border-2 border-dashed border-border">
                <p className="text-muted-foreground mb-4">No positions added yet</p>
                <button 
                  onClick={addPosition} 
                  className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold cursor-pointer text-lg hover:opacity-90 transition-opacity"
                >
                  + Add Your First Position
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-muted">
                      <th className="p-3 text-left border-b-2 border-border font-semibold">Entity</th>
                      <th className="p-3 text-right border-b-2 border-border font-semibold">Balance</th>
                      <th className="p-3 text-right border-b-2 border-border font-semibold">Daily Payment</th>
                      <th className="p-3 text-center border-b-2 border-border font-semibold">Days Left</th>
                      <th className="p-3 text-center border-b-2 border-border font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.filter(p => !p.isOurPosition).map(p => {
                      const daysLeft = p.dailyPayment > 0 ? Math.ceil(p.balance / p.dailyPayment) : 0;
                      return (
                        <tr key={p.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                          <td className="p-2">
                            <input 
                              value={p.entity} 
                              onChange={e => updatePosition(p.id, 'entity', e.target.value)} 
                              placeholder="Funder name" 
                              className="w-full p-2 border border-input rounded-md bg-background"
                            />
                          </td>
                          <td className="p-2">
                            <input 
                              type="number" 
                              value={p.balance || ''} 
                              onChange={e => updatePosition(p.id, 'balance', parseFloat(e.target.value) || 0)} 
                              placeholder="0.00" 
                              className="w-full p-2 border border-input rounded-md text-right bg-background"
                            />
                          </td>
                          <td className="p-2">
                            <input 
                              type="number" 
                              value={p.dailyPayment || ''} 
                              onChange={e => updatePosition(p.id, 'dailyPayment', parseFloat(e.target.value) || 0)} 
                              placeholder="0.00" 
                              className="w-full p-2 border border-input rounded-md text-right bg-background"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <span className={`px-3 py-1 rounded-full font-semibold text-sm ${
                              daysLeft > 186 ? 'bg-destructive/10 text-destructive' : 'bg-muted text-foreground'
                            }`}>
                              {daysLeft}
                            </span>
                          </td>
                          <td className="p-2 text-center">
                            <button 
                              onClick={() => deletePosition(p.id)} 
                              className="px-4 py-2 bg-destructive/10 text-destructive rounded-md font-semibold cursor-pointer border-none hover:bg-destructive/20 transition-colors"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-primary text-primary-foreground font-bold">
                      <td className="p-3 rounded-bl-md">TOTAL ({externalPositions.length} positions)</td>
                      <td className="p-3 text-right">{fmt(totalBalance)}</td>
                      <td className="p-3 text-right">{fmt(totalCurrentDailyPayment)}</td>
                      <td className="p-3 text-center">-</td>
                      <td className="p-3 text-center rounded-br-md">-</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'metrics' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-muted p-4 rounded-lg">
              <h4 className="text-primary font-bold mb-4 text-lg">Deal Metrics</h4>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border">
                  <tr><td className="py-2">Total Funding</td><td className="text-right font-semibold py-2">{fmt(totalFunding)}</td></tr>
                  <tr><td className="py-2">Net Advance</td><td className="text-right font-semibold py-2">{fmt(netAdvance)}</td></tr>
                  <tr><td className="py-2">Fees</td><td className="text-right py-2">{fmt(consolidationFees)}</td></tr>
                  <tr><td className="py-2">Rate</td><td className="text-right py-2">{settings.rate}</td></tr>
                  <tr className="bg-secondary/20"><td className="py-2 font-medium">Days to Payoff</td><td className="text-right font-bold py-2">{totalDays}</td></tr>
                  <tr><td className="py-2">New Daily Payment</td><td className="text-right font-semibold py-2">{fmt(newDailyPayment)}</td></tr>
                  <tr><td className="py-2">Max Exposure</td><td className="text-right text-destructive py-2">({fmt(metrics.maxExposure || 0)})</td></tr>
                  <tr><td className="py-2">Max Exposure Day</td><td className="text-right font-semibold py-2">{metrics.maxExposureDay || 0}</td></tr>
                  <tr className="bg-success/10"><td className="py-2 font-medium">Deal True Factor</td><td className="text-right font-bold py-2">{(metrics.dealTrueFactor || 0).toFixed(3)}</td></tr>
                </tbody>
              </table>
            </div>
            <div className="bg-muted p-4 rounded-lg">
              <h4 className="text-success font-bold mb-4 text-lg">Profit Analysis</h4>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border">
                  <tr><td className="py-2">Total Cash Infused</td><td className="text-right py-2">{fmt(metrics.totalCashInfusion || 0)}</td></tr>
                  <tr><td className="py-2">Actual Payback</td><td className="text-right py-2">{fmt(metrics.actualPaybackCollected || 0)}</td></tr>
                  <tr className="bg-success/10"><td className="py-2 font-medium">Profit</td><td className="text-right font-bold text-success py-2">{fmt(metrics.profit || 0)}</td></tr>
                  <tr><td className="py-2">Days Exposed</td><td className="text-right py-2">{metrics.lastDayExposed || 0}</td></tr>
                  <tr><td className="py-2">% Days in Red</td><td className="text-right py-2">{fmtPct(metrics.percentDaysInRed || 0)}</td></tr>
                  <tr><td className="py-2">Current Leverage</td><td className="text-right text-destructive py-2">{fmtPct(metrics.currentLeverage || 0)}</td></tr>
                  <tr><td className="py-2">New Leverage (SP)</td><td className="text-right text-success py-2">{fmtPct(sp * 100)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'daily' && (
          <div className="max-h-96 overflow-y-auto rounded-lg border border-border">
            {dailySchedule.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Add positions to see daily schedule</div>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    {['Day', 'Cash Infusion', 'Daily Withdrawal', 'Exposure', 'RTR Balance'].map((h, i) => (
                      <th key={i} className={`p-2.5 border-b-2 border-border font-semibold ${i === 0 ? 'text-center' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dailySchedule.slice(0, 200).map((d, i) => (
                    <tr key={i} className={`${d.isPayDay ? 'bg-secondary/20' : 'bg-card'} hover:bg-muted/50 transition-colors`}>
                      <td className="p-2 text-center font-medium">{d.day}</td>
                      <td className={`p-2 text-right ${d.cashInfusion > 0 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                        {d.cashInfusion > 0 ? fmt(d.cashInfusion) : '-'}
                      </td>
                      <td className="p-2 text-right text-success font-medium">{d.dailyWithdrawal > 0 ? fmt(d.dailyWithdrawal) : '-'}</td>
                      <td className={`p-2 text-right font-semibold ${d.exposureOnReverse > 0 ? 'text-destructive' : 'text-success'}`}>
                        {fmt(d.exposureOnReverse)}
                      </td>
                      <td className="p-2 text-right">{fmt(d.rtrBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'weekly' && (
          <div className="max-h-96 overflow-y-auto rounded-lg border border-border">
            {weeklySummary.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Add positions to see weekly summary</div>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="p-3 text-center font-semibold">Week</th>
                    <th className="p-3 text-right font-semibold">Cash Infusion</th>
                    <th className="p-3 text-right font-semibold">Total Debits</th>
                    <th className="p-3 text-right font-semibold">End Exposure</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklySummary.map((w, i) => (
                    <tr key={i} className="border-b border-border hover:bg-muted/50 transition-colors">
                      <td className="p-3 text-center font-semibold">{w.week}</td>
                      <td className="p-3 text-right text-destructive">{w.cashInfusion > 0 ? fmt(w.cashInfusion) : '-'}</td>
                      <td className="p-3 text-right text-success font-medium">{fmt(w.totalDebits)}</td>
                      <td className="p-3 text-right font-semibold">{fmt(w.endExposure)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'offer' && (
          <div>
            <h2 className="text-center text-primary text-xl font-bold mb-6">Deal Summary</h2>
            <div className="bg-secondary/20 rounded-lg border-2 border-secondary overflow-hidden mb-6">
              <div className="grid grid-cols-5">
                {['Advance Amount', 'Factor Rate', 'Total Payback', 'Payment', '# of Debits'].map(h => (
                  <div key={h} className="p-2 bg-secondary font-semibold text-sm text-center text-secondary-foreground">{h}</div>
                ))}
              </div>
              <div className="grid grid-cols-5 bg-card">
                <div className="p-4 text-center text-lg font-bold">{fmt(totalFunding)}</div>
                <div className="p-4 text-center text-lg font-bold">{settings.rate.toFixed(3)}</div>
                <div className="p-4 text-center text-lg font-bold">{fmt(totalFunding * settings.rate)}</div>
                <div className="p-4 text-center text-lg font-bold">{fmt(newDailyPayment)}</div>
                <div className="p-4 text-center text-lg font-bold">{newDailyPayment > 0 ? Math.ceil((totalFunding * settings.rate) / newDailyPayment) : 0}</div>
              </div>
              <div className="grid grid-cols-5 border-t-2 border-secondary">
                {['Orig Fee', 'ORG Amount', 'Net Funding', 'Financing Cost', 'Our Profit'].map(h => (
                  <div key={h} className="p-2 bg-secondary font-semibold text-sm text-center text-secondary-foreground">{h}</div>
                ))}
              </div>
              <div className="grid grid-cols-5 bg-card">
                <div className="p-4 text-center text-lg font-bold">{(settings.feePercent * 100).toFixed(1)}%</div>
                <div className="p-4 text-center text-lg font-bold">{fmt(consolidationFees)}</div>
                <div className="p-4 text-center text-lg font-bold">{fmt(netAdvance)}</div>
                <div className="p-4 text-center text-lg font-bold">{fmt((totalFunding * settings.rate) - totalFunding)}</div>
                <div className="p-4 text-center text-lg font-bold text-success">{fmt((totalFunding * settings.rate) - totalFunding - (totalFunding * settings.brokerCommission))}</div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-destructive/10 rounded-lg text-center border-2 border-destructive/20">
                <div className="text-sm text-muted-foreground font-medium">Current Leverage</div>
                <div className="text-3xl font-bold text-destructive">{(metrics.currentLeverage || 0).toFixed(0)}%</div>
              </div>
              <div className="p-4 bg-success/10 rounded-lg text-center border-2 border-success/20">
                <div className="text-sm text-muted-foreground font-medium">New Leverage (SP)</div>
                <div className="text-3xl font-bold text-success">{(sp * 100).toFixed(0)}%</div>
              </div>
              <div className="p-4 bg-info/10 rounded-lg text-center border-2 border-info/20">
                <div className="text-sm text-muted-foreground font-medium">Leverage Reduction</div>
                <div className="text-3xl font-bold text-info">-{((metrics.currentLeverage || 0) - (sp * 100)).toFixed(0)}%</div>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
