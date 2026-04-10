# Implementation Prompt: Replay Review Defects (F2, F3, F4)

**RCA Reference**: docs/RCAs/2026-04-10_1830_replay_review_defects.md

## Context

Three defects from forge-review of F1 virtual clock: circular import (F2 Critical), milestone skipping at high rates (F3 Medium), clock drift at 10,000x (F4 Medium). All root causes are confirmed and fixes are surgical.

## Goal

Fix the circular import, make milestone checks rate-invariant, and eliminate clock drift between spacecraft position and HUD state.

## Requirements

### R1: Fix circular import (F2) — `src/store/mission-store.ts` + `src/hooks/useAlerts.ts`

**In mission-store.ts:**
- Remove `import { clearFiredMilestones } from '../hooks/useAlerts'` (line 5)
- Remove `clearFiredMilestones()` call from `setTimeMode` (line 145)
- Make `setTimeMode` a pure state transition again (just call `set()`)

**In useAlerts.ts:**
- Add a module-level subscribe listener that watches `timeControl.mode` and calls `clearFiredMilestones()` when it changes:
```typescript
let prevMode: string = useMissionStore.getState().timeControl.mode;
useMissionStore.subscribe((state) => {
  if (state.timeControl.mode !== prevMode) {
    prevMode = state.timeControl.mode;
    clearFiredMilestones();
  }
});
```

### R2: Rate-invariant milestone checks (F3) — `src/hooks/useAlerts.ts`

Replace the `setInterval(checkMilestones, 30_000)` (Effect 2) with a store subscription that fires on `simEpochMs` changes. Use range-based detection:

```typescript
const prevMetHoursRef = useRef(0);

useEffect(() => {
  function checkMilestones(simEpochMs: number) {
    const metHours = (simEpochMs - LAUNCH_EPOCH.getTime()) / 3_600_000;
    const prevMet = prevMetHoursRef.current;
    prevMetHoursRef.current = metHours;

    for (const milestone of MILESTONES) {
      const mh = milestone.missionElapsedHours;
      // T-30 alert: milestone is within the next 0.5h AND was crossed since last check
      if (mh - metHours <= 0.5 && mh - metHours > 0 && !firedMilestones.has(t30Key)) { ... }
      // T-0 alert: milestone was passed since last check
      if (mh <= metHours && mh > prevMet && !firedMilestones.has(t0Key)) { ... }
    }
  }

  const unsub = useMissionStore.subscribe(
    (state) => state.timeControl.simEpochMs,
    (simEpochMs) => checkMilestones(simEpochMs)
  );
  return unsub;
}, []);
```

This fires at 4Hz (matching DataDriver's store sync cadence) and checks milestones in the range `[prevMetHours, currentMetHours]` — no milestone can be skipped regardless of replay rate.

### R3: Batch store writes to eliminate drift (F4) — `src/components/DataDriver.tsx`

Replace the 3 separate store calls at lines 78-99 with a single batched update:

```typescript
// Instead of:
store.setSpacecraft({ ... });
store.setSimTime(simTimeRef.current);
store.setMoonPosition({ ... });

// Use direct set():
useMissionStore.setState((prev) => ({
  spacecraft: { ...prev.spacecraft, ...spacecraftData },
  timeControl: {
    ...prev.timeControl,
    simEpochMs: Math.max(LAUNCH_EPOCH.getTime(), Math.min(simTimeRef.current, MISSION_END_EPOCH.getTime())),
  },
  moonPosition: moonPosData,
}));
```

This ensures `simEpochMs`, spacecraft position, and moon position are atomically consistent in every store snapshot. Also remove `tickSimulatedTime` from the store interface and implementation (dead code — no callers).

## Files Likely Affected

- `src/store/mission-store.ts` — remove circular import, pure setTimeMode, remove tickSimulatedTime
- `src/hooks/useAlerts.ts` — mode-change subscribe listener, rate-invariant milestone checks
- `src/components/DataDriver.tsx` — batched store write

## Constraints

- Do NOT change TimeControls UI, useMission, Trajectory, useSpaceWeather, Moon, useDSN, DSNStatus
- The `subscribe` with selector in useAlerts requires Zustand's `subscribeWithSelector` middleware or the `subscribe(selector, callback)` overload (check Zustand version support)
- The batched `setState` must include the clamping logic that was in `setSimTime`

## Acceptance Criteria

- [ ] No import from `useAlerts` in `mission-store.ts` (circular dependency broken)
- [ ] `setTimeMode` is a pure state transition (no side effects before `set()`)
- [ ] `tickSimulatedTime` removed from store interface and implementation
- [ ] Milestone checks use range-based detection `[prevMET, currentMET]`
- [ ] No `setInterval` for milestone checks (replaced with store subscription)
- [ ] All 3 store writes in DataDriver batched into single `setState`
- [ ] `npm run build` passes
- [ ] `clearFiredMilestones` is called on mode change via subscribe listener

---

## Plan Output Instructions

**IMPORTANT**: Before creating the implementation plan, you MUST enter plan mode:

1. Call `EnterPlanMode` to enter plan mode
2. Explore the codebase using read-only tools
3. Write the plan to `docs/plans/2026-04-10_1830_replay_review_defects.md`
4. Call `ExitPlanMode` to present for user approval
5. After plan approval, invoke `/wrought-rca-fix` to start the autonomous bugfix loop.
