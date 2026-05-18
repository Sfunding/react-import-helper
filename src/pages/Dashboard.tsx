import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Calculator, FilePlus, FolderOpen, TrendingUp, DollarSign, CheckCircle,
  Loader2, ArrowRight,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { OpenTabsBar } from '@/components/OpenTabsBar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCalculations } from '@/hooks/useCalculations';
import { useAuth } from '@/contexts/AuthContext';
import { useOpenTabs } from '@/hooks/useOpenTabs';
import { SavedCalculation } from '@/types/calculation';
import { cn } from '@/lib/utils';

const fmtMoney = (v: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v || 0);

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { calculations, isLoading } = useCalculations(isAdmin ? null : user?.id);
  const { openTab } = useOpenTabs();

  const kpis = useMemo(() => {
    const totalDeals = calculations.length;
    const totalBalance = calculations.reduce((s, c) => s + (c.total_balance || 0), 0);
    const totalDaily = calculations.reduce((s, c) => s + (c.total_daily_payment || 0), 0);
    const fundedCount = calculations.filter((c: any) => c.funded_at).length;
    return { totalDeals, totalBalance, totalDaily, fundedCount };
  }, [calculations]);

  const recent = useMemo(() => calculations.slice(0, 8), [calculations]);

  const handleOpen = (calc: SavedCalculation) => {
    openTab({ id: calc.id, name: calc.name, merchant: calc.merchant_name || undefined });
    navigate(`/deal/${calc.id}`);
  };

  const handleNew = () => {
    navigate('/deal/new');
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <OpenTabsBar />
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-primary">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Your deals at a glance</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/saved')}>
              <FolderOpen className="w-4 h-4 mr-2" />
              All Saved
            </Button>
            <Button onClick={handleNew}>
              <FilePlus className="w-4 h-4 mr-2" />
              New Calculation
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KpiCard icon={<Calculator className="w-4 h-4" />} label="Total deals" value={kpis.totalDeals.toString()} />
          <KpiCard icon={<DollarSign className="w-4 h-4" />} label="Total balance" value={fmtMoney(kpis.totalBalance)} />
          <KpiCard icon={<TrendingUp className="w-4 h-4" />} label="Total daily" value={fmtMoney(kpis.totalDaily)} />
          <KpiCard icon={<CheckCircle className="w-4 h-4" />} label="Funded" value={kpis.fundedCount.toString()} />
        </div>

        {/* Recent Deals */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent deals</CardTitle>
              <CardDescription>Most recently edited calculations</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/saved')}>
              View all <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : recent.length === 0 ? (
              <div className="text-center py-10">
                <FolderOpen className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-4">No saved calculations yet.</p>
                <Button onClick={handleNew}>
                  <FilePlus className="w-4 h-4 mr-2" />
                  Start a new calculation
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recent.map((calc: any) => {
                  const isFunded = !!calc.funded_at;
                  return (
                    <button
                      key={calc.id}
                      onClick={() => handleOpen(calc)}
                      className={cn(
                        'w-full text-left flex items-center justify-between gap-4 py-3 px-2 rounded hover:bg-muted/50 transition-colors',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{calc.name}</span>
                          {isFunded && (
                            <Badge className="bg-green-600 hover:bg-green-700 text-[10px]">
                              Funded
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {calc.merchant_name || 'No merchant'} ·
                          {' '}Updated {format(new Date(calc.updated_at), 'MMM d, yyyy h:mm a')}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <div className="text-[10px] text-muted-foreground">Balance</div>
                          <div className="text-sm font-semibold text-destructive">
                            {fmtMoney(calc.total_balance || 0)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-muted-foreground">Daily</div>
                          <div className="text-sm font-semibold text-primary">
                            {fmtMoney(calc.total_daily_payment || 0)}
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
          {icon}
          <span>{label}</span>
        </div>
        <div className="text-xl md:text-2xl font-bold text-foreground truncate">{value}</div>
      </CardContent>
    </Card>
  );
}
