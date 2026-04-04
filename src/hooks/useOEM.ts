import { useEffect } from 'react';
import { parseOEM } from '../data/oem-parser';
import { useMissionStore } from '../store/mission-store';

const OEM_POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

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

    fetchOEM();

    const oemInterval = setInterval(fetchOEM, OEM_POLL_INTERVAL);

    return () => {
      controller.abort();
      clearTimeout(retryTimeout);
      clearInterval(oemInterval);
    };
  }, []);
}
