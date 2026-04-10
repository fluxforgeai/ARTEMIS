# Blueprint: Virtual Clock and Mission Replay

**Date**: 2026-04-10
**Design Reference**: `docs/design/2026-04-10_1738_virtual_clock_and_replay.md`
**Research Reference**: `docs/research/2026-04-10_1400_replayable_mission_visualization.md`

## Objective

Add a virtual clock abstraction to the Zustand store with LIVE/SIM/REPLAY modes, migrate all 5 critical `Date.now()` call sites, and build a TimeControls HUD component with scrubber + transport + rate controls. This makes the visualization replayable after splashdown — required by the PRD.

## Requirements

1. **TimeControl store slice** — mode (live/sim/replay), rate (0-10000), simEpochMs (absolute epoch)
2. **Clock tick in DataDriver** — LIVE: Date.now(), SIM: frozen (scrubber-controlled), REPLAY: delta*rate
3. **5 call site migrations** — DataDriver, useMission, Trajectory, useSpaceWeather, useAlerts
4. **TimeControls UI** — mode toggle, scrubber (0-217.53h), transport controls, rate buttons
5. **URL params** — ?mode=sim&t=120.45 for shareable links
6. **Moon animation** — dynamic getMoonPosition(simEpochMs) replacing static flyby position
7. **DSN guard** — skip polling when not LIVE

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Time representation | Absolute epoch ms (not MET) | All downstream consumers (interpolator, getMoonPosition, OEM epochMs) use absolute epoch |
| Clock tick location | DataDriver's useFrame | Already runs every frame, already has 4Hz throttle, avoids separate timer |
| Frame-rate time | useRef (not store) | Avoid 60Hz store writes; store synced at existing 4Hz cadence |
| Scrubber unit | MET hours (0-217.53) | Human-readable, 0.01h step = 21,753 positions, sufficient precision |
| External deps | None | Virtual clock is ~60 lines inline, no library needed |
| R3F clock | Untouched | R3F clock drives render timing; overriding breaks animations |

## Scope

### In Scope
- TimeControl store slice with 4 actions
- Clock tick logic (LIVE/SIM/REPLAY) in DataDriver
- Migration of 5 critical Date.now() sites
- TimeControls HUD component (desktop + mobile layouts)
- URL search params for shareable time links
- Moon animation with getMoonPosition(simEpochMs)
- DSN polling guard for non-LIVE modes
- DSNStatus "SIM" indicator
- Custom range input styling for scrubber
- Edge cases: pre-OEM clamping, post-splashdown, browser background, high-rate milestones

### Out of Scope
- Server-side time synchronization (OEM data is static)
- Frame-rate-independent physics (we interpolate pre-computed OEM, no physics)
- Overriding R3F's THREE.Clock
- External virtual-clock library dependency
- Looping replay (stop at mission end)

## Files Likely Affected

### New (2)
| File | Purpose |
|------|---------|
| `src/hud/TimeControls.tsx` | Mode toggle, scrubber, transport controls, rate buttons |
| `src/hooks/useTimeControlInit.ts` | Read URL params on mount, initialize store |

### Modified (11)
| File | Change |
|------|--------|
| `src/store/mission-store.ts` | Add TimeControl interface, state, 4 actions (setTimeMode, setPlaybackRate, setSimTime, tickSimulatedTime) |
| `src/components/DataDriver.tsx` | Add clock tick in useFrame, replace Date.now() with simTimeRef, sync simEpochMs+moonPosition to store at 4Hz |
| `src/hooks/useMission.ts` | Replace useState+setInterval with useMemo reading simEpochMs from store |
| `src/components/Trajectory.tsx` | Subscribe to simEpochMs, add to useMemo deps, replace Date.now() |
| `src/hooks/useSpaceWeather.ts` | Read timeControl.simEpochMs via getState() instead of Date.now() |
| `src/hooks/useAlerts.ts` | Read simEpochMs, range-based milestone check for high rates, export clearFiredMilestones() |
| `src/components/Moon.tsx` | Read moonPosition from store (driven by DataDriver) instead of static getMoonFlybyPosition() |
| `src/hooks/useDSN.ts` | Guard: skip fetch when mode !== 'live' |
| `src/hud/DSNStatus.tsx` | Show "DSN (SIM)" indicator when not LIVE |
| `src/hud/HUD.tsx` | Mount TimeControls component |
| `src/index.css` | Custom range input track/thumb styling |

## Implementation Sequence

### Phase 1: Store slice + DataDriver (invisible refactor)
1. **mission-store.ts** — Add TimeControl type, interface fields, default state, 4 actions. The tickSimulatedTime action clamps to [LAUNCH_EPOCH, MISSION_END_EPOCH].
2. **DataDriver.tsx** — Add simTimeRef + lastPerfNow refs. Add clock tick logic at top of useFrame (LIVE: simTimeRef = Date.now(); REPLAY: delta*rate; SIM: store value). Replace `const now = Date.now()` with `simTimeRef.current`. Sync simEpochMs to store at 4Hz alongside spacecraft write. Compute Moon position via getMoonPosition(simTimeRef.current) and write to store at 4Hz.
- **Result**: Everything works identically in LIVE mode. No visible change.

### Phase 2: Migrate downstream consumers
3. **useMission.ts** — Replace `useState(getMissionElapsed())` + `setInterval(1s)` with `const simEpochMs = useMissionStore(s => s.timeControl.simEpochMs); return useMemo(() => getMissionElapsed(new Date(simEpochMs)), [simEpochMs])`.
4. **Trajectory.tsx** — Add `const simEpochMs = useMissionStore(s => s.timeControl.simEpochMs)`. Replace `const now = Date.now()` with `const now = simEpochMs`. Add `simEpochMs` to useMemo deps.
5. **useSpaceWeather.ts** — In update(), replace `Date.now() - LAUNCH_EPOCH.getTime()` with `useMissionStore.getState().timeControl.simEpochMs - LAUNCH_EPOCH.getTime()`.
6. **useAlerts.ts** — In checkMilestones(), replace `Date.now() - LAUNCH_EPOCH.getTime()` with `useMissionStore.getState().timeControl.simEpochMs - LAUNCH_EPOCH.getTime()`. Add prevMetHours ref for range-based milestone detection. Export `clearFiredMilestones()` function. Call clear from setTimeMode action.
- **Result**: All consumers read virtual time. Testable by setting simEpochMs in devtools.

### Phase 3: TimeControls UI + URL params
7. **TimeControls.tsx** (new) — Mode toggle (LIVE/SIM), scrubber (range input 0-217.53h), transport controls (jump start/end, step +/-1h, play/pause), rate buttons (1x/10x/100x/1000x/10000x). Desktop and mobile layouts. HUD glass-panel styling.
8. **useTimeControlInit.ts** (new) — On mount, read URLSearchParams (mode, t, rate). Set store accordingly. On store change, write back via history.replaceState debounced 500ms.
9. **HUD.tsx** — Import and mount TimeControls.
10. **index.css** — Custom range input styling (dark track, cyan thumb, orange past fill).
- **Result**: Users can switch modes, scrub, replay. Shareable URLs work.

### Phase 4: Moon animation + DSN guard + polish
11. **Moon.tsx** — Remove getMoonFlybyPosition() import. Read moonPosition from store (already written by DataDriver at 4Hz). Remove the useEffect that sets moonPosition (DataDriver handles it now). Use store moonPosition for the group position.
12. **useDSN.ts** — Add guard at top of fetchDSN: `if (useMissionStore.getState().timeControl.mode !== 'live') return;`
13. **DSNStatus.tsx** — When mode !== 'live', show "DSN (SIM)" label.
- **Result**: Complete feature. Moon animates. DSN degrades gracefully.

## Dependencies & Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| 60Hz store writes cause lag | Medium | High | Use useRef for frame-rate time, store at 4Hz only |
| Trajectory useMemo recomputes too often | Low | Medium | 4Hz updates over 3,239 vectors = ~0.5ms, acceptable |
| Milestone alerts skipped at high replay rates | Medium | Medium | Range-based check [prevMET, currentMET] instead of point-in-time |
| Scrubber drag stutters at 4Hz | Low | Low | CSS transition smoothing on scrubber thumb |
| Moon position jumps at ephemeris boundaries | Low | Low | getMoonPosition already clamps to data range |

## Acceptance Criteria

- [ ] LIVE mode behaves identically to current implementation (no visual or behavioral change)
- [ ] SIM mode: scrubber controls all components simultaneously (MET clock, spacecraft position, trajectory split, milestone highlights, space weather, Moon position)
- [ ] REPLAY mode: playback at 1x, 10x, 100x, 1000x, 10000x advances all components
- [ ] URL params `?mode=sim&t=120.45` loads directly to lunar flyby moment
- [ ] Scrubber range covers T+0 to T+217.53h with 0.01h precision
- [ ] Moon animates to correct ephemeris position when scrubbing
- [ ] DSN polling stops in non-LIVE modes
- [ ] Milestone alerts fire correctly at all replay speeds
- [ ] Desktop and mobile layouts render correctly
- [ ] `npm run build` passes clean
- [ ] No Date.now() calls remain in the 5 critical paths (DataDriver, useMission, Trajectory, useSpaceWeather, useAlerts)

## Constraints

- No external dependencies (virtual clock inlined)
- R3F THREE.Clock must not be modified
- Store updates must remain at 4Hz (existing DataDriver throttle)
- Wall time used only for: throttle timing, alert timestamps, dedup windows
- OEM data range: T+3.38h to T+217.31h; milestones: T+0 to T+217.53h

## Debug Strategy

- **Self-debug**: enabled
- **Verifier**: `npm run build`
- **Max iterations**: 8 (4 phases)
- **Completion criteria**: Build passes, all acceptance criteria met, no Date.now() in critical paths
- **Escape hatch**: After 8 iterations, document blockers and request human review
- **Invoke with**: `/wrought-implement`
