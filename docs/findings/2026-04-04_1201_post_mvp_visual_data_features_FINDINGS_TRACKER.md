**2026-04-04 12:01 UTC**

# Post-MVP Visual & Data Features — Findings Tracker

**Created**: 2026-04-04 12:01 UTC
**Last Updated**: 2026-04-04 12:15 UTC
**Origin**: Post-MVP feature analysis — Priority 1 items from Session 3 handoff
**Session**: 4
**Scope**: Bloom/glow visual effects, crew timeline display, space weather alerts

---

## Overview

Three feature gaps identified for post-MVP enhancement of the ARTEMIS mission tracker. All are new capabilities building on existing infrastructure.

| # | Finding | Type | Severity | Status | Stage | Report |
|---|---------|------|----------|--------|-------|--------|
| F1 | Bloom/glow effects — postprocessing installed but unused | Gap | **Medium** | Resolved | Resolved | [Report](2026-04-04_1201_bloom_glow_visual_effects.md) |
| F2 | Crew timeline — data exists but has no UI | Gap | **Medium** | Resolved | Resolved | [Report](2026-04-04_1201_crew_timeline_display.md) |
| F3 | Space weather alerts — no alert system exists | Gap | **Medium** | Resolved | Resolved | [Report](2026-04-04_1201_space_weather_alerts.md) |

**Status legend**: `Open` → `In Progress` → `Resolved` → `Verified`
**Stage legend**: `Open` → `Designing` → `Blueprint Ready` → `Planned` → `Implementing` → `Reviewed` → `Resolved` → `Verified`

---

## Dependency Map

```
F1 (Bloom/Glow) ── independent, scene-level change
F2 (Crew Timeline) ── independent, HUD-level addition
F3 (Space Weather) ── independent, new data layer + HUD + optional 3D overlay
                       F3 alert system could also serve F2 milestone notifications
```

---

## F1: Bloom/Glow Visual Effects (Medium Gap)

**Summary**: `@react-three/postprocessing` v3.0.4 is installed but unused. Scene renders without EffectComposer — glow effects are faked with transparent overlay spheres.

**Root cause**: MVP prioritized functionality over visual polish; postprocessing dependency was added but never integrated.

**Resolution tasks**:

- [x] **F1.1**: Design approach — postprocessing pipeline architecture, bloom parameters, selective bloom strategy (→ /design → Stage: Designing)
- [x] **F1.2**: Blueprint + implementation prompt (→ /blueprint → Stage: Blueprint Ready)
- [x] **F1.3**: Implementation plan (→ /plan → Stage: Planned)
- [x] **F1.4**: Implement postprocessing pipeline (Stage: Implementing → Resolved)
- [ ] **F1.5**: Code review (→ /forge-review → Stage: Reviewed)
- [ ] **F1.6**: Verify visual effects on deployment (Stage: Verified)

**Recommended approach**: `/design from-scratch F1 bloom postprocessing pipeline`

**Status**: Resolved
**Stage**: Resolved
**Resolved in session**: —
**Verified in session**: —
**Notes**: Highest visual impact for least integration effort — single Scene.tsx entry point affects Spacecraft, Earth, Moon, Stars.
**GitHub Issue**: —
**Project Item ID**: —

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-04 12:01 UTC | 4 | [Finding Report](2026-04-04_1201_bloom_glow_visual_effects.md) |
| Designing | 2026-04-04 12:10 UTC | 4 | [Design Analysis](../design/2026-04-04_1201_bloom_postprocessing_pipeline.md) |
| Blueprint Ready | 2026-04-04 12:15 UTC | 4 | [Blueprint](../blueprints/2026-04-04_1215_bloom_postprocessing_pipeline.md), [Prompt](../prompts/2026-04-04_1215_bloom_postprocessing_pipeline.md) |
| Planned | 2026-04-04 12:20 UTC | 4 | [Plan](/Users/johanjgenis/.claude/plans/woolly-wondering-tower.md) |
| Resolved | 2026-04-04 12:25 UTC | 4 | `/wrought-implement` — 1 iteration, build passes |

---

## F2: Crew Timeline Display (Medium Gap)

**Summary**: CREW array (4 members) and MILESTONES array (8 events) are defined in `mission-config.ts` but have no visual representation beyond a phase name in MissionClock.

**Root cause**: Data was authored anticipating future UI; display components were never built during MVP.

**Resolution tasks**:

- [x] **F2.1**: Design approach — timeline widget layout, crew panel design, milestone markers strategy (→ /design → Stage: Designing)
- [x] **F2.2**: Blueprint + implementation prompt (→ /blueprint → Stage: Blueprint Ready)
- [ ] **F2.3**: Implementation plan (→ /plan → Stage: Planned)
- [ ] **F2.4**: Implement timeline and crew components (Stage: Implementing → Resolved)
- [ ] **F2.5**: Code review (→ /forge-review → Stage: Reviewed)
- [ ] **F2.6**: Verify timeline display on deployment (Stage: Verified)

**Recommended approach**: `/plan` using `docs/prompts/2026-04-04_1215_crew_timeline_display.md`

**Status**: In Progress
**Stage**: Blueprint Ready
**Resolved in session**: —
**Verified in session**: —
**Notes**: Data layer complete — pure UI work. Blueprint specifies Option A (Integrated Timeline): milestone markers on ProgressBar + CrewPanel dropdown. 1 new file, 2 modified files.
**GitHub Issue**: —
**Project Item ID**: —

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-04 12:01 UTC | 4 | [Finding Report](2026-04-04_1201_crew_timeline_display.md) |
| Designing | 2026-04-04 12:10 UTC | 4 | [Design Analysis](../design/2026-04-04_1201_crew_timeline_display.md) |
| Blueprint Ready | 2026-04-04 12:15 UTC | 4 | [Blueprint](../blueprints/2026-04-04_1215_crew_timeline_display.md), [Prompt](../prompts/2026-04-04_1215_crew_timeline_display.md) |

---

## F3: Space Weather Alerts (Medium Gap)

**Summary**: No space weather data integration, no alert/notification system, no warning states on telemetry. Entirely new capability across data, state, and UI layers.

**Root cause**: Scoped as post-MVP from the start. MVP focused on trajectory, telemetry, and chat.

**Resolution tasks**:

- [x] **F3.1**: Design approach — data source selection (NOAA API vs synthetic), alert architecture, HUD integration (→ /design → Stage: Designing)
- [x] **F3.2**: Blueprint + implementation prompt (→ /blueprint → Stage: Blueprint Ready)
- [ ] **F3.3**: Implementation plan (→ /plan → Stage: Planned)
- [ ] **F3.4**: Implement space weather system (Stage: Implementing → Resolved)
- [ ] **F3.5**: Code review (→ /forge-review → Stage: Reviewed)
- [ ] **F3.6**: Verify alerts on deployment (Stage: Verified)

**Recommended approach**: `/design from-scratch F3 space weather alert system`

**Status**: In Progress
**Stage**: Blueprint Ready
**Resolved in session**: --
**Verified in session**: --
**Notes**: Broadest scope. Alert infra serves F2 milestone notifications too. Phased: synthetic first, live API overlay second. Discovered existing `api/donki.ts` route (unused).
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-04 12:01 UTC | 4 | [Finding Report](2026-04-04_1201_space_weather_alerts.md) |
| Designing | 2026-04-04 12:10 UTC | 4 | [Design Analysis](../design/2026-04-04_1201_space_weather_alerts.md) |
| Blueprint Ready | 2026-04-04 12:15 UTC | 4 | [Blueprint](../blueprints/2026-04-04_1215_space_weather_alerts.md), [Prompt](../prompts/2026-04-04_1215_space_weather_alerts.md) |

---

## Changelog

| Date | Session | Action |
|------|---------|--------|
| 2026-04-04 12:01 UTC | 4 | Created tracker. F1-F3 logged from post-MVP feature analysis. |
| 2026-04-04 12:10 UTC | 4 | F1-F3 stage → Designing. Design analyses complete (parallel). |
| 2026-04-04 12:15 UTC | 4 | F1 stage → Blueprint Ready. Blueprint + implementation prompt created. |
| 2026-04-04 12:15 UTC | 4 | F2 stage → Blueprint Ready. Blueprint + implementation prompt created. |
| 2026-04-04 12:15 UTC | 4 | F3 stage → Blueprint Ready. Blueprint + implementation prompt created (Phase 1: synthetic + alert infrastructure). |

---

## Cross-References

| Document | Description |
|----------|-------------|
| [2026-04-04_1201_bloom_glow_visual_effects.md](2026-04-04_1201_bloom_glow_visual_effects.md) | F1 finding report |
| [2026-04-04_1201_crew_timeline_display.md](2026-04-04_1201_crew_timeline_display.md) | F2 finding report |
| [2026-04-04_1201_space_weather_alerts.md](2026-04-04_1201_space_weather_alerts.md) | F3 finding report |
| [bloom_postprocessing_pipeline.md](../design/2026-04-04_1201_bloom_postprocessing_pipeline.md) | F1 design analysis |
| [bloom_postprocessing_pipeline.md](../blueprints/2026-04-04_1215_bloom_postprocessing_pipeline.md) | F1 blueprint |
| [bloom_postprocessing_pipeline.md](../prompts/2026-04-04_1215_bloom_postprocessing_pipeline.md) | F1 implementation prompt |
| [crew_timeline_display.md](../design/2026-04-04_1201_crew_timeline_display.md) | F2 design analysis |
| [crew_timeline_display.md](../blueprints/2026-04-04_1215_crew_timeline_display.md) | F2 blueprint |
| [crew_timeline_display.md](../prompts/2026-04-04_1215_crew_timeline_display.md) | F2 implementation prompt |
| [space_weather_alerts.md](../design/2026-04-04_1201_space_weather_alerts.md) | F3 design analysis |
| [space_weather_alerts.md](../blueprints/2026-04-04_1215_space_weather_alerts.md) | F3 blueprint |
| [space_weather_alerts.md](../prompts/2026-04-04_1215_space_weather_alerts.md) | F3 implementation prompt |
| [NEXT_SESSION_PROMPT_2026-04-03_2321.md](../../NEXT_SESSION_PROMPT_2026-04-03_2321.md) | Session 3 handoff (priorities origin) |
