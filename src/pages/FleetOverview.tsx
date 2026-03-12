import { useFleetStats } from '@/hooks/useFleetStats';
import { AppLayout } from '@/components/layout/AppLayout';
import { GlassCard, StatCard } from '@/components/layout/GlassCard';
import {
  MapPin,
  Fuel,
  DollarSign,
  Package,
  TrendingUp,
  TrendingDown,
  Truck,
  Scale,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';

const monthlyData = [
  { month: 'Jan', distance: 45000, income: 125000, expenses: 35000 },
  { month: 'Feb', distance: 52000, income: 145000, expenses: 38000 },
  { month: 'Mar', distance: 48000, income: 135000, expenses: 36000 },
  { month: 'Apr', distance: 61000, income: 175000, expenses: 42000 },
  { month: 'May', distance: 58000, income: 165000, expenses: 40000 },
  { month: 'Jun', distance: 72000, income: 210000, expenses: 48000 },
];

const cargoDistribution = [
  { name: 'Electronics', value: 25, color: 'hsla(67, 100%, 50%, 1.00)' },
  { name: 'Machinery', value: 20, color: 'hsla(235, 100%, 50%, 1.00)' },
  { name: 'Food & Beverage', value: 18, color: 'hsla(117, 100%, 50%, 1.00)' },
  { name: 'Construction', value: 15, color: 'hsla(195, 100%, 50%, 1.00)' },
  { name: 'Chemicals', value: 12, color: 'rgba(255, 149, 0, 1)' },
  { name: 'Other', value: 10, color: 'hsla(288, 100%, 50%, 1.00)' },
];

const routeData = [
  { route: 'Berlin → Paris', trips: 45, distance: 1050 },
  { route: 'London → Amsterdam', trips: 38, distance: 450 },
  { route: 'Madrid → Rome', trips: 32, distance: 1950 },
  { route: 'Vienna → Prague', trips: 28, distance: 330 },
  { route: 'Oslo → Stockholm', trips: 25, distance: 520 },
];

export default function FleetOverview() {
  const { stats, leaderboard, loading, refresh } = useFleetStats();

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

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold gradient-text">Fleet Overview</h1>
            <p className="text-muted-foreground mt-1">Combined VTC performance statistics</p>
          </div>
          <Button
            variant="outline"
            onClick={refresh}
            disabled={loading}
            className="gap-2 rounded-full"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Refresh Data
          </Button>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Distance"
            value={stats ? `${formatNumber(stats.total_distance)} km` : '—'}
            icon={<MapPin size={24} />}
            trend={{ value: 12.5, isPositive: true }}
          />
          <StatCard
            title="Total Revenue"
            value={stats ? formatCurrency(stats.total_income) : '—'}
            icon={<DollarSign size={24} />}
            trend={{ value: 8.3, isPositive: true }}
          />
          <StatCard
            title="Total Expenses"
            value={stats ? formatCurrency(stats.total_expenses) : '—'}
            icon={<TrendingDown size={24} />}
            subtitle="Fuel, repairs, tolls"
          />
          <StatCard
            title="Net Profit"
            value={stats ? formatCurrency(stats.total_profit) : '—'}
            icon={<TrendingUp size={24} />}
            trend={{ value: 15.2, isPositive: true }}
          />
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Deliveries"
            value={stats?.total_deliveries || 0}
            icon={<Package size={24} />}
          />
          <StatCard
            title="Fuel Consumed"
            value={stats ? `${formatNumber(stats.total_fuel)} L` : '—'}
            icon={<Fuel size={24} />}
          />
          <StatCard
            title="Active Drivers"
            value={stats?.active_drivers || 0}
            icon={<Truck size={24} />}
          />
          <StatCard
            title="Avg Load Weight"
            value={stats ? `${formatNumber(stats.avg_load_weight)} t` : '—'}
            icon={<Scale size={24} />}
          />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Performance */}
          <GlassCard>
            <h3 className="text-lg font-semibold mb-4">Monthly Performance</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(150, 100%, 50%)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(150, 100%, 50%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(150, 30%, 20%)" />
                  <XAxis dataKey="month" stroke="hsl(0, 0%, 60%)" />
                  <YAxis stroke="hsl(0, 0%, 60%)" tickFormatter={(v) => `$${v / 1000}k`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(0, 0%, 8%)',
                      border: '1px solid hsl(150, 30%, 20%)',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="income"
                    stroke="hsl(150, 100%, 50%)"
                    fill="url(#incomeGradient)"
                    name="Income"
                  />
                  <Area
                    type="monotone"
                    dataKey="expenses"
                    stroke="hsl(0, 72%, 51%)"
                    fill="url(#expenseGradient)"
                    name="Expenses"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          {/* Distance Trend */}
          <GlassCard>
            <h3 className="text-lg font-semibold mb-4">Distance Trend (km)</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(150, 30%, 20%)" />
                  <XAxis dataKey="month" stroke="hsl(0, 0%, 60%)" />
                  <YAxis stroke="hsl(0, 0%, 60%)" tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(0, 0%, 8%)',
                      border: '1px solid hsl(150, 30%, 20%)',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => [`${formatNumber(value)} km`, 'Distance']}
                  />
                  <Line
                    type="monotone"
                    dataKey="distance"
                    stroke="hsl(150, 100%, 50%)"
                    strokeWidth={3}
                    dot={{ fill: 'hsl(150, 100%, 50%)', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: 'hsl(150, 100%, 60%)' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cargo Distribution */}
          <GlassCard>
            <h3 className="text-lg font-semibold mb-4">Cargo Distribution</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={cargoDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {cargoDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(0, 0%, 8%)',
                      border: '1px solid hsl(150, 30%, 20%)',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => [`${value}%`, 'Share']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {cargoDistribution.map((item) => (
                <div key={item.name} className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-muted-foreground truncate">{item.name}</span>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Popular Routes */}
          <GlassCard className="lg:col-span-2">
            <h3 className="text-lg font-semibold mb-4">Popular Routes</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={routeData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(150, 30%, 20%)" />
                  <XAxis type="number" stroke="hsl(0, 0%, 60%)" />
                  <YAxis
                    type="category"
                    dataKey="route"
                    stroke="hsl(0, 0%, 60%)"
                    width={120}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(0, 0%, 8%)',
                      border: '1px solid hsl(150, 30%, 20%)',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="trips" fill="hsl(150, 100%, 50%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>

        {/* Profit/Loss Summary */}
        <GlassCard>
          <h3 className="text-lg font-semibold mb-4">Profit & Loss Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-4 rounded-xl bg-muted/30">
              <p className="text-muted-foreground text-sm">Gross Revenue</p>
              <p className="text-2xl font-bold gradient-text mt-1">
                {stats ? formatCurrency(stats.total_income) : '$0'}
              </p>
            </div>
            <div className="text-center p-4 rounded-xl bg-muted/30">
              <p className="text-muted-foreground text-sm">Fuel Costs</p>
              <p className="text-2xl font-bold text-destructive mt-1">
                {stats ? formatCurrency(stats.total_fuel * 1.5) : '$0'}
              </p>
            </div>
            <div className="text-center p-4 rounded-xl bg-muted/30">
              <p className="text-muted-foreground text-sm">Other Expenses</p>
              <p className="text-2xl font-bold text-destructive mt-1">
                {stats ? formatCurrency(stats.total_expenses - stats.total_fuel * 1.5) : '$0'}
              </p>
            </div>
            <div className="text-center p-4 rounded-xl bg-muted/30">
              <p className="text-muted-foreground text-sm">Total Expenses</p>
              <p className="text-2xl font-bold text-destructive mt-1">
                {stats ? formatCurrency(stats.total_expenses) : '$0'}
              </p>
            </div>
            <div className="text-center p-4 rounded-xl bg-primary/10 border border-primary/30">
              <p className="text-muted-foreground text-sm">Net Profit</p>
              <p className="text-2xl font-bold gradient-text mt-1">
                {stats ? formatCurrency(stats.total_profit) : '$0'}
              </p>
            </div>
          </div>
        </GlassCard>
      </div>
    </AppLayout>
  );
}