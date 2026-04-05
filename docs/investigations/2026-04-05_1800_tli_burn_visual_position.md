# Investigation: TLI Burn Visual Position on Trajectory

**Date**: 2026-04-05
**Investigator**: Claude Code (Session 6)
**Severity**: Medium
**Status**: Investigation Complete
**Mode**: Confirmation (re-opened from F6 in UI Visual Regressions tracker)

---

## Executive Summary

The user reports that the TLI Burn milestone is still in the wrong position on the trajectory, despite the Session 5/6 timing correction from T+1.75h to T+25.23h. Investigation confirms the **timing data is now correct** (T+25.23h matches NASA's published TLI at 7:49 PM EDT April 2, at the phasing orbit perigee). However, the visual position has a potential issue: at T+25.23h, the spacecraft is at 6,589 km from Earth center (0.659 su), which places the milestone marker only **0.022 su (220 km) above the Earth sphere surface** (0.637 su radius). The marker may appear to be on or inside Earth rather than clearly on the trajectory.

Further investigation is needed to determine what exact visual problem the user observes (screenshot analysis), but the data pipeline is functioning correctly. The marker renders at the interpolated OEM position for T+25.23h, which IS the phasing orbit perigee.

---

## Finding Reference

- **Tracker**: `docs/findings/2026-04-04_2200_ui_visual_regressions_session5_FINDINGS_TRACKER.md`
- **Finding**: F6 (10 of 19 milestone positions significantly wrong)
- **Previous status**: Resolved (2026-04-05 16:12 UTC)
- **Re-opened because**: User reports TLI Burn still in wrong position

---

## Confirmation Analysis

### 1. Data Verification -- TLI Burn Timing is Correct

The current `src/data/mission-config.ts` contains:
```typescript
{ name: 'TLI Burn', missionElapsedHours: 25.23, description: 'Translunar Injection at phasing orbit perigee — Orion ESM engine, 5m50s burn' },
```

This matches NASA's published TLI time: 7:49 PM EDT April 2, 2026 = T+25.23h after launch at 22:35 UTC April 1.

The duplicate "TLI Perigee" milestone has been correctly removed.

### 2. OEM Position Verification -- Position is Correct

At T+25.23h, the Lagrange interpolation of OEM data yields:
- **Position**: (2,290, 5,430, 2,940) km = (0.229, 0.543, 0.294) scene units
- **Distance from Earth center**: 6,589 km = 0.659 su
- **Earth sphere radius**: 6,370 km = 0.637 su
- **Altitude above Earth sphere**: 220 km = 0.022 su

This IS the phasing orbit perigee. The OEM data confirms minimum distance in the T+20-30h window is 6,564 km at T+25.25h. The TLI burn occurs at this perigee, which is correct -- Artemis II uses the phasing orbit perigee for the TLI burn using the Orion ESM engine.

### 3. Interpolator Verification -- No Clamping

The TLI epoch (T+25.23h = 2026-04-02T23:48:48Z) falls well within the OEM data range:
- OEM START: 2026-04-02T01:57:37Z (T+3.38h)
- TLI BURN: 2026-04-02T23:48:48Z (T+25.23h)
- OEM STOP: 2026-04-10T23:53:24Z (T+217.31h)

No clamping occurs. The interpolator uses degree-8 Lagrange polynomials with dense OEM coverage in this region (~50 vectors between T+24h and T+27h).

### 4. Trajectory Context -- Phasing Orbit Profile

The trajectory near TLI follows this path:
| MET (h) | Distance from Earth (km) | Scene Position | Description |
|---------|--------------------------|----------------|-------------|
| 3.38 | 28,409 | (-2.447, -1.268, -0.690) | Start of OEM data (LEO departure) |
| 13.55 | 76,523 | (-1.720, -6.560, -3.545) | Phasing orbit apogee |
| 25.23 | 6,589 | (0.229, 0.543, 0.294) | **TLI Burn (phasing perigee)** |
| 25.25 | 6,564 | (0.148, 0.563, 0.304) | Perigee minimum |
| 28.2 | ~21,000 | | OTB-1 (post-TLI coast) |
| ~114 | ~413,000 | | Lunar region |

The TLI burn position is very close to Earth by design -- the spacecraft returns to low altitude after the phasing orbit before the TLI burn propels it toward the Moon.

### 5. Visual Concern -- Marker Very Close to Earth Surface

The TLI marker at 0.659 su sits only 0.022 su above the Earth sphere (0.637 su radius). At typical trajectory overview zoom levels (20-40 su camera distance), this 0.022 su gap is **subpixel** -- the marker appears to be on or inside Earth.

This is physically correct (the perigee IS at LEO altitude) but may create a visual perception issue where the user believes the marker is in the wrong place because it overlaps with Earth.

### 6. Progress Bar Verification

The progress bar position is:
- `(25.23 / 217.53) * 100 = 11.6%`

At 11.6% along the bar, TLI Burn appears early in the mission timeline, which is correct for a T+25h event in a 217h mission.

---

## Past RCAs/Investigations Reviewed

| Document | Relevance |
|----------|-----------|
| `docs/investigations/2026-04-05_1600_milestone_trajectory_position_accuracy.md` | The investigation that identified TLI at T+1.75h was wrong. **Fixes were applied.** |
| `docs/RCAs/2026-04-05_1600_milestone_trajectory_position_accuracy.md` | RCA for 10/19 milestone errors. All recommended fixes were implemented. |
| `docs/investigations/2026-04-05_0700_true_scale_moon_trajectory_clearance.md` | Earth set to true scale (0.637 su). This creates the near-overlap at TLI perigee. |

### Pattern Identified

This is the **4th revisit** of milestone positioning. Each time the data has been improved, but visual verification against the actual 3D scene has been insufficient. The Session 5 investigation focused on timing accuracy (comparing hours) but did not verify the 3D visual result of placing a marker at the phasing orbit perigee altitude.

---

## Scope Assessment

**Isolated**: This issue is specific to TLI Burn's visual position. The other milestone positions were corrected in the F6 fix and their visual positions appear reasonable (they are further from Earth where visual overlap is not an issue).

However, the pre-OEM milestones (Launch, SRB Sep, Core Stage Sep, Perigee Raise, Belt Transit) all clamp to the first OEM vector at T+3.38h, which is also a concern -- 5 milestones at the same 3D point.

---

## Hypotheses for User-Reported Issue

Without seeing the screenshot, there are three possible explanations for the user's report:

### H1: TLI marker overlaps with Earth sphere (cosmetic issue)
The marker at 0.022 su above Earth surface appears inside Earth at overview zoom. The user interprets this as "wrong position" because they expect TLI to be away from Earth on the outbound leg.

### H2: TLI marker appears on wrong part of the trajectory visually
The phasing orbit forms a loop back to Earth before departing for the Moon. If the user expects TLI Burn to be on the outbound leg (away from Earth toward the Moon), seeing it near Earth would look wrong -- even though it IS correct (TLI happens at perigee before the translunar coast begins).

### H3: Progress bar dot position looks wrong
The TLI Burn dot at 11.6% along the progress bar might appear too early or too late relative to where the user expects it, compared to other milestone dots.

---

## Impact Assessment

| Metric | Value |
|--------|-------|
| Data accuracy | Correct (T+25.23h, NASA-verified) |
| 3D position accuracy | Correct (0.229, 0.543, 0.294 su from interpolation) |
| Visual clarity | Poor -- 0.022 su gap to Earth surface is subpixel at overview zoom |
| Affected milestones | 1 (TLI Burn), potentially 5 more (pre-OEM clamped milestones) |
| User impact | Confusing -- correct data rendered in visually ambiguous location |

---

## Recommended Next Steps

1. **Confirm exact user concern** from the screenshot: is it the 3D marker position, the progress bar dot, or the expected trajectory location?
2. If H1/H2: Consider whether TLI Burn should show a special visual treatment (e.g., label offset, highlight) since it physically occurs at low altitude
3. The pre-OEM milestone clamping issue (5 milestones at same point) remains unaddressed from the original F6 investigation

---

**Investigation Complete**: 2026-04-05 18:00 UTC
**Ready for**: User clarification on the specific visual issue observed, then RCA if needed
