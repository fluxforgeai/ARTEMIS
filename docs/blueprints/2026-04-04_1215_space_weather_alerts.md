# Blueprint: Space Weather & Alert System (Phase 1 -- Synthetic + Infrastructure)

**Date**: 2026-04-04
**Design Reference**: docs/design/2026-04-04_1201_space_weather_alerts.md
**Finding**: F3 in Post-MVP Visual & Data Features tracker (`docs/findings/2026-04-04_1201_post_mvp_visual_data_features_FINDINGS_TRACKER.md`)

## Objective

Deliver Phase 1 of the hybrid space weather system: a synthetic data generator tied to mission elapsed time and spacecraft position, a complete alert notification infrastructure (reusable by F2 milestone notifications), a SpaceWeatherPanel HUD widget, and an AlertsBanner overlay. Zero external API dependencies. Ships as a fully functional, self-contained feature.

## Requirements

1. **Synthetic data generator** -- Pure function `generateSpaceWeather(missionElapsedMs, earthDistKm)` producing Kp index, solar wind speed, solar wind density, radiation zone classification, radiation dose rate, and active scripted events. Deterministic: same inputs yield same outputs.
2. **Alert state management** -- Zustand store extensions: `spaceWeather` state slice and `alerts` queue slice with `addAlert` (deduplication, max queue 10, priority ordering) and `dismissAlert` actions.
3. **SpaceWeatherPanel HUD component** -- Compact inline widget following the DSNStatus pattern. Displays Kp index (colored 0-9 bar), solar wind speed (km/s), radiation zone label with severity dot, and source indicator ("SIM"). Positioned next to DSNStatus in the bottom section.
4. **AlertsBanner component** -- Framer Motion AnimatePresence stack positioned absolutely above the HUD top bar (z-20). Renders up to 3 AlertItem components. Supports enter/exit animations, auto-dismiss timers, and manual dismiss.
5. **AlertItem component** -- Individual alert notification with severity-keyed styling (INFO=blue, NOMINAL=green, CAUTION=orange, WARNING=red), left border accent, glass-morphism background, dismiss button, and timestamp.
6. **Alert severity system** -- 4 levels mapped to existing theme tokens: INFO (`--color-hud-blue`), NOMINAL (`--color-hud-green`), CAUTION (`--color-hud-orange`), WARNING (`--color-hud-red`). Each level has distinct auto-dismiss duration and animation intensity.
7. **useSpaceWeather hook** -- Reads mission elapsed time and spacecraft earthDist from Zustand store, calls synthetic generator every 5 seconds, writes results to `spaceWeather` store slice.
8. **useAlerts hook** -- Reads `spaceWeather` state, detects threshold crossings (radiation zone transitions, Kp index changes), fires milestone approach notifications at T-30min and T-0, and writes alerts via `addAlert`. Handles deduplication (same type + message within 60s = ignored).
9. **Van Allen belt radiation zone detection** -- Derived from `earthDistKm`: clear (<1,000 km or >60,000 km), inner-belt (1,000-6,000 km), outer-belt (13,000-60,000 km), slot-region (6,000-13,000 km). Triggers CAUTION alerts on belt entry, WARNING at peak radiation zones.
10. **Milestone approach notifications** -- Using the existing MILESTONES array from `mission-config.ts`, fire INFO alerts at T-30min ("Lunar Flyby in 30 minutes") and T-0 ("Lunar Flyby: Closest approach ~8,900 km above far side"). This infrastructure also serves F2 crew timeline.
11. **Scripted solar events** -- 2-3 pre-authored events at dramatically appropriate mission moments: M-class flare at MET ~48h (outbound coast), CME arrival at MET ~120h (return coast, WARNING severity). These produce alert notifications and affect Kp/solar wind synthetic values.

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Data source (Phase 1) | Synthetic only, no live API calls | Zero external dependencies, always works, narratively curated. Live overlay deferred to Phase 2. |
| Alert queue in Zustand vs React state | Zustand global store | Alerts triggered from multiple sources (space weather hook, milestone hook, future telemetry thresholds). Global state allows any component to read alerts without prop drilling. Consistent with existing DSN/spacecraft state pattern. |
| Custom alert stack vs library (Sonner, react-hot-toast) | Custom with Framer Motion | Project already has Framer Motion 12.6.0 and prefers zero-dependency HUD components (DSNStatus, TelemetryCard are all custom). ~100 lines of code. |
| Alert animation approach | Framer Motion AnimatePresence + layout | Existing HUD components use Framer Motion springs. AnimatePresence with `layout` prop ensures smooth reflow when alerts dismiss. Direct pattern match with project style. |
| SpaceWeatherPanel pattern | Follow DSNStatus (compact inline, colored dots) | DSNStatus is the established compact status widget. Users scan left-to-right: DSN status, space weather status, camera controls. Consistent visual language. |
| Synthetic generator purity | Pure function of (missionElapsedMs, earthDistKm) | Deterministic, testable, no side effects. Same mission time always shows same weather. Easy to unit test without mocking. |
| Hook polling interval | 5 seconds for synthetic data | 1-second intervals (like useMission) would be wasteful since synthetic data changes slowly. 5 seconds provides smooth transitions without unnecessary re-renders. |
| Alert deduplication strategy | Type + message hash with 60-second cooldown | Prevents spam from rapid state transitions (e.g., hovering near a belt boundary). Simple string comparison, no complex diffing. |
| Milestone notification source | MILESTONES array from mission-config.ts | Single source of truth for milestone definitions. Alert hook reads the same data that MissionClock uses for phase detection. |
| Max visible alerts | 3 simultaneously | More than 3 would obscure the 3D scene. Older alerts auto-evict. WARNING alerts displace INFO/NOMINAL alerts via priority ordering. |
| Source indicator in Phase 1 | Always shows "SIM" badge | Prepares UI for Phase 2 "LIVE" badge. Users understand data is simulated. Consistent with the educational purpose. |

## Scope

### In Scope (Phase 1)

- Synthetic space weather data generator (`src/data/space-weather-synthetic.ts`)
- Zustand store extensions for `spaceWeather` and `alerts` slices
- `useSpaceWeather` hook (synthetic data polling, store updates)
- `useAlerts` hook (threshold detection, milestone notifications, dedup)
- `SpaceWeatherPanel` HUD component (Kp, solar wind, radiation zone, source badge)
- `AlertsBanner` component (AnimatePresence stack, max 3 visible)
- `AlertItem` component (severity styling, auto-dismiss, manual dismiss)
- Van Allen belt radiation zone detection from earthDistKm
- Milestone approach notifications (T-30min, T-0) using existing MILESTONES
- Scripted solar events (M-class flare MET ~48h, CME arrival MET ~120h)
- HUD layout update to accommodate new components
- Alert pulse animation keyframes in CSS (if not fully handled by Framer Motion)

### Out of Scope (Phase 2 -- future)

- Live NOAA SWPC API integration (`api/space-weather.ts`)
- Live NASA DONKI API integration (extending `api/donki.ts`)
- Merge logic between live and synthetic data
- "LIVE" source indicator badge
- 3D radiation belt visualization overlay
- Telemetry threshold alerts (e.g., "Max velocity reached") -- infrastructure supports it, but no telemetry thresholds defined in Phase 1
- Sound effects or haptic feedback for alerts

## Files Likely Affected

### New Files

| File | Purpose |
|------|---------|
| `src/data/space-weather-synthetic.ts` | Pure function generator. Exports `generateSpaceWeather(missionElapsedMs: number, earthDistKm: number): SpaceWeatherData`. Contains Van Allen belt thresholds, Kp curve function, solar wind correlation, scripted events array. ~150-200 lines. |
| `src/hooks/useSpaceWeather.ts` | Hook that reads `spacecraft.earthDist` and mission elapsed time from store, calls `generateSpaceWeather` every 5s via `setInterval`, writes to `useMissionStore.getState().setSpaceWeather()`. Pattern follows `useDSN.ts` (useEffect + interval + cleanup). ~40-50 lines. |
| `src/hooks/useAlerts.ts` | Hook that reads `spaceWeather` state, tracks previous values via `useRef` for transition detection, checks milestone approach times, calls `addAlert` with dedup. Fires on spaceWeather or mission time changes. ~80-100 lines. |
| `src/hud/SpaceWeatherPanel.tsx` | Compact inline widget. Renders Kp index (number + colored dot), solar wind speed (value + unit), radiation zone (label + severity dot), "SIM" badge. Follows DSNStatus layout pattern: horizontal flex, small text, colored indicators. ~60-80 lines. |
| `src/hud/AlertsBanner.tsx` | Absolute-positioned container at top of HUD. Reads `alerts` from store, renders up to 3 AlertItems inside AnimatePresence. Manages auto-dismiss timers via useEffect. ~50-60 lines. |
| `src/hud/AlertItem.tsx` | Individual alert card. Props: `{ id, severity, message, timestamp, onDismiss }`. Severity maps to border color and glow via theme tokens. Framer Motion `initial/animate/exit` for slide + fade. Dismiss button (x). ~60-70 lines. |

### Modified Files

| File | Change |
|------|--------|
| `src/store/mission-store.ts` | Add `SpaceWeatherState` interface, `AlertSeverity` type, `Alert` interface. Add `spaceWeather` state slice (initial: `{ kpIndex: 3, solarWindSpeed: 400, solarWindDensity: 5, radiationZone: 'clear', radiationDoseRate: 0, source: 'synthetic', lastUpdated: 0 }`). Add `alerts: Alert[]` (initial: `[]`). Add `setSpaceWeather`, `addAlert`, `dismissAlert` actions. |
| `src/hud/HUD.tsx` | Import and render `AlertsBanner` above the top bar (new first child, absolutely positioned). Import and render `SpaceWeatherPanel` between DSNStatus and CameraControls in the bottom section. Import and activate `useSpaceWeather` and `useAlerts` hooks (or activate them in App.tsx -- see implementation sequence). |
| `src/index.css` | Add `@keyframes alert-pulse-red` and `@keyframes alert-pulse-orange` for WARNING and CAUTION severity glow animations (only if Framer Motion `animate` prop is insufficient for continuous pulsing). |

## Implementation Sequence

1. **Types and interfaces** (`src/store/mission-store.ts`) -- Define `SpaceWeatherState`, `AlertSeverity`, `Alert` interfaces and add store slices with actions. Must be first because all other files import from the store.

2. **Synthetic data generator** (`src/data/space-weather-synthetic.ts`) -- Pure function, no dependencies on new code. Define Van Allen belt thresholds, Kp baseline curve, solar wind correlation, scripted events. Can be tested in isolation.

3. **useSpaceWeather hook** (`src/hooks/useSpaceWeather.ts`) -- Connects generator to store. Reads `spacecraft.earthDist` from store, computes mission elapsed time, calls generator, writes to `setSpaceWeather`. Interval-based polling (5s).

4. **useAlerts hook** (`src/hooks/useAlerts.ts`) -- Reads `spaceWeather` from store, detects transitions (radiation zone changes, Kp threshold crossings), checks milestone approach times, fires `addAlert`. Uses `useRef` to track previous values for edge detection.

5. **AlertItem component** (`src/hud/AlertItem.tsx`) -- Pure presentational component. No store dependency. Receives severity, message, onDismiss via props. Renders with Framer Motion enter/exit.

6. **AlertsBanner component** (`src/hud/AlertsBanner.tsx`) -- Reads `alerts` from store, slices to max 3 visible, renders AlertItems inside AnimatePresence. Manages auto-dismiss timers.

7. **SpaceWeatherPanel component** (`src/hud/SpaceWeatherPanel.tsx`) -- Reads `spaceWeather` from store. Renders Kp, solar wind, radiation zone with colored indicators. Follows DSNStatus pattern.

8. **HUD integration** (`src/hud/HUD.tsx`) -- Import AlertsBanner, SpaceWeatherPanel. Add AlertsBanner as first child (absolute, z-20, top). Add SpaceWeatherPanel between DSNStatus and CameraControls. Activate hooks (useSpaceWeather, useAlerts) at HUD level or via a dedicated HookActivator component.

9. **CSS animations** (`src/index.css`) -- Add pulse keyframes for WARNING/CAUTION severity if needed beyond Framer Motion capabilities.

## Zustand Store Schema (Exact Shape)

```typescript
// New types added to mission-store.ts

export type AlertSeverity = 'info' | 'nominal' | 'caution' | 'warning';

export type AlertType = 
  | 'space-weather'    // Solar events, Kp changes
  | 'radiation-zone'   // Van Allen belt transitions
  | 'milestone'        // Mission milestone approach/arrival
  | 'telemetry'        // Value threshold crossings (Phase 2)
  | 'system';          // API/system status (Phase 2)

export interface Alert {
  id: string;                 // crypto.randomUUID() or Date.now() + type
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  timestamp: number;          // Date.now()
  autoDismissMs: number;      // 6000 (nominal), 8000 (info), 12000 (caution), 20000 (warning)
}

export type RadiationZone = 'clear' | 'inner-belt' | 'slot-region' | 'outer-belt' | 'deep-space';
export type RadiationLevel = 'nominal' | 'elevated' | 'high';

export interface SpaceWeatherState {
  kpIndex: number;               // 0-9 scale
  solarWindSpeed: number;        // km/s
  solarWindDensity: number;      // protons/cm3
  radiationZone: RadiationZone;
  radiationDoseRate: number;     // relative 0-100
  radiationLevel: RadiationLevel;
  activeEvents: Array<{
    type: string;                // 'flare' | 'cme'
    classStr: string;            // 'M2.3', 'CME'
    description: string;
  }>;
  source: 'synthetic' | 'live' | 'mixed';
  lastUpdated: number;           // Date.now()
}

// New store fields
spaceWeather: SpaceWeatherState;
alerts: Alert[];

// New store actions
setSpaceWeather: (data: SpaceWeatherState) => void;
addAlert: (alert: Omit<Alert, 'id'>) => void;
dismissAlert: (id: string) => void;
```

## Synthetic Data Generator Specification

```typescript
// src/data/space-weather-synthetic.ts

export interface SpaceWeatherData {
  kpIndex: number;
  solarWindSpeed: number;
  solarWindDensity: number;
  radiationZone: RadiationZone;
  radiationDoseRate: number;
  radiationLevel: RadiationLevel;
  activeEvents: Array<{
    type: string;
    classStr: string;
    description: string;
  }>;
}

// Van Allen belt thresholds (km from Earth center)
// Inner belt: 1,000 - 6,000 km
// Slot region: 6,000 - 13,000 km  
// Outer belt: 13,000 - 60,000 km
// Deep space: > 60,000 km (beyond belts, lower radiation)

// Kp index baseline curve (function of MET hours):
// MET 0-3h: Kp 4 (launch/belt transit, elevated)
// MET 3-24h: Kp 3 (settling, outbound)
// MET 24-90h: Kp 2 (quiet coast)
// MET 48h (event): spike to Kp 5 (M-class flare, ~4h duration)
// MET 90-100h: Kp 3 (approaching Moon)
// MET 96h: Kp 4 (lunar flyby, elevated)
// MET 100-115h: Kp 2 (return coast, quiet)
// MET 120h (event): spike to Kp 6 (CME arrival, ~8h duration)
// MET 128-220h: Kp 3 (post-event settling)
// MET 220-240h: Kp 4 (re-entry, belt transit)

// Solar wind speed correlates with Kp:
// Base: 350 + (kpIndex * 40) km/s, with +-20 km/s noise from MET hash

// Scripted events:
// 1. M2.3 solar flare at MET ~48h (duration 4h) -- CAUTION severity
// 2. CME arrival at MET ~120h (duration 8h) -- WARNING severity

export function generateSpaceWeather(
  missionElapsedMs: number, 
  earthDistKm: number
): SpaceWeatherData;
```

## Component Props Specification

```typescript
// AlertItem props
interface AlertItemProps {
  id: string;
  severity: AlertSeverity;
  message: string;
  timestamp: number;
  onDismiss: (id: string) => void;
}

// SpaceWeatherPanel reads directly from store (no props needed, follows DSNStatus pattern)

// AlertsBanner reads directly from store (no props needed)
```

## Alert Severity Visual Mapping

```typescript
const SEVERITY_CONFIG: Record<AlertSeverity, {
  borderColor: string;
  glowColor: string;
  textColor: string;
  autoDismissMs: number;
}> = {
  info:    { borderColor: '#00d4ff', glowColor: 'rgba(0,212,255,0.3)',  textColor: '#00d4ff', autoDismissMs: 8000  },
  nominal: { borderColor: '#00ff88', glowColor: 'rgba(0,255,136,0.3)',  textColor: '#00ff88', autoDismissMs: 6000  },
  caution: { borderColor: '#ff8c00', glowColor: 'rgba(255,140,0,0.3)',  textColor: '#ff8c00', autoDismissMs: 12000 },
  warning: { borderColor: '#ff4444', glowColor: 'rgba(255,68,68,0.3)',  textColor: '#ff4444', autoDismissMs: 20000 },
};
```

## Dependencies & Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Synthetic data feels unrealistic | Medium | Low | Base curves on published Artemis I data (belt crossing times, Kp ranges). Scripted events use real solar flare classes (M2.3, not arbitrary numbers). |
| Alert spam from rapid state transitions | Medium | Medium | 60-second dedup window per type+message. useRef tracking of previous state for edge-only detection. Max queue size 10. |
| Performance regression from 5s polling + re-renders | Low | Medium | useSpaceWeather writes to store only when values actually change (shallow compare). SpaceWeatherPanel uses fine-grained selectors. AlertsBanner only re-renders when alerts array changes. |
| HUD layout breakage on mobile | Medium | Medium | SpaceWeatherPanel follows DSNStatus responsive pattern (stack on mobile, inline on desktop). AlertsBanner uses absolute positioning with responsive padding. Test at 375px viewport. |
| Animation jank from alert enter/exit | Low | Low | Use Framer Motion `layout` prop for smooth reflow. Exit animation is fast (200ms opacity+x). Keep max 3 visible. |
| Van Allen belt thresholds produce no alerts if earthDist data is wrong | Low | High | Verify earthDistKm values from OEM data correspond to expected belt crossing altitudes. Add console.log during development for earthDist at key mission times. |
| Store shape change breaks existing consumers | Low | Medium | New slices are additive -- no existing fields modified. New actions are new functions. Zero risk to existing SpeedCard/EarthDistCard/MoonDistCard/DSNStatus. |

## Acceptance Criteria

- [ ] SpaceWeatherPanel renders in the HUD bottom section, showing Kp index (0-9 with color), solar wind speed (km/s), radiation zone label, and "SIM" source badge
- [ ] SpaceWeatherPanel updates every 5 seconds with values derived from mission elapsed time and spacecraft Earth distance
- [ ] Van Allen belt transit triggers CAUTION alert ("Entering Van Allen Inner Belt") when earthDistKm crosses 1,000 km outbound
- [ ] Van Allen belt peak radiation triggers WARNING alert when earthDistKm is in 2,500-4,000 km range (inner belt peak)
- [ ] Scripted M-class flare event at MET ~48h produces a CAUTION alert with message including flare class
- [ ] Scripted CME arrival at MET ~120h produces a WARNING alert
- [ ] Milestone approach notifications fire at T-30min (INFO) and T-0 (INFO) for each MILESTONE
- [ ] Alerts appear at top of HUD with slide-in animation, max 3 visible simultaneously
- [ ] Each alert auto-dismisses after its severity-specific timeout (6s/8s/12s/20s)
- [ ] Alerts can be manually dismissed via close button
- [ ] Duplicate alerts (same type + message within 60s) are suppressed
- [ ] WARNING alerts have visible red glow/pulse effect
- [ ] `npm run build` succeeds with zero TypeScript errors
- [ ] Mobile layout (375px viewport) does not overflow or break

## Constraints

- **No external API calls in Phase 1** -- all data is synthetic. The `api/donki.ts` route remains untouched.
- **No new npm dependencies** -- Framer Motion 12.6.0 (already installed) handles all animations. Zustand 5.0.3 (already installed) handles state.
- **Follow existing patterns strictly** -- SpaceWeatherPanel mirrors DSNStatus. Hooks mirror useDSN. Store extensions mirror existing flat state pattern.
- **Glass-morphism styling** -- All new HUD components use `bg-[rgba(10,10,30,0.7)] backdrop-blur-sm border border-[rgba(0,212,255,0.2)] rounded-lg` matching TelemetryCard/ProgressBar.
- **Theme tokens only** -- Use `--color-hud-red`, `--color-hud-orange`, `--color-hud-green`, `--color-hud-blue` for severity colors. No new color values.
- **Tailwind CSS 4 only** -- Use `@theme` block syntax if adding CSS custom properties. No arbitrary Tailwind plugins.
- **TypeScript strict** -- All new code must satisfy `tsc -b` with no errors.
- **Vercel serverless constraints** -- No new API routes in Phase 1. All computation is client-side.
- **React 19 compatible** -- Use React 19 patterns (no deprecated lifecycle methods, no class components).
- **Framer Motion 12 API** -- Use `motion.div` components, `AnimatePresence`, `useSpring`, `useTransform` as in existing code.

## Debug Strategy

- **Self-debug**: enabled
- **Verifier**: `npm run build`
- **Max iterations**: 4
- **Completion criteria**: Space weather panel shows synthetic data updating in HUD, alerts appear based on mission phase and Van Allen belt proximity, milestone approach fires T-30min/T-0 notifications, all severity levels display correctly, mobile layout intact
- **Escape hatch**: After 4 iterations, document blockers in `docs/plans/` and stop
- **Invoke with**: `/wrought-implement`
