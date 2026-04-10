import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useMissionStore } from '../store/mission-store';
import { lagrangeInterpolate } from '../data/interpolator';
import { LAUNCH_EPOCH, MISSION_END_EPOCH, SCALE_FACTOR } from '../data/mission-config';
import { getMoonPosition } from '../data/moon-ephemeris';

// Shared ref for spacecraft position — Spacecraft.tsx reads this directly
export const spacecraftPosition = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 };

const STORE_UPDATE_INTERVAL = 250; // Throttle store updates to ~4Hz
const FLYBY_EPOCH_MS = new Date('2026-04-06T23:06:00Z').getTime();

/**
 * Invisible component that runs inside Canvas to drive spacecraft state.
 * Interpolates every frame for smooth 3D, but throttles store updates for HUD.
 */
export default function DataDriver() {
  const lastStoreUpdate = useRef(0);
  const simTimeRef = useRef(Date.now());
  const lastPerfNow = useRef(performance.now());

  useFrame(() => {
    const store = useMissionStore.getState();
    if (!store.oemData || store.oemData.length === 0) return;

    // --- Virtual clock tick ---
    const { mode, rate, simEpochMs } = store.timeControl;
    const perfNow = performance.now();

    if (mode === 'live') {
      simTimeRef.current = Math.max(
        LAUNCH_EPOCH.getTime(),
        Math.min(Date.now(), MISSION_END_EPOCH.getTime())
      );
    } else if (rate > 0) {
      const wallDelta = Math.min(perfNow - lastPerfNow.current, 100);
      simTimeRef.current = Math.max(
        LAUNCH_EPOCH.getTime(),
        Math.min(simEpochMs + wallDelta * rate, MISSION_END_EPOCH.getTime())
      );
    } else {
      simTimeRef.current = simEpochMs;
    }
    lastPerfNow.current = perfNow;

    // --- Interpolate spacecraft position ---
    const now = simTimeRef.current;
    const interpolated = lagrangeInterpolate(store.oemData, now);
    if (!interpolated) return;

    // Update shared position ref every frame (for smooth 3D rendering)
    spacecraftPosition.x = interpolated.x;
    spacecraftPosition.y = interpolated.y;
    spacecraftPosition.z = interpolated.z;
    spacecraftPosition.vx = interpolated.vx;
    spacecraftPosition.vy = interpolated.vy;
    spacecraftPosition.vz = interpolated.vz;

    // Throttle Zustand store updates to ~4Hz (triggers HUD re-renders)
    const wallNow = Date.now();
    if (wallNow - lastStoreUpdate.current < STORE_UPDATE_INTERVAL) return;
    lastStoreUpdate.current = wallNow;

    const speed = Math.sqrt(
      interpolated.vx ** 2 + interpolated.vy ** 2 + interpolated.vz ** 2
    ) * 3600; // km/s -> km/h

    const earthDist = Math.sqrt(
      interpolated.x ** 2 + interpolated.y ** 2 + interpolated.z ** 2
    );

    // LIVE: Moon at flyby position (aligns with trajectory turnaround)
    // REPLAY/SIM: Moon animates with sim time (dynamic ephemeris)
    const moonTime = mode === 'live' ? FLYBY_EPOCH_MS : simTimeRef.current;
    const moonPos = getMoonPosition(moonTime);
    // moonPos is in scene units — convert back to km for distance calc
    const dx = interpolated.x - moonPos[0] * SCALE_FACTOR;
    const dy = interpolated.y - moonPos[1] * SCALE_FACTOR;
    const dz = interpolated.z - moonPos[2] * SCALE_FACTOR;
    const moonDist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    useMissionStore.setState((prev) => ({
      spacecraft: {
        ...prev.spacecraft,
        x: interpolated.x, y: interpolated.y, z: interpolated.z,
        vx: interpolated.vx, vy: interpolated.vy, vz: interpolated.vz,
        speed, earthDist, moonDist,
      },
      timeControl: {
        ...prev.timeControl,
        simEpochMs: Math.max(
          LAUNCH_EPOCH.getTime(),
          Math.min(simTimeRef.current, MISSION_END_EPOCH.getTime())
        ),
      },
      moonPosition: {
        x: moonPos[0],
        y: moonPos[1],
        z: moonPos[2],
      },
    }));
  });

  return null;
}
