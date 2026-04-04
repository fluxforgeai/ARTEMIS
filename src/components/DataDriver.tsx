import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useMissionStore } from '../store/mission-store';
import { lagrangeInterpolate } from '../data/interpolator';
import { SCALE_FACTOR } from '../data/mission-config';

// Shared ref for spacecraft position — Spacecraft.tsx reads this directly
export const spacecraftPosition = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 };

const STORE_UPDATE_INTERVAL = 250; // Throttle store updates to ~4Hz

/**
 * Invisible component that runs inside Canvas to drive spacecraft state.
 * Interpolates every frame for smooth 3D, but throttles store updates for HUD.
 */
export default function DataDriver() {
  const lastStoreUpdate = useRef(0);

  useFrame(() => {
    const store = useMissionStore.getState();
    if (!store.oemData || store.oemData.length === 0) return;

    const now = Date.now();
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
    if (now - lastStoreUpdate.current < STORE_UPDATE_INTERVAL) return;
    lastStoreUpdate.current = now;

    const speed = Math.sqrt(
      interpolated.vx ** 2 + interpolated.vy ** 2 + interpolated.vz ** 2
    ) * 3600; // km/s -> km/h

    const earthDist = Math.sqrt(
      interpolated.x ** 2 + interpolated.y ** 2 + interpolated.z ** 2
    );

    let moonDist: number | null = null;
    if (store.moonPosition) {
      // moonPosition is in scene units — convert back to km for distance calc
      const dx = interpolated.x - store.moonPosition.x * SCALE_FACTOR;
      const dy = interpolated.y - store.moonPosition.y * SCALE_FACTOR;
      const dz = interpolated.z - store.moonPosition.z * SCALE_FACTOR;
      moonDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    store.setSpacecraft({
      x: interpolated.x,
      y: interpolated.y,
      z: interpolated.z,
      vx: interpolated.vx,
      vy: interpolated.vy,
      vz: interpolated.vz,
      speed,
      earthDist,
      moonDist,
    });
  });

  return null;
}
