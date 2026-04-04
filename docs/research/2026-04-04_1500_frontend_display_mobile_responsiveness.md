# Research: Frontend Display Issues and Mobile Responsiveness

**Date**: 2026-04-04
**Researcher**: Claude Code
**Status**: Complete

---

## Question

Comprehensive audit of the ARTEMIS frontend for display issues, layout problems, and mobile responsiveness failures. The mobile interface is chaotic -- some elements are not reactive/responsive, creating a cluttered interface that is very difficult to read and understand. Identify all issues and propose concrete fixes.

---

## TL;DR

The ARTEMIS HUD suffers from **15 distinct display and responsiveness issues** across 9 component files. The root cause is a desktop-first design with incomplete mobile adaptation: `sm:` breakpoint modifiers were applied to some properties but not others, fixed-size panels do not scale, and the bottom HUD section stacks 7+ elements vertically on mobile without progressive disclosure. The chat panel uses a hardcoded `w-[360px]` that overflows on screens under 400px. The Space Weather panel, Camera Controls, DSN Status, and Progress Bar all render at full desktop width on mobile, competing for the same viewport space. The fix requires a mobile-first redesign with collapsible HUD sections, container-aware sizing, and a proper information hierarchy that prioritizes the most important data on small screens.

---

## Official Documentation

### Tailwind CSS v4 Responsive Design

Tailwind v4 uses a mobile-first breakpoint system. Unprefixed utilities apply to ALL screen sizes; prefixed utilities (`sm:`, `md:`, `lg:`) apply at that breakpoint **and above**. The default breakpoints are:

| Prefix | Min width | CSS |
|--------|-----------|-----|
| `sm:` | 640px | `@media (min-width: 640px)` |
| `md:` | 768px | `@media (min-width: 768px)` |
| `lg:` | 1024px | `@media (min-width: 1024px)` |
| `xl:` | 1280px | `@media (min-width: 1280px)` |

> "Don't use sm: to target mobile devices. Use unprefixed utilities to target mobile, and override them at larger breakpoints."
> -- Source: [Tailwind CSS Responsive Design](https://tailwindcss.com/docs/responsive-design)

### Tailwind v4 Container Queries (Native)

Tailwind v4 ships native container queries -- no plugin required. Container queries let components respond to their **parent container's** dimensions instead of the viewport. Key syntax:

- Mark parent: `@container`
- Query children: `@sm:`, `@md:`, `@lg:` (note: container breakpoints are smaller than viewport breakpoints -- `@md` = 448px vs `md:` = 768px)
- Container query units: `cqw`, `cqh` for proportional sizing

> "Container queries fix the fundamental flaw of media queries: they respond to the space a component actually occupies, not the browser window."
> -- Source: [Tailwind CSS v4 Container Queries](https://www.sitepoint.com/tailwind-css-v4-container-queries-modern-layouts/)

### React Three Fiber Mobile

R3F's `OrbitControls` supports touch via the `touches` prop. The ARTEMIS project already configures one-finger pan and two-finger dolly-rotate on mobile. The 3D scene itself is responsive (fills `inset: 0`).

---

## Community Knowledge

### Progressive Disclosure for Data-Dense Mobile UIs

> "Progressive disclosure defers advanced or rarely used features to a secondary screen, making applications easier to learn and less error-prone."
> -- Source: [NN/g Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)

For mission tracker HUDs specifically:
- Show primary telemetry (speed, distance, clock) always visible
- Collapse secondary data (DSN status, space weather, camera presets) behind tap-to-expand affordances
- Use accordions/dropdowns to reveal detail without cluttering the primary view

### Fixed Position Elements on Mobile

> "Overusing fixed elements leads to cluttered interfaces. Limit sticky elements to essential UI components and ensure they do not obstruct primary content."
> -- Source: [Handling Fixed and Sticky Elements in Responsive Layouts](https://medium.com/@Adekola_Olawale/handling-fixed-and-sticky-elements-in-responsive-layouts-7a79a70a014b)

### Common Pitfalls Mentioned
- Hardcoded `px` widths on fixed-position elements overflow viewport on narrow screens
- `flex-wrap` without `max-width` constraints causes elements to wrap unpredictably
- `z-index` stacking without a coherent system causes overlay fights between panels
- Touch targets under 44x44px are too small for reliable mobile interaction

---

## Detailed Issue Inventory

### ISSUE 1: Chat Panel Fixed Width Overflow (Critical -- ChatPanel.tsx:46)

**Problem**: The chat panel uses `w-[360px]` -- a hardcoded width that exceeds the viewport on any device under 400px wide (all phones in portrait mode have only ~375px usable width after accounting for right-6 offset).

```
className="fixed right-6 bottom-20 z-40 w-[360px] h-[500px] ..."
```

On a 375px-wide phone:
- Panel = 360px + right-6 (24px) = 384px needed
- Available = 375px
- **Result**: Panel overflows 9px off the left edge, input and messages are clipped

**Fix**: Replace fixed dimensions with responsive sizing:
```
className="fixed inset-x-3 sm:inset-x-auto sm:right-6 bottom-20 z-40 sm:w-[360px] h-[70vh] sm:h-[500px] max-h-[calc(100vh-6rem)] ..."
```

---

### ISSUE 2: Chat Toggle Button Overlap with HUD (Medium -- ChatPanel.tsx:30)

**Problem**: The chat toggle button is `fixed bottom-6 right-6`. On mobile, the bottom HUD elements (telemetry cards, progress bar) extend to the right side, and the chat button overlaps with them. Both have `pointer-events-auto`, creating a tap conflict zone.

**Fix**: On mobile, move the chat button above the bottom HUD:
```
className="fixed bottom-[calc(theme(spacing.2)+200px)] sm:bottom-6 right-3 sm:right-6 z-50 ..."
```
Or: give the HUD bottom section a right margin to leave room for the chat button.

---

### ISSUE 3: Bottom HUD Vertical Stack Chaos (Critical -- HUD.tsx:69-82)

**Problem**: The bottom section contains **7 distinct elements** that stack vertically on mobile:
1. DSN Status (row of 3 stations)
2. Space Weather Panel (row of 4 indicators + container background)
3. Camera Controls (row of 4 buttons)
4. Speed Card
5. Earth Distance Card
6. Moon Distance Card
7. Progress Bar (spanning 2 columns)

On mobile (`flex-col`), these stack into a ~350px tall column that covers the bottom half of the screen, obscuring the 3D scene almost entirely. The `flex-col sm:flex-row` on line 70 puts DSN, Weather, and Camera each on their own full-width row.

**Fix -- Progressive Disclosure Strategy**:
- **Always visible** (mobile): Mission Clock, Speed, Earth Dist, Progress Bar (4 items)
- **Collapsed by default** (mobile): DSN Status, Space Weather, Camera Controls, Moon Distance
- Add a "More" toggle button that expands the secondary telemetry
- On desktop (`sm:` and above): show everything as today

---

### ISSUE 4: Space Weather Panel Does Not Collapse on Mobile (High -- SpaceWeatherPanel.tsx:93)

**Problem**: `flex-wrap` on the container means indicators wrap to multiple lines on narrow screens, but the panel still shows all 4 data points + labels in a wide boxed container. On a 375px screen, this panel alone is ~320px wide and ~80px tall (two rows when wrapped).

```
className="relative flex items-center gap-3 flex-wrap bg-[rgba(10,10,30,0.7)] ... rounded-lg px-3 py-2"
```

**Fix**: On mobile, collapse to a single compact indicator (e.g., just the Kp dot + value) with tap-to-expand. Or hide entirely behind the "More" toggle from Issue 3.

---

### ISSUE 5: Camera Controls Not Responsive (Medium -- CameraControls.tsx:16)

**Problem**: The camera controls render all 4 buttons in a horizontal row with no responsive adaptation:
```
className="flex items-center gap-2"
```

On mobile, these 4 buttons (each ~90px with padding and text) total ~380px, which overflows a 375px viewport. They lack any `sm:` breakpoint modifications.

**Fix Options**:
A. Abbreviate labels on mobile: "Follow" / "Earth" / "Moon" / "Free" instead of "Follow Orion" / "Earth View" / "Moon View" / "Free"
B. Collapse into a dropdown/select on mobile
C. Show icons instead of text on mobile
D. Move behind the "More" toggle -- camera is secondary; most mobile users just want to observe the default view

---

### ISSUE 6: DSN Status Lacks Mobile Adaptation (Low -- DSNStatus.tsx:32)

**Problem**: `flex items-center gap-3` with no breakpoint modifiers. On mobile, "DSN" label + 3 station indicators (~220px total) fits on most phones, but contributes to the overall bottom HUD clutter. When stacked vertically (via HUD.tsx flex-col), each secondary panel takes a full row.

**Fix**: Consolidate into a single status dot on mobile (green if any station is active, gray if none). Tap to see detail.

---

### ISSUE 7: Progress Bar min-width Conflict (Medium -- ProgressBar.tsx:72)

**Problem**: The progress bar uses `min-w-[200px] sm:min-w-[420px]` and `col-span-2 sm:col-span-1`. On mobile in the 2-column grid, `col-span-2` makes it span both columns (full width), which is correct. But the `sm:mr-16` adds a right margin on desktop that pushes content, and the milestone tooltips (`min-w-[180px] max-w-[240px]`) can overflow the progress bar container on narrow screens.

**Fix**: Remove `sm:mr-16` (artifact from an older layout). Constrain tooltip positioning to account for mobile viewport edges. Use `max-w-[calc(100vw-2rem)]` on the tooltip to prevent viewport overflow.

---

### ISSUE 8: Milestone Tooltips Overflow on Mobile (Medium -- ProgressBar.tsx:126)

**Problem**: Progress bar milestone tooltips are `absolute` positioned with `min-w-[180px]`. On mobile, when the milestone dot is near the left or right edge, the tooltip extends beyond the screen. The position logic (`m.position < 10 ? 'left-0' : m.position > 90 ? 'right-0' : 'left-1/2 -translate-x-1/2'`) only handles extreme edges, not the general case on a narrow screen.

**Fix**: On mobile, show milestone info in a bottom sheet or inline text instead of a floating tooltip. Or: add `max-w-[calc(100vw-2rem)]` and adjust positioning thresholds for mobile.

---

### ISSUE 9: Mission Events Panel Width Is Hardcoded (Low -- MissionEventsPanel.tsx:103)

**Problem**: `w-[320px]` is fixed regardless of viewport size. On a 375px phone with `right-0` positioning, the panel overflows 10-15px beyond the left viewport edge (320px + padding + border > remaining space from right edge).

**Fix**: `w-[calc(100vw-1.5rem)] sm:w-[320px]` or `max-w-[calc(100vw-1.5rem)]`.

---

### ISSUE 10: Crew Panel Width Is Too Narrow on Mobile (Low -- CrewPanel.tsx:22)

**Problem**: `min-w-[200px]` is appropriate, but positioning `absolute top-full mt-2 left-0` means it drops below the title bar and overlaps with the 3D scene. On mobile, the panel's z-index (40) correctly stacks above the scene but the click-outside overlay (`fixed inset-0 z-30`) may interfere with the 3D canvas touch interactions.

**Fix**: On mobile, render as a bottom sheet instead of a dropdown. Or: increase the overlay z-index to fully capture touch events during the open state.

---

### ISSUE 11: Telemetry Card Text Truncation Risk (Low -- TelemetryCard.tsx:23)

**Problem**: `min-w-0` on mobile (via `min-w-0 sm:min-w-[140px]`) means the card can shrink to any width in the grid. Large numbers like "384,400" (Moon distance in km) can overflow or wrap awkwardly if the grid cell is too narrow. The `text-sm` font size for values is adequate but the card has no `overflow-hidden` or `text-ellipsis`.

**Fix**: Add `overflow-hidden` and ensure minimum width of ~100px on mobile: `min-w-[100px] sm:min-w-[140px]`. Use `tabular-nums` for number alignment stability.

---

### ISSUE 12: Touch Targets Too Small for Mobile (Medium -- Multiple Files)

**Problem**: Several interactive elements are below the 44x44px minimum recommended touch target:
- Crew button: `px-1.5 py-0.5` = ~24x20px (HUD.tsx:48-58)
- Mission Events hamburger: `px-2 py-1.5` = ~34x30px (MissionEventsPanel.tsx:74-89)
- Camera buttons: `px-3 py-1.5` = adequate width but ~30px height (CameraControls.tsx:21)
- Alert dismiss button: text-only "x" = ~16x16px (AlertItem.tsx:62-66)
- Milestone dots: `w-1.5 h-1.5 sm:w-[6px] sm:h-[6px]` = 6x6px target (ProgressBar.tsx:97-116)

**Fix**: Add touch padding with `min-h-[44px] min-w-[44px]` or use invisible hit areas (`p-3` around icons). For milestone dots, expand the touch target with a transparent padding div.

---

### ISSUE 13: z-index Stacking Chaos (Medium -- Multiple Files)

**Problem**: The z-index hierarchy is fragmented across files with no documented system:
- HUD container: z-10
- AlertsBanner: z-20
- Click-outside overlays: z-30
- CrewPanel / MissionEventsPanel: z-40
- Milestone tooltips: z-50
- Chat toggle button: z-50
- Chat panel: z-40
- CameraDebug: z-9999

The chat button (z-50) and milestone tooltips (z-50) are at the same level. The chat panel (z-40) is at the same level as dropdown panels. If both the chat and a dropdown are open simultaneously, they compete for visual priority.

**Fix**: Establish a documented z-index scale:
```
z-10  -- HUD base layer
z-20  -- Alerts banner
z-30  -- Click-outside backdrops
z-40  -- Dropdown panels (Crew, Events, Weather tooltips)
z-50  -- Chat panel
z-60  -- Chat toggle button
z-70  -- Milestone tooltips (above chat since they're transient)
z-9999 -- Debug overlay (dev only)
```

---

### ISSUE 14: No `safe-area-inset` Support for Notched Devices (Low -- index.css, HUD.tsx)

**Problem**: iPhones with notches and dynamic islands have safe area insets that cut into the viewport. The HUD uses `p-2 sm:p-4` padding, which does not account for notch areas. Elements near the top and bottom edges can be obscured.

**Fix**: Add `env(safe-area-inset-*)` support:
```css
#root {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
```
And update index.html:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

---

### ISSUE 15: Body `overflow: hidden` Prevents Scroll Recovery (Low -- index.css:18)

**Problem**: `overflow: hidden` on body is correct for a full-viewport 3D app, but on mobile browsers with dynamic toolbars (Chrome, Safari), the viewport height changes as the URL bar appears/disappears. Combined with `height: 100vh` on `#root`, this can cause the HUD bottom elements to jump or be hidden behind the mobile browser's bottom toolbar.

**Fix**: Use `100dvh` (dynamic viewport height) instead of `100vh`:
```css
#root {
  width: 100vw;
  height: 100dvh;
}
```

---

## Best Practices

Based on research:

1. **Mobile-First with Progressive Disclosure**: Design the mobile layout first with only essential data visible (clock, speed, distance, progress). Reveal secondary data (DSN, weather, cameras) through deliberate user interaction. Override on desktop to show everything.

2. **Container Queries for HUD Panels**: Use Tailwind v4's native `@container` queries so HUD panels adapt to their available space rather than the viewport. This handles the case where the chat panel is open and squeezes the HUD.

3. **Dynamic Viewport Units**: Replace `100vh` with `100dvh` to handle mobile browser toolbar dynamics. Use `env(safe-area-inset-*)` for notched devices.

4. **44px Minimum Touch Targets**: Every interactive element must have at least 44x44px of tappable area. Use transparent padding if the visual element is smaller.

5. **Coherent z-index Scale**: Define the stacking hierarchy in one place (CSS custom properties or a constants file) and reference it consistently.

6. **Fluid Sizing Over Fixed Sizing**: Replace hardcoded `w-[360px]`, `w-[320px]`, `min-w-[420px]` with responsive alternatives that use `calc()`, `min()`, `max()`, or `clamp()` to respect viewport bounds.

---

## Relevance to Our Codebase

This research directly addresses the mobile display chaos reported during Session 4. The issues are concentrated in 9 files:

### Files That Must Be Modified

| File | Issues | Priority |
|------|--------|----------|
| `src/hud/HUD.tsx` | #3 (bottom stack chaos), #12 (touch targets) | **Critical** |
| `src/chat/ChatPanel.tsx` | #1 (overflow), #2 (overlap) | **Critical** |
| `src/hud/SpaceWeatherPanel.tsx` | #4 (no collapse) | **High** |
| `src/hud/CameraControls.tsx` | #5 (no responsive), #12 (touch) | **Medium** |
| `src/hud/ProgressBar.tsx` | #7 (min-width), #8 (tooltip overflow) | **Medium** |
| `src/hud/MissionEventsPanel.tsx` | #9 (width overflow) | **Low** |
| `src/hud/DSNStatus.tsx` | #6 (no mobile adaptation) | **Low** |
| `src/hud/TelemetryCard.tsx` | #11 (truncation risk) | **Low** |
| `src/index.css` | #14 (safe-area), #15 (dvh) | **Low** |

### Files That May Be Modified
- `src/hud/CrewPanel.tsx` (#10 -- positioning)
- `src/hud/AlertItem.tsx` (#12 -- touch targets)
- `index.html` (#14 -- viewport-fit meta)

---

## Implementation Analysis

### Already Implemented

The codebase already has some mobile adaptations in place:

- **CameraController `useIsMobile()`**: `src/components/CameraController.tsx:9-18` -- Detects mobile via `window.innerWidth < 768` for 3D camera distance adjustments
- **Touch controls**: `src/components/CameraController.tsx:250-253` -- One-finger pan, two-finger dolly-rotate on mobile
- **Partial `sm:` breakpoints**: Applied to HUD.tsx, TelemetryCard, MissionClock, ProgressBar, AlertsBanner for basic size adjustments
- **2-column grid on mobile**: `src/hud/HUD.tsx:76` -- `grid grid-cols-2 sm:flex` for telemetry cards

### Should Implement

1. **Mobile HUD Reorganization (Issues #3, #4, #5, #6)**
   - Why: The bottom HUD is the primary source of mobile chaos -- 7 elements stacking vertically covers half the screen
   - Where: `src/hud/HUD.tsx`, new `src/hud/MobileHUD.tsx` or conditional rendering in HUD
   - How: Progressive disclosure pattern -- show 4 primary telemetry items, collapse secondary behind a toggle. Use `md:` breakpoint as the toggle threshold.

2. **Chat Panel Responsive Sizing (Issues #1, #2)**
   - Why: Panel literally overflows the viewport on all standard phones
   - Where: `src/chat/ChatPanel.tsx`
   - How: Replace `w-[360px] h-[500px]` with `w-[calc(100vw-1.5rem)] sm:w-[360px] h-[70vh] sm:h-[500px]`. On mobile, make it full-width with small margins.

3. **Dynamic Viewport Height (Issue #15)**
   - Why: Mobile browser toolbar dynamics cause layout jumps
   - Where: `src/index.css`
   - How: `height: 100dvh` on `#root`, with `100vh` fallback

4. **Touch Target Enlargement (Issue #12)**
   - Why: Multiple buttons are below the 44px minimum for reliable touch interaction
   - Where: Multiple files (HUD.tsx crew button, MissionEventsPanel hamburger, CameraControls buttons, AlertItem dismiss)
   - How: Add padding/min-height to interactive elements on mobile

5. **z-index Rationalization (Issue #13)**
   - Why: Fragmented z-indices cause panel overlap conflicts
   - Where: CSS custom properties in `src/index.css`, referenced from all overlay components
   - How: Define `--z-hud: 10; --z-alerts: 20; --z-backdrop: 30; --z-dropdown: 40; --z-chat: 50; --z-chat-toggle: 60;` and use via Tailwind `z-[var(--z-chat)]`

6. **Panel Width Clamping (Issues #7, #9)**
   - Why: Hardcoded widths overflow on mobile
   - Where: `ProgressBar.tsx`, `MissionEventsPanel.tsx`
   - How: Use `max-w-[calc(100vw-1.5rem)]` as a safety constraint on all positioned panels

7. **Safe Area Insets (Issue #14)**
   - Why: Notched iPhones clip HUD elements
   - Where: `index.html`, `src/index.css`
   - How: `viewport-fit=cover` + `env(safe-area-inset-*)` padding

### Should NOT Implement

1. **Separate Mobile App / Completely Different Layout**
   - Why not: The existing layout is fundamentally sound for desktop. The issues are all solvable with responsive adaptation of the current component structure. A separate mobile layout would double the maintenance surface.

2. **Container Queries for All HUD Components**
   - Why not: While Tailwind v4 supports native container queries, the HUD components are all direct children of a full-viewport container. Container queries would not provide significantly different behavior from viewport breakpoints in this layout. They would add complexity without material benefit for this specific use case.

3. **Removing Elements on Mobile**
   - Why not: Users on mobile deserve access to all the data. The solution is progressive disclosure (hide behind a tap), not removal. Every piece of data should remain accessible, just not all visible simultaneously.

---

## Recommended Implementation Priority

### Phase 1: Critical Fixes (eliminates overflow and chaos)
1. ChatPanel responsive sizing (#1, #2)
2. HUD bottom section reorganization with progressive disclosure (#3)
3. Dynamic viewport height (#15)

### Phase 2: Mobile Refinement (polishes the experience)
4. Space Weather collapse on mobile (#4)
5. Camera Controls responsive adaptation (#5)
6. Touch target enlargement (#12)
7. Panel width clamping (#7, #9)

### Phase 3: Polish
8. z-index rationalization (#13)
9. Safe area insets (#14)
10. DSN compact mode (#6)
11. Tooltip overflow fixes (#8)
12. Telemetry card number formatting (#11)
13. Crew panel positioning (#10)

---

## Sources

1. [Tailwind CSS Responsive Design](https://tailwindcss.com/docs/responsive-design) -- Official Tailwind v4 responsive design documentation
2. [Tailwind CSS v4 Container Queries](https://www.sitepoint.com/tailwind-css-v4-container-queries-modern-layouts/) -- Container query syntax and usage in Tailwind v4
3. [NN/g Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) -- UX pattern for managing information density
4. [Handling Fixed and Sticky Elements in Responsive Layouts](https://medium.com/@Adekola_Olawale/handling-fixed-and-sticky-elements-in-responsive-layouts-7a79a70a014b) -- Mobile fixed-position best practices
5. [Responsive Web Design Best Practices in 2026](https://www.blushush.co.uk/blogs/responsive-web-design-best-practices-in-2026) -- Current responsive design strategies
6. [React Three Fiber Responsiveness Discussion](https://github.com/pmndrs/react-three-fiber/discussions/647) -- Making 3D objects responsive
7. [Progressive Disclosure for Responsive Websites](https://www.justinmind.com/ux-design/progressive-disclosure) -- Implementation patterns for responsive UIs
8. [Tailwind CSS Best Practices 2025-2026](https://www.frontendtools.tech/blog/tailwind-css-best-practices-design-system-patterns) -- Design tokens and system patterns

---

## Related Documents

- [Post-MVP Visual & Data Features Tracker](../findings/2026-04-04_1201_post_mvp_visual_data_features_FINDINGS_TRACKER.md) -- Parent tracker for F1-F3 (bloom, timeline, weather)
- [Post-MVP Review Warnings Tracker](../findings/2026-04-04_1245_post_mvp_review_warnings_FINDINGS_TRACKER.md) -- F1-F6 code quality issues in weather/alerts layer
- [Camera UX Refinement Tracker](../findings/2026-04-03_1958_camera_ux_refinement_FINDINGS_TRACKER.md) -- Camera preset visual issues
- [Security & Quality Tracker](../findings/2026-04-03_2140_chatbot_security_quality_FINDINGS_TRACKER.md) -- F1-F10 all verified

---

**Research Complete**: 2026-04-04 15:00 UTC
