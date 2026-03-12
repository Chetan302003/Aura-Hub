/**
 * Push Notifications Hook
 * 
 * Browser Notification API with Service Worker support
 * Low CPU usage - only checks every 60s
 * 
 * TAURI NOTES:
 * Replace browser notifications with:
 * import { sendNotification } from '@tauri-apps/api/notification';
 */
import { useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUIStore } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { differenceInMinutes, parseISO } from 'date-fns';
import { Bell } from 'lucide-react';

interface EventData {
  id: string;
  title: string;
  start_time: string;
  departure_city: string;
  arrival_city: string;
}

// Notification thresholds in minutes
const THRESHOLDS = [30, 15, 5, 1] as const;

export function usePushNotifications() {
  const { user } = useAuth();
  const notificationsEnabled = useUIStore((s) => s.notificationsEnabled);
  const notifiedRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<number | null>(null);

  // Request notification permission once
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return 'denied';
    if (Notification.permission === 'default') {
      return await Notification.requestPermission();
    }
    return Notification.permission;
  }, []);

  // Show notification with minimal overhead
  const showNotification = useCallback((
    title: string,
    body: string,
    eventId: string,
    threshold: number
  ) => {
    const notifKey = `${eventId}-${threshold}`;
    if (notifiedRef.current.has(notifKey)) return;
    notifiedRef.current.add(notifKey);

    // In-app toast (always works)
    toast(title, {
      description: body,
      duration: 8000,
      icon: <Bell className="w-4 h-4 text-primary" />,
      action: {
        label: 'View',
        onClick: () => { window.location.href = '/events'; },
      },
    });

    // Browser notification (if permitted)
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
        window.location.href = '/events';
        notification.close();
      };

      // Auto-close after 10s to save resources
      setTimeout(() => notification.close(), 10000);
    }
  }, []);

  // Check upcoming events - runs every 60s
  const checkEvents = useCallback(async () => {
    if (!user || !notificationsEnabled) return;

    try {
      // Get user's event participations
      const { data: participations } = await supabase
        .from('event_participants')
        .select('event_id')
        .eq('user_id', user.id);

      if (!participations?.length) return;

      const eventIds = participations.map((p) => p.event_id);
      const now = new Date();

      // Get upcoming events
      const { data: events } = await supabase
        .from('vtc_events')
        .select('id, title, start_time, departure_city, arrival_city')
        .in('id', eventIds)
        .gte('start_time', now.toISOString())
        .order('start_time', { ascending: true })
        .limit(10);

      if (!events) return;

      // Check each event against thresholds
      for (const event of events) {
        const startTime = parseISO(event.start_time);
        const minutesUntil = differenceInMinutes(startTime, now);

        for (const threshold of THRESHOLDS) {
          if (minutesUntil <= threshold && minutesUntil > threshold - 1) {
            const emoji = threshold === 1 ? '🎉' : threshold === 5 ? '🔔' : threshold === 15 ? '⚠️' : '🚛';
            const urgency = threshold === 1 ? 'NOW!' : `in ${threshold} minutes!`;
            
            showNotification(
              `${emoji} Event ${urgency}`,
              `${event.title} - ${event.departure_city} → ${event.arrival_city}`,
              event.id,
              threshold
            );
          }
        }
      }
    } catch (err) {
      console.error('Notification check error:', err);
    }
  }, [user, notificationsEnabled, showNotification]);

  // Setup interval
  useEffect(() => {
    if (!user || !notificationsEnabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    requestPermission();
    checkEvents(); // Initial check

    // Check every 60 seconds (minimal CPU usage)
    intervalRef.current = window.setInterval(checkEvents, 60000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [user, notificationsEnabled, requestPermission, checkEvents]);

  return {
    requestPermission,
    checkNow: checkEvents,
    permission: 'Notification' in window ? Notification.permission : 'denied',
  };
}
