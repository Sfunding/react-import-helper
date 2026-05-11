import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { useCalculations } from '@/hooks/useCalculations';
import { useToast } from '@/hooks/use-toast';
import { Scenario, ScenarioRunResult, ScenarioStep } from '@/lib/scenarioTypes';
import { SavedCalculation, Settings, DEFAULT_SETTINGS, DEFAULT_EPO_SETTINGS } from '@/types/calculation';
import { checkpointToPositions, stackTotals } from '@/lib/leverageMath';

type CarryoverMode = 'reverse-only' | 'all' | 'custom';

type CustomKey =
  | 'rate'
  | 'feePercent'
  | 'dailyPaymentDecrease'
  | 'brokerCommission'
  | 'feeSchedule'
  | 'currentExposure'
  | 'earlyPayOptions'
  | 'whiteLabelCompany';

const CUSTOM_LABELS: Record<CustomKey, string> = {
  rate: 'Factor rate',
  feePercent: 'Origination fee %',
  dailyPaymentDecrease: 'Daily payment decrease',
  brokerCommission: 'Broker commission',
  feeSchedule: 'Fee schedule (mode)',
  currentExposure: 'Current exposure',
  earlyPayOptions: 'Early pay options (EPO)',
  whiteLabelCompany: 'White-label company name',
};

interface CommitScenarioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenario: Scenario;
  scenarioRun: ScenarioRunResult;
  stepIndex: number | null;
  originalCalc: SavedCalculation | null | undefined;
  mode?: 'step' | 'final';
}

export function CommitScenarioDialog({
  open, onOpenChange, scenario, scenarioRun, stepIndex, originalCalc, mode = 'step',
}: CommitScenarioDialogProps) {
  const isFinal = mode === 'final';
  const navigate = useNavigate();
  const { toast } = useToast();
  const { commitScenario, isCommittingScenario } = useCalculations();

  const step: ScenarioStep | undefined = stepIndex != null ? scenario.steps[stepIndex] : undefined;
  const isReverse = step?.kind === 'reverse';

  const [snapshotWhen, setSnapshotWhen] = useState<'before' | 'after'>('after');
  const [carryover, setCarryover] = useState<CarryoverMode>('all');
  const [customKeys, setCustomKeys] = useState<Record<CustomKey, boolean>>({
    rate: false, feePercent: false, dailyPaymentDecrease: false,
    brokerCommission: false, feeSchedule: false, currentExposure: false,
    earlyPayOptions: false, whiteLabelCompany: false,
  });
  const [name, setName] = useState('');

  // Reset defaults when dialog opens / step changes
  useEffect(() => {
    if (!open || !step || !originalCalc) return;
    const defaultWhen: 'before' | 'after' = isReverse ? 'before' : 'after';
    setSnapshotWhen(defaultWhen);
    setCarryover('all');
    // For Custom, pre-check reverse params if reverse
    setCustomKeys({
      rate: !!isReverse,
      feePercent: !!isReverse,
      dailyPaymentDecrease: !!isReverse,
      brokerCommission: false,
      feeSchedule: false,
      currentExposure: false,
      earlyPayOptions: false,
      whiteLabelCompany: false,
    });

    const cpIdx = defaultWhen === 'before' ? (stepIndex ?? 0) : (stepIndex ?? 0) + 1;
    const cp = scenarioRun.checkpoints[cpIdx] ?? scenarioRun.checkpoints[scenarioRun.checkpoints.length - 1];
    const snapDate = cp ? format(new Date(), 'MMM d') : '';
    void snapDate;
    const stepLabel = scenarioRun.checkpoints[(stepIndex ?? 0) + 1]?.stepLabel ?? step.kind;
    setName(`${originalCalc.name} @ ${stepLabel}`);
  }, [open, step, originalCalc, isReverse, stepIndex, scenarioRun.checkpoints]);

  const checkpoint = useMemo(() => {
    if (stepIndex == null) return null;
    const cpIdx = snapshotWhen === 'before' ? stepIndex : stepIndex + 1;
    return scenarioRun.checkpoints[cpIdx] ?? null;
  }, [stepIndex, snapshotWhen, scenarioRun.checkpoints]);

  const stepLabel = useMemo(() => {
    if (stepIndex == null) return '';
    return scenarioRun.checkpoints[stepIndex + 1]?.stepLabel ?? step?.kind ?? '';
  }, [stepIndex, scenarioRun.checkpoints, step]);

  if (!step || !originalCalc || stepIndex == null) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Commit to Calculator</DialogTitle>
            <DialogDescription>Pick a step in the scenario to commit.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const buildSettings = (): Settings => {
    const orig = originalCalc.settings ?? DEFAULT_SETTINGS;
    const reverseOverrides: Partial<Settings> = isReverse && step.kind === 'reverse'
      ? { rate: step.factorRate, feePercent: step.feePercent, dailyPaymentDecrease: step.dailyDecrease }
      : {};

    if (carryover === 'reverse-only') {
      return { ...DEFAULT_SETTINGS, ...reverseOverrides };
    }
    if (carryover === 'all') {
      return { ...orig, ...reverseOverrides };
    }
    // custom
    const out: Settings = { ...DEFAULT_SETTINGS };
    if (customKeys.rate) out.rate = orig.rate;
    if (customKeys.feePercent) out.feePercent = orig.feePercent;
    if (customKeys.dailyPaymentDecrease) out.dailyPaymentDecrease = orig.dailyPaymentDecrease;
    if (customKeys.brokerCommission) out.brokerCommission = orig.brokerCommission;
    if (customKeys.feeSchedule) out.feeSchedule = orig.feeSchedule;
    if (customKeys.currentExposure) out.currentExposure = orig.currentExposure;
    if (customKeys.earlyPayOptions) out.earlyPayOptions = orig.earlyPayOptions ?? DEFAULT_EPO_SETTINGS;
    if (customKeys.whiteLabelCompany) out.whiteLabelCompany = orig.whiteLabelCompany;
    return { ...out, ...reverseOverrides };
  };

  const handleCommit = async () => {
    if (!checkpoint) return;
    const { positions, asOfDate } = checkpointToPositions(
      checkpoint,
      scenario.steps,
      originalCalc.positions ?? [],
      new Date(),
      scenarioRun.checkpoints,
    );
    if (positions.length === 0) {
      toast({
        title: 'Nothing to commit',
        description: 'No active positions remain at this point in the scenario.',
        variant: 'destructive',
      });
      return;
    }
    const settings = buildSettings();
    const totals = stackTotals(positions);
    try {
      const newRow = await commitScenario({
        parentId: originalCalc.id,
        name: name.trim() || `${originalCalc.name} @ ${stepLabel}`,
        merchant: {
          name: originalCalc.merchant_name || '',
          businessType: originalCalc.merchant_business_type || '',
          monthlyRevenue: originalCalc.merchant_monthly_revenue || 0,
        },
        settings,
        positions,
        asOfDate,
        totalBalance: totals.totalBalance,
        totalDailyPayment: totals.totalDaily,
      });

      sessionStorage.setItem('loadCalculation', JSON.stringify({
        id: (newRow as any).id,
        name: (newRow as any).name,
        merchant: {
          name: originalCalc.merchant_name || '',
          businessType: originalCalc.merchant_business_type || '',
          monthlyRevenue: originalCalc.merchant_monthly_revenue || 0,
        },
        settings,
        positions,
        funded_at: null,
        as_of_date: asOfDate,
        parent_calculation_id: originalCalc.id,
        parent_calculation_name: originalCalc.name,
      }));
      toast({ title: 'Snapshot committed', description: 'A new deal was created in the calculator.' });
      onOpenChange(false);
      navigate('/');
    } catch {
      // toast handled inside the mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Commit snapshot to Calculator</DialogTitle>
          <DialogDescription>
            Snapshot at: <span className="font-semibold text-foreground">Step {stepIndex + 1} — {stepLabel}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <Label className="text-xs uppercase text-muted-foreground">Snapshot state</Label>
            <RadioGroup value={snapshotWhen} onValueChange={(v) => setSnapshotWhen(v as 'before' | 'after')} className="mt-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem id="snap-before" value="before" />
                <Label htmlFor="snap-before" className="font-normal cursor-pointer">Before this step fires</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="snap-after" value="after" />
                <Label htmlFor="snap-after" className="font-normal cursor-pointer">After this step fires</Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label className="text-xs uppercase text-muted-foreground">Settings to carry over</Label>
            <RadioGroup value={carryover} onValueChange={(v) => setCarryover(v as CarryoverMode)} className="mt-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem id="co-rev" value="reverse-only" />
                <Label htmlFor="co-rev" className="font-normal cursor-pointer">Reverse params only</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="co-all" value="all" />
                <Label htmlFor="co-all" className="font-normal cursor-pointer">All settings from original deal</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="co-custom" value="custom" />
                <Label htmlFor="co-custom" className="font-normal cursor-pointer">Custom</Label>
              </div>
            </RadioGroup>

            {carryover === 'custom' && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-md border border-border p-3 bg-muted/30">
                {(Object.keys(CUSTOM_LABELS) as CustomKey[]).map((key) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={customKeys[key]}
                      onCheckedChange={(v) => setCustomKeys(prev => ({ ...prev, [key]: !!v }))}
                    />
                    <span>{CUSTOM_LABELS[key]}</span>
                  </label>
                ))}
                {isReverse && (
                  <p className="col-span-full text-[11px] text-muted-foreground italic">
                    Factor rate, fee %, and daily decrease are overridden with this reverse step's values.
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="commit-name" className="text-xs uppercase text-muted-foreground">Name</Label>
            <Input
              id="commit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2"
              placeholder="New deal name"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCommittingScenario}>
            Cancel
          </Button>
          <Button onClick={handleCommit} disabled={isCommittingScenario || !checkpoint}>
            {isCommittingScenario ? 'Committing…' : 'Commit to Calculator'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
