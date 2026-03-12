import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFleetStats, usePersonalStats, useWeeklyData } from '@/hooks/useFleetStats';
import { useEventReminders } from '@/hooks/useEventReminders';
import { AppLayout } from '@/components/layout/AppLayout';
import { GlassCard, StatCard, MiniStat } from '@/components/layout/GlassCard';
import { FeaturedEventsCarousel } from '@/components/events/FeaturedEventsCarousel';
import { supabase } from '@/integrations/supabase/client';
import { 
  Truck, 
  MapPin, 
  Fuel, 
  DollarSign, 
  Users, 
  TrendingUp,
  Trophy,
  Package,
  Megaphone,
  Activity,
  Gauge,
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
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { format } from 'date-fns';

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  created_at: string;
  expires_at: string | null;
}

// Vibrant chart colors
const CHART_COLORS = {
  green: 'hsl(145, 90%, 45%)',
  cyan: 'hsl(185, 85%, 50%)',
  purple: 'hsl(280, 80%, 55%)',
  amber: 'hsl(45, 95%, 55%)',
  rose: 'hsl(350, 85%, 55%)',
  blue: 'hsl(210, 90%, 55%)',
};

const PIE_COLORS = [
  CHART_COLORS.green,
  CHART_COLORS.cyan,
  CHART_COLORS.purple,
  CHART_COLORS.amber,
  CHART_COLORS.rose,
];

export default function Dashboard() {
  const { user, profile, roles, isApproved, isStaff } = useAuth();
  const { stats, leaderboard, loading: fleetLoading } = useFleetStats();
  const { stats: personalStats, loading: personalLoading } = usePersonalStats(user?.id);
  const { weeklyData, loading: weeklyLoading } = useWeeklyData();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  
  useEventReminders();

  useEffect(() => {
    const fetchAnnouncements = async () => {
      const { data } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(3);
      
      if (data) setAnnouncements(data as Announcement[]);
    };
    fetchAnnouncements();
  }, []);

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
      maximumFractionDigits: 0,
    }).format(num);
  };

  const pieData = leaderboard.slice(0, 5).map((driver, index) => ({
    name: driver.username,
    value: Number(driver.total_distance),
    color: PIE_COLORS[index % PIE_COLORS.length],
  }));

  const priorityColors = {
    low: 'border-l-4 border-l-muted-foreground/50',
    normal: 'border-l-4 border-l-primary',
    high: 'border-l-4 border-l-amber',
    urgent: 'border-l-4 border-l-rose',
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-card p-3 text-sm">
          <p className="text-foreground font-medium mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
              {entry.name}: {entry.name === 'income' ? formatCurrency(entry.value) : `${formatNumber(entry.value)} km`}
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-heading-1 font-bold">
              Welcome, <span className="gradient-text">{profile?.username || 'Driver'}</span>
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base mt-1">
              {isApproved ? "Here's your fleet overview" : "Your account is pending approval"}
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-primary/10 text-primary text-sm w-fit">
            <Activity size={14} className="animate-pulse" />
            <span className="font-medium">Live Dashboard</span>
          </div>
        </div>

        {/* Announcements */}
        {announcements.length > 0 && (
          <div className="space-y-3">
            {announcements.map((announcement) => (
              <GlassCard 
                key={announcement.id} 
                className={priorityColors[announcement.priority]}
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className={`p-2 rounded-xl shrink-0 ${
                    announcement.priority === 'urgent' ? 'icon-bg-rose' :
                    announcement.priority === 'high' ? 'icon-bg-amber' :
                    'icon-bg-green'
                  }`}>
                    <Megaphone size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm sm:text-base">{announcement.title}</h3>
                      {announcement.priority === 'urgent' && (
                        <span className="px-2 py-0.5 rounded-full bg-rose/20 text-rose text-xs uppercase font-medium">
                          Urgent
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground text-sm mt-1 line-clamp-2">{announcement.content}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {format(new Date(announcement.created_at), 'MMM dd, yyyy')}
                    </p>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}

        {!isApproved && (
          <GlassCard className="border-l-4 border-l-amber">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl icon-bg-amber shrink-0">
                <Users size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-amber">Account Pending Approval</h3>
                <p className="text-muted-foreground text-sm">
                  Your account is awaiting HR approval. Some features may be limited.
                </p>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Fleet Stats Grid - Colorful */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            title="Fleet Distance"
            value={stats ? `${formatNumber(stats.total_distance)} km` : '0 km'}
            icon={<MapPin size={20} className="sm:w-6 sm:h-6" />}
            subtitle="All drivers"
            color="green"
          />
          <StatCard
            title="Deliveries"
            value={stats ? formatNumber(stats.total_deliveries) : '0'}
            icon={<Package size={20} className="sm:w-6 sm:h-6" />}
            subtitle="Completed"
            color="cyan"
          />
          <StatCard
            title="Revenue"
            value={stats ? formatCurrency(stats.total_income) : '$0'}
            icon={<DollarSign size={20} className="sm:w-6 sm:h-6" />}
            subtitle="Total earnings"
            color="amber"
          />
          <StatCard
            title="Active Drivers"
            value={stats?.active_drivers || '0'}
            icon={<Users size={20} className="sm:w-6 sm:h-6" />}
            subtitle="Approved"
            color="purple"
          />
        </div>

        {/* Featured Events */}
        <FeaturedEventsCarousel />

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          {/* Distance Chart - Green to Cyan gradient */}
          <GlassCard>
            <h3 className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2">
              <Route size={18} className="text-primary" />
              Weekly Distance
            </h3>
            <div className="h-56 sm:h-64 lg:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyData}>
                  <defs>
                    <linearGradient id="distanceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.green} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={CHART_COLORS.cyan} stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 15%)" />
                  <XAxis 
                    dataKey="day" 
                    stroke="hsl(220, 10%, 45%)" 
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="hsl(220, 10%, 45%)" 
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="distance"
                    name="distance" 
                    stroke={CHART_COLORS.green}
                    strokeWidth={2.5}
                    fill="url(#distanceGradient)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          {/* Income Chart - Multi-color bars */}
          <GlassCard>
            <h3 className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2">
              <DollarSign size={18} className="text-amber" />
              Weekly Revenue
            </h3>
            <div className="h-56 sm:h-64 lg:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <defs>
                    <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.amber} />
                      <stop offset="100%" stopColor={CHART_COLORS.rose} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 15%)" />
                  <XAxis 
                    dataKey="day" 
                    stroke="hsl(220, 10%, 45%)" 
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="hsl(220, 10%, 45%)" 
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="income"
                    name="income" 
                    fill="url(#incomeGradient)" 
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>

        {/* Personal Stats & Leaderboard */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          {/* Personal Quick Stats */}
          <GlassCard>
            <h3 className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-cyan" />
              Your Stats
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <MiniStat
                label="Distance"
                value={personalStats ? `${formatNumber(personalStats.total_distance)}` : '0'}
                icon={<MapPin size={16} />}
                color="green"
              />
              <MiniStat
                label="Deliveries"
                value={personalStats?.total_deliveries || 0}
                icon={<Package size={16} />}
                color="cyan"
              />
              <MiniStat
                label="Earnings"
                value={personalStats ? `$${formatNumber(personalStats.total_income)}` : '$0'}
                icon={<DollarSign size={16} />}
                color="amber"
              />
              <MiniStat
                label="Avg Damage"
                value={personalStats ? `${personalStats.avg_damage.toFixed(1)}%` : '0%'}
                icon={<Gauge size={16} />}
                color="rose"
              />
            </div>
          </GlassCard>

          {/* Leaderboard */}
          <GlassCard className="lg:col-span-2">
            <h3 className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2">
              <Trophy size={18} className="text-amber" />
              Top Drivers
            </h3>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
              {leaderboard.length === 0 ? (
                <p className="text-muted-foreground text-center py-8 text-sm">No data yet. Start logging jobs!</p>
              ) : (
                leaderboard.map((driver, index) => (
                  <div 
                    key={driver.user_id}
                    className="flex items-center gap-3 p-2.5 sm:p-3 rounded-xl bg-secondary/50 hover:bg-secondary/70 transition-colors"
                  >
                    <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm shrink-0 ${
                      index === 0 ? 'bg-amber/20 text-amber' :
                      index === 1 ? 'bg-gray-400/20 text-gray-400' :
                      index === 2 ? 'bg-orange-500/20 text-orange-400' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {index + 1}
                    </div>
                    
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold overflow-hidden shrink-0">
                      {driver.avatar_url ? (
                        <img 
                          src={driver.avatar_url} 
                          alt={driver.username}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        driver.username?.charAt(0).toUpperCase() || '?'
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{driver.username}</p>
                      <p className="text-xs text-muted-foreground">
                        {driver.total_deliveries} deliveries
                      </p>
                    </div>
                    
                    <div className="text-right shrink-0">
                      <p className="font-bold text-primary text-sm">{formatNumber(Number(driver.total_distance))} km</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(Number(driver.total_earnings))}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </GlassCard>
        </div>

        {/* Fleet Summary - Colorful grid */}
        <GlassCard>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            <div className="text-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl mx-auto mb-2 icon-bg-cyan flex items-center justify-center">
                <Fuel size={20} />
              </div>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-cyan">
                {stats ? `${formatNumber(stats.total_fuel)} L` : '0 L'}
              </p>
              <p className="text-muted-foreground text-xs sm:text-sm">Fuel Used</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl mx-auto mb-2 icon-bg-rose flex items-center justify-center">
                <DollarSign size={20} />
              </div>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-rose">
                {stats ? formatCurrency(stats.total_expenses) : '$0'}
              </p>
              <p className="text-muted-foreground text-xs sm:text-sm">Expenses</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl mx-auto mb-2 icon-bg-green flex items-center justify-center">
                <TrendingUp size={20} />
              </div>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold gradient-text">
                {stats ? formatCurrency(stats.total_profit) : '$0'}
              </p>
              <p className="text-muted-foreground text-xs sm:text-sm">Net Profit</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl mx-auto mb-2 icon-bg-purple flex items-center justify-center">
                <Truck size={20} />
              </div>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-purple">
                {stats ? `${formatNumber(stats.avg_load_weight)} t` : '0 t'}
              </p>
              <p className="text-muted-foreground text-xs sm:text-sm">Avg Weight</p>
            </div>
          </div>
        </GlassCard>
      </div>
    </AppLayout>
  );
}
