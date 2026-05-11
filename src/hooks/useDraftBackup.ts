import { useEffect, useRef, useState } from 'react';
import { Merchant, Settings, Position } from '@/types/calculation';

const DRAFT_KEY = 'avion:draft:v1';
const DEBOUNCE_MS = 800;

export type DraftPayload = {
  merchant: Merchant;
  settings: Settings;
  positions: Position[];
  loadedCalculationId: string | null;
  loadedCalculationName: string;
  savedAt: number; // epoch ms
};

export function readDraft(): DraftPayload | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DraftPayload;
  } catch {
    return null;
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Debounced local-storage backup of calculator state. Always-on safety net.
 * Writes only when `hasData` is true to avoid storing empty defaults.
 */
export function useDraftBackup(args: {
  merchant: Merchant;
  settings: Settings;
  positions: Position[];
  loadedCalculationId: string | null;
  loadedCalculationName: string;
  hasUnsavedChanges: boolean;
  enabled?: boolean;
}) {
  const { merchant, settings, positions, loadedCalculationId, loadedCalculationName, hasUnsavedChanges, enabled = true } = args;
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (!hasUnsavedChanges) return;

    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const payload: DraftPayload = {
        merchant,
        settings,
        positions,
        loadedCalculationId,
        loadedCalculationName,
        savedAt: Date.now(),
      };
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
      } catch {
        /* quota or serialization error – ignore */
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [merchant, settings, positions, loadedCalculationId, loadedCalculationName, hasUnsavedChanges, enabled]);
}

/**
 * Warn the user before unloading the tab if there are unsaved changes.
 */
export function useBeforeUnloadGuard(hasUnsavedChanges: boolean) {
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);
}

/**
 * One-shot draft detector: returns a draft (if any) on mount, then null
 * after it has been consumed via `dismiss()`.
 */
export function useDraftOnMount(): { draft: DraftPayload | null; dismiss: () => void } {
  const [draft, setDraft] = useState<DraftPayload | null>(null);
  useEffect(() => {
    setDraft(readDraft());
  }, []);
  return { draft, dismiss: () => setDraft(null) };
}
