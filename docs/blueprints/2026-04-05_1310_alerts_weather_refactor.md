# Blueprint: Combined useAlerts/AlertsBanner/SpaceWeather Refactor

**Date**: 2026-04-05
**Design Reference**: docs/design/2026-04-05_1300_alerts_weather_refactor.md
**Tracker**: docs/findings/2026-04-04_1245_post_mvp_review_warnings_FINDINGS_TRACKER.md (F1-F6)

## Objective

Fix 6 code quality findings across the alerts/weather subsystem in one implementation pass: split coupled effects, use field-level selectors, fix timer lifecycle, consolidate selectors, fix dedup purity.

## Requirements

1. useAlerts: split into 2 effects (weather + milestone), field-level selectors (F2+F3)
2. useAlerts: module-level dedup Sets that persist across remounts (F4)
3. MissionEventsPanel: clear timer on manual dismiss (F1)
4. SpaceWeatherPanel: consolidate 4 selectors to 1 (F5)
5. mission-store: use alert.timestamp instead of Date.now() in dedup (F6)

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Milestone interval | 30 seconds | Frequent enough for T-30min alerts, not per-frame |
| Dedup state scope | Module-level Sets | Survives remounts (Strict Mode, hot reload) |
| SpaceWeatherPanel selector | Single destructured | Component displays all fields — re-renders on any change anyway |

## Scope

### In Scope
- `useAlerts.ts` — effect split, selectors, module-level Sets
- `MissionEventsPanel.tsx` — timer cleanup on dismiss
- `SpaceWeatherPanel.tsx` — selector consolidation
- `mission-store.ts` — dedup purity fix

### Out of Scope
- Alert UI changes, new alert types, weather data sources

## Files Affected

- `src/hooks/useAlerts.ts` — major refactor (F2, F3, F4)
- `src/hud/MissionEventsPanel.tsx` — minor fix (F1)
- `src/hud/SpaceWeatherPanel.tsx` — minor fix (F5)
- `src/store/mission-store.ts` — one-line fix (F6)

## Implementation Sequence

### Step 1: `src/hooks/useAlerts.ts` — Split effects + field selectors + module Sets (F2+F3+F4)

Replace the entire file with this structure:

```typescript
import { useEffect, useRef } from 'react';
import { useMissionStore } from '../store/mission-store';
import type { RadiationZone, AlertSeverity, AlertType } from '../store/mission-store';
import { LAUNCH_EPOCH, MILESTONES } from '../data/mission-config';

const DISMISS_MS: Record<AlertSeverity, number> = {
  info: 8_000, nominal: 6_000, caution: 12_000, warning: 20_000,
};

// Module-level dedup state — persists across remounts (F4)
const firedMilestones = new Set<string>();
const firedEvents = new Set<string>();

function fireAlert(severity: AlertSeverity, type: AlertType, message: string) {
  useMissionStore.getState().addAlert({
    severity, type, message, timestamp: Date.now(), autoDismissMs: DISMISS_MS[severity],
  });
}

export function useAlerts() {
  // Field-level selectors — only re-render on alert-relevant changes (F2)
  const radiationZone = useMissionStore((s) => s.spaceWeather.radiationZone);
  const kpIndex = useMissionStore((s) => s.spaceWeather.kpIndex);
  const activeEvents = useMissionStore((s) => s.spaceWeather.activeEvents);

  const prevZone = useRef<RadiationZone>(radiationZone);
  const prevKp = useRef<number>(kpIndex);
  const prevEventCount = useRef<number>(activeEvents.length);

  // Effect 1: Weather alerts — only fires when alert-relevant fields change (F2)
  useEffect(() => {
    // Radiation zone transitions
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

    // Kp index thresholds
    if (kpIndex >= 5 && prevKp.current < 5) {
      fireAlert('caution', 'geomagnetic', `Kp index elevated to ${kpIndex} — geomagnetic storm conditions`);
    }
    if (kpIndex >= 6 && prevKp.current < 6) {
      fireAlert('warning', 'geomagnetic', `Kp index ${kpIndex} — strong geomagnetic storm`);
    }
    prevKp.current = kpIndex;

    // Scripted solar events
    if (activeEvents.length > prevEventCount.current) {
      for (const event of activeEvents) {
        if (firedEvents.has(event.description)) continue;
        firedEvents.add(event.description);
        const severity: AlertSeverity = event.type === 'cme' ? 'warning' : 'caution';
        fireAlert(severity, 'solar', event.description);
      }
    }
    prevEventCount.current = activeEvents.length;
  }, [radiationZone, kpIndex, activeEvents]);

  // Effect 2: Milestone alerts — own interval, independent of weather (F3)
  useEffect(() => {
    function checkMilestones() {
      const metHours = (Date.now() - LAUNCH_EPOCH.getTime()) / 3_600_000;
      for (const milestone of MILESTONES) {
        const hoursUntil = milestone.missionElapsedHours - metHours;
        const t30Key = `${milestone.name}-t30`;
        const t0Key = `${milestone.name}-t0`;

        if (hoursUntil <= 0.5 && hoursUntil > 0 && !firedMilestones.has(t30Key)) {
          firedMilestones.add(t30Key);
          fireAlert('info', 'milestone', `Approaching ${milestone.name} — T-30 minutes`);
        }
        if (hoursUntil <= 0 && !firedMilestones.has(t0Key)) {
          firedMilestones.add(t0Key);
          fireAlert('info', 'milestone', `${milestone.name} — ${milestone.description}`);
        }
      }
    }

    checkMilestones(); // Run immediately
    const interval = setInterval(checkMilestones, 30_000);
    return () => clearInterval(interval);
  }, []);
}
```

### Step 2: `src/hud/MissionEventsPanel.tsx` — Timer cleanup on dismiss (F1)

Add a `handleDismiss` callback that clears the timer before dismissing. Replace the inline `onClick={() => dismissAlert(alert.id)}`:

```typescript
// Add after handleMilestoneLeave (around line 72):
const handleDismiss = useCallback((id: string) => {
  const timer = timers.current.get(id);
  if (timer) { clearTimeout(timer); timers.current.delete(id); }
  dismissAlert(id);
}, [dismissAlert]);
```

Then replace the dismiss button's onClick:
```tsx
// Before: onClick={() => dismissAlert(alert.id)}
// After:  onClick={() => handleDismiss(alert.id)}
```

### Step 3: `src/hud/SpaceWeatherPanel.tsx` — Consolidate selectors (F5)

```typescript
// Before (lines 84-87):
const kpIndex = useMissionStore((s) => s.spaceWeather.kpIndex);
const solarWindSpeed = useMissionStore((s) => s.spaceWeather.solarWindSpeed);
const radiationZone = useMissionStore((s) => s.spaceWeather.radiationZone);
const source = useMissionStore((s) => s.spaceWeather.source);

// After:
const { kpIndex, solarWindSpeed, radiationZone, source } = useMissionStore((s) => s.spaceWeather);
```

### Step 4: `src/store/mission-store.ts` — Fix dedup purity (F6)

```typescript
// Before (line 112):
Date.now() - a.timestamp < 60_000

// After:
alert.timestamp - a.timestamp < 60_000
```

## Dependencies & Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Milestone 30s interval misses T-30min window | Low | Low | 30s interval means max 30s late — acceptable for a notification |
| SpaceWeatherPanel single selector causes extra re-renders | Low | Low | Component displays all fields — re-renders anyway |
| Module-level Sets accumulate indefinitely | Very Low | Very Low | ~38 entries max (19 milestones × 2 keys) — negligible memory |

## Acceptance Criteria

- [ ] useAlerts has 2 separate useEffect hooks (weather + milestone)
- [ ] Weather effect depends on [radiationZone, kpIndex, activeEvents], not entire spaceWeather
- [ ] Milestone effect uses setInterval(30s), no dependency on spaceWeather
- [ ] firedMilestones and firedEvents are module-level (not useRef)
- [ ] Dismissing an alert clears its auto-dismiss timer immediately
- [ ] SpaceWeatherPanel uses 1 useMissionStore call (destructured)
- [ ] addAlert dedup compares alert.timestamp, not Date.now()
- [ ] Build passes (`npm run build`)

## Debug Strategy

- **Self-debug**: enabled
- **Verifier**: `npm run build`
- **Max iterations**: 3
- **Completion criteria**: Build passes, all 7 acceptance criteria met
- **Invoke with**: `/wrought-implement`
