# Implementation Plan: Mobile-First HUD Progressive Disclosure (F1-F15)

## Context

The ARTEMIS HUD has 15 display/responsiveness issues making mobile nearly unusable — chat panel overflows viewport, 7 HUD elements stack covering half the screen, panels have hardcoded widths. The fix: Progressive Disclosure on mobile (show essential telemetry, collapse secondary behind a toggle). Desktop unchanged.

**Prompt**: `docs/prompts/2026-04-04_1900_mobile_first_hud_progressive_disclosure.md`
**Tracker**: `docs/findings/2026-04-04_1855_frontend_display_mobile_responsiveness_FINDINGS_TRACKER.md`

---

## Phase 1 — Critical (F1, F2, F15)

### 1.1 Dynamic viewport height + viewport-fit
- `src/index.css`: `#root { height: 100vh; height: 100dvh; }` (dvh overrides vh where supported)
- `index.html`: Add `viewport-fit=cover` to viewport meta tag

### 1.2 Chat panel responsive sizing (F1)
- `src/chat/ChatPanel.tsx` line 30: `right-6` → `right-3 sm:right-6`
- `src/chat/ChatPanel.tsx` line 46: Replace `w-[360px] h-[500px]` with `inset-x-3 sm:inset-x-auto sm:right-6 w-auto sm:w-[360px] h-[70dvh] sm:h-[500px] max-h-[calc(100dvh-6rem)]`

### 1.3 HUD progressive disclosure (F2)
- `src/hud/HUD.tsx`: Add `import { AnimatePresence, motion } from 'framer-motion'`
- Add `moreOpen` state + `toggleMore` callback
- Secondary row (DSN/Weather/Camera): `hidden sm:flex` — desktop only
- New `AnimatePresence` mobile expand section (`sm:hidden`) showing MoonDistCard, DSN, Weather, Camera
- MoonDistCard in primary grid: `hidden sm:block` wrapper
- "More telemetry" toggle button: `sm:hidden` with chevron SVG

**Verify**: `npm run build` + Chrome DevTools 375px

---

## Phase 2 — Refinement (F3, F5, F6, F7, F8)

### 2.1 SpaceWeather compact (F3)
- `src/hud/SpaceWeatherPanel.tsx`: Reduce gap/padding on mobile. Hide Solar Wind and Source badge on mobile: `hidden sm:flex`

### 2.2 Camera controls responsive (F5)
- `src/hud/CameraControls.tsx`: Add `shortLabel` to PRESETS. Show short labels on mobile (`sm:hidden`), full labels on desktop (`hidden sm:inline`). Reduce padding, add `min-h-[36px]` for touch, `flex-wrap`

### 2.3 ProgressBar fixes (F6, F7)
- `src/hud/ProgressBar.tsx`: Remove `sm:mr-16`, change `min-w-[200px]` to `min-w-0 sm:min-w-[420px]`. Tooltip: `min-w-[140px] sm:min-w-[180px] max-w-[calc(100vw-2rem)]`, widen edge thresholds to 20/80. Milestone dot touch targets: add `p-2 -m-2`

### 2.4 Touch targets (F8)
- `src/hud/HUD.tsx` crew button: `px-2 py-2 sm:px-1.5 sm:py-0.5`
- `src/hud/MissionEventsPanel.tsx` hamburger: `px-2.5 py-2.5 sm:px-2 sm:py-1.5`
- `src/hud/AlertItem.tsx` dismiss: `min-w-[44px] min-h-[44px] flex items-center justify-center`

**Verify**: `npm run build` + Chrome DevTools 375px

---

## Phase 3 — Polish (F4, F9, F10, F11, F12, F13, F14)

### 3.1 z-index system (F9)
- `src/index.css` `@theme`: Add `--z-hud: 10; --z-alerts: 20; --z-backdrop: 30; --z-dropdown: 40; --z-chat: 45; --z-chat-toggle: 50; --z-tooltip: 55;`
- Update z-indices in: HUD.tsx, ChatPanel.tsx (×2), CrewPanel.tsx (×2), MissionEventsPanel.tsx (×2), SpaceWeatherPanel.tsx, ProgressBar.tsx

### 3.2 DSN compact (F10)
- `src/hud/DSNStatus.tsx`: Mobile shows single summary dot + "X/3" count (`sm:hidden`). Desktop shows full station list (`hidden sm:flex`)

### 3.3 Events panel width (F11)
- `src/hud/MissionEventsPanel.tsx`: `w-[320px]` → `w-[calc(100vw-1.5rem)] sm:w-[320px]`

### 3.4 TelemetryCard overflow (F13)
- `src/hud/TelemetryCard.tsx`: Add `overflow-hidden`, `min-w-[100px]`, `tabular-nums`

### 3.5 CrewPanel mobile positioning (F12)
- `src/hud/CrewPanel.tsx`: `absolute` → `fixed sm:absolute` with `inset-x-3 sm:inset-x-auto bottom-4 sm:bottom-auto`

### 3.6 Safe-area insets (F14)
- `src/index.css`: Add `.safe-area-pad` class with `env(safe-area-inset-*)` padding
- `src/hud/HUD.tsx`: Add `safe-area-pad` class to container

### 3.7 Chat button overlap (F4)
- Resolved by Phase 1 (F2 reduces mobile HUD height). Verify during testing; adjust `bottom-[10rem]` on mobile only if overlap persists.

**Verify**: `npm run build` + Chrome DevTools 375px + 640px

---

## Files Modified (12 total)

| File | Phases |
|------|--------|
| `src/index.css` | 1, 3 |
| `index.html` | 1 |
| `src/chat/ChatPanel.tsx` | 1, 3 |
| `src/hud/HUD.tsx` | 1, 2, 3 |
| `src/hud/SpaceWeatherPanel.tsx` | 2, 3 |
| `src/hud/CameraControls.tsx` | 2 |
| `src/hud/ProgressBar.tsx` | 2, 3 |
| `src/hud/MissionEventsPanel.tsx` | 2, 3 |
| `src/hud/AlertItem.tsx` | 2 |
| `src/hud/DSNStatus.tsx` | 3 |
| `src/hud/TelemetryCard.tsx` | 3 |
| `src/hud/CrewPanel.tsx` | 3 |

## Verification

After each phase: `npm run build` must pass with zero errors.

Final verification:
- Chrome DevTools at **375px** (iPhone SE): Only Speed + Earth + ProgressBar + "More" toggle visible. Chat panel fills width with margins. All elements fit without overflow.
- Chrome DevTools at **640px+**: Identical to current desktop layout.
- Test expand/collapse animation (smooth, no jank).
- Test chat panel open + crew panel open simultaneously (z-index ordering correct).
