# Finding: Crew Timeline Not Displayed — Data Exists but Has No UI

**Date**: 2026-04-04
**Discovered by**: Post-MVP feature analysis
**Type**: Gap
**Severity**: Medium
**Status**: Open

---

## What Was Found

Crew data and mission milestones are fully defined in `src/data/mission-config.ts` but have no visual representation beyond a text label in the MissionClock.

**Crew data defined but not displayed**:
- 4 crew members with name, role, and bio (Commander, Pilot, Mission Specialist 1 & 2)
- Never rendered anywhere in the application

**Milestones defined but only partially displayed**:
- 8 mission milestones from Launch (T+0h) to Splashdown (T+240h), each with name, elapsed hours, and description
- `getMissionElapsed()` returns `currentPhase` string — displayed only as text in MissionClock
- ProgressBar shows completion percentage but no milestone markers
- No timeline visualization, no event markers in 3D scene, no milestone approach notifications

---

## Affected Components

- `src/data/mission-config.ts` — CREW array (4 members) and MILESTONES array (8 events), both defined and exported
- `src/hud/MissionClock.tsx` — shows current phase name only
- `src/hud/ProgressBar.tsx` — shows percentage, no milestone tick marks
- `src/hud/HUD.tsx` — no crew panel or timeline widget in layout

---

## Evidence

Crew data exists but is never imported outside mission-config.ts:
```typescript
export const CREW = [
  { name: 'Reid Wiseman', role: 'Commander', bio: '...' },
  { name: 'Victor Glover', role: 'Pilot', bio: '...' },
  { name: 'Christina Koch', role: 'Mission Specialist 1', bio: '...' },
  { name: 'Jeremy Hansen', role: 'Mission Specialist 2', bio: '...' },
];
```

Milestones used only for phase name lookup:
```typescript
export const MILESTONES: Milestone[] = [
  { name: 'Launch', missionElapsedHours: 0, description: '...' },
  // ... 8 total
  { name: 'Splashdown', missionElapsedHours: 240, description: '...' },
];
```

MissionClock displays phase as plain text — no timeline, no visual progression:
```tsx
<div className="text-xs text-cyan-400/70">{missionData.currentPhase}</div>
```

---

## Preliminary Assessment

**Likely cause**: MVP focused on the 3D visualization and chat. The data was authored anticipating future UI but the display components were never built.

**Likely scope**: Two new HUD components needed (CrewPanel, TimelineWidget) plus optional 3D milestone markers on the trajectory. The data layer is already complete.

**Likely impact**: Users see a progress bar and phase name but cannot browse upcoming milestones, understand crew roles, or anticipate mission events. The timeline is a natural complement to the existing HUD.

---

## Classification Rationale

**Type: Gap** — The data exists and is correct; the missing piece is the UI to surface it to users.

**Severity: Medium** — Functional gap in user experience but the core visualization works without it. Listed as Priority 1 post-MVP feature.

---

**Finding Logged**: 2026-04-04 12:01 UTC
