import { useEffect, useRef } from 'react';
import { useMissionStore } from '../store/mission-store';
import type { RadiationZone, AlertSeverity, AlertType } from '../store/mission-store';
import { LAUNCH_EPOCH, MILESTONES } from '../data/mission-config';

const DISMISS_MS: Record<AlertSeverity, number> = {
  info: 8_000,
  nominal: 6_000,
  caution: 12_000,
  warning: 20_000,
};

// Module-level dedup state — persists across remounts (F4)
const firedMilestones = new Set<string>();
const firedEvents = new Set<string>();

export function clearFiredMilestones() {
  firedMilestones.clear();
  firedEvents.clear();
}

// Clear milestone dedup when time mode changes (subscribe avoids circular store import)
let _prevMode = useMissionStore.getState().timeControl.mode;
useMissionStore.subscribe((state) => {
  if (state.timeControl.mode !== _prevMode) {
    _prevMode = state.timeControl.mode;
    clearFiredMilestones();
  }
});

function fireAlert(severity: AlertSeverity, type: AlertType, message: string) {
  useMissionStore.getState().addAlert({
    severity,
    type,
    message,
    timestamp: Date.now(),
    autoDismissMs: DISMISS_MS[severity],
  });
}

export function useAlerts() {
  // Field-level selectors — only re-render on alert-relevant changes (F2)
  const radiationZone = useMissionStore((s) => s.spaceWeather.radiationZone);
  const kpIndex = useMissionStore((s) => s.spaceWeather.kpIndex);
  const activeEventCount = useMissionStore((s) => s.spaceWeather.activeEvents.length);

  const prevZone = useRef<RadiationZone>(radiationZone);
  const prevKp = useRef<number>(kpIndex);
  const prevEventCount = useRef<number>(activeEventCount);

  // Effect 1: Weather alerts — only fires when alert-relevant fields change (F2)
  useEffect(() => {
    if (radiationZone !== prevZone.current) {
      const zone = radiationZone;
      if (zone === 'inner-belt') {
        fireAlert('warning', 'radiation', 'Entering Inner Van Allen Belt — high radiation zone');
      } else if (zone === 'outer-belt' || zone === 'slot-region') {
        fireAlert('caution', 'radiation', `Entering ${zone === 'outer-belt' ? 'Outer Belt' : 'Slot Region'} — elevated radiation`);
      } else if (prevZone.current === 'inner-belt' || prevZone.current === 'outer-belt' || prevZone.current === 'slot-region') {
        fireAlert('nominal', 'radiation', 'Exited radiation belt — levels nominal');
      }
      prevZone.current = radiationZone;
    }

    if (kpIndex >= 5 && prevKp.current < 5) {
      fireAlert('caution', 'geomagnetic', `Kp index elevated to ${kpIndex} — geomagnetic storm conditions`);
    }
    if (kpIndex >= 6 && prevKp.current < 6) {
      fireAlert('warning', 'geomagnetic', `Kp index ${kpIndex} — strong geomagnetic storm`);
    }
    prevKp.current = kpIndex;

    if (activeEventCount > prevEventCount.current) {
      const events = useMissionStore.getState().spaceWeather.activeEvents;
      for (const event of events) {
        if (firedEvents.has(event.description)) continue;
        firedEvents.add(event.description);
        const severity: AlertSeverity = event.type === 'cme' ? 'warning' : 'caution';
        fireAlert(severity, 'solar', event.description);
      }
    }
    prevEventCount.current = activeEventCount;
  }, [radiationZone, kpIndex, activeEventCount]);

  // Effect 2: Milestone alerts — reactive to simEpochMs changes (rate-invariant)
  useEffect(() => {
    const prevMetRef = { current: (useMissionStore.getState().timeControl.simEpochMs - LAUNCH_EPOCH.getTime()) / 3_600_000 };

    const unsub = useMissionStore.subscribe((state) => {
      const metHours = (state.timeControl.simEpochMs - LAUNCH_EPOCH.getTime()) / 3_600_000;
      const prevMet = prevMetRef.current;
      if (metHours === prevMet) return;
      prevMetRef.current = metHours;

      for (const milestone of MILESTONES) {
        const mh = milestone.missionElapsedHours;
        const t30Key = `${milestone.name}-t30`;
        const t0Key = `${milestone.name}-t0`;

        if (mh - metHours <= 0.5 && mh - metHours > 0 && !firedMilestones.has(t30Key)) {
          firedMilestones.add(t30Key);
          fireAlert('info', 'milestone', `Approaching ${milestone.name} — T-30 minutes`);
        }
        // Range-based: milestone crossed since last check (can't skip at any rate)
        if (mh <= metHours && mh > prevMet && !firedMilestones.has(t0Key)) {
          firedMilestones.add(t0Key);
          fireAlert('info', 'milestone', `${milestone.name} — ${milestone.description}`);
        }
      }
    });

    return unsub;
  }, []);
}
