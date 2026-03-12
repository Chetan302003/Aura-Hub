import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useBrightness } from '@/hooks/useBrightness';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { GlassCard } from '@/components/layout/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useUIStore } from '@/stores/appStore';
import { useAutoUpdater } from '@/hooks/useAutoUpdater';
import { isTauri, setAlwaysOnTop, setOverlayMode } from '@/lib/tauri';
import { PageTransition } from '@/components/transitions/PageTransition';
import { 
  User, 
  Mail, 
  Truck,
  Save,
  Loader2,
  Shield,
  Key,
  Sun,
  Moon,
  RotateCcw,
  Bell,
  Layers,
  Monitor,
  Cpu,
  RefreshCw
} from 'lucide-react';

export default function Settings() {
  const { user, profile, roles } = useAuth();
  const { brightness, setBrightness, resetBrightness, MIN_BRIGHTNESS, MAX_BRIGHTNESS } = useBrightness();
  const [loading, setLoading] = useState(false);
  const [tmpId, setTmpId] = useState(profile?.tmp_id || '');
  const { toast } = useToast();
  const { isChecking, checkForUpdates } = useAutoUpdater();
  
  // Zustand store for UI settings
  const { 
    notificationsEnabled, 
    setNotificationsEnabled,
    overlayMode,
    setOverlayMode: setOverlayModeStore,
    alwaysOnTop,
    setAlwaysOnTop: setAlwaysOnTopStore
  } = useUIStore();

  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setIsDesktop(isTauri());
  }, []);

  const handleUpdateProfile = async () => {
    if (!user) return;

    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ tmp_id: tmpId || null })
      .eq('user_id', user.id);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } else {
      toast({
        title: 'Profile Updated',
        description: 'Your settings have been saved.',
      });
    }
    setLoading(false);
  };

  const handleNotificationToggle = async (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    
    if (enabled && 'Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setNotificationsEnabled(false);
        toast({
          variant: 'destructive',
          title: 'Permission Denied',
          description: 'Please enable notifications in your browser settings.',
        });
      }
    }
  };
// HANDLER: Always on Top (Actually triggers Windows behavior)
  const handleAlwaysOnTopToggle = async (enabled: boolean) => {
    setAlwaysOnTopStore(enabled);
    if (isTauri()) {
    await setAlwaysOnTop(enabled);
    toast({
      title: enabled ? 'Always on Top Enabled' : 'Always on Top Disabled',
      description: enabled ? 'Hub will stay above other windows.' : 'Hub will behave normally.',
    });
  }
  };
// HANDLER: Overlay Mode (Triggers layout change)
  const handleOverlayModeToggle = async (enabled: boolean) => {
    setOverlayModeStore(enabled);
    if (isTauri()) {
    await setOverlayMode(enabled);
    toast({
      title: enabled ? 'Overlay Mode Enabled' : 'Overlay Mode Disabled',
      description: enabled ? 'Compact mode for gaming.' : 'Full window mode.',
    });
  }
  };

  return (
    <AppLayout>
      <PageTransition>
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Settings</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage your account and app preferences</p>
          </div>

          {/* Profile Info */}
          <GlassCard className="transition-all duration-200 hover:border-primary/30">
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <User size={20} className="text-primary" />
              Profile Information
            </h3>

            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-2xl sm:text-3xl neon-pulse">
                  {profile?.username?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-lg sm:text-xl font-semibold truncate">{profile?.username}</p>
                  <p className="text-muted-foreground text-sm truncate">{profile?.email}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2 text-sm">
                  <Mail size={14} />
                  Email Address
                </Label>
                <Input
                  id="email"
                  value={profile?.email || ''}
                  disabled
                  className="glass-input opacity-60"
                />
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tmpId" className="flex items-center gap-2 text-sm">
                  <Truck size={14} />
                  TruckersMP ID
                </Label>
                <Input
                  id="tmpId"
                  placeholder="Your TMP ID for avatar"
                  value={tmpId}
                  onChange={(e) => setTmpId(e.target.value)}
                  className="glass-input"
                />
                <p className="text-xs text-muted-foreground">
                  Used to fetch your TruckersMP profile avatar
                </p>
              </div>

              <Button
                onClick={handleUpdateProfile}
                disabled={loading}
                className="rounded-full neon-glow w-full sm:w-auto"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          </GlassCard>

          {/* Notifications */}
          <GlassCard className="transition-all duration-200 hover:border-primary/30">
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Bell size={20} className="text-primary" />
              Notifications
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30">
                <div className="flex-1 min-w-0 mr-4">
                  <p className="font-medium text-sm">Event Reminders</p>
                  <p className="text-xs text-muted-foreground">Get notified before events start</p>
                </div>
                <Switch
                  checked={notificationsEnabled}
                  onCheckedChange={handleNotificationToggle}
                />
              </div>

              <p className="text-xs text-muted-foreground px-1">
                Reminders at 30, 15, 5, and 1 minute before event start
              </p>
            </div>
          </GlassCard>

          {/* Desktop App Settings (Tauri) */}
          {isDesktop && (
            <GlassCard className="transition-all duration-200 hover:border-primary/30">
              <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <Monitor size={20} className="text-primary" />
                Desktop App (Overlay)
              </h3>

              <div className="space-y-4">
                {/* Row 1: Always on Top */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30">
                  <div className="flex-1 min-w-0 mr-4">
                    <p className="font-medium text-sm">Always on Top</p>
                    <p className="text-xs text-muted-foreground">Keep hub above other windows</p>
                  </div>
                  <Switch
                    checked={alwaysOnTop}
                    onCheckedChange={handleAlwaysOnTopToggle}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30">
                  <div className="flex-1 min-w-0 mr-4">
                    <p className="font-medium text-sm">Overlay Mode</p>
                    <p className="text-xs text-muted-foreground">Compact view for gaming</p>
                  </div>
                  <Switch
                    checked={overlayMode}
                    onCheckedChange={handleOverlayModeToggle}
                  />
                </div>
              </div>
            </GlassCard>
          )}

          {/* Software Updates */}
          {isDesktop && (
            <GlassCard className="transition-all duration-200 hover:border-primary/30 bg-primary/5">
              <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <RefreshCw size={20} className="text-primary" />
                Software Updates
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30">
                  <div className="flex-1 min-w-0 mr-4">
                    <p className="font-medium text-sm">App Version</p>
                    <p className="text-xs text-muted-foreground">Check for the latest features</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => checkForUpdates(true)}
                    disabled={isChecking}
                    className="rounded-full border-primary/30 hover:bg-primary/20"
                  >
                    {isChecking ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw size={14} className="mr-2" />
                    )}
                    Check for Updates
                  </Button>
                </div>
              </div>
            </GlassCard>
          )}

          {/* Display Settings */}
          <GlassCard className="transition-all duration-200 hover:border-primary/30">
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Sun size={20} className="text-primary" />
              Display Settings
            </h3>

            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2 text-sm">
                    <Moon size={14} className="text-muted-foreground" />
                    Brightness
                    <Sun size={14} className="text-muted-foreground" />
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-12 text-right">
                      {Math.round(brightness * 100)}%
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetBrightness}
                      className="h-8 w-8 p-0"
                      title="Reset to default"
                    >
                      <RotateCcw size={14} />
                    </Button>
                  </div>
                </div>
                <Slider
                  value={[brightness]}
                  onValueChange={([value]) => setBrightness(value)}
                  min={MIN_BRIGHTNESS}
                  max={MAX_BRIGHTNESS}
                  step={0.05}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Adjust the overall brightness of the interface
                </p>
              </div>
            </div>
          </GlassCard>

          {/* Account Status */}
          <GlassCard className="transition-all duration-200 hover:border-primary/30">
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Shield size={20} className="text-primary" />
              Account Status
            </h3>

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 p-4 rounded-xl bg-muted/30">
                <div>
                  <p className="font-medium text-sm">Approval Status</p>
                  <p className="text-xs text-muted-foreground">Your account verification status</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium w-fit ${
                  profile?.approval_status === 'approved' 
                    ? 'bg-primary/20 text-primary'
                    : profile?.approval_status === 'pending'
                    ? 'bg-amber-500/20 text-amber-500'
                    : 'bg-destructive/20 text-destructive'
                }`}>
                  {profile?.approval_status || 'pending'}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 p-4 rounded-xl bg-muted/30">
                <div>
                  <p className="font-medium text-sm">Role</p>
                  <p className="text-xs text-muted-foreground">Your assigned role in the VTC</p>
                </div>
                <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-medium w-fit">
                  {roles[0]?.replace('_', ' ').toUpperCase() || 'DRIVER'}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 p-4 rounded-xl bg-muted/30">
                <div>
                  <p className="font-medium text-sm">Member Since</p>
                  <p className="text-xs text-muted-foreground">Account creation date</p>
                </div>
                <span className="text-muted-foreground text-xs">
                  {profile?.created_at 
                    ? new Date(profile.created_at).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      })
                    : '—'}
                </span>
              </div>
            </div>
          </GlassCard>

          {/* Performance Info */}
          <GlassCard className="transition-all duration-200 hover:border-primary/30">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Cpu size={20} className="text-primary" />
              Performance
            </h3>

            <div className="p-4 rounded-xl bg-muted/30">
              <p className="text-xs text-muted-foreground leading-relaxed">
                This app is optimized for low resource usage with ~40MB RAM footprint. 
                Uses CSS transforms for GPU-accelerated animations and virtual lists 
                to prevent memory bloat. Safe to run alongside ETS2/ATS.
              </p>
            </div>
          </GlassCard>

          {/* Security */}
          <GlassCard className="transition-all duration-200 hover:border-primary/30">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Key size={20} className="text-primary" />
              Security
            </h3>

            <div className="p-4 rounded-xl bg-muted/30">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Password changes and account security settings can be managed through the HR team. 
                Contact an administrator if you need to update your credentials.
              </p>
            </div>
          </GlassCard>
        </div>
      </PageTransition>
    </AppLayout>
  );
}