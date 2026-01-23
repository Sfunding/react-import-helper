import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

const AUTH_KEY = 'app_authenticated';

interface AuthContextType {
  isAuthenticated: boolean | null;
  isLoading: boolean;
  login: (password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check localStorage for existing authentication
    const stored = localStorage.getItem(AUTH_KEY);
    setIsAuthenticated(stored === 'true');
    setIsLoading(false);
  }, []);

  const login = async (password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-password', {
        body: { password }
      });

      if (error) {
        console.error('Login error:', error);
        return { success: false, error: 'Failed to verify password' };
      }

      if (data.success) {
        localStorage.setItem(AUTH_KEY, 'true');
        setIsAuthenticated(true);
        return { success: true };
      }

      return { success: false, error: 'Incorrect password' };
    } catch (err) {
      console.error('Login error:', err);
      return { success: false, error: 'Failed to connect to server' };
    }
  };

  const logout = () => {
    localStorage.removeItem(AUTH_KEY);
    setIsAuthenticated(false);
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke('change-password', {
        body: { currentPassword, newPassword }
      });

      if (error) {
        console.error('Change password error:', error);
        return { success: false, error: 'Failed to change password' };
      }

      if (data.success) {
        // Clear all authenticated sessions by removing the auth key
        localStorage.removeItem(AUTH_KEY);
        setIsAuthenticated(false);
        return { success: true };
      }

      return { success: false, error: data.error || 'Failed to change password' };
    } catch (err) {
      console.error('Change password error:', err);
      return { success: false, error: 'Failed to connect to server' };
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout, changePassword }}>
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
