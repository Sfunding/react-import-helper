import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCalculations } from '@/hooks/useCalculations';
import { useProfiles } from '@/hooks/useProfiles';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { UserFilter } from '@/components/UserFilter';
import { ShareDealDialog } from '@/components/ShareDealDialog';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FolderOpen, Trash2, ExternalLink, Loader2, Calculator, FileSpreadsheet, FileText, Copy, Share2, CheckCircle, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { exportToExcel, exportToPDF } from '@/lib/exportUtils';
import { SavedCalculation } from '@/types/calculation';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function SavedCalculations() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const { getUserName } = useProfiles();
  const [userFilter, setUserFilter] = useState<string>('all');

  const showUserFilter = isAdmin || hasPermission('can_view_others');

  // Determine the actual userId to filter by
  const filterUserId = userFilter === 'all' ? null : userFilter === 'mine' ? user?.id ?? null : userFilter;

  const { calculations, isLoading, deleteCalculation, isDeleting, duplicateCalculation, isDuplicating, markAsFunded, isMarkingFunded } = useCalculations(
    showUserFilter ? filterUserId : user?.id
  );
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [calcToDuplicate, setCalcToDuplicate] = useState<SavedCalculation | null>(null);
  const [duplicateName, setDuplicateName] = useState('');

  // Share dialog
  const [shareCalcId, setShareCalcId] = useState<string | null>(null);
  const [shareCalcName, setShareCalcName] = useState('');

  // Funded dialog
  const [fundedDialogOpen, setFundedDialogOpen] = useState(false);
  const [calcToFund, setCalcToFund] = useState<SavedCalculation | null>(null);
  const [fundedDate, setFundedDate] = useState<Date | undefined>(new Date());

  const fmt = (v: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(v || 0);

  const handleExportExcel = (calc: typeof calculations[0]) => {
    try {
      exportToExcel(calc as SavedCalculation);
      toast({ title: 'Excel exported', description: `${calc.name} has been downloaded as Excel.` });
    } catch (error) {
      toast({ title: 'Export failed', description: 'Failed to generate Excel file.', variant: 'destructive' });
    }
  };

  const handleExportPDF = async (calc: typeof calculations[0]) => {
    try {
      await exportToPDF(calc as SavedCalculation);
      toast({ title: 'PDF exported', description: `${calc.name} has been downloaded as PDF.` });
    } catch (error) {
      toast({ title: 'Export failed', description: 'Failed to generate PDF file.', variant: 'destructive' });
    }
  };

  const handleLoad = (calc: typeof calculations[0]) => {
    sessionStorage.setItem('loadCalculation', JSON.stringify({
      id: calc.id,
      name: calc.name,
      merchant: {
        name: calc.merchant_name || '',
        businessType: calc.merchant_business_type || '',
        monthlyRevenue: calc.merchant_monthly_revenue || 0
      },
      settings: calc.settings,
      positions: calc.positions,
      funded_at: (calc as any).funded_at || null
    }));
    navigate('/');
  };

  const openDuplicateDialog = (calc: typeof calculations[0]) => {
    setCalcToDuplicate(calc as SavedCalculation);
    setDuplicateName(`${calc.name} (Copy)`);
    setDuplicateDialogOpen(true);
  };

  const handleDuplicate = async () => {
    if (!calcToDuplicate || !duplicateName.trim()) return;
    await duplicateCalculation({
      originalId: calcToDuplicate.id,
      newName: duplicateName.trim(),
      calculation: calcToDuplicate
    });
    setDuplicateDialogOpen(false);
    setCalcToDuplicate(null);
    setDuplicateName('');
  };

  const openFundedDialog = (calc: SavedCalculation) => {
    setCalcToFund(calc);
    setFundedDate(calc.funded_at ? new Date(calc.funded_at) : new Date());
    setFundedDialogOpen(true);
  };

  const handleMarkFunded = async () => {
    if (!calcToFund || !fundedDate) return;
    await markAsFunded({ id: calcToFund.id, funded_at: fundedDate.toISOString() });
    toast({ title: 'Deal marked as funded', description: `Funded date set to ${format(fundedDate, 'MMM d, yyyy')}.` });
    setFundedDialogOpen(false);
    setCalcToFund(null);
  };

  const handleUnfund = async (calc: SavedCalculation) => {
    await markAsFunded({ id: calc.id, funded_at: null });
    toast({ title: 'Funded status removed' });
  };

  const canShare = isAdmin || hasPermission('can_view_others');

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-6xl mx-auto p-4">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FolderOpen className="w-6 h-6" />
            Saved Calculations
          </h1>
          <div className="flex items-center gap-3">
            {showUserFilter && <UserFilter value={userFilter} onChange={setUserFilter} />}
            <Button onClick={() => navigate('/')} variant="outline">
              <Calculator className="w-4 h-4 mr-2" />
              New Calculation
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : calculations.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <FolderOpen className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No Saved Calculations</h3>
              <p className="text-muted-foreground mb-4">Create and save your first calculation to see it here.</p>
              <Button onClick={() => navigate('/')}>Create Calculation</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {calculations.map((calc) => {
              const isOwner = calc.user_id === user?.id;
              const isSharedWithMe = !isOwner && !isAdmin;
              const isFunded = !!(calc as any).funded_at;
              const fundedAtDate = isFunded ? new Date((calc as any).funded_at) : null;

              return (
                <Card key={calc.id} className={cn("hover:border-primary/50 transition-colors", isFunded && "border-green-500/30")}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg truncate">{calc.name}</CardTitle>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        {isFunded && fundedAtDate && (
                          <Badge className="bg-green-600 hover:bg-green-700 text-xs">
                            Funded · {format(fundedAtDate, 'MMM d, yyyy')}
                          </Badge>
                        )}
                        {isSharedWithMe && (
                          <Badge variant="secondary" className="text-xs">Shared</Badge>
                        )}
                      </div>
                    </div>
                    <CardDescription>
                      {calc.merchant_name || 'No merchant name'}
                      {calc.merchant_business_type && ` • ${calc.merchant_business_type}`}
                    </CardDescription>
                    {(isAdmin || showUserFilter) && (
                      <p className="text-xs text-muted-foreground mt-1">
                        By: {getUserName(calc.user_id)}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                      <div className="bg-destructive/10 rounded p-2 text-center">
                        <div className="text-xs text-muted-foreground">Balance</div>
                        <div className="font-semibold text-destructive">{fmt(calc.total_balance || 0)}</div>
                      </div>
                      <div className="bg-primary/10 rounded p-2 text-center">
                        <div className="text-xs text-muted-foreground">Daily</div>
                        <div className="font-semibold text-primary">{fmt(calc.total_daily_payment || 0)}</div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mb-4">
                      Updated {format(new Date(calc.updated_at), 'MMM d, yyyy h:mm a')}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button onClick={() => handleLoad(calc)} className="flex-1" size="sm">
                        <ExternalLink className="w-4 h-4 mr-1" />
                        Load
                      </Button>
                      <Button
                        onClick={() => openFundedDialog(calc as SavedCalculation)}
                        variant={isFunded ? "secondary" : "outline"}
                        size="sm"
                        title={isFunded ? "Update funded date" : "Mark as funded"}
                        disabled={isMarkingFunded}
                      >
                        <CheckCircle className={cn("w-4 h-4", isFunded && "text-green-500")} />
                      </Button>
                      <Button onClick={() => openDuplicateDialog(calc)} variant="outline" size="sm" title="Duplicate" disabled={isDuplicating}>
                        <Copy className="w-4 h-4" />
                      </Button>
                      {hasPermission('can_export') && (
                        <>
                          <Button onClick={() => handleExportExcel(calc)} variant="outline" size="sm" title="Export to Excel">
                            <FileSpreadsheet className="w-4 h-4" />
                          </Button>
                          <Button onClick={() => handleExportPDF(calc)} variant="outline" size="sm" title="Export to PDF">
                            <FileText className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      {canShare && (
                        <Button
                          variant="outline"
                          size="sm"
                          title="Share"
                          onClick={() => { setShareCalcId(calc.id); setShareCalcName(calc.name); }}
                        >
                          <Share2 className="w-4 h-4" />
                        </Button>
                      )}
                      {hasPermission('can_delete_deals') && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" disabled={isDeleting}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Calculation</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{calc.name}"? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteCalculation(calc.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Duplicate Dialog */}
        <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Copy className="w-5 h-5" />
                Duplicate Calculation
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="duplicate-name" className="text-sm font-medium">New Calculation Name</Label>
              <Input
                id="duplicate-name"
                value={duplicateName}
                onChange={(e) => setDuplicateName(e.target.value)}
                placeholder="Enter name for the copy"
                className="mt-2"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && duplicateName.trim()) handleDuplicate();
                }}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDuplicateDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleDuplicate} disabled={!duplicateName.trim() || isDuplicating}>
                {isDuplicating ? 'Duplicating...' : 'Duplicate'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Funded Dialog */}
        <Dialog open={fundedDialogOpen} onOpenChange={setFundedDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                Mark as Funded
              </DialogTitle>
              <DialogDescription>
                Set the date this deal was funded. Position balances will be auto-adjusted when loaded.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label className="text-sm font-medium mb-2 block">Funding Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !fundedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fundedDate ? format(fundedDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={fundedDate}
                    onSelect={setFundedDate}
                    disabled={(date) => date > new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              {calcToFund?.funded_at && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (calcToFund) handleUnfund(calcToFund);
                    setFundedDialogOpen(false);
                  }}
                  className="sm:mr-auto"
                >
                  Remove Funded Status
                </Button>
              )}
              <Button variant="outline" onClick={() => setFundedDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleMarkFunded} disabled={!fundedDate || isMarkingFunded}>
                {isMarkingFunded ? 'Saving...' : 'Mark Funded'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Share Dialog */}
        {shareCalcId && (
          <ShareDealDialog
            open={!!shareCalcId}
            onOpenChange={(open) => { if (!open) setShareCalcId(null); }}
            calculationId={shareCalcId}
            calculationName={shareCalcName}
          />
        )}
      </div>
    </div>
  );
}
