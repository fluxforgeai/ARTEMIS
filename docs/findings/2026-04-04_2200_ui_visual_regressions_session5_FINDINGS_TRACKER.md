**2026-04-04 22:00 UTC**

# UI & Visual Regressions (Session 5) -- Findings Tracker

**Created**: 2026-04-04 22:00 UTC
**Last Updated**: 2026-04-04 20:45 UTC
**Origin**: User screenshot review at session 5 start -- 4 screenshots revealing layout, z-index, trajectory, and mobile overflow issues
**Session**: 5
**Scope**: HUD layout regressions (ProgressBar overlap/height), trajectory rendering near Moon, and mobile MissionEventsPanel overflow (4 component files, 4 issues)

---

## Overview

Four UI and visual issues identified from user-provided screenshots at the start of Session 5. Two are recurring problems (ProgressBar/ChatPanel overlap, trajectory near Moon) that were partially addressed in Session 4 but have regressed or were incompletely fixed. Two are new issues surfaced by the expanded milestone count (19 milestones) and desktop layout interactions.

| # | Finding | Type | Severity | Status | Stage | Report |
|---|---------|------|----------|--------|-------|--------|
| F1 | ProgressBar overlays AI Chatbot panel | Defect | **High** | Resolved | Resolved | [Report](2026-04-04_2200_ui_visual_regressions_session5.md) |
| F3 | Trajectory around Moon renders problematic / direction questioned | Defect | **High** | Open | Open | [Report](2026-04-04_2200_ui_visual_regressions_session5.md) |
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

**Root cause**: The Moon position calculation uses an approximation (max-distance OEM point offset by 10,637 km). If this places the Moon center slightly off from the true trajectory geometry, the 0.7-unit culling radius clips visible trajectory segments or leaves rendering artifacts. The trajectory direction is determined by the OEM data (NASA planning data in EME2000 frame) and may appear counter-clockwise from certain camera angles.

**Resolution tasks**:

- [ ] **F3.1**: Investigate -- confirm Moon position accuracy relative to trajectory, verify culling radius, check trajectory direction against Artemis II mission profile (-> /investigate -> Stage: Investigating)
- [ ] **F3.2**: RCA + fix design -- adjust Moon position calculation and/or culling approach (-> /rca-bugfix -> Stage: RCA Complete)
- [ ] **F3.3**: Implement fix (Stage: Implementing -> Resolved)
- [ ] **F3.4**: Code review (-> /forge-review -> Stage: Reviewed)
- [ ] **F3.5**: Verify trajectory renders cleanly near Moon from all camera presets (Stage: Verified)

**Recommended approach**: `/investigate` -- recurring issue, need to confirm whether the problem is Moon position, culling radius, or both

**Status**: Open
**Stage**: Open
**Resolved in session**: --
**Verified in session**: --
**Notes**: Recurring regression. Session 4 fixed trajectory culling (commit 26ef3a1) but the fix may be insufficient. Key files: `src/components/Trajectory.tsx`, `src/components/Moon.tsx`, `public/fallback-oem.asc`.
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-04 22:00 UTC | 5 | [Finding Report](2026-04-04_2200_ui_visual_regressions_session5.md) |

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
