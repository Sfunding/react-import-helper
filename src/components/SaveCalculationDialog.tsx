import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save } from 'lucide-react';

type SaveCalculationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string) => Promise<void>;
  isSaving: boolean;
  defaultName?: string;
};

export function SaveCalculationDialog({ 
  open, 
  onOpenChange, 
  onSave, 
  isSaving,
  defaultName = ''
}: SaveCalculationDialogProps) {
  const [name, setName] = useState(defaultName);

  const handleSave = async () => {
    if (!name.trim()) return;
    await onSave(name.trim());
    setName('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="w-5 h-5" />
            Save Calculation
          </DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="calc-name" className="text-sm font-medium">
            Calculation Name
          </Label>
          <Input
            id="calc-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., ABC Company Consolidation"
            className="mt-2"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) {
                handleSave();
              }
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!name.trim() || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
