# Findings: Virtual Clock Forge-Review (C1, W1, W2)

**Date**: 2026-04-10
**Discovered by**: `/forge-review --scope=diff` of F1 virtual clock implementation
**Source**: `docs/reviews/2026-04-10_1830_diff.md`

---

## F2: Circular import — clearFiredMilestones() side effect in Zustand setter

**Type**: Defect
**Severity**: Critical

### What Was Found

`src/store/mission-store.ts:144` imports `clearFiredMilestones` from `src/hooks/useAlerts.ts` and calls it inside the `setTimeMode` Zustand action as an imperative side effect before `set()`. This creates a circular dependency: the store imports from useAlerts, and useAlerts imports from the store.

### Affected Components

- `src/store/mission-store.ts:4` — `import { clearFiredMilestones } from '../hooks/useAlerts'`
- `src/store/mission-store.ts:144-153` — `setTimeMode` action calls `clearFiredMilestones()` before `set()`
- `src/hooks/useAlerts.ts:2` — `import { useMissionStore } from '../store/mission-store'`

### Evidence

```typescript
// src/store/mission-store.ts:4
import { clearFiredMilestones } from '../hooks/useAlerts';

// src/store/mission-store.ts:144-153
setTimeMode: (mode) => {
    clearFiredMilestones();  // Side effect in Zustand action
    set((prev) => ({ ... }));
},
```

```typescript
// src/hooks/useAlerts.ts:2
import { useMissionStore } from '../store/mission-store';
```

### Preliminary Assessment

**Likely cause**: `clearFiredMilestones` was added during F1 implementation to reset milestone dedup state on mode change. The simplest wiring was a direct import + call, but this violates Zustand's pure-action convention and creates a circular dependency.

**Likely scope**: Isolated to the import relationship between `mission-store.ts` and `useAlerts.ts`.

**Likely impact**: Circular import may cause initialization order issues in some bundler configurations. Hidden coupling between store and hook module.

### Classification Rationale

**Type: Defect** — Circular dependency is a concrete code defect, not a style preference.
**Severity: Critical** — Circular imports can cause initialization order bugs (undefined imports). The forge-review flagged this as BLOCKED.

---

## F3: 30s milestone check interval misses milestones at high replay rates

**Type**: Defect
**Severity**: Medium

### What Was Found

`src/hooks/useAlerts.ts:77-99` runs milestone checks on a fixed 30-second wall-clock `setInterval`. At 10,000x replay rate, 30 wall-seconds spans 83 simulated hours. The T-30min alert window (0.5 simulated hours) passes in 180ms of wall time — the 30s interval will almost never sample within that window. Most milestone alerts are silently skipped during fast replay.

### Affected Components

- `src/hooks/useAlerts.ts:92-93` — `setInterval(checkMilestones, 30_000)`
- `src/hooks/useAlerts.ts:80-87` — T-30 and T-0 alert conditions

### Evidence

```typescript
// src/hooks/useAlerts.ts:92-93
checkMilestones();
const interval = setInterval(checkMilestones, 30_000);  // Fixed 30s wall time
```

At 10,000x: 30s wall = 83h sim. The T-30min window (hoursUntil <= 0.5 && hoursUntil > 0) lasts 180ms of wall time.

### Preliminary Assessment

**Likely cause**: The 30s interval was designed for real-time (1x) tracking where 30s granularity is sufficient. The virtual clock replay feature introduced variable time rates but did not adjust the interval.

**Likely scope**: Isolated to `useAlerts.ts` milestone checking. Weather alerts (Effect 1) are reactive to store changes and unaffected.

**Likely impact**: During replay at rates above ~60x, some milestone alerts will be skipped. At 10,000x, nearly all are skipped.

### Classification Rationale

**Type: Defect** — Milestones are silently skipped, which is incorrect behavior.
**Severity: Medium** — Affects replay experience only, not live mode. Workaround: lower replay rate.

---

## F4: Dual-write clock drift — ref vs store diverge up to 41 min at 10,000x

**Type**: Defect
**Severity**: Medium

### What Was Found

`src/components/DataDriver.tsx` maintains `simTimeRef` (mutable ref, updated every frame at 60Hz) but only syncs to `store.timeControl.simEpochMs` at 4Hz. At 10,000x replay rate, 250ms wall time = 2,500 seconds (41.7 min) of simulated time. The 3D spacecraft position (from ref) leads the store value (from 4Hz sync), causing the spacecraft to appear in the "future" segment of the trajectory (which reads the store).

### Affected Components

- `src/components/DataDriver.tsx:19` — `const simTimeRef = useRef(Date.now())`
- `src/components/DataDriver.tsx:30-41` — Clock tick updates ref every frame
- `src/components/DataDriver.tsx:91` — `store.setSimTime(simTimeRef.current)` at 4Hz only
- `src/components/Trajectory.tsx:57` — Reads `simEpochMs` from store (lagging)

### Evidence

At 10,000x rate:
- Frame interval: ~16ms wall time = 160s (2.67 min) sim time per frame
- 4Hz sync interval: 250ms wall time = 2,500s (41.7 min) sim time between syncs
- Between syncs: ref is up to 41.7 min ahead of store

### Preliminary Assessment

**Likely cause**: The dual-write pattern (ref for 60Hz interpolation, store at 4Hz for HUD) was designed to avoid excessive store writes. At moderate rates (1x-100x) the drift is negligible. At extreme rates (10,000x), the 4Hz sync lag becomes visible.

**Likely scope**: Affects Trajectory past/future coloring, MET clock, ProgressBar, and MissionEventsPanel at high replay rates. The 3D spacecraft position is correct (reads ref directly).

**Likely impact**: Visual inconsistency at 10,000x: spacecraft appears in the "future" trajectory segment. At 1x-100x, drift is <0.7 sim-seconds — imperceptible.

### Classification Rationale

**Type: Defect** — Visual inconsistency between spacecraft and trajectory is incorrect rendering.
**Severity: Medium** — Only noticeable at extreme replay rates (1000x+). Workaround: lower replay rate.

---

**Findings Logged**: 2026-04-10 18:30 UTC
