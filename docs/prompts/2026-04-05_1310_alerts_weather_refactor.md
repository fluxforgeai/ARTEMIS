# Implementation Prompt: Combined Alerts/Weather Refactor (F1-F6)

**Blueprint Reference**: docs/blueprints/2026-04-05_1310_alerts_weather_refactor.md
**Design Reference**: docs/design/2026-04-05_1300_alerts_weather_refactor.md

## Context

6 code quality findings in the alerts/weather subsystem from Session 4 forge-review. All in 4 files, one implementation pass.

## Goal

Fix effect coupling, timer lifecycle, selector granularity, dedup purity, and remount persistence in one refactor.

## Changes by File

### 1. `src/hooks/useAlerts.ts` (F2+F3+F4) — REWRITE

- Replace `useMissionStore((s) => s.spaceWeather)` with 3 field-level selectors: `radiationZone`, `kpIndex`, `activeEvents`
- Split single `useEffect` into Effect 1 (weather, depends on fields) and Effect 2 (milestones, own 30s interval)
- Move `firedMilestones` and `firedEvents` from `useRef` to module-level `Set`s
- Remove `useRef` imports for these two Sets

Full replacement code is in the blueprint (Step 1).

### 2. `src/hud/MissionEventsPanel.tsx` (F1) — MINOR

- Add `handleDismiss` callback: clears timer from map, then calls `dismissAlert`
- Replace `onClick={() => dismissAlert(alert.id)}` with `onClick={() => handleDismiss(alert.id)}`
- Add `useCallback` to imports if not already present

### 3. `src/hud/SpaceWeatherPanel.tsx` (F5) — ONE LINE

- Replace 4 individual `useMissionStore` calls (lines 84-87) with:
  `const { kpIndex, solarWindSpeed, radiationZone, source } = useMissionStore((s) => s.spaceWeather);`

### 4. `src/store/mission-store.ts` (F6) — ONE LINE

- Line 112: `Date.now() - a.timestamp` → `alert.timestamp - a.timestamp`

## Acceptance Criteria

- [ ] useAlerts: 2 effects (weather + milestone), field-level selectors, module-level Sets
- [ ] MissionEventsPanel: dismiss clears timer immediately
- [ ] SpaceWeatherPanel: 1 selector call (destructured)
- [ ] mission-store: dedup uses alert.timestamp
- [ ] Build passes
