# Root Cause Analysis: Two Moons — Moon Ephemeris Position vs Trajectory Turnaround

**Date**: 2026-04-10
**Severity**: High
**Status**: Identified
**Finding**: F5 in Replayable Mission Visualization Tracker
**Investigation**: `docs/investigations/2026-04-10_2300_two_moons_ephemeris_vs_trajectory.md`

## Problem Statement

The Moon renders at its current ephemeris position (T+214.5h), 32 scene units from the trajectory turnaround (T+120.45h flyby). The user sees the trajectory curving around empty space with the Moon sphere off to the side — a "two moons" effect.

## Symptoms

- Moon sphere visible but 32 su from the trajectory turnaround
- Trajectory curves around empty space at the flyby point
- User perceives "2 moons" — the sphere and the empty turnaround
- Trajectory culling (`splitAroundBodies`) uses the wrong Moon position

## Root Cause

`DataDriver.tsx:73` calls `getMoonPosition(simTimeRef.current)` where `simTimeRef.current` is the current clamped sim time (T+214.5h in LIVE mode). At T+214h, the Moon has orbited 52 degrees (318,472 km / 31.85 su) from its flyby position (T+120.45h). The OEM trajectory is static and still curves around the flyby-time position.

Before F1, `Moon.tsx` used `getMoonFlybyPosition()` — a static position at the flyby epoch that always aligned with the trajectory. The F1 migration made it dynamic, which is correct for replay but breaks visual coherence in LIVE mode.

```typescript
// DataDriver.tsx:73 — uses current sim time for Moon
const moonPos = getMoonPosition(simTimeRef.current);  // T+214h position, NOT flyby
```

## Evidence

| Position | X (su) | Y (su) | Z (su) |
|----------|--------|--------|--------|
| Moon at flyby (T+120.45h) | -12.93 | -33.59 | -18.52 |
| Moon at now (T+214.5h) | 18.73 | -31.18 | -16.00 |
| Delta | 31.66 | 2.41 | 2.52 |
| **Distance** | | | **31.85 su (318,472 km)** |

## Impact

Primary visual landmark for lunar flyby misplaced. Trajectory culling broken (culls around wrong position). User cannot visually associate the Moon with the trajectory.

## Resolution

**Use the flyby epoch for Moon position in LIVE mode. Use simTimeRef.current in REPLAY/SIM mode.**

```typescript
const FLYBY_EPOCH_MS = new Date('2026-04-06T23:06:00Z').getTime();
const moonTime = (mode === 'live') ? FLYBY_EPOCH_MS : simTimeRef.current;
const moonPos = getMoonPosition(moonTime);
```

Rationale:
- **LIVE mode**: Shows full mission trajectory. Moon at the turnaround is the only visually coherent position. The PRD says post-splashdown the tool is an archive — the Moon should be at the flyby landmark.
- **REPLAY/SIM mode**: User scrubs through time. Moon should animate to show where it was at each mission moment. At the flyby time, Moon aligns with the turnaround. At other times, it's at the correct ephemeris position for that sim time.

## Prevention

When moving celestial body positions from static to dynamic, consider that the trajectory data is fixed. The body's rendered position must be coherent with the trajectory in the default (LIVE) view.

## Debug Strategy

- **Self-debug**: enabled
- **Verifier**: `npm run build`
- **Max iterations**: 2
- **Completion criteria**: Build passes, Moon at flyby position in LIVE mode, dynamic in REPLAY/SIM
- **Invoke with**: `/wrought-rca-fix`
