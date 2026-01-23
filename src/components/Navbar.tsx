import { Link, useLocation } from 'react-router-dom';
import { Calculator, FolderOpen, LogOut } from 'lucide-react';
import { useAppAuth } from '@/hooks/useAppAuth';
import { Button } from '@/components/ui/button';

export function Navbar() {
  const { logout } = useAppAuth();
  const location = useLocation();

  const handleLogout = () => {
    logout();
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

          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="flex items-center gap-1"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Log Out</span>
          </Button>
        </div>
      </div>
    </nav>
  );
}
