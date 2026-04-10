**2026-04-10 17:38 UTC**

# Replayable Mission Visualization -- Findings Tracker

**Created**: 2026-04-10 17:38 UTC
**Last Updated**: 2026-04-10 20:51 UTC
**Origin**: `/research` — replayable mission visualization architecture
**Session**: 8
**Scope**: Virtual clock abstraction, timeline scrubber, and playback controls to make the mission visualization replayable after splashdown

---

## Overview

Tracking the implementation of replay capability for the ARTEMIS mission visualization. The core issue is 12 `Date.now()` dependencies across 8 files that lock the visualization to real-time. The fix is a virtual clock abstraction in the Zustand store with LIVE/SIM/REPLAY modes and a timeline scrubber UI.

| # | Finding | Type | Severity | Status | Stage | Report |
|---|---------|------|----------|--------|-------|--------|
| F2 | Circular import — clearFiredMilestones() side effect in Zustand setter | Defect | **Critical** | Verified | Verified | [Report](2026-04-10_1830_replay_review_findings.md) |
| F1 | 12 Date.now() dependencies prevent mission replay after splashdown | Gap | **High** | Verified | Verified | [Report](2026-04-10_1738_replayable_mission_visualization.md) |
| F3 | 30s milestone check interval misses milestones at high replay rates | Defect | **Medium** | Verified | Verified | [Report](2026-04-10_1830_replay_review_findings.md) |
| F4 | Dual-write clock drift — ref vs store diverge up to 41 min at 10,000x | Defect | **Medium** | Verified | Verified | [Report](2026-04-10_1830_replay_review_findings.md) |
| F5 | Moon renders at real-time ephemeris position instead of trajectory-aligned sim time | Defect | **High** | Resolved | Resolved | [Report](2026-04-10_2051_moon_position_drift.md) |

**Status legend**: `Open` -> `In Progress` -> `Resolved` -> `Verified`
**Stage legend**: `Open` -> `Investigating` / `Designing` -> `RCA Complete` / `Blueprint Ready` -> `Planned` -> `Implementing` -> `Reviewed` -> `Resolved` -> `Verified`

---

## Dependency Map

```
F1 (Virtual clock + replay) — single monolithic feature with these sub-components:
  - Virtual clock store slice (Zustand)
  - DataDriver migration (Date.now() -> simEpochMs)
  - useMission migration (new Date() -> simEpochMs)
  - Trajectory migration (Date.now() -> simEpochMs)
  - useAlerts migration (Date.now() -> simEpochMs)
  - useSpaceWeather migration (Date.now() -> simEpochMs)
  - Moon animation (static flyby -> getMoonPosition(simEpochMs))
  - TimeControls UI component (scrubber + mode toggle + rate buttons)
  - URL search params for shareable time links
```

---

## F1: 12 Date.now() Dependencies Prevent Mission Replay (High Gap)

**Summary**: 12 `Date.now()` / wall-time dependencies across 8 files lock the visualization to real-time. After splashdown, the tracker shows 100% progress with no way to explore past mission phases. The PRD explicitly anticipates replay mode post-splashdown.

**Root cause**: MVP was built as a live tracker; replay was deferred as out-of-scope. Core interpolation functions already accept arbitrary timestamps, but the calling code hardcodes `Date.now()`.

**Resolution tasks**:

- [x] **F1.1**: Design approach (-> /design -> Stage: Designing)
- [x] **F1.2**: Blueprint + implementation prompt (-> /blueprint -> Stage: Blueprint Ready)
- [x] **F1.3**: Implementation plan (-> /plan -> Stage: Planned)
- [x] **F1.4**: Implement changes (Stage: Implementing -> Resolved)
- [x] **F1.5**: Code review (-> /forge-review -> Stage: Reviewed)
- [x] **F1.6**: Verify implementation (Stage: Verified)

**Recommended approach**: `/design from-scratch F1 virtual-clock-and-replay` — design the virtual clock store slice, TimeControls UI, and migration strategy for all 8 affected files.

**Status**: Resolved
**Stage**: Verified
**Resolved in session**: 8
**Verified in session**: 9
**Notes**: Research complete at `docs/research/2026-04-10_1400_replayable_mission_visualization.md`. 8 files modified, 2 new. First review BLOCKED on C1 (circular import). F2/F3/F4 fixes applied, second review LGTM. Build passes. All Date.now() dependencies migrated to virtual clock.
**GitHub Issue**: —
**Project Item ID**: —

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-10 17:38 UTC | 8 | [Finding Report](2026-04-10_1738_replayable_mission_visualization.md) |
| Designing | 2026-04-10 17:38 UTC | 8 | [Design](../design/2026-04-10_1738_virtual_clock_and_replay.md) |
| Blueprint Ready | 2026-04-10 17:38 UTC | 8 | [Blueprint](../blueprints/2026-04-10_1738_virtual_clock_and_replay.md) |
| Reviewed | 2026-04-10 18:30 UTC | 8 | [Review](../reviews/2026-04-10_1830_diff.md) -- BLOCKED (C1 critical) |
| Reviewed | 2026-04-10 19:00 UTC | 8 | [Review](../reviews/2026-04-10_1900_diff.md) -- LGTM (F2/F3/F4 resolved) |
| Resolved | 2026-04-10 19:00 UTC | 8 | All defects fixed, build passes |
| Verified | 2026-04-10 21:00 UTC | 9 | [Investigation](../investigations/2026-04-10_2100_replay_review_defects_f2_f3_f4.md) |

---

## F2: Circular Import — clearFiredMilestones() in Zustand Setter (Critical Defect)

**Summary**: `mission-store.ts` imports `clearFiredMilestones` from `useAlerts.ts` and calls it inside the `setTimeMode` action, creating a circular dependency (store -> useAlerts -> store).

**Root cause**: Direct import was the simplest wiring during F1 implementation, but violates Zustand pure-action convention.

**Resolution tasks**:

- [x] **F2.1**: Investigate — confirm scope and circular import behavior (-> /investigate)
- [x] **F2.2**: RCA + fix design (-> /rca-bugfix)
- [x] **F2.3**: Implementation plan (-> /plan)
- [x] **F2.4**: Implement fix (-> /wrought-rca-fix)
- [x] **F2.5**: Code review (-> /forge-review)
- [x] **F2.6**: Verify fix

**Recommended approach**: `/rca-bugfix` — cause is clear from the review. Move side effect to a `subscribe` listener in `useAlerts.ts` or call from TimeControls component.

**Status**: Resolved
**Stage**: Resolved
**Resolved in session**: 8
**Verified in session**: 9
**Notes**: Circular import removed. `clearFiredMilestones` moved to module-level subscribe listener in `useAlerts.ts`. `setTimeMode` is now a pure store action. Second forge-review confirmed fix (LGTM).

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-10 18:30 UTC | 8 | [Finding Report](2026-04-10_1830_replay_review_findings.md) |
| RCA Complete | 2026-04-10 18:30 UTC | 8 | [RCA](../RCAs/2026-04-10_1830_replay_review_defects.md) |
| Implementing | 2026-04-10 19:00 UTC | 8 | [Commit 8278413](../../) |
| Reviewed | 2026-04-10 19:00 UTC | 8 | [Review](../reviews/2026-04-10_1900_diff.md) -- LGTM |
| Resolved | 2026-04-10 19:00 UTC | 8 | Verified in code: no import from useAlerts in store |
| Verified | 2026-04-10 21:00 UTC | 9 | [Investigation](../investigations/2026-04-10_2100_replay_review_defects_f2_f3_f4.md) |

---

## F3: 30s Milestone Check Misses at High Replay Rates (Medium Defect)

**Summary**: `useAlerts.ts` runs milestone checks on a fixed 30s wall-clock interval. At 10,000x, 30s = 83h sim time. The T-30min alert window (180ms wall time) is almost never sampled.

**Root cause**: The 30s interval was designed for 1x real-time and was not adjusted for variable replay rates.

**Resolution tasks**:

- [x] **F3.1**: Investigate — confirm milestone skip behavior at various rates (-> /investigate)
- [x] **F3.2**: RCA + fix design (-> /rca-bugfix)
- [x] **F3.3**: Implementation plan (-> /plan)
- [x] **F3.4**: Implement fix (-> /wrought-rca-fix)
- [x] **F3.5**: Code review (-> /forge-review)
- [x] **F3.6**: Verify fix

**Recommended approach**: `/rca-bugfix` — drive milestone checks from DataDriver's 4Hz tick or scale interval with rate.

**Status**: Resolved
**Stage**: Resolved
**Resolved in session**: 8
**Verified in session**: 9
**Notes**: `setInterval(checkMilestones, 30_000)` removed. Replaced with `useMissionStore.subscribe` that fires at 4Hz. Range-based detection (`mh <= metHours && mh > prevMet`) ensures no milestone is skipped regardless of replay rate. Second forge-review confirmed fix (LGTM).

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-10 18:30 UTC | 8 | [Finding Report](2026-04-10_1830_replay_review_findings.md) |
| RCA Complete | 2026-04-10 18:30 UTC | 8 | [RCA](../RCAs/2026-04-10_1830_replay_review_defects.md) |
| Implementing | 2026-04-10 19:00 UTC | 8 | [Commit 8278413](../../) |
| Reviewed | 2026-04-10 19:00 UTC | 8 | [Review](../reviews/2026-04-10_1900_diff.md) -- LGTM |
| Resolved | 2026-04-10 19:00 UTC | 8 | Verified in code: subscribe-based, range-based detection |
| Verified | 2026-04-10 21:00 UTC | 9 | [Investigation](../investigations/2026-04-10_2100_replay_review_defects_f2_f3_f4.md) |

---

## F4: Dual-Write Clock Drift at 10,000x (Medium Defect)

**Summary**: DataDriver's `simTimeRef` (60Hz) leads `store.timeControl.simEpochMs` (4Hz sync) by up to 41 min sim-time at 10,000x. Spacecraft appears in the "future" trajectory segment.

**Root cause**: The dual-write pattern (ref for 60Hz interpolation, store at 4Hz for HUD) was designed for moderate rates. At extreme rates, the 4Hz sync lag becomes visible.

**Resolution tasks**:

- [x] **F4.1**: Investigate — confirm visual drift at 1000x and 10000x (-> /investigate)
- [x] **F4.2**: RCA + fix design (-> /rca-bugfix)
- [x] **F4.3**: Implementation plan (-> /plan)
- [x] **F4.4**: Implement fix (-> /wrought-rca-fix)
- [x] **F4.5**: Code review (-> /forge-review)
- [x] **F4.6**: Verify fix

**Recommended approach**: `/rca-bugfix` — batch `setSimTime` into the same `set()` call as `setSpacecraft`, or expose high-frequency time via shared ref for Trajectory.

**Status**: Resolved
**Stage**: Resolved
**Resolved in session**: 8
**Verified in session**: 9
**Notes**: Three separate `set()` calls (`setSpacecraft`, `setSimTime`, `setMoonPosition`) replaced with single atomic `useMissionStore.setState()` call. `tickSimulatedTime` dead code removed. Spacecraft position and `simEpochMs` are now in the same store snapshot -- Trajectory reads consistent state. Second forge-review confirmed fix (LGTM).

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-10 18:30 UTC | 8 | [Finding Report](2026-04-10_1830_replay_review_findings.md) |
| RCA Complete | 2026-04-10 18:30 UTC | 8 | [RCA](../RCAs/2026-04-10_1830_replay_review_defects.md) |
| Implementing | 2026-04-10 19:00 UTC | 8 | [Commit 8278413](../../) |
| Reviewed | 2026-04-10 19:00 UTC | 8 | [Review](../reviews/2026-04-10_1900_diff.md) -- LGTM |
| Resolved | 2026-04-10 19:00 UTC | 8 | Verified in code: single atomic setState |
| Verified | 2026-04-10 21:00 UTC | 9 | [Investigation](../investigations/2026-04-10_2100_replay_review_defects_f2_f3_f4.md) |

---

## F5: Moon Renders at Real-Time Ephemeris Position Instead of Sim Time (High Defect)

**Summary**: In LIVE mode, `getMoonPosition(simTimeRef.current)` places the Moon at its current ephemeris position (T+214.5h), which is 32 su from the trajectory turnaround where the flyby occurred (T+120.45h). The user sees the Moon sphere far from the trajectory curve, and the trajectory curves around empty space -- appearing as "2 moons."

**Root cause**: F1 migration moved Moon position from static `getMoonFlybyPosition()` in Moon.tsx to dynamic `getMoonPosition(simTimeRef.current)` in DataDriver. In LIVE mode at T+214h, the Moon has orbited ~52 degrees since the flyby, placing it 318,472 km (31.85 su) from the trajectory turnaround. Physically correct but visually incoherent -- the trajectory is static and still curves around the flyby position.

**Resolution tasks**:

- [x] **F5.1**: Investigate -- confirm position values and rendering behavior (-> /investigate)
- [ ] **F5.2**: RCA + fix design (-> /rca-bugfix)
- [ ] **F5.3**: Implementation plan (-> /plan)
- [ ] **F5.4**: Implement fix (-> /wrought-rca-fix)
- [ ] **F5.5**: Code review (-> /forge-review)
- [ ] **F5.6**: Verify fix in production

**Recommended approach**: `/rca-bugfix` -- In LIVE mode, use the flyby epoch (2026-04-06T23:06Z) for Moon position so it aligns with the trajectory turnaround. In REPLAY/SIM mode, continue using simTimeRef.current for dynamic Moon animation. Single change in DataDriver.tsx:73.

**Status**: In Progress
**Stage**: Investigating
**Resolved in session**: --
**Verified in session**: --
**Notes**: The Moon IS rendering (moonDist telemetry shows 345,458 km) but ~32 su from the trajectory turnaround due to real Moon orbital motion since flyby. The incident at `docs/incidents/2026-04-10_2017_moon_missing_from_visualization.md` and hotfix `f5aea67` addressed the double SCALE_FACTOR bug but not this position divergence. Investigation confirmed: in LIVE mode use flyby epoch for Moon position; in REPLAY/SIM use simTimeRef for dynamic animation.
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-10 20:51 UTC | 9 | [Finding Report](2026-04-10_2051_moon_position_drift.md) |
| Investigating | 2026-04-10 23:00 UTC | 10 | [Investigation](../investigations/2026-04-10_2300_two_moons_ephemeris_vs_trajectory.md) |

---

## Changelog

| Date | Session | Action |
|------|---------|--------|
| 2026-04-10 17:38 UTC | 8 | Created tracker. F1 logged (High Gap). Research at `docs/research/2026-04-10_1400_replayable_mission_visualization.md`. |
| 2026-04-10 18:30 UTC | 8 | F1 stage -> Reviewed (forge-review BLOCKED on C1). F2-F4 added from review `docs/reviews/2026-04-10_1830_diff.md`. F2 Critical Defect (circular import), F3 Medium Defect (milestone skipping), F4 Medium Defect (clock drift). |
| 2026-04-10 21:00 UTC | 9 | F1 stage -> Verified (second review LGTM, blocker F2 resolved). F2/F3/F4 stages -> Verified (code confirmed fixed, build passes). Investigation: `docs/investigations/2026-04-10_2100_replay_review_defects_f2_f3_f4.md`. Tracker detail sections updated (were stale -- same pattern as Session 6). |
| 2026-04-10 20:51 UTC | 9 | F5 logged (High Defect). Moon position drift from F1 migration -- user screenshot confirms Moon invisible at trajectory turnaround. |
| 2026-04-10 23:00 UTC | 10 | F5 stage -> Investigating. Investigation confirmed: Moon at T+214h ephemeris position is 32 su from trajectory turnaround (flyby at T+120h). Fix: use flyby epoch for Moon in LIVE mode, simTimeRef in REPLAY/SIM. Report: `docs/investigations/2026-04-10_2300_two_moons_ephemeris_vs_trajectory.md` |

---

## Cross-References

| Document | Description |
|----------|-------------|
| `docs/findings/2026-04-10_1738_replayable_mission_visualization.md` | F1 finding report |
| `docs/research/2026-04-10_1400_replayable_mission_visualization.md` | Research: virtual clock architecture, Date.now() audit, community implementations |
| `PRD.md` | Line 227: "After splashdown, the tool becomes an archive/replay" |
| `docs/findings/2026-04-10_1830_replay_review_findings.md` | F2/F3/F4 finding report (batch from forge-review) |
| `docs/reviews/2026-04-10_1830_diff.md` | Forge-review: 1C, 2W, 9S across 13 files |
