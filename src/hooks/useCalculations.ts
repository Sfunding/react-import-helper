import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SavedCalculation, Settings, Position } from '@/types/calculation';
import { useToast } from '@/hooks/use-toast';
import { logAuditEvent } from '@/lib/auditLog';

export function useCalculations(filterUserId?: string | null) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: calculations = [], isLoading, error } = useQuery({
    queryKey: ['saved-calculations', filterUserId ?? 'all'],
    queryFn: async () => {
      let query = supabase
        .from('saved_calculations')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (filterUserId) {
        query = query.eq('user_id', filterUserId);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      // Parse JSONB fields
      return (data || []).map(calc => ({
        ...calc,
        settings: calc.settings as Settings,
        positions: calc.positions as Position[]
      })) as SavedCalculation[];
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (params: {
      name: string;
      merchant: { name: string; businessType: string; monthlyRevenue: number };
      settings: Settings;
      positions: Position[];
      totalBalance: number;
      totalDailyPayment: number;
      asOfDate?: string | null;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('saved_calculations')
        .insert({
          user_id: session.user.id,
          name: params.name,
          merchant_name: params.merchant.name,
          merchant_business_type: params.merchant.businessType,
          merchant_monthly_revenue: params.merchant.monthlyRevenue,
          settings: params.settings,
          positions: params.positions,
          total_balance: params.totalBalance,
          total_daily_payment: params.totalDailyPayment,
          as_of_date: params.asOfDate ?? new Date().toISOString().slice(0, 10),
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['saved-calculations'] });
      logAuditEvent({ action: 'create_deal', resourceType: 'saved_calculation', resourceId: data.id, metadata: { name: data.name, merchant_name: data.merchant_name } });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error saving calculation',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('saved_calculations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['saved-calculations'] });
      logAuditEvent({ action: 'delete_deal', resourceType: 'saved_calculation', resourceId: id });
      toast({ title: 'Calculation deleted', description: 'Your calculation has been deleted.' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error deleting calculation',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (params: {
      id: string;
      name: string;
      merchant: { name: string; businessType: string; monthlyRevenue: number };
      settings: Settings;
      positions: Position[];
      totalBalance: number;
      totalDailyPayment: number;
      asOfDate?: string | null;
    }) => {
      const updatePayload: Record<string, unknown> = {
        name: params.name,
        merchant_name: params.merchant.name,
        merchant_business_type: params.merchant.businessType,
        merchant_monthly_revenue: params.merchant.monthlyRevenue,
        settings: params.settings,
        positions: params.positions,
        total_balance: params.totalBalance,
        total_daily_payment: params.totalDailyPayment,
      };
      if (params.asOfDate !== undefined) updatePayload.as_of_date = params.asOfDate;
      const { data, error } = await supabase
        .from('saved_calculations')
        .update(updatePayload as any)
        .eq('id', params.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['saved-calculations'] });
      logAuditEvent({ action: 'update_deal', resourceType: 'saved_calculation', resourceId: data.id, metadata: { name: data.name } });
    },
    onError: (error: Error) => {
      toast({ title: 'Error updating calculation', description: error.message, variant: 'destructive' });
    }
  });

  const duplicateMutation = useMutation({
    mutationFn: async (params: {
      originalId: string;
      newName: string;
      calculation: SavedCalculation;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('saved_calculations')
        .insert({
          user_id: session.user.id,
          name: params.newName,
          merchant_name: params.calculation.merchant_name,
          merchant_business_type: params.calculation.merchant_business_type,
          merchant_monthly_revenue: params.calculation.merchant_monthly_revenue,
          settings: params.calculation.settings,
          positions: params.calculation.positions,
          total_balance: params.calculation.total_balance,
          total_daily_payment: params.calculation.total_daily_payment,
          as_of_date: new Date().toISOString().slice(0, 10),
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['saved-calculations'] });
      logAuditEvent({ action: 'duplicate_deal', resourceType: 'saved_calculation', resourceId: data.id, metadata: { name: data.name } });
      toast({ title: 'Calculation duplicated', description: 'A copy has been created.' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error duplicating calculation',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const commitScenarioMutation = useMutation({
    mutationFn: async (params: {
      parentId: string;
      name: string;
      merchant: { name: string; businessType: string; monthlyRevenue: number };
      settings: Settings;
      positions: Position[];
      asOfDate: string;
      totalBalance: number;
      totalDailyPayment: number;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('saved_calculations')
        .insert({
          user_id: session.user.id,
          name: params.name,
          merchant_name: params.merchant.name,
          merchant_business_type: params.merchant.businessType,
          merchant_monthly_revenue: params.merchant.monthlyRevenue,
          settings: params.settings,
          positions: params.positions,
          total_balance: params.totalBalance,
          total_daily_payment: params.totalDailyPayment,
          as_of_date: params.asOfDate,
          parent_calculation_id: params.parentId,
        } as any)
        .select()
        .single();

      if (error) throw error;

      // Clone all of the parent's scenarios into the new child deal so the
      // user lands on the child Lab with the same scenarios ready to iterate.
      try {
        const { data: parentScenarios } = await supabase
          .from('deal_scenarios')
          .select('name, scenario, sort_order')
          .eq('calculation_id', params.parentId)
          .order('sort_order', { ascending: true });

        if (parentScenarios && parentScenarios.length > 0 && data?.id) {
          const rows = parentScenarios.map((s: any, i: number) => ({
            user_id: session.user.id,
            calculation_id: data.id,
            name: s.name || `Scenario ${i + 1}`,
            scenario: s.scenario ?? {},
            is_pinned: false,
            sort_order: typeof s.sort_order === 'number' ? s.sort_order : i,
          }));
          await supabase.from('deal_scenarios').insert(rows as any);
        }
      } catch (cloneErr) {
        // Non-fatal: child deal still exists, scenarios just weren't copied.
        console.warn('[commitScenario] failed to clone parent scenarios', cloneErr);
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['saved-calculations'] });
      logAuditEvent({ action: 'commit_scenario', resourceType: 'saved_calculation', resourceId: data.id, metadata: { name: data.name, parent_calculation_id: (data as any).parent_calculation_id } });
    },
    onError: (error: Error) => {
      toast({ title: 'Error committing scenario', description: error.message, variant: 'destructive' });
    }
  });

  const markAsFundedMutation = useMutation({
    mutationFn: async (params: { id: string; funded_at: string | null }) => {
      const { data, error } = await supabase
        .from('saved_calculations')
        .update({ funded_at: params.funded_at } as any)
        .eq('id', params.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['saved-calculations'] });
      logAuditEvent({ action: 'mark_funded', resourceType: 'saved_calculation', resourceId: data.id, metadata: { funded_at: (data as any).funded_at } });
    },
    onError: (error: Error) => {
      toast({ title: 'Error updating funded status', description: error.message, variant: 'destructive' });
    }
  });

  return {
    calculations,
    isLoading,
    error,
    saveCalculation: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    updateCalculation: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    duplicateCalculation: duplicateMutation.mutateAsync,
    isDuplicating: duplicateMutation.isPending,
    deleteCalculation: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    markAsFunded: markAsFundedMutation.mutateAsync,
    isMarkingFunded: markAsFundedMutation.isPending,
    commitScenario: commitScenarioMutation.mutateAsync,
    isCommittingScenario: commitScenarioMutation.isPending,
  };
}
