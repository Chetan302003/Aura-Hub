import { useCallback, useRef } from 'react';
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '@/lib/tauri';

/**

 * Telemetry data structure from ETS2/ATS telemetry server

 * This hook is designed to be Tauri-ready - the WebSocket connection

 * can be replaced with Tauri commands when converting to desktop app.

 *

 * For desktop app conversion:

 * 1. Use Tauri's `invoke` to call Rust functions that read telemetry

 * 2. Or use Tauri's HTTP client to connect to local telemetry server

 * 3. The data structure remains the same

 */



export interface TelemetryTruck {
  id: string;
  make: string;
  model: string;
  speed: number;
  speedLimit: number;
  cruiseControl: number;
  cruiseControlOn: boolean;
  fuel: number;
  fuelCapacity: number;
  fuelAvgConsumption: number;
  odometer: number;
  engineRpm: number;
  engineRpmMax: number;
  gear: number;
  gearForward: number
  gearReverse: number;
  engineOn: boolean;
  electricOn: boolean;
  wipersOn: boolean;
  lightsBeam: {
    low: boolean;
    high: boolean;
  };

  blinker: {

    left: boolean;

    right: boolean;

  };

  damage: {

    engine: number;

    transmission: number;

    cabin: number;
    chassis: number;
    wheels: number;
    total: number;

  };

}



export interface TelemetryTrailer {

  attached: boolean;

  id: string;

  name: string;

  mass: number;

  damage: number;

}



export interface TelemetryJob {

  income: number;

  deadlineTime: string;

  remainingTime: number;

  sourceCity: string;

  sourceCompany: string;

  destinationCity: string;

  destinationCompany: string;

  cargo: string | {

    name: string;

    mass: number;

    cargo_damage: number;

    id?: string;

  };

  cargoMass: number;

  cargoDamage: number;

  isSpecial: boolean;

  market: string;

}



export interface TelemetryNavigation {

  estimatedTime: number;

  estimatedDistance: number;

  speedLimit: number;

}



export interface TelemetryGame {

  connected: boolean;

  paused: boolean;

  time: string;

  timeScale: number;

  nextRestStop: number;

  version: string;

  game: 'ets2' | 'ats' | 'unknown';

  telemetryVersion: string;

}



export interface TelemetryData {

  game: TelemetryGame;

  truck: TelemetryTruck;

  trailer: TelemetryTrailer;

  job: TelemetryJob | null;

  navigation: TelemetryNavigation;

}



export interface TelemetryConfig {

  /** WebSocket URL for telemetry server (default: ws://localhost:25555) */

  wsUrl?: string;

  /** HTTP URL for telemetry server (default: http://localhost:25555) */

  httpUrl?: string;

  /** Polling interval in ms when using HTTP (default: 100) */

  pollingInterval?: number;

  /** Connection mode: 'websocket' | 'http' | 'auto' (default: 'auto') */

  mode?: 'websocket' | 'http' | 'auto';

  /** Enable auto-reconnect (default: true) */

  autoReconnect?: boolean;

  /** Reconnect delay in ms (default: 3000) */

  reconnectDelay?: number;

}



const defaultConfig: Required<TelemetryConfig> = {

  wsUrl: 'ws://localhost:25555',

  httpUrl: 'http://localhost:25555/api/ets2/telemetry',

  pollingInterval: 100,

  mode: 'auto',

  autoReconnect: true,

  reconnectDelay: 3000,

};



const defaultTelemetry: TelemetryData = {

  game: {

    connected: false,

    paused: false,

    time: '',

    timeScale: 1,

    nextRestStop: 0,

    version: '',

    game: 'unknown',

    telemetryVersion: '',

  },

  truck: {

    id: '',

    make: '',

    model: '',

    speed: 0,

    speedLimit: 0,

    cruiseControl: 0,

    cruiseControlOn: false,

    fuel: 0,

    fuelCapacity: 0,

    fuelAvgConsumption: 0,

    odometer: 0,

    engineRpm: 0,

    engineRpmMax: 0,

    gear: 0,

    gearForward: 0,

    gearReverse: 0,

    engineOn: false,
    electricOn: false,
    wipersOn: false,
    lightsBeam: { low: false, high: false },
    blinker: { left: false, right: false },
    damage: { engine: 0, transmission: 0, cabin: 0, chassis: 0, wheels: 0, total: 0 },

  },

  trailer: {

    attached: false,

    id: '',

    name: '',

    mass: 0,

    damage: 0,

  },

  job: null,

  navigation: {

    estimatedTime: 0,

    estimatedDistance: 0,

    speedLimit: 0,

  },

};



/**

 * Hook for reading ETS2/ATS telemetry data

 *

 * TAURI CONVERSION NOTES:

 * -----------------------

 * When converting to Tauri desktop app:

 *

 * 1. Replace WebSocket/HTTP with Tauri invoke:

 *    ```rust

 *    #[tauri::command]

 *    fn get_telemetry() -> Result<TelemetryData, String> {

 *      // Read from telemetry SDK or shared memory

 *    }

 *    ```

 *

 * 2. Use Tauri events for real-time updates:

 *    ```typescript

 *    import { listen } from '@tauri-apps/api/event';

 *    listen('telemetry-update', (event) => {

 *      setData(event.payload as TelemetryData);

 *    });

 *    ```

 *

 * 3. The hook interface stays the same - just swap the data source

 */
// ... Keep your TelemetryTruck, TelemetryTrailer, TelemetryJob, etc. interfaces here ...

export function useTelemetry(config: TelemetryConfig = {}) {
  const [data, setData] = useState<TelemetryData>(defaultTelemetry);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  /**
   * TAURI COMMANDS
   */
  const connect = useCallback(async () => {
    if (!isTauri()) return;
    try {
      await invoke('get_telemetry_data');
      setConnected(true);
      setError(null);
    } catch (err) {
      setError("Connection Failed");
    }
  }, []);

  const disconnect = useCallback(() => setConnected(false), []);

  /**
   * MASTER PARSER: Maps Rust v1.2.0 JSON to Aura Hub Interfaces
   */
  const parseTelemetryResponse = useCallback((raw: any): TelemetryData => {
    try {
      // 1. TRUCK MAPPING (Using .current.dashboard and .constants)
      const truck: TelemetryTruck = {
        id: String(raw.truck?.constants?.id || ''),
        make: String(raw.truck?.constants?.brand || 'Truck'),
        model: String(raw.truck?.constants?.name || ''),
        speed: Math.abs(Number(raw.truck?.current?.dashboard?.speed?.value || 0)) * 3.6,
        speedLimit: Number(raw.navigation?.speed_limit?.value || 0) * 3.6,
        cruiseControl: Number(raw.truck?.current?.dashboard?.cruise_control_speed?.value || 0) * 3.6,
        cruiseControlOn: Boolean(raw.truck?.current?.dashboard?.cruise_control),
        fuel: Number(raw.truck?.current?.dashboard?.fuel?.amount || 0),
        fuelCapacity: Number(raw.truck?.constants?.capacity?.fuel || 1),
        fuelAvgConsumption: Number(raw.truck?.current?.dashboard?.fuel?.average_consumption || 0),
        odometer: Number(raw.truck?.current?.dashboard?.odometer || 0),
        engineRpm: Number(raw.truck?.current?.dashboard?.rpm || 0),
        engineRpmMax: Number(raw.truck?.constants?.motor?.engine_rpm_max || 2500),
        gear: Number(raw.truck?.current?.dashboard?.gear_dashboards || 0),
        gearForward: Number(raw.truck?.constants?.motor?.forward_gear_count || 12),
        gearReverse: Number(raw.truck?.constants?.motor?.reverse_gear_count || 2),
        engineOn: Boolean(raw.truck?.current?.engine_enabled),
        electricOn: Boolean(raw.truck?.current?.electric_enabled),
        wipersOn: Boolean(raw.truck?.current?.dashboard?.wipers),
        lightsBeam: {
          low: Boolean(raw.truck?.current?.lights?.beam_low),
          high: Boolean(raw.truck?.current?.lights?.beam_high),
        },
        blinker: {
          left: Boolean(raw.truck?.current?.lights?.blinker_left_on),
          right: Boolean(raw.truck?.current?.lights?.blinker_right_on),
        },
        damage: {
          engine: Number(raw.truck?.current?.damage?.engine || 0),
          transmission: Number(raw.truck?.current?.damage?.transmission || 0),
          cabin: Number(raw.truck?.current?.damage?.cabin || 0),
          chassis: Number(raw.truck?.current?.damage?.chassis || 0),
          wheels: Number(raw.truck?.current?.damage?.wheels_avg || 0),
          total: Number(raw.truck?.current?.damage?.chassis || 0),
        },
      };

      // 2. TRAILER MAPPING (Using plural trailers[0])
      const mainTrailer = raw.trailers?.[0];
      const trailer: TelemetryTrailer = {
        attached: Boolean(mainTrailer?.attached),
        id: String(mainTrailer?.id || ''),
        name: String(mainTrailer?.brand || 'Trailer'),
        mass: Number(mainTrailer?.cargo?.mass || 0),
        damage: Number(mainTrailer?.damage?.chassis || 0),
      };

      // 3. JOB MAPPING (Using cargo_loaded and city_source)
      // FIX here: The SDK often just sets job to a structure even if there is no job.
      // E.g., raw.job?.cargo_loaded is a boolean that MUST be strictly true
      const hasJob = raw.job && raw.job.cargo_loaded === true;
      const job: TelemetryJob | null = hasJob ? {
        income: Number(raw.job.income || 0),
        deadlineTime: String(raw.job.delivery_time || ''),
        remainingTime: Number(raw.job.remaining_delivery_time || 0),
        sourceCity: String(raw.job.city_source || ''),
        sourceCompany: String(raw.job.company_source || ''),
        destinationCity: String(raw.job.city_destination || ''),
        destinationCompany: String(raw.job.company_destination || ''),
        cargo: String(raw.job.cargo?.name || 'Cargo'),
        cargoMass: Number(raw.job.cargo?.mass || 0),
        // SDK 1.2+ uses cargo.damage sometimes instead of job.cargo_damage, check both
        cargoDamage: Number(raw.job.cargo?.damage || raw.job.cargo_damage || mainTrailer?.cargo?.damage || mainTrailer?.damage?.cargo || 0), 
        isSpecial: Boolean(raw.job.special_job),
        market: String(raw.job.market || ''),
      } : null;

      return {
        game: {
          connected: Boolean(raw.sdk_active),
          paused: Boolean(raw.paused),
          time: String(raw.common?.game_time || ''),
          timeScale: Number(raw.common?.scale || 1),
          nextRestStop: Number(raw.common?.next_rest_stop || 0),
          version: `${raw.game_version?.major || 1}.${raw.game_version?.minor || 0}`,
          game: (raw.game || 'unknown') as 'ets2' | 'ats' | 'unknown',
          telemetryVersion: `${raw.telemetry_version?.major || 1}`,
        },
        truck,
        trailer,
        job,
        navigation: {
          estimatedTime: Number(raw.navigation?.navigation_time || 0),
          estimatedDistance: Number(raw.navigation?.navigation_distance || 0),
          speedLimit: Number(raw.navigation?.speed_limit?.value || 0) * 3.6,
        },
      };
    } catch (err) {
      console.error('Aura Parser Error:', err);
      return defaultTelemetry;
    }
  }, []);

  // TAURI POLLING
  useEffect(() => {
    if (!isTauri()) return;

    let isMounted = true;
    let timerId: ReturnType<typeof setTimeout>;

    const poll = async () => {
      if (!isMounted) return;

      try {
        const rawJson = await invoke<string>('get_telemetry_data');
        const rawObj = JSON.parse(rawJson);

        if (rawObj.closing || !rawObj.sdk_active) {
          setData(defaultTelemetry);
          setConnected(false);
          // "Peace Period" is critical. 3s gives the game plenty of room to shut down.
          timerId = setTimeout(poll, 10000);
        } else {
          // SUCCESS: The game is active. 
          setData(parseTelemetryResponse(rawObj));
          setConnected(true);
          timerId = setTimeout(poll, 500);
        }
      } catch (err) {
        setConnected(false);
        timerId = setTimeout(poll, 10000);
      }
    };

    poll();
    return () => {
      isMounted = false;
      clearTimeout(timerId);
    };
  }, [parseTelemetryResponse]);

  return {
    data,
    connected,
    error,
    lastUpdate,
    isJobActive: !!data.job,
    isGameRunning: data.game.connected && !data.game.paused,
    connect,
    disconnect,
  };
}
// The thing added here is sifted to another file, name as""use telementry extra.txt"
// upto here.

export type JobState = 'NO_JOB' | 'JOB_DETECTED' | 'JOB_ACTIVE' | 'JOB_DISCONNECTED' | 'JOB_FINISHED';

export function useAutoJobLogger() {
  const { data, connected, isJobActive } = useTelemetry();

  const [pendingJob, setPendingJob] = useState<TelemetryJob | null>(null);
  const [jobState, setJobState] = useState<JobState>('NO_JOB');
  const [detectionOdometer, setDetectionOdometer] = useState<number | null>(null);

  // Timing references for state machine delays
  const stateTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [jobStartData, setJobStartData] = useState<{
    startOdometer: number;
    startFuel: number;
    plannedDistance: number;
    isLogged?: boolean;
    jobId: string;
  } | null>(null);

  const [jobJustFinished, setJobJustFinished] = useState(false);

  // Helper to generate a unique-ish ID for a job (fingerprint)
  const getJobId = useCallback((job: TelemetryJob, plannedDistance: number) => {
    const cargoName = typeof job.cargo === 'object' ? job.cargo.name : job.cargo;
    return `${cargoName}-${job.sourceCity}-${job.destinationCity}-${Math.round(plannedDistance)}`;
  }, []);



  // Persistence Keys
  const STORAGE_KEY_JOB = 'aura_last_active_job';
  const STORAGE_KEY_START = 'aura_job_start_data';

  // Track job start with persistence
  useEffect(() => {
    // 1. Check for persisted data on mount or when telemetry connects
    if (connected && !jobStartData) {
      const savedJob = localStorage.getItem(STORAGE_KEY_JOB);
      const savedStart = localStorage.getItem(STORAGE_KEY_START);

      if (savedJob && savedStart && data.job) {
        try {
          const parsedJob = JSON.parse(savedJob);
          const parsedStart = JSON.parse(savedStart);
          // Note: When parsing, we need a current JobId to compare if the game is still active,
          // but if we are just comparing against the CURRENT game state, we need to pass planned distance.
          // However, plannedDistance of the current session should match the parsed session if it's the SAME job.
          const currentJobId = getJobId(data.job, parsedStart.plannedDistance);

          if (parsedStart.jobId === currentJobId) {
            console.log('Aura: Resuming persisted job tracking');
            setPendingJob(parsedJob);
            setJobStartData(parsedStart);
            return;
          } else {
            // Job ID mismatch - the previous job was likely cancelled or finished while offline
            console.log('Aura: Job mismatch, marking previous as possibly cancelled');
            // Here we could trigger a cancel log if we had an API for it
            localStorage.removeItem(STORAGE_KEY_JOB);
            localStorage.removeItem(STORAGE_KEY_START);
          }
        } catch (e) {
          console.error('Aura: Error restoring job persistence', e);
        }
      }
    }

    // ==========================================
    // STATE MACHINE LOGIC
    // ==========================================

    // 1. Telemetry Disconnected Grace Period
    if (!connected && (jobState === 'JOB_ACTIVE' || jobState === 'JOB_DISCONNECTED')) {
      if (jobState !== 'JOB_DISCONNECTED') {
        setJobState('JOB_DISCONNECTED');
        console.log('Aura: Telemetry disconnected. Entering 30s grace period...');

        if (stateTimerRef.current) clearTimeout(stateTimerRef.current);
        stateTimerRef.current = setTimeout(() => {
          console.log('Aura: Grace period expired. Assuming job was abandoned offline.');
          setJobState('NO_JOB');
          setJobStartData(null);
          setPendingJob(null);
          localStorage.removeItem(STORAGE_KEY_JOB);
          localStorage.removeItem(STORAGE_KEY_START);
        }, 30000); // 30 second disconnect grace period
      }
      return;
    }

    // Clear grace period if we reconnect while still active
    if (connected && jobState === 'JOB_DISCONNECTED' && isJobActive) {
      console.log('Aura: Telemetry reconnected. Resuming active job.');
      if (stateTimerRef.current) clearTimeout(stateTimerRef.current);
      setJobState('JOB_ACTIVE');
    }

    // 2. Job Start Detection
    if (connected && isJobActive && data.job && jobState === 'NO_JOB' && !jobStartData) {
      setJobState('JOB_DETECTED');
      setDetectionOdometer(data.truck.odometer);
      console.log('Aura: Potential new job picked up. Waiting for 0.5km movement to confirm...');
    }

    // 2.5 Job Start Confirmation (Distance moved > 0.5km)
    if (connected && isJobActive && data.job && jobState === 'JOB_DETECTED' && detectionOdometer !== null) {
      if (data.truck.odometer - detectionOdometer > 0.5) {
        console.log('Aura: Job confirmed active (Driver moved 0.5km+). Starting tracking.');

        const plannedDistance = data.navigation.estimatedDistance / 1000;
        const startOdometer = data.truck.odometer;
        const jobId = getJobId(data.job, plannedDistance);

        const newStartData = {
          startOdometer,
          startFuel: data.truck.fuel,
          plannedDistance,
          jobId,
          isLogged: false
        };

        setJobStartData(newStartData);
        setPendingJob(data.job);
        setJobState('JOB_ACTIVE');
        setDetectionOdometer(null);

        localStorage.setItem(STORAGE_KEY_JOB, JSON.stringify(data.job));
        localStorage.setItem(STORAGE_KEY_START, JSON.stringify(newStartData));
      }
    }

    // 3. Keep Track of Latest Valid Data while Active
    if (connected && isJobActive && data.job && jobState === 'JOB_ACTIVE') {
      setPendingJob(data.job);
      setJobJustFinished(false);
    }

    // 4. Job End Detection (Job was Active, now NULL)
    if (connected && !isJobActive && data.job === null && jobState === 'JOB_ACTIVE') {
      console.log('Aura: Job signal lost. Waiting 3 seconds to confirm completion...');
      setJobState('JOB_FINISHED'); // Enter pending finish state

      if (stateTimerRef.current) clearTimeout(stateTimerRef.current);
      stateTimerRef.current = setTimeout(() => {
        // STILL null after 3 seconds? Confirm it's done. Multi-signal verification
        if (!isJobActive && data.job === null && jobStartData && pendingJob) {

          if (!jobStartData.isLogged) {
            console.log('Aura: Job officially completed. Firing trigger.');
            setJobJustFinished(true);

            const updatedStart = { ...jobStartData, isLogged: true };
            setJobStartData(updatedStart);
            localStorage.setItem(STORAGE_KEY_START, JSON.stringify(updatedStart));

            setTimeout(() => {
              setJobJustFinished(false);
              setJobStartData(null);
              setPendingJob(null);
              setJobState('NO_JOB');
              localStorage.removeItem(STORAGE_KEY_JOB);
              localStorage.removeItem(STORAGE_KEY_START);
            }, 5000);
          }
        } else {
          // It was a telemetry glitch, it came back!
          console.log('Aura: False alarm job end. Resuming track.');
          setJobState('JOB_ACTIVE');
        }
      }, 3000); // 3 second end confirmation delay
    }

    // 5. Cleanup stray starts
    if (connected && !isJobActive && data.job === null && jobState === 'JOB_DETECTED') {
      // Detected briefly then cancelled before 0.5km
      setJobState('NO_JOB');
      setDetectionOdometer(null);
    }

  }, [isJobActive, data.job, data.truck.odometer, data.truck.fuel, data.navigation.estimatedDistance, jobStartData, connected, getJobId, jobState, pendingJob, detectionOdometer]);



  const prepareJobData = useCallback(() => {
    // Determine the job payload using pendingJob (the cached most recent active job)
    const activeJob = data.job || pendingJob;
    if (!activeJob || !jobStartData) return null;

    // Use floating point for precision before rounding at the end
    const distanceKm = data.truck.odometer - jobStartData.startOdometer;
    const fuelConsumed = jobStartData.startFuel - data.truck.fuel;

    // Determine status (80% threshold for delivered vs cancelled)
    const plannedDistance = jobStartData.plannedDistance;
    const isCompleted = distanceKm >= plannedDistance * 0.8;
    const status = isCompleted ? 'delivered' : 'cancelled';
    const finalIncome = isCompleted ? activeJob.income : 0;

    return {
      job_id: jobStartData.jobId,
      status,
      planned_distance_km: Math.round(plannedDistance),
      origin_city: activeJob.sourceCity,
      destination_city: activeJob.destinationCity,
      distance_km: Number(distanceKm.toFixed(1)),
      cargo_type: typeof activeJob.cargo === 'string' ? activeJob.cargo : activeJob.cargo.name,
      cargo_weight: activeJob.cargoMass / 1000, // kg to tons
      fuel_consumed: Math.round(fuelConsumed),
      income: finalIncome,
      damage_percent: Number((activeJob.cargoDamage * 100).toFixed(2)),
    };
  }, [data.job, pendingJob, data.truck, jobStartData]);



  return {

    telemetryConnected: connected,
    currentJob: data.job,
    truckData: data.truck,
    pendingJob,
    jobState,
    prepareJobData,
    jobJustFinished,
    clearPendingJob: () => setPendingJob(null),
  };
}