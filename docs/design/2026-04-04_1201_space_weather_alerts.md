# Design Analysis: Space Weather & Alert System

**Date**: 2026-04-04 12:01 UTC
**Analyst**: Claude Code (Session 4)
**Mode**: Tradeoff (from-scratch)
**Finding**: F3 in Post-MVP Visual & Data Features tracker (`docs/findings/2026-04-04_1201_post_mvp_visual_data_features_FINDINGS_TRACKER.md`)

---

## Executive Summary

The ARTEMIS mission tracker has no space weather data, no alert system, and no warning states on any HUD component. This design evaluates three data source approaches (live NOAA/DONKI API, synthetic mission-phase data, hybrid) and a cross-cutting alert notification architecture. The recommended approach is **Option C (Hybrid)** -- synthetic mission-phase data as the reliable baseline with live NOAA SWPC/DONKI overlays when available -- paired with a Framer Motion-animated alert banner and a compact SpaceWeatherPanel widget that follows the existing DSNStatus pattern.

---

## Current State Analysis

### What Exists

The HUD (`src/hud/HUD.tsx`) renders a two-section layout: a top bar (title + MissionClock) and a bottom section (DSNStatus + CameraControls + telemetry cards + ProgressBar). There is no alert region, no notification system, and no space weather display.

**Existing patterns worth following**:

- **DSNStatus** (`src/hud/DSNStatus.tsx`): Compact inline widget with colored status dots (green glow when active, gray when inactive). Reads from Zustand store (`dsnStations`), populated by `useDSN` hook that polls `api/dsn.ts` every 30 seconds. This is the best pattern for a SpaceWeatherPanel.
- **TelemetryCard** (`src/hud/TelemetryCard.tsx`): Glass-morphism card with Framer Motion spring-animated values. Currently has no warning/threshold states -- always renders in the color passed via props. Adding severity-based color shifts is a natural extension.
- **useMission** (`src/hooks/useMission.ts`): 1-second polling interval, derives phase from MILESTONES array. Alert triggers can piggyback on this phase detection.
- **Zustand store** (`src/store/mission-store.ts`): Flat state with typed setters. Easy to extend with `spaceWeather` and `alerts` slices.
- **Theme tokens** (`src/index.css`): `--color-hud-red: #ff4444`, `--color-hud-orange: #ff8c00`, `--color-hud-green: #00ff88`, `--color-hud-blue: #00d4ff`. Alert severity maps naturally to these existing tokens.

### What Already Exists But Is Underused

**Critical finding**: `api/donki.ts` already exists as a Vercel serverless proxy for the NASA DONKI Solar Flare endpoint. It fetches from `https://api.nasa.gov/DONKI/FLR?api_key=...` with 15-minute caching. This route is deployed but has no frontend consumer -- no hook, no component, no state reads from it. This significantly reduces the effort for Option A and Option C.

### What Is Missing

- No `useSpaceWeather` hook
- No `useAlerts` hook or alert state in Zustand
- No `SpaceWeatherPanel` component
- No `AlertsBanner` or toast notification component
- No warning/threshold states on TelemetryCard
- No alert region in HUD layout
- No synthetic space weather data generator
- No milestone approach notification system

---

## External Research (2026 Sources)

### NASA DONKI API

The Database Of Notifications, Knowledge, Information (DONKI) is NASA's comprehensive space weather event database. Key endpoints via `api.nasa.gov/DONKI/`:

| Endpoint | Data | Relevance to Artemis II |
|----------|------|------------------------|
| `/FLR` | Solar flares (class, peak time, source) | Direct crew radiation risk |
| `/CME` | Coronal mass ejections (speed, half-angle, arrival time) | Transit radiation spike risk |
| `/SEP` | Solar energetic particles (fluence, peak flux) | Crew dose rate spikes |
| `/GST` | Geomagnetic storms (Kp index, start/end) | Communications disruption |
| `/RBE` | Radiation belt enhancement | Van Allen belt transit risk |
| `/HSS` | High-speed solar wind streams | Background radiation levels |
| `/notifications` | Combined alerts (type-filterable) | All-in-one alert feed |

Parameters: `startDate`, `endDate` (YYYY-MM-DD), `api_key`. Default range is last 7 days. Max range 30 days. Free tier: 1000 requests/hour with `DEMO_KEY`, higher with registered key. JSON response.

The existing `api/donki.ts` already proxies the `/FLR` endpoint. Extending it to fetch `/notifications?type=all` would provide a unified event feed.

### NOAA SWPC Real-Time JSON Data

NOAA's Space Weather Prediction Center provides public JSON endpoints at `services.swpc.noaa.gov` with no API key required:

| Endpoint | Data | Update Frequency |
|----------|------|-----------------|
| `/products/noaa-planetary-k-index.json` | Kp index (geomagnetic activity, 0-9 scale) | Every 3 hours |
| `/products/noaa-planetary-k-index-forecast.json` | Kp forecast | Every 3 hours |
| `/products/solar-wind/plasma-1-day.json` | Solar wind speed, density, temperature | Every minute |
| `/products/solar-wind/mag-1-day.json` | Interplanetary magnetic field (Bz, Bt) | Every minute |
| `/json/planetary_k_index_1m.json` | 1-minute Kp estimates | Every minute |
| `/products/noaa-scales.json` | NOAA Space Weather Scales (R/S/G levels) | On change |

These are free, public, CORS-enabled JSON feeds. No API key. No rate limit documentation (but they serve the public SWPC website). The Kp index and NOAA Scales are the most user-friendly for display.

### Van Allen Belts and Artemis II Radiation Context

The Artemis II trajectory passes through the Van Allen radiation belts twice (outbound and return). Key facts for the alert system:

- **Inner belt** (proton-dominated): ~1,000-6,000 km altitude. Artemis I data: proton-belt crossing took ~30 minutes.
- **Outer belt** (electron-dominated): ~13,000-60,000 km altitude. Artemis I data: electron-belt crossing took ~2 hours.
- **Total transit time**: ~2.5-3 hours per crossing (outbound and return = ~5-6 hours total mission exposure).
- **Crew protection**: Orion has six HERA radiation sensors, crew active dosimeters, and a contingency "storm shelter" procedure (crew repositions stowed equipment to shield walls; can be built within 30 minutes, may need to shelter up to 24 hours).
- **Three radiation types**: galactic cosmic rays (constant background), Van Allen belt trapped particles (positional), solar energetic particles (event-driven, unpredictable).
- **Expected dose**: Comparable to ~1 month on ISS, about 5% of an astronaut's career limit.
- **Solar maximum context**: The mission occurs during Solar Cycle 25's maximum (2024-2026), meaning elevated solar activity. NASA's Space Radiation Analysis Group at JSC monitors real-time and provides go/no-go recommendations.

This context makes Van Allen belt transit warnings and solar event alerts genuinely meaningful to the mission narrative, not just cosmetic.

### Space Weather Dashboard UI Patterns

From NOAA's Space Weather Enthusiasts Dashboard and ESA's Space Weather portal:

- **NOAA Space Weather Scales**: Three categories -- Radio (R1-R5), Solar Radiation (S1-S5), Geomagnetic (G1-G5). Color-coded green/yellow/orange/red/extreme-red. Clean, standardized severity system.
- **Kp index visualization**: Typically a horizontal bar chart with 0-9 scale, color-transitioning from green (0-3) through yellow (4) to red (7-9). Compact and immediately readable.
- **Solar wind display**: Speed (km/s), density (p/cm3), temperature (K), and magnetic field Bz (nT). Typically shown as compact numeric readouts with trend arrows.
- **Key design principle**: Space weather dashboards use status indicators (colored dots/bars) rather than detailed charts for at-a-glance monitoring. Detailed views are secondary drill-downs.

### React Toast/Notification Patterns

- **Framer Motion AnimatePresence**: The standard for animated toast stacks in React. `mode="popLayout"` with `layout` prop ensures remaining toasts reflow when one dismisses. Exit animations require: AnimatePresence wrapper, unique `key`, direct child motion component.
- **Sonner** (shadcn/ui default): ~500K weekly downloads, Framer Motion-based, ARIA accessible. However, adding a dependency just for toasts in a project that already has Framer Motion would be unnecessary.
- **Custom approach**: With Framer Motion already in the project (v12.6.0) and Zustand for state, a custom alert queue is ~100 lines of code and matches the existing zero-external-dependency HUD pattern. The DSNStatus/TelemetryCard components demonstrate the project prefers custom over library.

---

## Data Source Options

### Option A: Live NOAA DONKI + SWPC API

**Architecture**: Extend `api/donki.ts` to proxy multiple DONKI endpoints and add a new `api/space-weather.ts` for SWPC data. A `useSpaceWeather` hook polls both on intervals. All data is real.

**API routes needed**:
- `api/donki.ts` -- extend to accept `?type=` param for FLR/CME/SEP/GST/RBE/notifications (currently hardcoded to FLR)
- `api/space-weather.ts` -- new route proxying SWPC JSON endpoints (Kp index, solar wind plasma, NOAA scales)

**Data available**:
- Kp index (0-9, 3-hour cadence) -- real geomagnetic activity
- Solar wind speed/density/temperature (1-minute cadence) -- real solar wind conditions
- NOAA Space Weather Scales (R/S/G levels) -- official severity ratings
- DONKI event notifications (flares, CMEs, storms) -- real event alerts

**Hook implementation**:
- `useSpaceWeather()` polls `api/space-weather.ts` every 5 minutes (SWPC data), `api/donki.ts` every 15 minutes (DONKI events)
- Parses JSON, derives severity levels, pushes alerts to Zustand store

**Pros**:
- Real data -- maximum scientific accuracy and educational value
- Already have `api/donki.ts` deployed (reduces effort)
- SWPC JSON is free, no key required, public endpoints
- Data is inherently interesting during Solar Cycle 25 maximum
- If a real solar event occurs during the Artemis II mission window, the tracker would show it

**Cons**:
- External API dependency -- if SWPC or DONKI is down, panel shows stale/empty data
- Data may be boring on quiet space weather days (Kp=1, no flares = nothing to show)
- Kp index updates every 3 hours -- long gaps between changes
- Solar wind data is at L1 point (1.5M km from Earth), not at Orion's actual position
- No Van Allen belt-specific data from these APIs (belt conditions must be inferred)
- CORS proxy needed for SWPC (unlike DONKI which routes through api.nasa.gov)
- DEMO_KEY rate limit (1000/hr) could be hit if many users access simultaneously

**Effort**: Medium. 1 new API route, 1 new hook, extend existing donki.ts, parser functions for SWPC JSON format.

### Option B: Synthetic Mission-Phase Data

**Architecture**: A data generator in `src/data/space-weather-synthetic.ts` produces deterministic space weather readings keyed to mission elapsed time and spacecraft position. No external API calls. Data is authored to be realistic and narratively interesting.

**Data generation approach**:
- **Kp index**: Baseline Kp=3 (moderate, realistic for solar max). Scripted variations: rises to Kp=5 during outbound Van Allen transit (MET 0.5-3h), drops to Kp=2 during quiet coast (MET 24-90h), rises to Kp=4 near lunar flyby (MET 96h), spikes to Kp=6 during a scripted solar event at MET ~120h (return coast), settles to Kp=3 for re-entry.
- **Solar wind**: Baseline 400 km/s. Tied to Kp with realistic correlation. Spikes to 600 km/s during the scripted storm event.
- **Radiation dose rate**: Function of distance from Earth (peaks in Van Allen belts ~3,000-30,000 km), with solar event overlays. Uses simplified inverse-square and belt-crossing models.
- **Van Allen belt status**: Derived from spacecraft Earth distance. "Entering inner belt" at ~1,000 km, "peak radiation zone" at ~3,000 km, "outer belt transit" at ~15,000 km, "clear" beyond ~60,000 km.
- **Scripted events**: 2-3 pre-authored solar events (M-class flare at MET ~48h, CME arrival at MET ~120h) that trigger alerts at dramatically appropriate moments.

**Pros**:
- Zero external dependencies -- always works, never stale, no API outages
- Narratively curated -- events happen at interesting mission moments (belt crossings, deep space, return)
- Deterministic and testable -- same input always produces same output
- Van Allen belt awareness -- can model belt-specific radiation that real APIs cannot
- Lightweight -- pure functions, no network calls, no API routes needed
- Fastest to implement

**Cons**:
- Not real data -- educational accuracy is limited to the authored model's quality
- Repetitive on repeat visits -- same "story" every time
- Cannot react to actual solar events (a real X-class flare during Artemis II would not appear)
- Users who check against real SWPC data would see discrepancies
- Requires authoring realistic-looking data curves (research effort upfront)

**Effort**: Low-Medium. No API routes, no hooks with fetch logic. Pure data module + existing hook pattern. Main effort is authoring believable data curves.

### Option C: Hybrid (Synthetic Baseline + Live Overlay)

**Architecture**: Synthetic data runs as the always-available baseline. A `useSpaceWeather` hook attempts to fetch live data from SWPC/DONKI. When live data is available, it overlays/merges with synthetic data. When live APIs fail, synthetic data continues seamlessly. The user sees a small indicator showing data source status.

**Merge strategy**:
- **Kp index**: Use live Kp when available, fall back to synthetic. Display source indicator.
- **Solar wind**: Use live solar wind when available, fall back to synthetic baseline.
- **DONKI events**: Live events are additive -- they appear alongside scripted events. Real flares/CMEs show with a "LIVE" badge.
- **Van Allen belt status**: Always synthetic (derived from spacecraft position) -- no live API provides this.
- **Radiation estimate**: Synthetic baseline (position-based) + live event overlays (if DONKI reports active events, boost the dose rate estimate).

**Fallback behavior**:
1. On mount: Synthetic data renders immediately (no loading state)
2. Background fetch: `useSpaceWeather` attempts live API calls
3. Success: Live data merges in, source indicator shows "LIVE" dot
4. Failure: Synthetic continues, source indicator shows "SIM" label
5. Stale: If live data is older than 30 minutes, revert to synthetic with "SIM" label

**Pros**:
- Best of both worlds -- always has data (synthetic), enhanced when live is available
- Graceful degradation -- no empty states, no loading spinners for weather data
- Van Allen belt modeling (synthetic) + real solar activity (live) = most complete picture
- Educational value: users see that some data is simulated vs real, learning about data provenance
- Existing `api/donki.ts` reduces live integration effort
- Extensible -- can add more live sources over time without changing the synthetic baseline

**Cons**:
- Most complex to implement -- merge logic, source tracking, dual data paths
- Potential confusion if live and synthetic data disagree significantly
- More state to manage (live data, synthetic data, source status, merge result)
- Testing requires mocking both paths

**Effort**: Medium-High. Synthetic data module + API route extension + hook with merge logic + source status indicator. Roughly 1.5x the effort of Option A or Option B alone.

---

## Alert System Design (All Options)

The alert system is orthogonal to the data source choice. All three options feed into the same alert architecture.

### Alert Types

| Type | Source | Example | Trigger |
|------|--------|---------|---------|
| **Space Weather** | DONKI/synthetic | "Solar Flare M2.3 detected" | Event data from space weather feed |
| **Radiation Zone** | Spacecraft position | "Entering Van Allen Inner Belt" | Earth distance crosses threshold |
| **Milestone** | Mission elapsed time | "Lunar Flyby in 30 minutes" | MET approaches milestone time |
| **Telemetry** | Spacecraft state | "Max velocity reached: 39,400 km/h" | Value crosses threshold |
| **System** | API status | "DSN data unavailable" | Fetch failure |

### Alert Severity Levels & Visual Treatment

| Severity | Color Token | Glow Color | Use Cases | Auto-dismiss |
|----------|-------------|------------|-----------|--------------|
| **INFO** | `--color-hud-blue` (#00d4ff) | Cyan glow | Milestones, telemetry facts | 8 seconds |
| **NOMINAL** | `--color-hud-green` (#00ff88) | Green glow | Belt exit, storm all-clear | 6 seconds |
| **CAUTION** | `--color-hud-orange` (#ff8c00) | Orange glow | Elevated Kp, belt approach | 12 seconds |
| **WARNING** | `--color-hud-red` (#ff4444) | Red glow | Solar flare, CME arrival, belt peak | 20 seconds |

Visual treatment per severity:
- **INFO**: Subtle slide-in from top, thin left border accent, standard glass background
- **NOMINAL**: Slide-in, green left border, brief green pulse on entry
- **CAUTION**: Slide-in with slight scale bounce, orange left border, orange glow pulse, persistent until dismissed or auto-timeout
- **WARNING**: Slide-in with pronounced bounce, red left border, pulsing red glow (1s interval), longer persistence, optional screen-edge vignette effect

All alerts have:
- Framer Motion `AnimatePresence` for enter/exit animations
- `initial={{ opacity: 0, y: -20 }}`, `animate={{ opacity: 1, y: 0 }}`, `exit={{ opacity: 0, x: 100 }}`
- Glass-morphism background matching existing HUD panels
- Dismiss button (x icon) for manual close
- Stacking with `layout` prop for smooth reflow

### Component Architecture

```
AlertsBanner (top of HUD, above title bar)
  |-- AnimatePresence
       |-- AlertItem (severity, message, timestamp, dismiss callback)
       |-- AlertItem ...
       |-- (max 3 visible, older ones auto-dismiss)

SpaceWeatherPanel (next to DSNStatus in bottom section)
  |-- Kp index indicator (colored bar/number, 0-9)
  |-- Solar wind speed (compact number + unit)
  |-- Radiation status (zone label + severity dot)
  |-- Source indicator ("LIVE" green dot or "SIM" gray label)

[Zustand store additions]
  alerts: Alert[]                    -- notification queue
  spaceWeather: SpaceWeatherState    -- current conditions
  addAlert: (alert) => void          -- enqueue with dedup
  dismissAlert: (id) => void         -- remove by id
  setSpaceWeather: (data) => void    -- update conditions
```

### Alert Queue Management

- **Max queue size**: 10 alerts (oldest auto-evicted)
- **Max visible**: 3 alerts rendered simultaneously
- **Deduplication**: Same type + same message within 60 seconds = ignored
- **Priority**: WARNING alerts push to front of queue, displacing INFO alerts
- **Persistence**: WARNING alerts require manual dismiss or longer timeout (20s vs 6-8s for INFO/NOMINAL)

### Notification Flow

```
Data Source (synthetic/live) 
  --> useSpaceWeather hook (detects threshold crossings, new events)
    --> Zustand addAlert() (deduplication, queue management)
      --> AlertsBanner reads alerts[] from store
        --> AnimatePresence renders/removes AlertItems
          --> Auto-dismiss timer or manual close calls dismissAlert()
```

### Milestone Approach Notifications

The existing `MILESTONES` array in `mission-config.ts` provides 9 events with `missionElapsedHours`. The alert system should fire notifications at:
- **T-30 minutes**: "Lunar Flyby in 30 minutes" (INFO severity)
- **T-0**: "Lunar Flyby: Closest approach ~8,900 km above far side" (INFO severity)
- **On-event thresholds**: "Entering Van Allen belt" when `earthDist` crosses 1,000 km (CAUTION)

These tie into the F2 (Crew Timeline) feature -- the alert system provides the notification infrastructure that F2's timeline markers would also use.

---

## Trade-Off Matrix

| Criterion | Weight | Option A: Live API | Option B: Synthetic | Option C: Hybrid |
|-----------|--------|--------------------|---------------------|------------------|
| **Realism** | 35% | 9 -- real SWPC/DONKI data | 5 -- authored approximations | 8 -- real when available, good synthetic fallback |
| **Reliability** | 25% | 4 -- depends on external APIs | 10 -- zero dependencies | 8 -- always has synthetic, enhanced by live |
| **Simplicity** | 20% | 6 -- API routes + parsing + error handling | 8 -- pure functions, no network | 4 -- dual paths, merge logic, source tracking |
| **Extensibility** | 10% | 8 -- add more SWPC endpoints easily | 5 -- must author each new data type | 9 -- plug in new live sources to existing merge |
| **Narrative Quality** | 10% | 3 -- real data may be boring on quiet days | 9 -- curated dramatic moments | 7 -- synthetic drama + real enhancement |
| **Weighted Score** | 100% | **6.15** | **7.15** | **7.05** |

Detailed scoring notes:
- Option A scores highest on realism but lowest on reliability and narrative quality. A quiet space weather day (which is most days) produces a boring display.
- Option B scores highest overall due to reliability and narrative quality, but its realism score is a significant weakness for an educational project.
- Option C nearly matches Option B's total while scoring much higher on realism and extensibility, at the cost of implementation complexity.

---

## Recommendation

**Option C (Hybrid)** is recommended, implemented in two phases:

### Phase 1: Synthetic Core + Alert Infrastructure (Primary Deliverable)
Build the synthetic data generator, SpaceWeatherPanel, AlertsBanner, Zustand state, and the `useSpaceWeather` / `useAlerts` hooks. This delivers the full user-visible feature with zero external dependencies. The synthetic data is tuned to the Artemis II trajectory timeline for maximum narrative engagement.

### Phase 2: Live Overlay (Enhancement)
Extend the existing `api/donki.ts` route and add `api/space-weather.ts` for SWPC. Wire the merge logic into `useSpaceWeather`. Add source indicator to SpaceWeatherPanel. This phase is independently deployable and can be deferred if time is tight.

**Rationale**: ARTEMIS is an educational/visualization project, not a mission-critical system. Users visit to experience the Artemis II mission, not to monitor real space weather. The synthetic data guarantees every visitor sees something interesting (Van Allen belt crossings, solar events, milestone alerts). The live overlay adds genuine scientific credibility when available but is not required for the feature to be compelling. The phased approach means Phase 1 can ship independently as a complete feature.

---

## Impact Assessment

### New Files
- `src/data/space-weather-synthetic.ts` -- Synthetic data generator (mission-phase-based)
- `src/hooks/useSpaceWeather.ts` -- Space weather data hook (synthetic + optional live)
- `src/hooks/useAlerts.ts` -- Alert queue management hook (threshold detection, milestone notifications)
- `src/hud/SpaceWeatherPanel.tsx` -- Compact weather display widget (follows DSNStatus pattern)
- `src/hud/AlertsBanner.tsx` -- Animated notification stack (top of HUD)
- `src/hud/AlertItem.tsx` -- Individual alert notification component
- `api/space-weather.ts` -- SWPC JSON proxy (Phase 2)

### Modified Files
- `src/store/mission-store.ts` -- Add `spaceWeather`, `alerts` state slices and setters
- `src/hud/HUD.tsx` -- Add AlertsBanner (top), SpaceWeatherPanel (bottom, next to DSNStatus)
- `src/hud/TelemetryCard.tsx` -- Optional: add `severity` prop for warning-state color shifts
- `api/donki.ts` -- Extend to accept `?type=` parameter (Phase 2)
- `src/index.css` -- Optional: add `@keyframes` for alert pulse animations if not done in Framer Motion

### State Management Additions (Zustand)
```
spaceWeather: {
  kpIndex: number;           // 0-9
  solarWindSpeed: number;    // km/s
  radiationZone: string;     // 'clear' | 'inner-belt' | 'outer-belt' | 'deep-space'
  radiationLevel: string;    // 'nominal' | 'elevated' | 'high'
  source: 'synthetic' | 'live' | 'mixed';
  lastUpdated: number;       // timestamp
}
alerts: Alert[];             // { id, type, severity, message, timestamp, autoDismissMs }
```

### External API Dependencies (Phase 2 Only)
- `services.swpc.noaa.gov` -- Free, no key, public JSON. No documented rate limit.
- `api.nasa.gov/DONKI/` -- Free with `DEMO_KEY` (1000 req/hr) or registered key. Already in use.
- Both proxied through Vercel serverless functions (existing pattern).

---

## Architecture Sketch

### Data Flow

```
                                    Phase 2 (live overlay)
                                    ----------------------
                                    api/space-weather.ts
                                        |
                                    SWPC JSON (Kp, solar wind)
                                        |
                                    api/donki.ts (?type=all)
                                        |
                                    DONKI JSON (flares, CMEs, storms)
                                        |
                                        v
Phase 1 (core)                  useSpaceWeather hook
--------------                  (merge logic, source tracking)
space-weather-synthetic.ts  --->        |
(mission-phase generator)       Zustand: spaceWeather state
        |                               |
        v                               v
useAlerts hook  <------- threshold detection + event parsing
        |
        v
Zustand: alerts[] state
        |
        +---> AlertsBanner (AnimatePresence stack, top of HUD)
        +---> SpaceWeatherPanel (compact widget, bottom of HUD)
        +---> TelemetryCard (optional severity prop for color shift)
```

### Component Hierarchy (HUD Layout)

```
HUD (absolute inset-0, flex column)
  |
  +-- AlertsBanner (NEW, absolute top, z-20, above title)
  |     |-- AlertItem (WARNING, red pulse)
  |     |-- AlertItem (INFO, cyan)
  |     +-- (max 3 visible)
  |
  +-- Top bar (existing)
  |     |-- ARTEMIS II title
  |     +-- MissionClock
  |
  +-- Bottom section (existing, extended)
        |-- Row 1: DSNStatus + SpaceWeatherPanel (NEW) + CameraControls
        |-- Row 2: SpeedCard + EarthDistCard + MoonDistCard + ProgressBar
```

### Hook Dependencies

```
useMission() -----> getMissionElapsed() --> { currentPhase, totalMs, progress }
                                                |
useSpaceWeather() --> synthetic generator ------+-- uses MET + earthDist for belt detection
        |          +-> live API fetch (Phase 2)  
        |          +-> merge logic (Phase 2)
        v
Zustand.setSpaceWeather()
        |
useAlerts() --> reads spaceWeather + spacecraft state
        |   --> compares against thresholds
        |   --> checks milestone approach times  
        v
Zustand.addAlert() (with dedup)
```

### Synthetic Data Generator Interface

```
generateSpaceWeather(missionElapsedMs: number, earthDistKm: number): {
  kpIndex: number;
  solarWindSpeed: number;
  solarWindDensity: number;
  radiationZone: 'clear' | 'inner-belt' | 'outer-belt' | 'deep-space';
  radiationDoseRate: number;  // relative units, 0-100
  activeEvents: Array<{ type: string; class: string; startTime: number; description: string }>;
}
```

The generator uses deterministic functions of MET and position -- same inputs always produce same outputs. Scripted events are keyed to MET windows. Van Allen belt status is derived from `earthDistKm` thresholds.

---

## Sources

### NASA / Space Weather APIs
- [CCMC DONKI System](https://ccmc.gsfc.nasa.gov/tools/DONKI/) -- DONKI database and API documentation
- [NASA Open APIs](https://api.nasa.gov/) -- DONKI endpoint documentation and API keys
- [NOAA SWPC Data Access](https://www.swpc.noaa.gov/content/data-access) -- SWPC JSON data service overview
- [SWPC Products Index](https://services.swpc.noaa.gov/products/) -- Public JSON endpoint directory
- [SWPC Solar Wind Data](https://services.swpc.noaa.gov/products/solar-wind/) -- Real-time solar wind JSON files
- [NOAA Planetary K-index](https://www.swpc.noaa.gov/products/planetary-k-index) -- Kp index product page

### Artemis II Radiation Context
- [NASA: To Protect Artemis II Astronauts, Experts Keep Eyes on Sun](https://science.nasa.gov/missions/artemis/artemis-2/to-protect-artemis-ii-astronauts-nasa-experts-keep-eyes-on-sun/) -- HERA sensors, crew dosimeters, storm shelter procedures
- [Scientific American: Space Weather Could Threaten Artemis II Astronauts](https://www.scientificamerican.com/article/space-weather-could-threaten-nasas-artemis-ii-astronauts-during-their-trip/) -- Three radiation types, Van Allen belt transit times, dose estimates
- [Science.org: Scientists Confront Deep-Space Radiation](https://www.science.org/content/article/humans-return-moon-scientists-confront-dangers-deep-space-radiation) -- Radiation belt crossing durations from Artemis I data
- [Nature: Space Radiation Measurements During Artemis I](https://www.nature.com/articles/s41586-024-07927-7) -- Measured belt crossing times (inner ~30min, outer ~2hr)
- [ESA Orion Blog: Van Allen Belts](https://blogs.esa.int/orion/2022/12/10/the-van-allen-belts-are-they-dangerous/) -- Belt altitude ranges and radiation characteristics
- [SWSC Journal: Real-time Dose Prediction for Artemis](https://www.swsc-journal.org/articles/swsc/full_html/2025/01/swsc240037/swsc240037.html) -- Dose prediction models for Artemis missions

### Dashboard Design & Implementation
- [NOAA Space Weather Enthusiasts Dashboard](https://www.swpc.noaa.gov/communities/space-weather-enthusiasts-dashboard) -- Reference UI for space weather display
- [ESA Space Weather Portal](https://swe.ssa.esa.int/) -- European space weather dashboard patterns
- [SpaceWeatherLive](https://www.spaceweatherlive.com/) -- Real-time solar activity visualization
- [DEV.to: React Toast with Redux + Tailwind + Framer Motion](https://dev.to/christofferbergj/how-to-create-a-notificationtoast-system-in-react-typescript-with-redux-toolkit-tailwind-and-framer-motion-56d0) -- AnimatePresence toast pattern
- [BuildUI: Animated Toast Recipe](https://buildui.com/recipes/animated-toast) -- Framer Motion layout animation for toast stacks

### Codebase References
- `src/hud/DSNStatus.tsx` -- Pattern for compact status widget with colored indicators
- `src/hud/TelemetryCard.tsx` -- Glass-morphism card with Framer Motion spring animation
- `src/hud/HUD.tsx` -- Current HUD layout (alert region insertion points)
- `src/store/mission-store.ts` -- Zustand store pattern for new state slices
- `src/hooks/useDSN.ts` -- Polling hook pattern (AbortController, setInterval, store update)
- `src/data/mission-config.ts` -- MILESTONES array for milestone approach notifications
- `src/index.css` -- Theme tokens (hud-red, hud-orange, hud-green, hud-blue)
- `api/donki.ts` -- Existing DONKI proxy route (extend for Phase 2)
- `api/dsn.ts` -- API route pattern (CORS, caching, error handling)

---

**Analysis Complete**: 2026-04-04 12:01 UTC
