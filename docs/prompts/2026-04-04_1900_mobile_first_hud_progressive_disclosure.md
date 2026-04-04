# Implementation Prompt: Mobile-First HUD Progressive Disclosure

**Date**: 2026-04-04 19:00 UTC
**Blueprint**: [Mobile-First HUD Progressive Disclosure](../blueprints/2026-04-04_1900_mobile_first_hud_progressive_disclosure.md)
**Tracker**: [Frontend Display & Mobile Responsiveness](../findings/2026-04-04_1855_frontend_display_mobile_responsiveness_FINDINGS_TRACKER.md)
**Findings**: F1-F15

---

## Objective

Implement mobile-first HUD progressive disclosure in 3 phases, addressing all 15 frontend display issues. Desktop layout must remain unchanged. All changes are additive mobile CSS classes and one new piece of state.

---

## Phase 1 -- Critical (F1, F2, F15)

### Step 1.1: Dynamic Viewport Height and viewport-fit (F15)

**File: `src/index.css`**

Replace the `#root` block:

```css
/* CURRENT (lines 24-27): */
#root {
  width: 100vw;
  height: 100vh;
}

/* NEW: */
#root {
  width: 100vw;
  height: 100vh;
  height: 100dvh;
}
```

The `100vh` line is declared first as a fallback. Browsers supporting `dvh` will apply the second declaration, overriding the first.

**File: `index.html`**

Replace the viewport meta tag:

```html
<!-- CURRENT (line 6): -->
<meta name="viewport" content="width=device-width, initial-scale=1.0" />

<!-- NEW: -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

### Step 1.2: Chat Panel Responsive Sizing (F1)

**File: `src/chat/ChatPanel.tsx`**

**Change A -- Toggle button (line 30)**: Replace `right-6` with `right-3 sm:right-6`:

```tsx
// CURRENT (line 30):
className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-[rgba(0,212,255,0.15)] border border-hud-blue text-hud-blue flex items-center justify-center hover:bg-[rgba(0,212,255,0.25)] transition-all shadow-[0_0_15px_rgba(0,212,255,0.2)] pointer-events-auto"

// NEW:
className="fixed bottom-6 right-3 sm:right-6 z-50 w-12 h-12 rounded-full bg-[rgba(0,212,255,0.15)] border border-hud-blue text-hud-blue flex items-center justify-center hover:bg-[rgba(0,212,255,0.25)] transition-all shadow-[0_0_15px_rgba(0,212,255,0.2)] pointer-events-auto"
```

**Change B -- Panel container (line 46)**: Replace fixed dimensions with responsive sizing:

```tsx
// CURRENT (line 46):
className="fixed right-6 bottom-20 z-40 w-[360px] h-[500px] bg-[rgba(10,10,26,0.95)] backdrop-blur-md border border-[rgba(0,212,255,0.2)] rounded-xl flex flex-col overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] pointer-events-auto"

// NEW:
className="fixed inset-x-3 sm:inset-x-auto sm:right-6 bottom-20 z-40 w-auto sm:w-[360px] h-[70dvh] sm:h-[500px] max-h-[calc(100dvh-6rem)] bg-[rgba(10,10,26,0.95)] backdrop-blur-md border border-[rgba(0,212,255,0.2)] rounded-xl flex flex-col overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] pointer-events-auto"
```

Key classes explained:
- `inset-x-3` -- 12px from left and right on mobile (full width with margins)
- `sm:inset-x-auto sm:right-6` -- desktop reverts to right-aligned 360px panel
- `w-auto sm:w-[360px]` -- width auto on mobile (controlled by inset), fixed on desktop
- `h-[70dvh] sm:h-[500px]` -- 70% of dynamic viewport on mobile, 500px on desktop
- `max-h-[calc(100dvh-6rem)]` -- safety cap prevents panel from exceeding viewport

### Step 1.3: HUD Progressive Disclosure (F2)

**File: `src/hud/HUD.tsx`**

This is the most complex change. Follow each sub-step carefully.

**Change A -- Add import (line 1)**:

```tsx
// CURRENT:
import { useState, memo, useCallback } from 'react';

// NEW:
import { useState, memo, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
```

**Change B -- Add state and handler (after line 36)**:

```tsx
// CURRENT (lines 35-38):
export default function HUD() {
  const [crewOpen, setCrewOpen] = useState(false);
  const handleCrewClose = useCallback(() => setCrewOpen(false), []);

// NEW:
export default function HUD() {
  const [crewOpen, setCrewOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const handleCrewClose = useCallback(() => setCrewOpen(false), []);
  const toggleMore = useCallback(() => setMoreOpen((prev) => !prev), []);
```

**Change C -- Replace entire bottom section (lines 68-82)**:

Delete everything from `{/* Bottom section */}` through the closing `</div>` of the bottom section. Replace with:

```tsx
      {/* Bottom section */}
      <div className="flex flex-col gap-2 sm:gap-3">
        {/* Secondary row -- desktop only */}
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
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="sm:hidden flex flex-col gap-2 overflow-hidden pointer-events-auto"
            >
              <MoonDistCard />
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
          <div className="hidden sm:block">
            <MoonDistCard />
          </div>
          <ProgressBar />
        </div>

        {/* Mobile "More" toggle */}
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

**Verification for Phase 1:**

Run `npm run build`. Open Chrome DevTools, toggle device mode to 375px (iPhone SE). Verify:
1. Chat panel fits within viewport with 12px margins on each side
2. Bottom HUD shows only Speed + Earth Distance + ProgressBar + "More telemetry" toggle
3. Tapping "More telemetry" expands Moon Distance + DSN + SpaceWeather + Camera with smooth animation
4. At 640px+, all elements are visible, no toggle button shown
5. Desktop layout is identical to before

---

## Phase 2 -- Refinement (F3, F5, F6, F7, F8)

### Step 2.1: SpaceWeather Compact Mode (F3)

**File: `src/hud/SpaceWeatherPanel.tsx`**

**Change A -- Container spacing (line 93)**:

```tsx
// CURRENT:
<div className="relative flex items-center gap-3 flex-wrap bg-[rgba(10,10,30,0.7)] backdrop-blur-sm border border-[rgba(0,212,255,0.2)] rounded-lg px-3 py-2">

// NEW:
<div className="relative flex items-center gap-2 sm:gap-3 flex-wrap bg-[rgba(10,10,30,0.7)] backdrop-blur-sm border border-[rgba(0,212,255,0.2)] rounded-lg px-2 sm:px-3 py-2">
```

**Change B -- Hide Solar Wind on mobile (line 108)**:

```tsx
// CURRENT:
        className="flex items-center gap-1 cursor-help"

// NEW (the Solar Wind div around line 108):
        className="hidden sm:flex items-center gap-1 cursor-help"
```

Make sure to change the div that wraps Solar Wind (`onMouseEnter={() => setHovered('wind')}`), not a different div.

**Change C -- Hide Source badge on mobile (line 128)**:

```tsx
// CURRENT:
        className="flex items-center gap-1 cursor-help"

// NEW (the Source badge div around line 128):
        className="hidden sm:flex items-center gap-1 cursor-help"
```

Make sure to change the div that wraps Source badge (`onMouseEnter={() => setHovered('source')}`), not a different div.

### Step 2.2: Camera Controls Responsive (F5)

**File: `src/hud/CameraControls.tsx`**

**Change A -- Add short labels to PRESETS (lines 4-9)**:

```tsx
// CURRENT:
const PRESETS: Array<{ mode: CameraMode; label: string }> = [
  { mode: 'follow-orion', label: 'Follow Orion' },
  { mode: 'earth-view', label: 'Earth View' },
  { mode: 'moon-view', label: 'Moon View' },
  { mode: 'free', label: 'Free' },
];

// NEW:
const PRESETS: Array<{ mode: CameraMode; label: string; shortLabel: string }> = [
  { mode: 'follow-orion', label: 'Follow Orion', shortLabel: 'Follow' },
  { mode: 'earth-view', label: 'Earth View', shortLabel: 'Earth' },
  { mode: 'moon-view', label: 'Moon View', shortLabel: 'Moon' },
  { mode: 'free', label: 'Free', shortLabel: 'Free' },
];
```

**Change B -- Responsive container and buttons (lines 16-29)**:

```tsx
// CURRENT:
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

// NEW:
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

### Step 2.3: ProgressBar Fixes (F6, F7)

**File: `src/hud/ProgressBar.tsx`**

**Change A -- Remove `sm:mr-16` artifact and fix sizing (line 72)**:

```tsx
// CURRENT:
<div className="bg-[rgba(10,10,30,0.7)] backdrop-blur-sm border border-[rgba(0,212,255,0.2)] rounded-lg px-4 py-3 min-w-[200px] sm:min-w-[420px] col-span-2 sm:col-span-1 sm:flex-1 sm:mr-16">

// NEW:
<div className="bg-[rgba(10,10,30,0.7)] backdrop-blur-sm border border-[rgba(0,212,255,0.2)] rounded-lg px-3 sm:px-4 py-3 min-w-0 sm:min-w-[420px] col-span-2 sm:col-span-1 sm:flex-1">
```

**Change B -- Fix tooltip overflow (line 126)**:

```tsx
// CURRENT:
className={`absolute bottom-full mb-3 z-50 bg-[rgba(10,10,30,0.95)] backdrop-blur-md border border-[rgba(0,212,255,0.3)] rounded-lg px-3 py-2 min-w-[180px] max-w-[240px] whitespace-normal shadow-lg ${
  m.position < 10 ? 'left-0' : m.position > 90 ? 'right-0' : 'left-1/2 -translate-x-1/2'
}`}

// NEW:
className={`absolute bottom-full mb-3 z-50 bg-[rgba(10,10,30,0.95)] backdrop-blur-md border border-[rgba(0,212,255,0.3)] rounded-lg px-3 py-2 min-w-[140px] sm:min-w-[180px] max-w-[calc(100vw-2rem)] sm:max-w-[240px] whitespace-normal shadow-lg ${
  m.position < 20 ? 'left-0' : m.position > 80 ? 'right-0' : 'left-1/2 -translate-x-1/2'
}`}
```

**Change C -- Expand milestone dot touch targets (lines 88-96)**:

```tsx
// CURRENT:
            <div
              key={m.name}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
              style={{ left: `${m.position}%` }}
              onMouseEnter={() => handleHover(i)}
              onMouseLeave={handleLeave}
              onTouchStart={() => handleHover(i)}
              onTouchEnd={handleLeave}
            >

// NEW:
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

### Step 2.4: Touch Target Enlargement (F8)

**File: `src/hud/HUD.tsx` -- Crew button**:

```tsx
// CURRENT (around line 50):
className={`px-1.5 py-0.5 rounded transition-colors ${crewOpen ? 'text-[#00d4ff]' : 'text-gray-400 hover:text-[#00d4ff]'}`}

// NEW:
className={`px-2 py-2 sm:px-1.5 sm:py-0.5 -mx-0.5 rounded transition-colors ${crewOpen ? 'text-[#00d4ff]' : 'text-gray-400 hover:text-[#00d4ff]'}`}
```

**File: `src/hud/MissionEventsPanel.tsx` -- Hamburger button**:

```tsx
// CURRENT (around line 76):
className={`relative px-2 py-1.5 rounded transition-colors ${isOpen ? 'text-[#00d4ff]' : 'text-gray-400 hover:text-[#00d4ff]'}`}

// NEW:
className={`relative px-2.5 py-2.5 sm:px-2 sm:py-1.5 rounded transition-colors ${isOpen ? 'text-[#00d4ff]' : 'text-gray-400 hover:text-[#00d4ff]'}`}
```

**File: `src/hud/AlertItem.tsx` -- Dismiss button**:

```tsx
// CURRENT (lines 62-66):
      <button
        onClick={() => onDismiss(id)}
        className="text-gray-500 hover:text-white transition-colors text-sm leading-none mt-0.5"
      >
        ×
      </button>

// NEW:
      <button
        onClick={() => onDismiss(id)}
        className="text-gray-500 hover:text-white transition-colors text-sm leading-none mt-0.5 min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2 -mt-1"
      >
        ×
      </button>
```

**Verification for Phase 2:**

Run `npm run build`. Chrome DevTools at 375px:
1. SpaceWeather shows only Kp + Radiation Zone (2 indicators + label) on mobile
2. Camera buttons show short labels, all fit in one row on 375px
3. ProgressBar has no right margin artifact, tooltips fit within viewport
4. All touch targets feel tappable (visually verify padding with DevTools element inspector)
5. Desktop layout unchanged

---

## Phase 3 -- Polish (F4, F9, F10, F11, F12, F13, F14)

### Step 3.1: z-index System (F9)

**File: `src/index.css`**

Add z-index custom properties inside the existing `@theme` block, after the font-family line:

```css
/* ADD inside @theme block, after --font-family-mono line: */

  /* z-index scale -- documented hierarchy */
  --z-hud: 10;
  --z-alerts: 20;
  --z-backdrop: 30;
  --z-dropdown: 40;
  --z-chat: 45;
  --z-chat-toggle: 50;
  --z-tooltip: 55;
```

Then update z-index references in every file:

**File: `src/hud/HUD.tsx` (line 40):**
```tsx
// CURRENT: z-10
// NEW: z-[var(--z-hud)]
className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2 sm:p-4 z-[var(--z-hud)]"
```

Note: If the safe-area-pad class is already added (from Step 3.6), include it too.

**File: `src/chat/ChatPanel.tsx` (line 30) -- toggle button:**
```tsx
// CURRENT: z-50
// NEW: z-[var(--z-chat-toggle)]
```
Replace `z-50` with `z-[var(--z-chat-toggle)]` in the toggle button className string.

**File: `src/chat/ChatPanel.tsx` (line 46) -- panel:**
```tsx
// CURRENT: z-40
// NEW: z-[var(--z-chat)]
```
Replace `z-40` with `z-[var(--z-chat)]` in the panel className string.

**File: `src/hud/CrewPanel.tsx` (line 16) -- backdrop:**
```tsx
// CURRENT: z-30
// NEW: z-[var(--z-backdrop)]
```

**File: `src/hud/CrewPanel.tsx` (line 22) -- panel:**
```tsx
// CURRENT: z-40
// NEW: z-[var(--z-dropdown)]
```

**File: `src/hud/MissionEventsPanel.tsx` (line 97) -- backdrop:**
```tsx
// CURRENT: z-30
// NEW: z-[var(--z-backdrop)]
```

**File: `src/hud/MissionEventsPanel.tsx` (line 103) -- panel:**
```tsx
// CURRENT: z-40
// NEW: z-[var(--z-dropdown)]
```

**File: `src/hud/SpaceWeatherPanel.tsx` (line 144) -- tooltip:**
```tsx
// CURRENT: z-50
// NEW: z-[var(--z-tooltip)]
```

**File: `src/hud/ProgressBar.tsx` (line 126) -- tooltip:**
```tsx
// CURRENT: z-50
// NEW: z-[var(--z-tooltip)]
```

### Step 3.2: DSN Compact Mode (F10)

**File: `src/hud/DSNStatus.tsx`**

Replace the entire return statement (lines 31-47):

```tsx
// CURRENT:
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

// NEW:
  const anyActive = stationStatuses.some((s) => s.active);
  const activeCount = stationStatuses.filter((s) => s.active).length;

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <span className="text-[10px] uppercase tracking-wider text-gray-400">DSN</span>
      {/* Mobile: compact summary */}
      <div className="sm:hidden flex items-center gap-1.5">
        <div className={`w-2 h-2 rounded-full ${anyActive ? 'bg-[#00ff88] shadow-[0_0_6px_rgba(0,255,136,0.5)]' : 'bg-gray-600'}`} />
        <span className={`text-xs ${anyActive ? 'text-[#00ff88]' : 'text-gray-500'}`}>
          {activeCount}/{stationStatuses.length}
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

### Step 3.3: MissionEventsPanel Responsive Width (F11)

**File: `src/hud/MissionEventsPanel.tsx` (line 103)**:

```tsx
// CURRENT:
className="absolute top-full mt-2 right-0 z-40 bg-[rgba(10,10,30,0.92)] backdrop-blur-md border border-[rgba(0,212,255,0.2)] rounded-lg w-[320px] max-h-[70vh] overflow-y-auto shadow-lg"

// NEW:
className="absolute top-full mt-2 right-0 z-[var(--z-dropdown)] bg-[rgba(10,10,30,0.92)] backdrop-blur-md border border-[rgba(0,212,255,0.2)] rounded-lg w-[calc(100vw-1.5rem)] sm:w-[320px] max-h-[70vh] overflow-y-auto shadow-lg"
```

### Step 3.4: TelemetryCard Overflow Fix (F13)

**File: `src/hud/TelemetryCard.tsx`**

**Change A -- Container (line 23)**:

```tsx
// CURRENT:
<div className="bg-[rgba(10,10,30,0.7)] backdrop-blur-sm border border-[rgba(0,212,255,0.2)] rounded-lg px-2 py-2 sm:px-4 sm:py-3 min-w-0 sm:min-w-[140px]">

// NEW:
<div className="bg-[rgba(10,10,30,0.7)] backdrop-blur-sm border border-[rgba(0,212,255,0.2)] rounded-lg px-2 py-2 sm:px-4 sm:py-3 min-w-[100px] sm:min-w-[140px] overflow-hidden">
```

**Change B -- Value span (line 27)**:

```tsx
// CURRENT:
className="text-sm sm:text-xl font-bold font-mono"

// NEW:
className="text-sm sm:text-xl font-bold font-mono tabular-nums"
```

### Step 3.5: CrewPanel Mobile Positioning (F12)

**File: `src/hud/CrewPanel.tsx` (line 22)**:

```tsx
// CURRENT:
className="absolute top-full mt-2 left-0 z-40 bg-[rgba(10,10,30,0.85)] backdrop-blur-sm border border-[rgba(0,212,255,0.2)] rounded-lg p-3 min-w-[200px]"

// NEW:
className="fixed sm:absolute inset-x-3 sm:inset-x-auto bottom-4 sm:bottom-auto sm:top-full sm:mt-2 sm:left-0 z-[var(--z-dropdown)] bg-[rgba(10,10,30,0.85)] backdrop-blur-sm border border-[rgba(0,212,255,0.2)] rounded-lg p-3 min-w-0 sm:min-w-[200px]"
```

### Step 3.6: Safe-Area Insets (F14)

**File: `src/index.css`**

Add after the `#root` block:

```css
/* Safe area insets for notched devices */
@supports (padding-top: env(safe-area-inset-top)) {
  .safe-area-pad {
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
  }
}
```

**File: `src/hud/HUD.tsx` (line 40)**:

Add `safe-area-pad` class to the HUD container. Combined with the z-index change:

```tsx
// After z-index update:
className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2 sm:p-4 z-[var(--z-hud)] safe-area-pad"
```

### Step 3.7: Chat Button Overlap Verification (F4)

F4 is resolved by F2 (Phase 1). The progressive disclosure toggle reduces the mobile bottom HUD to ~130px total height. The chat toggle button at `bottom-6` (24px from bottom) plus its 48px height = 72px from bottom edge. The HUD content starts at the very bottom of the viewport and extends up ~130px. The two do not overlap because:
- Chat toggle: occupies bottom 72px at the right edge
- HUD bottom content: Speed card + Earth card in a 2-column grid + ProgressBar spanning both columns + toggle text

If during testing the button overlaps, adjust the chat toggle button:

```tsx
// Only if overlap is detected:
className="fixed bottom-[10rem] sm:bottom-6 right-3 sm:right-6 z-[var(--z-chat-toggle)] ..."
```

**Verification for Phase 3:**

Run `npm run build`. Chrome DevTools:
1. Open chat + CrewPanel simultaneously -- chat (z-45) renders above CrewPanel (z-40)
2. Tooltips render above everything (z-55)
3. DSN shows "DSN [dot] 1/3" on mobile, full station names on desktop
4. MissionEventsPanel fits within 375px viewport
5. TelemetryCard numbers do not overflow, digits are stable width
6. CrewPanel appears at bottom of screen on mobile, as dropdown on desktop
7. Toggle "Show Frame" in Chrome DevTools to verify safe-area-inset has no negative effects on non-notched devices

---

## Complete File Change Checklist

| # | File | Phase | Status |
|---|------|-------|--------|
| 1 | `src/index.css` | 1, 3 | |
| 2 | `index.html` | 1 | |
| 3 | `src/chat/ChatPanel.tsx` | 1, 3 | |
| 4 | `src/hud/HUD.tsx` | 1, 2, 3 | |
| 5 | `src/hud/SpaceWeatherPanel.tsx` | 2, 3 | |
| 6 | `src/hud/CameraControls.tsx` | 2 | |
| 7 | `src/hud/ProgressBar.tsx` | 2, 3 | |
| 8 | `src/hud/MissionEventsPanel.tsx` | 2, 3 | |
| 9 | `src/hud/AlertItem.tsx` | 2 | |
| 10 | `src/hud/DSNStatus.tsx` | 3 | |
| 11 | `src/hud/TelemetryCard.tsx` | 3 | |
| 12 | `src/hud/CrewPanel.tsx` | 3 | |

**Total**: 12 files modified, 0 new files, 0 deleted files.

---

## Constraints

1. **Desktop layout must not change** -- every change must use `sm:` overrides to preserve desktop behavior
2. **No new npm dependencies** -- use existing Framer Motion and Tailwind v4
3. **No new component files** -- all changes are modifications to existing components
4. **Build must succeed** after each phase -- run `npm run build` to verify
5. **z-index custom properties** must be defined in `@theme` block (Tailwind v4 requirement for design tokens)
6. The `x` character in AlertItem's dismiss button is the Unicode multiplication sign (U+00D7), not the letter "x" -- preserve the existing character

---

## Plan Output Instructions

After completing all 3 phases, write the plan output to:

```
docs/plans/PLAN_2026-04-04_mobile_first_hud.md
```

The plan should contain:
1. Summary of all changes made
2. Files modified with line counts
3. Test results from `npm run build`
4. Screenshots or DevTools measurements at 375px and 640px breakpoints
5. Any deviations from this prompt and why

---

**Implementation Prompt Complete**: 2026-04-04 19:00 UTC
