import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Calculator, FolderOpen, LogOut, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import avionLogo from '@/assets/avion-logo.png';

export function Navbar() {
  const { logout, isAdmin, username } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  const handleNavClick = (e: React.MouseEvent, path: string) => {
    if (location.pathname === '/' && path !== '/') {
      const customNav = (window as any).__calculatorNavigation;
      if (customNav) {
        e.preventDefault();
        customNav(path);
      }
    }
  };

  return (
    <nav className="bg-card border-b border-border shadow-sm">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center">
              <img src={avionLogo} alt="Avion Funding" className="h-8 w-auto" />
            </Link>
            <div className="h-6 w-px bg-border" />
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
                onClick={(e) => handleNavClick(e, '/saved')}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive('/saved') 
                    ? 'bg-primary text-primary-foreground' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <FolderOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Saved</span>
              </Link>
              {isAdmin && (
                <Link
                  to="/settings"
                  onClick={(e) => handleNavClick(e, '/settings')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/settings') 
                      ? 'bg-primary text-primary-foreground' 
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">Settings</span>
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {username && (
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {username}
              </span>
            )}
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
      </div>
    </nav>
  );
}
