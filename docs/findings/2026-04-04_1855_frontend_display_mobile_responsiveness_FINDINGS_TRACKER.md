**2026-04-04 18:55 UTC**

# Frontend Display & Mobile Responsiveness -- Findings Tracker

**Created**: 2026-04-04 18:55 UTC
**Last Updated**: 2026-04-05 11:35 UTC
**Origin**: `/research` — frontend display and mobile responsiveness audit
**Session**: 4
**Scope**: Display issues, layout problems, and mobile responsiveness failures across the ARTEMIS HUD (9 component files, 15 issues)

---

## Overview

Tracking remediation of 15 frontend display and mobile responsiveness issues identified during a comprehensive audit. Root cause is desktop-first design with incomplete mobile adaptation. The 3D scene is responsive; the HUD overlay layer is not.

| # | Finding | Type | Severity | Status | Stage | Report |
|---|---------|------|----------|--------|-------|--------|
| F1 | Chat panel fixed width overflow | Defect | **Critical** | Resolved | Resolved | [Report](2026-04-04_1855_frontend_display_mobile_responsiveness.md) |
| F2 | Bottom HUD vertical stack chaos | Debt | **Critical** | Resolved | Resolved | [Report](2026-04-04_1855_frontend_display_mobile_responsiveness.md) |
| F3 | Space weather panel no collapse on mobile | Debt | **High** | Resolved | Resolved | [Report](2026-04-04_1855_frontend_display_mobile_responsiveness.md) |
| F4 | Chat toggle button overlap with HUD | Defect | **Medium** | Resolved | Resolved | [Report](2026-04-04_1855_frontend_display_mobile_responsiveness.md) |
| F5 | Camera controls not responsive | Debt | **Medium** | Resolved | Resolved | [Report](2026-04-04_1855_frontend_display_mobile_responsiveness.md) |
| F6 | Progress bar min-width conflict | Debt | **Medium** | Resolved | Resolved | [Report](2026-04-04_1855_frontend_display_mobile_responsiveness.md) |
| F7 | Milestone tooltips overflow on mobile | Debt | **Medium** | Resolved | Resolved | [Report](2026-04-04_1855_frontend_display_mobile_responsiveness.md) |
| F8 | Touch targets too small for mobile | Defect | **Medium** | Resolved | Resolved | [Report](2026-04-04_1855_frontend_display_mobile_responsiveness.md) |
| F9 | z-index stacking chaos | Debt | **Medium** | Resolved | Resolved | [Report](2026-04-04_1855_frontend_display_mobile_responsiveness.md) |
| F10 | DSN status lacks mobile adaptation | Debt | **Low** | Resolved | Resolved | [Report](2026-04-04_1855_frontend_display_mobile_responsiveness.md) |
| F11 | Mission events panel width hardcoded | Debt | **Low** | Resolved | Resolved | [Report](2026-04-04_1855_frontend_display_mobile_responsiveness.md) |
| F12 | Crew panel positioning on mobile | Debt | **Low** | Resolved | Resolved | [Report](2026-04-04_1855_frontend_display_mobile_responsiveness.md) |
| F13 | Telemetry card text truncation risk | Debt | **Low** | Resolved | Resolved | [Report](2026-04-04_1855_frontend_display_mobile_responsiveness.md) |
| F14 | No safe-area-inset support for notched devices | Gap | **Low** | Resolved | Resolved | [Report](2026-04-04_1855_frontend_display_mobile_responsiveness.md) |
| F15 | Body 100vh not dynamic viewport height | Debt | **Low** | Resolved | Resolved | [Report](2026-04-04_1855_frontend_display_mobile_responsiveness.md) |

**Status legend**: `Open` -> `In Progress` -> `Resolved` -> `Verified`
**Stage legend**: `Open` -> `Investigating` / `Designing` -> `RCA Complete` / `Blueprint Ready` -> `Planned` -> `Implementing` -> `Reviewed` -> `Resolved` -> `Verified`

---

## Dependency Map

```
F1 (Chat overflow) ── independent fix
F2 (HUD stack chaos) ── depends on F3, F5, F10 decisions (what to show/hide on mobile)
F3 (SpaceWeather collapse) ── feeds into F2 reorganization
F4 (Chat button overlap) ── depends on F2 (HUD layout determines button position)
F5 (Camera responsive) ── feeds into F2 reorganization
F6 (ProgressBar width) ── independent fix
F7 (Tooltip overflow) ── depends on F6 (progress bar sizing affects tooltip space)
F8 (Touch targets) ── independent, applies across all interactive elements
F9 (z-index) ── independent, applies across all overlay components
F10-F15 ── independent low-priority fixes
```

---

## Recommended Implementation Phases

### Phase 1: Critical (eliminates overflow and chaos)
- **F1**: Chat panel responsive sizing
- **F2**: HUD bottom section reorganization with progressive disclosure
- **F15**: Dynamic viewport height

### Phase 2: Refinement (polishes the experience)
- **F3**: Space weather collapse on mobile
- **F5**: Camera controls responsive adaptation
- **F8**: Touch target enlargement
- **F6**: Progress bar width clamping

### Phase 3: Polish
- **F9**: z-index rationalization
- **F14**: Safe area insets
- **F10**: DSN compact mode
- **F7**: Tooltip overflow fixes
- **F13**: Telemetry card number formatting
- **F12**: Crew panel positioning
- **F4**: Chat button overlap (resolved by F2 layout)
- **F11**: Mission events panel width

---

## F1: Chat Panel Fixed Width Overflow (Critical Defect)

**Summary**: `src/chat/ChatPanel.tsx:46` — hardcoded `w-[360px]` overflows viewport on all phones (<400px wide). On a 375px-wide phone, panel (360px) + right-6 offset (24px) = 384px needed, 9px overflow. Panel clips off-screen with input and messages inaccessible.

**Root cause**: Fixed pixel width `w-[360px]` does not account for mobile viewport constraints. No responsive alternative provided.

**Resolution tasks**:

- [ ] **F1.1**: RCA + fix — replace fixed width with responsive sizing (-> /rca-bugfix -> Stage: RCA Complete)
- [ ] **F1.2**: Implement fix (Stage: Implementing -> Resolved)
- [ ] **F1.3**: Verify fix on mobile viewport (Stage: Verified)

**Recommended approach**: `/rca-bugfix` — replace `w-[360px] h-[500px]` with `w-[calc(100vw-1.5rem)] sm:w-[360px] h-[70vh] sm:h-[500px]`. On mobile, use `inset-x-3` instead of `right-6` for full-width with margins.

**Status**: Open
**Stage**: Open
**Resolved in session**: --
**Verified in session**: --
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-04 18:55 UTC | 4 | [Finding Report](2026-04-04_1855_frontend_display_mobile_responsiveness.md) |

---

## F2: Bottom HUD Vertical Stack Chaos (Critical Debt)

**Summary**: `src/hud/HUD.tsx:69-82` — bottom section contains 7 distinct elements (DSN, SpaceWeather, CameraControls, 3 TelemetryCards, ProgressBar) that stack vertically on mobile via `flex-col`, covering the bottom half of the screen and obscuring the 3D scene almost entirely.

**Root cause**: No progressive disclosure pattern. All HUD elements render simultaneously on all screen sizes. `flex-col sm:flex-row` on line 70 stacks every secondary panel onto its own full-width row on mobile.

**Resolution tasks**:

- [ ] **F2.1**: Design — determine mobile information hierarchy and progressive disclosure strategy (-> /design -> Stage: Designing)
- [ ] **F2.2**: Blueprint — create implementation spec for mobile HUD reorganization (-> /blueprint -> Stage: Blueprint Ready)
- [ ] **F2.3**: Implement fix (-> /wrought-implement -> Stage: Implementing -> Resolved)
- [ ] **F2.4**: Verify on mobile viewport (Stage: Verified)

**Recommended approach**: `/design` -> `/blueprint` -> `/wrought-implement` — this requires architectural decisions about what to show/hide on mobile. Always visible on mobile: Mission Clock, Speed, Earth Dist, Progress Bar. Collapsed behind toggle: DSN, SpaceWeather, Camera, Moon Distance.

**Status**: Open
**Stage**: Open
**Resolved in session**: --
**Verified in session**: --
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-04 18:55 UTC | 4 | [Finding Report](2026-04-04_1855_frontend_display_mobile_responsiveness.md) |

---

## F3: Space Weather Panel No Collapse on Mobile (High Debt)

**Summary**: `src/hud/SpaceWeatherPanel.tsx:93` — full 4-indicator panel renders at ~320px wide on mobile with `flex-wrap`. Shows all data points + labels in a wide boxed container. On a 375px screen, the panel is ~320px wide and ~80px tall (two rows when wrapped), consuming significant viewport space.

**Root cause**: `flex-wrap` allows wrapping but does not collapse content. No mobile-specific layout or progressive disclosure. Panel always renders all 4 indicators.

**Resolution tasks**:

- [ ] **F3.1**: Design — determine compact mobile representation (-> /design -> Stage: Designing)
- [ ] **F3.2**: Blueprint — create implementation spec (-> /blueprint -> Stage: Blueprint Ready)
- [ ] **F3.3**: Implement fix (-> /wrought-implement -> Stage: Implementing -> Resolved)
- [ ] **F3.4**: Verify on mobile viewport (Stage: Verified)

**Recommended approach**: `/design` — collapse to a single compact indicator on mobile (e.g., just the Kp dot + value) with tap-to-expand. Or hide entirely behind the "More" toggle from F2's progressive disclosure strategy.

**Status**: Open
**Stage**: Open
**Resolved in session**: --
**Verified in session**: --
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-04 18:55 UTC | 4 | [Finding Report](2026-04-04_1855_frontend_display_mobile_responsiveness.md) |

---

## F4: Chat Toggle Button Overlap with HUD (Medium Defect)

**Summary**: `src/chat/ChatPanel.tsx:30` — chat toggle button at `fixed bottom-6 right-6` overlaps with bottom HUD telemetry cards on mobile. Both have `pointer-events-auto`, creating a tap conflict zone.

**Root cause**: Button position is absolute and does not account for bottom HUD element positions on mobile. No coordination between chat toggle and HUD layout.

**Resolution tasks**:

- [ ] **F4.1**: RCA + fix — reposition chat button on mobile to avoid HUD overlap (-> /rca-bugfix -> Stage: RCA Complete)
- [ ] **F4.2**: Implement fix (Stage: Implementing -> Resolved)
- [ ] **F4.3**: Verify on mobile viewport (Stage: Verified)

**Recommended approach**: `/rca-bugfix` — on mobile, move chat button above the bottom HUD using `bottom-[calc(theme(spacing.2)+200px)] sm:bottom-6`. Depends on F2 (HUD layout determines final button position).

**Status**: Open
**Stage**: Open
**Resolved in session**: --
**Verified in session**: --
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-04 18:55 UTC | 4 | [Finding Report](2026-04-04_1855_frontend_display_mobile_responsiveness.md) |

---

## F5: Camera Controls Not Responsive (Medium Debt)

**Summary**: `src/hud/CameraControls.tsx:16` — 4 buttons in a horizontal `flex` row with no responsive adaptation. Total width ~380px (each button ~90px with padding and text), overflows a 375px viewport. No `sm:` breakpoint modifications.

**Root cause**: No responsive design applied. Horizontal layout with text labels does not fit mobile viewport width.

**Resolution tasks**:

- [ ] **F5.1**: Design — determine mobile camera controls layout (-> /design -> Stage: Designing)
- [ ] **F5.2**: Blueprint — create implementation spec (-> /blueprint -> Stage: Blueprint Ready)
- [ ] **F5.3**: Implement fix (-> /wrought-implement -> Stage: Implementing -> Resolved)
- [ ] **F5.4**: Verify on mobile viewport (Stage: Verified)

**Recommended approach**: `/design` — options include: abbreviate labels on mobile ("Follow"/"Earth"/"Moon"/"Free"), collapse into dropdown/select, show icons instead of text, or move behind the "More" toggle from F2.

**Status**: Open
**Stage**: Open
**Resolved in session**: --
**Verified in session**: --
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-04 18:55 UTC | 4 | [Finding Report](2026-04-04_1855_frontend_display_mobile_responsiveness.md) |

---

## F6: Progress Bar min-width Conflict (Medium Debt)

**Summary**: `src/hud/ProgressBar.tsx:72` — progress bar uses `min-w-[200px] sm:min-w-[420px]` and `col-span-2 sm:col-span-1`. The `sm:mr-16` adds an artifact right margin on desktop, and milestone tooltips (`min-w-[180px] max-w-[240px]`) can overflow the progress bar container on narrow screens.

**Root cause**: `sm:mr-16` is a layout artifact from an older design. Tooltip sizing does not account for mobile viewport edges.

**Resolution tasks**:

- [ ] **F6.1**: RCA + fix — remove `sm:mr-16` artifact, constrain tooltip positioning (-> /rca-bugfix -> Stage: RCA Complete)
- [ ] **F6.2**: Implement fix (Stage: Implementing -> Resolved)
- [ ] **F6.3**: Verify on mobile viewport (Stage: Verified)

**Recommended approach**: `/rca-bugfix` — remove `sm:mr-16`. Add `max-w-[calc(100vw-2rem)]` on tooltips to prevent viewport overflow.

**Status**: Open
**Stage**: Open
**Resolved in session**: --
**Verified in session**: --
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-04 18:55 UTC | 4 | [Finding Report](2026-04-04_1855_frontend_display_mobile_responsiveness.md) |

---

## F7: Milestone Tooltips Overflow on Mobile (Medium Debt)

**Summary**: `src/hud/ProgressBar.tsx:126` — milestone tooltips are `absolute` positioned with `min-w-[180px]`. On mobile, when the milestone dot is near the left or right edge, the tooltip extends beyond the screen. Position logic only handles extreme edges (< 10%, > 90%), not the general narrow-screen case.

**Root cause**: Tooltip positioning logic designed for desktop viewport widths. `min-w-[180px]` exceeds available space at viewport edges on mobile.

**Resolution tasks**:

- [ ] **F7.1**: RCA + fix — constrain tooltip width and adjust positioning thresholds for mobile (-> /rca-bugfix -> Stage: RCA Complete)
- [ ] **F7.2**: Implement fix (Stage: Implementing -> Resolved)
- [ ] **F7.3**: Verify on mobile viewport (Stage: Verified)

**Recommended approach**: `/rca-bugfix` — add `max-w-[calc(100vw-2rem)]` and widen positioning thresholds for mobile. Depends on F6 (progress bar sizing affects tooltip space).

**Status**: Open
**Stage**: Open
**Resolved in session**: --
**Verified in session**: --
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-04 18:55 UTC | 4 | [Finding Report](2026-04-04_1855_frontend_display_mobile_responsiveness.md) |

---

## F8: Touch Targets Too Small for Mobile (Medium Defect)

**Summary**: Multiple interactive elements are below the 44x44px minimum recommended touch target. Crew button ~24x20px (`src/hud/HUD.tsx:48-58`), Mission Events hamburger ~34x30px (`src/hud/MissionEventsPanel.tsx:74-89`), Camera buttons ~30px height (`src/hud/CameraControls.tsx:21`), Alert dismiss ~16x16px (`src/hud/AlertItem.tsx:62-66`), Milestone dots 6x6px (`src/hud/ProgressBar.tsx:97-116`).

**Root cause**: Touch target sizing was not considered during desktop-first implementation. Visual element sizes are below mobile interaction minimums.

**Resolution tasks**:

- [ ] **F8.1**: RCA + fix — enlarge touch targets across all affected files (-> /rca-bugfix -> Stage: RCA Complete)
- [ ] **F8.2**: Implement fix (Stage: Implementing -> Resolved)
- [ ] **F8.3**: Verify on mobile device (Stage: Verified)

**Recommended approach**: `/rca-bugfix` — add `min-h-[44px] min-w-[44px]` or invisible hit areas (`p-3` around icons) on mobile. For milestone dots, expand touch target with a transparent padding div.

**Status**: Open
**Stage**: Open
**Resolved in session**: --
**Verified in session**: --
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-04 18:55 UTC | 4 | [Finding Report](2026-04-04_1855_frontend_display_mobile_responsiveness.md) |

---

## F9: z-index Stacking Chaos (Medium Debt)

**Summary**: Fragmented z-index hierarchy across 8 files with no documented system. Chat button (z-50) and milestone tooltips (z-50) compete at the same level. Chat panel (z-40) is at the same level as dropdown panels (CrewPanel, MissionEventsPanel). If both chat and a dropdown are open, they fight for visual priority.

**Root cause**: z-indices assigned ad-hoc per file with no central coordination or documented hierarchy.

**Resolution tasks**:

- [ ] **F9.1**: Design — define z-index scale as CSS custom properties (-> /design -> Stage: Designing)
- [ ] **F9.2**: Blueprint — create implementation spec (-> /blueprint -> Stage: Blueprint Ready)
- [ ] **F9.3**: Implement fix (-> /wrought-implement -> Stage: Implementing -> Resolved)
- [ ] **F9.4**: Verify stacking across all overlay combinations (Stage: Verified)

**Recommended approach**: `/design` — establish documented z-index scale: z-10 HUD base, z-20 alerts, z-30 backdrops, z-40 dropdowns, z-50 chat panel, z-60 chat toggle, z-70 transient tooltips, z-9999 debug. Define as CSS custom properties in `src/index.css`, reference via `z-[var(--z-chat)]`.

**Status**: Open
**Stage**: Open
**Resolved in session**: --
**Verified in session**: --
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-04 18:55 UTC | 4 | [Finding Report](2026-04-04_1855_frontend_display_mobile_responsiveness.md) |

---

## F10: DSN Status Lacks Mobile Adaptation (Low Debt)

**Summary**: `src/hud/DSNStatus.tsx:32` — `flex items-center gap-3` with no breakpoint modifiers. "DSN" label + 3 station indicators (~220px total) fits on most phones but contributes to overall bottom HUD clutter when stacked vertically via HUD.tsx `flex-col`.

**Root cause**: No mobile-specific layout. Component renders identically on all viewport sizes.

**Resolution tasks**:

- [ ] **F10.1**: Design — determine compact mobile representation (-> /design -> Stage: Designing)
- [ ] **F10.2**: Implement fix (-> /wrought-implement -> Stage: Implementing -> Resolved)
- [ ] **F10.3**: Verify on mobile viewport (Stage: Verified)

**Recommended approach**: `/design` — consolidate into a single status dot on mobile (green if any station active, gray if none). Tap to see detail. Or hide behind F2's "More" toggle.

**Status**: Open
**Stage**: Open
**Resolved in session**: --
**Verified in session**: --
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-04 18:55 UTC | 4 | [Finding Report](2026-04-04_1855_frontend_display_mobile_responsiveness.md) |

---

## F11: Mission Events Panel Width Hardcoded (Low Debt)

**Summary**: `src/hud/MissionEventsPanel.tsx:103` — `w-[320px]` is fixed regardless of viewport size. On a 375px phone with `right-0` positioning, the panel overflows 10-15px beyond the left viewport edge (320px + padding + border > remaining space).

**Root cause**: Fixed pixel width with no responsive alternative.

**Resolution tasks**:

- [ ] **F11.1**: RCA + fix — replace fixed width with responsive sizing (-> /rca-bugfix -> Stage: RCA Complete)
- [ ] **F11.2**: Implement fix (Stage: Implementing -> Resolved)
- [ ] **F11.3**: Verify on mobile viewport (Stage: Verified)

**Recommended approach**: `/rca-bugfix` — replace `w-[320px]` with `w-[calc(100vw-1.5rem)] sm:w-[320px]` or `max-w-[calc(100vw-1.5rem)]`.

**Status**: Open
**Stage**: Open
**Resolved in session**: --
**Verified in session**: --
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-04 18:55 UTC | 4 | [Finding Report](2026-04-04_1855_frontend_display_mobile_responsiveness.md) |

---

## F12: Crew Panel Positioning on Mobile (Low Debt)

**Summary**: `src/hud/CrewPanel.tsx:22` — `absolute top-full mt-2 left-0` with `min-w-[200px]`. Dropdown overlaps with 3D scene. Click-outside overlay (`fixed inset-0 z-30`) may interfere with 3D canvas touch interactions on mobile.

**Root cause**: Dropdown positioning designed for desktop. No mobile-specific layout (e.g., bottom sheet).

**Resolution tasks**:

- [ ] **F12.1**: Design — determine mobile panel behavior (-> /design -> Stage: Designing)
- [ ] **F12.2**: Implement fix (-> /wrought-implement -> Stage: Implementing -> Resolved)
- [ ] **F12.3**: Verify on mobile viewport (Stage: Verified)

**Recommended approach**: `/design` — on mobile, render as a bottom sheet instead of a dropdown. Or increase overlay z-index to fully capture touch events during open state.

**Status**: Open
**Stage**: Open
**Resolved in session**: --
**Verified in session**: --
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-04 18:55 UTC | 4 | [Finding Report](2026-04-04_1855_frontend_display_mobile_responsiveness.md) |

---

## F13: Telemetry Card Text Truncation Risk (Low Debt)

**Summary**: `src/hud/TelemetryCard.tsx:23` — `min-w-0` on mobile (via `min-w-0 sm:min-w-[140px]`) allows cards to shrink to any width. Large numbers like "384,400" (Moon distance in km) can overflow or wrap awkwardly. No `overflow-hidden` or `text-ellipsis` applied.

**Root cause**: No minimum mobile width constraint. No overflow protection on text content.

**Resolution tasks**:

- [ ] **F13.1**: RCA + fix — add overflow protection and minimum width (-> /rca-bugfix -> Stage: RCA Complete)
- [ ] **F13.2**: Implement fix (Stage: Implementing -> Resolved)
- [ ] **F13.3**: Verify with long number values (Stage: Verified)

**Recommended approach**: `/rca-bugfix` — add `overflow-hidden` and `min-w-[100px] sm:min-w-[140px]`. Use `tabular-nums` for number alignment stability.

**Status**: Open
**Stage**: Open
**Resolved in session**: --
**Verified in session**: --
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-04 18:55 UTC | 4 | [Finding Report](2026-04-04_1855_frontend_display_mobile_responsiveness.md) |

---

## F14: No Safe-Area-Inset Support for Notched Devices (Low Gap)

**Summary**: `src/index.css` and `index.html` — iPhones with notches and dynamic islands have safe area insets that cut into the viewport. HUD uses `p-2 sm:p-4` padding which does not account for notch areas. Elements near top and bottom edges can be obscured.

**Root cause**: Missing `viewport-fit=cover` in HTML meta tag and `env(safe-area-inset-*)` padding in CSS. Feature was never implemented.

**Resolution tasks**:

- [ ] **F14.1**: RCA + fix — add viewport-fit meta and safe-area-inset padding (-> /rca-bugfix -> Stage: RCA Complete)
- [ ] **F14.2**: Implement fix (Stage: Implementing -> Resolved)
- [ ] **F14.3**: Verify on notched device or simulator (Stage: Verified)

**Recommended approach**: `/rca-bugfix` — add `viewport-fit=cover` to `<meta name="viewport">` in `index.html`. Add `env(safe-area-inset-*)` padding to `#root` in `src/index.css`.

**Status**: Open
**Stage**: Open
**Resolved in session**: --
**Verified in session**: --
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-04 18:55 UTC | 4 | [Finding Report](2026-04-04_1855_frontend_display_mobile_responsiveness.md) |

---

## F15: Body 100vh Not Dynamic Viewport Height (Low Debt)

**Summary**: `src/index.css:18` — `#root` uses `height: 100vh` which does not account for mobile browser dynamic toolbars (Chrome, Safari). When the URL bar appears/disappears, the viewport height changes, causing HUD bottom elements to jump or be hidden behind the mobile browser's bottom toolbar.

**Root cause**: `100vh` is the static viewport height. Mobile browsers with dynamic toolbars need `100dvh` (dynamic viewport height) for correct sizing.

**Resolution tasks**:

- [ ] **F15.1**: RCA + fix — replace 100vh with 100dvh (-> /rca-bugfix -> Stage: RCA Complete)
- [ ] **F15.2**: Implement fix (Stage: Implementing -> Resolved)
- [ ] **F15.3**: Verify on mobile browser with dynamic toolbar (Stage: Verified)

**Recommended approach**: `/rca-bugfix` — replace `height: 100vh` with `height: 100dvh` on `#root`, with `100vh` fallback for older browsers.

**Status**: Open
**Stage**: Open
**Resolved in session**: --
**Verified in session**: --
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-04 18:55 UTC | 4 | [Finding Report](2026-04-04_1855_frontend_display_mobile_responsiveness.md) |

---

## Changelog

| Date | Session | Action |
|------|---------|--------|
| 2026-04-04 19:00 UTC | 4 | Blueprint complete. F1-F15 all moved to Blueprint Ready. 3-phase implementation plan: Phase 1 (F1, F2, F15 -- chat responsive, HUD progressive disclosure, dvh), Phase 2 (F3, F5, F6, F7, F8 -- SpaceWeather compact, Camera responsive, ProgressBar fixes, touch targets), Phase 3 (F4, F9, F10, F11, F12, F13, F14 -- z-index system, DSN compact, TelemetryCard overflow, CrewPanel positioning, safe-area). Blueprint: `docs/blueprints/2026-04-04_1900_mobile_first_hud_progressive_disclosure.md`. Implementation prompt: `docs/prompts/2026-04-04_1900_mobile_first_hud_progressive_disclosure.md`. |
| 2026-04-04 18:55 UTC | 4 | Created tracker. F1-F15 logged from frontend display audit. F1-F2: Critical (overflow, stack chaos). F3: High (SpaceWeather no collapse). F4-F9: Medium (overlap, responsive, tooltips, touch, z-index). F10-F15: Low (DSN, events, crew, telemetry, safe-area, dvh). |
| 2026-04-05 11:35 UTC | 6 | F1-F15 ALL marked Resolved. Code verification confirmed all 3 phases of the implementation prompt were already applied: Phase 1 (F1 chat responsive, F2 progressive disclosure, F15 dvh), Phase 2 (F3 SpaceWeather compact, F5 camera labels, F6/F7 ProgressBar fixes, F8 touch targets), Phase 3 (F9 z-index system, F10 DSN compact, F11 events width, F12 CrewPanel bottom sheet, F13 TelemetryCard overflow, F14 safe-area, F4 resolved by F2). Build passes. Tracker statuses were stale — implementation was completed but tracker never updated. |

---

## Cross-References

| Document | Description |
|----------|-------------|
| [Research](../research/2026-04-04_1500_frontend_display_mobile_responsiveness.md) | Source research with detailed code excerpts, measurements, and implementation analysis |
| [Finding Report](2026-04-04_1855_frontend_display_mobile_responsiveness.md) | Finding report summarizing all 15 issues |
| [Parent Feature Tracker](2026-04-04_1201_post_mvp_visual_data_features_FINDINGS_TRACKER.md) | Post-MVP visual and data features tracker |
| `src/chat/ChatPanel.tsx` | F1, F4 |
| `src/hud/HUD.tsx` | F2, F8 |
| `src/hud/SpaceWeatherPanel.tsx` | F3 |
| `src/hud/CameraControls.tsx` | F5, F8 |
| `src/hud/ProgressBar.tsx` | F6, F7 |
| `src/hud/MissionEventsPanel.tsx` | F11 |
| `src/hud/DSNStatus.tsx` | F10 |
| `src/hud/CrewPanel.tsx` | F12 |
| `src/hud/TelemetryCard.tsx` | F13 |
| `src/hud/AlertItem.tsx` | F8 |
| `src/index.css` | F14, F15 |
| `index.html` | F14 |
