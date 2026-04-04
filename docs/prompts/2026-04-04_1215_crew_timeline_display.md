# Implementation Prompt: Crew Timeline & Mission Events Display

**Blueprint Reference**: docs/blueprints/2026-04-04_1215_crew_timeline_display.md
**Design Reference**: docs/design/2026-04-04_1201_crew_timeline_display.md

## Context

The ARTEMIS HUD has complete crew and milestone data defined in `src/data/mission-config.ts` but surfaces almost none of it. The `CREW` array (4 members with name, role, agency) has zero consumers. The `MILESTONES` array (9 events from Launch at T+0h to Splashdown at T+240h) is only used for phase name lookup in `getMissionElapsed()`. The ProgressBar shows a percentage with no timeline context. There is no crew information displayed anywhere.

The design analysis evaluated three approaches and recommended **Option A: Integrated Timeline** -- milestone markers on the existing ProgressBar plus a crew dropdown panel triggered from the top bar. This approach scored 8.65/10 in the tradeoff matrix for its minimal screen footprint, natural extension of existing components, and alignment with NASA openMCT consolidated-view patterns.

## Goal

Enhance the ProgressBar with 9 milestone tick marks (colored by completion status) with hover tooltips and a "next milestone" countdown. Add a crew icon button to the top bar that opens a glass-morphism dropdown panel showing all 4 crew members. No new layout regions, no new dependencies, no changes to the data layer.

## Requirements

1. Import `MILESTONES` (and `Milestone` type) from `src/data/mission-config.ts` into `ProgressBar.tsx`
2. Compute milestone positions as `(milestone.missionElapsedHours / 240) * 100`% along the bar
3. Compute milestone status: `complete` if `elapsedHours >= missionElapsedHours`, `current` if it is the active phase (last completed), `upcoming` otherwise
4. Render 9 milestone markers as absolutely-positioned dots within the bar track container
5. Style markers: complete = `bg-hud-green` with subtle shadow, current = `bg-hud-blue` with pulsing glow (`shadow-[0_0_8px_rgba(0,212,255,0.6)]`), upcoming = `bg-gray-600`
6. Show a glass-morphism tooltip on hover/tap of each marker with the milestone name and description
7. Add a "Next: {name} in {Xd Xh Xm}" line below the progress bar, styled `text-[10px] text-hud-blue/70`
8. If all milestones are past, show "Mission Complete" instead of a next-milestone countdown
9. Create `src/hud/CrewPanel.tsx` -- a glass-morphism dropdown panel (`bg-hud-glass backdrop-blur-sm border border-hud-border rounded-lg`) showing 4 rows: each with crew member name (`text-sm font-mono text-white`), role (`text-[10px] uppercase tracking-wider text-gray-400`), and agency
10. Style NASA agency in default gray, CSA agency (Jeremy Hansen) in `text-hud-orange` to visually distinguish
11. CrewPanel accepts `isOpen: boolean` and `onClose: () => void` props; uses `AnimatePresence` + `motion.div` for slide-down/fade animation (`y: -10 -> 0, opacity: 0 -> 1`)
12. Add a crew icon button in `HUD.tsx` top bar, between the title and MissionClock
13. Manage crew panel open/close with `useState<boolean>` in `HUD.tsx`
14. Add a click-outside handler to dismiss the crew panel (transparent overlay when open)
15. Increase ProgressBar `min-w-[140px]` to `min-w-[200px]` for marker spacing
16. Ensure responsive behavior: on mobile (< `sm`), milestone markers are smaller dots without hover labels; crew panel positions correctly
17. Preserve the `pointer-events-none` / `pointer-events-auto` pattern for 3D scene interaction

## Files Likely Affected

**New file (1):**
- `src/hud/CrewPanel.tsx` -- Glass-morphism dropdown panel. Imports `CREW` from `src/data/mission-config.ts`. Renders 4 crew member rows with name, role, agency. Uses `AnimatePresence` + `motion.div` for animation. Props: `isOpen: boolean`, `onClose: () => void`.

**Modified files (2):**
- `src/hud/ProgressBar.tsx` -- Major enhancement:
  - Import `MILESTONES`, `Milestone` from `../data/mission-config`
  - Destructure `totalMs` from `useMission()` (already returned by `getMissionElapsed()`)
  - Compute `elapsedHours = totalMs / (1000 * 60 * 60)` and `TOTAL_MISSION_HOURS = 240` (constant)
  - Map `MILESTONES` to marker data: `{ name, description, position: (hours/240)*100, status }`
  - Determine `currentPhaseIndex` (last milestone where `elapsedHours >= missionElapsedHours`) and `nextMilestone` (first where `elapsedHours < missionElapsedHours`)
  - Make the bar track container `relative` for absolute marker positioning
  - Render markers as `div` elements with `absolute top-1/2 -translate-y-1/2` at `left: {position}%`, width/height 3px (`w-[6px] h-[6px]`) rounded-full, with status-based coloring
  - Current marker: `motion.div` with `animate={{ boxShadow: ['0 0 4px ...', '0 0 10px ...'] }}` for glow pulse, `transition={{ repeat: Infinity, repeatType: 'reverse', duration: 1.5 }}`
  - Tooltip: `useState` for `hoveredMilestone` index. On hover, render a `motion.div` tooltip above the marker with `AnimatePresence` -- glass background, milestone name in `text-[10px] text-white`, description in `text-[9px] text-gray-400`
  - Below the existing `flex items-center gap-2` row, add a new line: `<div className="text-[10px] text-hud-blue/70 mt-1">Next: {name} in {countdown}</div>`
  - Countdown format: compute `remainingHours = nextMilestone.missionElapsedHours - elapsedHours`, convert to `Xd Xh Xm` string
  - Increase container `min-w-[140px]` to `min-w-[200px]`

- `src/hud/HUD.tsx` -- Crew integration:
  - Import `CrewPanel` from `./CrewPanel`
  - Import `useState` from React
  - Add `const [crewOpen, setCrewOpen] = useState(false)` 
  - In the top bar `div` (between title `h1` and `MissionClock`), add a crew icon button:
    ```tsx
    <button onClick={() => setCrewOpen(!crewOpen)} className="pointer-events-auto px-2 py-1 ...">
      {/* inline SVG icon -- 4 small circles or people silhouette */}
    </button>
    ```
  - Render `<CrewPanel isOpen={crewOpen} onClose={() => setCrewOpen(false)} />` positioned absolutely below the icon button
  - For click-outside dismiss: when `crewOpen` is true, render a transparent full-area div behind the panel that calls `setCrewOpen(false)` on click
  - Restructure top bar to accommodate the icon: `<div className="flex items-center gap-2 sm:gap-4">` wrapping title + crew icon on the left, MissionClock on the right

## Implementation Sequence

1. **Create `src/hud/CrewPanel.tsx`** -- Self-contained, no other file changes needed yet. Import `CREW` and `CrewMember` from `../data/mission-config`. Accept `isOpen` and `onClose` props. Wrap content in `AnimatePresence` keyed on `isOpen`. Inner `motion.div` with:
   - `initial={{ opacity: 0, y: -10 }}`
   - `animate={{ opacity: 1, y: 0 }}`
   - `exit={{ opacity: 0, y: -10 }}`
   - `transition={{ duration: 0.2 }}`
   - Glass-morphism container: `bg-hud-glass backdrop-blur-sm border border-hud-border rounded-lg p-3`
   - Header: `text-[10px] uppercase tracking-wider text-gray-400 mb-2` -- "CREW"
   - 4 rows, each with name (`text-sm text-white`), role (`text-[10px] text-gray-400 uppercase tracking-wider`), agency (`text-[10px]`, NASA in `text-gray-500`, CSA in `text-hud-orange`)

2. **Integrate CrewPanel into `src/hud/HUD.tsx`** -- Add state, icon button, panel rendering, and click-outside handler. The crew icon should be a minimal inline SVG (a simple "people" or "users" shape using 2-3 circles and lines). Button style: `text-gray-400 hover:text-hud-blue transition-colors`. When open, add active styling: `text-hud-blue`. Position CrewPanel absolutely: `absolute top-full mt-2 right-0` (or `left-0` depending on layout) relative to a positioned wrapper around the icon.

3. **Enhance `src/hud/ProgressBar.tsx` with milestone markers** -- This is the core change. Steps:
   a. Import `MILESTONES` from `../data/mission-config`
   b. Extract `totalMs` from `useMission()` alongside `progress`
   c. Compute `elapsedHours`, map milestones to position/status objects using `useMemo`
   d. Find `currentPhaseIndex` and `nextMilestone`
   e. Make the bar track div `relative` (it is currently just `flex-1 h-2 bg-... rounded-full overflow-hidden`)
   f. **Important**: the track currently has `overflow-hidden` which would clip the markers. Create a wrapper: outer `relative` div for markers, inner `overflow-hidden` div for the fill bar
   g. Render markers as absolute-positioned round divs at each milestone position
   h. Current milestone marker: `motion.div` with pulsing box-shadow animation

4. **Add milestone tooltips to ProgressBar** -- Track `hoveredIndex` with `useState<number | null>(null)`. On marker `onMouseEnter` / `onMouseLeave` (and `onTouchStart` / `onTouchEnd` for mobile), set `hoveredIndex`. Render tooltip with `AnimatePresence` above the hovered marker. Tooltip content: milestone name + description. Position: `absolute bottom-full mb-2` centered on the marker, with `transform: translateX(-50%)`. Edge-clamp: for the first marker (Launch at 0%), align left; for the last (Splashdown at 100%), align right.

5. **Add next milestone countdown to ProgressBar** -- Below the existing percentage display row, add a conditional line:
   - If `nextMilestone` exists: `Next: {nextMilestone.name} in {formattedCountdown}`
   - If no next milestone (all passed): `Mission Complete`
   - Format countdown: `const hours = remainingHours; const d = Math.floor(hours / 24); const h = Math.floor(hours % 24); const m = Math.floor((hours % 1) * 60);` then `${d}d ${h}h ${m}m`

6. **Responsive pass** -- Verify at `< 640px` (mobile) and `640px+` (desktop):
   - Milestone markers: use `w-1.5 h-1.5 sm:w-[6px] sm:h-[6px]` for smaller dots on mobile
   - Tooltips: on mobile, tooltips may be too wide; constrain to `max-w-[180px]` with text truncation
   - Crew panel: on mobile, position relative to viewport edge rather than icon, ensure it fits within screen width
   - "Next milestone" text: use `text-[9px] sm:text-[10px]` to match the mobile pattern from TelemetryCard
   - ProgressBar `min-w-[200px]`: verify this fits in the `grid-cols-2` mobile layout (each column is ~50% of viewport minus padding)

## Constraints

- No new npm dependencies. Use only `framer-motion` (already installed) and React builtins
- All styling uses existing design tokens: `bg-hud-glass`, `border-hud-border`, `text-hud-blue`, `text-hud-green`, `text-hud-orange`, `bg-hud-green`, `text-gray-400/500/600`
- Do not modify `src/data/mission-config.ts` -- consume `CREW`, `MILESTONES`, `CrewMember`, `Milestone` as exported
- Do not modify `getMissionElapsed()` return type or `useMission()` hook
- Crew panel state is local `useState` in HUD.tsx, not Zustand
- Preserve `pointer-events-none` on HUD container and `pointer-events-auto` on interactive regions
- JetBrains Mono font throughout (inherited from `body`)
- The ProgressBar bar track currently has `overflow-hidden` -- milestone markers must NOT be placed inside the overflow-hidden div, or they will be clipped. Restructure to separate the track from the marker layer
- `MILESTONES` has 9 entries. `MILESTONES[MILESTONES.length - 1].missionElapsedHours` is 240 (same as `MISSION_DURATION_DAYS * 24`). Use 240 as the denominator for position computation
- The `useMission()` hook returns `totalMs` which can be converted to elapsed hours: `totalMs / 3_600_000`

## Acceptance Criteria

- [ ] 9 milestone markers visible on the ProgressBar at correct proportional positions
- [ ] Completed milestones show green dots (`bg-hud-green`)
- [ ] Current milestone shows pulsing cyan dot (`bg-hud-blue` with animated box-shadow)
- [ ] Upcoming milestones show gray dots (`bg-gray-600`)
- [ ] Hovering a marker shows a tooltip with milestone name and description
- [ ] "Next: {milestone} in {countdown}" text appears below the progress bar
- [ ] After all milestones pass, shows "Mission Complete"
- [ ] Crew icon button visible in the top bar
- [ ] Clicking crew icon opens the CrewPanel dropdown
- [ ] CrewPanel shows 4 crew members: Reid Wiseman (Commander, NASA), Victor Glover (Pilot, NASA), Christina Koch (Mission Specialist, NASA), Jeremy Hansen (Mission Specialist, CSA)
- [ ] Jeremy Hansen's CSA agency is displayed in orange
- [ ] CrewPanel animates open/close (slide + fade)
- [ ] Clicking outside CrewPanel dismisses it
- [ ] Glass-morphism styling on all new elements matches existing HUD
- [ ] Mobile (< 640px) renders correctly without layout breakage
- [ ] `npm run build` succeeds with zero TypeScript errors
- [ ] No new dependencies in `package.json`

---

## Plan Output Instructions

**IMPORTANT**: Before creating the implementation plan, you MUST enter plan mode:

1. Call `EnterPlanMode` to enter plan mode
2. Explore the codebase using read-only tools (Read, Grep, Glob)
3. Write the plan to `docs/plans/PLAN_2026-04-04_crew_timeline_display.md`
4. Call `ExitPlanMode` to present the plan for user approval
5. **Wait for user approval** before proceeding to implementation
6. After plan approval, invoke `/wrought-implement` to start the autonomous implementation loop
