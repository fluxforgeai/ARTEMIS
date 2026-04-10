# Design: Virtual Clock and Mission Replay (F1)

**Date**: 2026-04-10
**Mode**: from-scratch
**Finding**: F1 in Replayable Mission Visualization Tracker
**Research**: `docs/research/2026-04-10_1400_replayable_mission_visualization.md`

---

## Recommendation

Add a `TimeControl` slice to the Zustand store with three modes (LIVE/SIM/REPLAY), migrate all 5 critical `Date.now()` call sites to read `simEpochMs` from the store, and add a TimeControls HUD component with scrubber + transport controls + rate buttons. Implement in 4 phases, each independently shippable.

**Key trade-off**: Adds ~200 lines of new code and touches 11 files, but enables the app to function post-splashdown as an educational/archival tool — which the PRD explicitly requires.

---

## Architecture

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

### Store Slice

```typescript
type TimeMode = 'live' | 'sim' | 'replay';

interface TimeControl {
  mode: TimeMode;
  rate: number;          // 0 = paused, 1 = realtime, 10-10000 = accelerated
  simEpochMs: number;    // Virtual "now" as absolute epoch milliseconds
}

// Actions:
setTimeMode(mode: TimeMode): void
setPlaybackRate(rate: number): void
setSimTime(epochMs: number): void
tickSimulatedTime(wallDeltaMs: number): void
```

`simEpochMs` is absolute epoch (not MET) because all downstream consumers (`lagrangeInterpolate`, `getMoonPosition`, OEM `epochMs` fields) work in absolute epoch.

### Clock Tick (in DataDriver's `useFrame`)

| Mode | Tick Logic |
|------|-----------|
| LIVE | `simEpochMs = Date.now()` — identical to current behavior |
| SIM | No tick — `simEpochMs` only changes when scrubber calls `setSimTime()` |
| REPLAY | `simEpochMs += min(wallDelta, 100ms) * rate` — clamped to mission bounds |

A `useRef<number>` holds frame-rate `simEpochMs` for the interpolator. The store is updated at the existing 4Hz cadence to avoid excessive re-renders.

---

## Migration: 5 Critical Call Sites

### 1. `DataDriver.tsx:23` — `Date.now()` -> `simTimeRef.current`

Clock tick logic added to `useFrame`. `simTimeRef` tracks frame-rate sim time; store synced at 4Hz alongside existing spacecraft state write. The 4Hz throttle timer remains on wall time (not sim time).

### 2. `useMission.ts` — `new Date()` -> `new Date(simEpochMs)`

Replace `useState` + `setInterval(1s)` with:
```typescript
const simEpochMs = useMissionStore((s) => s.timeControl.simEpochMs);
return useMemo(() => getMissionElapsed(new Date(simEpochMs)), [simEpochMs]);
```
All HUD consumers (MissionClock, ProgressBar, MissionEventsPanel, Spacecraft) update automatically.

### 3. `Trajectory.tsx:63` — `Date.now()` -> `simEpochMs` from store

Subscribe to `simEpochMs`, add it to `useMemo` deps. Trajectory past/future split updates at 4Hz. The loop over 3,239 OEM vectors is ~0.5ms — acceptable.

### 4. `useSpaceWeather.ts:13` — `Date.now() - LAUNCH_EPOCH` -> `simEpochMs - LAUNCH_EPOCH`

Read `timeControl.simEpochMs` from store via `getState()`. 5-second polling interval retained.

### 5. `useAlerts.ts:74` — `Date.now() - LAUNCH_EPOCH` -> `simEpochMs - LAUNCH_EPOCH`

Read from store. Convert from 30s polling to store subscription (fires at 4Hz). At high replay rates, check all milestones in the range `[prevMetHours, currentMetHours]` to avoid skipping. `clearFiredMilestones()` export added for mode switches.

---

## TimeControls UI

```
Desktop:
+------------------------------------------------------------------------+
| [LIVE] [SIM]  |  [|<] [<] [ || ] [>] [>|]  |  1x  10x  100x  1000x  |
|  [==========|=====-----------------------------]  MET 120.5h / 217.53h |
+------------------------------------------------------------------------+

Mobile (simplified):
+---------------------------------------------+
| [LIVE] [SIM]  [<] [ || ] [>]  10x           |
| [========|====================-----]         |
+---------------------------------------------+
```

- **Mode toggle**: LIVE (green pulsing dot) / SIM (blue dot). Dragging scrubber in LIVE auto-switches to SIM.
- **Scrubber**: `<input type="range" min=0 max=217.53 step=0.01>`. OEM data zone highlighted.
- **Transport**: Jump to start/end, step +/-1h, play/pause toggle.
- **Rate buttons**: 1x, 10x, 100x, 1000x, 10000x (mobile: cycle on tap).
- **Styling**: Existing HUD glass-panel pattern.
- **Placement**: `src/hud/HUD.tsx` between secondary row and telemetry cards.

---

## URL Search Params

`?mode=sim&t=120.45&rate=100`

- `mode`: live | sim | replay (default: live, omitted in URL)
- `t`: MET hours as float (required for sim/replay)
- `rate`: playback rate (default: 1 for replay, 0 for sim)

Read on mount via `useTimeControlInit()`. Write via `history.replaceState` (not pushState), debounced 500ms. LIVE mode strips params (clean URL).

Examples: `?mode=sim&t=120.45` (lunar flyby), `?mode=replay&t=0&rate=1000` (full replay at 1000x).

---

## Moon Animation

Replace static `getMoonFlybyPosition()` with dynamic `getMoonPosition(simEpochMs)`. DataDriver computes Moon position at 4Hz alongside spacecraft interpolation, writes to store. Moon.tsx reads from store.

---

## DSN in SIM Mode

`useDSN.ts` skips polling when `mode !== 'live'`. DSNStatus shows "DSN (SIM)" indicator.

---

## Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Scrub before OEM start (T+0 to T+3.38h) | Interpolator clamps to first vector; "Pre-trajectory data" indicator |
| Scrub past OEM end (T+217.31h+) | Interpolator clamps to last vector; milestones still compute |
| LIVE mode after splashdown | Progress 100%, auto-suggest SIM mode via toast |
| Rate change mid-playback | `tickSimulatedTime` uses frame delta * rate — no discontinuity |
| Browser tab backgrounded | wallDelta capped at 100ms — sim loses time, doesn't jump |
| Replay at 10000x skips milestones | Alert check uses range `[prevMET, currentMET]` not point-in-time |
| Mode switch clears milestone dedup | `clearFiredMilestones()` called by `setTimeMode()` |

---

## Implementation Phases

### Phase 1: Store slice + DataDriver (invisible refactor)
- `src/store/mission-store.ts` — add TimeControl state + 4 actions
- `src/components/DataDriver.tsx` — add clock tick, replace Date.now()
- **Result**: Everything works identically in LIVE mode. Safe to ship alone.

### Phase 2: Migrate downstream consumers
- `src/hooks/useMission.ts` — read simEpochMs from store
- `src/components/Trajectory.tsx` — subscribe to simEpochMs
- `src/hooks/useSpaceWeather.ts` — read simEpochMs
- `src/hooks/useAlerts.ts` — read simEpochMs, fix high-rate detection
- **Result**: All consumers read virtual time. Still LIVE-only, testable via devtools.

### Phase 3: TimeControls UI + URL params
- `src/hud/TimeControls.tsx` (new) — full controls
- `src/hooks/useTimeControlInit.ts` (new) — URL params
- `src/hud/HUD.tsx` — mount TimeControls
- `src/index.css` — scrubber styling
- **Result**: Users can switch to SIM, scrub, replay. Shareable URLs.

### Phase 4: Moon animation + DSN guard + polish
- `src/components/Moon.tsx` — dynamic position from store
- `src/hooks/useDSN.ts` — skip polling when not LIVE
- `src/hud/DSNStatus.tsx` — "SIM" indicator
- **Result**: Complete feature.

---

## Files Inventory

### New (2)
| File | Purpose |
|------|---------|
| `src/hud/TimeControls.tsx` | Mode toggle, scrubber, transport controls, rate buttons |
| `src/hooks/useTimeControlInit.ts` | URL param reader, store initialization on mount |

### Modified (11)
| File | Change |
|------|--------|
| `src/store/mission-store.ts` | TimeControl slice + 4 actions |
| `src/components/DataDriver.tsx` | Clock tick, simTimeRef, Moon position at 4Hz |
| `src/hooks/useMission.ts` | useMemo from store (replaces useState+setInterval) |
| `src/components/Trajectory.tsx` | simEpochMs subscription + useMemo dep |
| `src/hooks/useSpaceWeather.ts` | simEpochMs from store |
| `src/hooks/useAlerts.ts` | simEpochMs from store, range-based milestone check, clearFiredMilestones |
| `src/components/Moon.tsx` | Dynamic position from store |
| `src/hooks/useDSN.ts` | Guard: skip polling when not LIVE |
| `src/hud/DSNStatus.tsx` | "SIM" indicator |
| `src/hud/HUD.tsx` | Mount TimeControls + useTimeControlInit |
| `src/index.css` | Custom range input styling |

### Unchanged (verified)
| File | Reason |
|------|--------|
| `src/data/interpolator.ts` | Already accepts arbitrary targetEpochMs |
| `src/data/mission-config.ts` | getMissionElapsed(now) already parameterized |
| `src/data/moon-ephemeris.ts` | getMoonPosition(timeMs) already parameterized |
| `src/data/space-weather-synthetic.ts` | Pure function, metadata Date.now() kept |
| MissionClock, ProgressBar, MissionEventsPanel, Spacecraft | Consume useMission() — auto-updated |

---

## Effort Estimate

| Phase | Files | Lines (est.) | Risk |
|-------|-------|-------------|------|
| 1: Store + DataDriver | 2 modified | ~80 new | Low — invisible refactor |
| 2: Consumer migration | 4 modified | ~40 changed | Low — each is a 1-5 line edit |
| 3: TimeControls UI | 2 new, 2 modified | ~250 new | Medium — UI design/layout |
| 4: Moon + DSN + polish | 3 modified | ~30 changed | Low — simple guards |
| **Total** | **2 new, 11 modified** | **~400 lines** | **Medium overall** |

---

**Design Complete**: 2026-04-10 17:38 UTC
