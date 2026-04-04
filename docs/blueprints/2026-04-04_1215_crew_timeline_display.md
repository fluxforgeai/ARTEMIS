# Blueprint: Crew Timeline & Mission Events Display

**Date**: 2026-04-04
**Design Reference**: docs/design/2026-04-04_1201_crew_timeline_display.md
**Finding**: F2 in `docs/findings/2026-04-04_1201_post_mvp_visual_data_features_FINDINGS_TRACKER.md`

## Objective

Surface the existing CREW (4 members) and MILESTONES (9 events) data from `src/data/mission-config.ts` into the HUD using Option A (Integrated Timeline) from the design analysis. This means: milestone tick marks on the existing ProgressBar with hover tooltips, a "next milestone" countdown below the bar, and a crew dropdown panel triggered by an icon button in the top bar. No new layout regions -- everything attaches to existing components.

## Requirements

1. Add milestone tick marks to the ProgressBar at proportional x-positions (`missionElapsedHours / 240 * 100`%), each rendered as a small vertical marker
2. Differentiate milestone markers by status: `complete` (green), `current` (cyan pulse), `upcoming` (gray)
3. Show milestone name and description in a tooltip on hover/tap of each marker
4. Display a "Next: {milestone} in {countdown}" line below the progress bar
5. Add a crew icon button in the top bar (between the title and MissionClock)
6. Render a CrewPanel dropdown on click of the crew icon, showing all 4 crew members with name, role, and agency
7. Highlight CSA agency in orange to distinguish from NASA crew
8. Animate CrewPanel open/close with Framer Motion (slide down + fade)
9. Animate the current milestone marker with a glow pulse
10. Match all new elements to existing glass-morphism design system (`bg-hud-glass`, `border-hud-border`, `backdrop-blur-sm`, JetBrains Mono, `text-[10px] uppercase tracking-wider` labels)
11. Maintain responsive behavior: milestone labels hidden on mobile (dots only), crew panel positioned correctly at both breakpoints

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Timeline approach | Integrated (Option A) | Highest weighted score (8.65/10). Minimal screen footprint, extends existing ProgressBar, follows NASA openMCT consolidated-view pattern. See design analysis. |
| Milestone marker rendering | Absolutely-positioned divs inside ProgressBar container | ProgressBar already uses relative positioning for the fill bar. Markers overlay at computed %-positions. No new layout regions. |
| Tooltip implementation | CSS + Framer Motion hover state | No tooltip library needed. A `motion.div` with `AnimatePresence` on hover/focus provides glass-morphism tooltips matching existing design. |
| Crew panel toggle state | Local `useState` in HUD.tsx | No cross-component consumers need crew panel state. Zustand would be over-engineering. Can promote later if needed. |
| Next milestone computation | Derived in ProgressBar from `useMission()` + `MILESTONES` import | Keeps `getMissionElapsed()` pure (returns primitives only). Avoids adding object references to the 1s-interval return value. |
| Milestone status logic | Computed from `elapsedHours` vs `missionElapsedHours` | Same pattern already used in `getMissionElapsed()` for `currentPhase`. Reuses the elapsed hours math. |
| CrewPanel placement | Absolute-positioned dropdown from top bar | Design analysis specifies crew info as on-demand. Dropdown floats above HUD content without disrupting layout. Dismissed on outside click or re-click. |
| Crew icon | Inline SVG (Users/People icon) | Avoid adding an icon library dependency. A simple 4-dot or silhouette SVG in the existing monospace/geometric style. |

## Scope

### In Scope
- Milestone tick marks on ProgressBar (9 markers at proportional positions)
- Milestone status coloring (complete/current/upcoming)
- Current milestone glow pulse animation
- Milestone tooltip on hover showing name + description
- "Next milestone" countdown text below progress bar
- Crew icon button in top bar
- CrewPanel dropdown with 4 crew members (name, role, agency)
- Agency color differentiation (CSA in orange, NASA in default)
- Framer Motion animations (crew panel enter/exit, milestone pulse)
- Responsive behavior (mobile: dots only, no milestone labels; desktop: dots + tooltip on hover)

### Out of Scope
- 3D milestone markers on the trajectory path (stretch goal for later)
- Crew member photos/avatars (no image assets exist)
- Crew bios or detailed profiles (data model has name/role/agency only)
- Milestone approach notifications/toasts (F3 alert system would handle this)
- Sidebar or modal timeline view (rejected in design analysis)
- Zustand state for crew panel toggle
- Changes to `getMissionElapsed()` return type

## Files Likely Affected

- `src/hud/ProgressBar.tsx` -- Major enhancement. Import `MILESTONES` from `mission-config.ts`. Compute milestone positions and statuses from `useMission()` elapsed data. Render milestone markers as absolutely-positioned `div` elements within the bar container. Add "Next milestone" countdown line below the bar. Increase `min-w-[140px]` to `min-w-[200px]` for marker spacing. Add milestone tooltip on hover.
- `src/hud/CrewPanel.tsx` -- **New file**. Glass-morphism dropdown panel listing 4 crew members in a compact table layout. Props: `isOpen: boolean`, `onClose: () => void`. Uses `AnimatePresence` + `motion.div` for enter/exit animation. Imports `CREW` directly from `mission-config.ts`.
- `src/hud/HUD.tsx` -- Add `useState` for `crewPanelOpen`. Add crew icon button in top bar between title and MissionClock. Render `CrewPanel` conditionally with positioning relative to the icon. Add click-outside handler to dismiss crew panel.
- `src/hud/MissionClock.tsx` -- No changes required. The crew icon goes in HUD.tsx, not MissionClock, to keep MissionClock a pure display component.
- `src/index.css` -- No changes required. All needed tokens already exist (`--color-hud-blue`, `--color-hud-green`, `--color-hud-orange`, `--color-hud-glass`, `--color-hud-border`).
- `src/data/mission-config.ts` -- No changes required. CREW, MILESTONES, and Milestone interface are already exported and ready to consume.
- `src/hooks/useMission.ts` -- No changes required. Already returns `progress` (0-100) and `currentPhase` (string). ProgressBar can compute elapsed hours from `progress * 2.4` (since 100% = 240h).

## Implementation Sequence

1. **CrewPanel.tsx** -- Create the new component first since it is self-contained with no dependencies on other changes. Import `CREW` from `mission-config.ts`. Render a glass-morphism panel with `motion.div` + `AnimatePresence`. Style with existing design tokens. This can be visually tested in isolation.

2. **HUD.tsx crew integration** -- Add `useState<boolean>` for crew panel toggle. Add the crew icon button in the top bar. Render `CrewPanel` with absolute positioning. Add click-outside dismiss logic (a transparent overlay div behind the panel when open). This completes the crew feature end-to-end.

3. **ProgressBar.tsx milestone markers** -- The core enhancement. Import `MILESTONES` and `Milestone` from `mission-config.ts`. Destructure additional data from `useMission()` (need `totalMs` to compute elapsed hours). Compute `elapsedHours = totalMs / (1000 * 60 * 60)`. Map milestones to `{ name, position, status, description }`. Render markers as absolutely-positioned dots within a new `relative` wrapper around the bar track. Add current-milestone glow pulse with `motion.div animate`. Widen `min-w` from `140px` to `200px`.

4. **ProgressBar.tsx milestone tooltips** -- Add hover state per marker. On hover, show a glass-morphism tooltip above the marker with milestone name + description. Use `AnimatePresence` for enter/exit. Position tooltip centered above the dot, with edge-clamping to prevent overflow.

5. **ProgressBar.tsx next milestone countdown** -- Below the progress bar percentage line, add a "Next: {name} in {Xd Xh Xm}" text. Compute from `elapsedHours` vs next milestone's `missionElapsedHours`. Format the remaining hours into days/hours/minutes. If all milestones passed, show "Mission Complete". Style with `text-[10px] text-hud-blue/70`.

6. **Responsive adjustments** -- Verify mobile rendering. On `< sm` screens: milestone dots should be smaller (2px vs 3px), tooltip only on tap (not hover), crew panel may need adjusted positioning. Test the `min-w-[200px]` increase does not break the 2-column mobile grid.

## Dependencies & Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Milestone markers overlap on narrow ProgressBar | Medium | Low | Markers are 3-4px dots, not labels. At 200px width, 9 dots with uneven spacing will not overlap. Tooltips appear on hover, not inline. |
| Crew panel not discoverable | Medium | Low | Icon button is always visible in top bar. Accepted tradeoff from design analysis. Can add persistent mini-badges later if needed. |
| ProgressBar min-width increase breaks mobile grid | Low | Medium | Test on 2-column grid. Current grid uses `grid-cols-2` with no explicit widths -- 200px should fit in a 50% column on 360px+ screens. Fall back to 180px if needed. |
| Click-outside handler interferes with 3D scene | Low | Low | The `pointer-events-none` on the HUD container already isolates interactive regions. The dismiss overlay only covers the top bar area, not the full viewport. |
| Tooltip position overflows viewport edge | Low | Low | Clamp tooltip x-position to stay within ProgressBar bounds. First and last milestones (Launch at 0%, Splashdown at 100%) need edge-aware positioning. |
| Framer Motion re-renders on 1s useMission tick | Low | Medium | Milestone markers use static positions (derived from constant MILESTONES array). Only the current-milestone status changes when a milestone boundary is crossed (rare). Memoize the milestone position computation. |

## Acceptance Criteria

- [ ] 9 milestone markers are visible on the ProgressBar at correct proportional positions
- [ ] Completed milestones show green dots, current milestone shows pulsing cyan dot, upcoming milestones show gray dots
- [ ] Hovering a milestone marker shows a tooltip with the milestone name and description
- [ ] "Next: {milestone} in {countdown}" text appears below the progress bar
- [ ] A crew icon button is visible in the top bar
- [ ] Clicking the crew icon opens a dropdown panel showing all 4 crew members
- [ ] Each crew member shows name, role, and agency
- [ ] CSA agency (Jeremy Hansen) is visually distinguished with orange text
- [ ] Crew panel animates open/close with Framer Motion
- [ ] Clicking outside the crew panel dismisses it
- [ ] All elements use the existing glass-morphism design system (glass background, cyan border, JetBrains Mono font)
- [ ] Mobile rendering does not break -- milestone dots render without labels, crew panel is accessible
- [ ] `npm run build` succeeds with no TypeScript errors
- [ ] No new dependencies added (only `framer-motion` already in use)

## Constraints

- No new npm dependencies -- use only `framer-motion` (already installed) and native React/CSS
- All styling must use existing design tokens from `src/index.css` (`--color-hud-*` variables, `bg-hud-glass`, `border-hud-border`, etc.)
- `src/data/mission-config.ts` must not be modified -- consume CREW and MILESTONES as-is
- `getMissionElapsed()` return type must not change -- compute derived milestone data in the consuming component
- CrewPanel state must be local `useState`, not Zustand (no cross-component consumers)
- `pointer-events-none` / `pointer-events-auto` pattern must be preserved on HUD for 3D scene interaction
- Must work at both the `sm:` breakpoint (640px+) and mobile (< 640px) viewports
- JetBrains Mono font for all text (already set on `body`)

## Debug Strategy

- **Self-debug**: enabled
- **Verifier**: `npm run build`
- **Max iterations**: 3
- **Completion criteria**: Milestone markers visible on progress bar with correct status coloring, tooltips functional on hover, "next milestone" countdown displayed, crew panel opens/closes from top bar icon, all 4 crew members rendered with correct data
- **Escape hatch**: After 3 iterations, document blockers and request human review
- **Invoke with**: `/wrought-implement`
