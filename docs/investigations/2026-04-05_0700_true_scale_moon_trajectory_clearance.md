# Investigation: True-Scale Moon/Earth/Trajectory -- JPL Horizons Ephemeris Solution

**Date**: 2026-04-05
**Investigator**: Claude Code (Session 5)
**Severity**: High
**Status**: Investigation Complete
**Finding**: F3 in `docs/findings/2026-04-04_2200_ui_visual_regressions_session5_FINDINGS_TRACKER.md`
**Occurrence**: 7th investigation of Moon/trajectory rendering (Sessions 2-5) -- DEFINITIVE

---

## Executive Summary

All six prior investigations misidentified the root cause. The fundamental problem is NOT Moon sphere size, NOT the circumcenter algorithm's accuracy, and NOT a race condition. The problem is that **the circumcenter algorithm computes the center of the osculating circle of the trajectory, which is geometrically NOT the Moon's gravitational center**. The circumcenter is consistently ~5,000 km from the real Moon position and only ~3,000 km from the trajectory -- making it impossible for any reasonably-sized Moon sphere to avoid clipping the trajectory.

**The real fix**: Replace the circumcenter Moon positioning algorithm with the actual Moon position from JPL Horizons ephemeris data. With the correct Moon position, the trajectory clears the Moon by 8,357 km (0.84 scene units), providing ample room for even a true-to-scale Moon sphere (0.174 su) plus generous visual inflation.

This is the same approach that was identified in the very first RCA (`2026-04-04_2130_trajectory_near_moon.md`, Fix 3: "Unify Moon Position Source") but was never properly implemented because subsequent investigations kept adjusting the circumcenter algorithm instead of replacing it.

---

## Evidence

### JPL Horizons API Verification

Fetched geocentric J2000 Moon ephemeris from `https://ssd.jpl.nasa.gov/api/horizons.api` with `CENTER='500@399'` (Earth geocentric), `REF_SYSTEM='J2000'`, `REF_PLANE='FRAME'`, matching the OEM data's `REF_FRAME = EME2000` exactly.

**Moon position at flyby time (2026-04-06T23:06 UTC)**:
| Coordinate | JPL Horizons (km) | Scene units (su) |
|------------|-------------------|------------------|
| X | -129,045 | -12.9045 |
| Y | -335,994 | -33.5994 |
| Z | -185,274 | -18.5274 |
| Earth distance | 404,810 | 40.48 |

### Comparison: JPL vs Circumcenter

| Metric | Circumcenter | JPL Horizons | Delta |
|--------|-------------|--------------|-------|
| X (km) | -130,743 | -129,045 | 1,698 |
| Y (km) | -340,302 | -335,994 | 4,308 |
| Z (km) | -187,249 | -185,274 | 1,975 |
| Earth dist (km) | 409,831 | 404,810 | 5,021 |
| **Position error** | -- | -- | **5,034 km** |
| Trajectory clearance | 3,002 km | **8,357 km** | +5,355 km |

The circumcenter is 5,034 km from the real Moon -- close enough to look approximately right in the visualization, but critically wrong for trajectory clipping.

### Trajectory Clearance with JPL Moon Position

| Moon sphere radius | km | Scale | Points culled | Safe? |
|-------------------|----|-------|---------------|-------|
| 0.174 su (true Moon) | 1,737 | 1.0x | **0** | YES |
| 0.25 su | 2,500 | 1.44x | **0** | YES |
| 0.347 su (2x Moon) | 3,474 | 2.0x | **0** | YES |
| 0.50 su | 5,000 | 2.88x | **0** | YES |
| 0.637 su (true Earth) | 6,370 | 3.67x | **0** | YES |
| 1.0 su | 10,000 | 5.76x | 40 | CLIPS |
| 1.274 su (current Earth sphere) | 12,740 | 7.34x | 71 | CLIPS |

With the correct Moon position, a Moon sphere up to 0.637 su (true Earth radius!) produces ZERO trajectory clipping. The previous value of 0.50 su that was causing 168 points to be culled now causes zero clipping.

### Earth Trajectory Clearance

The last 14 trajectory points (re-entry) pass inside the current Earth sphere (1.274 su = 12,740 km). The closest point is 6,505 km (0.65 su) from Earth center. This is physically correct -- Orion re-enters Earth's atmosphere. The current `EARTH_VISUAL_RADIUS = 1.5` culling handles this appropriately.

| Earth sphere radius | km | Points inside | Context |
|--------------------|-----|---------------|---------|
| 0.637 su (true Earth) | 6,371 | 1 | Only the final reentry point |
| 1.274 su (2x Earth) | 12,740 | 35 | Re-entry + initial LEO departure |
| 1.5 su (current culling) | 15,000 | 35 | Same -- no excess culling |

The Earth sphere size (1.274 su, 2x real) is appropriate. The trajectory naturally passes through it during launch/reentry. The culling creates natural trajectory endpoints near Earth.

### Trajectory-Moon Distance Over Time

| Mission Phase | Idx | Time | Dist to Moon (km) | su |
|--------------|-----|------|-------------------|-----|
| Launch | 0 | Apr-02 02:00 | 366,609 | 36.66 |
| TLI + 1 day | 500 | Apr-03 10:00 | 295,645 | 29.56 |
| Outbound coast | 1000 | Apr-04 19:00 | 171,691 | 17.17 |
| Lunar approach | 1500 | Apr-06 04:30 | 66,706 | 6.67 |
| Near flyby -3h | 1729 | Apr-06 19:45 | 15,652 | 1.57 |
| Near flyby -1h | 1759 | Apr-06 21:45 | 9,970 | 1.00 |
| **Perilune** | **1779** | **Apr-06 23:06** | **8,357** | **0.84** |
| Post flyby +1h | 1799 | Apr-07 00:25 | 10,011 | 1.00 |
| Post flyby +3h | 1829 | Apr-07 02:25 | 15,823 | 1.58 |
| Return coast | 2000 | Apr-07 14:00 | 54,190 | 5.42 |
| Mid-return | 2500 | Apr-08 23:10 | 159,519 | 15.95 |
| Near Earth | 3238 | Apr-10 23:53 | 399,664 | 39.97 |

The trajectory follows a classic free-return profile: approach, closest at 8,357 km, depart. The 0.84 su perilune clearance is perfectly safe for any reasonable Moon sphere size.

### Why the Circumcenter Was Wrong (Root Cause of Root Causes)

The circumcenter of three trajectory points gives the **center of the osculating circle**, not the gravitational focus. For a hyperbolic flyby:

1. The **radius of curvature** at perilune: `rho = r_p * (1 + e)` where e > 1
2. The **osculating circle center** is at distance `rho` from the trajectory -- BEYOND the gravitational body
3. But with widely-spaced points (span=50, ~3.3 hours of arc), the circumcircle radius collapses to just ~3,300 km (much less than the actual radius of curvature)
4. The Earth's gravity pulls the trajectory inward, making the Earth-centered curvature different from the Moon-centered curvature

At span=1 (4 min), the circumcircle radius is 2,336 km. At span=50, it's 3,323 km. Neither is anywhere near the 10,637 km perilune distance. **The circumcenter approach is fundamentally unsuited for finding the gravitational focus of a flyby trajectory.**

### Why This Took 6 Investigations to Find

| Investigation | What it found | What it missed |
|--------------|---------------|----------------|
| 1 (Session 2) | Radial offset algorithm wrong | Circumcenter also wrong |
| 2 (Session 4) | Unit mismatch (km vs su) | Position was wrong too |
| 3 (Session 5a) | Circumcenter wrong region (parking orbit) | Even correct-region circumcenter is wrong |
| 4 (Session 5b) | Race condition: useOEM overwrites Moon | The computed position was also wrong |
| 5 (Session 5c) | Region fixed (apoapsis-based) | Still circumcenter, still wrong |
| 6 (Session 5d) | Moon sphere too large for clearance | Clearance is only 3k because position is wrong |
| **7 (this)** | **Circumcenter != Moon center** | -- |

Every prior investigation assumed the circumcenter was a valid approximation of the Moon's position and focused on secondary factors (units, race conditions, search regions, sphere sizes). None validated the fundamental assumption that the center of curvature of a trajectory arc equals the gravitational body center.

---

## Root Cause

**Primary**: The circumcenter algorithm (`circumcenter3D()` in Moon.tsx) computes the center of the osculating circle of the trajectory, which is the geometric center of curvature -- NOT the gravitational focus (Moon center). For hyperbolic flybys, these differ by thousands of kilometers. The circumcenter is consistently ~5,000 km from the true Moon position and only ~3,000 km from the trajectory, making trajectory clipping inevitable at any practical Moon sphere size.

**Contributing**: The OEM data is Earth-centered (EME2000) while the Moon is moving, so Earth-centered geometric analysis of the trajectory curve doesn't directly reveal the Moon's position. The Moon moves ~1 km/s in the Earth-centered frame, traversing ~43,200 km during the 12-hour flyby window.

---

## Fix Requirements

### 1. Replace Moon Position Algorithm with JPL Horizons Ephemeris

**Bundle a Moon ephemeris lookup table** covering the mission duration (April 2-11, 2026). Interpolate Moon position at the current simulation time. This gives the correct Moon position at all times, not just flyby.

Source: JPL Horizons API, geocentric J2000, 6-hour intervals (37 data points).

The ephemeris data is small (~2 KB as JSON) and can be:
- Bundled as a static JSON file (simplest, zero runtime API dependency)
- Fetched from JPL Horizons API at startup with static fallback

### 2. Make Moon Position Time-Varying

Currently, Moon is placed at a single computed position for the entire mission. In reality, the Moon moves ~13 degrees per day in its orbit. With the ephemeris approach, the Moon position can update with simulation time, showing the Moon's actual orbital motion. This is both more accurate and visually interesting.

### 3. Update Trajectory Culling

With the correct Moon position (8,357 km clearance at perilune), the culling in `splitAroundBodies()` must use the time-interpolated Moon position for each trajectory segment, not a single static position. At most time steps, the Moon is far from the trajectory, so culling is only relevant near the flyby window.

However, a simpler approach: since the Moon sphere will be at most 0.347 su (3,474 km) and the closest approach is 8,357 km, we can keep static culling with a reasonable radius and it will work because the Moon is now in the right place.

### 4. Scale Adjustments (Optional, Recommended)

With the correct Moon position giving 8,357 km (0.84 su) clearance, we can use more visually proportional scaling:

| Body | True radius | Recommended scale | Sphere (su) | Clearance |
|------|------------|-------------------|-------------|-----------|
| Earth | 6,371 km (0.637 su) | 2.0x | 1.274 su | 15,000+ km from most trajectory |
| Moon | 1,737 km (0.174 su) | 2.0x | 0.347 su | 4,883 km from trajectory |

Both at 2.0x makes them visually proportional to each other while maintaining safe clearance.

### 5. Files Affected

| File | Changes |
|------|---------|
| `src/components/Moon.tsx` | Replace circumcenter algorithm with ephemeris lookup; accept time-varying position |
| `src/components/Trajectory.tsx` | Update Moon position source for culling; may simplify culling radii |
| `src/data/moon-ephemeris.ts` (NEW) | Bundled JPL Horizons ephemeris data + interpolation function |
| `src/components/DataDriver.tsx` | May need update for time-varying Moon distance |
| `src/components/Earth.tsx` | Moon distance display -- now uses correct time-varying distance |

---

## JPL Horizons Ephemeris Data

Geocentric J2000 Moon position, April 2-11 2026, 6-hour intervals. Ready to bundle:

```json
[
  {"t":"2026-04-02T00:00","x":-385833.807,"y":-60038.527,"z":-46890.717},
  {"t":"2026-04-02T06:00","x":-381939.648,"y":-78884.887,"z":-56872.562},
  {"t":"2026-04-02T12:00","x":-376885.521,"y":-97491.542,"z":-66680.371},
  {"t":"2026-04-02T18:00","x":-370694.333,"y":-115802.919,"z":-76285.141},
  {"t":"2026-04-03T00:00","x":-363392.052,"y":-133765.009,"z":-85658.833},
  {"t":"2026-04-03T06:00","x":-355007.554,"y":-151325.481,"z":-94774.423},
  {"t":"2026-04-03T12:00","x":-345572.460,"y":-168433.785,"z":-103605.961},
  {"t":"2026-04-03T18:00","x":-335120.984,"y":-185041.244,"z":-112128.605},
  {"t":"2026-04-04T00:00","x":-323689.769,"y":-201101.132,"z":-120318.662},
  {"t":"2026-04-04T06:00","x":-311317.733,"y":-216568.744,"z":-128153.615},
  {"t":"2026-04-04T12:00","x":-298045.917,"y":-231401.450,"z":-135612.152},
  {"t":"2026-04-04T18:00","x":-283917.326,"y":-245558.747,"z":-142674.185},
  {"t":"2026-04-05T00:00","x":-268976.793,"y":-259002.295,"z":-149320.861},
  {"t":"2026-04-05T06:00","x":-253270.829,"y":-271695.948,"z":-155534.579},
  {"t":"2026-04-05T12:00","x":-236847.495,"y":-283605.778,"z":-161298.991},
  {"t":"2026-04-05T18:00","x":-219756.266,"y":-294700.093,"z":-166599.011},
  {"t":"2026-04-06T00:00","x":-202047.917,"y":-304949.445,"z":-171420.816},
  {"t":"2026-04-06T06:00","x":-183774.398,"y":-314326.643,"z":-175751.842},
  {"t":"2026-04-06T12:00","x":-164988.735,"y":-322806.754,"z":-179580.784},
  {"t":"2026-04-06T18:00","x":-145744.921,"y":-330367.107,"z":-182897.596},
  {"t":"2026-04-07T00:00","x":-126097.825,"y":-336987.291,"z":-185693.483},
  {"t":"2026-04-07T06:00","x":-106103.101,"y":-342649.159,"z":-187960.900},
  {"t":"2026-04-07T12:00","x":-85817.105,"y":-347336.829,"z":-189693.548},
  {"t":"2026-04-07T18:00","x":-65296.821,"y":-351036.682,"z":-190886.373},
  {"t":"2026-04-08T00:00","x":-44599.781,"y":-353737.371,"z":-191535.566},
  {"t":"2026-04-08T06:00","x":-23784.001,"y":-355429.827,"z":-191638.563},
  {"t":"2026-04-08T12:00","x":-2907.914,"y":-356107.270,"z":-191194.045},
  {"t":"2026-04-08T18:00","x":17969.697,"y":-355765.220,"z":-190201.950},
  {"t":"2026-04-09T00:00","x":38789.761,"y":-354401.523,"z":-188663.472},
  {"t":"2026-04-09T06:00","x":59492.982,"y":-352016.367,"z":-186581.079},
  {"t":"2026-04-09T12:00","x":80019.905,"y":-348612.317,"z":-183958.520},
  {"t":"2026-04-09T18:00","x":100310.982,"y":-344194.345,"z":-180800.842},
  {"t":"2026-04-10T00:00","x":120306.645,"y":-338769.871,"z":-177114.409},
  {"t":"2026-04-10T06:00","x":139947.381,"y":-332348.808,"z":-172906.919},
  {"t":"2026-04-10T12:00","x":159173.819,"y":-324943.607,"z":-168187.430},
  {"t":"2026-04-10T18:00","x":177926.816,"y":-316569.312,"z":-162966.385},
  {"t":"2026-04-11T00:00","x":196147.562,"y":-307243.620,"z":-157255.635}
]
```

---

## Verification Plan

1. Moon sphere must NOT overlap with trajectory at any time (0 culled points)
2. Moon-Earth distance should show ~404,800 km at flyby (matches JPL data)
3. Moon should be visually centered within the trajectory's flyby curve
4. Trajectory should be continuous through the lunar flyby region (no gaps)
5. Earth sphere (1.274 su) culling should work unchanged (re-entry points culled naturally)
6. Earth and Moon should appear proportionally scaled (both at 2.0x real)
7. Build passes (`npm run build`)

---

## Past RCAs/Investigations Reviewed

| Document | Relevant Finding |
|----------|-----------------|
| `docs/RCAs/2026-04-04_2130_trajectory_near_moon.md` | Fix 3 recommended "unify Moon position source" -- never fully implemented |
| `docs/RCAs/2026-04-05_0105_trajectory_through_moon_race.md` | Race condition fixed but circumcenter still used |
| `docs/RCAs/2026-04-05_0210_moon_circumcenter_wrong_region.md` | Fixed search region but circumcenter still != Moon center |
| `docs/RCAs/2026-04-05_0435_moon_sphere_too_large.md` | Proposed shrinking Moon sphere -- treats symptom, not cause |
| `docs/investigations/2026-04-04_2330_trajectory_near_moon_rendering.md` | First identification of Moon position error |
| `docs/investigations/2026-04-05_0100_trajectory_through_moon_race_condition.md` | Race condition between useOEM and Moon.tsx |
| `docs/investigations/2026-04-05_0200_moon_position_circumcenter_wrong_region.md` | Circumcenter selecting parking orbit |
| `docs/investigations/2026-04-05_0430_moon_sphere_too_large_trajectory_clipping.md` | 168 points culled -- sphere size analysis |
| `docs/RCAs/2026-04-03_2024_camera_visual_bugs.md` | Prior camera/visual issues, different scope |

---

**Investigation Complete**: 2026-04-05 07:00 UTC
**Ready for**: RCA Document + Implementation Prompt
