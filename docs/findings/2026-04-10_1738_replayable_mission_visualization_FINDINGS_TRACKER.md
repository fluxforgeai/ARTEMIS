**2026-04-10 17:38 UTC**

# Replayable Mission Visualization -- Findings Tracker

**Created**: 2026-04-10 17:38 UTC
**Last Updated**: 2026-04-10 18:30 UTC
**Origin**: `/research` — replayable mission visualization architecture
**Session**: 8
**Scope**: Virtual clock abstraction, timeline scrubber, and playback controls to make the mission visualization replayable after splashdown

---

## Overview

Tracking the implementation of replay capability for the ARTEMIS mission visualization. The core issue is 12 `Date.now()` dependencies across 8 files that lock the visualization to real-time. The fix is a virtual clock abstraction in the Zustand store with LIVE/SIM/REPLAY modes and a timeline scrubber UI.

| # | Finding | Type | Severity | Status | Stage | Report |
|---|---------|------|----------|--------|-------|--------|
| F2 | Circular import — clearFiredMilestones() side effect in Zustand setter | Defect | **Critical** | Resolved | Resolved | [Report](2026-04-10_1830_replay_review_findings.md) |
| F1 | 12 Date.now() dependencies prevent mission replay after splashdown | Gap | **High** | Resolved | Resolved | [Report](2026-04-10_1738_replayable_mission_visualization.md) |
| F3 | 30s milestone check interval misses milestones at high replay rates | Defect | **Medium** | Resolved | Resolved | [Report](2026-04-10_1830_replay_review_findings.md) |
| F4 | Dual-write clock drift — ref vs store diverge up to 41 min at 10,000x | Defect | **Medium** | Resolved | Resolved | [Report](2026-04-10_1830_replay_review_findings.md) |

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
- [ ] **F1.5**: Code review (-> /forge-review -> Stage: Reviewed)
- [ ] **F1.6**: Verify implementation (Stage: Verified)

**Recommended approach**: `/design from-scratch F1 virtual-clock-and-replay` — design the virtual clock store slice, TimeControls UI, and migration strategy for all 8 affected files.

**Status**: In Progress
**Stage**: Reviewed
**Resolved in session**: —
**Verified in session**: —
**Notes**: Research complete at `docs/research/2026-04-10_1400_replayable_mission_visualization.md`. 8 files to modify, 2 new. Core functions already accept arbitrary timestamps — migration is surgical.
**GitHub Issue**: —
**Project Item ID**: —

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-10 17:38 UTC | 8 | [Finding Report](2026-04-10_1738_replayable_mission_visualization.md) |
| Designing | 2026-04-10 17:38 UTC | 8 | [Design](../design/2026-04-10_1738_virtual_clock_and_replay.md) |
| Blueprint Ready | 2026-04-10 17:38 UTC | 8 | [Blueprint](../blueprints/2026-04-10_1738_virtual_clock_and_replay.md) |
| Reviewed | 2026-04-10 18:30 UTC | 8 | [Review](../reviews/2026-04-10_1830_diff.md) — BLOCKED (C1 critical) |

---

## F2: Circular Import — clearFiredMilestones() in Zustand Setter (Critical Defect)

**Summary**: `mission-store.ts` imports `clearFiredMilestones` from `useAlerts.ts` and calls it inside the `setTimeMode` action, creating a circular dependency (store -> useAlerts -> store).

**Root cause**: Direct import was the simplest wiring during F1 implementation, but violates Zustand pure-action convention.

**Resolution tasks**:

- [ ] **F2.1**: Investigate — confirm scope and circular import behavior (-> /investigate)
- [ ] **F2.2**: RCA + fix design (-> /rca-bugfix)
- [ ] **F2.3**: Implementation plan (-> /plan)
- [ ] **F2.4**: Implement fix (-> /wrought-rca-fix)
- [ ] **F2.5**: Code review (-> /forge-review)
- [ ] **F2.6**: Verify fix

**Recommended approach**: `/rca-bugfix` — cause is clear from the review. Move side effect to a `subscribe` listener in `useAlerts.ts` or call from TimeControls component.

**Status**: Open
**Stage**: Open

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-10 18:30 UTC | 8 | [Finding Report](2026-04-10_1830_replay_review_findings.md) |

---

## F3: 30s Milestone Check Misses at High Replay Rates (Medium Defect)

**Summary**: `useAlerts.ts` runs milestone checks on a fixed 30s wall-clock interval. At 10,000x, 30s = 83h sim time. The T-30min alert window (180ms wall time) is almost never sampled.

**Root cause**: The 30s interval was designed for 1x real-time and was not adjusted for variable replay rates.

**Resolution tasks**:

- [ ] **F3.1**: Investigate — confirm milestone skip behavior at various rates (-> /investigate)
- [ ] **F3.2**: RCA + fix design (-> /rca-bugfix)
- [ ] **F3.3**: Implementation plan (-> /plan)
- [ ] **F3.4**: Implement fix (-> /wrought-rca-fix)
- [ ] **F3.5**: Code review (-> /forge-review)
- [ ] **F3.6**: Verify fix

**Recommended approach**: `/rca-bugfix` — drive milestone checks from DataDriver's 4Hz tick or scale interval with rate.

**Status**: Open
**Stage**: Open

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-10 18:30 UTC | 8 | [Finding Report](2026-04-10_1830_replay_review_findings.md) |

---

## F4: Dual-Write Clock Drift at 10,000x (Medium Defect)

**Summary**: DataDriver's `simTimeRef` (60Hz) leads `store.timeControl.simEpochMs` (4Hz sync) by up to 41 min sim-time at 10,000x. Spacecraft appears in the "future" trajectory segment.

**Root cause**: The dual-write pattern (ref for 60Hz interpolation, store at 4Hz for HUD) was designed for moderate rates. At extreme rates, the 4Hz sync lag becomes visible.

**Resolution tasks**:

- [ ] **F4.1**: Investigate — confirm visual drift at 1000x and 10000x (-> /investigate)
- [ ] **F4.2**: RCA + fix design (-> /rca-bugfix)
- [ ] **F4.3**: Implementation plan (-> /plan)
- [ ] **F4.4**: Implement fix (-> /wrought-rca-fix)
- [ ] **F4.5**: Code review (-> /forge-review)
- [ ] **F4.6**: Verify fix

**Recommended approach**: `/rca-bugfix` — batch `setSimTime` into the same `set()` call as `setSpacecraft`, or expose high-frequency time via shared ref for Trajectory.

**Status**: Open
**Stage**: Open

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-10 18:30 UTC | 8 | [Finding Report](2026-04-10_1830_replay_review_findings.md) |

---

## Changelog

| Date | Session | Action |
|------|---------|--------|
| 2026-04-10 17:38 UTC | 8 | Created tracker. F1 logged (High Gap). Research at `docs/research/2026-04-10_1400_replayable_mission_visualization.md`. |
| 2026-04-10 18:30 UTC | 8 | F1 stage -> Reviewed (forge-review BLOCKED on C1). F2-F4 added from review `docs/reviews/2026-04-10_1830_diff.md`. F2 Critical Defect (circular import), F3 Medium Defect (milestone skipping), F4 Medium Defect (clock drift). |

---

## Cross-References

| Document | Description |
|----------|-------------|
| `docs/findings/2026-04-10_1738_replayable_mission_visualization.md` | F1 finding report |
| `docs/research/2026-04-10_1400_replayable_mission_visualization.md` | Research: virtual clock architecture, Date.now() audit, community implementations |
| `PRD.md` | Line 227: "After splashdown, the tool becomes an archive/replay" |
| `docs/findings/2026-04-10_1830_replay_review_findings.md` | F2/F3/F4 finding report (batch from forge-review) |
| `docs/reviews/2026-04-10_1830_diff.md` | Forge-review: 1C, 2W, 9S across 13 files |
