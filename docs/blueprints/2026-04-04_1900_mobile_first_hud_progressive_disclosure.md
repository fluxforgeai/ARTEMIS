# Blueprint: Mobile-First HUD Progressive Disclosure

**Date**: 2026-04-04 19:00 UTC
**Architect**: Claude Code (Session 4)
**Design**: [Mobile-First HUD Progressive Disclosure](../design/2026-04-04_1855_mobile_first_hud_progressive_disclosure.md)
**Tracker**: [Frontend Display & Mobile Responsiveness](../findings/2026-04-04_1855_frontend_display_mobile_responsiveness_FINDINGS_TRACKER.md)
**Findings**: F1-F15

---

## Summary

Three-phase implementation of mobile-first HUD progressive disclosure addressing 15 frontend display issues. Phase 1 fixes the two Critical issues (chat overflow, HUD vertical stack) plus dynamic viewport. Phase 2 refines secondary components (SpaceWeather, Camera, ProgressBar, touch targets). Phase 3 polishes z-index hierarchy, DSN compact mode, telemetry overflow, crew positioning, and safe-area insets.

Desktop layout is unchanged. All changes are additive mobile CSS classes and a single new piece of state (`moreOpen` toggle in HUD.tsx).

---

## Phase 1 -- Critical (F1, F2, F15)

Eliminates chat overflow and bottom HUD vertical stacking chaos. After this phase, mobile users see only essential telemetry (Speed, Earth Distance, ProgressBar) with a "More" toggle for secondary data.

### 1.1 Chat Panel Responsive Sizing (F1)

**File**: `src/chat/ChatPanel.tsx`

**Change 1 -- Chat toggle button (line 30)**

Current:
```tsx
className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-[rgba(0,212,255,0.15)] border border-hud-blue text-hud-blue flex items-center justify-center hover:bg-[rgba(0,212,255,0.25)] transition-all shadow-[0_0_15px_rgba(0,212,255,0.2)] pointer-events-auto"
```

New:
```tsx
className="fixed bottom-6 right-3 sm:right-6 z-50 w-12 h-12 rounded-full bg-[rgba(0,212,255,0.15)] border border-hud-blue text-hud-blue flex items-center justify-center hover:bg-[rgba(0,212,255,0.25)] transition-all shadow-[0_0_15px_rgba(0,212,255,0.2)] pointer-events-auto"
```

Rationale: Tighter right margin on mobile (12px instead of 24px) to leave more space. Also addressed by F4 in Phase 3.

**Change 2 -- Chat panel container (line 46)**

Current:
```tsx
className="fixed right-6 bottom-20 z-40 w-[360px] h-[500px] bg-[rgba(10,10,26,0.95)] backdrop-blur-md border border-[rgba(0,212,255,0.2)] rounded-xl flex flex-col overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] pointer-events-auto"
```

New:
```tsx
className="fixed inset-x-3 sm:inset-x-auto sm:right-6 bottom-20 z-40 w-auto sm:w-[360px] h-[70dvh] sm:h-[500px] max-h-[calc(100dvh-6rem)] bg-[rgba(10,10,26,0.95)] backdrop-blur-md border border-[rgba(0,212,255,0.2)] rounded-xl flex flex-col overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] pointer-events-auto"
```

Rationale:
- `inset-x-3 sm:inset-x-auto sm:right-6` -- on mobile, panel stretches full width with 12px margins; desktop keeps `right-6` position
- `w-auto sm:w-[360px]` -- width auto on mobile (controlled by inset-x), 360px on desktop
- `h-[70dvh] sm:h-[500px]` -- 70% of dynamic viewport on mobile, 500px on desktop
- `max-h-[calc(100dvh-6rem)]` -- safety cap so panel never exceeds viewport minus toggle button area

### 1.2 HUD Progressive Disclosure (F2)

**File**: `src/hud/HUD.tsx`

This is the largest change. The bottom section is restructured to hide secondary elements on mobile behind a toggle.

**Change 1 -- Add imports (line 1)**

Current:
```tsx
import { useState, memo, useCallback } from 'react';
```

New:
```tsx
import { useState, memo, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
```

**Change 2 -- Add `moreOpen` state (after line 37)**

Current:
```tsx
export default function HUD() {
  const [crewOpen, setCrewOpen] = useState(false);
  const handleCrewClose = useCallback(() => setCrewOpen(false), []);
```

New:
```tsx
export default function HUD() {
  const [crewOpen, setCrewOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const handleCrewClose = useCallback(() => setCrewOpen(false), []);
  const toggleMore = useCallback(() => setMoreOpen((prev) => !prev), []);
```

**Change 3 -- Replace entire bottom section (lines 68-82)**

Current (lines 68-82):
```tsx
      {/* Bottom section */}
      <div className="flex flex-col gap-2 sm:gap-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pointer-events-auto">
          <DSNStatus />
          <SpaceWeatherPanel />
          <CameraControls />
        </div>

        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-3 pointer-events-auto">
          <SpeedCard />
          <EarthDistCard />
          <MoonDistCard />
          <ProgressBar />
        </div>
      </div>
```

New:
```tsx
      {/* Bottom section */}
      <div className="flex flex-col gap-2 sm:gap-3">
        {/* Secondary row -- desktop only (hidden on mobile, visible sm+) */}
        <div className="hidden sm:flex items-center justify-between gap-2 pointer-events-auto">
          <DSNStatus />
          <SpaceWeatherPanel />
          <CameraControls />
        </div>

        {/* Mobile "More" expandable section (sm:hidden) */}
        <AnimatePresence>
          {moreOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="sm:hidden flex flex-col gap-2 overflow-hidden pointer-events-auto"
            >
              <TelemetryCard label="Moon" value={useMissionStore.getState().spacecraft.moonDist ?? 0} unit="km" color="#aaaaaa" />
              <DSNStatus />
              <SpaceWeatherPanel />
              <CameraControls />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Primary telemetry -- always visible */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-3 pointer-events-auto">
          <SpeedCard />
          <EarthDistCard />
          {/* Moon card: hidden on mobile (in "More"), visible on desktop */}
          <div className="hidden sm:block">
            <MoonDistCard />
          </div>
          <ProgressBar />
        </div>

        {/* Mobile "More" toggle (sm:hidden) */}
        <button
          onClick={toggleMore}
          className="sm:hidden flex items-center justify-center gap-1 py-2 text-[10px] text-gray-400 active:text-gray-200 pointer-events-auto"
          aria-expanded={moreOpen}
          aria-label={moreOpen ? 'Show less telemetry' : 'Show more telemetry'}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`transition-transform duration-200 ${moreOpen ? 'rotate-180' : ''}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
          {moreOpen ? 'Less' : 'More telemetry'}
        </button>
      </div>
```

**Important note on MoonDistCard in the expanded section**: The design sketch shows `<MoonDistCard />` inside the expandable section. However, `MoonDistCard` is a `memo`-wrapped component defined at module scope that uses `useMissionStore`. For the mobile expandable section, we should reuse `MoonDistCard` directly rather than inlining `useMissionStore.getState()`. The corrected version:

```tsx
{/* Inside the motion.div expandable section */}
<MoonDistCard />
<DSNStatus />
<SpaceWeatherPanel />
<CameraControls />
```

And then the primary grid section hides MoonDistCard on mobile:
```tsx
<div className="hidden sm:block">
  <MoonDistCard />
</div>
```

This means `MoonDistCard` renders in two places in the DOM (mobile expanded + desktop), but only one is visible at a time via `hidden sm:block` and `sm:hidden`. This is acceptable since it is a lightweight memo-wrapped component.

### 1.3 Dynamic Viewport Height (F15)

**File**: `src/index.css`

**Change 1 -- Replace `#root` height (line 24-27)**

Current:
```css
#root {
  width: 100vw;
  height: 100vh;
}
```

New:
```css
#root {
  width: 100vw;
  height: 100dvh;
  height: 100vh; /* fallback for browsers without dvh support */
}
```

Note: CSS cascading means the `100vh` fallback must come AFTER `100dvh`. Wait -- that is backwards. If a browser does not support `dvh`, it will ignore the `100dvh` declaration and use `100vh`. But the way CSS works, the LAST valid declaration wins. So the correct order is:

```css
#root {
  width: 100vw;
  height: 100vh;        /* fallback for older browsers */
  height: 100dvh;       /* overrides on browsers that support dvh */
}
```

**File**: `index.html`

**Change 1 -- Add `viewport-fit=cover` (line 6)**

Current:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```

New:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

Rationale: Required for `env(safe-area-inset-*)` to work (Phase 3). Safe to add now -- has no effect without the CSS padding rules.

### Phase 1 Acceptance Criteria

- [ ] **AC1.1**: Chat panel fits within 375px viewport (iPhone SE) with no horizontal overflow. Panel edges are 12px from left and right screen edges.
- [ ] **AC1.2**: Chat panel height is ~70% of viewport on mobile, 500px on desktop.
- [ ] **AC1.3**: Bottom HUD on mobile shows only Speed, Earth Distance, and Progress Bar (3 elements + toggle). Total height under 130px.
- [ ] **AC1.4**: "More telemetry" toggle expands to show Moon Distance, DSN, SpaceWeather, Camera Controls with smooth animation.
- [ ] **AC1.5**: Desktop layout (640px+) is completely unchanged -- all 7 elements visible, no toggle button.
- [ ] **AC1.6**: `dvh` is applied to `#root` -- verify by toggling mobile browser address bar (viewport resizes smoothly).
- [ ] **AC1.7**: `npm run build` succeeds with no errors.

---

## Phase 2 -- Refinement (F3, F5, F6, F7, F8)

Polishes secondary components that appear inside the mobile "More" section and fixes touch targets.

### 2.1 SpaceWeather Compact Mode (F3)

**File**: `src/hud/SpaceWeatherPanel.tsx`

**Change 1 -- Main container and content (line 93)**

Current:
```tsx
<div className="relative flex items-center gap-3 flex-wrap bg-[rgba(10,10,30,0.7)] backdrop-blur-sm border border-[rgba(0,212,255,0.2)] rounded-lg px-3 py-2">
  <span className="text-[10px] uppercase tracking-wider text-gray-400">Space Weather</span>
```

New:
```tsx
<div className="relative flex items-center gap-2 sm:gap-3 flex-wrap bg-[rgba(10,10,30,0.7)] backdrop-blur-sm border border-[rgba(0,212,255,0.2)] rounded-lg px-2 sm:px-3 py-2">
  <span className="text-[10px] uppercase tracking-wider text-gray-400">Space Weather</span>
```

Rationale: Tighter gap and padding on mobile to fit within narrow viewport.

**Change 2 -- Hide Solar Wind and Source on mobile (lines 107-134)**

Wrap the Solar Wind and Source badge sections:

Current Solar Wind section (lines 107-114):
```tsx
      {/* Solar Wind */}
      <div
        className="flex items-center gap-1 cursor-help"
        onMouseEnter={() => setHovered('wind')}
        onMouseLeave={() => setHovered(null)}
      >
        <span className="text-xs text-white font-mono">{solarWindSpeed}</span>
        <span className="text-[10px] text-gray-500">km/s</span>
      </div>
```

New:
```tsx
      {/* Solar Wind -- hidden on mobile for compact display */}
      <div
        className="hidden sm:flex items-center gap-1 cursor-help"
        onMouseEnter={() => setHovered('wind')}
        onMouseLeave={() => setHovered(null)}
      >
        <span className="text-xs text-white font-mono">{solarWindSpeed}</span>
        <span className="text-[10px] text-gray-500">km/s</span>
      </div>
```

Current Source badge section (lines 127-134):
```tsx
      {/* Source badge */}
      <div
        className="flex items-center gap-1 cursor-help"
        onMouseEnter={() => setHovered('source')}
        onMouseLeave={() => setHovered(null)}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />
        <span className="text-[9px] text-gray-500 uppercase">{source === 'synthetic' ? 'SIM' : 'LIVE'}</span>
      </div>
```

New:
```tsx
      {/* Source badge -- hidden on mobile for compact display */}
      <div
        className="hidden sm:flex items-center gap-1 cursor-help"
        onMouseEnter={() => setHovered('source')}
        onMouseLeave={() => setHovered(null)}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />
        <span className="text-[9px] text-gray-500 uppercase">{source === 'synthetic' ? 'SIM' : 'LIVE'}</span>
      </div>
```

Result: Mobile shows only "Space Weather", Kp dot+value, and Radiation Zone. Desktop shows all 4 indicators.

### 2.2 Camera Controls Responsive (F5)

**File**: `src/hud/CameraControls.tsx`

**Change 1 -- Add mobile-short labels (lines 4-9)**

Current:
```tsx
const PRESETS: Array<{ mode: CameraMode; label: string }> = [
  { mode: 'follow-orion', label: 'Follow Orion' },
  { mode: 'earth-view', label: 'Earth View' },
  { mode: 'moon-view', label: 'Moon View' },
  { mode: 'free', label: 'Free' },
];
```

New:
```tsx
const PRESETS: Array<{ mode: CameraMode; label: string; shortLabel: string }> = [
  { mode: 'follow-orion', label: 'Follow Orion', shortLabel: 'Follow' },
  { mode: 'earth-view', label: 'Earth View', shortLabel: 'Earth' },
  { mode: 'moon-view', label: 'Moon View', shortLabel: 'Moon' },
  { mode: 'free', label: 'Free', shortLabel: 'Free' },
];
```

**Change 2 -- Responsive container and button labels (lines 16-29)**

Current:
```tsx
    <div className="flex items-center gap-2">
      {PRESETS.map(({ mode, label }) => (
        <button
          key={mode}
          onClick={() => setCameraMode(mode)}
          className={`px-3 py-1.5 rounded text-xs font-mono transition-all ${
            cameraMode === mode
              ? 'bg-[rgba(0,212,255,0.2)] text-hud-blue border border-hud-blue'
              : 'bg-[rgba(10,10,30,0.5)] text-gray-400 border border-transparent hover:border-[rgba(0,212,255,0.3)] hover:text-gray-200'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
```

New:
```tsx
    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
      {PRESETS.map(({ mode, label, shortLabel }) => (
        <button
          key={mode}
          onClick={() => setCameraMode(mode)}
          className={`px-2 sm:px-3 py-1.5 rounded text-[10px] sm:text-xs font-mono transition-all min-h-[36px] sm:min-h-0 ${
            cameraMode === mode
              ? 'bg-[rgba(0,212,255,0.2)] text-hud-blue border border-hud-blue'
              : 'bg-[rgba(10,10,30,0.5)] text-gray-400 border border-transparent hover:border-[rgba(0,212,255,0.3)] hover:text-gray-200'
          }`}
        >
          <span className="sm:hidden">{shortLabel}</span>
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
```

Rationale:
- `gap-1.5 sm:gap-2` -- tighter spacing on mobile
- `px-2 sm:px-3` -- smaller horizontal padding on mobile
- `text-[10px] sm:text-xs` -- smaller font on mobile
- `min-h-[36px] sm:min-h-0` -- improved touch target height on mobile (F8 partial)
- Short labels on mobile: "Follow" (49px) + "Earth" (41px) + "Moon" (40px) + "Free" (34px) = ~164px + gaps = ~172px -- fits in 375px

### 2.3 ProgressBar Fixes (F6, F7)

**File**: `src/hud/ProgressBar.tsx`

**Change 1 -- Remove `sm:mr-16` artifact and fix container (line 72)**

Current:
```tsx
<div className="bg-[rgba(10,10,30,0.7)] backdrop-blur-sm border border-[rgba(0,212,255,0.2)] rounded-lg px-4 py-3 min-w-[200px] sm:min-w-[420px] col-span-2 sm:col-span-1 sm:flex-1 sm:mr-16">
```

New:
```tsx
<div className="bg-[rgba(10,10,30,0.7)] backdrop-blur-sm border border-[rgba(0,212,255,0.2)] rounded-lg px-3 sm:px-4 py-3 min-w-0 sm:min-w-[420px] col-span-2 sm:col-span-1 sm:flex-1">
```

Changes:
- Removed `sm:mr-16` -- layout artifact from older design
- `px-3 sm:px-4` -- tighter padding on mobile
- `min-w-0` instead of `min-w-[200px]` on mobile -- let grid layout control width (the `col-span-2` already makes it full grid width)

**Change 2 -- Fix tooltip overflow (line 126)**

Current:
```tsx
className={`absolute bottom-full mb-3 z-50 bg-[rgba(10,10,30,0.95)] backdrop-blur-md border border-[rgba(0,212,255,0.3)] rounded-lg px-3 py-2 min-w-[180px] max-w-[240px] whitespace-normal shadow-lg ${
  m.position < 10 ? 'left-0' : m.position > 90 ? 'right-0' : 'left-1/2 -translate-x-1/2'
}`}
```

New:
```tsx
className={`absolute bottom-full mb-3 z-50 bg-[rgba(10,10,30,0.95)] backdrop-blur-md border border-[rgba(0,212,255,0.3)] rounded-lg px-3 py-2 min-w-[140px] sm:min-w-[180px] max-w-[calc(100vw-2rem)] sm:max-w-[240px] whitespace-normal shadow-lg ${
  m.position < 20 ? 'left-0' : m.position > 80 ? 'right-0' : 'left-1/2 -translate-x-1/2'
}`}
```

Changes:
- `min-w-[140px] sm:min-w-[180px]` -- smaller minimum on mobile
- `max-w-[calc(100vw-2rem)] sm:max-w-[240px]` -- clamp to viewport on mobile
- Position thresholds widened: `< 20` and `> 80` instead of `< 10` and `> 90` -- gives more room at edges on narrow screens

**Change 3 -- Expand milestone dot touch target (lines 87-96)**

Add padding around the milestone marker container for touch targets:

Current:
```tsx
<div
  key={m.name}
  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
  style={{ left: `${m.position}%` }}
  onMouseEnter={() => handleHover(i)}
  onMouseLeave={handleLeave}
  onTouchStart={() => handleHover(i)}
  onTouchEnd={handleLeave}
>
```

New:
```tsx
<div
  key={m.name}
  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 p-2 -m-2 cursor-pointer"
  style={{ left: `${m.position}%` }}
  onMouseEnter={() => handleHover(i)}
  onMouseLeave={handleLeave}
  onTouchStart={() => handleHover(i)}
  onTouchEnd={handleLeave}
>
```

Rationale: `p-2 -m-2` creates an invisible 16px padding around the 6px dot, expanding the touch target to ~22px. Combined with the dot itself, effective touch area is approximately 22x22px. Not the full 44px minimum, but a pragmatic improvement for inline progress bar dots (44px would cause dots to overlap on mobile).

### 2.4 Touch Target Enlargement (F8)

**File**: `src/hud/HUD.tsx` -- Crew button (lines 48-59)

Current:
```tsx
<button
  onClick={() => setCrewOpen(!crewOpen)}
  className={`px-1.5 py-0.5 rounded transition-colors ${crewOpen ? 'text-[#00d4ff]' : 'text-gray-400 hover:text-[#00d4ff]'}`}
  title="Crew"
>
```

New:
```tsx
<button
  onClick={() => setCrewOpen(!crewOpen)}
  className={`px-2 py-2 sm:px-1.5 sm:py-0.5 -mx-0.5 rounded transition-colors ${crewOpen ? 'text-[#00d4ff]' : 'text-gray-400 hover:text-[#00d4ff]'}`}
  title="Crew"
>
```

Rationale: `px-2 py-2` gives ~36x36px touch area on mobile. `sm:px-1.5 sm:py-0.5` restores compact desktop sizing. `-mx-0.5` compensates for the extra horizontal padding so it does not push adjacent elements.

**File**: `src/hud/MissionEventsPanel.tsx` -- Hamburger button (lines 74-76)

Current:
```tsx
<button
  onClick={() => setIsOpen(!isOpen)}
  className={`relative px-2 py-1.5 rounded transition-colors ${isOpen ? 'text-[#00d4ff]' : 'text-gray-400 hover:text-[#00d4ff]'}`}
  title="Mission Events"
>
```

New:
```tsx
<button
  onClick={() => setIsOpen(!isOpen)}
  className={`relative px-2.5 py-2.5 sm:px-2 sm:py-1.5 rounded transition-colors ${isOpen ? 'text-[#00d4ff]' : 'text-gray-400 hover:text-[#00d4ff]'}`}
  title="Mission Events"
>
```

Rationale: `px-2.5 py-2.5` gives ~44x44px touch area on mobile. Desktop reverts to original size.

**File**: `src/hud/AlertItem.tsx` -- Dismiss button (lines 62-66)

Current:
```tsx
<button
  onClick={() => onDismiss(id)}
  className="text-gray-500 hover:text-white transition-colors text-sm leading-none mt-0.5"
>
  x
</button>
```

New:
```tsx
<button
  onClick={() => onDismiss(id)}
  className="text-gray-500 hover:text-white transition-colors text-sm leading-none mt-0.5 min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2 -mt-1"
>
  x
</button>
```

Rationale: `min-w-[44px] min-h-[44px]` meets minimum touch target. Negative margin compensates for visual positioning.

### Phase 2 Acceptance Criteria

- [ ] **AC2.1**: SpaceWeather panel on mobile shows only "Space Weather" label, Kp dot+value, and Radiation Zone (3 items). Desktop shows all 4 items.
- [ ] **AC2.2**: Camera buttons fit within 375px viewport on mobile. Labels are "Follow", "Earth", "Moon", "Free" on mobile; full names on desktop.
- [ ] **AC2.3**: ProgressBar has no right margin artifact on desktop. `sm:mr-16` is removed.
- [ ] **AC2.4**: Milestone tooltips do not overflow viewport on 375px screens. Tooltips clamp to `100vw - 2rem` on mobile.
- [ ] **AC2.5**: Crew button, Events hamburger, and Alert dismiss all have minimum 36-44px touch target on mobile.
- [ ] **AC2.6**: Desktop layout unchanged for all Phase 2 components.
- [ ] **AC2.7**: `npm run build` succeeds with no errors.

---

## Phase 3 -- Polish (F4, F9, F10, F11, F12, F13, F14)

### 3.1 z-index System (F9)

**File**: `src/index.css`

**Change 1 -- Add z-index custom properties to `@theme` block (after line 13)**

Current `@theme` block ends at line 14:
```css
@theme {
  --color-space-dark: #0a0a1a;
  --color-space-deep: #050510;
  --color-hud-blue: #00d4ff;
  --color-hud-cyan: #00ffd5;
  --color-hud-orange: #ff8c00;
  --color-hud-green: #00ff88;
  --color-hud-red: #ff4444;
  --color-hud-glass: rgba(10, 10, 30, 0.7);
  --color-hud-border: rgba(0, 212, 255, 0.2);
  --font-family-mono: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
}
```

New:
```css
@theme {
  --color-space-dark: #0a0a1a;
  --color-space-deep: #050510;
  --color-hud-blue: #00d4ff;
  --color-hud-cyan: #00ffd5;
  --color-hud-orange: #ff8c00;
  --color-hud-green: #00ff88;
  --color-hud-red: #ff4444;
  --color-hud-glass: rgba(10, 10, 30, 0.7);
  --color-hud-border: rgba(0, 212, 255, 0.2);
  --font-family-mono: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;

  /* z-index scale -- documented hierarchy */
  --z-hud: 10;
  --z-alerts: 20;
  --z-backdrop: 30;
  --z-dropdown: 40;
  --z-chat: 45;
  --z-chat-toggle: 50;
  --z-tooltip: 55;
}
```

Then update z-index references across files:

| File | Current | New |
|------|---------|-----|
| `HUD.tsx:40` | `z-10` | `z-[var(--z-hud)]` |
| `ChatPanel.tsx:30` | `z-50` | `z-[var(--z-chat-toggle)]` |
| `ChatPanel.tsx:46` | `z-40` | `z-[var(--z-chat)]` |
| `CrewPanel.tsx:16` | `z-30` | `z-[var(--z-backdrop)]` |
| `CrewPanel.tsx:22` | `z-40` | `z-[var(--z-dropdown)]` |
| `MissionEventsPanel.tsx:97` | `z-30` | `z-[var(--z-backdrop)]` |
| `MissionEventsPanel.tsx:103` | `z-40` | `z-[var(--z-dropdown)]` |
| `SpaceWeatherPanel.tsx:144` | `z-50` | `z-[var(--z-tooltip)]` |
| `ProgressBar.tsx:126` | `z-50` | `z-[var(--z-tooltip)]` |

Note: The `z-[var(--z-*)]` syntax works in Tailwind v4 with CSS custom properties defined in `@theme`.

### 3.2 DSN Compact Mode (F10)

**File**: `src/hud/DSNStatus.tsx`

**Change 1 -- Add mobile compact display (lines 31-47)**

Current:
```tsx
return (
  <div className="flex items-center gap-3">
    <span className="text-[10px] uppercase tracking-wider text-gray-400">DSN</span>
    {stationStatuses.map((s) => (
      <div key={s.id} className="flex items-center gap-1.5">
        <div
          className={`w-2 h-2 rounded-full ${
            s.active ? 'bg-[#00ff88] shadow-[0_0_6px_rgba(0,255,136,0.5)]' : 'bg-gray-600'
          }`}
        />
        <span className={`text-xs ${s.active ? 'text-[#00ff88]' : 'text-gray-500'}`}>
          {s.name}
        </span>
      </div>
    ))}
  </div>
);
```

New:
```tsx
const anyActive = stationStatuses.some((s) => s.active);

return (
  <div className="flex items-center gap-2 sm:gap-3">
    <span className="text-[10px] uppercase tracking-wider text-gray-400">DSN</span>
    {/* Mobile: single summary dot */}
    <div className="sm:hidden flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${anyActive ? 'bg-[#00ff88] shadow-[0_0_6px_rgba(0,255,136,0.5)]' : 'bg-gray-600'}`} />
      <span className={`text-xs ${anyActive ? 'text-[#00ff88]' : 'text-gray-500'}`}>
        {stationStatuses.filter((s) => s.active).length}/{stationStatuses.length}
      </span>
    </div>
    {/* Desktop: full station list */}
    {stationStatuses.map((s) => (
      <div key={s.id} className="hidden sm:flex items-center gap-1.5">
        <div
          className={`w-2 h-2 rounded-full ${
            s.active ? 'bg-[#00ff88] shadow-[0_0_6px_rgba(0,255,136,0.5)]' : 'bg-gray-600'
          }`}
        />
        <span className={`text-xs ${s.active ? 'text-[#00ff88]' : 'text-gray-500'}`}>
          {s.name}
        </span>
      </div>
    ))}
  </div>
);
```

Result: Mobile shows "DSN [dot] 1/3" (compact). Desktop shows "DSN [dot] Goldstone [dot] Canberra [dot] Madrid" (full).

### 3.3 MissionEventsPanel Width (F11)

**File**: `src/hud/MissionEventsPanel.tsx`

**Change 1 -- Responsive panel width (line 103)**

Current:
```tsx
className="absolute top-full mt-2 right-0 z-40 bg-[rgba(10,10,30,0.92)] backdrop-blur-md border border-[rgba(0,212,255,0.2)] rounded-lg w-[320px] max-h-[70vh] overflow-y-auto shadow-lg"
```

New:
```tsx
className="absolute top-full mt-2 right-0 z-[var(--z-dropdown)] bg-[rgba(10,10,30,0.92)] backdrop-blur-md border border-[rgba(0,212,255,0.2)] rounded-lg w-[calc(100vw-1.5rem)] sm:w-[320px] max-h-[70vh] overflow-y-auto shadow-lg"
```

Changes:
- `w-[calc(100vw-1.5rem)] sm:w-[320px]` -- clamps to viewport on mobile
- `z-[var(--z-dropdown)]` -- uses z-index system (F9)

### 3.4 TelemetryCard Overflow Fix (F13)

**File**: `src/hud/TelemetryCard.tsx`

**Change 1 -- Add overflow protection (line 23)**

Current:
```tsx
<div className="bg-[rgba(10,10,30,0.7)] backdrop-blur-sm border border-[rgba(0,212,255,0.2)] rounded-lg px-2 py-2 sm:px-4 sm:py-3 min-w-0 sm:min-w-[140px]">
```

New:
```tsx
<div className="bg-[rgba(10,10,30,0.7)] backdrop-blur-sm border border-[rgba(0,212,255,0.2)] rounded-lg px-2 py-2 sm:px-4 sm:py-3 min-w-[100px] sm:min-w-[140px] overflow-hidden">
```

Changes:
- `min-w-[100px]` on mobile instead of `min-w-0` -- prevents card from shrinking below readable width
- `overflow-hidden` -- prevents text from bleeding out of the card

**Change 2 -- Add `tabular-nums` to value (line 27)**

Current:
```tsx
<motion.span
  className="text-sm sm:text-xl font-bold font-mono"
  style={{ color }}
>
```

New:
```tsx
<motion.span
  className="text-sm sm:text-xl font-bold font-mono tabular-nums"
  style={{ color }}
>
```

Rationale: `tabular-nums` ensures numbers have consistent widths so the value does not jump around as digits change.

### 3.5 CrewPanel Mobile Positioning (F12)

**File**: `src/hud/CrewPanel.tsx`

**Change 1 -- Responsive panel positioning (line 22)**

Current:
```tsx
className="absolute top-full mt-2 left-0 z-40 bg-[rgba(10,10,30,0.85)] backdrop-blur-sm border border-[rgba(0,212,255,0.2)] rounded-lg p-3 min-w-[200px]"
```

New:
```tsx
className="fixed sm:absolute inset-x-3 sm:inset-x-auto bottom-4 sm:bottom-auto sm:top-full sm:mt-2 sm:left-0 z-[var(--z-dropdown)] bg-[rgba(10,10,30,0.85)] backdrop-blur-sm border border-[rgba(0,212,255,0.2)] rounded-lg p-3 min-w-0 sm:min-w-[200px]"
```

Changes:
- `fixed sm:absolute` -- mobile uses fixed positioning (bottom sheet style), desktop uses dropdown
- `inset-x-3 sm:inset-x-auto` -- mobile stretches full width with margins
- `bottom-4 sm:bottom-auto sm:top-full sm:mt-2 sm:left-0` -- mobile shows at bottom, desktop drops below button
- `z-[var(--z-dropdown)]` -- uses z-index system (F9)
- `min-w-0 sm:min-w-[200px]` -- no minimum on mobile (full width), 200px on desktop

### 3.6 Chat Button Overlap Fix (F4)

This is largely resolved by Phase 1 (F2 -- HUD progressive disclosure reduces bottom HUD height). The chat toggle button at `bottom-6 right-3` now sits below the compact mobile HUD (Speed + Earth + ProgressBar + toggle = ~130px), so there is room between the HUD bottom edge and the button.

No additional change required beyond Phase 1, assuming the mobile HUD height stays under ~180px. If testing reveals overlap, add `bottom-[10rem] sm:bottom-6` to the chat toggle button in ChatPanel.tsx line 30.

### 3.7 Safe-Area Insets (F14)

**File**: `src/index.css`

**Change 1 -- Add safe-area padding (after the `#root` block)**

Add after the `#root` block:
```css
/* Safe area insets for notched devices (iPhone, etc.) */
@supports (padding-top: env(safe-area-inset-top)) {
  .safe-area-pad {
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
  }
}
```

**File**: `src/hud/HUD.tsx`

**Change 1 -- Add safe-area class to HUD container (line 40)**

Current:
```tsx
<div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2 sm:p-4 z-10">
```

New:
```tsx
<div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2 sm:p-4 z-[var(--z-hud)] safe-area-pad">
```

This adds safe-area inset padding on top of the existing `p-2 sm:p-4`. On devices without notches, `env(safe-area-inset-*)` resolves to `0px`, so there is no visual change.

### Phase 3 Acceptance Criteria

- [ ] **AC3.1**: z-index custom properties defined in `@theme`. All overlay components reference them. Chat panel (45) always renders above dropdowns (40). Chat toggle (50) renders above chat panel. Tooltips (55) render above everything.
- [ ] **AC3.2**: DSN shows compact "DSN [dot] N/3" on mobile, full station list on desktop.
- [ ] **AC3.3**: TelemetryCard values do not overflow their container. Numbers use `tabular-nums` for stable alignment.
- [ ] **AC3.4**: CrewPanel renders as a fixed bottom panel on mobile, a dropdown on desktop.
- [ ] **AC3.5**: MissionEventsPanel fits within 375px viewport on mobile.
- [ ] **AC3.6**: Chat toggle button does not overlap with bottom HUD elements on mobile.
- [ ] **AC3.7**: Safe-area insets respected on notched devices (verify in Chrome DevTools with device frame).
- [ ] **AC3.8**: Desktop layout unchanged for all Phase 3 components.
- [ ] **AC3.9**: `npm run build` succeeds with no errors.

---

## File Change Summary

| File | Phase | Changes |
|------|-------|---------|
| `src/hud/HUD.tsx` | 1, 2, 3 | Progressive disclosure toggle, AnimatePresence import, moreOpen state, safe-area class, z-index var, touch target on crew button |
| `src/chat/ChatPanel.tsx` | 1, 3 | Responsive width/height/inset, z-index vars |
| `src/index.css` | 1, 3 | `100dvh`, z-index custom properties, safe-area utility class |
| `index.html` | 1 | `viewport-fit=cover` |
| `src/hud/SpaceWeatherPanel.tsx` | 2, 3 | Compact mobile display, z-index var on tooltip |
| `src/hud/CameraControls.tsx` | 2 | Short labels, responsive sizing, touch targets |
| `src/hud/ProgressBar.tsx` | 2, 3 | Remove `sm:mr-16`, responsive tooltip, dot touch area, z-index var |
| `src/hud/MissionEventsPanel.tsx` | 2, 3 | Touch target, responsive width, z-index vars |
| `src/hud/AlertItem.tsx` | 2 | Touch target on dismiss button |
| `src/hud/DSNStatus.tsx` | 3 | Compact mobile mode |
| `src/hud/TelemetryCard.tsx` | 3 | `overflow-hidden`, `min-w-[100px]`, `tabular-nums` |
| `src/hud/CrewPanel.tsx` | 3 | Mobile bottom-sheet positioning, z-index var |

---

## Dependencies

- **No new npm dependencies**. Uses existing Framer Motion `AnimatePresence` and `motion`.
- Tailwind v4 responsive utilities (`sm:`, `hidden`, `flex-wrap`)
- CSS `dvh` units (supported in all modern browsers since 2023)
- CSS `env(safe-area-inset-*)` (supported in Safari 11.1+, Chrome 87+)

---

## Debug Strategy

1. `npm run build` after each phase to catch compilation errors
2. Chrome DevTools Device Mode:
   - **375px** (iPhone SE) -- narrowest common phone
   - **390px** (iPhone 14) -- standard modern phone
   - **640px** -- `sm:` breakpoint boundary (test both 639px and 640px)
   - **1280px** -- desktop baseline
3. Test the "More" toggle animation -- should expand smoothly, no layout shift
4. Test chat panel at all breakpoints -- no horizontal overflow
5. Test z-index layering: open chat + dropdown simultaneously, verify correct stacking

---

## Risk Assessment

| Risk | L | I | Mitigation |
|------|---|---|------------|
| MoonDistCard renders in two DOM locations | L | L | Both are lightweight memo-wrapped; only one visible at a time |
| AnimatePresence height animation jank | L | L | Use `ease: 'easeInOut'` and `duration: 0.25` for smooth transition |
| `dvh` not supported on older browsers | L | L | `100vh` fallback declared first in CSS cascade |
| Tailwind v4 `z-[var(--z-*)]` syntax | L | M | Verify in build -- Tailwind v4 supports arbitrary values with CSS vars |

---

**Blueprint Complete**: 2026-04-04 19:00 UTC
