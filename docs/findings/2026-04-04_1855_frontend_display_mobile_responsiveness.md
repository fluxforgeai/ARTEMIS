# Finding: Frontend Display & Mobile Responsiveness Issues (15 Issues)

**Date**: 2026-04-04
**Discovered by**: `/research` — comprehensive frontend audit
**Type**: Debt (12 issues) / Defect (3 issues)
**Severity**: Critical (2) / High (1) / Medium (6) / Low (6)
**Status**: Open

---

## What Was Found

Comprehensive audit of the ARTEMIS HUD identified 15 distinct display and responsiveness issues across 9 component files. The root cause is desktop-first design with incomplete mobile adaptation.

### Critical Issues
1. **Chat Panel Fixed Width Overflow** (`src/chat/ChatPanel.tsx:46`): Hardcoded `w-[360px]` overflows viewport on all phones (<400px wide). Panel clips off-screen.
2. **Bottom HUD Vertical Stack Chaos** (`src/hud/HUD.tsx:69-82`): 7 elements stack vertically on mobile, covering bottom half of screen, obscuring 3D scene.

### High Issues
3. **Space Weather Panel No Collapse** (`src/hud/SpaceWeatherPanel.tsx:93`): Full 4-indicator panel renders at ~320px wide on mobile with no collapse behavior.

### Medium Issues
4. **Chat Toggle Overlap** (`src/chat/ChatPanel.tsx:30`): Chat button at `fixed bottom-6 right-6` overlaps with bottom HUD telemetry cards.
5. **Camera Controls Not Responsive** (`src/hud/CameraControls.tsx:16`): 4 buttons total ~380px, overflows 375px viewport.
6. **Progress Bar min-width Conflict** (`src/hud/ProgressBar.tsx:72`): `sm:mr-16` artifact, tooltip overflow on mobile.
7. **Milestone Tooltip Overflow** (`src/hud/ProgressBar.tsx:126`): Absolute-positioned tooltips extend beyond viewport on narrow screens.
8. **Touch Targets Too Small** (Multiple files): Crew button ~24x20px, hamburger ~34x30px, milestone dots 6x6px — all below 44x44px minimum.
9. **z-index Stacking Chaos** (Multiple files): Fragmented z-indices across 8 files, chat (z-50) and tooltips (z-50) compete.

### Low Issues
10. **DSN No Mobile Adaptation** (`src/hud/DSNStatus.tsx:32`): No breakpoint modifiers, contributes to bottom HUD clutter.
11. **Events Panel Width Hardcoded** (`src/hud/MissionEventsPanel.tsx:103`): `w-[320px]` overflows on phones.
12. **Crew Panel Positioning** (`src/hud/CrewPanel.tsx:22`): Dropdown overlaps 3D scene, click-outside overlay interferes with canvas touch.
13. **Telemetry Card Truncation** (`src/hud/TelemetryCard.tsx:23`): Large numbers can overflow without `overflow-hidden`.
14. **No Safe Area Inset Support** (`src/index.css`, `index.html`): Notched iPhones clip HUD elements.
15. **100vh Not Dynamic** (`src/index.css:18`): Mobile browser toolbar dynamics cause layout jumps.

---

## Affected Components

- `src/chat/ChatPanel.tsx` — Issues #1, #4
- `src/hud/HUD.tsx` — Issue #2, #8
- `src/hud/SpaceWeatherPanel.tsx` — Issue #3
- `src/hud/CameraControls.tsx` — Issue #5, #8
- `src/hud/ProgressBar.tsx` — Issues #6, #7
- `src/hud/MissionEventsPanel.tsx` — Issue #11
- `src/hud/DSNStatus.tsx` — Issue #10
- `src/hud/CrewPanel.tsx` — Issue #12
- `src/hud/TelemetryCard.tsx` — Issue #13
- `src/hud/AlertItem.tsx` — Issue #8
- `src/index.css` — Issues #14, #15
- `index.html` — Issue #14

---

## Evidence

See detailed code excerpts and measurements in research document: `docs/research/2026-04-04_1500_frontend_display_mobile_responsiveness.md`

---

## Preliminary Assessment

**Likely cause**: Desktop-first design with `sm:` breakpoints applied inconsistently. Hardcoded pixel widths (`w-[360px]`, `w-[320px]`, `min-w-[420px]`) don't account for mobile viewport constraints. No progressive disclosure pattern — all HUD elements render simultaneously on all screen sizes.

**Likely scope**: Systemic — affects the entire HUD layer (9 files). The 3D scene itself is responsive.

**Likely impact**: Mobile users see a cluttered, overflowing interface where HUD covers most of the 3D scene. Some panels overflow the viewport. Touch interactions are unreliable due to small targets and z-index conflicts. The app is effectively desktop-only in its current state.

---

## Classification Rationale

**Type: Debt** (majority) — The mobile layout was never fully designed; desktop was the primary target. Issues #1, #4, #8 are Defects (broken behavior). Issue #14 is a Gap (missing capability). The remaining 11 are Debt (incomplete adaptation).

**Severity**: Two Critical (overflow and stack chaos make the mobile app nearly unusable), one High (SpaceWeather panel is the largest single offender after the stack issue), six Medium (each degrades mobile UX but has workarounds), six Low (cosmetic or edge-case).

---

**Finding Logged**: 2026-04-04 18:55 UTC
