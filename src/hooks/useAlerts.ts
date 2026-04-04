import { useEffect, useRef } from 'react';
import { useMissionStore } from '../store/mission-store';
import type { RadiationZone, AlertSeverity, AlertType } from '../store/mission-store';
import { LAUNCH_EPOCH, MILESTONES } from '../data/mission-config';

// Auto-dismiss timing per severity
const DISMISS_MS: Record<AlertSeverity, number> = {
  info: 8_000,
  nominal: 6_000,
  caution: 12_000,
  warning: 20_000,
};

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
  const spaceWeather = useMissionStore((s) => s.spaceWeather);
  const prevZone = useRef<RadiationZone>(spaceWeather.radiationZone);
  const prevKp = useRef<number>(spaceWeather.kpIndex);
  const prevEventCount = useRef<number>(spaceWeather.activeEvents.length);
  const firedMilestones = useRef<Set<string>>(new Set());
  const firedEvents = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Radiation zone transitions
    if (spaceWeather.radiationZone !== prevZone.current) {
      const zone = spaceWeather.radiationZone;
      if (zone === 'inner-belt') {
        fireAlert('warning', 'radiation', 'Entering Inner Van Allen Belt — high radiation zone');
      } else if (zone === 'outer-belt' || zone === 'slot-region') {
        fireAlert('caution', 'radiation', `Entering ${zone === 'outer-belt' ? 'Outer Belt' : 'Slot Region'} — elevated radiation`);
      } else if (prevZone.current === 'inner-belt' || prevZone.current === 'outer-belt' || prevZone.current === 'slot-region') {
        fireAlert('nominal', 'radiation', 'Exited radiation belt — levels nominal');
      }
      prevZone.current = spaceWeather.radiationZone;
    }

    // Kp index threshold
    if (spaceWeather.kpIndex >= 5 && prevKp.current < 5) {
      fireAlert('caution', 'geomagnetic', `Kp index elevated to ${spaceWeather.kpIndex} — geomagnetic storm conditions`);
    }
    if (spaceWeather.kpIndex >= 6 && prevKp.current < 6) {
      fireAlert('warning', 'geomagnetic', `Kp index ${spaceWeather.kpIndex} — strong geomagnetic storm`);
    }
    prevKp.current = spaceWeather.kpIndex;

    // Scripted solar events — track fired events to avoid re-fire
    if (spaceWeather.activeEvents.length > prevEventCount.current) {
      for (const event of spaceWeather.activeEvents) {
        if (firedEvents.current.has(event.description)) continue;
        firedEvents.current.add(event.description);
        const severity: AlertSeverity = event.type === 'cme' ? 'warning' : 'caution';
        fireAlert(severity, 'solar', event.description);
      }
    }
    prevEventCount.current = spaceWeather.activeEvents.length;

    // Milestone approach notifications
    const metHours = (Date.now() - LAUNCH_EPOCH.getTime()) / 3_600_000;
    for (const milestone of MILESTONES) {
      const hoursUntil = milestone.missionElapsedHours - metHours;
      const t30Key = `${milestone.name}-t30`;
      const t0Key = `${milestone.name}-t0`;

      // T-30min alert
      if (hoursUntil <= 0.5 && hoursUntil > 0 && !firedMilestones.current.has(t30Key)) {
        firedMilestones.current.add(t30Key);
        fireAlert('info', 'milestone', `Approaching ${milestone.name} — T-30 minutes`);
      }

      // T-0 alert
      if (hoursUntil <= 0 && !firedMilestones.current.has(t0Key)) {
        firedMilestones.current.add(t0Key);
        fireAlert('info', 'milestone', `${milestone.name} — ${milestone.description}`);
      }
    }
  }, [spaceWeather]);
}
