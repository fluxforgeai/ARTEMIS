**2026-04-03 19:58 UTC**

# Camera & UX Refinement -- Findings Tracker

**Created**: 2026-04-03 19:58 UTC
**Last Updated**: 2026-04-03 20:44 UTC
**Origin**: Session 2 review of camera presets identified in Session 1 handoff as needing refinement
**Session**: 2
**Scope**: Camera preset positions, viewing angles, and visual presentation for the Artemis II mission tracker

---

## Overview

Tracking camera preset and UX refinements for the ARTEMIS interactive mission visualization.

| # | Finding | Type | Severity | Status | Stage | Report |
|---|---------|------|----------|--------|-------|--------|
| F1 | Camera presets need refinement for optimal viewing angles | Gap | **Medium** | Resolved | Resolved | [Report](2026-04-03_1958_camera_preset_refinement.md) |
| F2 | Three camera bugs: debug overlay broken, vertical orientation, blocked clicks | Defect | **Medium** | Resolved | Resolved | [Report](2026-04-03_2021_camera_visual_bugs.md) |

**Status legend**: `Open` -> `In Progress` -> `Resolved` -> `Verified`
**Stage legend**: `Open` -> `Investigating` / `Designing` -> `RCA Complete` / `Blueprint Ready` -> `Planned` -> `Implementing` -> `Reviewed` -> `Resolved` -> `Verified`

---

## Dependency Map

```
No dependencies mapped yet. Update as relationships between findings are identified.
```

---

## F1: Camera Presets Need Refinement (Medium Gap)

**Summary**: The four camera presets in `CameraController.tsx` use fixed offsets that don't adapt to trajectory geometry. Follow Orion doesn't rotate with velocity, Earth View is identical to the default plan view, and Moon View uses a hardcoded offset that may not show the flyby loop well.

**Root cause**: Presets were implemented with minimal hardcoded offsets during the Session 1 MVP build. Refinement requires visual iteration with the live 3D scene.

**Resolution tasks**:

- [x] **F1.1**: Design approach — define improved preset positions and behaviors (-> /design -> Stage: Designing)
- [x] **F1.2**: Blueprint + implementation prompt (-> /blueprint -> Stage: Blueprint Ready)
- [x] **F1.3**: Implementation plan (-> /plan -> Stage: Planned)
- [x] **F1.4**: Implement changes (Stage: Implementing -> Resolved)
- [ ] **F1.5**: Code review (-> /forge-review -> Stage: Reviewed)
- [ ] **F1.6**: Verify implementation (Stage: Verified)

**Recommended approach**: `/design tradeoff` — compare camera behavior strategies (fixed offset vs velocity-aligned vs orbit-relative)

**Status**: Resolved
**Stage**: Resolved
**Resolved in session**: 2
**Verified in session**: --
**Notes**: Session 1 handoff noted "Camera presets still being refined." D-key debug overlay available for position tuning.
**GitHub Issue**: fluxforgeai/ARTEMIS#3
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-03 19:58 UTC | 2 | [Finding Report](2026-04-03_1958_camera_preset_refinement.md) |
| Designing | 2026-04-03 20:02 UTC | 2 | [Design Analysis](../design/2026-04-03_2002_camera_preset_strategies.md) — Scene-Aware Smart Presets recommended |
| Blueprint Ready | 2026-04-03 20:04 UTC | 2 | [Blueprint](../blueprints/2026-04-03_2004_camera_preset_strategies.md) |
| Planned | 2026-04-03 20:06 UTC | 2 | Plan approved |
| Resolved | 2026-04-03 20:08 UTC | 2 | /wrought-implement completed in 1 iteration. Build passes, 15/15 tests pass. |

---

## F2: Three Camera Visual Bugs (Medium Defect)

**Summary**: Visual verification found: (1) debug overlay shows `CAM POS: (0,0,0)` — `getWorldDirection` receives a plain object instead of `THREE.Vector3`, (2) trajectory appears vertical instead of horizontal on landscape screens — camera `up` vector not aligned, (3) preset buttons unresponsive when debug overlay active — `<Html fullscreen>` intercepts clicks.

**Root cause**: Bug 1: wrong argument type in `CameraDebug.tsx:26`. Bug 2: `computePlanView` doesn't adjust camera orientation for landscape. Bug 3: `<Html fullscreen>` component creates a click-blocking overlay.

**Resolution tasks**:

- [x] **F2.1**: RCA + fix design — root causes are already clear from code inspection (-> /rca-bugfix -> Stage: RCA Complete)
- [x] **F2.2**: Implementation plan (-> /plan -> Stage: Planned)
- [x] **F2.3**: Implement fix (Stage: Implementing -> Resolved)
- [x] **F2.4**: Code review (-> /forge-review -> Stage: Reviewed)
- [ ] **F2.5**: Verify fix on deployment (Stage: Verified)

**Recommended approach**: `/rca-bugfix` — root causes are already identified from code inspection.

**Status**: Resolved
**Stage**: Resolved
**Resolved in session**: 2
**Verified in session**: --
**Notes**: All three bugs are in CameraDebug.tsx and CameraController.tsx. Root causes confirmed.
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-03 20:21 UTC | 2 | [Finding Report](2026-04-03_2021_camera_visual_bugs.md) |
| RCA Complete | 2026-04-03 20:24 UTC | 2 | [RCA](../RCAs/2026-04-03_2024_camera_visual_bugs.md) — 3 root causes confirmed, fixes defined |
| Resolved | 2026-04-03 20:43 UTC | 2 | /wrought-rca-fix iteration 2: rewrote CameraDebug with direct DOM, all presets use full-trajectory bounding box distance. Build passes, 15/15 tests pass. |
| Reviewed | 2026-04-03 20:44 UTC | 2 | [Review](../reviews/2026-04-03_2044_diff.md) — 0 criticals, 3 warnings, 5 suggestions |

---

## Changelog

| Date | Session | Action |
|------|---------|--------|
| 2026-04-03 19:58 UTC | 2 | Created tracker. F1 logged (Medium Gap). |
| 2026-04-03 20:02 UTC | 2 | F1 stage -> Designing. Scene-Aware Smart Presets recommended (velocity-aligned chase cam, Earth-centric view, flyby-optimized Moon view). Design: docs/design/2026-04-03_2002_camera_preset_strategies.md |
| 2026-04-03 20:04 UTC | 2 | F1 stage -> Blueprint Ready. Blueprint: docs/blueprints/2026-04-03_2004_camera_preset_strategies.md. Prompt: docs/prompts/2026-04-03_2004_camera_preset_strategies.md |
| 2026-04-03 20:08 UTC | 2 | F1 stage -> Resolved. /wrought-implement completed in 1 iteration. Velocity-aligned chase cam, Earth-centric tracking, orbital-normal Moon view. Build passes, 15/15 tests pass. |
| 2026-04-03 20:21 UTC | 2 | F2 logged from visual verification. 3 bugs: debug overlay broken, vertical orientation, blocked clicks (Medium Defect). |
| 2026-04-03 20:24 UTC | 2 | F2 stage -> RCA Complete. 3 root causes confirmed. |
| 2026-04-03 20:43 UTC | 2 | F2 stage -> Resolved. /wrought-rca-fix iteration 2. CameraDebug rewritten with direct DOM. All presets use full-trajectory bounding box. |
| 2026-04-03 20:44 UTC | 2 | F2 -> Reviewed. /forge-review: 0 criticals, 3 warnings, 5 suggestions. |

---

## Cross-References

| Document | Description |
|----------|-------------|
| docs/findings/2026-04-03_1958_camera_preset_refinement.md | F1 finding report |
| src/components/CameraController.tsx | Camera preset logic |
| src/hud/CameraControls.tsx | Preset button UI |
| src/components/CameraDebug.tsx | D-key debug overlay |
| docs/findings/2026-04-03_2021_camera_visual_bugs.md | F2 finding report |
| docs/RCAs/2026-04-03_2024_camera_visual_bugs.md | F2 RCA |
| docs/reviews/2026-04-03_2044_diff.md | F2 code review (0C/3W/5S) |
