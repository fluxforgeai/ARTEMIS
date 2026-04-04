# Investigation: Trajectory Passes Through Moon Sphere -- Race Condition Between Position Sources

**Date**: 2026-04-05
**Investigator**: Claude Code (Session 5)
**Severity**: High
**Status**: Investigation Complete
**Finding**: F3 in `docs/findings/2026-04-04_2200_ui_visual_regressions_session5_FINDINGS_TRACKER.md`

---

## Executive Summary

The trajectory line visibly passes through the Moon sphere with dashed segments rendered inside the Moon body. Despite the circumcenter algorithm being implemented in `Moon.tsx` (which computes the correct Moon position from trajectory curvature), a **race condition** between `useOEM.ts` and `Moon.tsx` causes the store's `moonPosition` (used by `Trajectory.tsx` for culling) to differ from the Moon sphere's actual rendered position. `useOEM.ts` writes to `moonPosition` three times (initial fallback, Horizons API, error fallback), and these writes can overwrite Moon.tsx's circumcenter value, causing the culling to happen at a different location than where the Moon sphere is rendered. The result: the Moon sphere is at position A (circumcenter), but trajectory culling happens around position B (Horizons/fallback), so the trajectory passes straight through the visible Moon.

---

## External Research Findings

### Official Documentation Consulted
- [React useEffect timing](https://react.dev/reference/react/useEffect): Effects run after render, meaning Moon.tsx's `useEffect` that writes `flybyPos` to the store fires after the component renders. If `useOEM.ts`'s async callbacks resolve after this effect, they overwrite it.
- [Zustand state updates](https://github.com/pmndrs/zustand): `set()` is synchronous and immediate -- no batching. The last writer wins.
- [JPL Horizons API](https://ssd.jpl.nasa.gov/horizons/): Returns real-time ephemeris in the requested reference frame. The API returns the Moon's current position, which may differ from the OEM trajectory epoch by hours or days.

### Known Issues / Community Reports
- No known issues with Zustand race conditions -- this is an application-level data flow problem, not a library bug.

### API/Library Behavior Notes
- The Horizons API returns the Moon's position at the current time, NOT at the OEM trajectory epoch. Since the Moon orbits Earth at ~1 km/s, over a period of hours to days the position can drift by thousands to tens of thousands of km from the flyby epoch.
- `useOEM.ts` polls Horizons every 30 minutes (`HORIZONS_POLL_INTERVAL`), so this overwrite recurs regularly.

---

## Learnings from Previous RCAs/Investigations/Research

### Related Past Incidents

1. **`docs/investigations/2026-04-04_2330_trajectory_near_moon_rendering.md`** -- Original investigation that identified the radial-offset algorithm as flawed and proposed the circumcenter fix. This investigation correctly identified the root cause of the Moon position algorithm but did not address the race condition between data sources.

2. **`docs/RCAs/2026-04-04_2130_trajectory_near_moon.md`** -- RCA that designed three fixes: (1) circumcenter algorithm, (2) reduced culling radius, (3) unified Moon position source. Fix 1 and Fix 2 were implemented. **Fix 3 (unify Moon position source) was NOT fully implemented** -- `useOEM.ts` still writes to `moonPosition` independently.

3. **Commit `26ef3a1`** (Session 4) -- "Fix Moon distance: unit mismatch (km vs scene units)". Fixed DataDriver.tsx to handle scene-unit moonPosition correctly. The unit convention fix in `useOEM.ts` (dividing by SCALE_FACTOR) was applied but the competing-writes problem remained.

### Patterns Identified

- **Recurring regression**: This is the 4th manifestation of the Moon position problem across Sessions 2-5. Each fix has addressed a symptom without fully resolving the dual-source architecture.
- **Dual-source anti-pattern**: Two components (`useOEM.ts` and `Moon.tsx`) independently compute and write the same store field (`moonPosition`). This pattern has caused bugs in every session.
- **Fix 3 from prior RCA was not implemented**: The RCA explicitly called for unifying the Moon position source, but the implementation only applied Fixes 1 and 2.

### Applicable Previous Solutions

- The prior RCA's Fix 3 is exactly the solution needed: remove `useOEM.ts`'s ability to write `moonPosition` independently, OR remove `Moon.tsx`'s independent computation and have it read from the store.

---

## Timeline of Events

| Time | Event | Details |
|------|-------|---------|
| App mount | `useOEM()` runs | Sets initial moonPosition = `{x:38.44, y:0, z:0}` (fallback, line 74) |
| App mount + ~100ms | `fetchOEM()` starts | Async fetch of OEM trajectory data |
| App mount + ~100ms | `fetchMoonPosition()` starts | Async fetch of Horizons API for real-time Moon position |
| App mount + ~500ms | `fetchOEM()` completes | Sets `oemData`, `isLoading = false`. App re-renders, Scene mounts. |
| App mount + ~600ms | Moon.tsx mounts | `useMemo` computes circumcenter from oemData. `flybyPos` is correct. |
| App mount + ~600ms | Moon.tsx renders | Moon sphere positioned at `flybyPos` (circumcenter). |
| App mount + ~650ms | Moon.tsx `useEffect` fires | Writes correct `flybyPos` to `moonPosition` in store. |
| App mount + ~650ms | Trajectory.tsx renders | Uses `moonPosition` from store for culling. At this point, culling is correct. |
| App mount + ~1-3s | **`fetchMoonPosition()` completes** | **OVERWRITES** `moonPosition` with Horizons API value (different from circumcenter!) |
| Ongoing | Trajectory re-renders | Now culls around the WRONG position (Horizons, not circumcenter). Moon sphere stays at circumcenter. Trajectory passes through Moon. |
| Every 30 min | `fetchMoonPosition()` re-fires | Continues to overwrite moonPosition with Horizons value. |

**Alternate path (Horizons API fails):**

| Time | Event | Details |
|------|-------|---------|
| App mount + ~1-3s | `fetchMoonPosition()` fails | Writes fallback `{x: 384400/10000, y: 0, z: 0}` = `{x: 38.44, y: 0, z: 0}` -- a point on the X-axis, nowhere near the actual trajectory. |

---

## Root Cause Analysis

### Primary Cause: Race Condition -- useOEM.ts Overwrites Moon.tsx's Correct Position

`useOEM.ts` and `Moon.tsx` both write to `moonPosition` in the Zustand store. Their writes happen at different times:

1. **`useOEM.ts` line 74**: Immediate synchronous write of fallback `{x:38.44, y:0, z:0}` at mount time
2. **`Moon.tsx` line 68-72**: `useEffect` write of circumcenter-computed position after OEM data loads
3. **`useOEM.ts` lines 59-64 or 69**: Async write of Horizons API value (or fallback) when API responds

Step 3 fires AFTER step 2, overwriting the correct circumcenter value. The Moon sphere continues to render at the circumcenter position (via `flybyPos` prop), but `Trajectory.tsx` reads `moonPosition` from the store and culls around the overwritten (wrong) position.

```typescript
// useOEM.ts:59-64 -- This overwrites Moon.tsx's correct position
useMissionStore.getState().setMoonPosition({
  x: parseFloat(posMatch[1]) / SCALE_FACTOR,  // Horizons real-time value
  y: parseFloat(posMatch[2]) / SCALE_FACTOR,
  z: parseFloat(posMatch[3]) / SCALE_FACTOR,
});

// useOEM.ts:69 -- Fallback also overwrites
useMissionStore.getState().setMoonPosition({ x: 384400 / SCALE_FACTOR, y: 0, z: 0 });
```

```typescript
// Moon.tsx:68-72 -- This writes the CORRECT value, but gets overwritten
useEffect(() => {
  useMissionStore.getState().setMoonPosition({
    x: flybyPos[0], y: flybyPos[1], z: flybyPos[2],
  });
}, [flybyPos]);

// Moon.tsx:75 -- Moon sphere renders at flybyPos (circumcenter), NOT moonPosition
return <group position={flybyPos}> ...
```

```typescript
// Trajectory.tsx:85-87 -- Reads moonPosition from store (overwritten value)
const moonPos: Point3 | null = moonPosition
  ? [moonPosition.x, moonPosition.y, moonPosition.z]
  : null;
```

### Secondary Cause: Moon Sphere Uses Local Position, Not Store Position

`Moon.tsx` renders the sphere at `flybyPos` (its local `useMemo` result), NOT at `moonPosition` from the store. This means even if the store value gets overwritten, the Moon sphere stays at the circumcenter. The result is a visual disconnect: the Moon is at position A, culling happens at position B.

### Tertiary Cause: Horizons API Returns Real-Time Position, Not Flyby-Epoch Position

The Horizons API (`/api/horizons`) requests the Moon's position at the current system time. The OEM trajectory data is from a specific epoch (April 2-10, 2026). If the current time is not during the flyby, the Moon's real-time position will differ from where it was during the trajectory's closest approach. Even if the times match roughly, the Moon position from Horizons is in a slightly different reference frame context than what the circumcenter computes from the trajectory geometry.

---

## Contributing Factors

### 1. Incomplete Implementation of Prior RCA Fix 3

The RCA at `docs/RCAs/2026-04-04_2130_trajectory_near_moon.md` explicitly called for three fixes:
- Fix 1 (circumcenter algorithm): **IMPLEMENTED** in Moon.tsx
- Fix 2 (reduce culling radius to 0.55): **IMPLEMENTED** in Trajectory.tsx
- Fix 3 (unify Moon position source): **NOT IMPLEMENTED** -- useOEM.ts still writes independently

### 2. No Guard Against Overwrite

There is no mechanism to prevent `useOEM.ts` from overwriting `Moon.tsx`'s position. No priority system, no timestamp comparison, no "source" tag on the position data.

### 3. Polling Interval Compounds the Problem

`useOEM.ts` polls Horizons every 30 minutes. Even if the race is initially resolved correctly, the next poll will overwrite `moonPosition` again.

---

## Evidence

### Screenshot Evidence

The user-provided screenshot shows:
- The Moon sphere is rendered at a position (labeled "MOON" with gray sphere)
- The cyan dashed trajectory line enters the Moon sphere from the lower-left
- Trajectory segments are visible INSIDE the Moon sphere
- The trajectory exits the Moon to the upper-right
- This confirms the culling is happening at a DIFFERENT position than the Moon sphere

### Code Evidence

```typescript
// Moon.tsx:75 -- Renders at flybyPos (local circumcenter computation)
return (
  <group position={flybyPos}>
    {/* Moon sphere */}
    <mesh> ... </mesh>
  </group>
);

// Moon.tsx:68-72 -- Writes flybyPos to store (gets overwritten by useOEM.ts)
useEffect(() => {
  useMissionStore.getState().setMoonPosition({
    x: flybyPos[0], y: flybyPos[1], z: flybyPos[2],
  });
}, [flybyPos]);
```

```typescript
// useOEM.ts:74 -- Immediate fallback write (before Moon.tsx even mounts)
useMissionStore.getState().setMoonPosition({ x: 384400 / SCALE_FACTOR, y: 0, z: 0 });

// useOEM.ts:59-64 -- Async Horizons write (overwrites Moon.tsx AFTER it writes)
useMissionStore.getState().setMoonPosition({
  x: parseFloat(posMatch[1]) / SCALE_FACTOR,
  y: parseFloat(posMatch[2]) / SCALE_FACTOR,
  z: parseFloat(posMatch[3]) / SCALE_FACTOR,
});
```

```typescript
// Trajectory.tsx:85-87 -- Reads from store (gets the OVERWRITTEN value, not circumcenter)
const moonPos: Point3 | null = moonPosition
  ? [moonPosition.x, moonPosition.y, moonPosition.z]
  : null;
```

### Data Flow Evidence

```
                    ┌─────────────────────────────────┐
                    │        moonPosition (store)       │
                    └────────┬──────────┬───────────────┘
                             │          │
                     WRITES  │          │  READS
                             │          │
         ┌───────────────────┴──┐   ┌──┴─────────────────────┐
         │                      │   │                         │
    useOEM.ts (async)    Moon.tsx│   │ Trajectory.tsx          │
    writes WRONG value   writes │   │ uses moonPos for culling│
    (overwrites correct) CORRECT│   │                         │
         │                value │   │ DataDriver.tsx          │
         │                      │   │ uses moonPos for dist   │
         │                      │   │                         │
         └──────────────────────┘   └─────────────────────────┘
         
    Moon.tsx RENDERS at flybyPos (correct, circumcenter)
    Trajectory.tsx CULLS at moonPosition (wrong, overwritten by useOEM.ts)
    
    Result: Moon sphere at position A, culling at position B
            Trajectory passes through Moon sphere
```

---

## Impact Assessment

| Metric | Value |
|--------|-------|
| Visual impact | Trajectory line passes through Moon sphere -- most prominent visual defect |
| Mission phase affected | Lunar flyby -- the centerpiece of the Artemis II visualization |
| Culling accuracy | Culling happens at wrong location, creating gaps where there should be none and showing trajectory where it should be hidden |
| User experience | Undermines the credibility of the entire visualization |
| Recurrence | 4th manifestation across Sessions 2-5 |

---

## Recommended Fixes

### Fix 1: Remove useOEM.ts Moon Position Writes (HIGH PRIORITY)

Remove ALL `setMoonPosition()` calls from `useOEM.ts`. Moon.tsx is the sole authority on Moon position since it computes the circumcenter from trajectory data and renders the sphere at that position.

```typescript
// useOEM.ts -- REMOVE these three lines:
// Line 74: useMissionStore.getState().setMoonPosition({ x: 384400 / SCALE_FACTOR, y: 0, z: 0 });
// Lines 59-64: useMissionStore.getState().setMoonPosition({ ... Horizons ... });
// Line 69: useMissionStore.getState().setMoonPosition({ x: 384400 / SCALE_FACTOR, y: 0, z: 0 });
```

The Horizons API fetch (`fetchMoonPosition`) can be removed entirely or kept for informational purposes but should NOT write to `moonPosition`.

**Informed by**: Prior RCA Fix 3 at `docs/RCAs/2026-04-04_2130_trajectory_near_moon.md` -- this is the exact fix that was designed but not implemented.

### Fix 2: Make Moon.tsx the Single Source of Truth (HIGH PRIORITY)

Moon.tsx already computes the correct position via circumcenter AND renders at that position. Its `useEffect` already writes to the store. The only issue is that this write gets overwritten. With Fix 1 applied, Moon.tsx becomes the single source and no overwrite occurs.

If OEM data hasn't loaded yet (moonPosition is null), Trajectory.tsx already handles this correctly:
```typescript
const moonPos: Point3 | null = moonPosition
  ? [moonPosition.x, moonPosition.y, moonPosition.z]
  : null;
// When null, no Moon culling is applied -- correct behavior during loading
```

**Informed by**: Prior RCA Fix 3.

### Fix 3: Remove fetchMoonPosition Function Entirely (MEDIUM PRIORITY)

The `fetchMoonPosition` function and its interval are now unnecessary:
- The circumcenter algorithm derives Moon position from trajectory geometry -- more accurate for visualization purposes
- The Horizons API value is for the current real-time Moon position, which may not match the OEM epoch
- Removing it eliminates the race condition permanently and simplifies the code

```typescript
// useOEM.ts -- Remove:
// - fetchMoonPosition() function (lines 47-71)
// - Line 74: immediate fallback setMoonPosition
// - Line 77: fetchMoonPosition() call
// - Line 80: moonInterval = setInterval(fetchMoonPosition, ...)
// - Line 86: clearInterval(moonInterval)
```

**Informed by**: New analysis -- the Horizons data is not needed when circumcenter provides a trajectory-consistent position.

---

## Upstream/Downstream Impact Analysis

### Upstream (What sets moonPosition)
- `useOEM.ts` -- 3 writes (initial fallback, Horizons success, Horizons failure) -- **TO BE REMOVED**
- `Moon.tsx` -- 1 write (circumcenter from oemData) -- **SOLE SOURCE after fix**

### Downstream (What reads moonPosition)
- `Trajectory.tsx` -- `splitAroundBodies()` culling (expects scene units) -- will now cull correctly around circumcenter
- `DataDriver.tsx` -- Moon distance for HUD (expects scene units, multiplies by SCALE_FACTOR) -- will use circumcenter distance
- `Earth.tsx` -- Moon-Earth distance in hover card -- will use circumcenter distance
- `Spacecraft.tsx` -- Moon distance tooltip -- reads from store via spacecraft.moonDist

### Side Effects
- Moon-Earth distance will be derived from circumcenter, which approximates the true distance. For the visualization this is more consistent than the Horizons value.
- No more 30-minute Horizons API polls (reduces API calls)
- Simpler data flow: one source of truth for Moon position

---

## Verification Plan

1. **No trajectory gaps**: Verify the trajectory renders continuously near the Moon with no visible gaps from all camera presets (Follow Orion, Earth View, Moon View, Free)
2. **No trajectory inside Moon**: Verify no trajectory segments are visible inside the Moon sphere
3. **Moon centered on flyby loop**: Verify the Moon sphere appears visually centered within the trajectory's flyby curve
4. **HUD Moon Distance**: Verify the Moon Distance telemetry shows reasonable values (~258,000 km at current mission time per screenshot)
5. **Build passes**: `npm run build` succeeds
6. **No Horizons errors**: Verify removing Horizons polling doesn't cause console errors

---

**Investigation Complete**: 2026-04-05 01:00 UTC
**Ready for**: RCA Document + Implementation Prompt
