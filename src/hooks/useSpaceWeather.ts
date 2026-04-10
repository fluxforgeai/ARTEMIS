import { useEffect } from 'react';
import { useMissionStore } from '../store/mission-store';
import { LAUNCH_EPOCH } from '../data/mission-config';
import { generateSpaceWeather } from '../data/space-weather-synthetic';

const POLL_INTERVAL = 5_000; // 5 seconds

export function useSpaceWeather() {
  // Empty deps: polling interval manages its own state reads via getState()
  useEffect(() => {
    function update() {
      const { spacecraft, spaceWeather, setSpaceWeather } = useMissionStore.getState();
      const metMs = useMissionStore.getState().timeControl.simEpochMs - LAUNCH_EPOCH.getTime();
      const earthDistKm = spacecraft.earthDist;

      const data = generateSpaceWeather(metMs, earthDistKm);

      // Only update store if meaningful values changed
      if (
        data.kpIndex !== spaceWeather.kpIndex ||
        data.radiationZone !== spaceWeather.radiationZone ||
        data.activeEvents.length !== spaceWeather.activeEvents.length
      ) {
        setSpaceWeather(data);
      }
    }

    update(); // Immediate first call
    const interval = setInterval(update, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, []);
}
