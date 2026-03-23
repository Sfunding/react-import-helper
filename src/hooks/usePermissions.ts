import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UserPermissions {
  can_export: boolean;
  can_delete_deals: boolean;
  can_view_others: boolean;
}

const defaultPermissions: UserPermissions = {
  can_export: true,
  can_delete_deals: true,
  can_view_others: false,
};

export function usePermissions() {
  const { user, isAdmin } = useAuth();

  const { data: permissions = defaultPermissions } = useQuery({
    queryKey: ['user-permissions', user?.id],
    queryFn: async () => {
      if (!user) return defaultPermissions;

      const { data, error } = await supabase
        .from('user_permissions')
        .select('can_export, can_delete_deals, can_view_others')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error || !data) return defaultPermissions;
      return data as UserPermissions;
    },
    enabled: !!user,
  });

  // Admins always have all permissions
  if (isAdmin) {
    return {
      permissions: { can_export: true, can_delete_deals: true, can_view_others: true },
      hasPermission: (_key: keyof UserPermissions) => true,
    };
  }

  return {
    permissions,
    hasPermission: (key: keyof UserPermissions) => permissions[key],
  };
}
