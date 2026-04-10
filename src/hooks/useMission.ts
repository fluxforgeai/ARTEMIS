import { useMemo } from 'react';
import { useMissionStore } from '../store/mission-store';
import { getMissionElapsed } from '../data/mission-config';

export function useMission() {
  const simEpochMs = useMissionStore((s) => s.timeControl.simEpochMs);
  return useMemo(() => getMissionElapsed(new Date(simEpochMs)), [simEpochMs]);
}
