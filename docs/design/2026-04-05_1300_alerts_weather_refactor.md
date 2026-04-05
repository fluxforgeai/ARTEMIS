# Design Analysis: Combined useAlerts/AlertsBanner/SpaceWeather Refactor (F1-F6)

**Date**: 2026-04-05
**Mode**: Tradeoff (streamlined, --quick)
**Tracker**: `docs/findings/2026-04-04_1245_post_mvp_review_warnings_FINDINGS_TRACKER.md`

---

## Current State

4 files, 6 findings, all code quality debt in the alerts/weather subsystem:

### F2: useAlerts subscribes to entire spaceWeather (Medium)
`useAlerts.ts:25` — `useMissionStore((s) => s.spaceWeather)` returns a new object reference every 5 seconds when `setSpaceWeather` fires. The effect re-runs on every weather tick even when alert-relevant fields (`radiationZone`, `kpIndex`, `activeEvents`) haven't changed.

### F3: Milestone checking coupled to spaceWeather (Medium)
`useAlerts.ts:67-84` — Milestone approach notifications use `Date.now()` (impure) inside the `spaceWeather` effect. Milestones have nothing to do with weather — they fire as a side effect of weather updates every 5 seconds.

### F4: firedMilestones ref never cleared (Low Defect)
`useAlerts.ts:29` — `useRef<Set<string>>(new Set())` reinitializes on remount (React Strict Mode, hot reload), losing dedup state. Previously fired milestones re-fire.

### F1: AlertsBanner timer management fragile (Medium)
`MissionEventsPanel.tsx:34-54` — Timer lifecycle tied to effect re-execution, not individual alert lifecycle. Dismiss handler doesn't clear the timer for that alert.

### F5: SpaceWeatherPanel 4 selectors (Low)
4 individual `useMissionStore` calls for fields from the same `spaceWeather` sub-object. 4 subscriptions instead of 1.

### F6: addAlert dedup race (Low Defect)
`mission-store.ts:112` — `Date.now()` inside `set()` callback is impure. Two alerts in the same millisecond could both pass the dedup check.

---

## Recommendation: Single Refactor Pass

All 6 issues are in 4 files and can be fixed in one implementation pass. No architectural decision needed — each fix is a clear code quality improvement.

### Fix 1: Split useAlerts into weather + milestone effects (F2+F3+F4)

**File**: `src/hooks/useAlerts.ts`

```typescript
// Subscribe to specific alert-relevant fields, not the whole object
const radiationZone = useMissionStore((s) => s.spaceWeather.radiationZone);
const kpIndex = useMissionStore((s) => s.spaceWeather.kpIndex);
const activeEvents = useMissionStore((s) => s.spaceWeather.activeEvents);

// Effect 1: Weather alerts (depends on radiationZone, kpIndex, activeEvents)
useEffect(() => { /* radiation + kp + solar event alerts */ }, [radiationZone, kpIndex, activeEvents]);

// Effect 2: Milestone alerts (own 30-second interval, independent of weather)
useEffect(() => {
  const interval = setInterval(() => { /* milestone checks */ }, 30_000);
  return () => clearInterval(interval);
}, []);
```

Move `firedMilestones` and `firedEvents` to **module level** (persists across remounts):
```typescript
const firedMilestones = new Set<string>();
const firedEvents = new Set<string>();
```

### Fix 2: AlertsBanner timer cleanup on dismiss (F1)

**File**: `src/hud/MissionEventsPanel.tsx`

Clear the timer in the dismiss handler, not just in the effect cleanup:
```typescript
function handleDismiss(id: string) {
  const timer = timers.current.get(id);
  if (timer) { clearTimeout(timer); timers.current.delete(id); }
  dismissAlert(id);
}
```

### Fix 3: Consolidate SpaceWeatherPanel selectors (F5)

**File**: `src/hud/SpaceWeatherPanel.tsx`

Replace 4 individual selectors with one:
```typescript
const { kpIndex, solarWindSpeed, radiationZone, source } = useMissionStore((s) => s.spaceWeather);
```

### Fix 4: Fix addAlert dedup purity (F6)

**File**: `src/store/mission-store.ts`

Use `alert.timestamp` (passed in by caller) instead of `Date.now()` inside the reducer:
```typescript
// Before: Date.now() - a.timestamp < 60_000
// After:  alert.timestamp - a.timestamp < 60_000
```

---

## Files Affected

| File | Changes | Findings |
|------|---------|----------|
| `src/hooks/useAlerts.ts` | Split into 2 effects, field-level selectors, module-level Sets | F2, F3, F4 |
| `src/hud/MissionEventsPanel.tsx` | Timer cleanup in dismiss handler | F1 |
| `src/hud/SpaceWeatherPanel.tsx` | Consolidate 4 selectors to 1 | F5 |
| `src/store/mission-store.ts` | Fix dedup timestamp | F6 |

## Acceptance Criteria

- [ ] useAlerts has 2 separate effects (weather + milestone)
- [ ] Weather alerts only fire on radiationZone/kpIndex/activeEvents changes
- [ ] Milestone alerts run on their own 30s interval
- [ ] firedMilestones/firedEvents persist across remounts (module-level)
- [ ] Dismissing an alert clears its timer immediately
- [ ] SpaceWeatherPanel uses 1 Zustand selector
- [ ] addAlert dedup uses alert.timestamp, not Date.now()
- [ ] Build passes
