import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';

export type MerchantPDFOptions = {
  // Page 1 — Deal Terms strip cells
  showAmountFunded: boolean;
  showTotalPayback: boolean;
  showFactorRate: boolean;
  showOriginationFee: boolean;
  showNumPayments: boolean;
  showCashToMerchant: boolean;
  // Page 2
  showPayoffTimelineVisual: boolean;
  showEarlyPayoffOptions: boolean;
  // Page 3
  showWeeklySchedule: boolean;
  showSavingsColumns: boolean;
  showKeyMilestones: boolean;
  // Page 4
  showBottomLinePage: boolean;
  // Payment view (controls daily / weekly visibility on Page 1 + Page 4)
  paymentView: 'daily' | 'weekly' | 'both';
};

export const DEFAULT_MERCHANT_PDF_OPTIONS: MerchantPDFOptions = {
  showAmountFunded: true,
  showTotalPayback: true,
  showFactorRate: false,        // hidden from merchants by default
  showOriginationFee: false,    // hidden from merchants by default
  showNumPayments: true,
  showCashToMerchant: true,
  showPayoffTimelineVisual: true,
  showEarlyPayoffOptions: true,
  showWeeklySchedule: true,
  showSavingsColumns: false,    // hidden by default — avoids showing negative savings late in schedule
  showKeyMilestones: true,
  showBottomLinePage: true,
  paymentView: 'both',
};

const STORAGE_KEY = 'merchantProposalExportOptions:v1';

function loadStoredOptions(): MerchantPDFOptions {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MERCHANT_PDF_OPTIONS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_MERCHANT_PDF_OPTIONS, ...parsed };
  } catch {
    return DEFAULT_MERCHANT_PDF_OPTIONS;
  }
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (options: MerchantPDFOptions) => void;
};

type BoolOptionKey = {
  [K in keyof MerchantPDFOptions]: MerchantPDFOptions[K] extends boolean ? K : never;
}[keyof MerchantPDFOptions];

type Row = {
  key: BoolOptionKey;
  label: string;
  hint?: string;
};

const SECTIONS: Array<{ title: string; rows: Row[] }> = [
  {
    title: 'Page 1 — Deal Terms',
    rows: [
      { key: 'showAmountFunded', label: 'Amount Funded' },
      { key: 'showTotalPayback', label: 'Total Payback' },
      { key: 'showFactorRate', label: 'Factor Rate', hint: 'Usually hidden from merchants' },
      { key: 'showOriginationFee', label: 'Origination Fee', hint: 'Usually hidden from merchants' },
      { key: 'showNumPayments', label: 'Number of Payments' },
      { key: 'showCashToMerchant', label: 'Cash to Merchant banner', hint: 'Auto-hidden if $0' },
    ],
  },
  {
    title: 'Page 2 — Positions',
    rows: [
      { key: 'showPayoffTimelineVisual', label: 'Visual payoff timeline bar' },
      { key: 'showEarlyPayoffOptions', label: 'Early Payoff Options table', hint: 'Only if EPO is enabled' },
    ],
  },
  {
    title: 'Page 3 — Cash Flow',
    rows: [
      { key: 'showWeeklySchedule', label: 'Full weekly schedule (through final payoff)' },
      { key: 'showSavingsColumns', label: 'Weekly Savings & Cumulative Savings columns', hint: 'When off, only Week / Old / New columns shown — Peak Savings bubble still appears' },
      { key: 'showKeyMilestones', label: 'Key Milestones (1mo / 3mo / Peak)' },
    ],
  },
  {
    title: 'Page 4',
    rows: [
      { key: 'showBottomLinePage', label: 'Include "The Bottom Line" page' },
    ],
  },
];

export function ExportOptionsDialog({ open, onOpenChange, onGenerate }: Props) {
  const [options, setOptions] = useState<MerchantPDFOptions>(DEFAULT_MERCHANT_PDF_OPTIONS);

  useEffect(() => {
    if (open) setOptions(loadStoredOptions());
  }, [open]);

  const toggle = (key: keyof MerchantPDFOptions) =>
    setOptions(prev => ({ ...prev, [key]: !prev[key] }));

  const handleGenerate = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
    } catch {
      /* ignore */
    }
    onGenerate(options);
    onOpenChange(false);
  };

  const resetDefaults = () => setOptions(DEFAULT_MERCHANT_PDF_OPTIONS);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Customize Merchant Proposal</DialogTitle>
          <DialogDescription>
            Choose which sections to include in the PDF. Your selections are remembered for next time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {SECTIONS.map(section => (
            <div key={section.title} className="space-y-2">
              <h4 className="text-sm font-semibold text-primary uppercase tracking-wide">
                {section.title}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-1">
                {section.rows.map(row => (
                  <label
                    key={row.key}
                    htmlFor={`opt-${row.key}`}
                    className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      id={`opt-${row.key}`}
                      checked={options[row.key]}
                      onCheckedChange={() => toggle(row.key)}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{row.label}</div>
                      {row.hint && (
                        <div className="text-xs text-muted-foreground">{row.hint}</div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={resetDefaults}>
            Reset to defaults
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleGenerate}>
            <FileText className="w-4 h-4 mr-2" />
            Generate PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
