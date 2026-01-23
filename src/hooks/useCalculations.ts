import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SavedCalculation, Settings, Position } from '@/types/calculation';
import { useToast } from '@/hooks/use-toast';

// Since we use shared password auth, all calculations are shared
// We use a fixed "shared" user_id for RLS purposes
const SHARED_USER_ID = '00000000-0000-0000-0000-000000000000';

export function useCalculations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: calculations = [], isLoading, error } = useQuery({
    queryKey: ['saved-calculations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_calculations')
        .select('*')
        .order('updated_at', { ascending: false });
      
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
    }) => {
      const { data, error } = await supabase
        .from('saved_calculations')
        .insert({
          user_id: SHARED_USER_ID,
          name: params.name,
          merchant_name: params.merchant.name,
          merchant_business_type: params.merchant.businessType,
          merchant_monthly_revenue: params.merchant.monthlyRevenue,
          settings: params.settings,
          positions: params.positions,
          total_balance: params.totalBalance,
          total_daily_payment: params.totalDailyPayment
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-calculations'] });
      // Toast is handled by the caller to allow custom content
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-calculations'] });
      toast({
        title: 'Calculation deleted',
        description: 'Your calculation has been deleted.'
      });
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
    }) => {
      const { data, error } = await supabase
        .from('saved_calculations')
        .update({
          name: params.name,
          merchant_name: params.merchant.name,
          merchant_business_type: params.merchant.businessType,
          merchant_monthly_revenue: params.merchant.monthlyRevenue,
          settings: params.settings,
          positions: params.positions,
          total_balance: params.totalBalance,
          total_daily_payment: params.totalDailyPayment
        })
        .eq('id', params.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-calculations'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error updating calculation',
        description: error.message,
        variant: 'destructive'
      });
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
    deleteCalculation: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending
  };
}
