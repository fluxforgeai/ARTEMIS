# Root Cause Analysis: Trajectory Passes Through Moon — Race Condition

**Date**: 2026-04-05
**Severity**: High
**Status**: Identified
**Tracker**: F3 in `docs/findings/2026-04-04_2200_ui_visual_regressions_session5_FINDINGS_TRACKER.md`
**Investigation**: `docs/investigations/2026-04-05_0100_trajectory_through_moon_race_condition.md`

## Problem Statement

The trajectory line passes visibly through the Moon sphere. The Moon renders at position A (circumcenter, correct) but trajectory culling happens at position B (Horizons/fallback, wrong).

## Symptoms

- Dashed cyan trajectory segments visible inside the Moon sphere
- Trajectory enters and exits the Moon body without being culled

## Root Cause

`useOEM.ts` writes to `moonPosition` in the store 3 times (initial fallback, Horizons API success, Horizons API failure). These writes fire AFTER Moon.tsx's `useEffect` writes the correct circumcenter value, overwriting it. Moon.tsx renders at its local `flybyPos` (correct), but Trajectory.tsx reads `moonPosition` from the store (overwritten/wrong) for culling.

This is the **4th manifestation** of the Moon position problem across Sessions 2-5. The prior RCA (2026-04-04) designed Fix 3 (unify Moon position source) but it was not implemented.

## Evidence

```
Moon.tsx: renders at flybyPos (circumcenter) → CORRECT
Moon.tsx: useEffect writes flybyPos to store → CORRECT, but gets overwritten
useOEM.ts: fetchMoonPosition() overwrites store → WRONG position
Trajectory.tsx: reads moonPosition from store → reads WRONG value, culls at wrong location
```

## Resolution

Remove all `setMoonPosition` calls and the `fetchMoonPosition` function from `useOEM.ts`. Moon.tsx becomes the sole source of truth.

Specifically remove from `useOEM.ts`:
1. The `fetchMoonPosition()` function (lines ~46-70)
2. The immediate fallback `setMoonPosition` call (line ~74)
3. The `fetchMoonPosition()` invocation (line ~77)
4. The `moonInterval` setInterval (line ~80)
5. The `clearInterval(moonInterval)` cleanup (line ~86)
6. The `HORIZONS_POLL_INTERVAL` constant (line ~6)

Also remove the `SCALE_FACTOR` import from `useOEM.ts` since it was only used for Moon position writes.

## Prevention

Single source of truth: only Moon.tsx writes `moonPosition`. The store field is write-once-per-data-load, not polled.

## Debug Strategy

- **Self-debug**: enabled
- **Verifier**: `npm run build`
- **Max iterations**: 3
- **Completion criteria**: Build passes, no trajectory inside Moon sphere
- **Invoke with**: `/wrought-implement`
