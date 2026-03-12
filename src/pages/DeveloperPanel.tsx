import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTruckersMP, TMPEvent, TMPServer } from '@/hooks/useTruckersMP';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { GlassCard, StatCard } from '@/components/layout/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAutoUpdater } from '@/hooks/useAutoUpdater';
import { isTauri } from '@tauri-apps/api/core';
import {
  Code,
  Upload,
  Server,
  Database,
  Users,
  Activity,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Rocket,
  Globe,
  Wifi,
  WifiOff,
  Calendar,
  MapPin,
  RefreshCw,
  Trash2,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';

interface AppVersion {
  current: string;
  latest: string;
}

export default function DeveloperPanel() {
  const [version, setVersion] = useState<AppVersion | null>(null);
  const [newVersion, setNewVersion] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    pendingUsers: 0,
    totalJobs: 0,
    totalLogs: 0,
  });
  const [systemHealth, setSystemHealth] = useState({
    database: { status: 'checking', latency: 0 },
    auth: { status: 'checking' },
    edgeFunctions: { status: 'checking' },
  });
  const [tmpEvents, setTmpEvents] = useState<TMPEvent[]>([]);
  const [tmpServers, setTmpServers] = useState<TMPServer[]>([]);
  const [tmpLoading, setTmpLoading] = useState(false);

  const { user, hasRole } = useAuth();
  const { getEvents, getServers } = useTruckersMP();
  const { toast } = useToast();
  const { isChecking, checkForUpdates } = useAutoUpdater();
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setIsDesktop(isTauri());
  }, []);

  const isDeveloper = hasRole('developer');

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: versionData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'version')
        .single();

      if (versionData?.value) {
        setVersion(versionData.value as unknown as AppVersion);
      }

      const [
        { count: totalUsers },
        { count: pendingUsers },
        { count: totalJobs },
        { count: totalLogs },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('approval_status', 'pending'),
        supabase.from('job_logs').select('*', { count: 'exact', head: true }),
        supabase.from('system_logs').select('*', { count: 'exact', head: true }),
      ]);

      setStats({
        totalUsers: totalUsers || 0,
        pendingUsers: pendingUsers || 0,
        totalJobs: totalJobs || 0,
        totalLogs: totalLogs || 0,
      });
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkSystemHealth = async () => {
    // Check database
    const dbStart = Date.now();
    try {
      await supabase.from('profiles').select('id').limit(1);
      setSystemHealth(prev => ({
        ...prev,
        database: { status: 'connected', latency: Date.now() - dbStart }
      }));
    } catch {
      setSystemHealth(prev => ({ ...prev, database: { status: 'error', latency: 0 } }));
    }

    // Check auth
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setSystemHealth(prev => ({
        ...prev,
        auth: { status: session ? 'active' : 'no_session' }
      }));
    } catch {
      setSystemHealth(prev => ({ ...prev, auth: { status: 'error' } }));
    }

    // Check edge functions
    try {
      const { data, error } = await supabase.functions.invoke('tmp-servers', {});
      setSystemHealth(prev => ({
        ...prev,
        edgeFunctions: { status: error ? 'error' : 'ready' }
      }));
    } catch {
      setSystemHealth(prev => ({ ...prev, edgeFunctions: { status: 'error' } }));
    }
  };

  const fetchTMPData = async () => {
    setTmpLoading(true);
    try {
      const [events, servers] = await Promise.all([
        getEvents(),
        getServers(),
      ]);
      setTmpEvents(events);
      setTmpServers(servers);
      toast({ title: 'TMP Data Loaded', description: `${events.length} events, ${servers.length} servers` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch TruckersMP data' });
    } finally {
      setTmpLoading(false);
    }
  };

  useEffect(() => {
    if (isDeveloper) {
      fetchData();
      checkSystemHealth();
    }
  }, [isDeveloper]);

  const handlePushUpdate = async () => {
    if (!newVersion.match(/^\d+\.\d+\.\d+$/)) {
      toast({
        variant: 'destructive',
        title: 'Invalid Version',
        description: 'Version must be in format X.Y.Z (e.g., 1.0.1)',
      });
      return;
    }

    setLoading(true);
    try {
      // Check if version record exists
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', 'version')
        .single();

      if (existing) {
        const { error } = await supabase
          .from('app_settings')
          .update({
            value: { current: version?.current || '1.0.0', latest: newVersion },
            updated_by: user?.id,
          })
          .eq('key', 'version');
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('app_settings')
          .insert({
            key: 'version',
            value: { current: '1.0.0', latest: newVersion },
            updated_by: user?.id,
          });
        if (error) throw error;
      }

      await supabase.from('system_logs').insert({
        actor_id: user?.id,
        action_type: 'version_pushed',
        details: { new_version: newVersion, old_version: version?.latest },
      });

      toast({
        title: 'Update Pushed!',
        description: `Version ${newVersion} is now available. Users will be notified on login.`,
      });

      setVersion(prev => prev ? { ...prev, latest: newVersion } : { current: '1.0.0', latest: newVersion });
      setNewVersion('');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOldLogs = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('delete_old_system_logs');
      if (error) throw error;

      toast({ title: 'Logs Cleaned', description: 'Old system logs have been deleted.' });
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setLoading(false);
    }
  };

  if (!isDeveloper) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <GlassCard className="max-w-md text-center">
            <AlertTriangle size={48} className="mx-auto text-warning mb-4" />
            <h2 className="text-xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              Only developers can access this panel.
            </p>
          </GlassCard>
        </div>
      </AppLayout>
    );
  }

  const onlineServers = tmpServers.filter(s => s.online);
  const totalPlayers = tmpServers.reduce((sum, s) => sum + s.players, 0);

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold gradient-text">Developer Panel</h1>
          <p className="text-muted-foreground mt-1">System management, updates, and monitoring</p>
        </div>

        {/* Version Control */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <GlassCard>
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 rounded-full bg-primary/20 text-primary">
                <Rocket size={24} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Version Control</h3>
                <p className="text-sm text-muted-foreground">Manage app versions</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 rounded-xl bg-muted/30">
                <span className="text-muted-foreground">Current Version</span>
                <span className="font-mono text-primary">{version?.current || '1.0.0'}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-xl bg-muted/30">
                <span className="text-muted-foreground">Latest Version</span>
                <span className="font-mono text-primary">{version?.latest || '1.0.0'}</span>
              </div>

              {version?.current !== version?.latest && (
                <div className="p-3 rounded-xl bg-warning/20 text-warning text-sm">
                  <AlertTriangle size={16} className="inline mr-2" />
                  Update available! Users will be notified on login.
                </div>
              )}

              {isDesktop && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => checkForUpdates(true)}
                  disabled={isChecking}
                  className="w-full mt-2 rounded-full border-primary/30 hover:bg-primary/20"
                >
                  {isChecking ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw size={14} className="mr-2" />
                  )}
                  Check for Updates
                </Button>
              )}
            </div>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 rounded-full bg-primary/20 text-primary">
                <Upload size={24} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Push Update</h3>
                <p className="text-sm text-muted-foreground">Release new version to all users</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newVersion">New Version Number</Label>
                <Input
                  id="newVersion"
                  placeholder="e.g., 1.0.1"
                  value={newVersion}
                  onChange={(e) => setNewVersion(e.target.value)}
                  className="glass-input font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Format: X.Y.Z (semantic versioning). Users will see update notification on next login.
                </p>
              </div>
              <Button
                onClick={handlePushUpdate}
                disabled={loading || !newVersion}
                className="w-full rounded-full neon-glow"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Rocket className="w-4 h-4 mr-2" />
                )}
                Push Update
              </Button>
            </div>
          </GlassCard>
        </div>

        {/* System Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Users"
            value={stats.totalUsers}
            icon={<Users size={24} />}
          />
          <StatCard
            title="Pending Approvals"
            value={stats.pendingUsers}
            icon={<AlertTriangle size={24} />}
          />
          <StatCard
            title="Total Jobs Logged"
            value={stats.totalJobs}
            icon={<Database size={24} />}
          />
          <StatCard
            title="System Logs"
            value={stats.totalLogs}
            icon={<Activity size={24} />}
            subtitle={
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteOldLogs}
                className="text-xs p-0 h-auto text-muted-foreground hover:text-destructive"
              >
                <Trash2 size={12} className="mr-1" /> Clean old logs
              </Button>
            }
          />
        </div>

        {/* System Health */}
        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Server size={20} className="text-primary" />
              System Health
            </h3>
            <Button variant="ghost" size="sm" onClick={checkSystemHealth}>
              <RefreshCw size={16} className="mr-2" />
              Refresh
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/30">
              {systemHealth.database.status === 'connected' ? (
                <CheckCircle className="text-primary" size={24} />
              ) : systemHealth.database.status === 'checking' ? (
                <Loader2 className="text-muted-foreground animate-spin" size={24} />
              ) : (
                <AlertTriangle className="text-destructive" size={24} />
              )}
              <div>
                <p className="font-medium">Database</p>
                <p className="text-sm text-muted-foreground">
                  {systemHealth.database.status === 'connected'
                    ? `Connected (${systemHealth.database.latency}ms)`
                    : systemHealth.database.status}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/30">
              {systemHealth.auth.status === 'active' ? (
                <CheckCircle className="text-primary" size={24} />
              ) : systemHealth.auth.status === 'checking' ? (
                <Loader2 className="text-muted-foreground animate-spin" size={24} />
              ) : (
                <AlertTriangle className="text-warning" size={24} />
              )}
              <div>
                <p className="font-medium">Authentication</p>
                <p className="text-sm text-muted-foreground capitalize">{systemHealth.auth.status.replace('_', ' ')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/30">
              {systemHealth.edgeFunctions.status === 'ready' ? (
                <CheckCircle className="text-primary" size={24} />
              ) : systemHealth.edgeFunctions.status === 'checking' ? (
                <Loader2 className="text-muted-foreground animate-spin" size={24} />
              ) : (
                <AlertTriangle className="text-destructive" size={24} />
              )}
              <div>
                <p className="font-medium">Edge Functions</p>
                <p className="text-sm text-muted-foreground capitalize">{systemHealth.edgeFunctions.status}</p>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* TruckersMP API Integration */}
        <GlassCard>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/20 text-primary">
                <Globe size={24} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">TruckersMP API Integration</h3>
                <p className="text-sm text-muted-foreground">Live data from TruckersMP servers</p>
              </div>
            </div>
            <Button onClick={fetchTMPData} disabled={tmpLoading} variant="outline" className="rounded-full">
              {tmpLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw size={16} className="mr-2" />}
              Fetch Data
            </Button>
          </div>

          {tmpServers.length > 0 && (
            <div className="space-y-6">
              {/* Server Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-muted/30 text-center">
                  <p className="text-2xl font-bold text-primary">{tmpServers.length}</p>
                  <p className="text-sm text-muted-foreground">Total Servers</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/30 text-center">
                  <p className="text-2xl font-bold text-primary">{onlineServers.length}</p>
                  <p className="text-sm text-muted-foreground">Online</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/30 text-center">
                  <p className="text-2xl font-bold text-primary">{totalPlayers}</p>
                  <p className="text-sm text-muted-foreground">Total Players</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/30 text-center">
                  <p className="text-2xl font-bold text-primary">{tmpEvents.length}</p>
                  <p className="text-sm text-muted-foreground">Upcoming Events</p>
                </div>
              </div>

              {/* Servers List */}
              <div>
                <h4 className="font-medium mb-3">Live Servers</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                  {tmpServers.slice(0, 12).map(server => (
                    <div key={server.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/20">
                      {server.online ? (
                        <Wifi className="text-primary" size={18} />
                      ) : (
                        <WifiOff className="text-destructive" size={18} />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{server.name}</p>
                        <p className="text-xs text-muted-foreground">{server.players}/{server.maxplayers} players</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Upcoming Events */}
              {tmpEvents.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Upcoming Events</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {tmpEvents.slice(0, 5).map(event => (
                      <div key={event.id} className="flex items-center gap-4 p-3 rounded-xl bg-muted/20">
                        <Calendar className="text-primary shrink-0" size={18} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{event.name || 'Unknown'}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <MapPin size={12} />
                            <span>{event.departure?.city || '?'} → {event.arrive?.city || '?'}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-primary">{event.startAt ? format(new Date(event.startAt), 'MMM dd') : 'TBA'}</p>
                          <p className="text-xs text-muted-foreground">{event.attendances?.confirmed || 0} confirmed</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tmpServers.length === 0 && !tmpLoading && (
            <div className="p-6 rounded-xl border border-dashed border-border/50 text-center">
              <Code size={48} className="mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground mb-2">Click "Fetch Data" to load TruckersMP data</p>
              <p className="text-sm text-muted-foreground">
                This will fetch live server status and upcoming events from the TruckersMP API.
              </p>
            </div>
          )}
        </GlassCard>

        {/* Logs Auto-Delete Info */}
        <GlassCard>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-warning/20 text-warning">
              <Clock size={24} />
            </div>
            <div>
              <h3 className="font-semibold">Automatic Log Cleanup</h3>
              <p className="text-sm text-muted-foreground">
                System logs older than 2 days are automatically deleted to keep the database lean.
                You can manually trigger cleanup using the "Clean old logs" button above.
              </p>
            </div>
          </div>
        </GlassCard>
      </div>
    </AppLayout>
  );
}
