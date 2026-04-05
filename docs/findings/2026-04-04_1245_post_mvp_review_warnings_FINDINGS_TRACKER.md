**2026-04-04 12:45 UTC**

# Post-MVP Review Warnings -- Findings Tracker

**Created**: 2026-04-04 12:45 UTC
**Last Updated**: 2026-04-05 13:00 UTC
**Origin**: `/forge-review --scope=diff` of post-MVP F1-F3 implementation (bloom, crew timeline, space weather)
**Session**: 4
**Scope**: Timer management, effect coupling, selector granularity, and state management issues in the space weather and alerts subsystem

---

## Overview

Six warnings from the 4-agent code review of the post-MVP feature implementation. These are code quality issues in the newly added alerts/weather layer, not related to the original feature gaps (bloom, timeline, weather) which have their own tracker.

| # | Finding | Type | Severity | Status | Stage | Report |
|---|---------|------|----------|--------|-------|--------|
| F1 | AlertsBanner timer management is fragile | Debt | **Medium** | In Progress | Blueprint Ready | [Report](2026-04-04_1245_post_mvp_review_warnings.md) |
| F2 | useAlerts subscribes to entire spaceWeather object | Debt | **Medium** | In Progress | Blueprint Ready | [Report](2026-04-04_1245_post_mvp_review_warnings.md) |
| F3 | useAlerts milestone checking coupled to spaceWeather + impure time source | Debt | **Medium** | In Progress | Blueprint Ready | [Report](2026-04-04_1245_post_mvp_review_warnings.md) |
| F4 | useAlerts firedMilestones ref never cleared | Defect | **Low** | In Progress | Blueprint Ready | [Report](2026-04-04_1245_post_mvp_review_warnings.md) |
| F5 | SpaceWeatherPanel uses 4 separate Zustand selectors | Debt | **Low** | In Progress | Blueprint Ready | [Report](2026-04-04_1245_post_mvp_review_warnings.md) |
| F6 | addAlert dedup has subtle race condition | Defect | **Low** | In Progress | Blueprint Ready | [Report](2026-04-04_1245_post_mvp_review_warnings.md) |

**Status legend**: `Open` -> `In Progress` -> `Resolved` -> `Verified`
**Stage legend**: `Open` -> `Designing` / `Investigating` -> `Blueprint Ready` / `RCA Complete` -> `Planned` -> `Implementing` -> `Reviewed` -> `Resolved` -> `Verified`

---

## Dependency Map

```
F1 (AlertsBanner timers) -- independent, but benefits from F2/F3 refactor
F2 (coarse subscription) ── F3 (milestone coupling) ── tightly coupled, should be refactored together
F4 (firedMilestones ref) ── depends on F3 (milestone split); fix together
F5 (selector consolidation) ── independent, trivial fix
F6 (addAlert dedup race) ── independent, store-level fix
```

Recommended resolution order: F2+F3+F4 (coupled useAlerts refactor) -> F1 (timer refactor) -> F5 (selector) -> F6 (dedup)

---

## F1: AlertsBanner Timer Management Is Fragile (Medium Debt)

**Summary**: `AlertsBanner.tsx` computes `visible = alerts.slice(0, 3)` twice -- once in the effect and once in the render body. Timer cleanup only runs on re-render (effect cleanup), not on individual dismiss. Timers for dismissed or out-of-window alerts linger until the next `alerts` state change.

**Root cause**: Timer lifecycle is tied to effect re-execution rather than to individual alert lifecycle. The dismiss handler removes the alert from state but does not clear the corresponding timer.

**Resolution tasks**:

- [ ] **F1.1**: Design approach -- extract `visible` into `useMemo`, clear timers in dismiss handler, reconcile timer map against visible in effect body (-> /design -> Stage: Designing)
- [ ] **F1.2**: Blueprint + implementation prompt (-> /blueprint -> Stage: Blueprint Ready)
- [ ] **F1.3**: Implement fix (Stage: Implementing -> Resolved)
- [ ] **F1.4**: Code review (-> /forge-review -> Stage: Reviewed)
- [ ] **F1.5**: Verify timer behavior (Stage: Verified)

**Recommended next step**: `/design` -- refactor timer lifecycle to be per-alert rather than per-effect-cycle

**Status**: Open
**Stage**: Open
**Resolved in session**: --
**Verified in session**: --
**Notes**: Medium severity due to potential for lingering timers calling dismissAlert on already-dismissed IDs. No user-visible bug currently, but fragile under higher alert volume.
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-04 12:45 UTC | 4 | [Finding Report](2026-04-04_1245_post_mvp_review_warnings.md) |

---

## F2: useAlerts Subscribes to Entire spaceWeather Object (Medium Debt)

**Summary**: The selector `useMissionStore((s) => s.spaceWeather)` returns a new object reference on every `setSpaceWeather` call. The effect fires every 5 seconds even when only non-alert-relevant fields change (e.g., `solarWindSpeed`, `solarWindDensity`), causing unnecessary HUD re-renders.

**Root cause**: Coarse-grained Zustand selector returns the entire `spaceWeather` object instead of subscribing to specific alert-relevant fields (`radiationZone`, `kpIndex`, `activeEvents`).

**Resolution tasks**:

- [ ] **F2.1**: Design approach -- subscribe to specific fields or move alert logic into a dedicated null-rendering component (-> /design -> Stage: Designing)
- [ ] **F2.2**: Blueprint + implementation prompt (-> /blueprint -> Stage: Blueprint Ready)
- [ ] **F2.3**: Implement fix (Stage: Implementing -> Resolved)
- [ ] **F2.4**: Code review (-> /forge-review -> Stage: Reviewed)
- [ ] **F2.5**: Verify re-render frequency (Stage: Verified)

**Recommended next step**: `/design` -- evaluate field-level selectors vs. dedicated `<WeatherAlertDriver />` component

**Status**: Open
**Stage**: Open
**Resolved in session**: --
**Verified in session**: --
**Notes**: Primary contributor to unnecessary 5-second HUD re-renders. Should be designed together with F3 since both affect useAlerts.
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-04 12:45 UTC | 4 | [Finding Report](2026-04-04_1245_post_mvp_review_warnings.md) |

---

## F3: useAlerts Milestone Checking Coupled to spaceWeather + Impure Time Source (Medium Debt)

**Summary**: Milestone approach notifications depend on elapsed time (`Date.now()`), not space weather data, yet run inside the `spaceWeather` effect. Milestones are checked every 5 seconds as a side effect of weather updates. `Date.now()` is impure relative to the effect's declared dependency.

**Root cause**: Milestone logic was added to the existing weather effect for convenience rather than being given its own lifecycle. The impure `Date.now()` call breaks the pure-function contract of React effects.

**Resolution tasks**:

- [ ] **F3.1**: Design approach -- split milestone checking into its own useEffect with a dedicated interval; derive MET from store state or stable clock (-> /design -> Stage: Designing)
- [ ] **F3.2**: Blueprint + implementation prompt (-> /blueprint -> Stage: Blueprint Ready)
- [ ] **F3.3**: Implement fix (Stage: Implementing -> Resolved)
- [ ] **F3.4**: Code review (-> /forge-review -> Stage: Reviewed)
- [ ] **F3.5**: Verify milestone alerts fire independently of weather (Stage: Verified)

**Recommended next step**: `/design` -- should be designed together with F2 since both restructure useAlerts

**Status**: Open
**Stage**: Open
**Resolved in session**: --
**Verified in session**: --
**Notes**: Coupled with F2; the useAlerts refactor should address both concerns simultaneously. F4 (firedMilestones cleanup) should also be resolved as part of the milestone extraction.
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-04 12:45 UTC | 4 | [Finding Report](2026-04-04_1245_post_mvp_review_warnings.md) |

---

## F4: useAlerts firedMilestones Ref Never Cleared (Low Defect)

**Summary**: The `firedMilestones` Set accumulates entries indefinitely. On component remount (React Strict Mode, hot reload), the ref reinitializes and previously fired milestones are lost, causing duplicate alerts.

**Root cause**: `useRef` initializes a new Set on every mount. There is no persistence mechanism or cleanup logic. The ref scope does not match the intended lifetime of the dedup state.

**Resolution tasks**:

- [ ] **F4.1**: RCA + fix -- scope firedMilestones at module level for cross-mount persistence, or add cleanup in effect return (-> /rca-bugfix -> Stage: RCA Complete)
- [ ] **F4.2**: Implement fix (Stage: Implementing -> Resolved)
- [ ] **F4.3**: Verify no duplicate milestone alerts on remount (Stage: Verified)

**Recommended next step**: `/rca-bugfix` -- root cause is clear; fix as part of F3 milestone extraction or independently

**Status**: Open
**Stage**: Open
**Resolved in session**: --
**Verified in session**: --
**Notes**: Naturally resolved as part of the F2+F3 useAlerts refactor. If milestones move to a dedicated effect with a module-level Set, this is implicitly fixed.
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-04 12:45 UTC | 4 | [Finding Report](2026-04-04_1245_post_mvp_review_warnings.md) |

---

## F5: SpaceWeatherPanel Uses 4 Separate Zustand Selectors (Low Debt)

**Summary**: Four independent `useMissionStore` calls register 4 separate Zustand subscriptions. On every store mutation, 4 equality checks run. All four values come from the same `spaceWeather` sub-object and could be retrieved with a single selector.

**Root cause**: Pattern-copy of individual selectors from other HUD components rather than using a composed selector for related fields.

**Resolution tasks**:

- [ ] **F5.1**: Design approach -- consolidate to single selector: `const { kpIndex, solarWindSpeed, radiationZone, source } = useMissionStore((s) => s.spaceWeather)` (-> /design -> Stage: Designing)
- [ ] **F5.2**: Blueprint + implementation prompt (-> /blueprint -> Stage: Blueprint Ready)
- [ ] **F5.3**: Implement fix (Stage: Implementing -> Resolved)
- [ ] **F5.4**: Verify single subscription (Stage: Verified)

**Recommended next step**: `/design` -- trivial change but should confirm shallow equality behavior with Zustand's default comparator

**Status**: Open
**Stage**: Open
**Resolved in session**: --
**Verified in session**: --
**Notes**: Lowest effort fix of the set. Could be addressed in a single `/rca-bugfix` given the straightforward solution, but `/design` is appropriate to confirm Zustand equality semantics.
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-04 12:45 UTC | 4 | [Finding Report](2026-04-04_1245_post_mvp_review_warnings.md) |

---

## F6: addAlert Dedup Has Subtle Race Condition (Low Defect)

**Summary**: The `addAlert` reducer uses `Date.now()` inside the Zustand `set()` callback, making it impure. Two alerts dispatched in the same millisecond could both pass the dedup check independently. The `.some()` scan is O(n) per addition.

**Root cause**: `Date.now()` inside a reducer violates purity. The dedup mechanism relies on timestamp comparison rather than a dedicated dedup key. No stable dedup data structure is maintained.

**Resolution tasks**:

- [ ] **F6.1**: RCA + fix -- use a dedicated `Map<string, number>` keyed by `type+message` for O(1) dedup; use the alert's own `timestamp` field instead of `Date.now()` (-> /rca-bugfix -> Stage: RCA Complete)
- [ ] **F6.2**: Implement fix (Stage: Implementing -> Resolved)
- [ ] **F6.3**: Verify dedup correctness (Stage: Verified)

**Recommended next step**: `/rca-bugfix` -- root cause is clear; replace impure `Date.now()` with alert's `timestamp` field and add dedup Map

**Status**: Open
**Stage**: Open
**Resolved in session**: --
**Verified in session**: --
**Notes**: The race condition is extremely narrow (same-millisecond dispatch). The impurity concern is more about code correctness principles than observable bugs.
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-04 12:45 UTC | 4 | [Finding Report](2026-04-04_1245_post_mvp_review_warnings.md) |

---

## Changelog

| Date | Session | Action |
|------|---------|--------|
| 2026-04-04 12:45 UTC | 4 | Created tracker. F1-F6 logged from `/forge-review --scope=diff` warnings W1-W6. F1-F3: Medium Debt (alerts/weather coupling). F4: Low Defect (firedMilestones cleanup). F5: Low Debt (selector consolidation). F6: Low Defect (dedup race). |

---

## Cross-References

| Document | Description |
|----------|-------------|
| [2026-04-04_1245_post_mvp_review_warnings.md](2026-04-04_1245_post_mvp_review_warnings.md) | F1-F6 finding report (this tracker's source) |
| [docs/reviews/2026-04-04_1245_diff.md](../reviews/2026-04-04_1245_diff.md) | Source forge-review report (0C/6W/14S) |
| [2026-04-04_1201_post_mvp_visual_data_features_FINDINGS_TRACKER.md](2026-04-04_1201_post_mvp_visual_data_features_FINDINGS_TRACKER.md) | Parent features tracker (F1-F3 implementation that produced these warnings) |
| `src/hud/AlertsBanner.tsx` | F1 -- timer management |
| `src/hooks/useAlerts.ts` | F2, F3, F4 -- subscription, coupling, ref cleanup |
| `src/hud/SpaceWeatherPanel.tsx` | F5 -- selector consolidation |
| `src/store/mission-store.ts` | F6 -- addAlert dedup |
