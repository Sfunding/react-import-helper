import { useEffect, useRef, useState } from 'react';
import { Merchant, Settings, Position } from '@/types/calculation';

const TOGGLE_KEY = 'avion:autosave-enabled';
const DEBOUNCE_MS = 2000;

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function readAutoSaveEnabled(defaultValue = true): boolean {
  try {
    const v = localStorage.getItem(TOGGLE_KEY);
    if (v === 'true') return true;
    if (v === 'false') return false;
  } catch {
    /* ignore */
  }
  return defaultValue;
}

export function writeAutoSaveEnabled(v: boolean) {
  try {
    localStorage.setItem(TOGGLE_KEY, v ? 'true' : 'false');
  } catch {
    /* ignore */
  }
}

/**
 * Debounced silent cloud auto-save for a *loaded* calculation. No-op when
 * loadedCalculationId is null (we never auto-create rows).
 */
export function useAutoSave(args: {
  enabled: boolean;
  loadedCalculationId: string | null;
  loadedCalculationName: string;
  merchant: Merchant;
  settings: Settings;
  positions: Position[];
  totalBalance: number;
  totalDailyPayment: number;
  asOfDate?: string | null;
  hasUnsavedChanges: boolean;
  onSaved: () => void;
  updateCalculation: (params: {
    id: string;
    name: string;
    merchant: { name: string; businessType: string; monthlyRevenue: number };
    settings: Settings;
    positions: Position[];
    totalBalance: number;
    totalDailyPayment: number;
    asOfDate?: string | null;
  }) => Promise<unknown>;
}): {
  status: AutoSaveStatus;
  lastSavedAt: number | null;
  retry: () => void;
} {
  const {
    enabled,
    loadedCalculationId,
    loadedCalculationName,
    merchant,
    settings,
    positions,
    totalBalance,
    totalDailyPayment,
    asOfDate,
    hasUnsavedChanges,
    onSaved,
    updateCalculation,
  } = args;

  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const timer = useRef<number | null>(null);
  const inFlight = useRef(false);

  const trigger = () => {
    if (!enabled) return;
    if (!loadedCalculationId) return;
    if (!hasUnsavedChanges) return;

    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      setStatus('saving');
      try {
        await updateCalculation({
          id: loadedCalculationId,
          name: loadedCalculationName,
          merchant,
          settings,
          positions,
          totalBalance,
          totalDailyPayment,
          asOfDate,
        });
        setStatus('saved');
        setLastSavedAt(Date.now());
        onSaved();
      } catch (e) {
        console.error('Auto-save failed', e);
        setStatus('error');
      } finally {
        inFlight.current = false;
      }
    }, DEBOUNCE_MS);
  };

  useEffect(() => {
    trigger();
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, loadedCalculationId, merchant, settings, positions, asOfDate, hasUnsavedChanges]);

  return { status, lastSavedAt, retry: trigger };
}
