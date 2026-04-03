import { useEffect } from 'react';
import { parseOEM } from '../data/oem-parser';
import { useMissionStore } from '../store/mission-store';

const OEM_POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes
const HORIZONS_POLL_INTERVAL = 30 * 60 * 1000; // 30 minutes

export function useOEM() {
  useEffect(() => {
    const controller = new AbortController();
    let retryTimeout: ReturnType<typeof setTimeout>;

    async function fetchOEM() {
      try {
        const res = await fetch('/api/oem', { signal: controller.signal });
        if (!res.ok) throw new Error(`OEM API failed: ${res.status}`);
        const text = await res.text();
        const data = parseOEM(text);
        if (data.vectors.length > 0) {
          useMissionStore.getState().setOemData(data.vectors);
          return;
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        console.warn('OEM API fetch failed, trying local fallback:', err);
      }

      // Fallback: load bundled OEM file
      try {
        const res = await fetch('/fallback-oem.asc', { signal: controller.signal });
        if (!res.ok) throw new Error(`Fallback fetch failed: ${res.status}`);
        const text = await res.text();
        const data = parseOEM(text);
        if (data.vectors.length > 0) {
          useMissionStore.getState().setOemData(data.vectors);
          return;
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        console.warn('Fallback OEM also failed, retrying in 30s:', err);
      }

      retryTimeout = setTimeout(fetchOEM, 30_000);
    }

    async function fetchMoonPosition() {
      try {
        const res = await fetch('/api/horizons', { signal: controller.signal });
        if (!res.ok) throw new Error(`Horizons ${res.status}`);
        const data = await res.json();

        if (data.result) {
          // Horizons format: " X = value Y = value Z = value"
          const posMatch = data.result.match(
            /X\s*=\s*(-?[\d.]+E[+-]?\d+)\s*Y\s*=\s*(-?[\d.]+E[+-]?\d+)\s*Z\s*=\s*(-?[\d.]+E[+-]?\d+)/
          );
          if (posMatch) {
            useMissionStore.getState().setMoonPosition({
              x: parseFloat(posMatch[1]),
              y: parseFloat(posMatch[2]),
              z: parseFloat(posMatch[3]),
            });
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        console.warn('Horizons fetch failed:', err);
        useMissionStore.getState().setMoonPosition({ x: 384400, y: 0, z: 0 });
      }
    }

    // Set fallback moon position immediately so moonDist works right away
    useMissionStore.getState().setMoonPosition({ x: 384400, y: 0, z: 0 });

    fetchOEM();
    fetchMoonPosition();

    const oemInterval = setInterval(fetchOEM, OEM_POLL_INTERVAL);
    const moonInterval = setInterval(fetchMoonPosition, HORIZONS_POLL_INTERVAL);

    return () => {
      controller.abort();
      clearTimeout(retryTimeout);
      clearInterval(oemInterval);
      clearInterval(moonInterval);
    };
  }, []);
}
