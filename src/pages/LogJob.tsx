import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { GlassCard } from '@/components/layout/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Truck, 
  MapPin, 
  Package, 
  Fuel, 
  DollarSign, 
  AlertTriangle,
  Calendar,
  Loader2,
  CheckCircle,
  Zap,
  Activity
} from 'lucide-react';
import { Link } from 'react-router-dom';

const jobSchema = z.object({
  origin_city: z.string().min(2, 'Origin city is required'),
  destination_city: z.string().min(2, 'Destination city is required'),
  distance_km: z.coerce.number().min(1, 'Distance must be at least 1 km'),
  cargo_type: z.string().optional(),
  cargo_weight: z.coerce.number().optional(),
  fuel_consumed: z.coerce.number().optional(),
  income: z.coerce.number().min(0, 'Income cannot be negative'),
  expenses: z.coerce.number().optional(),
  damage_percent: z.coerce.number().min(0).max(100).optional(),
  delivery_date: z.string().optional(),
  notes: z.string().optional(),
});

type JobForm = z.infer<typeof jobSchema>;

interface TelemetryJobData {
  origin_city: string;
  destination_city: string;
  distance_km: number;
  cargo_type: string;
  cargo_weight: number;
  fuel_consumed: number;
  income: number;
  damage_percent: number;
}

export default function LogJob() {
  const [loading, setLoading] = useState(false);
  const [telemetryFilled, setTelemetryFilled] = useState(false);
  const { user, isApproved } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const form = useForm<JobForm>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      origin_city: '',
      destination_city: '',
      distance_km: 0,
      cargo_type: '',
      cargo_weight: 0,
      fuel_consumed: 0,
      income: 0,
      expenses: 0,
      damage_percent: 0,
      delivery_date: new Date().toISOString().split('T')[0],
      notes: '',
    },
  });

  // Check for telemetry data passed from Telemetry page
  useEffect(() => {
    const telemetryData = location.state?.telemetryData as TelemetryJobData | undefined;
    if (telemetryData) {
      form.setValue('origin_city', telemetryData.origin_city || '');
      form.setValue('destination_city', telemetryData.destination_city || '');
      form.setValue('distance_km', telemetryData.distance_km || 0);
      form.setValue('cargo_type', telemetryData.cargo_type || '');
      form.setValue('cargo_weight', telemetryData.cargo_weight || 0);
      form.setValue('fuel_consumed', telemetryData.fuel_consumed || 0);
      form.setValue('income', telemetryData.income || 0);
      form.setValue('damage_percent', telemetryData.damage_percent || 0);
      setTelemetryFilled(true);
      toast({
        title: 'Telemetry Data Loaded',
        description: 'Form has been filled with live telemetry data.',
      });
      // Clear the state to prevent re-filling on navigation
      window.history.replaceState({}, document.title);
    }
  }, [location.state, form, toast]);

  const onSubmit = async (data: JobForm) => {
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'You must be logged in to log a job.',
      });
      return;
    }

    if (!isApproved) {
      toast({
        variant: 'destructive',
        title: 'Account Pending',
        description: 'Your account must be approved before you can log jobs.',
      });
      return;
    }

    setLoading(true);

    const { error } = await supabase.from('job_logs').insert({
      user_id: user.id,
      origin_city: data.origin_city,
      destination_city: data.destination_city,
      distance_km: data.distance_km,
      cargo_type: data.cargo_type || null,
      cargo_weight: data.cargo_weight || null,
      fuel_consumed: data.fuel_consumed || 0,
      income: data.income,
      expenses: data.expenses || 0,
      damage_percent: data.damage_percent || 0,
      delivery_date: data.delivery_date ? new Date(data.delivery_date).toISOString() : new Date().toISOString(),
      notes: data.notes || null,
    });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } else {
      toast({
        title: 'Job Logged!',
        description: 'Your delivery has been recorded successfully.',
      });
      form.reset();
      setTelemetryFilled(false);
      navigate('/my-stats');
    }

    setLoading(false);
  };

  if (!isApproved) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <GlassCard className="max-w-md text-center">
            <AlertTriangle size={48} className="mx-auto text-warning mb-4" />
            <h2 className="text-xl font-bold mb-2">Account Pending Approval</h2>
            <p className="text-muted-foreground">
              Your account must be approved by HR before you can log jobs. 
              Please wait for approval or contact an administrator.
            </p>
          </GlassCard>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold gradient-text">Log New Job</h1>
            <p className="text-muted-foreground mt-1">Record your delivery details</p>
          </div>
          
          {/* Telemetry Quick Action */}
          <Link to="/telemetry">
            <Button variant="outline" className="gap-2 rounded-full">
              <Activity size={16} />
              Auto-Fill from Telemetry
            </Button>
          </Link>
        </div>

        {/* Telemetry Badge */}
        {telemetryFilled && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/10 border border-primary/20">
            <Zap size={18} className="text-primary" />
            <span className="text-sm font-medium text-primary">
              This form was auto-filled from live telemetry data
            </span>
            <Badge variant="outline" className="ml-auto bg-primary/20 text-primary border-primary/40">
              Telemetry
            </Badge>
          </div>
        )}

        <GlassCard>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Route Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <MapPin size={20} className="text-primary" />
                Route Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="origin_city">Origin City *</Label>
                  <Input
                    id="origin_city"
                    placeholder="e.g., Berlin"
                    className="glass-input"
                    {...form.register('origin_city')}
                  />
                  {form.formState.errors.origin_city && (
                    <p className="text-destructive text-sm">{form.formState.errors.origin_city.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="destination_city">Destination City *</Label>
                  <Input
                    id="destination_city"
                    placeholder="e.g., Paris"
                    className="glass-input"
                    {...form.register('destination_city')}
                  />
                  {form.formState.errors.destination_city && (
                    <p className="text-destructive text-sm">{form.formState.errors.destination_city.message}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="distance_km">Distance (km) *</Label>
                <Input
                  id="distance_km"
                  type="number"
                  step="0.01"
                  placeholder="0"
                  className="glass-input"
                  {...form.register('distance_km')}
                />
                {form.formState.errors.distance_km && (
                  <p className="text-destructive text-sm">{form.formState.errors.distance_km.message}</p>
                )}
              </div>
            </div>

            {/* Cargo Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Package size={20} className="text-primary" />
                Cargo Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cargo_type">Cargo Type</Label>
                  <Input
                    id="cargo_type"
                    placeholder="e.g., Electronics"
                    className="glass-input"
                    {...form.register('cargo_type')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cargo_weight">Weight (tons)</Label>
                  <Input
                    id="cargo_weight"
                    type="number"
                    step="0.01"
                    placeholder="0"
                    className="glass-input"
                    {...form.register('cargo_weight')}
                  />
                </div>
              </div>
            </div>

            {/* Financial Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <DollarSign size={20} className="text-primary" />
                Financial Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="income">Income ($) *</Label>
                  <Input
                    id="income"
                    type="number"
                    step="0.01"
                    placeholder="0"
                    className="glass-input"
                    {...form.register('income')}
                  />
                  {form.formState.errors.income && (
                    <p className="text-destructive text-sm">{form.formState.errors.income.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expenses">Expenses ($)</Label>
                  <Input
                    id="expenses"
                    type="number"
                    step="0.01"
                    placeholder="0"
                    className="glass-input"
                    {...form.register('expenses')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fuel_consumed">Fuel (L)</Label>
                  <Input
                    id="fuel_consumed"
                    type="number"
                    step="0.01"
                    placeholder="0"
                    className="glass-input"
                    {...form.register('fuel_consumed')}
                  />
                </div>
              </div>
            </div>

            {/* Delivery Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Truck size={20} className="text-primary" />
                Delivery Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="delivery_date">Delivery Date</Label>
                  <Input
                    id="delivery_date"
                    type="date"
                    className="glass-input"
                    {...form.register('delivery_date')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="damage_percent">Damage (%)</Label>
                  <Input
                    id="damage_percent"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="0"
                    className="glass-input"
                    {...form.register('damage_percent')}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Any additional notes about this delivery..."
                  className="glass-input min-h-[100px]"
                  {...form.register('notes')}
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  form.reset();
                  setTelemetryFilled(false);
                }}
                className="flex-1 rounded-full"
              >
                Clear Form
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-full neon-glow"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Log Delivery
                  </>
                )}
              </Button>
            </div>
          </form>
        </GlassCard>
      </div>
    </AppLayout>
  );
}
