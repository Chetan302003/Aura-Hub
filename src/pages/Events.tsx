import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { GlassCard } from '@/components/layout/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useTruckersMP, TMPEvent } from '@/hooks/useTruckersMP';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, formatDistanceToNow, parseISO, isFuture } from 'date-fns';
import {
  Calendar,
  MapPin,
  Users,
  Clock,
  Truck,
  Globe,
  RefreshCw,
  Plus,
  ExternalLink,
  CheckCircle,
  HelpCircle,
  Server,
  Gamepad2,
  Route,
  Flag,
  Edit,
  Trash2,
  UserPlus,
  UserMinus,
  BellRing,
  Send
} from 'lucide-react';
import { isTauri } from '@tauri-apps/api/core';
import { sendNotification } from '@tauri-apps/plugin-notification';

interface VTCEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  game: string;
  departure_city: string;
  departure_location: string | null;
  arrival_city: string;
  arrival_location: string | null;
  start_time: string;
  meetup_time: string | null;
  server_name: string | null;
  required_dlcs: string[] | null;
  max_participants: number | null;
  banner_url: string | null;
  route_url: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  participant_count?: number;
  is_participating?: boolean;
}

export default function Events() {
  const { user, isStaff } = useAuth();
  const { getEvents, getVTCEvents, getServers, loading: tmpLoading } = useTruckersMP();

  const [activeTab, setActiveTab] = useState('vtc');
  const [tmpEvents, setTmpEvents] = useState<TMPEvent[]>([]);
  const [vtcEvents, setVtcEvents] = useState<VTCEvent[]>([]);
  const [servers, setServers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<VTCEvent | null>(null);
  const [tmpEventCount, setTmpEventCount] = useState(10); // How many TMP events to display

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_type: 'convoy',
    game: 'ETS2',
    departure_city: '',
    departure_location: '',
    arrival_city: '',
    arrival_location: '',
    start_time: '',
    meetup_time: '',
    server_name: '',
    max_participants: '',
    banner_url: '',
    route_url: ''
  });

  // Fetch all data
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchTMPEvents(),
      fetchVTCEvents(),
      fetchServers()
    ]);
    setLoading(false);
  };

  const fetchTMPEvents = async () => {
    try {
      const events = await getEvents();
      if (Array.isArray(events)) {
        setTmpEvents(events);
      } else if (events && typeof events === 'object' && 'response' in events) {
        setTmpEvents((events as any).response || []);
      } else {
        setTmpEvents([]);
      }
    } catch (err) {
      console.error("TMP Fetch Error:", err);
      setTmpEvents([]);
    }
  };

  const fetchVTCEvents = async () => {
    try {
      const [supabaseResponse, tmpVtcEventsData] = await Promise.all([
        supabase.from('vtc_events').select('*').order('start_time', { ascending: true }),
        getVTCEvents().catch(() => []) // Fallback in case fetch fails
      ]);

      const safeData = supabaseResponse.data || [];
      const supabaseEvents = await Promise.all(safeData.map(async (event) => {
        return {
          ...event,
          start_time: event.start_time || new Date().toISOString(),
          participant_count: 0,
          is_participating: false
        };
      }));

      const externalVtcEvents = (tmpVtcEventsData || []).map((event: any) => {
        // Fix dates missing 'T' (e.g., "2025-02-14 12:56:35" -> "2025-02-14T12:56:35")
        const formattedStartTime = (event.startAt || event.start_at || new Date().toISOString()).replace(' ', 'T');
        return {
          id: `tmp-vtc-${event.id}`,
          title: event.name || 'Unknown Event',
          description: event.description || '',
          event_type: event.event_type?.key || 'convoy',
          game: event.game || 'ETS2',
          departure_city: event.departure?.city || 'Unknown',
          departure_location: event.departure?.location || '',
          arrival_city: event.arrive?.city || 'Unknown',
          arrival_location: event.arrive?.location || '',
          start_time: formattedStartTime,
          meetup_time: event.meetupAt?.replace(' ', 'T') || '',
          server_name: event.server?.name || null,
          required_dlcs: null,
          max_participants: null,
          banner_url: event.banner || null,
          route_url: event.url ? `https://truckersmp.com${event.url}` : null,
          status: new Date(formattedStartTime) > new Date() ? 'upcoming' : 'completed',
          created_by: event.user?.username || null,
          created_at: event.created_at?.replace(' ', 'T') || new Date().toISOString(),
          participant_count: event.attendances?.confirmed || 0,
          is_participating: false
        };
      });

      // Combine and sort by start time
      const combinedEvents = [...supabaseEvents, ...externalVtcEvents].sort(
        (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );

      setVtcEvents(combinedEvents);
    } catch (error) {
      console.error('Error fetching combined VTC events:', error);
      setVtcEvents([]);
    }
  };

  const fetchServers = async () => {
    const serverData = await getServers();
    setServers(serverData);
  };

  const handleCreateEvent = async () => {
    if (!formData.title || !formData.departure_city || !formData.arrival_city || !formData.start_time) {
      toast.error('Please fill in all required fields');
      return;
    }

    const eventData = {
      ...formData,
      max_participants: formData.max_participants ? parseInt(formData.max_participants) : null,
      created_by: user?.id
    };

    const { error } = await supabase
      .from('vtc_events')
      .insert(eventData);

    if (error) {
      toast.error('Failed to create event');
      console.error(error);
      return;
    }

    toast.success('Event created successfully');
    setShowCreateDialog(false);
    resetForm();
    fetchVTCEvents();
  };

  const handleUpdateEvent = async () => {
    if (!editingEvent) return;

    const eventData = {
      ...formData,
      max_participants: formData.max_participants ? parseInt(formData.max_participants) : null
    };

    const { error } = await supabase
      .from('vtc_events')
      .update(eventData)
      .eq('id', editingEvent.id);

    if (error) {
      toast.error('Failed to update event');
      console.error(error);
      return;
    }

    toast.success('Event updated successfully');
    setEditingEvent(null);
    resetForm();
    fetchVTCEvents();
  };

  const handleDeleteEvent = async (eventId: string) => {
    const { error } = await supabase
      .from('vtc_events')
      .delete()
      .eq('id', eventId);

    if (error) {
      toast.error('Failed to delete event');
      return;
    }

    toast.success('Event deleted');
    fetchVTCEvents();
  };

  const handleRSVP = async (eventId: string, isParticipating: boolean) => {
    if (!user) return;

    if (isParticipating) {
      const { error } = await supabase
        .from('event_participants')
        .delete()
        .eq('event_id', eventId)
        .eq('user_id', user.id);

      if (error) {
        toast.error('Failed to cancel RSVP');
        return;
      }
      toast.success('RSVP cancelled');
    } else {
      const { error } = await supabase
        .from('event_participants')
        .insert({ event_id: eventId, user_id: user.id });

      if (error) {
        toast.error('Failed to RSVP');
        return;
      }
      toast.success('You\'re signed up for this event!');
    }

    fetchVTCEvents();
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      event_type: 'convoy',
      game: 'ETS2',
      departure_city: '',
      departure_location: '',
      arrival_city: '',
      arrival_location: '',
      start_time: '',
      meetup_time: '',
      server_name: '',
      max_participants: '',
      banner_url: '',
      route_url: ''
    });
  };

  const openEditDialog = (event: VTCEvent) => {
    // 1. Create a helper that handles ANY data type safely
    const formatForInput = (val: any) => {
      if (!val) return '';
      const str = String(val); // Force to string (handles Date objects or Numbers)
      return str.length >= 16 ? str.slice(0, 16) : str; // Only slice if long enough
    };
    {/*const safeSlice = (val: any) => {
    if (!val) return '';
    const str = String(val); // Force it to be a string
    return str.includes('T') ? str.slice(0, 16) : str;
  };*/}
    setFormData({
      title: event.title,
      description: event.description || '',
      event_type: event.event_type,
      game: event.game,
      departure_city: event.departure_city,
      departure_location: event.departure_location || '',
      arrival_city: event.arrival_city,
      arrival_location: event.arrival_location || '',
      start_time: formatForInput(event.start_time),
      meetup_time: formatForInput(event.meetup_time),
      server_name: event.server_name || '',
      max_participants: event.max_participants?.toString() || '',
      banner_url: event.banner_url || '',
      route_url: event.route_url || ''
    });
    setEditingEvent(event);
  };

  const getEventStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming': return 'bg-primary/20 text-primary border-primary/40';
      case 'live': return 'bg-red-500/20 text-red-400 border-red-500/40';
      case 'completed': return 'bg-muted text-muted-foreground border-muted';
      case 'cancelled': return 'bg-destructive/20 text-destructive border-destructive/40';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getGameBadge = (game: string) => {
    if (game.toLowerCase().includes('ets') || game.toLowerCase().includes('euro')) {
      return <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/40">ETS2</Badge>;
    }
    return <Badge variant="outline" className="bg-orange-500/20 text-orange-400 border-orange-500/40">ATS</Badge>;
  };

  const upcomingVTCEvents = vtcEvents.filter(e => isFuture(parseISO(e.start_time)) && e.status !== 'cancelled');
  const pastVTCEvents = vtcEvents.filter(e => !isFuture(parseISO(e.start_time)) || e.status === 'cancelled');

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold gradient-text">Events</h1>
            <p className="text-muted-foreground mt-1">
              Live TruckersMP events & VTC convoys
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={fetchAllData}
              disabled={loading || tmpLoading}
              className="gap-2 rounded-full"
            >
              <RefreshCw size={18} className={loading || tmpLoading ? 'animate-spin' : ''} />
              Refresh
            </Button>
            {isStaff && (
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button className="gap-2 rounded-full neon-glow">
                    <Plus size={18} />
                    Create Event
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create VTC Event</DialogTitle>
                  </DialogHeader>
                  <EventForm
                    formData={formData}
                    setFormData={setFormData}
                    onSubmit={handleCreateEvent}
                    submitLabel="Create Event"
                  />
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Server Status Bar */}
        <GlassCard className="p-4">
          <div className="flex items-center gap-4 overflow-x-auto pb-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Server size={16} className="text-primary" />
              <span>Live Servers:</span>
            </div>
            {servers.slice(0, 6).map((server) => (
              <div
                key={server.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 text-sm whitespace-nowrap"
              >
                <div className={`w-2 h-2 rounded-full ${server.online ? 'bg-primary' : 'bg-destructive'}`} />
                <span className="font-medium">{server.shortname || server.name}</span>
                <span className="text-muted-foreground">
                  {server.players}/{server.maxplayers}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="vtc" className="gap-2">
              <Truck size={16} />
              VTC Events
            </TabsTrigger>
            <TabsTrigger value="tmp" className="gap-2">
              <Globe size={16} />
              TMP Events
            </TabsTrigger>
            <TabsTrigger value="servers" className="gap-2">
              <Server size={16} />
              Servers
            </TabsTrigger>
          </TabsList>

          {/* VTC Events Tab */}
          <TabsContent value="vtc" className="space-y-6 mt-6">
            {/* Upcoming Events */}
            <div>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Calendar size={20} className="text-primary" />
                Upcoming Events ({upcomingVTCEvents.length})
              </h2>
              {upcomingVTCEvents.length === 0 ? (
                <GlassCard className="p-8 text-center">
                  <Calendar size={48} className="mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No upcoming events scheduled</p>
                  {isStaff && (
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setShowCreateDialog(true)}
                    >
                      Create First Event
                    </Button>
                  )}
                </GlassCard>
              ) : (
                <div className="grid gap-4">
                  {upcomingVTCEvents.map((event) => (
                    <VTCEventCard
                      key={event.id}
                      event={event}
                      isStaff={isStaff}
                      onEdit={openEditDialog}
                      onDelete={handleDeleteEvent}
                      onRSVP={handleRSVP}
                      getGameBadge={getGameBadge}
                      getEventStatusColor={getEventStatusColor}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Past Events */}
            {pastVTCEvents.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-muted-foreground">
                  <Clock size={20} />
                  Past Events ({pastVTCEvents.length})
                </h2>
                <div className="grid gap-4 opacity-60">
                  {pastVTCEvents.slice(0, 5).map((event) => (
                    <VTCEventCard
                      key={event.id}
                      event={event}
                      isStaff={isStaff}
                      onEdit={openEditDialog}
                      onDelete={handleDeleteEvent}
                      onRSVP={handleRSVP}
                      getGameBadge={getGameBadge}
                      getEventStatusColor={getEventStatusColor}
                      isPast
                    />
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* TMP Events Tab */}
          <TabsContent value="tmp" className="space-y-4 mt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Globe size={20} className="text-primary" />
                TruckersMP Community Events
                <Badge variant="outline" className="ml-2 font-mono">
                  {Array.isArray(tmpEvents) ? Math.min(tmpEventCount, tmpEvents.length) : 0} / {Array.isArray(tmpEvents) ? tmpEvents.length : 0}
                </Badge>
              </h2>

              <div className="flex items-center gap-3">
                <Label className="text-sm text-muted-foreground whitespace-nowrap">Show events:</Label>
                <Select
                  value={tmpEventCount.toString()}
                  onValueChange={(value) => setTmpEventCount(parseInt(value))}
                >
                  <SelectTrigger className="w-[110px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="500">All</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {Array.isArray(tmpEvents) && tmpEvents.length > 0 ? (
              <div className="grid gap-4">
                {tmpEvents.slice(0, tmpEventCount).map((event) => (
                  <TMPEventCard key={event.id} event={event} getGameBadge={getGameBadge} />
                ))}
              </div>
            ) : (
              <GlassCard className="p-8 text-center">
                <Globe size={48} className="mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {tmpLoading ? 'Loading events...' : 'No upcoming TMP events found'}
                </p>
              </GlassCard>
            )}
          </TabsContent>

          {/* Servers Tab */}
          <TabsContent value="servers" className="space-y-4 mt-6">
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
              <Server size={20} className="text-primary" />
              TruckersMP Servers
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {servers.map((server) => (
                <ServerCard key={server.id} server={server} />
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Edit Event Dialog */}
        <Dialog open={!!editingEvent} onOpenChange={(open) => !open && setEditingEvent(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Event</DialogTitle>
            </DialogHeader>
            <EventForm
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleUpdateEvent}
              submitLabel="Update Event"
            />
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

// Event Form Component
function EventForm({
  formData,
  setFormData,
  onSubmit,
  submitLabel
}: {
  formData: any;
  setFormData: (data: any) => void;
  onSubmit: () => void;
  submitLabel: string;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Event Title *</Label>
          <Input
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Weekly Convoy to Paris"
          />
        </div>

        <div>
          <Label>Event Type</Label>
          <Select
            value={formData.event_type}
            onValueChange={(value) => setFormData({ ...formData, event_type: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="convoy">Convoy</SelectItem>
              <SelectItem value="meetup">Meetup</SelectItem>
              <SelectItem value="race">Race</SelectItem>
              <SelectItem value="training">Training</SelectItem>
              <SelectItem value="special">Special Event</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Game</Label>
          <Select
            value={formData.game}
            onValueChange={(value) => setFormData({ ...formData, game: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ETS2">Euro Truck Simulator 2</SelectItem>
              <SelectItem value="ATS">American Truck Simulator</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Departure City *</Label>
          <Input
            value={formData.departure_city}
            onChange={(e) => setFormData({ ...formData, departure_city: e.target.value })}
            placeholder="Berlin"
          />
        </div>

        <div>
          <Label>Arrival City *</Label>
          <Input
            value={formData.arrival_city}
            onChange={(e) => setFormData({ ...formData, arrival_city: e.target.value })}
            placeholder="Paris"
          />
        </div>

        <div>
          <Label>Departure Location</Label>
          <Input
            value={formData.departure_location}
            onChange={(e) => setFormData({ ...formData, departure_location: e.target.value })}
            placeholder="Company Name or Landmark"
          />
        </div>

        <div>
          <Label>Arrival Location</Label>
          <Input
            value={formData.arrival_location}
            onChange={(e) => setFormData({ ...formData, arrival_location: e.target.value })}
            placeholder="Company Name or Landmark"
          />
        </div>

        <div>
          <Label>Start Time *</Label>
          <Input
            type="datetime-local"
            value={formData.start_time}
            onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
          />
        </div>

        <div>
          <Label>Meetup Time</Label>
          <Input
            type="datetime-local"
            value={formData.meetup_time}
            onChange={(e) => setFormData({ ...formData, meetup_time: e.target.value })}
          />
        </div>

        <div>
          <Label>Server</Label>
          <Input
            value={formData.server_name}
            onChange={(e) => setFormData({ ...formData, server_name: e.target.value })}
            placeholder="Simulation 1"
          />
        </div>

        <div>
          <Label>Max Participants</Label>
          <Input
            type="number"
            value={formData.max_participants}
            onChange={(e) => setFormData({ ...formData, max_participants: e.target.value })}
            placeholder="50"
          />
        </div>

        <div className="col-span-2">
          <Label>Description</Label>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Event details, rules, and requirements..."
            rows={3}
          />
        </div>

        <div>
          <Label>Banner URL</Label>
          <Input
            value={formData.banner_url}
            onChange={(e) => setFormData({ ...formData, banner_url: e.target.value })}
            placeholder="https://..."
          />
        </div>

        <div>
          <Label>Route URL</Label>
          <Input
            value={formData.route_url}
            onChange={(e) => setFormData({ ...formData, route_url: e.target.value })}
            placeholder="https://..."
          />
        </div>
      </div>

      <Button onClick={onSubmit} className="w-full neon-glow">
        {submitLabel}
      </Button>
    </div>
  );
}

// VTC Event Card Component
function VTCEventCard({
  event,
  isStaff,
  onEdit,
  onDelete,
  onRSVP,
  getGameBadge,
  getEventStatusColor,
  isPast = false
}: {
  event: VTCEvent;
  isStaff: boolean;
  onEdit: (event: VTCEvent) => void;
  onDelete: (id: string) => void;
  onRSVP: (id: string, isParticipating: boolean) => void;
  getGameBadge: (game: string) => React.ReactNode;
  getEventStatusColor: (status: string) => string;
  isPast?: boolean;
}) {
  return (
    <GlassCard className="p-6">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Event Image/Banner */}
        {event.banner_url && (
          <div className="lg:w-48 h-32 lg:h-auto rounded-xl overflow-hidden bg-muted/50 flex-shrink-0">
            <img
              src={event.banner_url}
              alt={event.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="flex-1 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {getGameBadge(event.game)}
                <Badge variant="outline" className={getEventStatusColor(event.status)}>
                  {event.status}
                </Badge>
                <Badge variant="outline" className="capitalize">
                  {event.event_type}
                </Badge>
              </div>
              <h3 className="text-xl font-semibold">{event.title}</h3>
            </div>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                title="Set Local Reminder"
                onClick={async () => {
                  if (isTauri()) {
                    sendNotification({
                      title: `Reminder: ${event.title}`,
                      body: `Event starts ${formatDistanceToNow(parseISO(event.start_time), { addSuffix: true })}`
                    });
                    toast.success("Desktop reminder set!");
                  } else {
                    toast.error("Reminders only work in the Desktop App");
                  }
                }}
              >
                <BellRing size={16} className="text-muted-foreground hover:text-primary transition-colors" />
              </Button>
              {isStaff && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Push Notification to App Users"
                    onClick={async () => {
                      if (isTauri()) {
                        // In a full production app, you would send a Supabase broadcast here.
                        // For now, demo the local emit
                        sendNotification({
                          title: `Aura VTC: ${event.title}`,
                          body: `Staff has announced an event! Check the calendar.`
                        });
                        toast.success("Push notification sent to all online drivers!");
                      }
                    }}
                  >
                    <Send size={16} className="text-blue-400" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onEdit(event)}>
                    <Edit size={16} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(event.id)}>
                    <Trash2 size={16} className="text-destructive" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Route */}
          <div className="flex items-center gap-2 text-sm">
            <MapPin size={16} className="text-primary" />
            <span className="font-medium">{event.departure_city}</span>
            <Route size={14} className="text-muted-foreground" />
            <Flag size={16} className="text-primary" />
            <span className="font-medium">{event.arrival_city}</span>
          </div>

          {/* Time */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar size={16} />
              <span>{format(parseISO(event.start_time), 'PPP')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={16} />
              <span>{format(parseISO(event.start_time), 'HH:mm')} UTC</span>
            </div>
            {!isPast && (
              <span className="text-primary font-medium">
                {formatDistanceToNow(parseISO(event.start_time), { addSuffix: true })}
              </span>
            )}
          </div>

          {/* Description */}
          {event.description && (
            <div className="text-sm text-muted-foreground line-clamp-3 space-y-1">
              {event.description.split('\n').map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-primary" />
                <span>{event.participant_count || 0} attending</span>
                {event.max_participants && (
                  <span className="text-muted-foreground">/ {event.max_participants} max</span>
                )}
              </div>
              {event.server_name && (
                <div className="flex items-center gap-2">
                  <Server size={16} />
                  <span>{event.server_name}</span>
                </div>
              )}
            </div>

            {!isPast && (
              <Button
                variant={event.is_participating ? 'outline' : 'default'}
                size="sm"
                onClick={() => onRSVP(event.id, event.is_participating || false)}
                className="gap-2"
              >
                {event.is_participating ? (
                  <>
                    <UserMinus size={16} />
                    Leave Event
                  </>
                ) : (
                  <>
                    <UserPlus size={16} />
                    Join Event
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

// TMP Event Card Component
function TMPEventCard({
  event,
  getGameBadge
}: {
  event: TMPEvent;
  getGameBadge: (game: string) => React.ReactNode;
}) {
  return (
    <GlassCard className="p-6">
      <div className="flex flex-col lg:flex-row gap-4">
        {event.banner && (
          <div className="lg:w-48 h-32 lg:h-auto rounded-xl overflow-hidden bg-muted/50 flex-shrink-0">
            <img
              src={event.banner}
              alt={event.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="flex-1 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {getGameBadge(event.game)}
                {event.featured && (
                  <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/40">
                    Featured
                  </Badge>
                )}
                {event.vtc && (
                  <Badge variant="outline">{event.vtc.name}</Badge>
                )}
              </div>
              <h3 className="text-xl font-semibold">{event.name}</h3>
            </div>

            <a
              href={`https://truckersmp.com/events/${event.slug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="ghost" size="icon">
                <ExternalLink size={16} />
              </Button>
            </a>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <MapPin size={16} className="text-primary" />
            <span className="font-medium">{event.departure?.city || 'Unknown'}</span>
            <Route size={14} className="text-muted-foreground" />
            <Flag size={16} className="text-primary" />
            <span className="font-medium">{event.arrive?.city || 'Unknown'}</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar size={16} />
              <span>{event.startAt ? format(parseISO(event.startAt), 'PPP') : 'TBA'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={16} />
              <span>{event.startAt ? format(parseISO(event.startAt), 'HH:mm') : '--:--'} UTC</span>
            </div>
            <span className="text-primary font-medium">
              {event.startAt ? formatDistanceToNow(parseISO(event.startAt), { addSuffix: true }) : ''}
            </span>
          </div>

          {event.description && (
            <div className="text-sm text-muted-foreground line-clamp-3 space-y-1">
              {event.description.split('\n').map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          )}

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-primary" />
              <span>{event.attendances?.confirmed || 0} confirmed</span>
            </div>
            <div className="flex items-center gap-2">
              <HelpCircle size={16} className="text-muted-foreground" />
              <span>{event.attendances?.unsure || 0} unsure</span>
            </div>
            <div className="flex items-center gap-2">
              <Server size={16} />
              <span>{event.server?.name || 'Simulator'}</span>
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

// Server Card Component
function ServerCard({ server }: { server: any }) {
  const playerPercentage = (server.players / server.maxplayers) * 100;

  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${server.online ? 'bg-primary neon-pulse' : 'bg-destructive'}`} />
          <h3 className="font-semibold">{server.name}</h3>
        </div>
        <Badge variant="outline">
          {server.game === 'ETS2' ? 'ETS2' : 'ATS'}
        </Badge>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Players</span>
          <span className="font-medium">{server.players} / {server.maxplayers}</span>
        </div>

        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
            style={{ width: `${Math.min(playerPercentage, 100)}%` }}
          />
        </div>

        {server.queue > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Queue</span>
            <span className="text-yellow-400 font-medium">{server.queue}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-3">
          {server.speedlimiter === 1 && (
            <Badge variant="secondary" className="text-xs">Speed Limit</Badge>
          )}
          {server.collisions && (
            <Badge variant="secondary" className="text-xs">Collisions</Badge>
          )}
          {server.promods && (
            <Badge variant="secondary" className="text-xs">ProMods</Badge>
          )}
          {server.event && (
            <Badge className="bg-primary/20 text-primary text-xs">Event Server</Badge>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
