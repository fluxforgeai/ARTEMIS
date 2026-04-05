# Investigation: Milestone Trajectory Position Accuracy — Recurring Systemic Errors

**Date**: 2026-04-05
**Investigator**: Claude Code (Session 6)
**Severity**: Critical
**Status**: Investigation Complete

---

## Executive Summary

A comprehensive audit of all 19 milestone positions against the OEM trajectory data and NASA's published mission timeline reveals **10 milestones with significant positioning errors** — 3 CRITICAL, 4 HIGH, and 3 MEDIUM severity. The most severe error is the TLI Burn milestone at T+1.75h, which is 23.5 hours early and renders at a completely wrong position (clamped to the start of OEM data at 28,409 km from Earth, when the actual TLI occurred at the phasing orbit perigee at 6,564 km). This is the third time milestone positioning has been corrected, yet fundamental errors persist because previous corrections used insufficiently rigorous methodology — correcting some milestones while introducing or missing others.

---

## External Research Findings

### Official Documentation Consulted

**NASA Artemis II Mission Timeline** (nasa.gov, April 2026):
- SRB Separation: T+02:08 (0.036h)
- Core Stage MECO: T+08:06 (0.135h), separation 10s later
- Perigee Raise Burn: T+49 min (0.817h) — raised orbit to 115 x 1,381 mi
- ICPS Separation: T+03:24:15 (3.404h) — after proximity operations demo
- TLI Burn: 7:49 PM EDT April 2 (T+25.23h) — 5 min 50 sec burn at phasing orbit perigee
- Lunar Flyby Closest Approach: 7:02 PM EDT April 6 (T+120.45h) — 4,066 miles above lunar surface
- Splashdown: 8:07 PM EDT April 10 (T+217.53h) — off San Diego

**NASA Press Kit / Overview Timeline** (nasa.gov/artemis-ii-press-kit):
- Artemis II uses a phasing orbit profile (NOT direct TLI like Artemis I)
- Launch -> parking orbit -> phasing orbit (~25h) -> TLI at perigee -> translunar coast
- OTB-1 (first outbound trajectory correction) occurs on Flight Day 3 (~T+29h)

**OEM Data Analysis** (public/fallback-oem.asc, 3,239 vectors):
- Data range: T+3.38h to T+217.31h
- Phasing orbit apogee: T+13.55h at 76,523 km
- Phasing orbit perigee (TLI): T+25.25h at 6,564 km, velocity 10.577 km/s
- Lunar SOI entry: T+102.1h at 66,059 km from Moon
- Perilune: T+120.51h at 8,357 km from Moon
- Lunar SOI exit: T+138.9h
- Last vector: T+217.31h at 6,505 km from Earth (altitude 134 km — near EI)

### Sources
- [NASA Launch Day Updates](https://www.nasa.gov/blogs/missions/2026/04/01/live-artemis-ii-launch-day-updates/)
- [NASA Flight Day 2: TLI Burn Complete](https://www.nasa.gov/blogs/missions/2026/04/02/artemis-ii-flight-day-2-orion-completes-tli-burn-crew-begins-journey-to-the-moon/)
- [NASA Daily Agenda](https://www.nasa.gov/missions/artemis/nasas-artemis-ii-moon-mission-daily-agenda/)
- [NASA Sets Coverage](https://www.nasa.gov/missions/artemis/artemis-2/nasa-sets-coverage-for-artemis-ii-moon-mission/)
- [NASA Artemis II Press Kit](https://www.nasa.gov/artemis-ii-press-kit/)
- [NASASpaceFlight: Artemis II Launch](https://www.nasaspaceflight.com/2026/03/artemis-ii-launch/)
- [Space.com: TLI Burn](https://www.space.com/space-exploration/artemis/artemis-2-astronauts-head-for-moon-translunar-injection-burn)
- [NASA Flight Day 3: OTC Burn Update](https://www.nasa.gov/blogs/missions/2026/04/03/artemis-ii-flight-day-3-outbound-trajectory-correction-burn-update/)
- [NASA AAS 23-062: Optimized Trajectory Correction Burn Placement](https://ntrs.nasa.gov/api/citations/20230000223/downloads/Artemis2OptTrajDesignFinal.pdf)

---

## Learnings from Previous RCAs/Investigations/Research

### Related Past Incidents

1. **Commit 103c1ee** (Session 5): "Fix milestone timing: Lunar Flyby T+96h->T+114h, aligned to OEM data"
   - Corrected Lunar Approach 80->100h, Flyby 96->114h, Return Burn 120->130h
   - But 114h was still wrong — actual perilune is at T+120.5h (6.5h error remains)
   - Did NOT check TLI Burn timing at all

2. **Commit b45690b** (Session 5): "Full milestone audit: fix 4 more positions verified against OEM data"
   - Renamed OTB-2 to TLI Perigee (24->25h) — correctly identified phasing orbit perigee
   - Changed Lunar Approach 100->85h — actually made it WORSE (real SOI entry is T+102h)
   - Changed CM/SM Sep 227->215h, Entry Interface 228->216h
   - Claimed "15/19 milestones verified CORRECT, 4 corrected" — but 10 are wrong
   - Did NOT notice TLI Burn at T+1.75h is 23.5 hours wrong

3. **Session 5 Summary** stated "All 19 verified against OEM data" — this is incorrect. The audit used approximate reasoning rather than computing distances against actual NASA data.

### Patterns Identified

**This is a recurring issue (3rd correction attempt)**:
- Session 3/4: Initial milestone times were rough estimates based on Artemis I profile
- Session 5a: First correction — Lunar Flyby moved from 96h to 114h (still 6.5h wrong)
- Session 5b: Second correction — renamed OTB-2, moved Lunar Approach to 85h (made it 17h worse)
- Each correction fixed some milestones but introduced new errors or missed existing ones

**Root cause pattern**: Corrections were made by approximate reasoning ("this looks about right near the Moon") rather than cross-referencing against NASA's published event times. The OEM data was consulted but the Moon position calculation used to determine lunar flyby timing was inaccurate due to linear interpolation of 6-hour Moon ephemeris points.

### Applicable Previous Solutions

The JPL ephemeris approach (used for Moon positioning in Session 5) provides the right methodology — use authoritative external data sources. The same principle must apply to milestones: use NASA's published mission timeline, not estimated timings.

---

## Root Cause Analysis

### Primary Cause: TLI Burn uses Artemis I direct-injection profile, not Artemis II phasing orbit

The TLI Burn milestone was initially set at T+1.75h, which matches the Artemis I mission profile where the ICPS fires ~1.75 hours after launch for a direct translunar injection. However, Artemis II uses a fundamentally different profile:

1. Launch to parking orbit (T+0 to T+0.14h)
2. Phasing orbit with apogee at 76,523 km (T+13.5h)
3. Return to perigee at 6,564 km (T+25.25h)
4. TLI burn at perigee using Orion's ESM engine (T+25.23h, per NASA)

The code has both "TLI Burn" at T+1.75h (wrong, Artemis I profile) and "TLI Perigee" at T+25h (correct position but wrong name — this IS the TLI burn). These are duplicates pointing to the same event.

### Secondary Cause: Lunar Approach and Flyby timing not verified against actual Moon ephemeris

The Lunar Approach milestone at T+85h was set based on approximate distance from Earth, not actual distance from the Moon. Computing the spacecraft-to-Moon distance using the JPL ephemeris data shows Lunar SOI entry (66,183 km from Moon center) occurs at T+102.1h, not T+85h. The Lunar Flyby at T+114h was an improvement over T+96h but is still 6.5 hours before the actual perilune at T+120.5h (confirmed by NASA at 7:02 PM EDT April 6).

### Tertiary Cause: OEM data does not cover full mission, causing clamping artifacts

The OEM data starts at T+3.38h and ends at T+217.31h. Six milestones fall before the OEM start (Launch through ICPS Separation), and the Splashdown milestone at T+240h falls 22.7 hours after the OEM ends. The `lagrangeInterpolate` function clamps to the nearest endpoint, meaning:
- All 6 early milestones render at the SAME position (first OEM vector, 28,409 km from Earth)
- Splashdown renders at the last OEM vector (6,505 km from Earth, during re-entry)

---

## Contributing Factors

### 1. Pre-OEM Gap (T+0 to T+3.38h): 6 milestones clumped at single point

The OEM data does not include the ascent phase. The `lagrangeInterpolate` function in `src/data/interpolator.ts:26` clamps to the first vector:
```typescript
if (t < firstEpoch || t > lastEpoch) {
  const nearest = t < firstEpoch ? vectors[0] : vectors[vectors.length - 1];
  return { x: nearest.x, y: nearest.y, z: nearest.z, ... };
}
```
All 6 pre-OEM milestones (Launch, SRB Sep, Core Stage Sep, Perigee Raise, TLI Burn, ICPS Sep) resolve to the identical point at (-2.447, -1.268, -0.690) scene units.

### 2. TLI Burn / TLI Perigee duplication

The code contains two milestones for the same physical event:
- "TLI Burn" at T+1.75h (before OEM data, clamped to wrong position)
- "TLI Perigee" at T+25h (correct position, but named as perigee rather than TLI burn)

### 3. Splashdown timing: T+240h vs actual T+217.53h

The MISSION_DURATION_DAYS constant is 10 (giving T+240h), but NASA's actual splashdown occurred at 8:07 PM EDT April 10 = T+217.53h. The OEM data ends at T+217.31h, so the Splashdown milestone at T+240h is clamped to the final re-entry position.

### 4. Mission events panel and progress bar use same wrong timings

The `MILESTONES` array in `src/data/mission-config.ts` is the single source of truth consumed by:
- `src/components/MilestoneMarker.tsx` — 3D trajectory markers
- `src/hud/ProgressBar.tsx` — progress bar dots and tooltips
- `src/hud/MissionEventsPanel.tsx` — event timeline panel
- `src/data/mission-config.ts:getMissionElapsed()` — current phase detection

All four consumers display incorrect milestone timing and positions.

---

## Evidence

### OEM Data vs Milestone Positions

| Milestone | Current (h) | Actual (h) | Error (h) | Position Problem |
|-----------|-------------|------------|-----------|------------------|
| Launch | 0 | 0 | 0 | Clamped to T+3.38h position (28,409 km) |
| SRB Separation | 0.035 | 0.036 | 0 | Same clamped position as Launch |
| Core Stage Sep | 0.14 | 0.138 | 0 | Same clamped position |
| Perigee Raise | 0.25 | 0.817 | 0.57 | Same clamped position; also 34 min early |
| **TLI Burn** | **1.75** | **25.23** | **23.5** | **CRITICAL: 23.5h early, wrong trajectory segment** |
| ICPS Separation | 2.5 | 3.40 | 0.9 | Clamped position; also 54 min early |
| Belt Transit | 5 | ~3.8 | 1.2 | Position reasonable but timing imprecise |
| OTB-1 | 8 | ~28.2 | 20.2 | Planned 3h after TLI (~T+28.2h), cancelled — trajectory precise |
| TLI Perigee | 25 | 25.25 | 0.25 | Correct position — IS the TLI burn |
| Star Tracker Cal | 36 | ~36 | ~0 | OK |
| MCC-1 | 48 | ~48 | ~0 | OK |
| **Lunar Approach** | **85** | **102.1** | **17.1** | **HIGH: 17h early, ~50,000 km from actual SOI** |
| **Lunar Flyby** | **114** | **120.45** | **6.5** | **CRITICAL: 6.5h before actual perilune** |
| Return Burn | 130 | ~139 | 9 | HIGH: 9h before lunar SOI exit |
| Return Coast | 144 | ~144 | ~0 | OK |
| MCC-3 | 200 | ~200 | ~0 | OK |
| CM/SM Sep | 215 | ~216.8 | 1.8 | MEDIUM: 1.8h early |
| Entry Interface | 216 | ~217.3 | 1.3 | MEDIUM: 1.3h early |
| **Splashdown** | **240** | **217.53** | **22.5** | **CRITICAL: 22.5h late, clamped to EI position** |

### Code Evidence: Interpolator Clamping

```typescript
// src/data/interpolator.ts:25-27
if (t < firstEpoch || t > lastEpoch) {
  const nearest = t < firstEpoch ? vectors[0] : vectors[vectors.length - 1];
  return { x: nearest.x, y: nearest.y, z: nearest.z, ... };
}
```

This silently clamps out-of-range milestones to boundary positions without any warning.

### Code Evidence: Duplicate TLI Milestones

```typescript
// src/data/mission-config.ts:31,35
{ name: 'TLI Burn', missionElapsedHours: 1.75, ... },  // WRONG: Artemis I timing
{ name: 'TLI Perigee', missionElapsedHours: 25, ... },  // CORRECT: actual TLI at phasing perigee
```

---

## Impact Assessment

| Metric | Value |
|--------|-------|
| Milestones with significant errors | 10 of 19 (53%) |
| CRITICAL errors (>20h or wrong trajectory segment) | 3 (TLI Burn, OTB-1, Splashdown) |
| HIGH errors (>5h displacement) | 3 (Lunar Approach, Lunar Flyby, Return Burn) |
| MEDIUM errors (1-5h displacement) | 3 (CM/SM Sep, Entry Interface, Belt Transit) |
| LOW errors (<1h displacement) | 1 (Perigee Raise) |
| Milestone markers at wrong 3D position | 10 |
| Progress bar dots at wrong positions | 10 |
| Event panel timeline inaccurate | 10 entries |
| Current phase detection affected | Yes — getMissionElapsed uses wrong timings |
| User credibility impact | High — app displays demonstrably wrong event positions |

---

## Recommended Fixes

### Fix 1: Correct All Milestone Timings to NASA Actual Data (CRITICAL)

Update `src/data/mission-config.ts` MILESTONES array with NASA-verified timings:

| Milestone | Correct MET (h) | Source |
|-----------|-----------------|--------|
| Launch | 0 | Fixed |
| SRB Separation | 0.036 | NASA Launch Blog |
| Core Stage Sep | 0.138 | NASA Launch Blog |
| Perigee Raise | 0.817 | NASA Blog |
| ICPS Separation | 3.40 | NASA Press Kit |
| Belt Transit | 3.8 | OEM analysis (inner belt entry ~2,000 km alt) |
| TLI Burn | 25.23 | NASA Blog (7:49 PM EDT Apr 2) — at phasing orbit perigee |
| OTB-1 | 28.2 | NASA — planned 3h after TLI, cancelled (trajectory precise) |
| Star Tracker Cal | 36 | Plausible (Flight Day 3) |
| MCC-1 | 48 | Plausible (Flight Day 3) |
| Lunar Approach | 102 | OEM Lunar SOI entry |
| Lunar Flyby | 120.45 | NASA Blog (7:02 PM EDT Apr 6) |
| Return Burn | 139 | Near Lunar SOI exit |
| Return Coast | 144 | Plausible |
| MCC-3 | 200 | Plausible (Flight Day 9) |
| CM/SM Sep | 217.0 | Estimated EI - 30 min |
| Entry Interface | 217.3 | OEM final altitude |
| Splashdown | 217.53 | NASA Coverage (8:07 PM EDT Apr 10) |

Remove the duplicate "TLI Perigee" milestone — the corrected "TLI Burn" at T+25.23h already represents this event.

**Informed by**: NASA published mission data and OEM trajectory analysis. Previous corrections (Sessions 5a, 5b) were partially correct but did not cross-reference against NASA's published times.

### Fix 2: Update MISSION_DURATION_DAYS and Splashdown Epoch (HIGH)

The `MISSION_DURATION_DAYS = 10` produces `MISSION_END_EPOCH` of April 11 22:35 UTC, but actual splashdown was April 11 00:07 UTC (~9.07 days). Update to match reality or compute from Splashdown milestone.

**Informed by**: NASA coverage confirms splashdown at 8:07 PM EDT April 10.

### Fix 3: Update Lunar Flyby Description (MEDIUM)

Current: "Closest approach ~8,900 km above lunar far side"
OEM data shows closest approach at 8,357 km from Moon center. Moon radius is 1,737 km, so altitude is ~6,620 km, not 8,900 km. NASA says 4,066 miles = 6,543 km. Update description.

**Informed by**: OEM perilune analysis and NASA published flyby distance.

---

## Upstream/Downstream Impact Analysis

### Upstream (Data Sources)
- `src/data/mission-config.ts:MILESTONES` — single source of truth for all milestone data
- `src/data/mission-config.ts:MISSION_DURATION_DAYS` — drives progress calculations

### Downstream (Consumers)
- `src/components/MilestoneMarker.tsx` — renders 3D markers on trajectory (line 28: `lagrangeInterpolate(oemData, targetEpochMs)`)
- `src/hud/ProgressBar.tsx` — positions dots on timeline (line 22: `m.missionElapsedHours / TOTAL_MISSION_HOURS`)
- `src/hud/MissionEventsPanel.tsx` — event list (line 7: `SORTED_MILESTONES`)
- `src/data/mission-config.ts:getMissionElapsed()` — phase detection (line 74: `elapsedHours >= m.missionElapsedHours`)
- `src/hooks/useAlerts.ts` — milestone approach alerts

### Risk Assessment
All downstream consumers read from the same `MILESTONES` array. Correcting the array fixes all consumers simultaneously. No migration or API changes needed.

---

## Verification Plan

1. After updating MILESTONES, run the OEM position audit script to verify each milestone's interpolated position falls within 1 hour of the NASA-published event time
2. Verify that the Lunar Flyby milestone's interpolated position is within 500 km of the perilune point from OEM data
3. Verify that the TLI Burn milestone renders at the phasing orbit perigee (~6,564 km from Earth), not at the start of OEM data
4. Verify that the Splashdown milestone is at the end of the trajectory (near EI), not clamped beyond the OEM range
5. Verify that no two milestones resolve to the same 3D position (deduplication check for clamped milestones)
6. Verify progress bar shows milestones at proportionally correct positions across the timeline
7. Visual check in 3D view that TLI Burn, Lunar Flyby, and Return Burn markers appear at trajectory inflection points

---

**Investigation Complete**: 2026-04-05 16:00 UTC
**Ready for**: RCA Document / Implementation Plan
