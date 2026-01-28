import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Save, FilePlus, Info, ChevronRight, FileSpreadsheet, FileText, CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/Navbar';
import { SaveCalculationDialog } from '@/components/SaveCalculationDialog';
import { ScheduleBreakdownDialog, BreakdownEntry } from '@/components/ScheduleBreakdownDialog';
import { Day1SummaryCard } from '@/components/Day1SummaryCard';
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog';
import { AdjustmentConfirmDialog, PendingChange } from '@/components/AdjustmentConfirmDialog';
import { useCalculations } from '@/hooks/useCalculations';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Merchant, 
  Settings, 
  Position, 
  DEFAULT_MERCHANT, 
  DEFAULT_SETTINGS,
  SavedCalculation
} from '@/types/calculation';
import { getFormattedLastPaymentDate, calculateRemainingBalance, formatBusinessDate } from '@/lib/dateUtils';
import { exportToExcel, exportToPDF, exportMerchantPDF } from '@/lib/exportUtils';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type TabType = 'positions' | 'metrics' | 'daily' | 'weekly' | 'offer' | 'merchantOffer';

export default function Index() {
  const { saveCalculation, updateCalculation, isSaving, isUpdating } = useCalculations();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [merchant, setMerchant] = useState<Merchant>(DEFAULT_MERCHANT);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [positions, setPositions] = useState<Position[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('positions');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [selectedBreakdown, setSelectedBreakdown] = useState<{ day?: number; week?: number } | null>(null);
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [lastSavedState, setLastSavedState] = useState<string>('');
  const [lastSavedCalculation, setLastSavedCalculation] = useState<SavedCalculation | null>(null);
  const [loadedCalculationId, setLoadedCalculationId] = useState<string | null>(null);
  const [loadedCalculationName, setLoadedCalculationName] = useState<string>('');
  
  // Pending adjustment state
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  
  // Local state for discount input to allow typing before confirmation
  const [discountInputValue, setDiscountInputValue] = useState<string>(
    (DEFAULT_SETTINGS.dailyPaymentDecrease * 100).toFixed(0)
  );
  
  // Sync discount input value when settings change externally
  useEffect(() => {
    setDiscountInputValue((settings.dailyPaymentDecrease * 100).toFixed(0));
  }, [settings.dailyPaymentDecrease]);

  // Check if there are unsaved changes
  const hasUnsavedChanges = useCallback(() => {
    const currentState = JSON.stringify({ merchant, settings, positions });
    // If we have data (positions or merchant name or settings changed from default)
    const hasData = positions.length > 0 || 
                    merchant.name !== '' || 
                    merchant.monthlyRevenue > 0 ||
                    settings.newMoney > 0;
    
    // If no data, no unsaved changes
    if (!hasData) return false;
    
    // If we've never saved, we have unsaved changes
    if (!lastSavedState) return true;
    
    // Compare current state to last saved state
    return currentState !== lastSavedState;
  }, [merchant, settings, positions, lastSavedState]);

  // Handle navigation with unsaved changes check
  const handleNavigation = useCallback((path: string) => {
    if (hasUnsavedChanges()) {
      setPendingNavigation(path);
      setUnsavedDialogOpen(true);
    } else {
      navigate(path);
    }
  }, [hasUnsavedChanges, navigate]);

  // Expose navigation handler to Navbar
  useEffect(() => {
    (window as any).__calculatorNavigation = handleNavigation;
    return () => {
      delete (window as any).__calculatorNavigation;
    };
  }, [handleNavigation]);

  // Load calculation from sessionStorage if available
  useEffect(() => {
    const stored = sessionStorage.getItem('loadCalculation');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        if (data.merchant) setMerchant(data.merchant);
        if (data.settings) setSettings(data.settings);
        if (data.positions) setPositions(data.positions);
        
        // Track the loaded calculation ID and name for updates
        if (data.id) {
          setLoadedCalculationId(data.id);
          setLoadedCalculationName(data.name || '');
        }
        
        sessionStorage.removeItem('loadCalculation');
        // Mark as "saved" state since we just loaded it
        setLastSavedState(JSON.stringify({ 
          merchant: data.merchant || DEFAULT_MERCHANT, 
          settings: data.settings || DEFAULT_SETTINGS, 
          positions: data.positions || [] 
        }));
        toast({
          title: 'Calculation loaded',
          description: 'Your saved calculation has been loaded.'
        });
      } catch (e) {
        console.error('Failed to parse stored calculation:', e);
      }
    }
  }, [toast]);

  // Helper to get effective balance - always use the stored balance for calculations
  const getEffectiveBalance = (p: Position): number | null => {
    return p.balance;
  };

  // Helper to get expected balance from funded date/amount for discrepancy comparison
  const getExpectedBalance = (p: Position): number | null => {
    return calculateRemainingBalance(p.fundedDate, p.amountFunded, p.dailyPayment);
  };

  // All external positions with known balances (for leverage calculations - merchant's full debt picture)
  const allExternalPositions = positions.filter(p => {
    const effectiveBalance = getEffectiveBalance(p);
    return !p.isOurPosition && effectiveBalance !== null && effectiveBalance > 0;
  });
  // Only positions included in the reverse (for advance/funding calculations)
  const includedPositions = allExternalPositions.filter(p => p.includeInReverse !== false);
  // Count "our" positions and unknown balance positions for display
  const ourPositionsCount = positions.filter(p => p.isOurPosition).length;
  const unknownBalanceCount = positions.filter(p => getEffectiveBalance(p) === null).length;
  
  // Use ALL positions for leverage metrics
  const totalBalanceAll = allExternalPositions.reduce((sum, p) => sum + (getEffectiveBalance(p) || 0), 0);
  const totalCurrentDailyPaymentAll = allExternalPositions.reduce((sum, p) => sum + (p.dailyPayment || 0), 0);
  
  // Use INCLUDED positions for reverse calculations
  const includedBalance = includedPositions.reduce((sum, p) => sum + (getEffectiveBalance(p) || 0), 0);
  const includedDailyPayment = includedPositions.reduce((sum, p) => sum + (p.dailyPayment || 0), 0);
  
  // Advance Amount = Included positions + New Money
  const totalAdvanceAmount = includedBalance + settings.newMoney;
  // For display purposes, keep totalBalance as included balance only
  const totalBalance = includedBalance;
  const totalCurrentDailyPayment = includedDailyPayment;
  const totalCurrentWeeklyPayment = totalCurrentDailyPayment * 5;
  
  const positionsWithDays = positions.map(p => {
    const effectiveBalance = getEffectiveBalance(p);
    return {
      ...p,
      balance: effectiveBalance, // Use effective balance for calculations
      daysLeft: p.dailyPayment > 0 && effectiveBalance !== null && effectiveBalance > 0 ? Math.ceil(effectiveBalance / p.dailyPayment) : 0
    };
  });

  // Total Funding = Advance Amount / (1 - Fee%) since new money is already in advance amount
  const totalFunding = totalAdvanceAmount / (1 - settings.feePercent);
  const netAdvance = totalFunding * (1 - settings.feePercent);
  const consolidationFees = totalFunding * settings.feePercent;
  
  const newDailyPayment = includedDailyPayment * (1 - settings.dailyPaymentDecrease);
  const newWeeklyPayment = newDailyPayment * 5;
  // Use ALL positions for leverage/SP calculations to show true merchant leverage
  const sp = merchant.monthlyRevenue > 0 ? (newDailyPayment * 22) / merchant.monthlyRevenue : 0;
  
  const dailySavings = totalCurrentDailyPayment - newDailyPayment;
  const weeklySavings = dailySavings * 5;
  const monthlySavings = dailySavings * 22;

  // Auto-force Average fees when New Money exists
  useEffect(() => {
    if (settings.newMoney > 0 && settings.feeSchedule === 'upfront') {
      setSettings(prev => ({ ...prev, feeSchedule: 'average' }));
    }
  }, [settings.newMoney, settings.feeSchedule]);

  // Auto-populate balance when funding data is entered (only if balance is null or 0)
  useEffect(() => {
    const updated = positions.map(p => {
      const expected = calculateRemainingBalance(p.fundedDate, p.amountFunded, p.dailyPayment);
      // Only auto-fill if balance is null or 0 and we have a calculated value > 0
      if ((p.balance === null || p.balance === 0) && expected !== null && expected > 0) {
        return { ...p, balance: expected };
      }
      return p;
    });
    // Only update if something changed
    if (JSON.stringify(updated) !== JSON.stringify(positions)) {
      setPositions(updated);
    }
  }, [positions.map(p => `${p.fundedDate}-${p.amountFunded}-${p.dailyPayment}`).join(',')]);

  const dailySchedule = useMemo(() => {
    if (includedBalance === 0 && settings.newMoney === 0) return [];
    const schedule: any[] = [];
    let cumulativeNetFunded = 0;
    let cumulativeDebits = 0;
    let dealComplete = false;
    const maxDays = 500;
    const originationFee = consolidationFees;
    
    // Only use INCLUDED positions for the schedule
    const includedPositionsWithDays = positionsWithDays.filter(p => !p.isOurPosition && p.includeInReverse !== false);
    
    for (let day = 1; day <= maxDays; day++) {
      if (dealComplete) break;
      const week = Math.ceil(day / 5);
      const dayOfWeek = ((day - 1) % 5) + 1;
      const isPayDay = dayOfWeek === 1;
      
      let cashInfusion = 0;
      if (isPayDay) {
        if (day === 1) cashInfusion = settings.newMoney;
        for (let d = day; d <= day + 4 && d <= maxDays; d++) {
          const dayPayment = includedPositionsWithDays
            .filter(p => p.balance > 0 && d <= p.daysLeft)
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
  }, [positionsWithDays, settings, newDailyPayment, consolidationFees, includedBalance]);

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

  // Calculate breakdown entries for a specific day or week (only included positions)
  const getBreakdownEntries = (day?: number, week?: number): { entries: BreakdownEntry[]; total: number } => {
    const entries: BreakdownEntry[] = [];
    let total = 0;
    
    // Only use INCLUDED positions for breakdown
    const includedPositionsWithDays = positionsWithDays.filter(p => !p.isOurPosition && p.includeInReverse !== false);

    if (day !== undefined) {
      // For daily breakdown - calculate which positions contribute on this payday
      const weekNum = Math.ceil(day / 5);
      const startDay = day;
      const endDay = Math.min(day + 4, 500);
      
      includedPositionsWithDays
        .filter(p => p.balance > 0)
        .forEach(p => {
          let daysContributing = 0;
          for (let d = startDay; d <= endDay; d++) {
            if (d <= p.daysLeft) daysContributing++;
          }
          if (daysContributing > 0) {
            entries.push({
              entity: p.entity,
              dailyPayment: p.dailyPayment,
              daysContributing,
              totalContribution: p.dailyPayment * daysContributing,
              remainingBalance: p.balance,
              totalDaysLeft: p.daysLeft
            });
            total += p.dailyPayment * daysContributing;
          }
        });

      // Add new money on day 1
      if (day === 1 && settings.newMoney > 0) {
        total += settings.newMoney;
      }
    } else if (week !== undefined) {
      // For weekly breakdown
      const startDay = (week - 1) * 5 + 1;
      const endDay = week * 5;
      
      includedPositionsWithDays
        .filter(p => p.balance > 0)
        .forEach(p => {
          let daysContributing = 0;
          for (let d = startDay; d <= endDay; d++) {
            if (d <= p.daysLeft) daysContributing++;
          }
          if (daysContributing > 0) {
            entries.push({
              entity: p.entity,
              dailyPayment: p.dailyPayment,
              daysContributing,
              totalContribution: p.dailyPayment * daysContributing,
              remainingBalance: p.balance,
              totalDaysLeft: p.daysLeft
            });
            total += p.dailyPayment * daysContributing;
          }
        });

      // Add new money on week 1
      if (week === 1 && settings.newMoney > 0) {
        total += settings.newMoney;
      }
    }

    return { entries, total };
  };

  const handleBreakdownClick = (day?: number, week?: number) => {
    setSelectedBreakdown({ day, week });
    setBreakdownOpen(true);
  };

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
    // Use ALL positions for leverage calculation (full merchant debt picture)
    const currentLeverage = merchant.monthlyRevenue > 0 ? (totalCurrentDailyPaymentAll * 22) / merchant.monthlyRevenue * 100 : 0;
    const percentDaysInRed = dailySchedule.length > 0 ? (lastDayExposed / dailySchedule.length) * 100 : 0;
    return { maxExposure, maxExposureDay, lastDayExposed, profit, dealTrueFactor, currentLeverage, totalCashInfusion, actualPaybackCollected, percentDaysInRed };
  }, [dailySchedule, consolidationFees, totalCurrentDailyPaymentAll, merchant.monthlyRevenue]);

  const addPosition = () => {
    const newId = positions.length > 0 ? Math.max(...positions.map(p => p.id)) + 1 : 1;
    setPositions([...positions, { id: newId, entity: '', balance: null, dailyPayment: 0, isOurPosition: false, includeInReverse: true, fundedDate: null, amountFunded: null }]);
  };

  const deletePosition = (id: number) => setPositions(positions.filter(p => p.id !== id));
  const updatePosition = (id: number, field: keyof Position, value: string | number | boolean) => 
    setPositions(positions.map(p => p.id === id ? { ...p, [field]: value } : p));

  const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v || 0);
  const fmtPct = (v: number) => `${(v || 0).toFixed(2)}%`;

  // Calculate what the schedule would be with a given discount
  const calculateDaysWithDiscount = (discount: number): number => {
    if (includedBalance === 0 && settings.newMoney === 0) return 0;
    const testDailyPayment = includedDailyPayment * (1 - discount);
    const testTotalFunding = totalAdvanceAmount / (1 - settings.feePercent);
    const testFees = testTotalFunding * settings.feePercent;
    
    // Only use included positions for schedule calculation
    const includedPositionsWithDays = positionsWithDays.filter(p => !p.isOurPosition && p.includeInReverse !== false);
    let cumNetFunded = 0;
    let cumDebits = 0;
    let days = 0;
    const maxDays = 500;
    
    for (let day = 1; day <= maxDays; day++) {
      const week = Math.ceil(day / 5);
      const dayOfWeek = ((day - 1) % 5) + 1;
      const isPayDay = dayOfWeek === 1;
      
      let cashInfusion = 0;
      if (isPayDay) {
        if (day === 1) cashInfusion = settings.newMoney;
        for (let d = day; d <= day + 4 && d <= maxDays; d++) {
          const dayPayment = includedPositionsWithDays
            .filter(p => p.balance > 0 && d <= p.daysLeft)
            .reduce((sum, p) => sum + p.dailyPayment, 0);
          cashInfusion += dayPayment;
        }
      }
      
      cumNetFunded += cashInfusion;
      const cumGross = cumNetFunded + testFees;
      const rtrBefore = (cumGross * settings.rate) - cumDebits;
      
      if (day >= 2 && rtrBefore > 0) {
        cumDebits += Math.min(testDailyPayment, rtrBefore);
      }
      
      const rtrBalance = (cumGross * settings.rate) - cumDebits;
      days = day;
      if (rtrBalance <= 0) break;
    }
    return days;
  };

  // Handle discount change with confirmation
  const handleDiscountChange = (newDiscount: number) => {
    const oldDiscount = settings.dailyPaymentDecrease;
    if (Math.abs(oldDiscount - newDiscount) < 0.001) return;
    
    const oldDailyPayment = totalCurrentDailyPayment * (1 - oldDiscount);
    const newDailyPaymentCalc = totalCurrentDailyPayment * (1 - newDiscount);
    const oldDays = calculateDaysWithDiscount(oldDiscount);
    const newDays = calculateDaysWithDiscount(newDiscount);
    
    setPendingChange({
      type: 'discount',
      oldValue: oldDiscount,
      newValue: newDiscount,
      oldDailyPayment,
      newDailyPayment: newDailyPaymentCalc,
      oldDaysToPayoff: oldDays,
      newDaysToPayoff: newDays,
    });
    setAdjustmentDialogOpen(true);
  };

  // Confirm the pending change
  const confirmChange = () => {
    if (!pendingChange) return;
    
    setSettings({ ...settings, dailyPaymentDecrease: pendingChange.newValue });
    
    setAdjustmentDialogOpen(false);
    setPendingChange(null);
  };

  // Cancel the pending change
  const cancelChange = () => {
    // Reset discount input to current value when cancelled
    setDiscountInputValue((settings.dailyPaymentDecrease * 100).toFixed(0));
    setAdjustmentDialogOpen(false);
    setPendingChange(null);
  };

  const handleNewCalculation = () => {
    setMerchant(DEFAULT_MERCHANT);
    setSettings(DEFAULT_SETTINGS);
    setPositions([]);
    setActiveTab('positions');
    setLoadedCalculationId(null);
    setLoadedCalculationName('');
    setLastSavedState('');
  };

  // Create export data from current state (for exporting without saving)
  const createExportData = (): SavedCalculation => ({
    id: loadedCalculationId || 'temp',
    user_id: 'export',
    name: merchant.name ? `${merchant.name} Consolidation` : 'Consolidation Proposal',
    merchant_name: merchant.name,
    merchant_business_type: merchant.businessType,
    merchant_monthly_revenue: merchant.monthlyRevenue,
    settings,
    positions,
    total_balance: totalBalance,
    total_daily_payment: totalCurrentDailyPayment,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  const handleSave = async (name: string) => {
    const result = await saveCalculation({
      name,
      merchant,
      settings,
      positions,
      totalBalance,
      totalDailyPayment: totalCurrentDailyPayment
    });
    // Mark current state as saved
    setLastSavedState(JSON.stringify({ merchant, settings, positions }));
    
    // Clear loaded ID since this is now a new calculation
    setLoadedCalculationId(result?.id || null);
    setLoadedCalculationName(name);
    
    // Store the saved calculation for export options
    if (result) {
      const savedCalc: SavedCalculation = {
        id: result.id || '',
        user_id: result.user_id || '',
        name,
        merchant_name: merchant.name,
        merchant_business_type: merchant.businessType,
        merchant_monthly_revenue: merchant.monthlyRevenue,
        settings,
        positions,
        total_balance: totalBalance,
        total_daily_payment: totalCurrentDailyPayment,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      setLastSavedCalculation(savedCalc);
      
      // Show toast with export options
      toast({
        title: 'Calculation saved!',
        description: (
          <div className="mt-2">
            <p className="mb-2 text-sm">Export your proposal:</p>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  exportToExcel(savedCalc);
                  toast({ title: 'Excel exported', description: 'File downloaded successfully.' });
                }}
              >
                <FileSpreadsheet className="w-4 h-4 mr-1" />
                Excel
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  exportToPDF(savedCalc);
                  toast({ title: 'PDF exported', description: 'File downloaded successfully.' });
                }}
              >
                <FileText className="w-4 h-4 mr-1" />
                PDF
              </Button>
            </div>
          </div>
        ),
        duration: 10000,
      });
    }
  };

  const handleUpdate = async (name: string) => {
    if (!loadedCalculationId) return;
    
    const result = await updateCalculation({
      id: loadedCalculationId,
      name,
      merchant,
      settings,
      positions,
      totalBalance,
      totalDailyPayment: totalCurrentDailyPayment
    });
    
    // Mark current state as saved
    setLastSavedState(JSON.stringify({ merchant, settings, positions }));
    setLoadedCalculationName(name);
    
    // Store the saved calculation for export options
    if (result) {
      const savedCalc: SavedCalculation = {
        id: result.id || '',
        user_id: result.user_id || '',
        name,
        merchant_name: merchant.name,
        merchant_business_type: merchant.businessType,
        merchant_monthly_revenue: merchant.monthlyRevenue,
        settings,
        positions,
        total_balance: totalBalance,
        total_daily_payment: totalCurrentDailyPayment,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      setLastSavedCalculation(savedCalc);
      
      // Show toast with export options
      toast({
        title: 'Calculation updated!',
        description: (
          <div className="mt-2">
            <p className="mb-2 text-sm">Export your proposal:</p>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  exportToExcel(savedCalc);
                  toast({ title: 'Excel exported', description: 'File downloaded successfully.' });
                }}
              >
                <FileSpreadsheet className="w-4 h-4 mr-1" />
                Excel
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  exportToPDF(savedCalc);
                  toast({ title: 'PDF exported', description: 'File downloaded successfully.' });
                }}
              >
                <FileText className="w-4 h-4 mr-1" />
                PDF
              </Button>
            </div>
          </div>
        ),
        duration: 10000,
      });
    }
  };

  const handleSaveAndLeave = async () => {
    setSaveDialogOpen(true);
    setUnsavedDialogOpen(false);
  };

  const handleDiscardAndLeave = () => {
    setUnsavedDialogOpen(false);
    if (pendingNavigation) {
      navigate(pendingNavigation);
      setPendingNavigation(null);
    }
  };

  // Build position counts for tab label
  const positionCountParts = [`${includedPositions.length}/${allExternalPositions.length}`];
  if (ourPositionsCount > 0) positionCountParts.push(`${ourPositionsCount} ours`);
  if (unknownBalanceCount > 0) positionCountParts.push(`${unknownBalanceCount} ?`);

  const tabs: { key: TabType; label: string }[] = [
    { key: 'positions', label: `Positions (${positionCountParts.join(', ')})` },
    { key: 'metrics', label: 'Metrics' },
    { key: 'daily', label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'offer', label: 'Offer' },
    { key: 'merchantOffer', label: "Merchant's Offer" },
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
            <Button 
              variant="outline" 
              onClick={() => exportToExcel(createExportData())}
              disabled={positions.length === 0}
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Excel
            </Button>
            <Button 
              variant="outline" 
              onClick={() => exportToPDF(createExportData())}
              disabled={positions.length === 0}
            >
              <FileText className="w-4 h-4 mr-2" />
              PDF
            </Button>
            <Button onClick={() => setSaveDialogOpen(true)}>
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
        </div>

        <SaveCalculationDialog
          open={saveDialogOpen}
          onOpenChange={(open) => {
            setSaveDialogOpen(open);
            // If saved successfully and there was pending navigation, go there
            if (!open && pendingNavigation && !isSaving && !isUpdating) {
              setTimeout(() => {
                if (pendingNavigation) {
                  navigate(pendingNavigation);
                  setPendingNavigation(null);
                }
              }, 100);
            }
          }}
          onSave={handleSave}
          onUpdate={handleUpdate}
          isSaving={isSaving || isUpdating}
          defaultName={merchant.name ? `${merchant.name} Consolidation` : ''}
          existingId={loadedCalculationId}
          existingName={loadedCalculationName}
        />

        <UnsavedChangesDialog
          isOpen={unsavedDialogOpen}
          onClose={() => {
            setUnsavedDialogOpen(false);
            setPendingNavigation(null);
          }}
          onDiscard={handleDiscardAndLeave}
          onSave={handleSaveAndLeave}
          isSaving={isSaving}
        />

        <AdjustmentConfirmDialog
          open={adjustmentDialogOpen}
          onOpenChange={setAdjustmentDialogOpen}
          pendingChange={pendingChange}
          onConfirm={confirmChange}
          onCancel={cancelChange}
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
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
              <input 
                type="number" 
                value={merchant.monthlyRevenue || ''} 
                onChange={e => setMerchant({...merchant, monthlyRevenue: parseFloat(e.target.value) || 0})} 
                placeholder="0" 
                className="w-full p-2.5 pl-7 border-2 border-secondary rounded-md text-sm bg-accent focus:ring-2 focus:ring-ring focus:border-transparent transition-all font-medium"
              />
            </div>
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
                value={discountInputValue}
                onChange={e => setDiscountInputValue(e.target.value)}
                onBlur={e => {
                  const newValue = (parseFloat(e.target.value) || 0) / 100;
                  if (Math.abs(newValue - settings.dailyPaymentDecrease) > 0.001) {
                    handleDiscountChange(newValue);
                  }
                }}
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
              onChange={e => handleDiscountChange(parseFloat(e.target.value))} 
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
              <option value="upfront" disabled={settings.newMoney > 0}>
                {settings.newMoney > 0 ? 'Fee Upfront (disabled w/ New Money)' : 'Fee Upfront'}
              </option>
            </select>
            {settings.newMoney > 0 && (
              <p className="text-xs text-muted-foreground mt-1">Upfront fees disabled when using New Money</p>
            )}
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
          <TooltipProvider>
            <div>
              <label className="mb-1 text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                New Money
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[250px]">
                    <p>Additional cash paid to the merchant on Day 1, on top of paying off their existing positions.</p>
                  </TooltipContent>
                </Tooltip>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                <input 
                  type="number" 
                  value={settings.newMoney} 
                  onChange={e => setSettings({...settings, newMoney: parseFloat(e.target.value) || 0})} 
                  className="w-full p-2.5 pl-7 border-2 border-success rounded-md text-sm bg-card font-medium"
                />
              </div>
            </div>
          </TooltipProvider>
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

      {/* Deal Summary - Key Metrics Header */}
      <div className="mb-4 p-4 bg-primary rounded-lg shadow-lg">
        <h3 className="text-primary-foreground font-bold text-lg mb-3">Deal Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* Advance Amount - Editable */}
          <div className="bg-primary-foreground/10 rounded-lg p-3">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <label className="text-xs text-primary-foreground/80 font-medium uppercase flex items-center gap-1 mb-1 cursor-help">
                    Advance Amount
                    <Info className="h-3 w-3" />
                  </label>
                </TooltipTrigger>
                <TooltipContent className="max-w-[250px]">
                  <p>The advance amount equals the sum of all position balances and updates automatically when positions change.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="text-2xl font-bold text-primary-foreground text-right">
              {fmt(totalAdvanceAmount)}
            </div>
          </div>
          
          {/* Factor Rate - Display */}
          <div className="bg-primary-foreground/10 rounded-lg p-3 text-center">
            <div className="text-xs text-primary-foreground/80 font-medium uppercase mb-1">Factor Rate</div>
            <div className="text-2xl font-bold text-primary-foreground">{settings.rate.toFixed(3)}</div>
          </div>
          
          {/* Total Payback (RTR) - Display */}
          <div className="bg-primary-foreground/10 rounded-lg p-3 text-center">
            <div className="text-xs text-primary-foreground/80 font-medium uppercase mb-1">Total Payback</div>
            <div className="text-2xl font-bold text-primary-foreground">{fmt(totalFunding * settings.rate)}</div>
          </div>
          
          {/* Daily Payment - Display */}
          <div className="bg-primary-foreground/10 rounded-lg p-3 text-center">
            <div className="text-xs text-primary-foreground/80 font-medium uppercase mb-1">Daily Payment</div>
            <div className="text-2xl font-bold text-primary-foreground">{fmt(newDailyPayment)}</div>
          </div>
          
          {/* Number of Debits - Display */}
          <div className="bg-primary-foreground/10 rounded-lg p-3 text-center">
            <div className="text-xs text-primary-foreground/80 font-medium uppercase mb-1"># of Debits</div>
            <div className="text-2xl font-bold text-primary-foreground">{totalDays}</div>
          </div>
        </div>
      </div>

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
                      <th className="p-3 text-center border-b-2 border-border font-semibold w-16">Ours</th>
                      <th className="p-3 text-center border-b-2 border-border font-semibold w-16">Include</th>
                      <th className="p-3 text-left border-b-2 border-border font-semibold">Entity</th>
                      <th className="p-3 text-center border-b-2 border-border font-semibold">Funded Date</th>
                      <th className="p-3 text-right border-b-2 border-border font-semibold">Amount Funded</th>
                      <th className="p-3 text-right border-b-2 border-border font-semibold">Balance</th>
                      <th className="p-3 text-right border-b-2 border-border font-semibold">Daily</th>
                      <th className="p-3 text-right border-b-2 border-border font-semibold">Weekly</th>
                      <th className="p-3 text-center border-b-2 border-border font-semibold">Days Left</th>
                      <th className="p-3 text-center border-b-2 border-border font-semibold">Last Payment</th>
                      <th className="p-3 text-center border-b-2 border-border font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map(p => {
                      // Get expected balance from funding data for discrepancy comparison
                      const expectedBalance = getExpectedBalance(p);
                      const effectiveBalance = p.balance;
                      
                      // Check if there's a discrepancy between manual balance and calculated
                      const hasDiscrepancy = expectedBalance !== null && p.balance !== null && 
                        Math.abs(expectedBalance - p.balance) > 0.01;
                      
                      const daysLeft = p.dailyPayment > 0 && effectiveBalance !== null && effectiveBalance > 0 
                        ? Math.ceil(effectiveBalance / p.dailyPayment) 
                        : 0;
                      const isIncluded = p.includeInReverse !== false;
                      const isOurs = p.isOurPosition;
                      const isUnknown = effectiveBalance === null;
                      const isExcluded = !isIncluded && !isOurs;
                      
                      return (
                        <tr 
                          key={p.id} 
                          className={`border-b border-border hover:bg-muted/50 transition-colors 
                            ${isOurs ? 'bg-primary/10 border-l-4 border-l-primary' : ''} 
                            ${isExcluded ? 'opacity-50' : ''}`}
                        >
                          {/* Ours checkbox */}
                          <td className="p-2 text-center">
                            <Checkbox
                              checked={isOurs}
                              onCheckedChange={(checked) => updatePosition(p.id, 'isOurPosition', !!checked)}
                              className="mx-auto"
                            />
                          </td>
                          {/* Include checkbox - only for non-ours positions */}
                          <td className="p-2 text-center">
                            {!isOurs ? (
                              <Checkbox
                                checked={isIncluded}
                                onCheckedChange={(checked) => updatePosition(p.id, 'includeInReverse', !!checked)}
                                className="mx-auto"
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="p-2">
                            <input 
                              value={p.entity} 
                              onChange={e => updatePosition(p.id, 'entity', e.target.value)} 
                              placeholder="Funder name" 
                              className={`w-full p-2 border border-input rounded-md bg-background ${isExcluded ? 'line-through text-muted-foreground' : ''}`}
                            />
                          </td>
                          {/* Funded Date picker */}
                          <td className="p-2">
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full justify-start text-left font-normal h-10",
                                    !p.fundedDate && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {p.fundedDate ? format(new Date(p.fundedDate), "MMM d, yyyy") : <span>Pick date</span>}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={p.fundedDate ? new Date(p.fundedDate) : undefined}
                                  onSelect={(date) => updatePosition(p.id, 'fundedDate', date ? date.toISOString().split('T')[0] : null)}
                                  initialFocus
                                  className={cn("p-3 pointer-events-auto")}
                                />
                              </PopoverContent>
                            </Popover>
                          </td>
                          {/* Amount Funded input */}
                          <td className="p-2">
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                              <input 
                                type="number" 
                                value={p.amountFunded ?? ''} 
                                onChange={e => {
                                  const val = e.target.value;
                                  updatePosition(p.id, 'amountFunded', val === '' ? null : parseFloat(val) || 0);
                                }} 
                                placeholder="0.00" 
                                className={`w-full p-2 pl-5 border border-input rounded-md text-right bg-background ${isExcluded ? 'text-muted-foreground' : ''}`}
                              />
                            </div>
                          </td>
                          {/* Balance cell - always editable with discrepancy indicator */}
                          <td className="p-2">
                            <div className="space-y-1">
                              {isUnknown ? (
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-1 bg-warning/20 text-warning-foreground rounded text-xs font-semibold border border-warning/30">
                                    Unknown
                                  </span>
                                  <button 
                                    onClick={() => updatePosition(p.id, 'balance', 0)}
                                    className="text-xs text-muted-foreground hover:text-foreground underline"
                                  >
                                    Set
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <div className="relative flex items-center gap-1">
                                    <div className="relative flex-1">
                                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                                      <input 
                                        type="number" 
                                        value={p.balance ?? ''} 
                                        onChange={e => {
                                          const val = e.target.value;
                                          updatePosition(p.id, 'balance', val === '' ? null : parseFloat(val) || 0);
                                        }} 
                                        placeholder="0.00" 
                                        className={`w-full p-2 pl-5 border rounded-md text-right bg-background 
                                          ${hasDiscrepancy ? 'border-warning' : 'border-input'}
                                          ${isExcluded ? 'text-muted-foreground' : ''}`}
                                      />
                                    </div>
                                    <button 
                                      onClick={() => updatePosition(p.id, 'balance', null)}
                                      className="text-xs text-muted-foreground hover:text-warning font-bold"
                                      title="Mark as unknown"
                                    >
                                      ?
                                    </button>
                                    {/* Sync to calculated button (only shown when discrepancy exists) */}
                                    {hasDiscrepancy && expectedBalance !== null && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button 
                                              onClick={() => updatePosition(p.id, 'balance', expectedBalance)}
                                              className="text-xs text-warning hover:text-warning/80"
                                              title="Sync to calculated balance"
                                            >
                                              🔄
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Reset to calculated: {fmt(expectedBalance)}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                  </div>
                                  {/* Discrepancy indicator */}
                                  {hasDiscrepancy && expectedBalance !== null && (
                                    <div className="flex items-center gap-1 text-xs text-warning">
                                      <span>⚠️</span>
                                      <span>Expected: {fmt(expectedBalance)}</span>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                              <input 
                                type="number" 
                                value={p.dailyPayment || ''} 
                                onChange={e => updatePosition(p.id, 'dailyPayment', parseFloat(e.target.value) || 0)} 
                                placeholder="0.00" 
                                className={`w-full p-2 pl-5 border border-input rounded-md text-right bg-background ${isExcluded ? 'text-muted-foreground' : ''}`}
                              />
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                              <input 
                                type="number" 
                                value={p.dailyPayment ? (p.dailyPayment * 5).toFixed(2) : ''} 
                                onChange={e => {
                                  const weekly = parseFloat(e.target.value) || 0;
                                  updatePosition(p.id, 'dailyPayment', weekly / 5);
                                }} 
                                placeholder="0.00" 
                                className={`w-full p-2 pl-5 border border-input rounded-md text-right bg-background ${isExcluded ? 'text-muted-foreground' : ''}`}
                              />
                            </div>
                          </td>
                          <td className="p-2 text-center">
                            {isUnknown ? (
                              <span className="text-xs text-muted-foreground">?</span>
                            ) : (
                              <span className={`px-3 py-1 rounded-full font-semibold text-sm ${
                                daysLeft > 186 ? 'bg-destructive/10 text-destructive' : 'bg-muted text-foreground'
                              }`}>
                                {daysLeft}
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            {isUnknown ? (
                              <span className="text-xs text-muted-foreground">-</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {getFormattedLastPaymentDate(daysLeft)}
                              </span>
                            )}
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
                      <td className="p-3 rounded-bl-md"></td>
                      <td className="p-3"></td>
                      <td className="p-3">
                        {`REVERSING ${includedPositions.length} of ${allExternalPositions.length}`}
                        {ourPositionsCount > 0 && <span className="ml-1 font-normal text-xs">({ourPositionsCount} ours)</span>}
                        {unknownBalanceCount > 0 && <span className="ml-1 font-normal text-xs">({unknownBalanceCount} unknown)</span>}
                      </td>
                      <td className="p-3 text-center">-</td>
                      <td className="p-3 text-right">{fmt(positions.reduce((sum, p) => sum + (p.amountFunded || 0), 0))}</td>
                      <td className="p-3 text-right">{fmt(totalBalance)}</td>
                      <td className="p-3 text-right">{fmt(totalCurrentDailyPayment)}</td>
                      <td className="p-3 text-right">{fmt(totalCurrentWeeklyPayment)}</td>
                      <td className="p-3 text-center">-</td>
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
          <div className="space-y-4">
            {/* Day 1 Summary Card */}
            {dailySchedule.length > 0 && (
              <Day1SummaryCard
                cashInfused={dailySchedule[0]?.cashInfusion || 0}
                originationFee={consolidationFees}
                feePercent={settings.feePercent}
                grossContract={dailySchedule[0]?.cumulativeGross || 0}
                factorRate={settings.rate}
                day1Rtr={dailySchedule[0]?.rtrBalance || 0}
                feeSchedule={settings.feeSchedule}
              />
            )}
            
            <div className="max-h-[500px] overflow-y-auto rounded-lg border border-border">
              {dailySchedule.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">Add positions to see daily schedule</div>
              ) : (
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 bg-muted z-10">
                    <tr>
                      {['Day', 'Cash In', 'Cum. Funded', 'Gross (w/ Fees)', 'Daily Debit', 'RTR Balance', 'Exposure'].map((h, i) => (
                        <th key={i} className={`p-2.5 border-b-2 border-border font-semibold ${i === 0 ? 'text-center' : 'text-right'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dailySchedule.map((d, i) => (
                      <tr key={i} className={`${d.isPayDay ? 'bg-secondary/20' : 'bg-card'} hover:bg-muted/50 transition-colors`}>
                        <td className="p-2 text-center font-medium">{d.day}</td>
                        <td 
                          className={`p-2 text-right ${d.cashInfusion > 0 ? 'text-destructive font-medium cursor-pointer hover:underline' : 'text-muted-foreground'}`}
                          onClick={() => d.cashInfusion > 0 && handleBreakdownClick(d.day)}
                        >
                          {d.cashInfusion > 0 ? (
                            <span className="inline-flex items-center justify-end gap-1">
                              {fmt(d.cashInfusion)}
                              <ChevronRight className="h-3 w-3" />
                            </span>
                          ) : '-'}
                        </td>
                        <td className="p-2 text-right text-muted-foreground">{fmt(d.cumulativeNetFunded)}</td>
                        <td className="p-2 text-right font-medium text-primary">{fmt(d.cumulativeGross)}</td>
                        <td className="p-2 text-right text-success font-medium">{d.dailyWithdrawal > 0 ? fmt(d.dailyWithdrawal) : '-'}</td>
                        <td className="p-2 text-right">{fmt(d.rtrBalance)}</td>
                        <td className={`p-2 text-right font-semibold ${d.exposureOnReverse > 0 ? 'text-destructive' : 'text-success'}`}>
                          {fmt(d.exposureOnReverse)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
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
                      <td 
                        className={`p-3 text-right ${w.cashInfusion > 0 ? 'text-destructive cursor-pointer hover:underline' : ''}`}
                        onClick={() => w.cashInfusion > 0 && handleBreakdownClick(undefined, w.week)}
                      >
                        {w.cashInfusion > 0 ? (
                          <span className="inline-flex items-center justify-end gap-1">
                            {fmt(w.cashInfusion)}
                            <ChevronRight className="h-3 w-3" />
                          </span>
                        ) : '-'}
                      </td>
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

        {activeTab === 'merchantOffer' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-primary">Your Consolidation Offer</h2>
              <Button
                onClick={() => {
                  // Create a temporary calculation object for PDF export
                  const tempCalc = {
                    id: '',
                    user_id: '',
                    name: merchant.name || 'Merchant Offer',
                    merchant_name: merchant.name,
                    merchant_business_type: merchant.businessType,
                    merchant_monthly_revenue: merchant.monthlyRevenue,
                    settings,
                    positions,
                    total_balance: totalBalance,
                    total_daily_payment: totalCurrentDailyPayment,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  };
                  exportMerchantPDF(tempCalc);
                  toast({ title: 'Merchant PDF exported', description: 'File downloaded successfully.' });
                }}
              >
                <FileText className="w-4 h-4 mr-2" />
                Export Merchant PDF
              </Button>
            </div>

            {/* Positions Being Consolidated */}
            <div className="bg-muted rounded-lg p-4">
              <h3 className="font-semibold text-foreground mb-3 uppercase text-sm tracking-wide">Positions Being Consolidated</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-2 font-semibold">Funder</th>
                      <th className="text-right p-2 font-semibold">Balance</th>
                      <th className="text-right p-2 font-semibold">Daily Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {includedPositions.map(p => (
                      <tr key={p.id} className="border-b border-border/50">
                        <td className="p-2">{p.entity || 'Unknown Funder'}</td>
                        <td className="p-2 text-right">{fmt(getEffectiveBalance(p) || 0)}</td>
                        <td className="p-2 text-right">{fmt(p.dailyPayment)}/day</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-primary text-primary-foreground font-bold">
                      <td className="p-2 rounded-bl-md">TOTAL</td>
                      <td className="p-2 text-right">{fmt(totalBalance)}</td>
                      <td className="p-2 text-right rounded-br-md">{fmt(totalCurrentDailyPayment)}/day</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Payment Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-destructive/10 border-2 border-destructive/30 rounded-lg p-4 text-center">
                <div className="text-sm text-muted-foreground font-medium uppercase mb-2">Old Payment</div>
                <div className="text-2xl font-bold text-destructive">{fmt(totalCurrentDailyPayment)}/day</div>
                <div className="text-lg text-destructive/80">{fmt(totalCurrentWeeklyPayment)}/week</div>
              </div>
              <div className="bg-success/10 border-2 border-success/30 rounded-lg p-4 text-center">
                <div className="text-sm text-muted-foreground font-medium uppercase mb-2">New Payment</div>
                <div className="text-2xl font-bold text-success">{fmt(newDailyPayment)}/day</div>
                <div className="text-lg text-success/80">{fmt(newWeeklyPayment)}/week</div>
              </div>
            </div>

            {/* Reduction Badge */}
            <div className="text-center">
              <span className="inline-block bg-success text-success-foreground px-6 py-2 rounded-full font-bold text-lg">
                ▼ {(settings.dailyPaymentDecrease * 100).toFixed(0)}% PAYMENT REDUCTION ▼
              </span>
            </div>

            {/* HIGHLIGHTED SAVINGS SECTION */}
            <div className="bg-gradient-to-r from-success/20 via-success/10 to-success/20 border-4 border-success rounded-xl p-6 shadow-lg">
              <h3 className="text-center text-success font-bold text-xl mb-4 uppercase tracking-wide">
                💰 Your Savings 💰
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-card rounded-lg p-4 text-center shadow-sm border border-success/30">
                  <div className="text-sm text-muted-foreground uppercase mb-1">Daily Savings</div>
                  <div className="text-3xl font-bold text-success">{fmt(dailySavings)}</div>
                  <div className="text-xs text-muted-foreground">per day</div>
                </div>
                <div className="bg-card rounded-lg p-4 text-center shadow-sm border border-success/30">
                  <div className="text-sm text-muted-foreground uppercase mb-1">Weekly Savings</div>
                  <div className="text-3xl font-bold text-success">{fmt(weeklySavings)}</div>
                  <div className="text-xs text-muted-foreground">per week</div>
                </div>
                <div className="bg-success text-success-foreground rounded-lg p-4 text-center shadow-md">
                  <div className="text-sm uppercase mb-1 opacity-90">Monthly Savings</div>
                  <div className="text-4xl font-bold">{fmt(monthlySavings)}</div>
                  <div className="text-xs opacity-90">per month</div>
                </div>
              </div>
            </div>

            {/* Cash You Receive */}
            {settings.newMoney > 0 && (
              <div className="bg-primary/10 border-2 border-primary/30 rounded-lg p-6 text-center">
                <div className="text-sm text-muted-foreground font-medium uppercase mb-2">Cash You Receive on Day 1</div>
                <div className="text-4xl font-bold text-primary">{fmt(settings.newMoney)}</div>
              </div>
            )}

            {/* Deal Terms */}
            <div className="bg-secondary/20 rounded-lg border-2 border-secondary overflow-hidden">
              <div className="bg-secondary p-2">
                <h3 className="font-semibold text-secondary-foreground text-center uppercase text-sm tracking-wide">Deal Terms</h3>
              </div>
              <div className="grid grid-cols-5 bg-card p-4 gap-4 text-center">
                <div>
                  <div className="text-xs text-muted-foreground uppercase mb-1">Amount Funded</div>
                  <div className="text-lg font-bold">{fmt(totalFunding)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase mb-1">Total Payback</div>
                  <div className="text-lg font-bold">{fmt(totalFunding * settings.rate)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase mb-1">Factor Rate</div>
                  <div className="text-lg font-bold">{settings.rate.toFixed(3)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase mb-1">Origination Fee</div>
                  <div className="text-lg font-bold">{(settings.feePercent * 100).toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase mb-1"># of Payments</div>
                  <div className="text-lg font-bold">{totalDays}</div>
                </div>
              </div>
            </div>

            {/* Positions NOT Included in Reverse */}
            {(() => {
              const excludedPositions = allExternalPositions.filter(p => p.includeInReverse === false);
              if (excludedPositions.length === 0) return null;
              
              const excludedBalance = excludedPositions.reduce((sum, p) => sum + (getEffectiveBalance(p) || 0), 0);
              const excludedDailyPayment = excludedPositions.reduce((sum, p) => sum + (p.dailyPayment || 0), 0);
              
              return (
                <div className="bg-muted/50 rounded-lg p-4 border border-border">
                  <h3 className="font-semibold text-muted-foreground mb-3 uppercase text-sm tracking-wide">
                    Positions Not Included in This Consolidation
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    The following positions will remain separate and continue their existing payment schedules:
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left p-2 font-semibold text-muted-foreground">Funder</th>
                          <th className="text-right p-2 font-semibold text-muted-foreground">Balance</th>
                          <th className="text-right p-2 font-semibold text-muted-foreground">Daily Payment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {excludedPositions.map(p => (
                          <tr key={p.id} className="border-b border-border/50">
                            <td className="p-2 text-muted-foreground">{p.entity || 'Unknown Funder'}</td>
                            <td className="p-2 text-right text-muted-foreground">{fmt(getEffectiveBalance(p) || 0)}</td>
                            <td className="p-2 text-right text-muted-foreground">{fmt(p.dailyPayment)}/day</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-muted font-semibold text-muted-foreground">
                          <td className="p-2 rounded-bl-md">SUBTOTAL (Not Included)</td>
                          <td className="p-2 text-right">{fmt(excludedBalance)}</td>
                          <td className="p-2 text-right rounded-br-md">{fmt(excludedDailyPayment)}/day</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

        {/* Schedule Breakdown Dialog */}
        <ScheduleBreakdownDialog
          isOpen={breakdownOpen}
          onClose={() => {
            setBreakdownOpen(false);
            setSelectedBreakdown(null);
          }}
          day={selectedBreakdown?.day}
          week={selectedBreakdown?.week}
          newMoney={settings.newMoney}
          entries={selectedBreakdown ? getBreakdownEntries(selectedBreakdown.day, selectedBreakdown.week).entries : []}
          total={selectedBreakdown ? getBreakdownEntries(selectedBreakdown.day, selectedBreakdown.week).total : 0}
          originationFee={consolidationFees}
          feePercent={settings.feePercent}
          grossContract={dailySchedule[0]?.cumulativeGross || 0}
          factorRate={settings.rate}
          day1Rtr={dailySchedule[0]?.rtrBalance || 0}
          feeSchedule={settings.feeSchedule}
        />
      </div>
    </div>
  );
}
