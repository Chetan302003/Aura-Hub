import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TMPPlayer {
  id: number;
  name: string;
  avatar: string;
  smallAvatar: string;
  joinDate: string;
  steamID64: string;
  groupName?: string;
  groupColor?: string;
  banned: boolean;
  displayVTCHistory: boolean;
  vtc?: {
    id: number;
    name: string;
    tag: string;
    inVTC: boolean;
    memberID: number;
  };
}

export interface TMPEvent {
  id: number;
  name: string;
  slug: string;
  game: string;
  server: {
    id: number;
    name: string;
  };
  language: string;
  departure: {
    location: string;
    city: string;
  };
  arrive: {
    location: string;
    city: string;
  };
  startAt: string;
  meetupAt?: string;
  banner?: string;
  map?: string;
  description?: string;
  attendances: {
    confirmed: number;
    unsure: number;
  };
  vtc?: {
    id: number;
    name: string;
  };
  user: {
    id: number;
    username: string;
  };
  featured: boolean;
}

export interface TMPServer {
  id: number;
  game: string;
  ip: string;
  port: number;
  name: string;
  shortname: string;
  idprefix?: string;
  online: boolean;
  players: number;
  queue: number;
  maxplayers: number;
  mapid: number;
  displayorder: number;
  speedlimiter: number;
  collisions: boolean;
  carsforplayers: boolean;
  policecarsforplayers: boolean;
  afkenabled: boolean;
  event: boolean;
  specialEvent: boolean;
  promods: boolean;
  syncdelay: number;
}

export function useTruckersMP() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Safely grab data whether edge function unwraps it or keeps the response wrapper
  const extractData = (data: any) => {
    if (!data) return null;
    if (Array.isArray(data)) return data;
    if (data.response !== undefined) return data.response;
    return data;
  };

  // Fetch player data by TruckersMP ID using edge function
  const getPlayer = useCallback(async (tmpId: string): Promise<TMPPlayer | null> => {
    if (!tmpId || !/^\d+$/.test(tmpId)) {
      return null;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('tmp-player', {
        body: { tmpId },
      });

      if (fnError) throw fnError;
      return extractData(data) || null;
    } catch (err) {
      console.error('[TMP] Error fetching player:', err);
      setError('Failed to fetch player data');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get player avatar URL directly from TruckersMP (no CORS for images)
  const getPlayerAvatarUrl = useCallback((tmpId: string): string => {
    if (!tmpId || !/^\d+$/.test(tmpId)) {
      return '';
    }
    // TruckersMP avatar URLs follow this pattern
    return `https://truckersmp.com/user/${tmpId}/avatar`;
  }, []);

  // Fetch player avatar using edge function
  const fetchPlayerAvatar = useCallback(async (tmpId: string): Promise<string | null> => {
    if (!tmpId || !/^\d+$/.test(tmpId)) return null;

    try {
      const { data, error: fnError } = await supabase.functions.invoke('tmp-player', {
        body: { tmpId },
      });

      if (fnError) throw fnError;

      const extracted = extractData(data);
      return extracted?.avatar || null;
    } catch (err) {
      console.error('[TMP] Error fetching avatar:', err);
      return null;
    }
  }, []);

  // Fetch upcoming events using edge function
  const getEvents = useCallback(async (): Promise<TMPEvent[]> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('tmp-events', {});

      if (fnError) throw fnError;
      const rawEvents = extractData(data) || [];
      return rawEvents.map((e: any) => ({
        ...e,
        startAt: e.startAt || e.start_at,
        meetupAt: e.meetupAt || e.meetup_at
      }));
    } catch (err) {
      console.error('[TMP] Error fetching events:', err);
      setError('Failed to fetch events');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch VTC specific events from TruckersMP API using edge function
  const getVTCEvents = useCallback(async (): Promise<TMPEvent[]> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('vtc-events', {});

      if (fnError) throw fnError;

      const rawEvents = extractData(data) || [];
      return rawEvents.map((e: any) => ({
        ...e,
        startAt: e.startAt || e.start_at,
        meetupAt: e.meetupAt || e.meetup_at
      }));
    } catch (err) {
      console.error('[TMP] Error fetching VTC events:', err);
      setError('Failed to fetch VTC events');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch server status using edge function
  const getServers = useCallback(async (): Promise<TMPServer[]> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('tmp-servers', {});

      if (fnError) throw fnError;
      return extractData(data) || [];
    } catch (err) {
      console.error('[TMP] Error fetching servers:', err);
      setError('Failed to fetch servers');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Validate TruckersMP ID format
  const isValidTMPId = useCallback((tmpId: string): boolean => {
    return /^\d+$/.test(tmpId);
  }, []);

  return {
    loading,
    error,
    getPlayer,
    getPlayerAvatarUrl,
    fetchPlayerAvatar,
    getEvents,
    getVTCEvents,
    getServers,
    isValidTMPId,
  };
}
