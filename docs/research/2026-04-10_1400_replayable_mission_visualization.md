# Research: Making ARTEMIS Replayable -- Virtual Time, Scrubber, and Playback Architecture

**Date**: 2026-04-10
**Researcher**: Claude Code
**Status**: Complete

---

## Question

The Artemis II mission is approaching splashdown (~T+217.53h, April 10 2026). The current visualization is strictly real-time -- it reads `Date.now()` in multiple places and there is no mechanism to view past mission states, scrub to future events, or replay the mission after splashdown. How should we architect a replayable system that introduces a virtual clock, a timeline scrubber, playback speed controls, and a SIM/LIVE mode toggle -- while preserving the existing real-time tracking experience?

---

## TL;DR

The ARTEMIS codebase has **12 distinct `Date.now()` call sites** and one clock-wall-time dependency (`useMission` via `new Date()`) that collectively prevent any form of replay. The fix is a single **virtual clock abstraction** in the Zustand store that all components read instead of `Date.now()`. This clock supports three modes: LIVE (1:1 wall time), SIM (scrubber-controlled), and REPLAY (accelerated playback at 1x-10000x). The timeline scrubber is a range input over the OEM data window (T+0 to T+217.53h). No external library is needed -- the virtual clock is ~60 lines of pure TypeScript backed by `performance.now()` for drift-free timing. The existing `useMission()` hook becomes the single consumer interface; every downstream component is already wired through it or the store.

---

## Official Documentation

### React Three Fiber -- Clock and useFrame

R3F exposes a `THREE.Clock` via the `useFrame` state parameter. The clock's `elapsedTime` increments continuously from first render. Setting `clock.running = false` pauses the Three.js render clock, but this affects ALL animation timing globally -- not suitable for our use case where we want to pause mission time while keeping UI animations alive.

> "The first parameter passed by useFrame is the state, that contains the clock object, where you'll find a property called elapsedTime."
> -- Source: [useFrame Hook - R3F Tutorials](https://sbcode.net/react-three-fiber/use-frame/)

Key insight: R3F's clock is a render clock, not a simulation clock. We need a separate virtual clock at the application layer.

### Three.js Clock Pause Behavior

Pausing and resuming `THREE.Clock` causes `elapsedTime` to jump forward by the paused duration, unless manually corrected. This is a known gotcha.

> "How can I pause the Clock, without having elapsedTime increased or reset when resuming?"
> -- Source: [Three.js Forum Discussion](https://discourse.threejs.org/t/how-can-i-pause-the-clock-without-having-elapsedtime-increased-or-reset-when-resuming/17934)

### Zustand -- Computed State from Time

Zustand discussion #2150 covers patterns for time-dependent computed state. The consensus is to avoid storing `Date.now()` in state (causes infinite re-renders). Instead, use a ref or external variable that components poll via `useFrame` or `setInterval`.

> "Computed state which relies on current time"
> -- Source: [Zustand Discussion #2150](https://github.com/pmndrs/zustand/discussions/2150)

---

## Community Knowledge

### Existing Artemis Tracker Implementations

Multiple Artemis II trackers launched in April 2026 implement SIM/replay modes:

**ChadOhman/artemis-tracker**: Full SIM mode with a time scrubber spanning MET 0:00:00:00 through 9:01:42:48. When scrubbing, all components update simultaneously -- MET clock, orbit map position, telemetry values, milestone states. The system resolves flight day, phase, crew activity, attitude mode, and next milestone from MET.

> "Time scrubber slider spanning MET 0/00:00:00 to 9/01:42:48... updates everything simultaneously."
> -- Source: [artemis-tracker design spec](https://github.com/ChadOhman/artemis-tracker/blob/main/docs/superpowers/specs/2026-04-02-artemis-ii-tracker-design.md)

**KeepTrack**: "Time controls allow users to scrub forward and backward through the mission, with the entire trajectory available to explore at any mission point."
-- Source: [KeepTrack Artemis II Deep Dive](https://keeptrack.space/deep-dive/tracking-artemis-ii)

**artemis2tracker.net**: "Animated playback with adjustable speed (1x to 10,000x) and a draggable timeline scrubber."
-- Source: [Artemis 2 Tracker](https://artemis2tracker.net/)

### virtual-clock npm Library

A lightweight library (1.2 KB) providing configurable virtual clocks with rate control, pause/resume, min/max bounds, and looping. Uses `performance.now()` for drift-free timing unaffected by system clock drift or NTP adjustments.

> "Virtual clocks can be paused and resumed, be sped up, down, or even made to go backwards, can be limited to not go beyond a certain minimum or maximum value."
> -- Source: [virtual-clock.js](https://virtual-clock.js.org/)

Verdict: Useful reference implementation, but at ~60 lines the virtual clock logic is simple enough to inline without adding a dependency.

### Common Pitfalls Mentioned

- **Spiral of death**: If one frame takes too long, the next frame's delta grows, causing even longer frames. Solution: cap the maximum delta per frame (e.g., 100ms wall time max per update).
- **Clock drift**: Using `Date.now()` for timing drifts with system clock changes (NTP, sleep). Use `performance.now()` for relative timing, `Date.now()` only for absolute epoch anchoring.
- **Paused → resumed jump**: Naive `Date.now() - startTime` jumps forward by pause duration. Must track cumulative paused time.
- **Rate change discontinuity**: Changing playback rate mid-stream requires recalculating the time base to avoid a sudden jump in simulated time.

---

## Best Practices

Based on research:

1. **Single source of truth for simulation time**: Every component that needs "now" should read from one virtual clock, never from `Date.now()` directly. This is the fundamental architectural requirement.

2. **Separate simulation time from wall time**: The virtual clock maintains a `simulatedEpochMs` that advances at `rate * wallDelta` per frame. LIVE mode sets rate=1 and syncs to wall clock. SIM mode sets rate=0 (paused, scrubber-controlled). REPLAY mode sets rate=1x to 10000x.

3. **URL-persisted time state**: Encode the current mode and simulated time in URL search params (`?mode=sim&t=120.5`) so that links to specific mission moments are shareable and the page reloads preserve state.

4. **Quantized store updates**: The DataDriver already throttles store updates to 4Hz. The virtual clock should update the `simulatedEpochMs` at frame rate (via `useFrame`) but only push to the Zustand store at the existing 4Hz cadence to avoid excessive re-renders.

5. **OEM data bounds enforcement**: Clamp the virtual clock to the OEM data range (T+3.38h to T+217.31h for the trajectory, T+0 to T+217.53h for milestones). Display a "No trajectory data" indicator when scrubbed before OEM start.

6. **Scrubber precision**: Use hours (not milliseconds) as the scrubber unit. The 217.53h range with a 0.01h step gives ~21,753 positions -- sufficient for smooth scrubbing without overwhelming the range input.

---

## Codebase Audit: All `Date.now()` / Wall-Time Dependencies

### Direct `Date.now()` Call Sites

| # | File | Line | Usage | Impact |
|---|------|------|-------|--------|
| 1 | `src/data/interpolator.ts` | arg `targetEpochMs` | Receives `Date.now()` from DataDriver | Core: determines spacecraft position |
| 2 | `src/components/DataDriver.tsx` | L23 | `const now = Date.now()` | Core: passes to interpolator |
| 3 | `src/components/DataDriver.tsx` | L36 | `now - lastStoreUpdate` | Throttle only, OK to keep as wall time |
| 4 | `src/components/Trajectory.tsx` | L63 | `const now = Date.now()` | Splits past/future trajectory segments |
| 5 | `src/hooks/useSpaceWeather.ts` | L13 | `Date.now() - LAUNCH_EPOCH` | Computes MET for weather generation |
| 6 | `src/hooks/useAlerts.ts` | L74 | `Date.now() - LAUNCH_EPOCH` | Computes MET for milestone proximity |
| 7 | `src/hooks/useAlerts.ts` | L19 | `timestamp: Date.now()` | Alert timestamp -- OK to keep as wall time |
| 8 | `src/data/space-weather-synthetic.ts` | L105 | `lastUpdated: Date.now()` | Metadata only, OK to keep as wall time |
| 9 | `src/store/mission-store.ts` | L111 | `alert.timestamp - a.timestamp` | Dedup window -- OK to keep as wall time |

### Indirect Wall-Time Dependencies

| # | File | Usage | Impact |
|---|------|-------|--------|
| 10 | `src/data/mission-config.ts` | `getMissionElapsed(now = new Date())` | Core: MET clock, progress, phase |
| 11 | `src/hooks/useMission.ts` | Calls `getMissionElapsed()` every 1s | Core: drives MissionClock, ProgressBar, MissionEventsPanel, Spacecraft |
| 12 | `src/components/Moon.tsx` | `getMoonFlybyPosition()` -- static, but `getMoonPosition(timeMs)` is available and unused | Moon position is currently static at flyby epoch; should animate with sim time |

### Components That Consume Time (Transitively)

Via `useMission()`:
- `MissionClock.tsx` -- displays MET
- `ProgressBar.tsx` -- displays progress %, milestone completion, countdown
- `MissionEventsPanel.tsx` -- highlights current milestone, computes past/future
- `Spacecraft.tsx` -- displays current phase

Via store `spacecraft` state (set by DataDriver from `Date.now()`):
- `TelemetryCard` (Speed, EarthDist, MoonDist)
- `Spacecraft.tsx` hover tooltip
- `useSpaceWeather.ts` (uses earthDist for radiation zone)

Via direct `Date.now()`:
- `Trajectory.tsx` -- past/future line split
- `useAlerts.ts` -- milestone proximity checks

---

## Implementation Analysis

### Architecture: Virtual Clock in Zustand

```
           +------------------+
           |  Virtual Clock   |  (Zustand slice)
           |  mode: live|sim  |
           |  rate: 0..10000  |
           |  simEpochMs      |
           +--------+---------+
                    |
        +-----------+-----------+
        |           |           |
   useMission()  DataDriver  Trajectory
   (MET/phase)  (interpolate) (past/future)
        |           |           |
   MissionClock  Spacecraft   Line colors
   ProgressBar   Telemetry
   EventsPanel   SpaceWeather
```

### New Store Slice: `TimeControl`

```typescript
type TimeMode = 'live' | 'sim' | 'replay';

interface TimeControl {
  mode: TimeMode;
  rate: number;             // 1 = realtime, 0 = paused, 100 = 100x
  simEpochMs: number;       // The virtual "now" in epoch milliseconds
  // Derived (not stored, computed):
  //   missionElapsedMs = simEpochMs - LAUNCH_EPOCH
  //   missionElapsedHours = missionElapsedMs / 3_600_000
}
```

### How Each Mode Works

**LIVE mode** (`mode: 'live'`, `rate: 1`):
- `simEpochMs` is updated to `Date.now()` each frame
- Behavior is identical to current implementation
- Default mode when mission is active

**SIM mode** (`mode: 'sim'`, `rate: 0`):
- `simEpochMs` is set directly by the scrubber
- Time does not advance automatically
- User drags scrubber to any point T+0 to T+217.53h

**REPLAY mode** (`mode: 'replay'`, `rate: 1..10000`):
- `simEpochMs` advances by `rate * wallDelta` each frame
- User can set rate via buttons (1x, 10x, 100x, 1000x, 10000x)
- Pauses at mission end (T+217.53h) unless looping is enabled

### Migration Path (Minimal Disruption)

The key insight is that **`useMission()` is already the chokepoint**. All HUD components go through it. The migration is:

1. Add `timeControl` slice to Zustand store (~30 lines)
2. Add `tickSimulatedTime()` action that DataDriver calls each frame (~20 lines)
3. Modify `getMissionElapsed()` to accept `epochMs` parameter (already does via `now` param)
4. Modify `useMission()` to read `simEpochMs` from store instead of `new Date()`
5. Modify `DataDriver.tsx` to pass `simEpochMs` to interpolator instead of `Date.now()`
6. Modify `Trajectory.tsx` to use `simEpochMs` instead of `Date.now()`
7. Modify `useSpaceWeather.ts` to use `simEpochMs` instead of `Date.now()`
8. Modify `useAlerts.ts` to use `simEpochMs` instead of `Date.now()`
9. Add TimeControls UI component (scrubber + mode toggle + rate buttons)
10. Optionally: animate Moon position with `getMoonPosition(simEpochMs)` instead of static flyby position

**Files touched: 8 modified, 2 new** (TimeControls UI + store slice, or inline in store).

### Already Implemented

- `getMissionElapsed(now: Date)` already accepts a time parameter -- `src/data/mission-config.ts:48`
- `lagrangeInterpolate(vectors, targetEpochMs)` already accepts arbitrary epoch -- `src/data/interpolator.ts:13`
- `getMoonPosition(timeMs)` already interpolates Moon at any time -- `src/data/moon-ephemeris.ts:66`
- `generateSpaceWeather(missionElapsedMs, earthDistKm)` is a pure function -- `src/data/space-weather-synthetic.ts:82`
- DataDriver already throttles store writes to 4Hz -- `src/components/DataDriver.tsx:10`
- ProgressBar already derives TOTAL_MISSION_HOURS from config -- `src/hud/ProgressBar.tsx:7`

### Should Implement

1. **Virtual clock store slice**
   - Why: Single source of truth eliminates 12 scattered `Date.now()` calls
   - Where: `src/store/mission-store.ts` (extend existing store)
   - How: Add `timeControl` state + `tickSimulatedTime`, `setSimTime`, `setTimeMode`, `setPlaybackRate` actions

2. **TimeControls HUD component**
   - Why: Users need a way to switch modes, scrub, and control playback speed
   - Where: New `src/hud/TimeControls.tsx`
   - How: LIVE/SIM toggle, range input scrubber (0-217.53h), rate buttons (1x/10x/100x/1000x), play/pause

3. **URL search params for sim state**
   - Why: Shareable links to specific mission moments (e.g., `?t=120.45` for lunar flyby)
   - Where: `src/App.tsx` (read on mount, sync on change)
   - How: `URLSearchParams` for `mode`, `t` (hours), `rate`

4. **Moon position animation**
   - Why: Currently static at flyby position; with scrubbing, Moon should move to correct position for each time
   - Where: `src/components/Moon.tsx`
   - How: Replace `getMoonFlybyPosition()` with `getMoonPosition(simEpochMs)` reading from store

### Should NOT Implement

1. **External virtual-clock library dependency**
   - Why not: The virtual-clock npm package is 1.2 KB but adds a dependency for ~60 lines of logic that integrates tightly with our Zustand store. Inline is simpler.
   - Source: [virtual-clock.js](https://virtual-clock.js.org/)

2. **Overriding R3F's THREE.Clock**
   - Why not: R3F's clock drives render timing (delta, elapsed). Overriding it would break all animations (Framer Motion, Bloom, etc.). Keep render clock on wall time; only simulation time is virtual.
   - Source: [R3F Clock Issue #131](https://github.com/pmndrs/react-three-fiber/issues/131)

3. **Server-side time synchronization**
   - Why not: The OEM data is static (bundled file). There is no server state to sync. The virtual clock is purely client-side.

4. **Frame-rate-independent physics integration (fixed timestep)**
   - Why not: We are interpolating pre-computed OEM data, not running physics. The interpolator handles arbitrary epoch values correctly regardless of frame rate.

---

## Proposed TimeControls UI Design

```
+------------------------------------------------------------------+
| [LIVE] [SIM]  |  [<<] [<] [||/>>] [>] [>>]  |  1x 10x 100x 1000x |
|               |   T+05:23:45:12              |                     |
|  [==========|=====-----------------------------]  55.2%            |
|  T+0         ^current                    T+217.53h                |
+------------------------------------------------------------------+
```

- **Mode toggle**: LIVE (green dot) / SIM (blue dot)
- **Scrubber**: Range input spanning 0 to 217.53 hours, step 0.01h
- **Transport controls**: Jump to start, step back 1h, play/pause, step forward 1h, jump to end
- **Rate selector**: Preset buttons (1x, 10x, 100x, 1000x, 10000x)
- **MET display**: Shows current simulated MET inline
- **Visual feedback**: Scrubber handle pulses when in LIVE mode, solid in SIM mode

Placement: Below the existing ProgressBar or as a collapsible panel above it. On mobile: simplified to scrubber + play/pause only.

---

## Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Scrub before OEM start (T+0 to T+3.38h) | Clamp spacecraft to first OEM vector; display "Pre-trajectory data" |
| Scrub past OEM end (T+217.31h to T+217.53h) | Clamp spacecraft to last OEM vector; milestones still compute |
| LIVE mode after splashdown | Progress shows 100%, phase shows "Splashdown", auto-suggest SIM mode |
| Rate change mid-playback | Recalculate time base: `simEpochMs = current; wallAnchor = performance.now()` |
| Browser tab backgrounded | `performance.now()` still advances; cap delta to 1s to avoid spiral |
| Moon ephemeris out of range | Already handled: `getMoonPosition()` clamps to first/last point |
| DSN data in SIM mode | DSN is live data -- disable DSN polling in SIM mode, show "Simulated" badge |

---

## Sources

1. [useFrame Hook - R3F Tutorials](https://sbcode.net/react-three-fiber/use-frame/) - R3F clock and animation timing
2. [Three.js Forum: Pause Clock](https://discourse.threejs.org/t/how-can-i-pause-the-clock-without-having-elapsedtime-increased-or-reset-when-resuming/17934) - Clock pause/resume gotchas
3. [R3F Issue #131: Adding THREE.Clock](https://github.com/pmndrs/react-three-fiber/issues/131) - R3F clock override discussion
4. [R3F Issue #1294: Timestamp in Canvas state](https://github.com/pmndrs/react-three-fiber/issues/1294) - Frame timestamp access patterns
5. [Zustand Discussion #2150: Time-dependent computed state](https://github.com/pmndrs/zustand/discussions/2150) - Zustand time patterns
6. [virtual-clock.js](https://virtual-clock.js.org/) - Reference implementation for virtual clock API
7. [virtual-clock npm](https://www.npmjs.com/package/virtual-clock) - Lightweight virtual clock library
8. [hypertimer - GitHub](https://github.com/enmasseio/hypertimer) - Time control for simulations
9. [ChadOhman/artemis-tracker design spec](https://github.com/ChadOhman/artemis-tracker/blob/main/docs/superpowers/specs/2026-04-02-artemis-ii-tracker-design.md) - Artemis tracker SIM mode spec
10. [KeepTrack: Tracking Artemis II](https://keeptrack.space/deep-dive/tracking-artemis-ii) - KeepTrack time scrubbing implementation
11. [Artemis 2 Tracker](https://artemis2tracker.net/) - 1x-10000x playback speed implementation
12. [JavaScript Game Loops and Timing](https://isaacsukin.com/news/2015/01/detailed-explanation-javascript-game-loops-and-timing) - Delta time, spiral of death, fixed timestep patterns
13. [Performant Game Loops in JavaScript](https://www.aleksandrhovhannisyan.com/blog/javascript-game-loop/) - Variable delta time patterns

---

## Related Documents

- `docs/blueprints/2026-04-03_1117_artemis_ii_interactive_visualization.md` - Line 75: "Historical mission replay/scrubbing" listed as out-of-scope for MVP
- `PRD.md` - Line 227: "After splashdown, the tool becomes an archive/replay rather than a live tracker"
- `src/data/mission-config.ts` - `getMissionElapsed()` already accepts a `now` parameter
- `src/data/moon-ephemeris.ts` - `getMoonPosition(timeMs)` already supports arbitrary timestamps
- `NEXT_SESSION_PROMPT_2026-04-06_1226.md` - Session 7 handoff, current project state

---

**Research Complete**: 2026-04-10 14:00 UTC
