/**
 * Zustand Store - Lightweight State Management
 * 
 * ~1KB gzipped, minimal re-renders, no context providers needed
 * Optimized for Tauri desktop overlay with low memory footprint
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ============ UI State ============
interface UIState {
  sidebarOpen: boolean;
  overlayMode: boolean;
  alwaysOnTop: boolean;
  notificationsEnabled: boolean;
  setSidebarOpen: (open: boolean) => void;
  setOverlayMode: (enabled: boolean) => void;
  setAlwaysOnTop: (enabled: boolean) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: false,
      overlayMode: false,
      alwaysOnTop: false,
      notificationsEnabled: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setOverlayMode: (enabled) => set({ overlayMode: enabled }),
      setAlwaysOnTop: (enabled) => set({ alwaysOnTop: enabled }),
      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    }),
    {
      name: 'aura-ui-settings',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        overlayMode: state.overlayMode,
        alwaysOnTop: state.alwaysOnTop,
        notificationsEnabled: state.notificationsEnabled,
      }),
    }
  )
);

// ============ Telemetry State ============
interface TelemetryData {
  speed: number;
  fuel: number;
  cargo: string | null;
  destination: string | null;
  origin: string | null;
  distance: number;
  earnings: number;
  connected: boolean;
  lastUpdate: number;
}

interface TelemetryState extends TelemetryData {
  updateTelemetry: (data: Partial<TelemetryData>) => void;
  resetTelemetry: () => void;
}

const initialTelemetry: TelemetryData = {
  speed: 0,
  fuel: 100,
  cargo: null,
  destination: null,
  origin: null,
  distance: 0,
  earnings: 0,
  connected: false,
  lastUpdate: 0,
};

export const useTelemetryStore = create<TelemetryState>()((set) => ({
  ...initialTelemetry,
  updateTelemetry: (data) => set((state) => ({ ...state, ...data, lastUpdate: Date.now() })),
  resetTelemetry: () => set(initialTelemetry),
}));

// ============ Event Reminders State ============
interface EventReminder {
  eventId: string;
  title: string;
  startTime: string;
  notifiedAt: Set<string>;
}

interface EventRemindersState {
  reminders: Map<string, EventReminder>;
  addReminder: (reminder: EventReminder) => void;
  markNotified: (eventId: string, threshold: string) => void;
  clearReminders: () => void;
  hasNotified: (eventId: string, threshold: string) => boolean;
}

export const useEventRemindersStore = create<EventRemindersState>()((set, get) => ({
  reminders: new Map(),
  addReminder: (reminder) => set((state) => {
    const newReminders = new Map(state.reminders);
    newReminders.set(reminder.eventId, reminder);
    return { reminders: newReminders };
  }),
  markNotified: (eventId, threshold) => set((state) => {
    const reminder = state.reminders.get(eventId);
    if (reminder) {
      reminder.notifiedAt.add(threshold);
      const newReminders = new Map(state.reminders);
      newReminders.set(eventId, reminder);
      return { reminders: newReminders };
    }
    return state;
  }),
  clearReminders: () => set({ reminders: new Map() }),
  hasNotified: (eventId, threshold) => {
    const reminder = get().reminders.get(eventId);
    return reminder?.notifiedAt.has(threshold) ?? false;
  },
}));

// ============ Performance Monitoring ============
interface PerformanceState {
  fps: number;
  memoryUsage: number;
  lastMeasure: number;
  setFps: (fps: number) => void;
  setMemoryUsage: (usage: number) => void;
}

export const usePerformanceStore = create<PerformanceState>()((set) => ({
  fps: 60,
  memoryUsage: 0,
  lastMeasure: 0,
  setFps: (fps) => set({ fps, lastMeasure: Date.now() }),
  setMemoryUsage: (usage) => set({ memoryUsage: usage }),
}));
