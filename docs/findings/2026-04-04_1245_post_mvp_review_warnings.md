# Finding: Post-MVP Implementation Review Warnings (W1-W6)

**Date**: 2026-04-04
**Discovered by**: `/forge-review --scope=diff` (4-agent review)
**Type**: Debt (W1-W3, W5) / Defect (W4, W6)
**Severity**: Medium (W1-W3) / Low (W4-W6)
**Status**: Open

---

## What Was Found

Six warnings identified during code review of the post-MVP F1-F3 implementation (bloom/glow, crew timeline, space weather alerts). All relate to timer management, effect coupling, selector granularity, and state management in the newly added space weather and alerts subsystem.

### AlertsBanner.tsx (W1)

Timer management in `AlertsBanner` is fragile. The `useEffect` computes `visible = alerts.slice(0, 3)` independently from the render body (which computes it again at line 45). Timer cleanup only runs on re-render via the effect's cleanup function, not on individual dismiss actions. Timers for manually dismissed alerts linger until the next `alerts` state change. If an alert is pushed out of the visible window (position 3+), its timer continues running.

### useAlerts.ts (W2, W3, W4)

**W2 -- Coarse subscription**: The selector `useMissionStore((s) => s.spaceWeather)` returns a new object reference on every `setSpaceWeather` call. The effect fires on every 5-second weather update even when only non-alert-relevant fields change (e.g., `solarWindSpeed`, `solarWindDensity`). This propagates unnecessary re-renders through the HUD tree.

**W3 -- Coupled concerns with impure time source**: Milestone approach notifications depend on elapsed time (`Date.now()`), not space weather data, yet execute inside the `spaceWeather` effect. Milestones are checked every 5 seconds as a side effect of weather updates rather than on their own schedule. `Date.now()` is impure relative to the effect's declared dependency.

**W4 -- Unbounded ref accumulation**: The `firedMilestones` Set accumulates entries indefinitely. If the component remounts (React Strict Mode, hot reload, navigation), the ref reinitializes and previously fired milestones are lost, causing duplicate alerts.

### SpaceWeatherPanel.tsx (W5)

Four independent `useMissionStore` calls each register separate Zustand subscriptions. On every store mutation, 4 equality checks execute. All four values (`kpIndex`, `solarWindSpeed`, `radiationZone`, `source`) come from the same `spaceWeather` sub-object and could be retrieved with a single selector.

### mission-store.ts (W6)

The `addAlert` dedup check uses `Date.now()` inside the Zustand `set()` callback, making the reducer impure. Two alerts dispatched in the same millisecond could both pass the `.some()` dedup check independently. The linear `.some()` scan is also O(n) per alert addition.

---

## Affected Components

| File | Warnings |
|------|----------|
| `src/hud/AlertsBanner.tsx` | W1 |
| `src/hooks/useAlerts.ts` | W2, W3, W4 |
| `src/hud/SpaceWeatherPanel.tsx` | W5 |
| `src/store/mission-store.ts` | W6 |

---

## Evidence

### W1 -- AlertsBanner duplicate visible computation and lingering timers

```tsx
// src/hud/AlertsBanner.tsx:12-33
useEffect(() => {
  const visible = alerts.slice(0, 3);  // computed here...
  for (const alert of visible) {
    if (!timers.current.has(alert.id)) {
      const timer = setTimeout(() => {
        dismissAlert(alert.id);
        timers.current.delete(alert.id);
      }, alert.autoDismissMs);
      timers.current.set(alert.id, timer);
    }
  }
  return () => {
    const visibleIds = new Set(visible.map((a) => a.id));
    for (const [id, timer] of timers.current) {
      if (!visibleIds.has(id)) {        // cleanup only on re-render
        clearTimeout(timer);
        timers.current.delete(id);
      }
    }
  };
}, [alerts, dismissAlert]);

const visible = alerts.slice(0, 3);    // ...and computed again here
```

### W2 -- Coarse spaceWeather subscription

```tsx
// src/hooks/useAlerts.ts:25
const spaceWeather = useMissionStore((s) => s.spaceWeather);
// Returns new object reference every setSpaceWeather call
// Effect at line 31 fires every 5s even if only solarWindSpeed changed
```

### W3 -- Milestone checking coupled to weather effect

```tsx
// src/hooks/useAlerts.ts:64-65
const metHours = (Date.now() - LAUNCH_EPOCH.getTime()) / 3_600_000;
for (const milestone of MILESTONES) {
  // Depends on elapsed time, not spaceWeather, but runs in weather effect
```

### W4 -- firedMilestones never cleared

```tsx
// src/hooks/useAlerts.ts:29
const firedMilestones = useRef<Set<string>>(new Set());
// Accumulates indefinitely; reinitializes on remount causing duplicates
```

### W5 -- Four separate Zustand selectors

```tsx
// src/hud/SpaceWeatherPanel.tsx:33-36
const kpIndex = useMissionStore((s) => s.spaceWeather.kpIndex);
const solarWindSpeed = useMissionStore((s) => s.spaceWeather.solarWindSpeed);
const radiationZone = useMissionStore((s) => s.spaceWeather.radiationZone);
const source = useMissionStore((s) => s.spaceWeather.source);
// 4 subscriptions, 4 equality checks per store mutation
```

### W6 -- Impure dedup with Date.now() in reducer

```tsx
// src/store/mission-store.ts:106-109
const isDuplicate = prev.alerts.some(
  (a) => a.type === alert.type && a.message === alert.message &&
    Date.now() - a.timestamp < 60_000  // impure; race condition in same ms
);
```

---

## Preliminary Assessment

### Scope
All 6 warnings are confined to the space weather and alerts subsystem added in Session 4 F1-F3 implementation. No warnings affect the 3D scene, trajectory, chat, or existing HUD components.

### Root Cause
These are implementation shortcuts typical of first-pass feature work:
- W1-W3: Effect composition that couples unrelated concerns (timers, weather, milestones) into shared lifecycle hooks
- W4: Missing cleanup logic for accumulated state
- W5: Pattern-copy of individual selectors rather than composed selector
- W6: Impure function call inside a state reducer

### Impact
- **W1-W3 (Medium)**: Cause unnecessary HUD re-renders every 5 seconds and create a fragile timer lifecycle. User-visible impact is negligible (no visual bugs), but they degrade render performance and complicate future maintenance.
- **W4 (Low)**: Only manifests under React Strict Mode or hot reload -- not in production builds with standard navigation.
- **W5 (Low)**: 4x equality checks per store mutation. Negligible performance cost with current store size but poor pattern to proliferate.
- **W6 (Low)**: Two alerts in the exact same millisecond is extremely unlikely in practice. The impure `Date.now()` technically violates reducer purity but has no observable consequence at current usage volumes.

---

## Classification Rationale

### Debt (W1, W2, W3, W5)
These are structurally suboptimal implementations that work correctly today but create maintenance burden, performance overhead, or coupling that complicates future changes. No incorrect behavior is produced.

### Defect (W4, W6)
These have specific failure modes (duplicate milestone alerts on remount; race condition on simultaneous alerts) even though the conditions to trigger them are narrow. They represent logic errors rather than design tradeoffs.

### Medium (W1, W2, W3)
The 5-second re-render cycle affects the entire HUD subtree and creates measurable unnecessary work. Timer lifecycle fragility could surface as user-visible bugs if alert volume increases. These warrant focused remediation.

### Low (W4, W5, W6)
Narrow trigger conditions (W4: remount only; W6: same-millisecond only) or negligible performance impact (W5: 4 vs 1 equality check). Worth fixing for code quality but not urgent.

---

**Finding Logged**: 2026-04-04 12:45 UTC
