# Implementation Prompt: Remove Moon Position Race Condition

**RCA Reference**: docs/RCAs/2026-04-05_0105_trajectory_through_moon_race.md

## Context

`useOEM.ts` overwrites Moon.tsx's correct circumcenter-computed `moonPosition` in the Zustand store, causing Trajectory.tsx to cull at the wrong location. The trajectory passes through the visible Moon sphere.

## Goal

Remove all Moon position writes from `useOEM.ts`, making Moon.tsx the sole source of truth.

## Requirements

Remove from `src/hooks/useOEM.ts`:
1. The `HORIZONS_POLL_INTERVAL` constant
2. The entire `fetchMoonPosition()` async function
3. The immediate fallback `setMoonPosition` call before `fetchOEM()`
4. The `fetchMoonPosition()` invocation
5. The `moonInterval` setInterval
6. The `clearInterval(moonInterval)` in cleanup
7. The `SCALE_FACTOR` import (no longer used)

## Files Affected

- `src/hooks/useOEM.ts` — remove Moon position code

## Acceptance Criteria

- [ ] Build passes (`npm run build`)
- [ ] `useOEM.ts` has no `setMoonPosition` calls
- [ ] `useOEM.ts` has no `fetchMoonPosition` function
- [ ] `useOEM.ts` has no Horizons API code
- [ ] Moon.tsx remains unchanged (already correct)
- [ ] Trajectory.tsx remains unchanged (already correct)
