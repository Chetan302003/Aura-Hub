import { useState, useEffect, useMemo, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { GlassCard } from '@/components/layout/GlassCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTruckersMP, TMPEvent } from '@/hooks/useTruckersMP';
import { useEventReminders, CalendarEvent as ReminderEvent } from '@/hooks/useEventReminders';
import { useUIStore } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, parseISO, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, getDay, isToday, isSameMonth } from 'date-fns';
import {
  Calendar,
  Download,
  RefreshCw,
  MapPin,
  Clock,
  Truck,
  Globe,
  Users,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Bell,
  BellOff,
  X,
  Gamepad2
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
  status: string;
  banner_url: string | null;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end?: Date;
  type: 'tmp' | 'vtc';
  game: string;
  departure: string;
  arrival: string;
  description?: string;
  url?: string;
  attendees?: number;
  server?: string;
  banner?: string;
}

export default function CalendarPage() {
  const { getEvents, loading: tmpLoading } = useTruckersMP();
  const { hasReminder, toggleReminder, reminderEvents, permission, requestPermission } = useEventReminders();
  const notificationsEnabled = useUIStore((s) => s.notificationsEnabled);
  const setNotificationsEnabled = useUIStore((s) => s.setNotificationsEnabled);
  
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [tmpEvents, setTmpEvents] = useState<TMPEvent[]>([]);
  const [vtcEvents, setVtcEvents] = useState<VTCEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Fetch all events
  useEffect(() => {
    fetchAllEvents();
  }, []);

  const fetchAllEvents = async () => {
    setLoading(true);
    await Promise.all([fetchTMPEvents(), fetchVTCEvents()]);
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
      const { data, error } = await supabase
        .from('vtc_events')
        .select('*')
        .order('start_time', { ascending: true });
      
      if (error) {
        console.error('Error fetching VTC events:', error);
        return;
      }
      setVtcEvents(data || []);
    } catch (error) {
      console.error('Error fetching VTC events:', error);
      setVtcEvents([]);
    }
  };

  // Convert events to unified calendar format
  const calendarEvents = useMemo((): CalendarEvent[] => {
    const events: CalendarEvent[] = [];

    // Add TMP events
    tmpEvents.forEach((event) => {
      events.push({
        id: `tmp-${event.id}`,
        title: event.name,
        start: parseISO(event.startAt),
        type: 'tmp',
        game: event.game,
        departure: `${event.departure.city}${event.departure.location ? `, ${event.departure.location}` : ''}`,
        arrival: `${event.arrive.city}${event.arrive.location ? `, ${event.arrive.location}` : ''}`,
        description: event.description,
        url: `https://truckersmp.com/events/${event.id}`,
        attendees: event.attendances.confirmed,
        server: event.server?.name,
        banner: event.banner
      });
    });

    // Add VTC events
    vtcEvents.forEach((event) => {
      events.push({
        id: `vtc-${event.id}`,
        title: event.title,
        start: parseISO(event.start_time),
        type: 'vtc',
        game: event.game,
        departure: `${event.departure_city}${event.departure_location ? `, ${event.departure_location}` : ''}`,
        arrival: `${event.arrival_city}${event.arrival_location ? `, ${event.arrival_location}` : ''}`,
        description: event.description || undefined,
        server: event.server_name || undefined,
        banner: event.banner_url || undefined
      });
    });

    return events.sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [tmpEvents, vtcEvents]);

  // Get events for a specific day
  const getEventsForDay = useCallback((day: Date) => {
    return calendarEvents.filter((event) => isSameDay(event.start, day));
  }, [calendarEvents]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    // Add padding days at the start
    const startPadding = getDay(monthStart);
    const paddingDays: (Date | null)[] = Array(startPadding).fill(null);
    
    // Add padding days at the end to complete the grid
    const totalCells = Math.ceil((days.length + startPadding) / 7) * 7;
    const endPadding = totalCells - days.length - startPadding;
    const endPaddingDays: (Date | null)[] = Array(endPadding).fill(null);
    
    return [...paddingDays, ...days, ...endPaddingDays];
  }, [currentMonth]);

  // Generate ICS content for calendar download
  const generateICSContent = useCallback(() => {
    const formatICSDate = (date: Date): string => {
      return format(date, "yyyyMMdd'T'HHmmss'Z'");
    };

    const escapeICS = (text: string): string => {
      return text
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');
    };

    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Aura VTC Hub//Events Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Aura VTC Events',
      'X-WR-TIMEZONE:UTC'
    ];

    calendarEvents.forEach((event) => {
      const uid = `${event.id}@auravtc.hub`;
      const startDate = formatICSDate(event.start);
      const endDate = formatICSDate(new Date(event.start.getTime() + 2 * 60 * 60 * 1000));
      
      const eventLines = [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${formatICSDate(new Date())}`,
        `DTSTART:${startDate}`,
        `DTEND:${endDate}`,
        `SUMMARY:${escapeICS(event.title)}`,
        `DESCRIPTION:${escapeICS(`Game: ${event.game}\\nRoute: ${event.departure} → ${event.arrival}${event.description ? '\\n\\n' + event.description : ''}`)}`,
        `LOCATION:${escapeICS(event.departure)}`,
        `CATEGORIES:${event.type === 'tmp' ? 'TruckersMP Event' : 'VTC Convoy'}`
      ];

      if (event.url) {
        eventLines.push(`URL:${event.url}`);
      }

      eventLines.push('END:VEVENT');
      icsContent = icsContent.concat(eventLines);
    });

    icsContent.push('END:VCALENDAR');
    return icsContent.join('\r\n');
  }, [calendarEvents]);

  // Download calendar file
  const handleDownloadCalendar = useCallback(() => {
    if (calendarEvents.length === 0) {
      toast.error('No events to export');
      return;
    }

    const icsContent = generateICSContent();
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'aura-vtc-events.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success('Calendar downloaded! Import it to Apple Calendar, Google Calendar, or Outlook.');
  }, [calendarEvents, generateICSContent]);

  const getGameLabel = (game: string) => {
    if (game.toLowerCase().includes('ets') || game.toLowerCase().includes('euro')) {
      return 'ETS2';
    }
    return 'ATS';
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setCurrentMonth(subMonths(currentMonth, 1));
    } else {
      setCurrentMonth(addMonths(currentMonth, 1));
    }
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
  };

  const handleToggleReminder = (event: CalendarEvent) => {
    toggleReminder({
      id: event.id,
      title: event.title,
      startTime: event.start.toISOString(),
      departure: event.departure,
      arrival: event.arrival,
      type: event.type,
      url: event.url
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold gradient-text">Event Calendar</h1>
            <p className="text-muted-foreground mt-1">
              View all TruckersMP and VTC events
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={fetchAllEvents}
              disabled={loading || tmpLoading}
              className="gap-2"
            >
              <RefreshCw size={18} className={loading || tmpLoading ? 'animate-spin' : ''} />
              Refresh
            </Button>
            <Button
              onClick={handleDownloadCalendar}
              disabled={calendarEvents.length === 0}
              className="gap-2 neon-glow"
            >
              <Download size={18} />
              Download .ics
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <GlassCard className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{calendarEvents.length}</div>
            <div className="text-sm text-muted-foreground">Total Events</div>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-400">{tmpEvents.length}</div>
            <div className="text-sm text-muted-foreground">TMP Events</div>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{vtcEvents.length}</div>
            <div className="text-sm text-muted-foreground">VTC Events</div>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-400">{reminderEvents.length}</div>
            <div className="text-sm text-muted-foreground">Reminders Set</div>
          </GlassCard>
        </div>

        {/* Full Calendar */}
        <GlassCard className="p-4 md:p-6 overflow-hidden">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="outline"
              onClick={() => navigateMonth('prev')}
              className="gap-2"
            >
              <ChevronLeft size={18} />
              <span className="hidden sm:inline">Previous</span>
            </Button>
            
            <div className="flex items-center gap-4">
              <h2 className="text-xl md:text-2xl font-bold text-primary">
                {format(currentMonth, 'MMMM yyyy')}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={goToToday}
                className="text-muted-foreground hover:text-foreground"
              >
                Today
              </Button>
            </div>
            
            <Button
              variant="outline"
              onClick={() => navigateMonth('next')}
              className="gap-2"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight size={18} />
            </Button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-border/50 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div
                key={day}
                className="py-3 text-center text-sm font-semibold text-primary"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-7 border-l border-border/30">
              {calendarDays.map((day, index) => {
                const dayEvents = day ? getEventsForDay(day) : [];
                const isCurrentMonth = day ? isSameMonth(day, currentMonth) : false;
                const isTodayDate = day ? isToday(day) : false;
                
                return (
                  <div
                    key={index}
                    className={cn(
                      "min-h-[100px] md:min-h-[120px] border-r border-b border-border/30 p-1 md:p-2 transition-colors",
                      !isCurrentMonth && "bg-muted/20",
                      isTodayDate && "bg-primary/10 ring-2 ring-primary/50 ring-inset"
                    )}
                  >
                    {day && (
                      <>
                        <div className={cn(
                          "text-right text-sm font-medium mb-1",
                          !isCurrentMonth && "text-muted-foreground/50",
                          isTodayDate && "text-primary font-bold"
                        )}>
                          {format(day, 'd')}
                        </div>
                        <div className="space-y-1 overflow-hidden">
                          {dayEvents.slice(0, 3).map((event) => (
                            <button
                              key={event.id}
                              onClick={() => handleEventClick(event)}
                              className={cn(
                                "w-full text-left text-[10px] md:text-xs px-1.5 py-1 rounded truncate transition-all hover:opacity-80 cursor-pointer",
                                event.type === 'tmp'
                                  ? "bg-blue-500/30 text-blue-300 hover:bg-blue-500/50"
                                  : "bg-primary/30 text-primary hover:bg-primary/50"
                              )}
                              title={event.title}
                            >
                              <span className="font-medium">{format(event.start, 'HH:mm')}</span>
                              <span className="hidden md:inline"> - {event.title}</span>
                              <span className="md:hidden"> {event.title.slice(0, 10)}...</span>
                            </button>
                          ))}
                          {dayEvents.length > 3 && (
                            <button
                              onClick={() => day && handleEventClick(dayEvents[0])}
                              className="w-full text-[10px] md:text-xs text-muted-foreground hover:text-foreground text-center py-0.5"
                            >
                              +{dayEvents.length - 3} more
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-primary/30" />
              <span className="text-muted-foreground">VTC Events</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-500/30" />
              <span className="text-muted-foreground">TMP Events</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded ring-2 ring-primary/50" />
              <span className="text-muted-foreground">Today</span>
            </div>
          </div>
        </GlassCard>

        {/* Download Info */}
        <GlassCard className="p-6">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="flex-shrink-0 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Download size={32} className="text-primary" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="font-semibold text-lg">Sync with Your Calendar</h3>
              <p className="text-muted-foreground mt-1">
                Download the .ics file and import it into Apple Calendar, Google Calendar, Outlook, or any other calendar app. 
                All events will be automatically added to your calendar.
              </p>
            </div>
            <Button
              onClick={handleDownloadCalendar}
              disabled={calendarEvents.length === 0}
              className="gap-2 neon-glow shrink-0"
            >
              <Download size={18} />
              Download .ics File
            </Button>
          </div>
        </GlassCard>
      </div>

      {/* Event Details Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="max-w-lg">
          {selectedEvent && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge 
                        variant="outline" 
                        className={selectedEvent.type === 'tmp' 
                          ? 'bg-blue-500/20 text-blue-400 border-blue-500/40' 
                          : 'bg-primary/20 text-primary border-primary/40'
                        }
                      >
                        {selectedEvent.type === 'tmp' ? (
                          <><Globe size={12} className="mr-1" /> TruckersMP</>
                        ) : (
                          <><Truck size={12} className="mr-1" /> VTC Event</>
                        )}
                      </Badge>
                      <Badge variant="outline" className="bg-secondary/50">
                        <Gamepad2 size={12} className="mr-1" />
                        {getGameLabel(selectedEvent.game)}
                      </Badge>
                    </div>
                    <DialogTitle className="text-xl">{selectedEvent.title}</DialogTitle>
                  </div>
                </div>
              </DialogHeader>

              {selectedEvent.banner && (
                <div className="w-full h-40 rounded-lg overflow-hidden bg-muted">
                  <img 
                    src={selectedEvent.banner} 
                    alt={selectedEvent.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Clock size={18} className="text-primary shrink-0" />
                    <div>
                      <div className="font-medium">{format(selectedEvent.start, 'EEEE, MMMM d, yyyy')}</div>
                      <div className="text-muted-foreground">{format(selectedEvent.start, 'HH:mm')} UTC</div>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 text-sm">
                    <MapPin size={18} className="text-primary shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium">Route</div>
                      <div className="text-muted-foreground">{selectedEvent.departure}</div>
                      <div className="text-primary">↓</div>
                      <div className="text-muted-foreground">{selectedEvent.arrival}</div>
                    </div>
                  </div>

                  {selectedEvent.server && (
                    <div className="flex items-center gap-3 text-sm">
                      <Globe size={18} className="text-primary shrink-0" />
                      <div>
                        <div className="font-medium">Server</div>
                        <div className="text-muted-foreground">{selectedEvent.server}</div>
                      </div>
                    </div>
                  )}

                  {selectedEvent.attendees !== undefined && (
                    <div className="flex items-center gap-3 text-sm">
                      <Users size={18} className="text-primary shrink-0" />
                      <div>
                        <div className="font-medium">Attendees</div>
                        <div className="text-muted-foreground">{selectedEvent.attendees} confirmed</div>
                      </div>
                    </div>
                  )}
                </div>

                {selectedEvent.description && (
                  <div className="pt-3 border-t border-border/50">
                    <div className="text-sm font-medium mb-2">Description</div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedEvent.description}
                    </p>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    variant={hasReminder(selectedEvent.id) ? "default" : "outline"}
                    onClick={() => handleToggleReminder(selectedEvent)}
                    className={cn(
                      "flex-1 gap-2",
                      hasReminder(selectedEvent.id) && "bg-amber-500 hover:bg-amber-600"
                    )}
                  >
                    {hasReminder(selectedEvent.id) ? (
                      <><Bell size={18} /> Reminder Set</>
                    ) : (
                      <><BellOff size={18} /> Set Reminder</>
                    )}
                  </Button>
                  
                  {selectedEvent.url && (
                    <Button variant="outline" asChild className="gap-2">
                      <a href={selectedEvent.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink size={18} />
                        View Event
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
