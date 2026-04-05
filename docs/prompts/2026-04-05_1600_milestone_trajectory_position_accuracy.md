# Implementation Prompt: Milestone Trajectory Position Accuracy — NASA-Verified Timings

**RCA Reference**: docs/RCAs/2026-04-05_1600_milestone_trajectory_position_accuracy.md
**Investigation**: docs/investigations/2026-04-05_1600_milestone_trajectory_position_accuracy.md

## Context

10 of 19 milestone positions are significantly wrong (up to 23.5h error). The TLI Burn uses Artemis I direct-injection timing, a duplicate "TLI Perigee" exists, Lunar Flyby is 6.5h early, and Splashdown overshoots by 22.5h. The hardcoded `TOTAL_MISSION_HOURS = 240` in ProgressBar.tsx is also wrong. This is the 3rd correction attempt — previous fixes used approximate reasoning.

## Goal

Replace all milestone timings with NASA-verified values, remove the duplicate TLI Perigee milestone, fix mission duration constants, and derive progress bar total from the config.

## Requirements

### 1. Update `src/data/mission-config.ts`

**A. Change `MISSION_DURATION_DAYS`** (line 2):

```typescript
// CURRENT:
export const MISSION_DURATION_DAYS = 10;

// NEW:
export const MISSION_DURATION_DAYS = 217.53 / 24; // 9.064 days — NASA actual splashdown T+217.53h
```

**B. Add `MISSION_DURATION_HOURS` export** (after line 2):

```typescript
export const MISSION_DURATION_HOURS = MISSION_DURATION_DAYS * 24; // 217.53h
```

**C. Replace entire MILESTONES array** (lines 26-46):

Remove the duplicate "TLI Perigee" entry (19 → 18 milestones). Update all timings to NASA-verified values. Update descriptions for TLI Burn, OTB-1, Lunar Flyby, and Splashdown.

```typescript
export const MILESTONES: Milestone[] = [
  { name: 'Launch', missionElapsedHours: 0, description: 'SLS lifts off from LC-39B, Kennedy Space Center' },
  { name: 'SRB Separation', missionElapsedHours: 0.036, description: 'Solid rocket boosters jettison at T+2m08s' },
  { name: 'Core Stage Sep', missionElapsedHours: 0.138, description: 'Core stage MECO and separation, ICPS takes over' },
  { name: 'Perigee Raise', missionElapsedHours: 0.817, description: 'ICPS perigee raise burn at T+49 min — orbit to 115 × 1,381 mi' },
  { name: 'ICPS Separation', missionElapsedHours: 3.40, description: 'ICPS separates after proximity operations demo at T+3h24m' },
  { name: 'Belt Transit', missionElapsedHours: 3.8, description: 'Orion transits the inner Van Allen radiation belt' },
  { name: 'TLI Burn', missionElapsedHours: 25.23, description: 'Translunar Injection at phasing orbit perigee — Orion ESM engine, 5m50s burn' },
  { name: 'OTB-1', missionElapsedHours: 28.2, description: 'Outbound Trajectory Burn 1 — waived, trajectory sufficiently precise' },
  { name: 'Star Tracker Cal', missionElapsedHours: 36, description: 'Navigation star tracker calibration and crew observation' },
  { name: 'MCC-1', missionElapsedHours: 48, description: 'Mid-Course Correction 1 — refine lunar approach trajectory' },
  { name: 'Lunar Approach', missionElapsedHours: 102, description: 'Entering lunar sphere of influence (~66,000 km from Moon)' },
  { name: 'Lunar Flyby', missionElapsedHours: 120.45, description: 'Closest approach — 6,543 km (4,066 mi) above lunar far side' },
  { name: 'Return Burn', missionElapsedHours: 139, description: 'Return trajectory correction near lunar SOI exit' },
  { name: 'Return Coast', missionElapsedHours: 144, description: 'Free return coast toward Earth' },
  { name: 'MCC-3', missionElapsedHours: 200, description: 'Final mid-course correction — precision entry targeting' },
  { name: 'CM/SM Sep', missionElapsedHours: 217.0, description: 'Crew Module separates from Service Module' },
  { name: 'Entry Interface', missionElapsedHours: 217.3, description: 'Orion enters Earth atmosphere at ~40,000 km/h (122 km altitude)' },
  { name: 'Splashdown', missionElapsedHours: 217.53, description: 'Pacific Ocean splashdown off San Diego — recovery by USS Portland' },
];
```

### 2. Update `src/hud/ProgressBar.tsx`

**A. Add import** (line 5):

```typescript
// CURRENT:
import { MILESTONES } from '../data/mission-config';

// NEW:
import { MILESTONES, MISSION_DURATION_HOURS } from '../data/mission-config';
```

**B. Replace hardcoded constant** (line 7):

```typescript
// CURRENT:
const TOTAL_MISSION_HOURS = 240;

// NEW:
const TOTAL_MISSION_HOURS = MISSION_DURATION_HOURS;
```

## Files Affected

| File | Change |
|------|--------|
| `src/data/mission-config.ts` | MISSION_DURATION_DAYS, add MISSION_DURATION_HOURS, replace entire MILESTONES array (19→18 entries) |
| `src/hud/ProgressBar.tsx` | Import MISSION_DURATION_HOURS, replace hardcoded 240 |

## Constraints

1. **No other files need changes** — MilestoneMarker.tsx, MissionEventsPanel.tsx, and useAlerts.ts all read from the MILESTONES array and will pick up changes automatically
2. **Milestone count changes from 19 to 18** — verify no code depends on a specific count
3. **The 6 pre-OEM milestones** (Launch through Belt Transit, all before T+3.38h) will still clamp to the first OEM vector position. This is acceptable — they are ascent-phase events with no OEM data. Their timeline ordering and descriptions are still valuable.
4. **LAUNCH_EPOCH** (`2026-04-01T22:35:00Z`) does NOT change — only durations and milestone timings change
5. **Preserve all existing imports** in mission-config.ts — other modules import LAUNCH_EPOCH, CREW, SCALE_FACTOR, etc.

## Acceptance Criteria

- [ ] Build passes (`npm run build`)
- [ ] MILESTONES array has exactly 18 entries (TLI Perigee removed)
- [ ] TLI Burn is at T+25.23h (not T+1.75h)
- [ ] Lunar Flyby is at T+120.45h (not T+114h)
- [ ] Splashdown is at T+217.53h (not T+240h)
- [ ] No duplicate milestones for the same physical event
- [ ] MISSION_DURATION_DAYS reflects actual mission duration (~9.064 days)
- [ ] TOTAL_MISSION_HOURS in ProgressBar.tsx derives from MISSION_DURATION_HOURS
- [ ] Lunar Flyby description says ~6,543 km (not ~8,900 km)
- [ ] TLI Burn description mentions phasing orbit perigee and Orion ESM engine

---

## Plan Output Instructions

**IMPORTANT**: Before creating the implementation plan, you MUST enter plan mode:

1. Call `EnterPlanMode` to enter plan mode (compresses context and enables read-only exploration)
2. Explore the codebase and design your implementation approach using read-only tools (Read, Grep, Glob)
3. Write the plan to `docs/plans/2026-04-05_1600_milestone_trajectory_position_accuracy.md` including:
   - Summary of the approach
   - Step-by-step implementation tasks
   - Files to modify with specific changes
   - Testing strategy
   - Rollback plan (if applicable)
4. Call `ExitPlanMode` to present the plan for user approval
5. **Wait for user approval** before proceeding to implementation
6. After plan approval, invoke `/wrought-rca-fix` to start the autonomous bugfix loop with test verification.
