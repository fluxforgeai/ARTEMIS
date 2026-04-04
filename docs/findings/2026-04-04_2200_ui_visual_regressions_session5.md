**2026-04-04 22:00 UTC**

# UI & Visual Regressions -- Session 5 Screenshot Review

**Observed by**: User (screenshot review)
**Date**: 2026-04-04
**Session**: 5

---

## F1: ProgressBar "MISSION PROGRESS" Overlays the AI Chatbot Panel

**What Was Found**:
The ProgressBar component visually overlays the ChatPanel when the chatbot is open. The "MISSION PROGRESS" bar renders on top of the chat panel's lower portion, obscuring chat content. This is a recurring issue -- it was addressed as part of the Session 4 mobile responsiveness work (F4/F9 in the frontend responsiveness tracker) but has regressed or was not fully resolved on desktop.

**Where**:
- `src/hud/HUD.tsx:99` -- primary telemetry grid: `grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-3 pointer-events-auto`
- `src/hud/ProgressBar.tsx:72` -- container: `bg-[rgba(10,10,30,0.7)] backdrop-blur-sm ... col-span-2 sm:col-span-1 sm:flex-1`
- `src/chat/ChatPanel.tsx:46` -- chat panel: `fixed ... bottom-20 z-[var(--z-chat)] ... sm:right-6 sm:w-[360px]`
- `src/index.css:16-22` -- z-index hierarchy: `--z-hud:10`, `--z-chat:45`

**Evidence**:
- HUD container at `z-[var(--z-hud)]` (10) should be below ChatPanel at `z-[var(--z-chat)]` (45)
- ProgressBar has `sm:flex-1` causing it to stretch rightward across the full bottom bar width
- On desktop, the ProgressBar's right edge physically overlaps the ChatPanel positioned at `sm:right-6 sm:w-[360px]`
- The `pointer-events-auto` on the parent grid container makes the entire bottom bar interactive, intercepting events in the overlap zone
- The `backdrop-blur-sm` on ProgressBar creates a new stacking context but should remain constrained by parent z-index
- User screenshot confirms visual overlap where ProgressBar renders on top of chat

**Preliminary Assessment**:
- Likely cause: The `sm:flex-1` on ProgressBar causes it to expand under the ChatPanel area. The HUD's `absolute inset-0` spans full viewport width. While z-index should keep HUD (10) below Chat (45), the `backdrop-blur-sm` property creates an isolated stacking context that may interfere with expected layering in some browser rendering paths.
- Recurring pattern: This was previously tracked as F4 (chat button overlap) and F9 (z-index chaos) in the mobile responsiveness tracker. The Session 4 fix addressed mobile layout but did not constrain the ProgressBar's width to avoid overlapping the chat panel area on desktop.

**Classification**: Defect | **High**

---

## F2: ProgressBar Sits Higher Than Adjacent Telemetry Cards

**What Was Found**:
The ProgressBar component renders at a visually different height than the Speed and Earth Distance telemetry cards in the bottom HUD bar. The ProgressBar appears elevated/taller, breaking the horizontal alignment of the bottom telemetry row.

**Where**:
- `src/hud/ProgressBar.tsx:72` -- container: `px-3 sm:px-4 py-3 min-w-0 sm:min-w-[420px]`
- `src/hud/TelemetryCard.tsx:23` -- container: `px-2 py-2 sm:px-4 sm:py-3 min-w-[100px] sm:min-w-[140px]`
- `src/hud/HUD.tsx:99` -- parent: `sm:flex sm:items-center` (should vertically center children)

**Evidence**:
- TelemetryCard padding: `py-2` (mobile) / `py-3` (desktop)
- ProgressBar padding: `py-3` (all viewports -- no responsive variant)
- ProgressBar has additional internal content: the "Next milestone" countdown row (`text-[9px] ... mt-1`) which adds height beyond the main progress track
- The parent flex container uses `sm:items-center` which vertically centers children, but different intrinsic heights cause the taller ProgressBar to extend above the top edge of shorter TelemetryCards
- On mobile (grid layout), the ProgressBar uses `col-span-2` spanning the full width below the two telemetry cards, so height mismatch is less visible. On desktop (flex layout), they sit side-by-side where height difference is apparent.
- User screenshot confirms ProgressBar appears elevated relative to sibling cards

**Preliminary Assessment**:
- Likely cause: Inconsistent padding (ProgressBar always uses `py-3`, TelemetryCard uses `py-2` on mobile / `py-3` on desktop) combined with ProgressBar's extra content (countdown line, milestone markers with tooltips) making it inherently taller. The `sm:items-center` on the parent centers vertically, but different total heights cause misalignment.
- Fix direction: Either match padding and constrain ProgressBar's max height, or use `sm:items-end` / `sm:items-stretch` on the parent.

**Classification**: Defect | **Medium**

---

## F3: Trajectory Around Moon Renders Problematic / Direction May Be Wrong

**What Was Found**:
The trajectory line around the Moon appears visually broken or incorrectly rendered. Additionally, the trajectory appears to loop counter-clockwise around the Moon, which the user questions as potentially incorrect. This is flagged as a recurring problem -- trajectory culling around celestial bodies was previously fixed in Session 4.

**Where**:
- `src/components/Trajectory.tsx:22-52` -- `splitAroundBodies()` culling with `MOON_VISUAL_RADIUS = 0.7`
- `src/components/Moon.tsx:11-35` -- Moon position derived from max-distance OEM vector with `offsetKm = 10637`
- `public/fallback-oem.asc` -- OEM trajectory data in EME2000 frame
- `src/data/mission-config.ts:39` -- Lunar Flyby at T+96h, closest approach ~8,900 km above lunar far side

**Evidence**:
- The `splitAroundBodies()` function culls trajectory points within `MOON_VISUAL_RADIUS = 0.7` scene units of the Moon center
- Moon sphere geometry uses radius `0.5` (Moon.tsx line 49), buffer = 0.2 scene units
- Moon position is computed by: finding the OEM point with maximum distance from Earth, then offsetting 10,637 km inward along the Earth-to-flyby direction
- The offset calculation assumes the Moon center is 10,637 km closer to Earth than the spacecraft's closest approach point, which is an approximation
- If the computed Moon position is slightly off, the culling radius may cut too much or too little of the trajectory near the Moon
- OEM data shows the trajectory approaching from negative-Y direction and returning with positive-Y velocity after April 7, consistent with a free-return trajectory
- The Artemis II mission profile uses a free-return trajectory that passes behind the lunar far side. In the EME2000 reference frame, the direction of the flyby around the Moon depends on the orbital mechanics. The OEM data is the authoritative source for direction.
- User screenshot shows trajectory rendering is problematic near the Moon -- may be over-culling or under-culling

**Preliminary Assessment**:
- Likely cause (rendering): The `MOON_VISUAL_RADIUS = 0.7` culling buffer may be too aggressive or the Moon position calculation (using max-distance OEM point - offset) may place the Moon slightly off from where the trajectory data expects it, causing the culling to clip visible trajectory segments or leave gaps
- Likely cause (direction): The trajectory direction around the Moon is determined by the OEM data, which is from NASA's official planning data. The perceived "counter-clockwise" direction depends on the camera viewing angle. The Artemis II free-return trajectory passes behind the Moon's far side from south to north (retrograde relative to lunar orbit), which can appear counter-clockwise from certain viewing angles. This may not be a bug but a viewing angle issue.
- Recurring pattern: Trajectory culling around the Moon was previously fixed in Session 4 (commit 26ef3a1). The current culling uses a single radius threshold which creates abrupt segment breaks rather than smooth trajectory near the Moon.

**Classification**: Defect | **High**

---

## F4: Mobile Hamburger Menu (MissionEventsPanel) Obscures Most of Screen

**What Was Found**:
When the MissionEventsPanel hamburger menu is expanded on mobile, the dropdown panel obscures the majority of the screen viewport. With 19 milestones in the timeline plus any active alerts, the panel content is tall enough to fill most of the available screen space, leaving very little of the 3D scene visible.

**Where**:
- `src/hud/MissionEventsPanel.tsx:102` -- panel: `w-[calc(100vw-1.5rem)] sm:w-[320px] max-h-[70vh] overflow-y-auto`
- `src/hud/MissionEventsPanel.tsx:96` -- click-outside overlay: `fixed inset-0 z-[var(--z-backdrop)]`
- `src/data/mission-config.ts:26-46` -- 19 milestones generating 19 timeline rows

**Evidence**:
- Panel width on mobile: `w-[calc(100vw-1.5rem)]` -- nearly full viewport width
- Panel max height: `max-h-[70vh]` -- up to 70% of viewport height
- 19 milestones at approximately 36px each (py-1.5 + gap-0.5 + text) = ~684px of milestone content
- Plus alerts section header, padding, and alert items
- On a typical mobile viewport (667px-812px height), 70vh = 467-568px, which is the majority of usable screen space
- The click-outside overlay at `z-[var(--z-backdrop)]` (30) covers the entire viewport, blocking interaction with the 3D scene
- User screenshot confirms the expanded menu covers most of the mobile viewport

**Preliminary Assessment**:
- Likely cause: The `max-h-[70vh]` is too generous for mobile viewports when combined with 19 milestones. The panel was designed when there were 9 milestones; doubling to 19 pushed the content height well beyond comfortable overlay size.
- Fix direction: Reduce `max-h` on mobile (e.g., `max-h-[50vh] sm:max-h-[70vh]`), or implement a more compact timeline view on mobile (collapsed milestone groups, smaller row height, or pagination).

**Classification**: Debt | **Medium**

---

## Summary

| # | Finding | Type | Severity |
|---|---------|------|----------|
| F1 | ProgressBar overlays ChatPanel | Defect | High |
| F2 | ProgressBar height mismatch with telemetry cards | Defect | Medium |
| F3 | Trajectory around Moon rendering + direction | Defect | High |
| F4 | Mobile hamburger menu too large | Debt | Medium |
