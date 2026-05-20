import { Lightbulb, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Position } from '@/types/calculation';
import { parseISODateLocal } from '@/lib/dateUtils';

interface Props {
  asOfDate: string;
  positions: Position[];
  reverseCadence?: 'daily' | 'weekly';
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getAnchorWeekday(iso: string): string {
  const d = parseISODateLocal(iso);
  const dow = d.getDay();
  // Weekend -> push to next Monday
  if (dow === 0) return 'Monday';
  if (dow === 6) return 'Monday';
  return WEEKDAY_NAMES[dow];
}

export function DealStructureHelper({ asOfDate, positions }: Props) {
  if (!positions || positions.length === 0) return null;

  const anchorWeekday = getAnchorWeekday(asOfDate);
  const includedWeekly = positions.filter(p => p.includeInReverse && p.frequency === 'weekly');
  const includedDaily = positions.filter(p => p.includeInReverse && (p.frequency || 'daily') === 'daily');
  const mismatched = includedWeekly.filter(p => (p.weeklyPullDay || 'Monday') !== anchorWeekday);
  const allAligned = includedWeekly.length > 0 && mismatched.length === 0;

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            size="lg"
            className="rounded-full shadow-lg h-14 w-14 p-0 bg-primary hover:bg-primary/90 relative"
            aria-label="Deal structuring suggestions"
          >
            <Lightbulb className="h-6 w-6" />
            {mismatched.length > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-warning text-warning-foreground text-xs font-bold flex items-center justify-center border-2 border-background">
                {mismatched.length}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent side="top" align="end" className="w-96 p-0">
          <div className="p-4 border-b bg-primary/5">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              Deal Structuring
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Funding day is <span className="font-semibold text-foreground">{anchorWeekday}</span>.
              Recommend the merchant align every debit to this day so all positions clip together
              with your wire.
            </p>
          </div>

          <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
            {mismatched.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-warning-foreground mb-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                  Move these weekly pulls to {anchorWeekday}
                </div>
                <ul className="space-y-1.5">
                  {mismatched.map(p => (
                    <li key={p.id} className="text-xs flex justify-between items-center bg-warning/10 border border-warning/30 rounded px-2 py-1.5">
                      <span className="font-medium truncate">{p.entity || 'Unnamed position'}</span>
                      <span className="text-muted-foreground whitespace-nowrap ml-2">
                        {p.weeklyPullDay || 'Monday'} → <span className="font-semibold text-foreground">{anchorWeekday}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {allAligned && (
              <div className="flex items-start gap-2 text-xs bg-success/10 border border-success/30 rounded p-2">
                <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                <span>All weekly debits are aligned with your funding day.</span>
              </div>
            )}

            {includedDaily.length > 0 && (
              <div className="text-xs text-muted-foreground border-t pt-3">
                <span className="font-semibold text-foreground">Daily positions ({includedDaily.length}):</span>{' '}
                continue every business day — no move needed.
              </div>
            )}

            {includedWeekly.length === 0 && includedDaily.length === 0 && (
              <div className="text-xs text-muted-foreground">
                No positions are included in the reverse yet.
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
