# Finding: 12 Date.now() Dependencies Prevent Mission Replay After Splashdown

**Date**: 2026-04-10
**Discovered by**: `/research` — replayable mission visualization architecture
**Type**: Gap
**Severity**: High
**Status**: Open

---

## What Was Found

The ARTEMIS visualization is strictly real-time — 12 distinct `Date.now()` / wall-time dependencies across 8 files collectively prevent any form of replay, scrubbing, or time control. After splashdown (~T+217.53h, April 10 2026 20:07 EDT), the tracker will show 100% progress with no way to review any mission phase. The PRD explicitly anticipates this transition: "After splashdown, the tool becomes an archive/replay rather than a live tracker" (PRD line 227).

---

## Affected Components

### Direct `Date.now()` call sites (must be migrated to virtual clock)

| File | Line | Usage |
|------|------|-------|
| `src/components/DataDriver.tsx` | L23 | `const now = Date.now()` — drives spacecraft interpolation |
| `src/components/Trajectory.tsx` | L63 | `const now = Date.now()` — splits past/future trajectory |
| `src/hooks/useSpaceWeather.ts` | L13 | `Date.now() - LAUNCH_EPOCH` — computes MET for weather |
| `src/hooks/useAlerts.ts` | L74 | `Date.now() - LAUNCH_EPOCH` — computes MET for milestone proximity |
| `src/hooks/useMission.ts` | indirect | Calls `getMissionElapsed()` with `new Date()` every 1s |

### Transitive consumers (will update automatically once upstream migrated)

- `MissionClock.tsx` — MET display
- `ProgressBar.tsx` — progress %, milestone states
- `MissionEventsPanel.tsx` — current milestone highlight
- `Spacecraft.tsx` — phase display, hover tooltip
- `TelemetryCard` components — speed, Earth/Moon distance

### Already replay-ready (accept arbitrary timestamps)

- `getMissionElapsed(now: Date)` — `src/data/mission-config.ts:48`
- `lagrangeInterpolate(vectors, targetEpochMs)` — `src/data/interpolator.ts:13`
- `getMoonPosition(timeMs)` — `src/data/moon-ephemeris.ts:66`
- `generateSpaceWeather(missionElapsedMs, earthDistKm)` — pure function

---

## Evidence

```typescript
// src/components/DataDriver.tsx:23 — hardcoded to wall clock
const now = Date.now();

// src/components/Trajectory.tsx:63 — hardcoded to wall clock
const now = Date.now();

// src/hooks/useAlerts.ts:74 — hardcoded to wall clock
const elapsedMs = Date.now() - LAUNCH_EPOCH;
```

All 5 core call sites use `Date.now()` directly with no abstraction layer.

---

## Preliminary Assessment

**Likely cause**: The MVP was built as a live tracker for the active mission window. Replay was explicitly deferred: "Historical mission replay/scrubbing" listed as out-of-scope in the original blueprint (`docs/blueprints/2026-04-03_1117_artemis_ii_interactive_visualization.md`, line 75).

**Likely scope**: 8 files need modification, 2 new files (virtual clock store slice + TimeControls UI component). The migration is surgical because `useMission()` is already the chokepoint for most HUD components, and core interpolation functions already accept arbitrary timestamps.

**Likely impact**: After splashdown, the visualization becomes non-functional — stuck at 100% progress with no way to explore mission phases. The app loses its primary value as an educational/archival tool.

---

## Classification Rationale

**Type: Gap** — This is a missing expected capability explicitly anticipated by the PRD, not a bug in existing behavior.

**Severity: High** — Splashdown is imminent (hours away). Without replay capability, the app's post-mission utility drops to zero. The chatbot still works, but the 3D visualization — the app's primary feature — becomes static.

---

**Finding Logged**: 2026-04-10 17:38 UTC
