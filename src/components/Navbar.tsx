import { Link, useLocation } from 'react-router-dom';
import { Calculator, FolderOpen, LogIn, LogOut, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

export function Navbar() {
  const { user, signOut, isAuthenticated } = useAuth();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-card border-b border-border shadow-sm">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-1">
            <Link
              to="/"
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/') 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Calculator className="w-4 h-4" />
              <span className="hidden sm:inline">Calculator</span>
            </Link>
            <Link
              to="/saved"
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/saved') 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <FolderOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Saved</span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <span className="text-sm text-muted-foreground hidden sm:flex items-center gap-1">
                  <User className="w-4 h-4" />
                  {user?.email?.split('@')[0]}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  className="flex items-center gap-1"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Sign Out</span>
                </Button>
              </>
            ) : (
              <Link to="/auth">
                <Button variant="outline" size="sm" className="flex items-center gap-1">
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
