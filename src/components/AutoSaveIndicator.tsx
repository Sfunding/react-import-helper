import { Check, Loader2, AlertCircle, CloudOff } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { AutoSaveStatus } from '@/hooks/useAutoSave';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type Props = {
  enabled: boolean;
  onToggle: (next: boolean) => void;
  status: AutoSaveStatus;
  hasLoadedCalc: boolean;
  onRetry: () => void;
};

export function AutoSaveIndicator({ enabled, onToggle, status, hasLoadedCalc, onRetry }: Props) {
  const disabled = !hasLoadedCalc;

  let pill: React.ReactNode = null;
  if (!enabled) {
    pill = (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <CloudOff className="h-3.5 w-3.5" />
        Off
      </span>
    );
  } else if (!hasLoadedCalc) {
    pill = <span className="text-muted-foreground">Save first to enable</span>;
  } else if (status === 'saving') {
    pill = (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
      </span>
    );
  } else if (status === 'error') {
    pill = (
      <button onClick={onRetry} className="inline-flex items-center gap-1 text-destructive hover:underline">
        <AlertCircle className="h-3.5 w-3.5" /> Save failed — Retry
      </button>
    );
  } else {
    pill = (
      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
        <Check className="h-3.5 w-3.5" /> Saved
      </span>
    );
  }

  return (
    <TooltipProvider>
      <div className={cn('flex items-center gap-2 text-xs', disabled && 'opacity-70')}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5">
              <Switch checked={enabled} onCheckedChange={onToggle} disabled={disabled} aria-label="Auto-save" />
              <span className="font-medium">Auto-save</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {disabled
              ? 'Save the calculation once to enable auto-save.'
              : 'Silently saves edits to this deal every couple seconds.'}
          </TooltipContent>
        </Tooltip>
        <span className="text-muted-foreground">·</span>
        <div className="min-w-[100px]">{pill}</div>
      </div>
    </TooltipProvider>
  );
}
