import { useLocation, useNavigate } from 'react-router-dom';
import { X, FilePlus } from 'lucide-react';
import { useOpenTabs, NEW_TAB_ID } from '@/hooks/useOpenTabs';
import { cn } from '@/lib/utils';

export function OpenTabsBar() {
  const { tabs, closeTab } = useOpenTabs();
  const navigate = useNavigate();
  const location = useLocation();

  if (tabs.length === 0) return null;

  const activePath = location.pathname;

  const pathFor = (id: string) => (id === NEW_TAB_ID ? '/deal/new' : `/deal/${id}`);

  const handleClose = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const remaining = closeTab(id);
    const wasActive = activePath === pathFor(id);
    if (!wasActive) return;
    if (remaining.length > 0) {
      navigate(pathFor(remaining[remaining.length - 1].id));
    } else {
      navigate('/');
    }
  };

  return (
    <div className="bg-muted/30 border-b border-border">
      <div className="max-w-6xl mx-auto px-4 py-1 flex items-center gap-1 overflow-x-auto">
        {tabs.map(tab => {
          const path = pathFor(tab.id);
          const isActive = activePath === path || activePath.startsWith(path + '/');
          const isNew = tab.id === NEW_TAB_ID;
          return (
            <button
              key={tab.id}
              onClick={() => navigate(path)}
              className={cn(
                'group flex items-center gap-2 pl-3 pr-1 py-1 rounded-t-md text-xs font-medium border border-b-0 transition-colors max-w-[220px] shrink-0',
                isActive
                  ? 'bg-background text-foreground border-border'
                  : 'bg-transparent text-muted-foreground border-transparent hover:bg-background/50',
              )}
              title={tab.merchant ? `${tab.name} — ${tab.merchant}` : tab.name}
            >
              {isNew && <FilePlus className="w-3 h-3 shrink-0" />}
              <span className="truncate">{tab.name || (isNew ? 'New calculation' : 'Untitled')}</span>
              <span
                role="button"
                onClick={(e) => handleClose(e, tab.id)}
                className="ml-1 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                aria-label="Close tab"
              >
                <X className="w-3 h-3" />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
