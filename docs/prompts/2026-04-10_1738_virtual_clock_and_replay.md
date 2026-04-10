# Implementation Prompt: Virtual Clock and Mission Replay (F1)

**Blueprint Reference**: docs/blueprints/2026-04-10_1738_virtual_clock_and_replay.md
**Design Reference**: docs/design/2026-04-10_1738_virtual_clock_and_replay.md

## Context

The ARTEMIS visualization is locked to real-time via 5 critical `Date.now()` call sites. After splashdown, the app becomes non-functional. The fix is a virtual clock in the Zustand store with LIVE/SIM/REPLAY modes, a TimeControls HUD with scrubber + transport + rate buttons, and URL params for shareable time links.

## Goal

Make the mission visualization fully replayable with a virtual clock, timeline scrubber, and playback speed controls — while preserving identical behavior in LIVE mode.

## Requirements

1. Add `TimeControl` store slice to `src/store/mission-store.ts` — mode (live/sim/replay), rate (0-10000), simEpochMs (absolute epoch), 4 actions
2. Add clock tick logic to `src/components/DataDriver.tsx` — LIVE: Date.now(), SIM: frozen, REPLAY: delta*rate. Use useRef for frame-rate time, sync to store at 4Hz
3. Migrate `src/hooks/useMission.ts` — replace useState+setInterval with useMemo from store simEpochMs
4. Migrate `src/components/Trajectory.tsx` — subscribe to simEpochMs, add to useMemo deps
5. Migrate `src/hooks/useSpaceWeather.ts` — read simEpochMs from store
6. Migrate `src/hooks/useAlerts.ts` — read simEpochMs, range-based milestone check, export clearFiredMilestones()
7. Create `src/hud/TimeControls.tsx` — mode toggle, scrubber (0-217.53h), transport controls, rate buttons
8. Create `src/hooks/useTimeControlInit.ts` — URL params read/write
9. Mount TimeControls in `src/hud/HUD.tsx`
10. Animate Moon in `src/components/Moon.tsx` — read dynamic position from store
11. Guard DSN in `src/hooks/useDSN.ts` — skip polling when not LIVE
12. Add "SIM" indicator in `src/hud/DSNStatus.tsx`
13. Add custom range input styling in `src/index.css`

## Files Likely Affected

### New (2)
- `src/hud/TimeControls.tsx`
- `src/hooks/useTimeControlInit.ts`

### Modified (11)
- `src/store/mission-store.ts`
- `src/components/DataDriver.tsx`
- `src/hooks/useMission.ts`
- `src/components/Trajectory.tsx`
- `src/hooks/useSpaceWeather.ts`
- `src/hooks/useAlerts.ts`
- `src/components/Moon.tsx`
- `src/hooks/useDSN.ts`
- `src/hud/DSNStatus.tsx`
- `src/hud/HUD.tsx`
- `src/index.css`

## Implementation Sequence

### Phase 1: Store slice + DataDriver (invisible refactor)
1. `mission-store.ts` — Add TimeControl type, state, 4 actions (setTimeMode, setPlaybackRate, setSimTime, tickSimulatedTime with clamp to [LAUNCH_EPOCH, MISSION_END_EPOCH])
2. `DataDriver.tsx` — Add simTimeRef + lastPerfNow refs. Clock tick in useFrame (LIVE: Date.now(), REPLAY: delta*rate with 100ms cap, SIM: store value). Replace `const now = Date.now()` with `simTimeRef.current`. Sync simEpochMs to store at 4Hz. Compute Moon position via getMoonPosition(simTimeRef.current) at 4Hz.

### Phase 2: Migrate 4 downstream consumers
3. `useMission.ts` — `const simEpochMs = useMissionStore(s => s.timeControl.simEpochMs); return useMemo(() => getMissionElapsed(new Date(simEpochMs)), [simEpochMs])`
4. `Trajectory.tsx` — Subscribe to simEpochMs, replace `Date.now()`, add to useMemo deps
5. `useSpaceWeather.ts` — Replace `Date.now() - LAUNCH_EPOCH.getTime()` with `getState().timeControl.simEpochMs - LAUNCH_EPOCH.getTime()`
6. `useAlerts.ts` — Replace `Date.now()` in checkMilestones. Add prevMetHours ref for range-based detection. Export clearFiredMilestones(). Wire clear to setTimeMode.

### Phase 3: TimeControls UI + URL params
7. `TimeControls.tsx` (new) — LIVE/SIM toggle, scrubber `<input type="range" min=0 max=217.53 step=0.01>`, transport (|<, <, ||/>, >, >|), rate buttons (1x/10x/100x/1000x/10000x). HUD glass-panel style. Desktop + mobile layouts.
8. `useTimeControlInit.ts` (new) — Read ?mode, ?t, ?rate on mount. Write via history.replaceState debounced 500ms.
9. `HUD.tsx` — Mount TimeControls + useTimeControlInit.
10. `index.css` — Custom range input styling (dark track, cyan thumb).

### Phase 4: Moon + DSN + polish
11. `Moon.tsx` — Remove getMoonFlybyPosition. Read moonPosition from store (DataDriver writes it). Remove the moonPosition-setting useEffect.
12. `useDSN.ts` — Guard: `if (getState().timeControl.mode !== 'live') return`
13. `DSNStatus.tsx` — Show "DSN (SIM)" when not LIVE.

## Constraints

- No external dependencies
- R3F THREE.Clock untouched
- Store updates at 4Hz (existing throttle)
- Wall time for: throttle timing, alert timestamps, dedup windows only
- CURATED_VIDEOS, intent detection, system prompt — no changes
- OEM range: T+3.38h to T+217.31h. Mission: T+0 to T+217.53h.

## Acceptance Criteria

- [ ] LIVE mode identical to current behavior
- [ ] SIM mode: scrubber controls all components (MET, position, trajectory, milestones, weather, Moon)
- [ ] REPLAY at 1x-10000x advances all components
- [ ] URL `?mode=sim&t=120.45` loads to lunar flyby
- [ ] Scrubber 0 to 217.53h with 0.01h step
- [ ] Moon animates to correct ephemeris position
- [ ] DSN stops polling in non-LIVE
- [ ] Milestones fire correctly at all replay speeds
- [ ] Desktop + mobile layouts correct
- [ ] `npm run build` passes
- [ ] No Date.now() in 5 critical paths

---

## Plan Output Instructions

**IMPORTANT**: Before creating the implementation plan, you MUST enter plan mode:

1. Call `EnterPlanMode` to enter plan mode (compresses context and enables read-only exploration)
2. Explore the codebase and design your implementation approach using read-only tools (Read, Grep, Glob)
3. Write the plan to `docs/plans/2026-04-10_1738_virtual_clock_and_replay.md` including:
   - Summary of the approach
   - Step-by-step implementation tasks
   - Files to modify with specific changes
   - Testing strategy
   - Rollback plan (if applicable)
4. Call `ExitPlanMode` to present the plan for user approval
5. **Wait for user approval** before proceeding to implementation
6. After plan approval, invoke `/wrought-implement` to start the autonomous implementation loop with test verification.
