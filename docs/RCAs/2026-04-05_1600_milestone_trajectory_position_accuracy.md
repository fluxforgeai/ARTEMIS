# Root Cause Analysis: Milestone Trajectory Position Accuracy — 10 of 19 Milestones Wrong

**Date**: 2026-04-05
**Severity**: Critical
**Status**: Identified
**Investigation**: [docs/investigations/2026-04-05_1600_milestone_trajectory_position_accuracy.md](../investigations/2026-04-05_1600_milestone_trajectory_position_accuracy.md)

## Problem Statement

53% of milestone positions (10 of 19) are significantly wrong. The most severe: TLI Burn renders 23.5 hours early at the wrong trajectory segment (uses Artemis I direct-injection at T+1.75h; actual Artemis II phasing orbit TLI is at T+25.23h). A duplicate "TLI Perigee" milestone exists at the correct time. Lunar Flyby is 6.5h early, Splashdown is 22.5h late (clamped beyond OEM data), and Lunar Approach is 17h early.

This is the **3rd correction attempt**. Sessions 5a and 5b each fixed some milestones while introducing or missing others because they used approximate reasoning rather than NASA's published event times.

## Symptoms

- TLI Burn marker at the start of the trajectory (clamped to first OEM vector at T+3.38h)
- TLI Burn and TLI Perigee are visually separate milestones for the same physical event
- Lunar Flyby marker positioned 6.5h before actual closest approach
- Splashdown marker at the re-entry position (clamped to last OEM vector, 22.5h before where it should be)
- 6 pre-OEM milestones all render at the identical 3D position (interpolator clamps to first vector)
- Progress bar dots at wrong proportional positions
- Mission Events panel shows incorrect MET values

## Root Cause

**Three independent root causes:**

### RC1: TLI Burn uses Artemis I direct-injection timing

The "TLI Burn" milestone at T+1.75h was set based on the Artemis I mission profile where ICPS fires for direct translunar injection ~1.75h after launch. Artemis II uses a **phasing orbit** profile: after reaching parking orbit, the spacecraft enters a ~25-hour phasing orbit before TLI occurs at perigee passage (T+25.23h per NASA). A "TLI Perigee" milestone at T+25h was added later to represent this, but the original wrong "TLI Burn" was never removed — creating a duplicate.

### RC2: Milestone timings set by approximate reasoning, not NASA data

Previous corrections (Sessions 5a, 5b) adjusted timings based on OEM data inspection and geometric reasoning ("this looks about right near the Moon") rather than cross-referencing against NASA's published event times. This led to partially correct fixes that introduced new errors (e.g., Lunar Approach moved from T+100h to T+85h — 17h further from the actual SOI entry at T+102h).

### RC3: MISSION_DURATION_DAYS overshoots actual mission by 22.5h

`MISSION_DURATION_DAYS = 10` gives T+240h, but actual splashdown was at T+217.53h (NASA: 8:07 PM EDT April 10). The OEM data ends at T+217.31h. The Splashdown milestone at T+240h clamps to the final OEM vector (re-entry position) rather than the actual splashdown location.

## Evidence

### Current MILESTONES vs NASA Actual (10 errors highlighted)

| Milestone | Current (h) | NASA Actual (h) | Error (h) | Severity |
|-----------|-------------|-----------------|-----------|----------|
| Launch | 0 | 0 | 0 | OK |
| SRB Separation | 0.035 | 0.036 | 0.001 | OK |
| Core Stage Sep | 0.14 | 0.138 | 0.002 | OK |
| **Perigee Raise** | **0.25** | **0.817** | **0.567** | LOW |
| **TLI Burn** | **1.75** | **25.23** | **23.48** | CRITICAL |
| **ICPS Separation** | **2.5** | **3.40** | **0.9** | LOW |
| **OTB-1** | **8** | **28.2** | **20.2** | CRITICAL |
| Belt Transit | 5 | ~3.8 | 1.2 | MEDIUM |
| ~~TLI Perigee~~ | ~~25~~ | — | — | DUPLICATE |
| Star Tracker Cal | 36 | ~36 | ~0 | OK |
| MCC-1 | 48 | ~48 | ~0 | OK |
| **Lunar Approach** | **85** | **102** | **17** | HIGH |
| **Lunar Flyby** | **114** | **120.45** | **6.45** | CRITICAL |
| **Return Burn** | **130** | **139** | **9** | HIGH |
| Return Coast | 144 | ~144 | ~0 | OK |
| MCC-3 | 200 | ~200 | ~0 | OK |
| **CM/SM Sep** | **215** | **217.0** | **2** | MEDIUM |
| **Entry Interface** | **216** | **217.3** | **1.3** | MEDIUM |
| **Splashdown** | **240** | **217.53** | **22.47** | CRITICAL |

### Code Evidence

```typescript
// src/data/mission-config.ts — DUPLICATE milestones
{ name: 'TLI Burn', missionElapsedHours: 1.75, ... },    // WRONG: Artemis I timing
{ name: 'TLI Perigee', missionElapsedHours: 25, ... },    // CORRECT: actual TLI event
```

```typescript
// src/data/mission-config.ts — wrong mission duration
export const MISSION_DURATION_DAYS = 10; // 240h — actual is 217.53h
```

```typescript
// src/hud/ProgressBar.tsx — hardcoded wrong total
const TOTAL_MISSION_HOURS = 240; // Should derive from mission-config
```

## Impact

- **3D trajectory markers**: 10 milestones render at wrong positions (some at identical clamped positions)
- **Progress bar**: 10 milestone dots at wrong proportional positions
- **Mission Events panel**: 10 entries show wrong MET values
- **Phase detection**: `getMissionElapsed().currentPhase` transitions at wrong times
- **Milestone alerts**: `useAlerts.ts` fires approach notifications at wrong times
- **Credibility**: App displays demonstrably wrong event positions, undermining trust

## Resolution

### Fix 1: Correct all milestone timings (CRITICAL)

Update `src/data/mission-config.ts` MILESTONES array to NASA-verified values. Remove "TLI Perigee" duplicate. Resulting milestone count: **18** (down from 19).

| Milestone | Corrected (h) | Source |
|-----------|---------------|--------|
| Launch | 0 | Fixed |
| SRB Separation | 0.036 | NASA Launch Blog |
| Core Stage Sep | 0.138 | NASA Launch Blog |
| Perigee Raise | 0.817 | NASA Blog: T+49 min |
| ICPS Separation | 3.40 | NASA Press Kit: T+3h24m15s |
| Belt Transit | 3.8 | OEM analysis: inner belt entry |
| TLI Burn | 25.23 | NASA Blog: 7:49 PM EDT Apr 2 |
| OTB-1 | 28.2 | NASA: ~3h post-TLI (waived) |
| Star Tracker Cal | 36 | Plausible (Flight Day 3) |
| MCC-1 | 48 | Plausible (Flight Day 3) |
| Lunar Approach | 102 | OEM: Lunar SOI entry at 66,059 km |
| Lunar Flyby | 120.45 | NASA Blog: 7:02 PM EDT Apr 6 |
| Return Burn | 139 | OEM: near Lunar SOI exit |
| Return Coast | 144 | Plausible |
| MCC-3 | 200 | Plausible (Flight Day 9) |
| CM/SM Sep | 217.0 | ~30 min before EI |
| Entry Interface | 217.3 | OEM: final altitude ~134 km |
| Splashdown | 217.53 | NASA: 8:07 PM EDT Apr 10 |

### Fix 2: Update mission duration (HIGH)

Change `MISSION_DURATION_DAYS` to `217.53 / 24` (~9.064 days). This fixes progress calculation and MISSION_END_EPOCH.

### Fix 3: Derive TOTAL_MISSION_HOURS from config (MEDIUM)

In `ProgressBar.tsx`, replace hardcoded `240` with import from mission-config to prevent future drift.

### Fix 4: Update descriptions (MEDIUM)

- TLI Burn: Mention phasing orbit perigee, ESM engine (not ICPS)
- OTB-1: Note burn was waived (trajectory precise)
- Lunar Flyby: Correct altitude from ~8,900 km to ~6,543 km (NASA: 4,066 miles)
- Splashdown: Update with actual splashdown location

## Prevention

1. **Single source of truth**: All milestone timings must reference NASA's published mission timeline, not approximate reasoning from trajectory data
2. **Cross-validation**: Any future milestone correction must be verified against at least two independent sources (NASA blog, OEM data, JPL ephemeris)
3. **No duplicate milestones**: Each physical event should have exactly one entry in the MILESTONES array
4. **Derived constants**: Progress calculations should derive from MILESTONES data, not hardcoded values

## Debug Strategy

- **Self-debug**: enabled
- **Verifier**: `npm run build`
- **Max iterations**: 5
- **Completion criteria**: Build passes. All milestone timings match the NASA-verified table above. No duplicate milestones. TOTAL_MISSION_HOURS derived from config. Milestone count is 18.
- **Escape hatch**: After 3 iterations, document blockers and request human review
- **Invoke with**: `/wrought-rca-fix`
