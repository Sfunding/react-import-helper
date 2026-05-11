import { AlertTriangle, X, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

function timeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

type Props = {
  savedAt: number;
  calcName?: string;
  onRestore: () => void;
  onDiscard: () => void;
};

export function DraftRestoreBanner({ savedAt, calcName, onRestore, onDiscard }: Props) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0" />
        <div className="text-sm">
          <div className="font-semibold">Unsaved draft recovered</div>
          <div className="opacity-80">
            {calcName ? <>From <span className="font-medium">{calcName}</span> · </> : null}
            Last edited {timeAgo(savedAt)}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={onRestore} className="h-8">
          <RotateCcw className="mr-1 h-3.5 w-3.5" />
          Restore
        </Button>
        <Button size="sm" variant="ghost" onClick={onDiscard} className="h-8">
          <X className="mr-1 h-3.5 w-3.5" />
          Discard
        </Button>
      </div>
    </div>
  );
}
