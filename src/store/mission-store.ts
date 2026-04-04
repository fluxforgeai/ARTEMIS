import { create } from 'zustand';
import type { StateVector } from '../data/oem-parser';
import type { DsnStation } from '../data/dsn-parser';

export interface SpacecraftState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  speed: number;
  earthDist: number;
  moonDist: number | null;
}

export type CameraMode = 'free' | 'follow-orion' | 'earth-view' | 'moon-view';

// Space weather types
export type AlertSeverity = 'info' | 'nominal' | 'caution' | 'warning';
export type AlertType = 'radiation' | 'solar' | 'geomagnetic' | 'milestone' | 'system';
export type RadiationZone = 'clear' | 'deep-space' | 'outer-belt' | 'slot-region' | 'inner-belt';
export type RadiationLevel = 'nominal' | 'elevated' | 'high' | 'severe';

export interface Alert {
  id: string;
  severity: AlertSeverity;
  type: AlertType;
  message: string;
  timestamp: number;
  autoDismissMs: number;
}

export interface SpaceWeatherState {
  kpIndex: number;
  solarWindSpeed: number;
  solarWindDensity: number;
  radiationZone: RadiationZone;
  radiationDoseRate: number;
  radiationLevel: RadiationLevel;
  activeEvents: { type: string; description: string }[];
  source: 'synthetic' | 'live';
  lastUpdated: number;
}

interface MissionStore {
  isLoading: boolean;
  oemData: StateVector[] | null;
  moonPosition: { x: number; y: number; z: number } | null;
  spacecraft: SpacecraftState;
  dsnStations: DsnStation[];
  cameraMode: CameraMode;
  chatOpen: boolean;
  hoveredMilestoneHours: number | null;
  spaceWeather: SpaceWeatherState;
  alerts: Alert[];

  setOemData: (data: StateVector[]) => void;
  setMoonPosition: (pos: { x: number; y: number; z: number }) => void;
  setSpacecraft: (state: Partial<SpacecraftState>) => void;
  setDsnStations: (stations: DsnStation[]) => void;
  setCameraMode: (mode: CameraMode) => void;
  toggleChat: () => void;
  setLoading: (loading: boolean) => void;
  setHoveredMilestoneHours: (hours: number | null) => void;
  setSpaceWeather: (data: SpaceWeatherState) => void;
  addAlert: (alert: Omit<Alert, 'id'>) => void;
  dismissAlert: (id: string) => void;
}

export const useMissionStore = create<MissionStore>((set) => ({
  isLoading: true,
  oemData: null,
  moonPosition: null,
  spacecraft: {
    x: 0, y: 0, z: 0,
    vx: 0, vy: 0, vz: 0,
    speed: 0, earthDist: 0, moonDist: null,
  },
  dsnStations: [],
  cameraMode: 'free',
  chatOpen: false,
  hoveredMilestoneHours: null,
  spaceWeather: {
    kpIndex: 3,
    solarWindSpeed: 400,
    solarWindDensity: 5,
    radiationZone: 'clear',
    radiationDoseRate: 0,
    radiationLevel: 'nominal',
    activeEvents: [],
    source: 'synthetic',
    lastUpdated: 0,
  },
  alerts: [],

  setOemData: (data) => set({ oemData: data, isLoading: false }),
  setMoonPosition: (pos) => set({ moonPosition: pos }),
  setSpacecraft: (state) =>
    set((prev) => ({ spacecraft: { ...prev.spacecraft, ...state } })),
  setDsnStations: (stations) => set({ dsnStations: stations }),
  setCameraMode: (mode) => set({ cameraMode: mode }),
  toggleChat: () => set((prev) => ({ chatOpen: !prev.chatOpen })),
  setLoading: (loading) => set({ isLoading: loading }),
  setHoveredMilestoneHours: (hours) => set({ hoveredMilestoneHours: hours }),
  setSpaceWeather: (data) => set({ spaceWeather: data }),
  addAlert: (alert) =>
    set((prev) => {
      // Dedup: skip if same type+message within 60s
      const isDuplicate = prev.alerts.some(
        (a) => a.type === alert.type && a.message === alert.message &&
          Date.now() - a.timestamp < 60_000
      );
      if (isDuplicate) return prev;

      const id = crypto.randomUUID();
      const newAlert: Alert = { ...alert, id };

      // WARNING priority: insert at front; otherwise append
      const updated = alert.severity === 'warning'
        ? [newAlert, ...prev.alerts]
        : [...prev.alerts, newAlert];

      return { alerts: updated.slice(0, 10) }; // Cap at 10
    }),
  dismissAlert: (id) =>
    set((prev) => ({ alerts: prev.alerts.filter((a) => a.id !== id) })),
}));
