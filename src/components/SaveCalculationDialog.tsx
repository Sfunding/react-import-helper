import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, RefreshCw } from 'lucide-react';

type SaveCalculationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string) => Promise<void>;
  onUpdate?: (name: string) => Promise<void>;
  isSaving: boolean;
  defaultName?: string;
  existingId?: string | null;
  existingName?: string;
};

export function SaveCalculationDialog({ 
  open, 
  onOpenChange, 
  onSave,
  onUpdate,
  isSaving,
  defaultName = '',
  existingId,
  existingName = ''
}: SaveCalculationDialogProps) {
  const [name, setName] = useState(defaultName || existingName);
  const isEditing = !!existingId && !!onUpdate;

  // Update name when dialog opens or defaultName/existingName changes
  useEffect(() => {
    if (open) {
      setName(existingName || defaultName);
    }
  }, [open, defaultName, existingName]);

  const handleSaveAsNew = async () => {
    if (!name.trim()) return;
    await onSave(name.trim());
    setName('');
    onOpenChange(false);
  };

  const handleUpdate = async () => {
    if (!name.trim() || !onUpdate) return;
    await onUpdate(name.trim());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? (
              <>
                <RefreshCw className="w-5 h-5" />
                Update Calculation
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Calculation
              </>
            )}
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
                isEditing ? handleUpdate() : handleSaveAsNew();
              }
            }}
          />
          {isEditing && (
            <p className="text-xs text-muted-foreground mt-2">
              You're editing "{existingName}". Choose to update the existing record or save as a new calculation.
            </p>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {isEditing ? (
            <>
              <Button 
                variant="secondary"
                onClick={handleSaveAsNew} 
                disabled={!name.trim() || isSaving}
              >
                Save as New
              </Button>
              <Button 
                onClick={handleUpdate} 
                disabled={!name.trim() || isSaving}
              >
                {isSaving ? 'Updating...' : 'Update'}
              </Button>
            </>
          ) : (
            <Button 
              onClick={handleSaveAsNew} 
              disabled={!name.trim() || isSaving}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
