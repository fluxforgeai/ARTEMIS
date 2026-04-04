# Implementation Prompt: Space Weather & Alert System (Phase 1)

**Blueprint Reference**: docs/blueprints/2026-04-04_1215_space_weather_alerts.md
**Design Reference**: docs/design/2026-04-04_1201_space_weather_alerts.md

## Context

Phase 1 of the hybrid space weather system for the ARTEMIS mission tracker. This phase delivers a complete, self-contained feature using synthetic data tied to mission elapsed time and spacecraft position. Zero external API dependencies. The alert infrastructure is designed to also serve F2 milestone notifications and future telemetry threshold alerts.

The project is a React 19 + Three.js mission tracker deployed on Vercel. State management is Zustand 5. Animations are Framer Motion 12. Styling is Tailwind CSS 4 with glass-morphism HUD components. All existing HUD components follow a flat, compact pattern with colored status indicators.

## Goal

Implement a synthetic space weather data layer, a SpaceWeatherPanel HUD widget, and an AlertsBanner notification system. The synthetic data generator produces realistic Kp index, solar wind, and radiation zone readings keyed to mission elapsed time and spacecraft Earth distance. Alerts fire on radiation zone transitions, scripted solar events, and milestone approach times. The alert system supports 4 severity levels (INFO, NOMINAL, CAUTION, WARNING) with distinct visual treatments using existing theme color tokens.

## Requirements

1. Create `src/data/space-weather-synthetic.ts` -- a pure function `generateSpaceWeather(missionElapsedMs: number, earthDistKm: number): SpaceWeatherData` that returns Kp index, solar wind speed, solar wind density, radiation zone, radiation dose rate, radiation level, and active scripted events. Deterministic (same inputs = same outputs).

2. Extend `src/store/mission-store.ts` -- add types `AlertSeverity` (4 levels), `AlertType` (5 categories), `Alert` interface, `RadiationZone`, `RadiationLevel`, `SpaceWeatherState` interface. Add `spaceWeather` and `alerts` state slices with `setSpaceWeather`, `addAlert` (with dedup: same type+message within 60s ignored, max queue 10, WARNING priority), and `dismissAlert` actions.

3. Create `src/hooks/useSpaceWeather.ts` -- hook that reads `spacecraft.earthDist` from the Zustand store, computes mission elapsed time from `LAUNCH_EPOCH`, calls `generateSpaceWeather` every 5 seconds, writes to store via `setSpaceWeather`. Follow `useDSN.ts` pattern (useEffect + setInterval + cleanup).

4. Create `src/hooks/useAlerts.ts` -- hook that reads `spaceWeather` state from store, uses `useRef` to track previous radiation zone and Kp index for edge detection, fires alerts on: (a) radiation zone transitions (CAUTION on belt entry, WARNING at inner-belt peak), (b) scripted solar event start (CAUTION for flares, WARNING for CME), (c) milestone approach at T-30min (INFO) and T-0 (INFO) using MILESTONES from `mission-config.ts`. Deduplication: skip if same type+message exists in store within last 60 seconds.

5. Create `src/hud/AlertItem.tsx` -- presentational component. Props: `{ id, severity, message, timestamp, onDismiss }`. Renders with glass-morphism background, left border colored by severity, message text, relative timestamp, dismiss (x) button. Framer Motion: `initial={{ opacity: 0, y: -20 }}`, `animate={{ opacity: 1, y: 0 }}`, `exit={{ opacity: 0, x: 100 }}`. WARNING severity gets a pulsing red glow.

6. Create `src/hud/AlertsBanner.tsx` -- reads `alerts` from store, renders the first 3 alerts inside `AnimatePresence` with `mode="popLayout"`. Each alert has an auto-dismiss timer (useEffect per alert ID) that calls `dismissAlert` after `autoDismissMs`. Positioned absolutely at top of viewport, `z-20`, with responsive padding.

7. Create `src/hud/SpaceWeatherPanel.tsx` -- reads `spaceWeather` from store. Renders horizontally (follows DSNStatus pattern): (a) "SPACE WX" label in small uppercase, (b) Kp index as number with colored dot (green 0-3, orange 4-5, red 6-9), (c) solar wind speed with "km/s" unit, (d) radiation zone label with severity dot (green=clear/deep-space, orange=slot/outer-belt, red=inner-belt), (e) "SIM" badge in gray. Glass-morphism background matching DSNStatus.

8. Update `src/hud/HUD.tsx` -- import and render `AlertsBanner` as the first child of the outer div (absolute positioned, above everything). Import and render `SpaceWeatherPanel` between `DSNStatus` and `CameraControls` in the bottom section. Activate `useSpaceWeather()` and `useAlerts()` hooks at the HUD component level.

9. Optionally extend `src/index.css` -- add `@keyframes` for alert pulse animations if continuous pulsing cannot be achieved with Framer Motion `animate` prop alone (WARNING red pulse, CAUTION orange pulse).

## Files Likely Affected

### New Files

- `src/data/space-weather-synthetic.ts` -- Synthetic data generator. Pure function. Van Allen belt thresholds: inner-belt 1,000-6,000 km, slot-region 6,000-13,000 km, outer-belt 13,000-60,000 km, deep-space >60,000 km. Kp baseline curve: MET 0-3h Kp=4, 3-24h Kp=3, 24-90h Kp=2, 48h event spike Kp=5, 90-100h Kp=3, 96h Kp=4, 100-115h Kp=2, 120h event spike Kp=6, 128-220h Kp=3, 220-240h Kp=4. Solar wind: 350+(kp*40) km/s. Two scripted events: M2.3 flare at MET 48h (4h duration), CME at MET 120h (8h duration). ~150-200 lines.

- `src/hooks/useSpaceWeather.ts` -- Polling hook. Read `spacecraft.earthDist` from store. Compute MET from `LAUNCH_EPOCH`. Call `generateSpaceWeather()` every 5s. Write to `setSpaceWeather()`. Pattern: useEffect + setInterval + cleanup (same as `useDSN.ts`). Only write to store if values changed (shallow compare kpIndex + radiationZone + activeEvents length). ~40-50 lines.

- `src/hooks/useAlerts.ts` -- Alert generation hook. Read `spaceWeather` from store. Track previous `radiationZone` and `kpIndex` in useRef. On change: if zone changed to inner-belt or outer-belt, fire CAUTION alert. If zone is inner-belt and doseRate > 70, fire WARNING. If kpIndex crossed above 5, fire CAUTION. If activeEvents changed, fire CAUTION (flare) or WARNING (CME) per event type. For milestones: compute MET hours, check each MILESTONE, fire INFO at T-30min and T-0 (track fired milestones in useRef Set to avoid re-firing). ~80-100 lines.

- `src/hud/AlertItem.tsx` -- Presentational component. Severity-keyed config object maps to border color, glow, text color, all from theme tokens: info=#00d4ff, nominal=#00ff88, caution=#ff8c00, warning=#ff4444. Glass background: `bg-[rgba(10,10,30,0.85)] backdrop-blur-md`. Left border: `border-l-4` with severity color. Framer Motion `motion.div` with enter/exit animations. Dismiss button: absolute top-right, "x" character or SVG. WARNING: add CSS animation class for continuous red glow pulse. ~60-70 lines.

- `src/hud/AlertsBanner.tsx` -- Container component. Read `alerts` from store via `useMissionStore(s => s.alerts)`. Slice to first 3. Render inside `<AnimatePresence mode="popLayout">`. Each AlertItem gets `key={alert.id}` and `layout` prop. Auto-dismiss: useEffect that sets a setTimeout per alert based on its `autoDismissMs`, calling `dismissAlert(id)`. Clean up timeouts on unmount. Positioned: `absolute top-0 left-0 right-0 z-20 flex flex-col gap-2 p-2 sm:p-4 pointer-events-none` (children get `pointer-events-auto`). ~50-60 lines.

- `src/hud/SpaceWeatherPanel.tsx` -- Status widget. Read `spaceWeather` from store via individual selectors (kpIndex, solarWindSpeed, radiationZone, source). Render horizontal flex layout matching DSNStatus. Kp dot color: green (0-3), orange (4-5), red (6+). Radiation dot color: green (clear/deep-space), orange (slot-region/outer-belt), red (inner-belt). "SIM" badge: small gray text with gray dot. No glass background of its own -- matches DSNStatus's inline unboxed style. ~60-80 lines.

### Modified Files

- `src/store/mission-store.ts` -- Add after existing imports: `AlertSeverity`, `AlertType`, `Alert`, `RadiationZone`, `RadiationLevel`, `SpaceWeatherState` type definitions. Add to `MissionStore` interface: `spaceWeather: SpaceWeatherState`, `alerts: Alert[]`, `setSpaceWeather: (data: SpaceWeatherState) => void`, `addAlert: (alert: Omit<Alert, 'id'>) => void`, `dismissAlert: (id: string) => void`. Add initial values in `create()`: `spaceWeather: { kpIndex: 3, solarWindSpeed: 400, solarWindDensity: 5, radiationZone: 'clear', radiationDoseRate: 0, radiationLevel: 'nominal', activeEvents: [], source: 'synthetic', lastUpdated: 0 }`, `alerts: []`. Implement `setSpaceWeather: (data) => set({ spaceWeather: data })`. Implement `addAlert: (alert) => set((prev) => { ... })` with dedup logic (check if same type+message exists within 60s in prev.alerts, skip if so; generate id via `Date.now().toString(36) + Math.random().toString(36).slice(2)`; push to front if WARNING, else append; cap at 10). Implement `dismissAlert: (id) => set((prev) => ({ alerts: prev.alerts.filter(a => a.id !== id) }))`.

- `src/hud/HUD.tsx` -- Add imports: `AlertsBanner` from `./AlertsBanner`, `SpaceWeatherPanel` from `./SpaceWeatherPanel`, `useSpaceWeather` from `../hooks/useSpaceWeather`, `useAlerts` from `../hooks/useAlerts`. Call `useSpaceWeather()` and `useAlerts()` inside `HUD` component body (before return). Add `<AlertsBanner />` as the first child of the outer div (above the top bar comment). In the bottom section, DSN + Camera row: add `<SpaceWeatherPanel />` between `<DSNStatus />` and `<CameraControls />`.

- `src/index.css` -- Add after existing `@theme` block (only if needed for continuous pulse that Framer Motion cannot handle):
  ```css
  @keyframes alert-glow-red {
    0%, 100% { box-shadow: 0 0 8px rgba(255, 68, 68, 0.3); }
    50% { box-shadow: 0 0 16px rgba(255, 68, 68, 0.6); }
  }
  @keyframes alert-glow-orange {
    0%, 100% { box-shadow: 0 0 6px rgba(255, 140, 0, 0.2); }
    50% { box-shadow: 0 0 12px rgba(255, 140, 0, 0.4); }
  }
  ```

## Implementation Sequence

1. **Zustand store types and slices** -- Start here. Add all type definitions (`AlertSeverity`, `AlertType`, `Alert`, `RadiationZone`, `RadiationLevel`, `SpaceWeatherState`) and new store fields (`spaceWeather`, `alerts`) with actions (`setSpaceWeather`, `addAlert` with dedup, `dismissAlert`) to `src/store/mission-store.ts`. This unblocks everything else. Run `npm run build` to verify no type errors.

2. **Synthetic data generator** -- Create `src/data/space-weather-synthetic.ts`. Implement `generateSpaceWeather()` with: (a) `getRadiationZone(earthDistKm)` helper using belt thresholds, (b) `getBaselineKp(metHours)` helper using the piecewise curve, (c) `getScriptedEvents(metHours)` helper returning active events, (d) Kp adjustment from active events, (e) solar wind derived from Kp, (f) radiation dose rate from zone + events, (g) radiation level from dose rate thresholds. Export the main function and the `SpaceWeatherData` type. Run `npm run build`.

3. **useSpaceWeather hook** -- Create `src/hooks/useSpaceWeather.ts`. Read `spacecraft.earthDist` via `useMissionStore(s => s.spacecraft.earthDist)`. Compute MET using `LAUNCH_EPOCH` from `mission-config.ts`. Call `generateSpaceWeather()` in a 5-second interval. Compare with previous output before writing to store (avoid unnecessary re-renders). Run `npm run build`.

4. **useAlerts hook** -- Create `src/hooks/useAlerts.ts`. Read `spaceWeather` from store. Use `useRef` for `prevRadiationZone`, `prevKpIndex`, `firedMilestones` (Set<string>), `prevActiveEventCount`. Detect transitions: zone entered belt -> CAUTION; zone is inner-belt + high dose -> WARNING; Kp crossed 5+ -> CAUTION; new active event -> CAUTION/WARNING based on event type; milestone T-30min -> INFO; milestone T-0 -> INFO. Call `addAlert` for each. Run `npm run build`.

5. **AlertItem component** -- Create `src/hud/AlertItem.tsx`. Define `SEVERITY_CONFIG` mapping severity to border/glow/text colors. Render `motion.div` with glass-morphism, left border, message, timestamp (format as relative: "Xs ago" or "Xm ago"), dismiss button. Apply WARNING pulse via CSS animation class or Framer Motion `animate` with `repeat: Infinity`. Run `npm run build`.

6. **AlertsBanner component** -- Create `src/hud/AlertsBanner.tsx`. Read `alerts` from store. Take first 3. Render in `AnimatePresence mode="popLayout"`. Each AlertItem gets `key={alert.id}`, `layout` prop. Auto-dismiss: `useEffect` with `setTimeout` per alert, cleanup on unmount or alert change. Container: absolute positioned, top, full width, z-20, pointer-events-none with children pointer-events-auto. Run `npm run build`.

7. **SpaceWeatherPanel component** -- Create `src/hud/SpaceWeatherPanel.tsx`. Read kpIndex, solarWindSpeed, radiationZone, source from store with individual selectors. Render inline flex: "SPACE WX" label, Kp with colored dot, solar wind speed, radiation zone with colored dot, "SIM" badge. Match DSNStatus styling (text sizes, gap, colors). Run `npm run build`.

8. **HUD integration** -- Update `src/hud/HUD.tsx`. Import all new components and hooks. Call `useSpaceWeather()` and `useAlerts()` in component body. Add `<AlertsBanner />` before top bar. Add `<SpaceWeatherPanel />` between DSNStatus and CameraControls. Run `npm run build`.

9. **CSS animations (if needed)** -- Add pulse keyframes to `src/index.css` if continuous glow pulsing on WARNING/CAUTION alerts cannot be achieved with Framer Motion alone. Run `npm run build` for final verification.

## Constraints

- No external API calls -- all data is synthetic, computed client-side
- No new npm dependencies -- use only existing Framer Motion 12, Zustand 5, React 19
- Follow existing component patterns: DSNStatus for compact widgets, TelemetryCard for glass cards, useDSN for polling hooks
- Use existing theme tokens for all colors: `--color-hud-blue` (#00d4ff), `--color-hud-green` (#00ff88), `--color-hud-orange` (#ff8c00), `--color-hud-red` (#ff4444)
- Glass-morphism: `bg-[rgba(10,10,30,0.7)] backdrop-blur-sm border border-[rgba(0,212,255,0.2)] rounded-lg`
- TypeScript strict -- `npm run build` (which runs `tsc -b && vite build`) must pass with zero errors
- Mobile responsive -- all new components must work at 375px viewport width
- Additive store changes only -- do not modify existing store fields or actions
- `LAUNCH_EPOCH` from `mission-config.ts` is the single source of truth for mission time

## Acceptance Criteria

- [ ] `npm run build` succeeds with zero errors
- [ ] SpaceWeatherPanel appears in HUD bottom section between DSN status and camera controls
- [ ] SpaceWeatherPanel shows: Kp index with colored indicator, solar wind speed in km/s, radiation zone label with status dot, "SIM" source badge
- [ ] SpaceWeatherPanel values update every 5 seconds based on mission elapsed time and spacecraft Earth distance
- [ ] Kp indicator color changes: green (0-3), orange (4-5), red (6+)
- [ ] Radiation zone dot color changes: green (clear/deep-space), orange (slot-region/outer-belt), red (inner-belt)
- [ ] AlertsBanner renders above the HUD top bar, does not obstruct 3D scene when no alerts active
- [ ] Alerts slide in from top with opacity fade, exit by sliding right with opacity fade
- [ ] Maximum 3 alerts visible simultaneously
- [ ] INFO alerts auto-dismiss after 8 seconds
- [ ] NOMINAL alerts auto-dismiss after 6 seconds
- [ ] CAUTION alerts auto-dismiss after 12 seconds
- [ ] WARNING alerts auto-dismiss after 20 seconds and show red glow pulse
- [ ] Close button on each alert dismisses it immediately
- [ ] Duplicate alerts (same type + message within 60 seconds) are suppressed
- [ ] Van Allen belt entry triggers CAUTION alert when earthDistKm crosses 1,000 km (outbound)
- [ ] Inner belt peak radiation triggers WARNING alert (earthDistKm 2,500-4,000 km range)
- [ ] Scripted M-class flare at MET ~48h triggers CAUTION alert
- [ ] Scripted CME arrival at MET ~120h triggers WARNING alert
- [ ] Milestone approach fires INFO alert at T-30min before each MILESTONE
- [ ] Milestone arrival fires INFO alert at T-0 for each MILESTONE
- [ ] Mobile layout (375px) does not overflow or break

---

## Plan Output Instructions

**IMPORTANT**: Before creating the implementation plan, you MUST enter plan mode:

1. Call `EnterPlanMode` to enter plan mode
2. Explore the codebase using read-only tools (Read, Grep, Glob)
3. Write the plan to `docs/plans/PLAN_2026-04-04_space_weather_alerts.md`
4. Call `ExitPlanMode` to present the plan for user approval
5. After approval, invoke `/wrought-implement` to start implementation
