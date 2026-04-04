# Investigation: ProgressBar Overlays ChatPanel + Height Mismatch (F1 & F2)

**Date**: 2026-04-04
**Investigator**: Claude Code (Session 5)
**Severity**: High (F1), Medium (F2)
**Status**: Investigation Complete

---

## Executive Summary

The ProgressBar component physically overlaps the AI Chatbot panel on desktop because the HUD's `absolute inset-0` container spans the full viewport and ProgressBar's `sm:flex-1` grows unconstrained under the ChatPanel's fixed-position area. Despite the z-index hierarchy (`--z-hud: 10` vs `--z-chat: 45`), the ProgressBar's `backdrop-blur-sm` creates a new stacking context that paints over the ChatPanel in certain compositing scenarios. Additionally, the ProgressBar renders taller than adjacent TelemetryCards due to inconsistent padding (`py-3` always vs `py-2`/`sm:py-3`) and extra internal content (milestone countdown line), causing vertical misalignment in the bottom HUD row.

---

## External Research Findings

### Official Documentation Consulted

- **CSS `backdrop-filter` Stacking Context**: Per the CSS Filter Effects Module Level 2 spec and MDN documentation, `backdrop-filter` (including Tailwind's `backdrop-blur-sm`) **creates a new stacking context** on the element. This means the element and all its descendants are composited as a single layer, independent of other stacking contexts -- even if the parent has a lower z-index. Source: [MDN backdrop-filter](https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter)

- **CSS Stacking Context Formation**: Any of these properties create a new stacking context: `opacity < 1`, `transform`, `filter`, `backdrop-filter`, `will-change`, `position: fixed/sticky`, or explicit `z-index` on a positioned element. When two sibling stacking contexts overlap, z-index determines paint order. But when a child of one stacking context overlaps a sibling stacking context, the **parent's** z-index governs, not the child's. Source: [MDN Stacking Context](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Understanding_z-index/Stacking_context)

- **Tailwind CSS Flexbox**: `flex-1` maps to `flex: 1 1 0%`, meaning the element will grow to fill all available space. In a flex container that spans the full viewport width, this causes the element to expand to fill remaining space after siblings are laid out. Source: [Tailwind CSS Flex](https://tailwindcss.com/docs/flex)

### Known Issues / Community Reports

- CSS stacking context interference with `backdrop-filter` is a well-documented source of z-index "not working" bugs. Multiple Stack Overflow threads report that elements with `backdrop-filter` appear to ignore z-index of sibling elements because the blur creates an independent compositing layer.

### API/Library Behavior Notes

- `backdrop-blur-sm` compiles to `backdrop-filter: blur(4px)`. This triggers GPU-accelerated compositing and creates an isolated stacking context.
- The `fixed` positioning on ChatPanel also creates its own stacking context.
- The critical interaction: HUD (absolute, z-index 10) contains ProgressBar (backdrop-blur, creating a new stacking context). ChatPanel (fixed, z-index 45) is a sibling of HUD. The z-index comparison should be HUD(10) vs ChatPanel(45), meaning ChatPanel wins. However, the physical overlap combined with browser compositing of backdrop-filter layers can cause rendering artifacts where the blur layer paints on top despite lower z-index.

---

## Learnings from Previous RCAs/Investigations/Research

### Related Past Incidents

1. **Session 4 Mobile Responsiveness Tracker (F4 + F9)**: F4 documented "Chat toggle button overlap with HUD" and F9 documented "z-index stacking chaos". The Session 4 fix (commit `4534bb6`) introduced a CSS custom property z-index system (`--z-hud: 10` through `--z-tooltip: 55`) and applied it across all components. The fix was correct for the z-index hierarchy but did not address the physical overlap of ProgressBar extending under the ChatPanel's screen area.

2. **Commit `45a73d7` (Session 4 mid-session)**: Added `sm:mr-16` to ProgressBar to "avoid overlapping the chat icon." This was a spatial fix (right margin to keep ProgressBar away from the chat toggle button area). However, this fix was **removed** in the subsequent mobile-first commit (`4534bb6`) because it was flagged as a "layout artifact" during the responsiveness pass. The removal was correct for mobile but re-exposed the desktop overlap.

3. **Session 4 Mobile Research (`docs/research/2026-04-04_1500_frontend_display_mobile_responsiveness.md`)**: Identified F6 "Progress Bar min-width Conflict" noting `sm:mr-16` as an artifact. The research recommended removing it. This created a regression: the mobile fix removed the desktop overlap prevention.

### Patterns Identified

- **This is a recurring regression (3rd occurrence)**:
  - First: Original desktop overlap (pre-Session 4)
  - Second: Fixed with `sm:mr-16` in commit `45a73d7`, then removed in commit `4534bb6`
  - Third: Current state -- ProgressBar extends under ChatPanel again
- **Root pattern**: The fixes have been treating symptoms (add margin, change z-index) rather than the structural problem (the HUD container spans full viewport width, and flex-1 grows the ProgressBar unconstrained into the ChatPanel zone).

### Applicable Previous Solutions

- The `sm:mr-16` approach (commit `45a73d7`) was directionally correct but too crude (fixed 4rem margin regardless of chat state). A better approach: constrain the HUD bottom row's max-width or use `sm:max-w-[calc(100%-380px)]` on ProgressBar to leave room for the ChatPanel column.

---

## Timeline of Events

| Time (UTC) | Event | Details |
|------------|-------|---------|
| Session 4, ~15:19 | Commit `45a73d7` | Added `sm:mr-16` to ProgressBar to avoid chat icon overlap |
| Session 4, ~18:55 | Mobile audit | F6 flagged `sm:mr-16` as a "layout artifact" to remove |
| Session 4, ~21:51 | Commit `4534bb6` | Mobile-first HUD: removed `sm:mr-16`, introduced z-index CSS vars, progressive disclosure |
| Session 5, start | User screenshot | ProgressBar overlapping ChatPanel on desktop confirmed |

---

## Root Cause Analysis

### F1: ProgressBar Overlays ChatPanel

#### Primary Cause: Physical Overlap (Layout)

The HUD container (`absolute inset-0`) spans the full viewport. The bottom telemetry row uses `sm:flex` with ProgressBar having `sm:flex-1`, causing it to grow and fill all remaining horizontal space. On a typical desktop viewport (1200-1920px), after SpeedCard (~140px), EarthDistCard (~140px), and MoonDistCard (~140px) are laid out, ProgressBar fills the remaining ~780-1500px. The ChatPanel is `fixed sm:right-6 sm:w-[360px] bottom-20`, positioning it over the rightmost ~390px of the viewport. The ProgressBar extends under this entire zone.

The `sm:mr-16` fix in commit `45a73d7` partially addressed this with a 64px right margin, but this was only enough to avoid the 48px chat toggle button -- not the full 360px chat panel. And it was subsequently removed.

#### Secondary Cause: Stacking Context Interference (Rendering)

Even with z-index correctly set (`--z-hud: 10` vs `--z-chat: 45`), `backdrop-blur-sm` on the ProgressBar creates an independent compositing layer. In some browser compositing pipelines, the backdrop-filter layer can paint on top of other positioned elements due to GPU compositing order rather than CSS z-index. This is the z-index hierarchy:

```
App container (relative)
  ├── Scene (canvas, z-auto)
  ├── HUD (absolute inset-0, z-index: 10)          ← stacking context A
  │   └── bottom row (flex)
  │       ├── SpeedCard (backdrop-blur-sm)          ← stacking context A.1
  │       ├── EarthDistCard (backdrop-blur-sm)      ← stacking context A.2
  │       ├── MoonDistCard (backdrop-blur-sm)       ← stacking context A.3
  │       └── ProgressBar (backdrop-blur-sm, flex-1) ← stacking context A.4
  └── ChatPanel (fixed, z-index: 45)                ← stacking context B
```

By CSS spec, stacking context B (z-45) should paint above stacking context A (z-10) and all its children. However, `backdrop-filter` creates an independent compositing layer that may bypass normal z-index stacking in some rendering scenarios -- particularly when the backdrop-filter element physically overlaps a `fixed` element with a higher z-index, and both have semi-transparent backgrounds.

#### Tertiary Cause: No Spatial Boundary for HUD Content

The HUD container has no `max-width` or right-side constraint to keep its content out of the ChatPanel's screen area. The layout assumes all HUD content will naturally stay within the left/center portion of the screen, but `flex-1` on ProgressBar violates this assumption.

### F2: ProgressBar Height Mismatch

#### Primary Cause: Inconsistent Padding

- **TelemetryCard**: `py-2 sm:py-3` (8px mobile, 12px desktop)
- **ProgressBar**: `py-3` always (12px on all viewports)

On desktop (>=640px), both use 12px vertical padding, so padding is matched. But on mobile (<640px), TelemetryCard uses 8px while ProgressBar uses 12px -- an 8px total height difference.

However, the mismatch is visible on desktop too because of the secondary cause.

#### Secondary Cause: Extra Internal Content

ProgressBar has three content rows:
1. "Mission Progress" label (10px text + 4px margin-bottom)
2. Progress track + percentage (8px track height)
3. "Next: {milestone} in {countdown}" line (9-10px text + 4px margin-top)

TelemetryCard has two content rows:
1. Label (9-10px text + 2-4px margin-bottom)
2. Value + unit (14-20px text)

The extra countdown row adds ~14-18px of intrinsic height to ProgressBar. With `sm:items-center` on the parent flex container, the taller ProgressBar centers vertically against shorter siblings, causing its top edge to extend above the top edge of adjacent TelemetryCards.

---

## Contributing Factors

### 1. Session 4 Fix Removal Without Desktop Verification

The `sm:mr-16` margin was removed during the mobile-first pass (commit `4534bb6`) because the mobile responsiveness audit flagged it as an artifact. The removal was correct for mobile but the desktop layout was not re-verified after removal. The audit was mobile-focused and did not re-check desktop behavior.

### 2. HUD Uses `absolute inset-0` Without Content Constraints

The HUD container spans the full viewport with `absolute inset-0`. This is necessary for the overlay to cover the 3D scene, but it means child flex items can grow to fill the full viewport width. There is no mechanism to reserve space for the ChatPanel, which lives outside the HUD component hierarchy.

### 3. No Cross-Component Layout Coordination

HUD and ChatPanel are sibling components in `App.tsx` with no layout coordination. The ChatPanel positions itself with `fixed` positioning independent of HUD layout. Neither component is aware of the other's screen area. This is a structural problem -- the layout has two independent overlay systems that can physically overlap.

---

## Evidence

### Code Evidence

```tsx
// src/hud/HUD.tsx:43 — HUD spans full viewport
<div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2 sm:p-4 z-[var(--z-hud)] safe-area-pad">

// src/hud/HUD.tsx:99 — bottom row with flex layout
<div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-3 pointer-events-auto">
  <SpeedCard />
  <EarthDistCard />
  <div className="hidden sm:block"><MoonDistCard /></div>
  <ProgressBar />  // ← flex-1 grows to fill remaining width
</div>

// src/hud/ProgressBar.tsx:72 — ProgressBar with flex-1
<div className="... sm:flex-1">  // ← expands to fill all remaining space in flex row

// src/chat/ChatPanel.tsx:46 — ChatPanel fixed over right side
<div className="fixed inset-x-3 sm:inset-x-auto sm:right-6 bottom-20 z-[var(--z-chat)] w-auto sm:w-[360px] ...">
```

### z-index Hierarchy (src/index.css)

```css
--z-hud: 10;        /* HUD base layer */
--z-alerts: 20;
--z-backdrop: 30;
--z-dropdown: 40;
--z-chat: 45;       /* ChatPanel — should be above HUD */
--z-chat-toggle: 50;
--z-tooltip: 55;
```

### Padding Comparison (F2)

```
TelemetryCard: px-2 py-2 sm:px-4 sm:py-3  →  Desktop: 12px vert padding
ProgressBar:   px-3 sm:px-4 py-3           →  Desktop: 12px vert padding (same)

BUT: ProgressBar has 3 content rows vs TelemetryCard's 2 rows
     Extra "Next: {milestone} in {countdown}" line adds ~14-18px height
     sm:items-center on parent causes vertical centering, pushing ProgressBar top above sibling tops
```

### Git Diff Evidence (Session 4 fix removal)

```
Commit 45a73d7: Added sm:mr-16 to ProgressBar (partial overlap fix)
Commit 4534bb6: Removed sm:mr-16 (flagged as "layout artifact" in mobile audit)
```

---

## Impact Assessment

| Metric | Value |
|--------|-------|
| F1: Components affected | 3 (ProgressBar, HUD, ChatPanel) |
| F1: User impact | Chat panel partially or fully obscured by ProgressBar on desktop when chat is open |
| F1: Scope | Desktop only (>=640px). Mobile uses grid layout, not flex-1. |
| F2: Components affected | 2 (ProgressBar, TelemetryCard via HUD layout) |
| F2: User impact | Bottom HUD row appears vertically misaligned; ProgressBar top edge extends above telemetry cards |
| F2: Scope | Desktop primarily. Mobile uses 2-column grid which handles height differences differently. |

---

## Recommended Fixes

### Fix 1: Constrain ProgressBar Max Width on Desktop (HIGH PRIORITY — F1)

Replace `sm:flex-1` (unconstrained growth) with a max-width that leaves room for the ChatPanel zone. The ChatPanel occupies `360px + 24px (right-6) = 384px` on the right side.

```tsx
// ProgressBar.tsx:72 — replace sm:flex-1 with constrained growth
// Option A: max-width approach
className="... sm:flex-1 sm:max-w-[calc(100vw-600px)] ..."
// 600px = ~420px for sibling cards + ~180px reserved for chat area

// Option B (preferred): Add sm:mr-[100px] to create a right margin buffer
// This is more robust than the removed sm:mr-16 because it accounts for the
// chat panel width, not just the chat toggle button
className="... sm:flex-1 sm:mr-[100px] ..."
```

However, both options are fragile. The structural fix is:

**Option C (recommended): Constrain the bottom row container width** by adding `sm:pr-[100px]` to the parent flex container in HUD.tsx, reserving right-side space for the ChatPanel. This prevents ALL bottom-row children from overlapping the chat area, not just ProgressBar.

```tsx
// HUD.tsx:99 — add right padding on desktop to reserve chat area
<div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-3 sm:pr-[100px] pointer-events-auto">
```

The 100px reservation is less than the full 384px ChatPanel width because:
- The chat panel is `bottom-20` (80px from bottom) while the HUD row is at the bottom with `p-4` (16px from bottom)
- They only partially vertically overlap
- The goal is to prevent ProgressBar from physically extending under the chat panel, not to reserve the full chat panel width

**Informed by**: Session 4 commit `45a73d7` (sm:mr-16 approach), improved with correct sizing.

### Fix 2: Normalize ProgressBar Height to Match TelemetryCards (MEDIUM PRIORITY — F2)

Two sub-fixes:

**2a**: Match padding across viewports. ProgressBar uses `py-3` always; should use `py-2 sm:py-3` to match TelemetryCard.

```tsx
// ProgressBar.tsx:72
// Before: py-3
// After: py-2 sm:py-3
```

**2b**: Use `sm:items-end` (or `sm:items-stretch`) instead of `sm:items-center` on the parent flex row so that cards align at their bottom edges rather than centering vertically. Bottom-alignment is more natural for a bottom-of-screen HUD -- all cards share a common baseline.

```tsx
// HUD.tsx:99
// Before: sm:flex sm:items-center
// After: sm:flex sm:items-end
```

Alternatively, `sm:items-stretch` makes all cards the same height (tallest wins), which may look better since all cards share the same glass-morphism style.

**Informed by**: New analysis. Session 4 did not address this because the mobile audit was focused on overflow/collapse, not vertical alignment.

---

## Upstream/Downstream Impact Analysis

### Upstream (Callers)
- `App.tsx` renders `<HUD />` and `<ChatPanel />` as siblings
- Both are overlay components positioned over the `<Scene />` canvas

### Downstream (Called Methods)
- ProgressBar reads from `useMission()` and `useMissionStore`
- TelemetryCard is a pure presentation component
- ChatPanel reads from `useMissionStore` (chatOpen state)

### Cross-Component Dependencies
- F1 fix affects HUD.tsx (container padding) and/or ProgressBar.tsx (max-width)
- F2 fix affects HUD.tsx (flex alignment) and ProgressBar.tsx (padding)
- Both fixes are in the same area and should be implemented together

---

## Verification Plan

1. **F1 verification**: Open chat panel on desktop (>=1024px viewport). Verify ProgressBar does not extend under the ChatPanel. Test at 1280px, 1440px, and 1920px widths.
2. **F1 regression check**: Verify mobile layout (<640px) is unaffected -- grid layout should not be impacted by `sm:` prefixed changes.
3. **F2 verification**: Compare bottom edge alignment of SpeedCard, EarthDistCard, MoonDistCard, and ProgressBar. All should share a common bottom edge.
4. **F2 regression check**: Verify mobile 2-column grid layout still looks correct with updated padding.
5. **Visual check**: Milestone tooltips on ProgressBar should not be clipped by any new max-width constraints.

---

**Investigation Complete**: 2026-04-04 22:15 UTC
**Ready for**: RCA Document / Implementation Fix
