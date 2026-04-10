import { useEffect, useRef } from 'react';
import { useMissionStore } from '../store/mission-store';
import type { TimeMode } from '../store/mission-store';
import { LAUNCH_EPOCH } from '../data/mission-config';

export function useTimeControlInit() {
  const initialized = useRef(false);

  // Read URL params on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode') as TimeMode | null;
    const t = params.get('t');
    const rate = params.get('rate');

    if (mode === 'sim' || mode === 'replay') {
      const metHours = t ? parseFloat(t) : 0;
      if (!isNaN(metHours)) {
        useMissionStore.getState().setSimTime(LAUNCH_EPOCH.getTime() + metHours * 3_600_000);
      }
      useMissionStore.getState().setTimeMode(mode);
      if (rate) {
        const r = parseFloat(rate);
        if (!isNaN(r) && r > 0) useMissionStore.getState().setPlaybackRate(r);
      }
    }
  }, []);

  // Sync store to URL (debounced)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const unsub = useMissionStore.subscribe((state) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const { mode, rate, simEpochMs } = state.timeControl;
        const params = new URLSearchParams();
        if (mode !== 'live') {
          const metHours = (simEpochMs - LAUNCH_EPOCH.getTime()) / 3_600_000;
          params.set('mode', mode);
          params.set('t', metHours.toFixed(2));
          if (rate > 0) params.set('rate', String(rate));
        }
        const search = params.toString();
        const url = search ? `${window.location.pathname}?${search}` : window.location.pathname;
        window.history.replaceState(null, '', url);
      }, 500);
    });
    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, []);
}
