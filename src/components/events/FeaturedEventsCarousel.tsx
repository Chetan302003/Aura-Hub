import { useState, useEffect, useCallback } from 'react';
import { GlassCard } from '@/components/layout/GlassCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useTruckersMP, TMPEvent } from '@/hooks/useTruckersMP';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow, parseISO, isFuture } from 'date-fns';
import {
  Calendar,
  MapPin,
  Users,
  Clock,
  ChevronLeft,
  ChevronRight,
  Truck,
  Globe,
  ExternalLink
} from 'lucide-react';

interface VTCEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  game: string;
  departure_city: string;
  arrival_city: string;
  start_time: string;
  participant_count?: number;
  banner_url: string | null;
}

interface CarouselEvent {
  id: string;
  title: string;
  type: 'vtc' | 'tmp';
  game: string;
  departure: string;
  arrival: string;
  startTime: string;
  participants?: number;
  banner?: string | null;
  tmpUrl?: string;
}

export function FeaturedEventsCarousel() {
  const navigate = useNavigate();
  const { getEvents } = useTruckersMP();
  const [events, setEvents] = useState<CarouselEvent[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);

    // Fetch VTC events
    const { data: vtcData } = await supabase
      .from('vtc_events')
      .select('*')
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(5);

    // Fetch TMP events
    const tmpEvents = await getEvents();

    const combinedEvents: CarouselEvent[] = [];

    // Add VTC events
    if (vtcData) {
      for (const event of vtcData) {
        const { count } = await supabase
          .from('event_participants')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', event.id);

        combinedEvents.push({
          id: event.id,
          title: event.title,
          type: 'vtc',
          game: event.game,
          departure: event.departure_city,
          arrival: event.arrival_city,
          startTime: event.start_time,
          participants: count || 0,
          banner: event.banner_url
        });
      }
    }

    // Add TMP events (first 3)
    if (Array.isArray(tmpEvents)) {
      tmpEvents.slice(0, 3).forEach((event: TMPEvent) => {
        if (!event) return;
        combinedEvents.push({
          id: event.id?.toString() || Math.random().toString(),
          title: event.name || 'Unknown',
          type: 'tmp',
          game: event.game || 'ETS2',
          departure: event.departure?.city || 'TBA',
          arrival: event.arrive?.city || 'TBA',
          startTime: event.startAt || new Date().toISOString(), // Fallback to current time safely
          participants: event.attendances?.confirmed || 0,
          banner: event.banner,
          tmpUrl: event.slug ? `https://truckersmp.com/events/${event.slug}` : undefined
        });
      });
    }

    // Sort by start time
    combinedEvents.sort((a, b) =>
      new Date((a.startTime || '').replace(' ', 'T')).getTime() - new Date((b.startTime || '').replace(' ', 'T')).getTime()
    );

    setEvents(combinedEvents.slice(0, 8));
    setLoading(false);
  };

  const nextSlide = useCallback(() => {
    setCurrentIndex(prev => (prev + 1) % Math.max(events.length - 1, 1));
  }, [events.length]);

  const prevSlide = () => {
    setCurrentIndex(prev => (prev - 1 + events.length) % Math.max(events.length - 1, 1));
  };

  // Auto-advance carousel
  useEffect(() => {
    if (events.length <= 2) return;
    const interval = setInterval(nextSlide, 5000);
    return () => clearInterval(interval);
  }, [events.length, nextSlide]);

  const getGameBadge = (game: string) => {
    if (game.toLowerCase().includes('ets') || game.toLowerCase().includes('euro')) {
      return <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/40">ETS2</Badge>;
    }
    return <Badge variant="outline" className="bg-orange-500/20 text-orange-400 border-orange-500/40">ATS</Badge>;
  };

  if (loading) {
    return (
      <GlassCard>
        <div className="h-48 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading events...</div>
        </div>
      </GlassCard>
    );
  }

  if (events.length === 0) {
    return (
      <GlassCard>
        <div className="h-48 flex flex-col items-center justify-center gap-4">
          <Calendar size={40} className="text-muted-foreground" />
          <p className="text-muted-foreground">No upcoming events</p>
          <Button variant="outline" onClick={() => navigate('/events')} className="rounded-full">
            View All Events
          </Button>
        </div>
      </GlassCard>
    );
  }

  const visibleEvents = events.slice(currentIndex, currentIndex + 2);
  if (visibleEvents.length < 2 && events.length > 1) {
    visibleEvents.push(...events.slice(0, 2 - visibleEvents.length));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Calendar size={20} className="text-primary" />
          Upcoming Events
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={prevSlide}
            className="h-8 w-8 rounded-full"
            disabled={events.length <= 2}
          >
            <ChevronLeft size={16} />
          </Button>
          <span className="text-xs text-muted-foreground">
            {currentIndex + 1} / {Math.max(events.length - 1, 1)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={nextSlide}
            className="h-8 w-8 rounded-full"
            disabled={events.length <= 2}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visibleEvents.map((event) => (
          <div
            key={`${event.type}-${event.id}`}
            className="glass-card p-6 group cursor-pointer hover:border-primary/50 transition-all duration-300"
            onClick={() => {
              if (event.type === 'tmp' && event.tmpUrl) {
                window.open(event.tmpUrl, '_blank');
              } else {
                navigate('/events');
              }
            }}
          >
            <div className="flex flex-col h-full">
              {/* Banner */}
              {event.banner && (
                <div className="h-24 -mx-6 -mt-6 mb-4 overflow-hidden rounded-t-2xl">
                  <img
                    src={event.banner}
                    alt={event.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
              )}

              {/* Content */}
              <div className="flex-1 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-semibold line-clamp-1 group-hover:text-primary transition-colors">
                    {event.title}
                  </h4>
                  <div className="flex items-center gap-1.5">
                    {getGameBadge(event.game)}
                    <Badge
                      variant="outline"
                      className={event.type === 'vtc'
                        ? 'bg-primary/20 text-primary border-primary/40'
                        : 'bg-purple-500/20 text-purple-400 border-purple-500/40'
                      }
                    >
                      {event.type === 'vtc' ? <Truck size={10} /> : <Globe size={10} />}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin size={14} className="text-primary flex-shrink-0" />
                  <span className="truncate">{event.departure} → {event.arrival}</span>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Clock size={12} />
                    <span>{formatDistanceToNow(parseISO((event.startTime || '').replace(' ', 'T') || new Date().toISOString()), { addSuffix: true })}</span>
                  </div>
                  {event.participants !== undefined && (
                    <div className="flex items-center gap-1.5">
                      <Users size={12} />
                      <span>{event.participants} attending</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {format(parseISO((event.startTime || '').replace(' ', 'T') || new Date().toISOString()), 'MMM dd, HH:mm')}
                </span>
                {event.type === 'tmp' && (
                  <ExternalLink size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        className="w-full rounded-full"
        onClick={() => navigate('/events')}
      >
        View All Events
      </Button>
    </div>
  );
}
