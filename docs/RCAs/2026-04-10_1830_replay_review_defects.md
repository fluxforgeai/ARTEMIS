# Root Cause Analysis: Replay Review Defects (F2, F3, F4)

**Date**: 2026-04-10
**Severity**: F2 Critical, F3 Medium, F4 Medium
**Status**: Identified
**Findings**: F2, F3, F4 in Replayable Mission Visualization Tracker

## Problem Statement

Three defects discovered by `/forge-review` of the F1 virtual clock implementation: (1) circular import between store and useAlerts, (2) milestone alerts skipped at high replay rates, (3) visual clock drift between spacecraft position and HUD at 10,000x.

## Symptoms

- F2: `mission-store.ts` imports from `useAlerts.ts` which imports from `mission-store.ts` (circular)
- F3: At 10,000x replay, milestone alerts are silently skipped (30s interval, 180ms window)
- F4: At 10,000x, spacecraft appears in "future" trajectory segment (41 min sim-time drift between ref and store)

## Root Cause

### F2: Side effect in Zustand setter

`setTimeMode` (line 144) calls `clearFiredMilestones()` imported from `useAlerts.ts`. This creates store -> useAlerts -> store circular dependency and violates Zustand's pure-action convention.

### F3: Fixed wall-clock interval for milestone checks

`setInterval(checkMilestones, 30_000)` (line 97) checks milestones every 30s wall time regardless of replay rate. At 10,000x, 30s wall = 83h sim, so the T-30min alert window (0.5h sim = 180ms wall) is almost never sampled.

### F4: 4Hz store sync lag at extreme rates

`simTimeRef` (60Hz) leads `store.timeControl.simEpochMs` (4Hz) by up to 250ms wall time. At 10,000x: 250ms * 10,000 = 2,500s = 41.7 min sim-time drift.

## Evidence

```typescript
// F2: mission-store.ts:5 — circular import
import { clearFiredMilestones } from '../hooks/useAlerts';

// F2: mission-store.ts:144-145 — side effect in setter
setTimeMode: (mode) => {
    clearFiredMilestones();  // impure

// F3: useAlerts.ts:97 — fixed 30s interval
const interval = setInterval(checkMilestones, 30_000);

// F4: DataDriver.tsx:91 — 4Hz sync only
store.setSimTime(simTimeRef.current);  // inside 4Hz throttle block
```

## Resolution

### F2 Fix: Move clearFiredMilestones to subscribe listener in useAlerts

Remove the `clearFiredMilestones` import from `mission-store.ts`. Instead, add a `useMissionStore.subscribe` listener in `useAlerts.ts` that watches `timeControl.mode` and calls `clearFiredMilestones()` when it changes. This breaks the circular dependency and keeps the store action pure.

### F3 Fix: Replace setInterval with store subscription for milestone checks

Remove the `setInterval(checkMilestones, 30_000)`. Instead, subscribe to `timeControl.simEpochMs` changes (fires at 4Hz from DataDriver). Use range-based detection: track `prevMetHours` in a ref, and check all milestones in `[prevMetHours, currentMetHours]` so no milestone is skipped regardless of how fast time advances.

### F4 Fix: Batch all store writes into a single set() call

Replace the 3 separate store calls (`setSpacecraft`, `setSimTime`, `setMoonPosition`) with a single batched `set()` call using the store's `set` function directly. This ensures `simEpochMs` is always synchronized with the spacecraft position in the same atomic update — Trajectory reads both from the same store snapshot.

Also remove `tickSimulatedTime` (dead code — S3 from the review).

## Prevention

1. Never import hooks from the store module — data flows one way (store -> hooks)
2. Fixed-interval polling should be rate-aware when variable time rates are in play
3. Related state that must be consistent should be updated in the same `set()` call

## Debug Strategy

- **Self-debug**: enabled
- **Verifier**: `npm run build`
- **Max iterations**: 5
- **Completion criteria**: Build passes, no circular import, milestone checks rate-aware, store writes batched
- **Escape hatch**: After 5 iterations, document blockers
- **Invoke with**: `/wrought-rca-fix`
