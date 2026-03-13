import { useAuth } from '@/hooks/useAuth';
import { usePersonalStats } from '@/hooks/useFleetStats';
import { AppLayout } from '@/components/layout/AppLayout';
import { GlassCard, StatCard, MiniStat } from '@/components/layout/GlassCard';
import { 
  MapPin, 
  Fuel, 
  DollarSign, 
  Package,
  AlertTriangle,
  Calendar,
  Truck,
  Clock,
  TrendingUp,
  Route
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  ComposedChart,
  Line
} from 'recharts';
import { format } from 'date-fns';

const CHART_COLORS = {
  green: 'hsl(145, 90%, 45%)',
  cyan: 'hsl(185, 85%, 50%)',
  purple: 'hsl(280, 80%, 55%)',
  amber: 'hsl(45, 95%, 55%)',
  rose: 'hsl(350, 85%, 55%)',
};

export default function MyStats() {
  const { user, profile } = useAuth();
  const { stats, recentJobs, loading } = usePersonalStats(user?.id);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(0);
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(num);
  };

  // Transform recent jobs for chart - Group by date
  const chartData = Object.values(
    recentJobs.reduce((acc: any, job: any) => {
      const dateKey = format(new Date(job.delivery_date), 'MMM dd');
      if (!acc[dateKey]) {
        acc[dateKey] = {
          date: dateKey,
          distance: 0,
          income: 0,
          damage: 0,
          count: 0,
          rawDate: new Date(job.delivery_date)
        };
      }
      acc[dateKey].distance += Number(job.distance_km) || 0;
      acc[dateKey].income += Number(job.income) || 0;
      acc[dateKey].damage += Number(job.damage_percent) || 0;
      acc[dateKey].count += 1;
      return acc;
    }, {})
  )
  .sort((a: any, b: any) => a.rawDate.getTime() - b.rawDate.getTime())
  .slice(-7)
  .map((day: any) => ({
    ...day,
    damage: Number((day.damage / day.count).toFixed(1)) // Average damage for the day
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-card p-3 text-sm">
          <p className="text-foreground font-medium mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
              {entry.name}: {
                entry.name === 'income' ? formatCurrency(entry.value) : 
                entry.name === 'damage' ? `${entry.value}%` :
                `${formatNumber(entry.value)} km`
              }
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <AppLayout>
      <div className="space-y-6 lg:space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-heading-1 font-bold gradient-text">My Statistics</h1>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">Your personal driving performance</p>
        </div>

        {/* Personal Stats Grid - Colorful */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            title="Total Distance"
            value={stats ? `${formatNumber(stats.total_distance)} km` : '0 km'}
            icon={<MapPin size={20} className="sm:w-6 sm:h-6" />}
            subtitle="Lifetime"
            color="green"
          />
          <StatCard
            title="Deliveries"
            value={stats?.total_deliveries || 0}
            icon={<Package size={20} className="sm:w-6 sm:h-6" />}
            subtitle="Completed"
            color="cyan"
          />
          <StatCard
            title="Earnings"
            value={stats ? formatCurrency(stats.total_income) : '$0'}
            icon={<DollarSign size={20} className="sm:w-6 sm:h-6" />}
            subtitle="All time"
            color="amber"
          />
          <StatCard
            title="Avg Damage"
            value={stats ? `${stats.avg_damage.toFixed(1)}%` : '0%'}
            icon={<AlertTriangle size={20} className="sm:w-6 sm:h-6" />}
            subtitle="Per delivery"
            color="rose"
          />
        </div>

        {/* Performance Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          {/* Distance & Income Combined */}
          <GlassCard>
            <h3 className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-primary" />
              Recent Performance
            </h3>
            {chartData.length > 0 ? (
              <div className="h-56 sm:h-64 lg:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <defs>
                      <linearGradient id="myDistanceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_COLORS.cyan} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={CHART_COLORS.cyan} stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 15%)" />
                    <XAxis dataKey="date" stroke="hsl(220, 10%, 45%)" fontSize={11} tickLine={false} />
                    <YAxis stroke="hsl(220, 10%, 45%)" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area 
                      type="monotone" 
                      dataKey="distance"
                      name="distance"
                      stroke={CHART_COLORS.cyan}
                      strokeWidth={2}
                      fill="url(#myDistanceGradient)" 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="income"
                      name="income"
                      stroke={CHART_COLORS.amber}
                      strokeWidth={2.5}
                      dot={{ fill: CHART_COLORS.amber, r: 4 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-56 sm:h-64 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Truck size={40} className="mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No job data yet</p>
                  <p className="text-xs mt-1">Start logging your deliveries!</p>
                </div>
              </div>
            )}
          </GlassCard>

          {/* Damage Chart */}
          <GlassCard>
            <h3 className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2">
              <AlertTriangle size={18} className="text-rose" />
              Damage History
            </h3>
            {chartData.length > 0 ? (
              <div className="h-56 sm:h-64 lg:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <defs>
                      <linearGradient id="damageGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_COLORS.rose} />
                        <stop offset="100%" stopColor={CHART_COLORS.purple} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 15%)" />
                    <XAxis dataKey="date" stroke="hsl(220, 10%, 45%)" fontSize={11} tickLine={false} />
                    <YAxis stroke="hsl(220, 10%, 45%)" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar 
                      dataKey="damage"
                      name="damage"
                      fill="url(#damageGradient)"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-56 sm:h-64 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <AlertTriangle size={40} className="mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No damage data</p>
                </div>
              </div>
            )}
          </GlassCard>
        </div>

        {/* Recent Jobs Table */}
        <GlassCard>
          <h3 className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2">
            <Route size={18} className="text-cyan" />
            Recent Deliveries
          </h3>
          {recentJobs.length > 0 ? (
            <div className="overflow-x-auto overflow-y-auto max-h-[400px] -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 pr-2">
              <table className="w-full min-w-[600px] relative">
                <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur">
                  <tr className="border-b border-border/50">
                    <th className="text-left py-3 px-3 text-muted-foreground font-medium text-xs sm:text-sm">Date</th>
                    <th className="text-left py-3 px-3 text-muted-foreground font-medium text-xs sm:text-sm">Route</th>
                    <th className="text-left py-3 px-3 text-muted-foreground font-medium text-xs sm:text-sm hidden sm:table-cell">Cargo</th>
                    <th className="text-right py-3 px-3 text-muted-foreground font-medium text-xs sm:text-sm">Distance</th>
                    <th className="text-right py-3 px-3 text-muted-foreground font-medium text-xs sm:text-sm">Income</th>
                    <th className="text-right py-3 px-3 text-muted-foreground font-medium text-xs sm:text-sm">Damage</th>
                  </tr>
                </thead>
                <tbody>
                  {recentJobs.slice(0, 20).map((job: any) => (
                    <tr key={job.id} className="border-b border-border/30 hover:bg-secondary/30 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <Calendar size={12} className="text-muted-foreground shrink-0" />
                          <span className="text-xs sm:text-sm">
                            {format(new Date(job.delivery_date), 'MMM dd')}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-xs sm:text-sm truncate block max-w-[150px]">
                          {job.origin_city || '—'} → {job.destination_city || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-3 hidden sm:table-cell">
                        <span className="text-xs sm:text-sm text-muted-foreground truncate block max-w-[100px]">
                          {job.cargo_type || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="font-medium text-cyan text-xs sm:text-sm">
                          {formatNumber(Number(job.distance_km))} km
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="font-medium text-amber text-xs sm:text-sm">
                          {formatCurrency(Number(job.income))}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className={`font-medium text-xs sm:text-sm ${
                          Number(job.damage_percent) > 5 ? 'text-rose' : 'text-primary'
                        }`}>
                          {Number(job.damage_percent).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <Clock size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No deliveries logged yet</p>
              <p className="text-xs mt-1">Start by logging your first job!</p>
            </div>
          )}
        </GlassCard>

        {/* Summary Cards - Colorful */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <GlassCard>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl icon-bg-cyan shrink-0">
                <Fuel size={22} />
              </div>
              <div>
                <p className="text-muted-foreground text-xs sm:text-sm">Total Fuel Used</p>
                <p className="text-xl sm:text-2xl font-bold text-cyan">
                  {stats ? `${formatNumber(stats.total_fuel)} L` : '0 L'}
                </p>
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl icon-bg-amber shrink-0">
                <DollarSign size={22} />
              </div>
              <div>
                <p className="text-muted-foreground text-xs sm:text-sm">Avg Income/Job</p>
                <p className="text-xl sm:text-2xl font-bold text-amber">
                  {stats && stats.total_deliveries > 0 
                    ? formatCurrency(stats.total_income / stats.total_deliveries) 
                    : '$0'}
                </p>
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl icon-bg-purple shrink-0">
                <MapPin size={22} />
              </div>
              <div>
                <p className="text-muted-foreground text-xs sm:text-sm">Avg Distance/Job</p>
                <p className="text-xl sm:text-2xl font-bold text-purple">
                  {stats && stats.total_deliveries > 0 
                    ? `${formatNumber(stats.total_distance / stats.total_deliveries)} km` 
                    : '0 km'}
                </p>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </AppLayout>
  );
}
