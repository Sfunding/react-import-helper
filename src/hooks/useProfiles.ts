import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
}

export function useProfiles() {
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name')
        .order('username');
      
      if (error) throw error;
      return (data || []) as Profile[];
    }
  });

  const getUserName = (userId: string) => {
    const profile = profiles.find(p => p.id === userId);
    return profile?.full_name || profile?.username || 'Unknown';
  };

  return { profiles, isLoading, getUserName };
}
