import { useNavigate } from 'react-router-dom';
import { useCalculations } from '@/hooks/useCalculations';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { FolderOpen, Trash2, ExternalLink, Loader2, Calculator, FileSpreadsheet, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { exportToExcel, exportToPDF } from '@/lib/exportUtils';
import { SavedCalculation } from '@/types/calculation';
import { useToast } from '@/hooks/use-toast';

export default function SavedCalculations() {
  const navigate = useNavigate();
  const { calculations, isLoading, deleteCalculation, isDeleting } = useCalculations();
  const { toast } = useToast();

  const fmt = (v: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(v || 0);

  const handleExportExcel = (calc: typeof calculations[0]) => {
    try {
      exportToExcel(calc as SavedCalculation);
      toast({
        title: 'Excel exported',
        description: `${calc.name} has been downloaded as Excel.`
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'Failed to generate Excel file.',
        variant: 'destructive'
      });
    }
  };

  const handleExportPDF = async (calc: typeof calculations[0]) => {
    try {
      await exportToPDF(calc as SavedCalculation);
      toast({
        title: 'PDF exported',
        description: `${calc.name} has been downloaded as PDF.`
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'Failed to generate PDF file.',
        variant: 'destructive'
      });
    }
  };

  const handleLoad = (calc: typeof calculations[0]) => {
    // Store in sessionStorage for the calculator to pick up
    sessionStorage.setItem('loadCalculation', JSON.stringify({
      id: calc.id,
      name: calc.name,
      merchant: {
        name: calc.merchant_name || '',
        businessType: calc.merchant_business_type || '',
        monthlyRevenue: calc.merchant_monthly_revenue || 0
      },
      settings: calc.settings,
      positions: calc.positions
    }));
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-6xl mx-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FolderOpen className="w-6 h-6" />
            Saved Calculations
          </h1>
          <Button onClick={() => navigate('/')} variant="outline">
            <Calculator className="w-4 h-4 mr-2" />
            New Calculation
          </Button>
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
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No Saved Calculations
              </h3>
              <p className="text-muted-foreground mb-4">
                Create and save your first calculation to see it here.
              </p>
              <Button onClick={() => navigate('/')}>
                Create Calculation
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {calculations.map((calc) => (
              <Card key={calc.id} className="hover:border-primary/50 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg truncate">{calc.name}</CardTitle>
                  <CardDescription>
                    {calc.merchant_name || 'No merchant name'}
                    {calc.merchant_business_type && ` • ${calc.merchant_business_type}`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                    <div className="bg-destructive/10 rounded p-2 text-center">
                      <div className="text-xs text-muted-foreground">Balance</div>
                      <div className="font-semibold text-destructive">
                        {fmt(calc.total_balance || 0)}
                      </div>
                    </div>
                    <div className="bg-primary/10 rounded p-2 text-center">
                      <div className="text-xs text-muted-foreground">Daily</div>
                      <div className="font-semibold text-primary">
                        {fmt(calc.total_daily_payment || 0)}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mb-4">
                    Updated {format(new Date(calc.updated_at), 'MMM d, yyyy h:mm a')}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => handleLoad(calc)} 
                      className="flex-1"
                      size="sm"
                    >
                      <ExternalLink className="w-4 h-4 mr-1" />
                      Load
                    </Button>
                    <Button 
                      onClick={() => handleExportExcel(calc)} 
                      variant="outline" 
                      size="sm"
                      title="Export to Excel"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                    </Button>
                    <Button 
                      onClick={() => handleExportPDF(calc)} 
                      variant="outline" 
                      size="sm"
                      title="Export to PDF"
                    >
                      <FileText className="w-4 h-4" />
                    </Button>
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
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
