import { useEffect } from 'react';
import { parseDSN } from '../data/dsn-parser';
import { useMissionStore } from '../store/mission-store';

const DSN_POLL_INTERVAL = 30_000; // 30 seconds

export function useDSN() {
  useEffect(() => {
    const controller = new AbortController();

    async function fetchDSN() {
      try {
        const res = await fetch('/api/dsn', { signal: controller.signal });
        if (!res.ok) return;
        const text = await res.text();
        const stations = parseDSN(text);
        useMissionStore.getState().setDsnStations(stations);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.warn('DSN fetch failed:', err);
      }
    }

    fetchDSN();
    const interval = setInterval(fetchDSN, DSN_POLL_INTERVAL);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, []);
}
