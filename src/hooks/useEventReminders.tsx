import { useEffect, useCallback, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUIStore, useEventRemindersStore } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { differenceInMinutes, parseISO, format } from 'date-fns';
import { Bell, Calendar, CheckCircle } from 'lucide-react';

interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  departure: string;
  arrival: string;
  type: 'tmp' | 'vtc';
  url?: string;
}

// Notification thresholds in minutes
const THRESHOLDS = [30, 15, 5, 1] as const;

// Local storage key for reminders
const REMINDERS_STORAGE_KEY = 'aura-event-reminders';

/**
 * Hook for event reminder notifications
 * Supports both VTC events and TMP events from the calendar
 */
export function useEventReminders() {
  const { user } = useAuth();
  const notificationsEnabled = useUIStore((s) => s.notificationsEnabled);
  const notifiedRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<number | null>(null);
  const [reminderEvents, setReminderEvents] = useState<CalendarEvent[]>([]);

  // Load saved reminders from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(REMINDERS_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as CalendarEvent[];
        // Filter out past events
        const now = new Date();
        const validReminders = parsed.filter(e => new Date(e.startTime) > now);
        setReminderEvents(validReminders);
        // Clean up storage
        localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(validReminders));
      } catch (e) {
        console.error('Failed to load reminders:', e);
      }
    }
  }, []);

  // Save reminders to localStorage
  const saveReminders = useCallback((events: CalendarEvent[]) => {
    localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(events));
  }, []);

  // Request notification permission
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return 'denied';
    if (Notification.permission === 'default') {
      return await Notification.requestPermission();
    }
    return Notification.permission;
  }, []);

  // Add event to reminders
  const addReminder = useCallback((event: CalendarEvent) => {
    setReminderEvents(prev => {
      // Check if already exists
      if (prev.some(e => e.id === event.id)) {
        toast.info('Reminder already set', {
          description: `You'll be notified before "${event.title}"`,
        });
        return prev;
      }
      
      const updated = [...prev, event];
      saveReminders(updated);
      
      toast.success('Reminder set!', {
        description: `We'll notify you 30, 15, 5, and 1 minute before the event.`,
        icon: <Bell className="w-4 h-4 text-primary" />,
      });
      
      // Request permission if not already granted
      requestPermission();
      
      return updated;
    });
  }, [saveReminders, requestPermission]);

  // Remove event from reminders
  const removeReminder = useCallback((eventId: string) => {
    setReminderEvents(prev => {
      const updated = prev.filter(e => e.id !== eventId);
      saveReminders(updated);
      
      toast.success('Reminder removed', {
        icon: <CheckCircle className="w-4 h-4 text-muted-foreground" />,
      });
      
      return updated;
    });
  }, [saveReminders]);

  // Check if event has reminder
  const hasReminder = useCallback((eventId: string) => {
    return reminderEvents.some(e => e.id === eventId);
  }, [reminderEvents]);

  // Toggle reminder for event
  const toggleReminder = useCallback((event: CalendarEvent) => {
    if (hasReminder(event.id)) {
      removeReminder(event.id);
    } else {
      addReminder(event);
    }
  }, [hasReminder, removeReminder, addReminder]);

  // Show notification
  const showNotification = useCallback((
    title: string,
    body: string,
    eventId: string,
    threshold: number,
    url?: string
  ) => {
    const notifKey = `${eventId}-${threshold}`;
    if (notifiedRef.current.has(notifKey)) return;
    notifiedRef.current.add(notifKey);

    // In-app toast
    toast(title, {
      description: body,
      duration: 10000,
      icon: <Bell className="w-4 h-4 text-primary" />,
      action: url ? {
        label: 'View',
        onClick: () => { 
          if (url.startsWith('http')) {
            window.open(url, '_blank');
          } else {
            window.location.href = url;
          }
        },
      } : undefined,
    });

    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: '/pwa-192x192.png',
        tag: notifKey,
        silent: false,
        requireInteraction: threshold <= 5,
      });

      notification.onclick = () => {
        window.focus();
        if (url) {
          if (url.startsWith('http')) {
            window.open(url, '_blank');
          } else {
            window.location.href = url;
          }
        }
        notification.close();
      };

      setTimeout(() => notification.close(), 15000);
    }
  }, []);

  // Check all reminder events
  const checkReminders = useCallback(async () => {
    if (!notificationsEnabled) return;

    const now = new Date();
    let hasChanges = false;
    const validReminders: CalendarEvent[] = [];

    for (const event of reminderEvents) {
      const startTime = new Date(event.startTime);
      
      // Skip past events
      if (startTime < now) {
        hasChanges = true;
        continue;
      }
      
      validReminders.push(event);
      const minutesUntil = differenceInMinutes(startTime, now);

      for (const threshold of THRESHOLDS) {
        // Check if within threshold window (threshold to threshold-1 minutes)
        if (minutesUntil <= threshold && minutesUntil > threshold - 1) {
          const emoji = threshold === 1 ? '🎉' : threshold === 5 ? '🔔' : threshold === 15 ? '⚠️' : '🚛';
          const urgency = threshold === 1 ? 'NOW!' : `in ${threshold} minutes!`;
          const typeLabel = event.type === 'tmp' ? 'TMP Event' : 'VTC Convoy';
          
          showNotification(
            `${emoji} ${typeLabel} ${urgency}`,
            `${event.title}\n${event.departure} → ${event.arrival}`,
            event.id,
            threshold,
            event.url || '/calendar'
          );
        }
      }
    }

    // Update storage if past events were removed
    if (hasChanges) {
      setReminderEvents(validReminders);
      saveReminders(validReminders);
    }

    // Also check VTC events user is participating in
    if (user) {
      await checkVTCParticipations();
    }
  }, [reminderEvents, notificationsEnabled, user, showNotification, saveReminders]);

  // Check VTC events the user has RSVP'd to
  const checkVTCParticipations = useCallback(async () => {
    if (!user) return;

    try {
      const { data: participations } = await supabase
        .from('event_participants')
        .select('event_id')
        .eq('user_id', user.id);

      if (!participations?.length) return;

      const eventIds = participations.map(p => p.event_id);
      const now = new Date();

      const { data: events } = await supabase
        .from('vtc_events')
        .select('id, title, start_time, departure_city, arrival_city')
        .in('id', eventIds)
        .gte('start_time', now.toISOString())
        .order('start_time', { ascending: true })
        .limit(20);

      if (!events) return;

      for (const event of events) {
        const startTime = parseISO(event.start_time);
        const minutesUntil = differenceInMinutes(startTime, now);

        for (const threshold of THRESHOLDS) {
          if (minutesUntil <= threshold && minutesUntil > threshold - 1) {
            const emoji = threshold === 1 ? '🎉' : threshold === 5 ? '🔔' : threshold === 15 ? '⚠️' : '🚛';
            const urgency = threshold === 1 ? 'NOW!' : `in ${threshold} minutes!`;
            
            showNotification(
              `${emoji} VTC Event ${urgency}`,
              `${event.title}\n${event.departure_city} → ${event.arrival_city}`,
              `vtc-rsvp-${event.id}`,
              threshold,
              '/events'
            );
          }
        }
      }
    } catch (err) {
      console.error('Error checking VTC participations:', err);
    }
  }, [user, showNotification]);

  // Setup interval
  useEffect(() => {
    if (!notificationsEnabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    requestPermission();
    checkReminders();

    // Check every 60 seconds
    intervalRef.current = window.setInterval(checkReminders, 60000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [notificationsEnabled, requestPermission, checkReminders]);

  return {
    reminderEvents,
    addReminder,
    removeReminder,
    hasReminder,
    toggleReminder,
    requestPermission,
    checkNow: checkReminders,
    permission: 'Notification' in window ? Notification.permission : 'denied',
  };
}

// Export type for use in other components
export type { CalendarEvent };
