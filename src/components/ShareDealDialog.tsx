import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfiles } from '@/hooks/useProfiles';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trash2, Share2 } from 'lucide-react';

interface ShareDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calculationId: string;
  calculationName: string;
}

export function ShareDealDialog({ open, onOpenChange, calculationId, calculationName }: ShareDealDialogProps) {
  const { user } = useAuth();
  const { profiles } = useProfiles();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState('');
  const [accessLevel, setAccessLevel] = useState('view');
  const [isSharing, setIsSharing] = useState(false);

  const { data: existingShares = [], isLoading: loadingShares } = useQuery({
    queryKey: ['deal-shares', calculationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_shares')
        .select('*')
        .eq('calculation_id', calculationId);
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const availableUsers = profiles.filter(
    p => p.id !== user?.id && !existingShares.some(s => s.shared_with === p.id)
  );

  const handleShare = async () => {
    if (!selectedUser || !user) return;
    setIsSharing(true);
    try {
      const { error } = await supabase
        .from('deal_shares')
        .insert({
          calculation_id: calculationId,
          shared_with: selectedUser,
          access_level: accessLevel,
          shared_by: user.id,
        });
      if (error) throw error;
      toast({ title: 'Deal shared', description: `Shared with ${profiles.find(p => p.id === selectedUser)?.full_name || 'user'}` });
      setSelectedUser('');
      queryClient.invalidateQueries({ queryKey: ['deal-shares', calculationId] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsSharing(false);
    }
  };

  const handleRevoke = async (shareId: string) => {
    try {
      const { error } = await supabase
        .from('deal_shares')
        .delete()
        .eq('id', shareId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['deal-shares', calculationId] });
      toast({ title: 'Access revoked' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const getUserName = (userId: string) => {
    const p = profiles.find(pr => pr.id === userId);
    return p?.full_name || p?.username || 'Unknown';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Share "{calculationName}"
          </DialogTitle>
        </DialogHeader>

        {loadingShares ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : existingShares.length > 0 ? (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Shared with</Label>
            {existingShares.map(share => (
              <div key={share.id} className="flex items-center justify-between p-2 rounded-lg border bg-card">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{getUserName(share.shared_with)}</span>
                  <Badge variant={share.access_level === 'edit' ? 'default' : 'secondary'}>
                    {share.access_level}
                  </Badge>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleRevoke(share.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        ) : null}

        {availableUsers.length > 0 && (
          <div className="space-y-3 pt-2">
            <Label className="text-sm font-medium">Add user</Label>
            <div className="flex gap-2">
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name || p.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={accessLevel} onValueChange={setAccessLevel}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">View</SelectItem>
                  <SelectItem value="edit">Edit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          {selectedUser && (
            <Button onClick={handleShare} disabled={isSharing}>
              {isSharing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Share
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
