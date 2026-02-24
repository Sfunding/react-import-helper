import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  username: string | null;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  needsSetup: boolean;
  setupAdmin: (username: string, password: string, fullName: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  const checkAdminRole = async (userId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();
    return !!data;
  };

  const checkNeedsSetup = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);
    return !data || data.length === 0;
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const admin = await checkAdminRole(currentUser.id);
        setIsAdmin(admin);
        setNeedsSetup(false);
      } else {
        setIsAdmin(false);
        const setup = await checkNeedsSetup();
        setNeedsSetup(setup);
      }

      setIsLoading(false);
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const admin = await checkAdminRole(currentUser.id);
        setIsAdmin(admin);
        setNeedsSetup(false);
      } else {
        const setup = await checkNeedsSetup();
        setNeedsSetup(setup);
      }

      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const email = `${username.toLowerCase()}@app.internal`;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { success: false, error: 'Invalid username or password' };
    }
    return { success: true };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
  };

  const setupAdmin = async (username: string, password: string, fullName: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke('setup-admin', {
        body: { username, password, fullName }
      });

      if (error) return { success: false, error: 'Failed to create admin account' };
      if (!data.success) return { success: false, error: data.error || 'Setup failed' };

      // Now login as the new admin
      const loginResult = await login(username, password);
      if (!loginResult.success) return { success: false, error: 'Account created but login failed. Try signing in.' };

      setNeedsSetup(false);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Setup failed' };
    }
  };

  const username = user?.user_metadata?.username || null;

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      isAdmin,
      username,
      login,
      logout,
      needsSetup,
      setupAdmin
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
