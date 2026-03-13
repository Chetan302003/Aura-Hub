import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { GlassCard } from '@/components/layout/GlassCard';
import { TelemetryPanel } from '@/components/telemetry/TelemetryPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTelemetry, useAutoJobLogger } from '@/hooks/useTelemetry';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '@/lib/tauri';
import {
  Activity,
  Truck,
  Package,
  ArrowRight,
  CheckCircle,
  Zap,
  AlertTriangle,
  MapPin,
  DollarSign,
  Fuel,
  Gauge
} from 'lucide-react';

/**
 * Telemetry Dashboard Page
 * 
 * TAURI CONVERSION NOTES:
 * -----------------------
 * This page works the same in Tauri desktop app.
 * The telemetry hooks handle the data source abstraction.
 */
// export default function Telemetry() {
//   const { user, isApproved } = useAuth();
//   const navigate = useNavigate();
//   const { data, connected, isJobActive } = useTelemetry();
//   const { prepareJobData, currentJob, truckData } = useAutoJobLogger();
//   const [autoLogEnabled, setAutoLogEnabled] = useState(true);
//   const [saving, setSaving] = useState(false);

//   const handleAutoLogJob = async () => {
//     if (!user || !isApproved) {
//       toast.error('You must be approved to log jobs');
//       return;
//     }

//     const jobData = prepareJobData();
//     if (!jobData) {
//       toast.error('No active job data to log');
//       return;
//     }

//     setSaving(true);
//     try {
//       const { error } = await supabase.from('job_logs').insert({
//         user_id: user.id,
//         origin_city: jobData.origin_city,
//         destination_city: jobData.destination_city,
//         distance_km: jobData.distance_km,
//         cargo_type: jobData.cargo_type,
//         cargo_weight: jobData.cargo_weight,
//         fuel_consumed: jobData.fuel_consumed,
//         income: jobData.income,
//         damage_percent: jobData.damage_percent,
//         delivery_date: new Date().toISOString(),
//         notes: 'Auto-logged from telemetry',
//       });

//       if (error) throw error;
//       toast.success('Job logged from telemetry!');
//     } catch (err) {
//       console.error('Auto-log error:', err);
//       toast.error('Failed to auto-log job');
//     } finally {
//       setSaving(false);
//     }
//   };

//   const handleFillForm = () => {
//     const jobData = prepareJobData();
//     if (!jobData) {
//       toast.error('No active job data');
//       return;
//     }
//     // Navigate to log job page with telemetry data
//     navigate('/log-job', { state: { telemetryData: jobData } });
//   };

//   return (
//     <AppLayout>
//       <div className="space-y-6">
//         {/* Header */}
//         <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
//           <div>
//             <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
//               <Activity size={32} className="text-primary" />
//               Telemetry
//             </h1>
//             <p className="text-muted-foreground mt-1">
//               Real-time truck data & auto job logging
//             </p>
//           </div>

//           <div className="flex items-center gap-3">
//             <Badge 
//               variant="outline" 
//               className={connected 
//                 ? 'bg-primary/20 text-primary border-primary/40' 
//                 : 'bg-muted text-muted-foreground'
//               }
//             >
//               {connected ? (
//                 <>
//                   <div className="w-2 h-2 rounded-full bg-primary mr-2 animate-pulse" />
//                   Connected
//                 </>
//               ) : (
//                 'Disconnected'
//               )}
//             </Badge>
//           </div>
//         </div>

//         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
//           {/* Main Telemetry Panel */}
//           <div className="lg:col-span-2">
//             <TelemetryPanel />
//           </div>

//           {/* Auto-Log Panel */}
//           <div className="space-y-4">
//             <GlassCard>
//               <div className="flex items-center gap-3 mb-4">
//                 <div className="p-2 rounded-lg bg-accent/20">
//                   <Zap size={20} className="text-accent" />
//                 </div>
//                 <div>
//                   <h3 className="font-semibold">Auto Job Logger</h3>
//                   <p className="text-xs text-muted-foreground">
//                     Automatically fill or log jobs from telemetry
//                   </p>
//                 </div>
//               </div>

//               {!connected ? (
//                 <div className="text-center py-6 text-muted-foreground">
//                   <AlertTriangle size={32} className="mx-auto mb-2 opacity-50" />
//                   <p className="text-sm">Connect telemetry to use auto-logging</p>
//                 </div>
//               ) : !isJobActive ? (
//                 <div className="text-center py-6 text-muted-foreground">
//                   <Package size={32} className="mx-auto mb-2 opacity-50" />
//                   <p className="text-sm">No active job detected</p>
//                   <p className="text-xs mt-1">Accept a job in-game to enable auto-logging</p>
//                 </div>
//               ) : (
//                 <div className="space-y-4">
//                   {/* Current Job Preview */}
//                   <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 space-y-2">
//                     <div className="flex items-center gap-2 text-sm">
//                       <MapPin size={14} className="text-primary" />
//                       <span className="truncate">{currentJob?.sourceCity}</span>
//                       <ArrowRight size={14} className="text-muted-foreground" />
//                       <span className="truncate">{currentJob?.destinationCity}</span>
//                     </div>
//                     <div className="grid grid-cols-2 gap-2 text-xs">
//                       <div className="flex items-center gap-1">
//                         <Package size={12} className="text-muted-foreground" />
//                         <span className="truncate">{currentJob?.cargo}</span>
//                       </div>
//                       <div className="flex items-center gap-1">
//                         <DollarSign size={12} className="text-muted-foreground" />
//                         <span>${currentJob?.income?.toLocaleString()}</span>
//                       </div>
//                     </div>
//                   </div>

//                   {/* Action Buttons */}
//                   <div className="space-y-2">
//                     <Button
//                       onClick={handleFillForm}
//                       variant="outline"
//                       className="w-full rounded-full gap-2"
//                     >
//                       <Truck size={16} />
//                       Fill Job Form
//                     </Button>
//                     <Button
//                       onClick={handleAutoLogJob}
//                       disabled={saving || !isApproved}
//                       className="w-full rounded-full neon-glow gap-2"
//                     >
//                       {saving ? (
//                         <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
//                       ) : (
//                         <CheckCircle size={16} />
//                       )}
//                       Auto-Log Now
//                     </Button>
//                   </div>

//                   {!isApproved && (
//                     <p className="text-xs text-center text-warning">
//                       Account must be approved to log jobs
//                     </p>
//                   )}
//                 </div>
//               )}
//             </GlassCard>

//             {/* Quick Stats */}
//             {connected && (
//               <GlassCard>
//                 <h4 className="font-semibold mb-3 flex items-center gap-2">
//                   <Gauge size={16} className="text-primary" />
//                   Quick Stats
//                 </h4>
//                 <div className="grid grid-cols-2 gap-3">
//                   <div className="p-3 rounded-xl bg-muted/30 text-center">
//                     <p className="text-2xl font-bold text-primary">
//                       {Math.round(truckData.speed)}
//                     </p>
//                     <p className="text-xs text-muted-foreground">km/h</p>
//                   </div>
//                   <div className="p-3 rounded-xl bg-muted/30 text-center">
//                     <p className="text-2xl font-bold text-primary">
//                       {Math.round(truckData.fuel)}
//                     </p>
//                     <p className="text-xs text-muted-foreground">L Fuel</p>
//                   </div>
//                   <div className="p-3 rounded-xl bg-muted/30 text-center">
//                     <p className="text-2xl font-bold">
//                       {Math.round(truckData.odometer).toLocaleString()}
//                     </p>
//                     <p className="text-xs text-muted-foreground">km Total</p>
//                   </div>
//                   <div className="p-3 rounded-xl bg-muted/30 text-center">
//                     <p className="text-2xl font-bold">
//                       {data.game.game.toUpperCase()}
//                     </p>
//                     <p className="text-xs text-muted-foreground">Game</p>
//                   </div>
//                 </div>
//               </GlassCard>
//             )}

//             {/* Setup Info */}
//             <GlassCard className="text-center p-4">
//               <h4 className="font-semibold text-sm mb-2">Telemetry Setup</h4>
//               <p className="text-xs text-muted-foreground mb-3">
//                 For auto-logging, install a telemetry server plugin for ETS2/ATS
//               </p>
//               <div className="text-xs text-muted-foreground space-y-1">
//                 <p>• scs-sdk-plugin (WebSocket)</p>
//                 <p>• trucksim-telemetry-server (HTTP)</p>
//                 <p>• Default port: 25555</p>
//               </div>
//             </GlassCard>
//           </div>
//         </div>
//       </div>
//     </AppLayout>
//   );
// }
// ... keep your imports ...

export default function Telemetry() {
  const { user, isApproved } = useAuth();
  const navigate = useNavigate();
  const { data, connected, isJobActive } = useTelemetry();
  const { prepareJobData, currentJob, truckData, jobJustFinished } = useAutoJobLogger();
  const [saving, setSaving] = useState(false);

  const handleAutoLogJob = useCallback(async () => {
    if (!user || !isApproved) {
      toast.error('You must be approved to log jobs');
      return;
    }

    const jobData = prepareJobData();
    if (!jobData) {
      toast.error('No active job data to log');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('job_logs').upsert({
        user_id: user.id,
        job_id: jobData.job_id,
        origin_city: jobData.origin_city,
        destination_city: jobData.destination_city,
        planned_distance_km: jobData.planned_distance_km,
        distance_km: jobData.distance_km,
        cargo_type: String(jobData.cargo_type || 'General Cargo'),
        cargo_weight: jobData.cargo_weight,
        fuel_consumed: jobData.fuel_consumed,
        income: jobData.income,
        damage_percent: jobData.damage_percent,
        status: jobData.status,
        expenses: jobData.expenses, 
        delivery_date: new Date().toISOString(),
        notes: `Auto-logged from Aura Hub`,
      }, { onConflict: "user_id,job_id" });

      if (error) throw error;
      toast.success(`Job ${jobData.status}: ${jobData.origin_city} → ${jobData.destination_city}`);
    } catch (err) {
      console.error('Auto-log error:', err);
      toast.error('Failed to auto-log job. Please ensure database schema is updated.');
    } finally {
      setSaving(false);
    }
  }, [user, isApproved, prepareJobData]);

  // Handle Automatic Logging when the job completes
  useEffect(() => {
    if (jobJustFinished) {
      handleAutoLogJob();
    }
  }, [jobJustFinished, handleAutoLogJob]);

  const handleFillForm = () => {
    const jobData = prepareJobData();
    if (!jobData) {
      toast.error('No active job data');
      return;
    }
    navigate('/log-job', { state: { telemetryData: jobData } });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header - Stays the same as your code */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
              <Activity size={32} className="text-primary" />
              Aura Hub Live
            </h1>
            <p className="text-muted-foreground mt-1">
              {connected ? `${data.truck.make} ${data.truck.model} is active` : 'Waiting for connection...'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className={connected
                ? 'bg-primary/20 text-primary border-primary/40'
                : 'bg-muted text-muted-foreground'
              }
            >
              {connected ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-primary mr-2 animate-pulse" />
                  Live Sync
                </>
              ) : 'System Offline'}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <TelemetryPanel />
          </div>

          <div className="space-y-4">
            {/* Auto-Log Card - Fixed mapping for CurrentJob */}
            <GlassCard className="relative overflow-hidden">
              {/* Animated Background Pulse if Job is Active */}
              {isJobActive && <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 animate-pulse" />}

              <div className="flex items-center gap-3 mb-4 relative z-10">
                <div className="p-2 rounded-lg bg-accent/20">
                  <Zap size={20} className="text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold">VTC Auto-Logger</h3>
                  <p className="text-xs text-muted-foreground">Direct-to-Database Sync</p>
                </div>
              </div>

              {!connected ? (
                <div className="text-center py-6 text-muted-foreground">
                  <AlertTriangle size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium">Connect Game to Log</p>
                </div>
              ) : !isJobActive ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Package size={32} className="mx-auto mb-2 opacity-50 text-primary/40" />
                  <p className="text-sm">Ready for next assignment</p>
                </div>
              ) : (
                <div className="space-y-4 relative z-10">
                  <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-bold">
                      <MapPin size={14} className="text-primary" />
                      <span className="truncate">{currentJob?.sourceCity || 'Unknown'}</span>
                      <ArrowRight size={14} className="text-muted-foreground" />
                      <span className="truncate">{currentJob?.destinationCity || 'Pending'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Package size={10} />
                        <span className="truncate">{typeof currentJob?.cargo === 'object'
                          ? currentJob.cargo.name
                          : (currentJob?.cargo || 'No Cargo')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign size={10} />
                        <span>${currentJob?.income?.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Button onClick={handleFillForm} variant="outline" className="w-full rounded-full gap-2 border-primary/30 hover:bg-primary/5">
                      <Truck size={16} /> Fill Job Form
                    </Button>
                    <Button onClick={handleAutoLogJob} disabled={saving || !isApproved} className="w-full rounded-full neon-glow gap-2">
                      {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle size={16} />}
                      Log to Aura VTC
                    </Button>
                  </div>
                </div>
              )}
            </GlassCard>

            {/* Quick Stats - Updated to match v1.2.0 logic */}
            <GlassCard className={!connected ? "opacity-50 grayscale" : ""}>
              <h4 className="font-semibold mb-3 flex items-center gap-2 text-sm uppercase tracking-widest text-primary/70">
                <Gauge size={14} /> Telemetry Data
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <StatMini value={Math.round(truckData.speed)} label="km/h" />
                <StatMini value={Math.round(truckData.fuel)} label="Liters" />
                <StatMini value={Math.round(truckData.odometer).toLocaleString()} label="Total km" />
                <StatMini value={data.game.game === 'unknown' ? 'N/A' : data.game.game.toUpperCase()} label="Engine" />
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

// Sub-component for clean mapping
function StatMini({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="p-3 rounded-xl bg-muted/20 border border-white/5 text-center">
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="text-[10px] uppercase text-muted-foreground font-semibold">{label}</p>
    </div>
  );
}