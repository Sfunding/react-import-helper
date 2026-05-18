import { useCallback, useEffect, useState } from 'react';

export type OpenTab = {
  id: string; // saved deal id, or '__new__'
  name: string;
  merchant?: string;
};

const KEY = 'avion:openTabs:v1';
export const NEW_TAB_ID = '__new__';

function read(): OpenTab[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(t => t && typeof t.id === 'string' && typeof t.name === 'string');
  } catch {
    return [];
  }
}

function write(tabs: OpenTab[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(tabs));
  } catch {
    /* ignore */
  }
}

// Simple cross-component sync via a window event
const EVT = 'avion:openTabs:changed';

export function useOpenTabs() {
  const [tabs, setTabs] = useState<OpenTab[]>(() => read());

  useEffect(() => {
    const handler = () => setTabs(read());
    window.addEventListener(EVT, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(EVT, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const persist = (next: OpenTab[]) => {
    write(next);
    setTabs(next);
    window.dispatchEvent(new Event(EVT));
  };

  const openTab = useCallback((tab: OpenTab) => {
    const current = read();
    const existing = current.findIndex(t => t.id === tab.id);
    let next: OpenTab[];
    if (existing >= 0) {
      next = current.slice();
      next[existing] = { ...current[existing], ...tab };
    } else {
      next = [...current, tab];
    }
    persist(next);
  }, []);

  const closeTab = useCallback((id: string): OpenTab[] => {
    const current = read();
    const next = current.filter(t => t.id !== id);
    persist(next);
    return next;
  }, []);

  const renameTab = useCallback((id: string, name: string, merchant?: string) => {
    const current = read();
    const idx = current.findIndex(t => t.id === id);
    if (idx < 0) return;
    const next = current.slice();
    next[idx] = { ...next[idx], name, merchant };
    persist(next);
  }, []);

  return { tabs, openTab, closeTab, renameTab };
}
