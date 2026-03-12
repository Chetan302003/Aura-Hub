import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { 
  FileText, 
  Search, 
  RefreshCw,
  UserCheck,
  UserX,
  Shield,
  Edit,
  Trash,
  Loader2,
  Rocket,
  Megaphone,
  ChevronDown,
  ChevronRight,
  Clock,
  User,
  Terminal,
  Filter,
  X,
  AlertCircle,
  CheckCircle2,
  Info
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface SystemLog {
  id: string;
  actor_id: string;
  action_type: string;
  target_user_id: string | null;
  details: any;
  created_at: string;
  actor_username?: string;
  target_username?: string;
}

type LogLevel = 'info' | 'success' | 'warning' | 'error';

const ACTION_CONFIG: Record<string, { icon: any; level: LogLevel; label: string }> = {
  user_approved: { icon: UserCheck, level: 'success', label: 'User Approved' },
  user_rejected: { icon: UserX, level: 'error', label: 'User Rejected' },
  role_changed: { icon: Shield, level: 'warning', label: 'Role Changed' },
  hr_update_profile: { icon: Edit, level: 'info', label: 'Profile Updated' },
  hr_update_password: { icon: Shield, level: 'warning', label: 'Password Updated' },
  hr_update_email: { icon: Edit, level: 'info', label: 'Email Updated' },
  hr_set_roles: { icon: Shield, level: 'warning', label: 'Roles Set' },
  hr_delete_user: { icon: Trash, level: 'error', label: 'User Deleted' },
  version_pushed: { icon: Rocket, level: 'success', label: 'Version Pushed' },
  announcement_created: { icon: Megaphone, level: 'info', label: 'Announcement Created' },
  data_deleted: { icon: Trash, level: 'error', label: 'Data Deleted' },
};

const LEVEL_STYLES: Record<LogLevel, { bg: string; text: string; border: string; icon: any }> = {
  info: { 
    bg: 'bg-chart-4/10', 
    text: 'text-chart-4', 
    border: 'border-chart-4/30',
    icon: Info
  },
  success: { 
    bg: 'bg-primary/10', 
    text: 'text-primary', 
    border: 'border-primary/30',
    icon: CheckCircle2
  },
  warning: { 
    bg: 'bg-chart-2/10', 
    text: 'text-chart-2', 
    border: 'border-chart-2/30',
    icon: AlertCircle
  },
  error: { 
    bg: 'bg-destructive/10', 
    text: 'text-destructive', 
    border: 'border-destructive/30',
    icon: AlertCircle
  },
};

export default function SystemLogs() {
  const { profile, roles, hasRole } = useAuth();
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const userIds = new Set<string>();
      (data || []).forEach(log => {
        if (log.actor_id) userIds.add(log.actor_id);
        if (log.target_user_id) userIds.add(log.target_user_id);
      });

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username')
        .in('user_id', Array.from(userIds));

      const userMap = new Map(profiles?.map(p => [p.user_id, p.username]) || []);

      const logsWithNames = (data || []).map(log => ({
        ...log,
        actor_username: userMap.get(log.actor_id) || 'System',
        target_username: log.target_user_id ? userMap.get(log.target_user_id) || 'Unknown' : null,
      }));

      setLogs(logsWithNames);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  }, [roles]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const toggleExpand = (id: string) => {
    setExpandedLogs(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getLogConfig = (actionType: string) => {
    return ACTION_CONFIG[actionType] || { 
      icon: FileText, 
      level: 'info' as LogLevel, 
      label: actionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) 
    };
  };

  const actionTypes = [...new Set(logs.map(l => l.action_type))];

  const filteredLogs = logs.filter(log => {
    const config = getLogConfig(log.action_type);
    const matchesSearch = 
      log.actor_username?.toLowerCase().includes(search.toLowerCase()) ||
      log.target_username?.toLowerCase().includes(search.toLowerCase()) ||
      log.action_type.toLowerCase().includes(search.toLowerCase()) ||
      JSON.stringify(log.details || {}).toLowerCase().includes(search.toLowerCase());
    const matchesAction = actionFilter === 'all' || log.action_type === actionFilter;
    const matchesLevel = levelFilter === 'all' || config.level === levelFilter;
    
    // Role-based filtering logic mapping
    const isHR = roles.includes('hr');
    const isManager = roles.includes('management');
    const isDev = roles.includes('developer');

    // Group determination
    let logGroup = 'system';
    if (log.action_type.startsWith('hr_') || log.action_type.includes('user_')) logGroup = 'auth';
    if (log.action_type.includes('announcement') || log.action_type.includes('version')) logGroup = 'admin';

    // Can they see this row at all based on tab and role?
    let canViewRow = false;

    if (activeTab === 'auth') {
      canViewRow = (isHR || isManager || isDev) && logGroup === 'auth';
    } else if (activeTab === 'admin') {
      canViewRow = (isManager || isDev) && logGroup === 'admin';
    } else if (activeTab === 'system') {
      canViewRow = isDev; // Only Devs see pure system logs or uncategorized
    } else if (activeTab === 'all') {
      // "All" tab applies role maximum limits
      if (isDev) canViewRow = true;
      else if (isManager) canViewRow = (logGroup === 'auth' || logGroup === 'admin');
      else if (isHR) canViewRow = (logGroup === 'auth');
      else canViewRow = false; // Drivers see nothing
    }

    return matchesSearch && matchesAction && matchesLevel && canViewRow;
  });

  const clearFilters = () => {
    setSearch('');
    setActionFilter('all');
    setLevelFilter('all');
  };

  const hasActiveFilters = search || actionFilter !== 'all' || levelFilter !== 'all';

  const formatDetails = (details: any): { key: string; value: string }[] => {
    if (!details) return [];
    return Object.entries(details).map(([key, value]) => ({
      key: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: typeof value === 'object' ? JSON.stringify(value) : String(value)
    }));
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-6rem)] max-h-[calc(100vh-6rem)]">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
              <Terminal className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">System Logs</h1>
              <p className="text-sm text-muted-foreground">
                {filteredLogs.length} entries • Auto-deleted after 48h
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={fetchLogs} 
              className="gap-2 rounded-lg border-border/50 hover:border-primary/50 hover:bg-primary/5"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>

        {/* Tab System Filter */}
        <div className="mb-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4 max-w-2xl bg-card border border-border/50">
              <TabsTrigger value="all">Recent Global</TabsTrigger>
              <TabsTrigger value="auth" disabled={!roles.some(r => ['developer','management','hr'].includes(r))}>
                 User & HR
              </TabsTrigger>
              <TabsTrigger value="admin" disabled={!roles.some(r => ['developer','management'].includes(r))}>
                Admin
              </TabsTrigger>
              <TabsTrigger value="system" disabled={!roles.includes('developer')}>
                Technical
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-xl bg-card/50 border border-border/50 flex-shrink-0">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Filter size={14} />
            <span className="text-sm font-medium hidden sm:inline">Filters</span>
          </div>
          
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
            <Input
              placeholder="Search logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-8 text-sm bg-background/50 border-border/50 focus:border-primary/50"
            />
          </div>

          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="w-[120px] h-8 text-sm bg-background/50 border-border/50">
              <SelectValue placeholder="Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>

          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[160px] h-8 text-sm bg-background/50 border-border/50">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {actionTypes.map(type => (
                <SelectItem key={type} value={type}>
                  {getLogConfig(type).label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-8 px-2 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
              <span className="ml-1 text-sm">Clear</span>
            </Button>
          )}
        </div>

        {/* Logs Container - Terminal Style */}
        <div className="flex-1 overflow-hidden rounded-xl border border-border/50 bg-black/40 backdrop-blur-sm">
          {/* Terminal Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border/30 bg-card/30">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-destructive/80" />
                <div className="w-3 h-3 rounded-full bg-chart-2/80" />
                <div className="w-3 h-3 rounded-full bg-primary/80" />
              </div>
              <span className="text-xs text-muted-foreground ml-2 font-mono">
                system_logs.audit
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-mono border-primary/30 text-primary">
                LIVE
              </Badge>
            </div>
          </div>

          {/* Logs Content */}
          <div className="h-[calc(100%-2.5rem)] overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground font-mono">Loading logs...</span>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                <Terminal size={48} className="opacity-30" />
                <span className="text-sm font-mono">No logs found</span>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="text-primary">
                    Clear filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="font-mono text-sm">
                {filteredLogs.map((log, index) => {
                  const config = getLogConfig(log.action_type);
                  const levelStyle = LEVEL_STYLES[config.level];
                  const Icon = config.icon;
                  const isExpanded = expandedLogs.has(log.id);
                  const details = formatDetails(log.details);
                  
                  return (
                    <div
                      key={log.id}
                      className={cn(
                        "group border-b border-border/10 hover:bg-white/[0.02] transition-colors",
                        index === 0 && "animate-fade-in"
                      )}
                    >
                      {/* Main Log Row */}
                      <div 
                        className="flex items-start gap-3 px-4 py-3 cursor-pointer"
                        onClick={() => details.length > 0 && toggleExpand(log.id)}
                      >
                        {/* Expand Button */}
                        <button 
                          className={cn(
                            "mt-0.5 p-0.5 rounded transition-colors",
                            details.length > 0 ? "hover:bg-white/10" : "opacity-0"
                          )}
                        >
                          {isExpanded ? (
                            <ChevronDown size={14} className="text-muted-foreground" />
                          ) : (
                            <ChevronRight size={14} className="text-muted-foreground" />
                          )}
                        </button>

                        {/* Timestamp */}
                        <div className="flex items-center gap-1.5 text-muted-foreground shrink-0 w-[140px]">
                          <Clock size={12} />
                          <span className="text-xs">
                            {format(new Date(log.created_at), 'MMM dd HH:mm:ss')}
                          </span>
                        </div>

                        {/* Level Badge */}
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-[10px] uppercase tracking-wider shrink-0 border",
                            levelStyle.bg,
                            levelStyle.text,
                            levelStyle.border
                          )}
                        >
                          {config.level}
                        </Badge>

                        {/* Action Icon & Label */}
                        <div className={cn("flex items-center gap-2 shrink-0", levelStyle.text)}>
                          <Icon size={14} />
                          <span className="font-medium text-xs">
                            {config.label}
                          </span>
                        </div>

                        {/* Actor & Target */}
                        <div className="flex items-center gap-2 flex-1 min-w-0 text-xs">
                          <span className="text-muted-foreground">by</span>
                          <span className="text-chart-4 font-medium truncate">
                            {log.actor_username}
                          </span>
                          {log.target_username && (
                            <>
                              <span className="text-muted-foreground">→</span>
                              <span className="text-chart-3 font-medium truncate">
                                {log.target_username}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Relative Time */}
                        <span className="text-xs text-muted-foreground shrink-0 hidden md:block">
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </span>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && details.length > 0 && (
                        <div className="px-4 pb-3 pl-12 animate-fade-in">
                          <div className="rounded-lg bg-black/30 border border-border/20 p-3 space-y-1.5">
                            {details.map(({ key, value }, i) => (
                              <div key={i} className="flex gap-3 text-xs">
                                <span className="text-muted-foreground shrink-0 w-24">{key}:</span>
                                <span className="text-chart-5 break-all">{value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
