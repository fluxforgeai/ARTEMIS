# Finding: OEM Data Source Configuration Drift from NASA Latest

**Date**: 2026-04-03
**Discovered by**: F1 verification testing (Session 2)
**Type**: Drift
**Severity**: Low
**Status**: Open

---

## What Was Found

The OEM API URL and bundled fallback file both reference the pre-TLI ephemeris (`artemis-ii-oem-2026-04-02-to-ei-v3.zip`, created 2026-04-02T14:06:23 UTC), while NASA has published a newer post-TLI ephemeris (`artemis-ii-oem-2026-04-03-to-ei.zip`, created 2026-04-03T01:32:08 UTC).

Comparison of the two OEM files shows the trajectory data matches within 0.003%, confirming the pre-TLI prediction was accurate. However, the configuration has drifted from NASA's latest published data.

---

## Affected Components

- `api/oem.ts:3` — `OEM_ZIP_URL` constant points to old v3 file
- `public/fallback-oem.asc` — Bundled fallback is the pre-TLI v3 data (3,232 lines)

---

## Evidence

```
# Current configuration (api/oem.ts:3)
const OEM_ZIP_URL = 'https://www.nasa.gov/wp-content/uploads/2026/03/artemis-ii-oem-2026-04-02-to-ei-v3.zip';

# Latest available from NASA (found on tracking page, dated Apr 3)
https://www.nasa.gov/wp-content/uploads/2026/03/artemis-ii-oem-2026-04-03-to-ei.zip

# Comparison at 18:47 UTC April 3:
#   v3 (pre-TLI):  Earth dist = 177,855 km, Speed = 3,709 mph
#   Latest (post-TLI): Earth dist = 177,860 km, Speed = 3,710 mph
#   Delta: 0.003%

# New OEM metadata:
#   CREATION_DATE = 2026-04-03T01:32:08
#   START_TIME = 2026-04-02T01:57:37.084  (earlier start than v3)
#   STOP_TIME = 2026-04-10T23:53:24.536
#   Lines: 3,259 (vs 3,232 in v3)
```

---

## Preliminary Assessment

**Likely cause**: The OEM URL was hardcoded during Session 1 implementation before TLI occurred. NASA publishes updated OEM files after major maneuvers, and the configuration was not updated post-TLI.

**Likely scope**: Isolated to the OEM data pipeline. The URL and fallback file are the only two references. NASA may publish additional OEM updates after future correction burns (e.g., midcourse correction on Flight Day 3-4).

**Likely impact**: Negligible at present (0.003% data deviation). Impact would increase if NASA publishes trajectory corrections after maneuvers — the app would continue using the pre-maneuver prediction rather than the actual post-maneuver trajectory.

---

## Classification Rationale

**Type: Drift** — The configuration diverges from the upstream data source's current state. The code works correctly but points to a stale version.

**Severity: Low** — The data deviation is 0.003%, well within the 5% verification threshold. The mission is time-limited (~7 days remaining), reducing the window for further drift.

---

**Finding Logged**: 2026-04-03 19:07 UTC
