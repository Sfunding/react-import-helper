import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronDown, Plus, Copy, Pencil, Trash2, ArrowLeftRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DealScenarioRow } from '@/hooks/useDealScenarios';

interface ScenarioTabsProps {
  rows: DealScenarioRow[];
  activeId: string | null;
  dirty: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  compareId: string | null;
  onSetCompare: (id: string | null) => void;
}

export function ScenarioTabs({
  rows, activeId, dirty, onSelect, onCreate, onRename, onDuplicate, onDelete,
  compareId, onSetCompare,
}: ScenarioTabsProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const startRename = (row: DealScenarioRow) => {
    setRenamingId(row.id);
    setRenameValue(row.name);
  };
  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      onRename(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  const compareActive = compareId !== null;

  return (
    <div className="flex items-center gap-2 flex-wrap border-b border-border pb-2">
      <div className="flex items-center gap-1 flex-wrap flex-1">
        {rows.map(row => {
          const isActive = row.id === activeId;
          if (renamingId === row.id) {
            return (
              <Input
                key={row.id}
                autoFocus
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setRenamingId(null);
                }}
                className="h-8 w-48"
              />
            );
          }
          return (
            <div
              key={row.id}
              className={cn(
                'group flex items-center gap-1 rounded-md border px-2 py-1 text-sm transition-colors',
                isActive
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card hover:bg-muted text-foreground',
              )}
            >
              <button
                onClick={() => onSelect(row.id)}
                onDoubleClick={() => startRename(row)}
                className="max-w-[180px] truncate text-left"
                title={row.name}
              >
                {row.name}
                {isActive && dirty && <span className="ml-1.5 text-amber-300">●</span>}
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      'opacity-60 hover:opacity-100',
                      isActive ? 'text-primary-foreground' : 'text-muted-foreground',
                    )}
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => startRename(row)}>
                    <Pencil className="w-3.5 h-3.5 mr-2" /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDuplicate(row.id)}>
                    <Copy className="w-3.5 h-3.5 mr-2" /> Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onDelete(row.id)}
                    disabled={rows.length <= 1}
                    className="text-rose-600"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
        <Button variant="outline" size="sm" onClick={onCreate} className="h-8">
          <Plus className="w-3.5 h-3.5 mr-1" /> New scenario
        </Button>
      </div>

      <div className="flex items-center gap-2">
        {compareActive ? (
          <>
            <Select value={compareId ?? ''} onValueChange={(v) => onSetCompare(v)}>
              <SelectTrigger className="h-8 w-56">
                <SelectValue placeholder="Compare against…" />
              </SelectTrigger>
              <SelectContent>
                {rows.filter(r => r.id !== activeId).map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" className="h-8" onClick={() => onSetCompare(null)}>
              <X className="w-3.5 h-3.5 mr-1" /> Exit compare
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={rows.length < 2}
            onClick={() => {
              const other = rows.find(r => r.id !== activeId);
              if (other) onSetCompare(other.id);
            }}
            title={rows.length < 2 ? 'Create a second scenario to compare' : 'Compare two scenarios side-by-side'}
          >
            <ArrowLeftRight className="w-3.5 h-3.5 mr-1" /> Compare
          </Button>
        )}
      </div>
    </div>
  );
}
