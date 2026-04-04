# Design Analysis: Mobile-First HUD Reorganization with Progressive Disclosure

**Date**: 2026-04-04 18:55 UTC
**Analyst**: Claude Code (Session 4)
**Mode**: Tradeoff (from-scratch)
**Finding**: F1-F15 in Frontend Display & Mobile Responsiveness tracker
**Interactive Checkpoints**: 1 (quick mode — research pre-validated)

---

## Executive Summary

The ARTEMIS HUD has 15 display/responsiveness issues rooted in desktop-first design with incomplete mobile adaptation. The recommended approach is **Progressive Disclosure**: show only essential telemetry (clock, speed, Earth distance, progress bar) on mobile, collapse secondary data (DSN, Space Weather, Camera, Moon distance) behind a "More" toggle. Desktop layout is unchanged. This fixes the two Critical issues (chat overflow, HUD stack chaos) while addressing all 15 findings across 3 implementation phases.

---

## User Context

- **Goal**: Fix mobile chaos — 7 HUD elements stacking vertically, panels overflowing viewport
- **Constraints**: Must maintain desktop layout, no new dependencies, mobile-first Tailwind approach
- **Priorities**: Mobile usability > Desktop parity > Simplicity > Time
- **Selected approach**: Progressive Disclosure (CP1 selection)

---

## Current State Analysis

### Layout Structure (HUD.tsx)

```
Mobile (<640px):
┌───────────────────────────┐
│ ARTEMIS II  👥 ☰  M+02:... │  ← top bar (OK)
│                             │
│ [DSN row - full width]      │  ← flex-col stacks these
│ [Space Weather - full width]│     vertically = CHAOS
│ [Camera 4 btns - overflow]  │
│ [Speed] [Earth]             │  ← 2-col grid
│ [Moon]  [Progress ~~~~~~~~] │
│                         [💬]│  ← chat overlaps
└───────────────────────────┘
Total bottom HUD height: ~350px (covers half the screen)
```

### Key Problems Identified

| Problem | File | Root Cause |
|---------|------|-----------|
| Chat panel `w-[360px]` overflows 375px phones | ChatPanel.tsx:46 | Hardcoded width |
| 7 elements stack vertically on mobile | HUD.tsx:69-82 | `flex-col` without collapse |
| Camera buttons ~380px total, overflow viewport | CameraControls.tsx:16 | No responsive classes |
| Space Weather ~320px wide, no collapse | SpaceWeatherPanel.tsx:93 | No mobile adaptation |
| Chat button overlaps telemetry | ChatPanel.tsx:30 | `fixed bottom-6 right-6` |
| `100vh` not dynamic on mobile browsers | index.css:26 | Missing `dvh` |
| No safe-area-inset for notched phones | index.html | Missing `viewport-fit=cover` |
| Touch targets 6-24px (min should be 44px) | Multiple | No padding for touch |
| z-index 50 conflict (chat + tooltips) | Multiple | No z-index system |

### Desktop Layout (unchanged by this design)

Desktop (`sm:` 640px+) works well:
- Top bar: title + crew + events + clock (horizontal)
- Bottom row 1: DSN | Space Weather | Camera (horizontal, space-between)
- Bottom row 2: Speed | Earth | Moon | Progress (flex row)

---

## External Research (2026 Sources)

1. **Headless UI Disclosure** — provides accessible show/hide components for React. DisclosureButton + DisclosurePanel pattern. We already have Framer Motion's AnimatePresence which achieves the same with better animation control.

2. **NN/g Progressive Disclosure** — "Defer advanced or rarely used features to a secondary screen." For mission trackers: show primary telemetry always, collapse secondary data behind deliberate user interaction.

3. **Framer Motion Layout Animations** — `layout` prop on `motion.div` auto-animates size/position changes. Ideal for expand/collapse transitions without manual height calculations.

4. **Tailwind v4 Mobile-First** — "Use unprefixed utilities to target mobile, override at larger breakpoints." Current codebase partially follows this but inconsistently.

5. **Mobile Dashboard Best Practices (2026)** — Hide non-essential content behind menus, switch to single column, increase line height, make buttons larger (44px minimum touch target).

---

## Options Analysis

### Option A: Progressive Disclosure (SELECTED)

**How it works**: On mobile (<640px), the bottom HUD shows only 3 essential elements: Speed card, Earth Distance card, and Progress Bar. A "More" chevron button expands a collapsible section with Moon Distance, DSN, Space Weather, and Camera Controls. Desktop is unchanged.

**Implementation**:
- Add `hidden sm:flex` to the DSN/Weather/Camera row in HUD.tsx
- Create a mobile-only expand/collapse toggle below the telemetry grid
- When expanded, show DSN + Weather + Camera + Moon card in a compact column
- Chat panel: `w-[calc(100vw-1.5rem)] sm:w-[360px]`, `h-[70vh] sm:h-[500px]`
- Fix `100vh` → `100dvh`, add `viewport-fit=cover`
- Enlarge touch targets on mobile

**Pros**:
- Maximum 3D scene visibility on mobile (only ~120px of HUD at bottom)
- All data still accessible (one tap to reveal)
- Desktop completely unchanged
- Aligns with NN/g progressive disclosure research
- Lowest implementation effort of the non-trivial options

**Cons**:
- Secondary data requires an extra tap to access
- Users might not discover the "More" toggle initially

**Effort**: ~12 files modified, ~200 lines changed
**Risk**: Low — additive mobile classes, no desktop changes

---

### Option B: Compact Cards

**How it works**: All 7 elements remain visible on mobile but are dramatically compressed — abbreviated labels, icon-only buttons, tiny text, and compact indicators.

**Pros**: Everything visible without interaction
**Cons**: Very dense, hard to read, still covers significant screen area (~250px), touch targets remain small
**Effort**: ~10 files, ~150 lines
**Risk**: Low

---

### Option C: Bottom Sheet

**How it works**: All HUD data moves into a swipeable bottom sheet. Only the progress bar peeks at the bottom. Swipe up to see full telemetry.

**Pros**: Maximum 3D scene visibility, familiar mobile pattern (Maps, Uber)
**Cons**: Requires swipe gesture implementation (new dependency or complex Framer Motion), telemetry not glanceable without interaction, significant departure from current UI
**Effort**: ~15 files, ~400 lines, possible new dependency
**Risk**: Medium — gesture handling, touch conflict with 3D canvas

---

### Baseline: Current Layout

**Pros**: Desktop works well
**Cons**: Mobile is nearly unusable — 15 documented issues, chat overflows, HUD covers half the screen
**Score**: 2/10 on mobile

---

## Trade-Off Matrix

| Criterion | Weight | Option A (Progressive) | Option B (Compact) | Option C (Sheet) | Current |
|-----------|--------|----------------------|-------------------|-----------------|---------|
| Mobile usability | 40% | 9 | 5 | 8 | 2 |
| Desktop parity | 20% | 10 | 10 | 7 | 10 |
| Simplicity | 25% | 8 | 7 | 4 | 10 |
| Time to implement | 15% | 8 | 8 | 4 | 10 |
| **Weighted** | | **8.85** | **7.05** | **6.05** | **6.50** |

---

## Recommendation

**Option A: Progressive Disclosure** (score 8.85/10)

- Gains: Mobile usability jumps from 2 to 9, maximum 3D scene visibility, all data one tap away
- Trade-off: Secondary data hidden behind toggle on mobile (acceptable — NN/g validated pattern)
- Desktop: Zero changes

---

## Impact Assessment

### Files to Change (12 files, ~200 lines)

**Phase 1 — Critical (F1, F2, F15)**:
| File | Changes |
|------|---------|
| `src/hud/HUD.tsx` | Add mobile collapse logic, `hidden sm:flex` on secondary row, mobile "More" toggle |
| `src/chat/ChatPanel.tsx` | Responsive width/height: `w-[calc(100vw-1.5rem)] sm:w-[360px]` |
| `src/index.css` | `100vh` → `100dvh` with fallback |
| `index.html` | Add `viewport-fit=cover` to viewport meta |

**Phase 2 — Refinement (F3, F5, F6, F7, F8)**:
| File | Changes |
|------|---------|
| `src/hud/SpaceWeatherPanel.tsx` | Compact mode for mobile (single Kp indicator) |
| `src/hud/CameraControls.tsx` | Abbreviated labels or icon-only on mobile |
| `src/hud/ProgressBar.tsx` | Remove `sm:mr-16`, clamp tooltip to viewport |
| `src/hud/MissionEventsPanel.tsx` | `max-w-[calc(100vw-1.5rem)]` |
| `src/hud/AlertItem.tsx` | Enlarge dismiss button touch target |

**Phase 3 — Polish (F4, F9, F10, F11, F12, F13, F14)**:
| File | Changes |
|------|---------|
| `src/hud/DSNStatus.tsx` | Compact single-dot mode on mobile |
| `src/hud/TelemetryCard.tsx` | `overflow-hidden`, `tabular-nums` |
| `src/hud/CrewPanel.tsx` | Mobile bottom-sheet positioning |
| `src/index.css` | z-index CSS custom properties, safe-area-inset padding |

### Dependencies
- No new npm dependencies
- Uses existing Framer Motion AnimatePresence for expand/collapse
- Uses existing Tailwind v4 responsive utilities

### Breaking Changes
- None — all changes are additive mobile CSS classes

---

## Implementation Sketch

### Mobile HUD Layout (Progressive Disclosure)

```tsx
// HUD.tsx — mobile collapse logic
export default function HUD() {
  const [crewOpen, setCrewOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2 sm:p-4 z-10">
      <WeatherAlertDriver />
      
      {/* Top bar — unchanged */}
      <div className="flex items-center justify-between pointer-events-auto">
        ...
      </div>

      {/* Bottom section */}
      <div className="flex flex-col gap-2 sm:gap-3">
        {/* Secondary row — hidden on mobile, visible on desktop */}
        <div className="hidden sm:flex items-center justify-between gap-2 pointer-events-auto">
          <DSNStatus />
          <SpaceWeatherPanel />
          <CameraControls />
        </div>

        {/* Mobile "More" expandable section */}
        <AnimatePresence>
          {moreOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="sm:hidden flex flex-col gap-2 overflow-hidden pointer-events-auto"
            >
              <MoonDistCard />
              <DSNStatus />
              <SpaceWeatherPanel />
              <CameraControls />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Primary telemetry — always visible */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-3 pointer-events-auto">
          <SpeedCard />
          <EarthDistCard />
          {/* Moon card: hidden on mobile (in "More"), visible on desktop */}
          <div className="hidden sm:block"><MoonDistCard /></div>
          <ProgressBar />
          {/* Mobile "More" toggle */}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className="sm:hidden col-span-2 flex items-center justify-center gap-1 py-2 text-[10px] text-gray-400 pointer-events-auto"
          >
            {moreOpen ? '▲ Less' : '▼ More telemetry'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Chat Panel Responsive Sizing

```tsx
// ChatPanel.tsx — replace fixed dimensions
className="fixed inset-x-3 sm:inset-x-auto sm:right-6 bottom-16 sm:bottom-20 z-40
           w-auto sm:w-[360px] h-[70vh] sm:h-[500px] max-h-[calc(100dvh-5rem)] ..."
```

### Dynamic Viewport + Safe Area

```css
/* index.css */
#root {
  width: 100vw;
  height: 100dvh;
  height: 100vh; /* fallback */
}
```

```html
<!-- index.html -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

### z-index System (CSS Custom Properties)

```css
@theme {
  --z-hud: 10;
  --z-backdrop: 30;
  --z-dropdown: 40;
  --z-chat: 45;
  --z-chat-toggle: 50;
  --z-tooltip: 55;
}
```

---

## Risks & Mitigations

| Risk | L | I | Mitigation |
|------|---|---|------------|
| Users don't find "More" toggle | M | M | Clear chevron affordance, subtle pulse on first visit |
| AnimatePresence height animation jank | L | L | Use `layout` prop, test on low-end devices |
| Chat panel responsive sizing breaks on tablets | L | M | Test at 640px, 768px, 1024px breakpoints |
| Safe-area-inset not supported on older browsers | L | L | Graceful degradation — falls back to standard padding |

---

## Sources

- [Headless UI Disclosure](https://headlessui.com/react/disclosure) — Accessible show/hide components
- [NN/g Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) — UX pattern validation
- [Framer Motion Layout Animations](https://www.framer.com/motion/layout-animations/) — Auto-animate size changes
- [Tailwind CSS Responsive Design](https://tailwindcss.com/docs/responsive-design) — Mobile-first breakpoint system
- [Framer Responsive Breakpoints 2026](https://www.framer.com/blog/responsive-breakpoints/) — Current breakpoint best practices
- `docs/research/2026-04-04_1500_frontend_display_mobile_responsiveness.md` — Internal research (15 issues)
- `docs/findings/2026-04-04_1855_frontend_display_mobile_responsiveness_FINDINGS_TRACKER.md` — Tracker (F1-F15)

---

**Analysis Complete**: 2026-04-04 18:55 UTC
