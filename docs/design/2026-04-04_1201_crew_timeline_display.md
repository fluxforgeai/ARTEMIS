# Design Analysis: Crew Timeline & Mission Events Display

**Date**: 2026-04-04 12:01 UTC
**Analyst**: Claude Code (Session 4)
**Mode**: Tradeoff (from-scratch)
**Finding**: F2 in `docs/findings/2026-04-04_1201_post_mvp_visual_data_features_FINDINGS_TRACKER.md`

---

## Executive Summary

The ARTEMIS HUD has complete crew and milestone data defined in `mission-config.ts` but surfaces almost none of it -- the ProgressBar shows a percentage with no milestone context, and crew data is never rendered. This analysis evaluates three approaches for surfacing this data within the existing glass-morphism HUD, recommending **Option A (Integrated Timeline)** for its minimal screen footprint, natural extension of existing components, and strongest alignment with mission-control dashboard conventions.

---

## Current State Analysis

### Data Available (fully defined, ready to consume)

**CREW array** (`src/data/mission-config.ts` lines 13-18):
- 4 members: Reid Wiseman (Commander, NASA), Victor Glover (Pilot, NASA), Christina Koch (Mission Specialist, NASA), Jeremy Hansen (Mission Specialist, CSA)
- Fields: `name`, `role`, `agency`
- Currently imported by: **nothing** -- zero consumers

**MILESTONES array** (`src/data/mission-config.ts` lines 26-36):
- 9 events from Launch (T+0h) to Splashdown (T+240h)
- Fields: `name`, `missionElapsedHours`, `description`
- Currently consumed by: `getMissionElapsed()` only -- for phase name string lookup

### Current Display

| Component | What it shows | What it omits |
|-----------|--------------|---------------|
| MissionClock | `M+ DD:HH:MM:SS` + phase name text | No timeline context, no next-milestone ETA |
| ProgressBar | Percentage bar (0-100%) | No milestone tick marks, no event labels |
| TelemetryCards | Speed, Earth dist, Moon dist | No crew info anywhere |
| DSNStatus | 3 ground stations | -- |
| CameraControls | 4 view presets | -- |

### HUD Layout Structure

The HUD is a full-viewport overlay (`absolute inset-0`) with:
- **Top bar**: Title (left) + MissionClock (right)
- **Bottom section**: DSN + CameraControls row, then Telemetry grid (Speed, Earth, Moon, ProgressBar)
- **Middle area**: Empty -- the 3D scene shows through
- **Breakpoint**: Single `sm:` breakpoint. Mobile uses 2-column grid + stacked columns. Desktop uses flex row.
- **Pointer events**: `pointer-events-none` on container, `pointer-events-auto` on interactive regions

### Design System (from `src/index.css`)

| Token | Value | Usage |
|-------|-------|-------|
| `--color-hud-glass` | `rgba(10, 10, 30, 0.7)` | Panel backgrounds |
| `--color-hud-border` | `rgba(0, 212, 255, 0.2)` | Panel borders |
| `--color-hud-blue` | `#00d4ff` | Primary accent (cyan) |
| `--color-hud-orange` | `#ff8c00` | Secondary accent |
| `--color-hud-green` | `#00ff88` | Active/success state |
| Font | JetBrains Mono | Monospace throughout |

Panel pattern: `bg-hud-glass backdrop-blur-sm border border-hud-border rounded-lg` with `text-[10px] uppercase tracking-wider text-gray-400` labels.

---

## External Research (2026 Sources)

### NASA Mission Control Conventions

NASA's **Open MCT** (Open Mission Control Technologies) uses composable UI objects where timelines, telemetry, and activities can be dragged into display layouts. Key patterns:
- **Horizontal timelines** with event markers at proportional positions
- **Consolidated views** -- timeline sits alongside telemetry data streams, not in a separate page
- **In-progress indicators** -- events show "in-progress" state when active, not just past/future binary
- Source: [Open MCT Documentation](https://nasa.github.io/openmct/) | [NASA Technical Reports](https://ntrs.nasa.gov/api/citations/20160006385/downloads/20160006385.pdf)

### Space Mission Dashboard Patterns (2026)

The T-Minus Zero Artemis tracker and similar 2026 dashboards surface crew profiles and mission timelines as first-class dashboard elements alongside trajectory visualization. The pattern is to embed crew and timeline in the main viewport rather than hiding them behind navigation.
- Source: [T-Minus Zero Artemis Dashboard](https://www.tminuszero.app/artemis) | [Artemis II Tracker](https://jasperbernaers.com/artemis-ii-tracker/)

### React Timeline Component Patterns

**Animata Animated Timeline** -- A Framer Motion-based vertical timeline with hover interactions and dot progression indicators. Events animate into view with stagger effects.
- Source: [Animata Timeline](https://animata.design/docs/progress/animatedtimeline)

**Motion (formerly Framer Motion)** provides `useAnimate` for imperative timeline sequencing and `useScroll`/`useInView` for scroll-linked animations. The `motion.div` component with `animate` prop handles layout animations natively.
- Source: [Motion.dev](https://motion.dev/) | [Framer Motion Guide 2026](https://inhaq.com/blog/framer-motion-complete-guide-react-nextjs-developers)

**Syncfusion React Timeline** -- Horizontal layout with milestone markers, progress tracking, and customizable dot/connector styles. Demonstrates the "progress bar with markers" pattern.
- Source: [Syncfusion Timeline](https://www.syncfusion.com/blogs/post/react-timeline-component)

### Dashboard Design Principles (2026)

Modern dashboards emphasize "less is more" -- showing only the most important data. Progressive disclosure (summary first, details on demand) is the dominant pattern for dense operational dashboards.
- Source: [Dashboard Design Principles 2026](https://www.designrush.com/agency/ui-ux-design/dashboard/trends/dashboard-design-principles) | [Muzli Dashboard Inspiration](https://muz.li/blog/best-dashboard-design-examples-inspirations-for-2026/)

---

## Options Analysis

### Option A: Integrated Timeline (Enhanced ProgressBar + Crew Panel)

**Description**: Extend the existing ProgressBar with milestone tick marks and a "next milestone" indicator. Add a compact crew strip that appears on hover/tap of a crew icon in the top bar. No new layout regions -- everything attaches to existing components.

**Wireframe-in-words**:
```
TOP BAR (existing):
  [ARTEMIS II]                    [crew-icon] [M+ 03:22:14:07  Return Coast]
                                       |
                                  (on click/hover)
                                  +---------------------------------+
                                  | Reid Wiseman    Commander  NASA |
                                  | Victor Glover   Pilot      NASA |
                                  | Christina Koch  MS         NASA |
                                  | Jeremy Hansen   MS         CSA  |
                                  +---------------------------------+

BOTTOM BAR (enhanced ProgressBar):
  Mission Progress
  [===|=|====|=======|======*===========|==|] 58.4%
   ^   ^     ^       ^      ^           ^  ^
   L  OI    TLI    SMSep  OC(now)      LF RC EI SD

  Next: Lunar Flyby in 1d 12h 33m
```

The ProgressBar gains milestone tick marks (small vertical lines at proportional x-positions). The current position is highlighted with a glowing dot. Below the bar, a single line shows the next upcoming milestone with a countdown. The crew panel is a glass-morphism dropdown from a small icon near the MissionClock, keeping it accessible but not permanently consuming space.

**Implementation approach**:
- Enhance `ProgressBar.tsx` -- compute milestone positions as `(milestone.missionElapsedHours / 240) * 100`%, render tick marks as small `div` elements positioned absolutely within the bar container
- New `MilestoneMarker` sub-component -- positioned dot with tooltip on hover showing milestone name + description
- New `CrewPanel.tsx` -- 4-row compact table with glass-morphism styling, toggled by a crew icon button
- Add `nextMilestone` computation to `getMissionElapsed()` or compute in component
- Framer Motion: `AnimatePresence` for crew panel enter/exit, `motion.div` with `layoutId` for milestone glow pulse

**Pros**:
- Minimal screen real estate -- no new layout regions; ProgressBar stays in its existing grid slot
- Natural extension of existing components -- familiar to users who already read the progress bar
- Follows NASA openMCT pattern of consolidated views with timeline alongside telemetry
- Crew panel is on-demand, preserving the 3D viewport for the primary experience
- Lowest implementation effort

**Cons**:
- ProgressBar is narrow (min-w-[140px]) -- milestone labels may overlap on desktop, impossible on mobile
- Crew panel as a dropdown may feel hidden -- users might not discover it without onboarding
- Limited space for milestone descriptions (tooltip only)

**Effort**: Small (2-3 components modified, 1 new component, ~150-200 lines)

---

### Option B: Dedicated Sidebar Panel

**Description**: A collapsible vertical panel on the left or right edge of the screen containing a full vertical timeline with milestone cards and crew profiles below. Toggled by a tab/button on the edge.

**Wireframe-in-words**:
```
+--[TAB]--------------------------------------------+
|  |        |                                        |
|  | CREW   |          3D SCENE                      |
|  |--------|                                        |
|  | [pic]  |                                        |
|  | Reid   |                                        |
|  | CMD    |                                        |
|  | ...x4  |                                        |
|  |--------|                                        |
|  |TIMELINE|                                        |
|  |--------|                                        |
|  | * Launch         T+0h    [done]                 |
|  | | Orbital Ins.   T+0.15h [done]                 |
|  | | TLI            T+2h    [done]                 |
|  | | SM Sep         T+2.5h  [done]                 |
|  | | Outbound       T+24h   [done]                 |
|  | o Lunar Flyby    T+96h   [NEXT] <-- glow        |
|  | | Return Coast   T+144h  [pending]              |
|  | | Entry          T+228h  [pending]              |
|  | | Splashdown     T+240h  [pending]              |
|  |        |         [TOP/BOTTOM HUD unchanged]     |
+--+--------+---------------------------------------+
```

The panel is ~240-280px wide, slides in from the left with Framer Motion `animate={{ x }}`. Each milestone shows a vertical line connecting dots. Completed milestones have green dots, current has a pulsing cyan dot, future milestones are gray. Crew section at the top shows 4 compact cards. The panel has the standard glass-morphism background.

**Implementation approach**:
- New `SidePanel.tsx` -- container with slide animation, toggle button
- New `VerticalTimeline.tsx` -- maps over MILESTONES, computes status (past/current/future) from `useMission()`, renders connected dot-line-dot chain
- New `CrewCard.tsx` -- compact card per crew member (name, role, agency badge)
- Modify `HUD.tsx` -- add SidePanel to layout, manage open/closed state (Zustand or local)
- Framer Motion: `motion.div` with `animate={{ x }}` for panel slide, `AnimatePresence` for mount/unmount, staggered `initial/animate` on timeline items

**Pros**:
- Rich display -- room for full milestone descriptions, crew bios, agency badges
- Vertical timeline is a natural fit for chronological mission events (top-to-bottom = past-to-future)
- Clear discoverability via edge tab
- Follows the Animata/Syncfusion vertical timeline pattern with progression indicators
- Room to grow -- space weather alerts (F3) could be added to the same panel later

**Cons**:
- Consumes 240-280px of horizontal viewport when open -- significant on smaller screens
- Obscures part of the 3D scene and trajectory, which is the primary content
- On mobile (< 640px), the panel would need to be full-width overlay, changing the interaction model
- Higher effort -- 3 new components, state management additions
- Sidebar pattern may feel like a "settings drawer" rather than mission-critical information

**Effort**: Medium (3 new components, HUD layout change, state management, ~300-400 lines)

---

### Option C: Overlay Modal

**Description**: A full-screen or centered modal overlay showing the timeline and crew information, triggered by a button in the HUD. The modal dims the 3D scene background and shows a rich, detailed view.

**Wireframe-in-words**:
```
+------------------------------------------------------+
|  [ARTEMIS II]          [CREW & TIMELINE btn]  [clock] |
|                                                        |
|          +------- CREW & TIMELINE --------+            |
|          |                                 |            |
|          |  CREW                           |            |
|          |  [Wiseman] [Glover] [Koch] [Hansen]         |
|          |  CMD       PLT     MS1     MS2  |            |
|          |                                 |            |
|          |  MISSION TIMELINE               |            |
|          |  [====*========================] |            |
|          |  L  OI TLI SMS  OC   LF  RC EI SD           |
|          |                                 |            |
|          |  > Launch          T+0h   DONE  |            |
|          |  > Orbital Ins.    T+0.15 DONE  |            |
|          |  ...                             |            |
|          |  * Lunar Flyby     T+96h  NEXT  |            |
|          |  ...                             |            |
|          |                        [Close]  |            |
|          +---------------------------------+            |
|                                                        |
|  [DSN] [Camera Controls]                               |
|  [Speed] [Earth] [Moon] [Progress]                     |
+------------------------------------------------------+
```

A centered modal with glass-morphism styling, backdrop blur over the 3D scene. Shows both horizontal timeline overview and detailed milestone list. Crew displayed as a row of cards at the top. Dismissed by close button, clicking backdrop, or pressing Escape.

**Implementation approach**:
- New `MissionOverlay.tsx` -- modal container with backdrop, AnimatePresence for enter/exit
- New `TimelineDetail.tsx` -- horizontal mini-timeline + vertical detailed list
- New `CrewRow.tsx` -- horizontal row of 4 crew cards
- Modify `HUD.tsx` -- add trigger button to top bar
- Modify `mission-store.ts` -- add `timelineOpen: boolean` + `toggleTimeline()` (or use local state)
- Framer Motion: `motion.div` with scale/opacity animation for modal, backdrop fade

**Pros**:
- Maximum space for content -- crew bios, milestone descriptions, both timeline views
- Zero impact on HUD layout when closed
- Familiar modal interaction pattern -- all users know how to dismiss
- Clean separation -- timeline/crew is a "detail view" rather than always-on HUD clutter

**Cons**:
- **Interrupts the real-time experience** -- user loses sight of the 3D scene, telemetry, and progress while viewing the modal. In a mission tracker, this feels wrong -- the timeline should complement the live view, not replace it
- Extra click to access; not "glanceable" like a HUD element should be
- Against NASA openMCT's consolidated-view philosophy -- mission operators need concurrent visibility
- Modal = context switch, which violates dashboard design principles of "at-a-glance" information
- If opened frequently, the open/close cycle becomes tedious

**Effort**: Medium (3 new components, state change, ~250-350 lines)

---

### Baseline: Current (Text-Only Phase Name)

**Assessment**: The current display shows `Return Coast` as a text label next to the mission clock. This tells the user which phase they are in, but provides zero context about:
- What phases exist in total (no awareness of the full mission arc)
- How far through the current phase they are
- When the next milestone occurs (no countdown or ETA)
- Who the crew is (no crew information anywhere)
- What has already been completed (no completed/upcoming distinction)

The baseline is functional for a single data point but fails the "situational awareness" goal of a mission dashboard. Users must already know the Artemis II mission timeline to contextualize the phase name.

---

## Trade-Off Matrix

| Criterion | Weight | Option A: Integrated | Option B: Sidebar | Option C: Overlay | Baseline |
|-----------|--------|---------------------|-------------------|-------------------|----------|
| **UX clarity** (glanceability, discoverability) | 35% | 8/10 -- milestone markers visible at all times, crew one-click away | 7/10 -- rich when open, but hidden when closed | 5/10 -- full detail but interrupts live view | 2/10 -- single text label |
| **Visual fit** (space theme, glass-morphism, existing patterns) | 25% | 9/10 -- extends existing ProgressBar and MissionClock styling | 8/10 -- uses same glass panels but new layout region | 7/10 -- glass modal fits theme but overlay pattern is generic | 6/10 -- fits but underutilizes the design language |
| **Simplicity** (implementation effort, code complexity) | 20% | 9/10 -- enhances 2 existing components, 1 new component | 5/10 -- 3 new components, layout restructure, state management | 6/10 -- 3 new components, simpler layout impact | 10/10 -- already done |
| **Screen space efficiency** | 20% | 9/10 -- no new regions, crew panel is on-demand | 5/10 -- 240px sidebar when open | 8/10 -- zero impact when closed, full takeover when open | 10/10 -- no change |
| **Weighted Score** | -- | **8.6** | **6.5** | **6.3** | **5.8** |

Scoring breakdown:
- **Option A**: (8 x 0.35) + (9 x 0.25) + (9 x 0.20) + (9 x 0.20) = 2.80 + 2.25 + 1.80 + 1.80 = **8.65**
- **Option B**: (7 x 0.35) + (8 x 0.25) + (5 x 0.20) + (5 x 0.20) = 2.45 + 2.00 + 1.00 + 1.00 = **6.45**
- **Option C**: (5 x 0.35) + (7 x 0.25) + (6 x 0.20) + (8 x 0.20) = 1.75 + 1.75 + 1.20 + 1.60 = **6.30**
- **Baseline**: (2 x 0.35) + (6 x 0.25) + (10 x 0.20) + (10 x 0.20) = 0.70 + 1.50 + 2.00 + 2.00 = **6.20**

---

## Recommendation

**Option A: Integrated Timeline** is the recommended approach.

### Rationale

1. **Glanceability**: Milestone markers on the ProgressBar give users instant visual context about mission progression without any interaction. This aligns with the NASA openMCT principle that mission-critical timelines should be visible alongside telemetry, not hidden behind drawers or modals.

2. **Minimal disruption**: The 3D scene is the centerpiece of ARTEMIS. Option A adds information without consuming viewport space -- the ProgressBar already exists in the bottom telemetry grid, and the crew panel only appears on demand.

3. **Lowest risk**: Enhancing existing components (ProgressBar, MissionClock) is safer than introducing new layout regions. The existing `sm:` breakpoint pattern extends naturally to milestone markers (hide labels on mobile, show dots only).

4. **Extensibility**: The milestone markers on ProgressBar create natural anchor points for future features -- F3 (Space Weather Alerts) could add warning indicators at specific timeline positions, and milestone approach notifications could trigger from the same "next milestone" computation.

5. **Effort-to-value ratio**: ~150-200 lines of code for a substantial UX improvement, compared to 300-400 lines for Option B with more layout risk.

### Enhancement for later consideration

If user testing reveals the crew dropdown is not discoverable enough, Option A can evolve toward a hybrid by adding a persistent mini crew strip (4 small role badges) in the top bar without requiring a full Option B sidebar. This is additive, not a rearchitecture.

---

## Impact Assessment

### New components needed
- `CrewPanel.tsx` -- Glass-morphism dropdown showing 4 crew members in a compact table. Toggled by a crew icon button in the top bar.

### Existing components modified
- `ProgressBar.tsx` -- Add milestone tick marks as absolutely-positioned elements within the bar. Add "next milestone" countdown text below the bar. Import MILESTONES from mission-config.
- `MissionClock.tsx` -- Add crew icon toggle button adjacent to the phase name. (Alternatively, place the crew trigger in HUD.tsx directly.)
- `HUD.tsx` -- Add CrewPanel with positioning relative to the top bar. May need state for crew panel open/close.

### State management changes
- `getMissionElapsed()` in `mission-config.ts` -- Add `nextMilestone` and `msUntilNext` to the return value (or compute in component to keep the function pure)
- Local React state (`useState`) for crew panel toggle -- Zustand not required since this is a UI-only toggle with no cross-component consumers. If the chat or other features later need to reference crew panel state, promote to Zustand at that point.

### Screen layout impact
- **Desktop**: ProgressBar width may need to increase slightly (from `min-w-[140px]` to `min-w-[200px]`) to accommodate milestone markers. The bottom telemetry grid has room for this -- it currently uses `sm:flex` with no max-width. Crew panel floats above the top bar as an absolute-positioned dropdown.
- **Mobile**: Milestone markers render as small dots only (no labels) on `< sm` screens. Crew panel could render as a bottom sheet instead of a dropdown for better touch targets. The "next milestone" text below the bar uses the existing `text-[9px]` mobile pattern.

---

## Component Sketch

### Component Hierarchy

```
HUD.tsx
  |-- (top bar)
  |   |-- Title "ARTEMIS II"
  |   |-- CrewToggle (icon button)   <-- NEW
  |   |   |-- CrewPanel (dropdown)   <-- NEW (conditional render)
  |   |-- MissionClock (existing)
  |
  |-- (bottom section)
      |-- DSNStatus + CameraControls (existing)
      |-- Telemetry grid
          |-- SpeedCard, EarthDistCard, MoonDistCard (existing)
          |-- ProgressBar (ENHANCED)
              |-- MilestoneMarkers (inline)  <-- NEW (sub-component or inline mapping)
              |-- NextMilestone (text line)  <-- NEW (sub-component or inline)
```

### Data Flow

```
mission-config.ts
  |-- MILESTONES (static array, 9 events)
  |-- CREW (static array, 4 members)
  |-- getMissionElapsed() -> { progress, currentPhase, ... }
       |
useMission.ts (hook, ticks every 1s)
       |
       v
ProgressBar.tsx
  |-- progress (number 0-100)
  |-- MILESTONES.map(m => ({
  |     name: m.name,
  |     position: (m.missionElapsedHours / 240) * 100,
  |     status: elapsed >= m.hours ? 'complete' : nextMilestone === m ? 'next' : 'pending'
  |   }))
  |-- nextMilestone: first milestone where hours > elapsedHours
  |-- timeUntilNext: milestone.hours - elapsedHours (formatted as Xd Xh Xm)

CrewPanel.tsx
  |-- CREW (direct import, static)
  |-- isOpen (local state from parent or own toggle)
```

### Key Props / Interfaces

```typescript
// Internal to enhanced ProgressBar -- not necessarily a separate component
interface MilestoneMarkerData {
  name: string;
  position: number;         // 0-100 percentage along bar
  status: 'complete' | 'current' | 'upcoming';
  description: string;
}

// CrewPanel props (if controlled by parent)
interface CrewPanelProps {
  isOpen: boolean;
  onClose: () => void;
}
```

### Animation Plan

| Element | Animation | Library |
|---------|-----------|---------|
| Milestone tick marks | Fade in on mount, subtle pulse on "current" | Framer Motion `animate` |
| Current milestone dot | Glow pulse (`boxShadow` oscillation with `transition.repeat`) | Framer Motion `animate` |
| Crew panel | Slide down + fade in (`y: -10 -> 0, opacity: 0 -> 1`) | Framer Motion `AnimatePresence` |
| Next milestone text | Crossfade when milestone changes | Framer Motion `AnimatePresence` with `mode="wait"` |
| Progress bar fill | Existing spring animation (unchanged) | Framer Motion `motion.div` |

### Styling Tokens (from existing design system)

| Element | Style |
|---------|-------|
| Completed milestone dot | `bg-hud-green` (#00ff88) with subtle shadow |
| Current milestone dot | `bg-hud-blue` (#00d4ff) with pulsing `shadow-[0_0_8px_rgba(0,212,255,0.6)]` |
| Upcoming milestone dot | `bg-gray-600` |
| Milestone connector line | `bg-[rgba(255,255,255,0.1)]` (matches bar track) |
| Crew panel background | `bg-hud-glass backdrop-blur-sm border border-hud-border rounded-lg` |
| Crew name | `text-sm font-mono text-white` |
| Crew role | `text-[10px] uppercase tracking-wider text-gray-400` |
| Agency badge (CSA) | `text-[9px] text-hud-orange` to distinguish from NASA crew |
| Next milestone countdown | `text-[10px] text-hud-cyan/70` |

---

## Sources

### External
- [Open MCT -- NASA Mission Control Framework](https://nasa.github.io/openmct/)
- [NASA Next-Gen Visualization Software (Technical Report)](https://ntrs.nasa.gov/api/citations/20160006385/downloads/20160006385.pdf)
- [T-Minus Zero Artemis Dashboard](https://www.tminuszero.app/artemis)
- [Artemis II Real-Time Tracker](https://jasperbernaers.com/artemis-ii-tracker/)
- [Motion (Framer Motion) Documentation](https://motion.dev/)
- [Framer Motion Complete Guide 2026](https://inhaq.com/blog/framer-motion-complete-guide-react-nextjs-developers)
- [Animata Animated Timeline Component](https://animata.design/docs/progress/animatedtimeline)
- [Syncfusion React Timeline Component](https://www.syncfusion.com/blogs/post/react-timeline-component)
- [Dashboard Design Principles 2026](https://www.designrush.com/agency/ui-ux-design/dashboard/trends/dashboard-design-principles)
- [Dashboard Design Inspiration (Muzli)](https://muz.li/blog/best-dashboard-design-examples-inspirations-for-2026/)
- [Recreating NASA Mission Control UI](https://www.juancarlos.tech/blog/recreating-nasas-ui-for-their-mission-control-tech)

### Codebase Files
- `src/data/mission-config.ts` -- CREW, MILESTONES, getMissionElapsed()
- `src/hud/HUD.tsx` -- Layout structure
- `src/hud/ProgressBar.tsx` -- Current progress display
- `src/hud/MissionClock.tsx` -- Current phase name display
- `src/hud/TelemetryCard.tsx` -- Styling reference (glass-morphism pattern)
- `src/hud/DSNStatus.tsx` -- Status indicator pattern (green dot + text)
- `src/hud/CameraControls.tsx` -- Button toggle pattern
- `src/hooks/useMission.ts` -- Mission data hook (1s interval)
- `src/store/mission-store.ts` -- Zustand global state
- `src/index.css` -- Design tokens (@theme block)

---

**Analysis Complete**: 2026-04-04 12:01 UTC
