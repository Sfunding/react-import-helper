import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Scenario } from '@/lib/scenarioTypes';
import { useToast } from '@/hooks/use-toast';

export interface DealScenarioRow {
  id: string;
  calculation_id: string;
  user_id: string;
  name: string;
  scenario: Scenario;
  is_pinned: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function useDealScenarios(calculationId: string | undefined) {
  const [rows, setRows] = useState<DealScenarioRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const reload = useCallback(async () => {
    if (!calculationId) {
      setRows([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const { data, error } = await supabase
      .from('deal_scenarios')
      .select('*')
      .eq('calculation_id', calculationId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) {
      toast({ title: 'Failed to load scenarios', description: error.message, variant: 'destructive' });
      setRows([]);
    } else {
      setRows((data || []) as unknown as DealScenarioRow[]);
    }
    setIsLoading(false);
  }, [calculationId, toast]);

  useEffect(() => {
    reload();
  }, [reload]);

  const createScenario = useCallback(async (name: string, scenario: Scenario): Promise<DealScenarioRow | null> => {
    if (!calculationId) return null;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const nextOrder = rows.length;
    const { data, error } = await supabase
      .from('deal_scenarios')
      .insert([{
        calculation_id: calculationId,
        user_id: user.id,
        name,
        scenario: scenario as unknown as Record<string, unknown>,
        sort_order: nextOrder,
      }])
      .select('*')
      .single();
    if (error) {
      toast({ title: 'Failed to create scenario', description: error.message, variant: 'destructive' });
      return null;
    }
    await reload();
    return data as unknown as DealScenarioRow;
  }, [calculationId, rows.length, reload, toast]);

  const updateScenario = useCallback(async (
    id: string,
    patch: Partial<Pick<DealScenarioRow, 'name' | 'scenario' | 'is_pinned' | 'sort_order'>>
  ) => {
    const payload: Record<string, unknown> = { ...patch };
    if (patch.scenario) payload.scenario = patch.scenario as unknown as Record<string, unknown>;
    const { error } = await supabase
      .from('deal_scenarios')
      .update(payload)
      .eq('id', id);
    if (error) {
      toast({ title: 'Failed to save scenario', description: error.message, variant: 'destructive' });
      return false;
    }
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } as DealScenarioRow : r));
    return true;
  }, [toast]);

  const deleteScenario = useCallback(async (id: string) => {
    const { error } = await supabase.from('deal_scenarios').delete().eq('id', id);
    if (error) {
      toast({ title: 'Failed to delete scenario', description: error.message, variant: 'destructive' });
      return false;
    }
    setRows(prev => prev.filter(r => r.id !== id));
    return true;
  }, [toast]);

  return { rows, isLoading, reload, createScenario, updateScenario, deleteScenario };
}
