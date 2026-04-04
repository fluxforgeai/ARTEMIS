**2026-04-04 22:00 UTC**

# UI & Visual Regressions (Session 5) -- Findings Tracker

**Created**: 2026-04-04 22:00 UTC
**Last Updated**: 2026-04-05 02:00 UTC
**Origin**: User screenshot review at session 5 start -- 4 screenshots revealing layout, z-index, trajectory, and mobile overflow issues
**Session**: 5
**Scope**: HUD layout regressions (ProgressBar overlap/height), trajectory rendering near Moon, and mobile MissionEventsPanel overflow (4 component files, 4 issues)

---

## Overview

Four UI and visual issues identified from user-provided screenshots at the start of Session 5. Two are recurring problems (ProgressBar/ChatPanel overlap, trajectory near Moon) that were partially addressed in Session 4 but have regressed or were incompletely fixed. Two are new issues surfaced by the expanded milestone count (19 milestones) and desktop layout interactions.

| # | Finding | Type | Severity | Status | Stage | Report |
|---|---------|------|----------|--------|-------|--------|
| F1 | ProgressBar overlays AI Chatbot panel | Defect | **High** | Resolved | Resolved | [Report](2026-04-04_2200_ui_visual_regressions_session5.md) |
| F3 | Trajectory around Moon renders problematic / direction questioned | Defect | **High** | In Progress | RCA Complete | [Report](2026-04-04_2200_ui_visual_regressions_session5.md) |
| F2 | ProgressBar sits higher than adjacent telemetry cards | Defect | **Medium** | Resolved | Resolved | [Report](2026-04-04_2200_ui_visual_regressions_session5.md) |
| F4 | Mobile hamburger menu obscures most of screen | Debt | **Medium** | Open | Open | [Report](2026-04-04_2200_ui_visual_regressions_session5.md) |

**Status legend**: `Open` -> `In Progress` -> `Resolved` -> `Verified`
**Stage legend**: `Open` -> `Investigating` / `Designing` -> `RCA Complete` / `Blueprint Ready` -> `Planned` -> `Implementing` -> `Reviewed` -> `Resolved` -> `Verified`

---

## Dependency Map

```
F1 (ProgressBar overlays chat) -- affects desktop layout, z-index interaction
F2 (ProgressBar height mismatch) -- related to F1 (both involve ProgressBar sizing/layout)
F3 (Trajectory near Moon) -- independent, 3D scene rendering
F4 (Mobile menu too large) -- independent, mobile-only UX issue
```

F1 and F2 should be addressed together (both are ProgressBar layout issues in HUD.tsx bottom row).
F3 and F4 are independent of each other and of F1/F2.

---

## F1: ProgressBar Overlays AI Chatbot Panel (High Defect)

**Summary**: The ProgressBar component with `sm:flex-1` stretches across the full bottom HUD bar width, physically overlapping the ChatPanel positioned at `fixed bottom-20 sm:right-6 sm:w-[360px]`. Despite z-index hierarchy (HUD=10, Chat=45), the ProgressBar renders visually on top of the chat panel. This is a recurring issue -- previously tracked as F4/F9 in the mobile responsiveness tracker (Session 4) but regressed or incompletely resolved on desktop.

**Root cause**: ProgressBar's `sm:flex-1` allows it to expand under the chat panel's screen area. The HUD's `absolute inset-0` spans full viewport width. The `backdrop-blur-sm` on ProgressBar may create stacking context interference. The Session 4 fix addressed mobile layout but did not constrain desktop ProgressBar width to avoid the chat panel zone.

**Resolution tasks**:

- [x] **F1.1**: Investigate -- confirm root cause of z-index override and scope of overlap (-> /investigate -> Stage: Investigating)
- [x] **F1.2**: RCA + fix design -- constrain ProgressBar width or adjust z-index stacking (-> /rca-bugfix -> Stage: RCA Complete)
- [x] **F1.3**: Implement fix (Stage: Implementing -> Resolved)
- [x] **F1.4**: Code review (-> /forge-review -> Stage: Reviewed) — LGTM, 0C/0W/0S

**Recommended next step**: Visual verification on desktop with chat open

**Status**: Resolved
**Stage**: Resolved
**Resolved in session**: --
**Verified in session**: --
**Notes**: Recurring regression (3rd occurrence). RCA identified 3 factors: unconstrained flex growth, stacking context interference from backdrop-blur, no spatial boundary. Fix: `isolate` on HUD container, `sm:pr-16` on bottom row (container-level to prevent regression), `sm:items-end` alignment, padding normalization. Key files: `src/hud/HUD.tsx`, `src/hud/ProgressBar.tsx`.
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-04 22:00 UTC | 5 | [Finding Report](2026-04-04_2200_ui_visual_regressions_session5.md) |
| Investigating | 2026-04-04 22:15 UTC | 5 | [Investigation](../../investigations/2026-04-04_2215_progressbar_overlay_and_height_mismatch.md) |
| RCA Complete | 2026-04-04 20:45 UTC | 5 | [RCA](../../RCAs/2026-04-04_2045_progressbar_overlay_and_height.md), [Prompt](../../prompts/2026-04-04_2045_progressbar_overlay_and_height.md) |
| Implementing | 2026-04-04 20:48 UTC | 5 | 4 CSS class changes across HUD.tsx + ProgressBar.tsx |
| Reviewed | 2026-04-04 20:52 UTC | 5 | [Review report](../../reviews/2026-04-04_2052_diff.md) — LGTM 0C/0W/0S |
| Resolved | 2026-04-04 20:52 UTC | 5 | Clean review, awaiting visual verification |

---

## F3: Trajectory Around Moon Renders Problematic / Direction Questioned (High Defect)

**Summary**: The trajectory line near the Moon appears visually broken or incorrectly rendered. Additionally, the trajectory appears to loop counter-clockwise around the Moon, which the user questions. The `splitAroundBodies()` culling with `MOON_VISUAL_RADIUS = 0.7` may be over-culling or the computed Moon position (derived from max-distance OEM point minus 10,637 km offset) may be slightly off, creating trajectory gaps. Trajectory culling near the Moon was previously fixed in Session 4 (commit 26ef3a1).

**Root cause**: The circumcenter algorithm (`circumcenter3D()`) computes the center of the osculating circle of the trajectory arc, which is geometrically NOT the Moon's gravitational center. The circumcenter is 5,034 km from the real Moon position (verified via JPL Horizons ephemeris API) and only 3,002 km from the trajectory. With the CORRECT Moon position from JPL Horizons, the trajectory clears the Moon by 8,357 km (0.84 su), allowing even a 0.637 su Moon sphere with zero trajectory clipping. **The fix is to replace the circumcenter algorithm with real JPL Horizons lunar ephemeris data.** This is the 7th investigation -- the definitive one.

**Resolution tasks**:

- [x] **F3.1**: Investigate -- confirm Moon position accuracy relative to trajectory, verify culling radius, check trajectory direction against Artemis II mission profile (-> /investigate -> Stage: Investigating)
- [x] **F3.2**: RCA + fix design -- circumcenter algorithm, reduce culling radius, unify Moon position source (-> /rca-bugfix -> Stage: RCA Complete)
- [x] **F3.2b**: Re-investigate -- race condition between useOEM.ts and Moon.tsx overwriting moonPosition (-> /investigate -> Stage: Investigating)
- [x] **F3.3**: RCA + fix -- remove useOEM.ts moonPosition writes, make Moon.tsx sole source (-> /rca-bugfix -> Stage: RCA Complete)
- [x] **F3.3b**: Implement race condition fix -- useOEM.ts no longer writes moonPosition (Stage: Resolved)
- [x] **F3.4**: Re-investigate -- Moon renders at 2.44 su from Earth (right next to it). Circumcenter algorithm picks wrong trajectory region (-> /investigate -> Stage: Investigating)
- [x] **F3.5**: Implement fix -- restrict curvature search to lunar flyby region, add distance validation guard (commit `64d94ee`, Stage: Resolved)
- [x] **F3.6**: Re-investigate (6th time) -- Moon position NOW CORRECT at 40.98 su from Earth, but Moon visual sphere (0.5 su) too large for trajectory clearance (0.30 su). 168 points culled. (-> /investigate -> Stage: Investigating)
- [x] **F3.7**: Re-investigate (7th, DEFINITIVE) -- Circumcenter != Moon center. JPL Horizons ephemeris shows real Moon is 5,034 km from circumcenter. With real position, trajectory clears Moon by 8,357 km. Fix: replace circumcenter with bundled JPL ephemeris. (-> /investigate -> Stage: Investigating)
- [ ] **F3.8**: RCA + fix -- replace circumcenter with JPL Horizons ephemeris, set Moon sphere to 0.347 su (2x proportional with Earth), time-varying Moon position (-> /rca-bugfix -> Stage: RCA Complete)
- [ ] **F3.9**: Implement fix (Stage: Implementing -> Resolved)
- [ ] **F3.10**: Code review (-> /forge-review -> Stage: Reviewed)
- [ ] **F3.11**: Verify: no trajectory gaps, Moon centered in flyby curve, proportional scaling (Stage: Verified)

**Recommended next step**: `/rca-bugfix` with investigation at `docs/investigations/2026-04-05_0700_true_scale_moon_trajectory_clearance.md`

**Status**: In Progress
**Stage**: Investigating
**Resolved in session**: --
**Verified in session**: --
**Notes**: 7th investigation (DEFINITIVE). The circumcenter algorithm gives the center of the osculating circle, NOT the Moon's gravitational center. JPL Horizons ephemeris confirms the real Moon is 5,034 km from the circumcenter and 8,357 km from the trajectory at perilune. Fix: bundle JPL Horizons lunar ephemeris (37 data points, ~2 KB), interpolate Moon position at simulation time, set Moon sphere to 0.347 su (2x real, proportional with Earth). Key files: `src/components/Moon.tsx` (replace circumcenter with ephemeris lookup), `src/components/Trajectory.tsx` (culling with correct Moon pos), NEW `src/data/moon-ephemeris.ts` (bundled ephemeris + interpolation).
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-04 22:00 UTC | 5 | [Finding Report](2026-04-04_2200_ui_visual_regressions_session5.md) |
| Investigating | 2026-04-04 23:30 UTC | 5 | [Investigation](../../investigations/2026-04-04_2330_trajectory_near_moon_rendering.md) |
| RCA Complete | 2026-04-04 21:30 UTC | 5 | [RCA](../../RCAs/2026-04-04_2130_trajectory_near_moon.md), [Prompt](../../prompts/2026-04-04_2130_trajectory_near_moon.md) |
| Investigating | 2026-04-05 01:00 UTC | 5 | [Investigation](../../investigations/2026-04-05_0100_trajectory_through_moon_race_condition.md) |
| Implementing | 2026-04-05 01:30 UTC | 5 | Race condition fix applied (useOEM.ts Moon writes removed) |
| Investigating | 2026-04-05 02:00 UTC | 5 | [Investigation](../../investigations/2026-04-05_0200_moon_position_circumcenter_wrong_region.md) -- circumcenter selects parking orbit, not lunar flyby |
| Implementing | 2026-04-05 02:15 UTC | 5 | Commit `64d94ee` -- apoapsis-based search + validation guard. Moon position NOW CORRECT. |
| Investigating | 2026-04-05 04:30 UTC | 5 | [Investigation](../../investigations/2026-04-05_0430_moon_sphere_too_large_trajectory_clipping.md) -- Moon visual sphere oversized; trajectory passes through it |
| Investigating | 2026-04-05 07:00 UTC | 5 | [Investigation](../../investigations/2026-04-05_0700_true_scale_moon_trajectory_clearance.md) -- DEFINITIVE: circumcenter != Moon center. JPL Horizons confirms 8,357 km clearance with real Moon position. |

---

## F2: ProgressBar Sits Higher Than Adjacent Telemetry Cards (Medium Defect)

**Summary**: The ProgressBar renders at a different vertical height than the Speed and Earth Distance telemetry cards in the bottom HUD row. ProgressBar uses `py-3` on all viewports while TelemetryCard uses `py-2` (mobile) / `py-3` (desktop), plus ProgressBar has extra internal content (milestone countdown line, marker tooltips) that makes it intrinsically taller. The parent `sm:items-center` centers children vertically, causing the taller ProgressBar to extend above the top edge of sibling cards.

**Root cause**: Inconsistent padding between ProgressBar (`py-3` always) and TelemetryCard (`py-2` mobile / `py-3` desktop), compounded by ProgressBar's additional internal content (countdown text row) making it taller than telemetry cards.

**Resolution tasks**:

- [x] **F2.1**: Investigate -- confirm root cause is padding + extra content height (-> /investigate -> Stage: Investigating)
- [x] **F2.2**: RCA + fix design -- match padding and/or use items-stretch/items-end (-> /rca-bugfix -> Stage: RCA Complete)
- [x] **F2.3**: Implement fix (Stage: Implementing -> Resolved)
- [x] **F2.4**: Code review (-> /forge-review -> Stage: Reviewed) — LGTM, 0C/0W/0S

**Recommended next step**: Visual verification of bottom row alignment on desktop

**Status**: Resolved
**Stage**: Resolved
**Resolved in session**: --
**Verified in session**: --
**Notes**: Fix combined with F1 in single RCA/prompt. Change `py-3` to `py-2 sm:py-3` on ProgressBar, change `sm:items-center` to `sm:items-end` on bottom row. Key files: `src/hud/ProgressBar.tsx`, `src/hud/HUD.tsx`.
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-04 22:00 UTC | 5 | [Finding Report](2026-04-04_2200_ui_visual_regressions_session5.md) |
| Investigating | 2026-04-04 22:15 UTC | 5 | [Investigation](../../investigations/2026-04-04_2215_progressbar_overlay_and_height_mismatch.md) |
| RCA Complete | 2026-04-04 20:45 UTC | 5 | [RCA](../../RCAs/2026-04-04_2045_progressbar_overlay_and_height.md), [Prompt](../../prompts/2026-04-04_2045_progressbar_overlay_and_height.md) |
| Implementing | 2026-04-04 20:48 UTC | 5 | Combined with F1 — same implementation |
| Reviewed | 2026-04-04 20:52 UTC | 5 | [Review report](../../reviews/2026-04-04_2052_diff.md) — LGTM 0C/0W/0S |
| Resolved | 2026-04-04 20:52 UTC | 5 | Clean review, awaiting visual verification |

---

## F4: Mobile Hamburger Menu Obscures Most of Screen (Medium Debt)

**Summary**: The MissionEventsPanel dropdown on mobile uses `w-[calc(100vw-1.5rem)]` width and `max-h-[70vh]` height. With 19 milestones (expanded from original 9 in Session 4) generating ~684px of timeline content, the panel fills most of the mobile viewport. The click-outside overlay at `z-[var(--z-backdrop)]` (30) blocks all interaction with the 3D scene beneath.

**Root cause**: The `max-h-[70vh]` was designed for fewer milestones. Doubling the milestone count from 9 to 19 pushed content to fill the max-height on typical mobile viewports (667-812px), leaving minimal visible 3D scene.

**Resolution tasks**:

- [ ] **F4.1**: Design approach -- evaluate reduced max-h on mobile, compact milestone view, or grouped/collapsible timeline sections (-> /design -> Stage: Designing)
- [ ] **F4.2**: Blueprint + implementation prompt (-> /blueprint -> Stage: Blueprint Ready)
- [ ] **F4.3**: Implement changes (Stage: Implementing -> Resolved)
- [ ] **F4.4**: Code review (-> /forge-review -> Stage: Reviewed)
- [ ] **F4.5**: Verify mobile menu size on real device viewports (Stage: Verified)

**Recommended approach**: `/design` -- multiple viable approaches (smaller max-h, compact mode, collapsible groups)

**Status**: Open
**Stage**: Open
**Resolved in session**: --
**Verified in session**: --
**Notes**: The desktop panel (`sm:w-[320px]`) is not affected. Only mobile layout needs adjustment. Key files: `src/hud/MissionEventsPanel.tsx`, `src/data/mission-config.ts` (19 milestones).
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-04 22:00 UTC | 5 | [Finding Report](2026-04-04_2200_ui_visual_regressions_session5.md) |

---

## Changelog

| Date | Session | Action |
|------|---------|--------|
| 2026-04-05 07:00 UTC | 5 | F3 investigated DEFINITIVELY (7th time). All 6 prior investigations addressed wrong root cause. The circumcenter algorithm computes the osculating circle center, NOT the Moon's gravitational center -- 5,034 km apart. JPL Horizons ephemeris confirms real Moon position gives 8,357 km trajectory clearance (vs 3,002 km with circumcenter). Fix: replace circumcenter with bundled JPL ephemeris (37 points, ~2 KB), set Moon to 0.347 su (2x proportional). Investigation: `docs/investigations/2026-04-05_0700_true_scale_moon_trajectory_clearance.md`. |
| 2026-04-05 04:30 UTC | 5 | F3 investigated AGAIN (6th time). Moon position now CORRECT (40.98 su from Earth) since commit `64d94ee`. Actual problem: Moon visual sphere (0.5 su = 5,000 km) is oversized relative to trajectory clearance (0.30 su = 3,000 km). 168 trajectory points culled, creating visible gap. Fix: reduce Moon sphere to 0.25 su, reduce culling to 0.30 su. Investigation: `docs/investigations/2026-04-05_0430_moon_sphere_too_large_trajectory_clipping.md`. |
| 2026-04-05 02:00 UTC | 5 | F3 investigated AGAIN (5th manifestation). Root cause: `findMaxCurvatureIndex()` selects parking orbit near Earth (curvature 0.0175) instead of lunar flyby (curvature 0.0009). Moon renders at 2.44 su from Earth instead of ~38.44 su. Prior race condition fix was correctly applied but circumcenter input is wrong. Investigation: `docs/investigations/2026-04-05_0200_moon_position_circumcenter_wrong_region.md`. |
| 2026-04-05 01:00 UTC | 5 | F3 re-investigated. Race condition found: useOEM.ts overwrites Moon.tsx's correct circumcenter position in store. Moon sphere renders at circumcenter but Trajectory.tsx culls at overwritten position -- trajectory passes through Moon. Prior RCA Fix 3 (unify source) was not implemented. Investigation: `docs/investigations/2026-04-05_0100_trajectory_through_moon_race_condition.md`. |
| 2026-04-04 23:30 UTC | 5 | F3 stage -> Investigating. Root cause confirmed: Moon.tsx flybyPos algorithm geometrically flawed (offsets along wrong axis), causing 206 trajectory points culled (~13 hrs). Correct Moon center is ~11,000 km from computed position. Trajectory direction confirmed correct (counter-clockwise). Investigation: `docs/investigations/2026-04-04_2330_trajectory_near_moon_rendering.md`. |
| 2026-04-04 20:52 UTC | 5 | F1 + F2 -> Resolved. Forge-review LGTM (0C/0W/0S). Review: `docs/reviews/2026-04-04_2052_diff.md`. |
| 2026-04-04 20:48 UTC | 5 | F1 + F2 implemented. 4 CSS class changes across 2 files. Build passes. `/wrought-implement` loop completed in 1 iteration. |
| 2026-04-04 20:45 UTC | 5 | F1 + F2 stage -> RCA Complete. RCA: 3 factors for F1 (unconstrained flex, stacking context, no spatial boundary). Fix: `isolate` on HUD, `sm:pr-16` on bottom row, `sm:items-end`, ProgressBar `py-2 sm:py-3`. RCA: `docs/RCAs/2026-04-04_2045_progressbar_overlay_and_height.md`. Prompt: `docs/prompts/2026-04-04_2045_progressbar_overlay_and_height.md`. |
| 2026-04-04 22:15 UTC | 5 | F1 + F2 stage -> Investigating. Investigation confirmed F1 root cause (3 factors: flex-1 unconstrained growth, backdrop-blur stacking context, no spatial boundary). F2 root cause confirmed (padding mismatch + extra content row + items-center). Investigation: `docs/investigations/2026-04-04_2215_progressbar_overlay_and_height_mismatch.md`. |
| 2026-04-04 22:00 UTC | 5 | Created tracker. F1-F4 logged from user screenshot review. F1: High Defect (ProgressBar/chat overlap). F2: Medium Defect (ProgressBar height mismatch). F3: High Defect (trajectory near Moon). F4: Medium Debt (mobile menu overflow). |

---

## Cross-References

| Document | Description |
|----------|-------------|
| [2026-04-04_2200_ui_visual_regressions_session5.md](2026-04-04_2200_ui_visual_regressions_session5.md) | F1-F4 finding report (this tracker's source) |
| [2026-04-04_1855_frontend_display_mobile_responsiveness_FINDINGS_TRACKER.md](2026-04-04_1855_frontend_display_mobile_responsiveness_FINDINGS_TRACKER.md) | Session 4 mobile responsiveness tracker (F4/F9 related to F1 overlap/z-index) |
| [2026-04-03_2024_camera_visual_bugs RCA](../RCAs/2026-04-03_2024_camera_visual_bugs.md) | Prior trajectory rendering RCA |
| `src/hud/ProgressBar.tsx` | F1, F2 -- progress bar layout and sizing |
| `src/hud/HUD.tsx` | F1, F2 -- bottom telemetry row flex layout |
| `src/chat/ChatPanel.tsx` | F1 -- chat panel positioning and z-index |
| `src/hud/TelemetryCard.tsx` | F2 -- telemetry card padding comparison |
| `src/components/Trajectory.tsx` | F3 -- trajectory culling near Moon |
| `src/components/Moon.tsx` | F3 -- Moon position calculation |
| `src/hud/MissionEventsPanel.tsx` | F4 -- hamburger menu sizing |
| `src/index.css` | F1 -- z-index hierarchy definition |
