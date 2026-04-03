# Investigation: OEM API Proxy Returns 502 -- ZIP Parser Bug

**Date**: 2026-04-03
**Investigator**: Claude Code (Session 2)
**Severity**: Medium
**Status**: Investigation Complete
**Finding**: F2 in `docs/findings/2026-04-03_1054_artemis_ii_live_visualization_FINDINGS_TRACKER.md`

---

## Executive Summary

The `/api/oem` Vercel serverless endpoint returns HTTP 502 because the custom ZIP parser in `api/oem.ts` cannot handle ZIP files that use **data descriptors** (bit 3 of general purpose flags). The NASA OEM ZIP file sets this flag, causing `compressedSize` in the local file header to be 0. The parser reads this 0 value, extracts zero bytes of compressed data, and the subsequent decompression/validation fails. This is a code bug in the ZIP parser, not a Vercel network restriction, NASA WAF, or timeout issue.

---

## External Research Findings

### Official Documentation Consulted

- **Vercel Functions Limits** ([vercel.com/docs/functions/limitations](https://vercel.com/docs/functions/limitations)): Hobby plan has 300s default timeout, 4.5MB response body limit, full Node.js API support. None of these limits are being hit.
- **Vercel 502 Debugging** ([vercel.com/kb/guide/how-to-debug-a-502-error](https://vercel.com/kb/guide/how-to-debug-a-502-error)): 502 means the function threw an error or returned an invalid response (distinct from 504 timeout).
- **ZIP File Format** ([PKWARE APPNOTE](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT)): Section 4.3.7 defines the data descriptor. When bit 3 of the general purpose bit flag is set, the compressed size and uncompressed size fields in the local file header are set to zero, and the correct values are stored in a data descriptor record that follows the compressed data.

### Known Issues / Community Reports

- Vercel community reports of `UND_ERR_CONNECT_TIMEOUT` and egress blocks were investigated but found not applicable -- the function responds in 0.42s, well within all limits.
- Dynamic `require('zlib')` in ESM contexts on Vercel was investigated but is a secondary concern -- the primary failure occurs before zlib is called because the compressed data slice is empty.

### API/Library Behavior Notes

- NASA's `www.nasa.gov` server uses nginx, serves the ZIP with `content-disposition: attachment`, `access-control-allow-origin: *`, and responds in ~60ms. No WAF/bot protection detected (no Akamai/Cloudflare headers).
- The ZIP file is 188,513 bytes (184KB), well within Vercel's 4.5MB response limit.
- All four other NASA API proxies (`/api/dsn`, `/api/horizons`, `/api/donki`, `/api/chat`) work correctly from the same Vercel deployment, confirming no network-level issue.

---

## Learnings from Previous RCAs/Investigations/Research

### Related Past Incidents

- **RCA: 5 Critical Findings from Forge Review** (`docs/RCAs/2026-04-03_1235_forge_review_critical_fixes.md`): Identified hot-path performance issues but did not cover the OEM fetch path. The OEM hook was fixed for a different bug (fetchedRef guard / orphaned setTimeout, RC5), but the upstream API proxy was not examined.

### Patterns Identified

- This is **not** a recurring issue -- it is a first-occurrence bug in the custom ZIP parser that was never tested against real NASA ZIP files that use data descriptors.
- The ZIP parser was written as a minimal "good enough" implementation (comments say "Simple ZIP extraction") and does not handle the full ZIP specification.

### Applicable Previous Solutions

- No directly applicable past solutions. This requires fixing the ZIP parser to handle the data descriptor case.

---

## Timeline of Events

| Time (UTC) | Event | Details |
|------------|-------|---------|
| ~14:18 Apr 3 | OEM proxy deployed | `api/oem.ts` deployed as part of F1 implementation (Session 1) |
| ~14:18 Apr 3 | Bug present from first deployment | The NASA ZIP has always used data descriptors; the parser has never worked |
| 18:48 Apr 3 | Bug discovered | F1 verification testing found `/api/oem` returns 502 |
| 19:07 Apr 3 | F2 logged | Finding report created, preliminary assessment attributed to network/WAF/timeout |
| 19:20 Apr 3 | Root cause confirmed | Investigation proves it is a ZIP parser bug, not a network issue |

---

## Root Cause Analysis

### Primary Cause: ZIP parser does not handle data descriptors

The custom ZIP parser in `api/oem.ts` reads `compressedSize` from the local file header at offsets 18-21 (line 43). The NASA OEM ZIP file has bit 3 set in its general purpose flags (offset 6-7), which per the ZIP specification means the local file header's compressed/uncompressed size fields are set to 0, with the actual sizes stored either in a data descriptor after the compressed data or in the central directory record.

The parser reads 0 for `compressedSize`, then at line 56 does:
```typescript
const compressed = bytes.slice(dataOffset, dataOffset + compressedSize);
// compressedSize = 0, so compressed is an empty Uint8Array
```

`inflateRawSync(Buffer.from(compressed))` on an empty buffer either returns an empty buffer or throws. Either way, the result fails the validation check on line 24 (`!text.includes('CCSDS_OEM_VERS')`), triggering the 502 error response.

### Secondary Cause: No fallback size source in parser

The parser only reads sizes from the local file header. It does not attempt to read from:
1. The data descriptor record (after compressed data)
2. The central directory record (at end of ZIP)

The central directory at offset 188,383 contains the correct `compressedSize` of 188,267 and `uncompressedSize` of 444,300.

### Tertiary Cause: Dynamic `require('zlib')` in ESM context

Line 57 uses `const { inflateRawSync } = require('zlib')` -- a dynamic CommonJS require inside a TypeScript file bundled as ESM (`"type": "module"` in package.json). While this is not the primary failure (the code never reaches a meaningful inflate call due to the empty buffer), it is a secondary risk that could cause failures in some Vercel runtime configurations. It should be replaced with a top-level `import`.

---

## Contributing Factors

### 1. Minimal ZIP parser with no spec compliance

The parser handles only the simplest case: ZIP files where the local file header contains accurate size information and there is exactly one file. It does not handle data descriptors, ZIP64 extensions, multiple files, or other standard ZIP features.

### 2. Silent failure path

The `extractFirstFileFromZip` function returns `null` on any parsing failure. The caller then checks for OEM content markers and throws `"Invalid OEM data in ZIP"`. This error message is misleading -- it suggests the ZIP contents are invalid when in fact the parser failed to extract them.

### 3. No integration test with real NASA data

The ZIP parser was implemented against an assumed ZIP structure but was never tested against the actual NASA OEM ZIP file. A simple download-and-parse test would have caught this immediately.

---

## Evidence

### Live Endpoint Testing

```bash
# All NASA API proxies work except OEM
$ curl -s -w "%{http_code} %{time_total}s" https://artemis-tracker-murex.vercel.app/api/dsn   # 200 0.12s
$ curl -s -w "%{http_code} %{time_total}s" https://artemis-tracker-murex.vercel.app/api/horizons # 200 1.31s
$ curl -s -w "%{http_code} %{time_total}s" https://artemis-tracker-murex.vercel.app/api/donki  # 200 2.83s
$ curl -s -w "%{http_code} %{time_total}s" https://artemis-tracker-murex.vercel.app/api/oem    # 502 0.42s

# NASA ZIP is accessible and fast (no WAF/blocking)
$ curl -s -o /dev/null -w "%{http_code} %{time_total}s" https://www.nasa.gov/wp-content/uploads/2026/03/artemis-ii-oem-2026-04-02-to-ei-v3.zip
# 200 0.06s (184KB)
```

### ZIP File Structure Evidence

```
Local file header analysis:
  Magic: PK\x03\x04 (valid)
  General purpose flags: 0x0008 (bit 3 SET = data descriptor present)
  Compression method: 8 (deflate)
  Compressed size (local header): 0       << BUG: parser reads this
  Uncompressed size (local header): 0     << BUG: parser reads this
  Filename: Artemis_II_OEM_2026_04_02_to_EI_v3.asc
  Data offset: 100

Central directory (offset 188383):
  Compressed size: 188,267               << Correct value
  Uncompressed size: 444,300             << Correct value
```

### Code Evidence

```typescript
// api/oem.ts:43 — reads compressedSize from local header (gets 0 for data descriptor ZIPs)
const compressedSize = bytes[18] | (bytes[19] << 8) | (bytes[20] << 16) | (bytes[21] << 24);

// api/oem.ts:56 — slices 0 bytes
const compressed = bytes.slice(dataOffset, dataOffset + compressedSize);
// compressed.length === 0

// api/oem.ts:58 — inflates empty buffer
const decompressed = inflateRawSync(Buffer.from(compressed));
// decompressed is empty or throws
```

### Reproduction

```python
# Exact reproduction of the parser logic on the NASA ZIP:
# compressedSize from header = 0
# bytes.slice(100, 100 + 0) = empty
# inflateRawSync(empty) = empty/throws
# Result: "Invalid OEM data in ZIP" -> 502
#
# Fix: read compressedSize from central directory = 188,267
# bytes.slice(100, 100 + 188267) = correct compressed data
# inflateRawSync(correct data) = 444,300 bytes of valid OEM data
# Result: 200 with valid CCSDS OEM content
```

---

## Impact Assessment

| Metric | Value |
|--------|-------|
| Endpoints affected | 1 (`/api/oem`) |
| User-visible impact | None (frontend falls back to `/fallback-oem.asc`) |
| Data freshness impact | Medium -- app cannot pick up NASA trajectory updates (e.g., after correction burns) |
| Response body size | 59 bytes (error JSON) instead of ~444KB (OEM data) |
| Duration of issue | Since initial deployment (~5 hours at time of investigation) |

---

## Recommended Fixes

### Fix 1: Read compressedSize from central directory when local header reports 0 (HIGH PRIORITY)

When the local file header has `compressedSize === 0` (indicating data descriptors are used), parse the central directory record to get the actual sizes.

The central directory starts at the signature `PK\x01\x02` and has `compressedSize` at offset +20 and `uncompressedSize` at offset +24 relative to the central directory entry.

```typescript
// Pseudocode for fix:
let compressedSize = bytes[18] | (bytes[19] << 8) | (bytes[20] << 16) | (bytes[21] << 24);

if (compressedSize === 0) {
  // Data descriptor flag set -- read from central directory
  const cdSig = findCentralDirectory(bytes); // find PK\x01\x02
  if (cdSig >= 0) {
    compressedSize = bytes[cdSig+20] | (bytes[cdSig+21] << 8) | (bytes[cdSig+22] << 16) | (bytes[cdSig+23] << 24);
  }
}
```

**Informed by**: New approach -- ZIP specification compliance.

### Fix 2: Replace dynamic `require('zlib')` with static import (MEDIUM PRIORITY)

Replace the dynamic `require('zlib')` on line 57 with a top-level static import to ensure proper bundling in Vercel's ESM environment:

```typescript
import { inflateRawSync } from 'zlib';
```

**Informed by**: Vercel community reports of ESM/CJS bundling issues with dynamic requires.

### Fix 3: Add error context to failure messages (LOW PRIORITY)

Replace the generic `"Invalid OEM data in ZIP"` error with more specific messages that distinguish between:
- ZIP fetch failure (upstream HTTP error)
- ZIP parse failure (invalid structure / unsupported features)
- OEM content validation failure (valid ZIP but unexpected contents)

**Informed by**: New approach -- observability improvement.

---

## Upstream/Downstream Impact Analysis

### Upstream (Callers)

- `src/hooks/useOEM.ts`: Calls `fetch('/api/oem')`. On failure, gracefully falls back to `/fallback-oem.asc`. The fallback path works correctly.
- Browser clients: Direct API calls to `/api/oem` return 502 with error JSON.

### Downstream (Called Methods)

- `fetch(OEM_ZIP_URL)`: Successfully fetches the NASA ZIP (confirmed working).
- `extractFirstFileFromZip()`: Fails due to the data descriptor bug.
- `zlib.inflateRawSync()`: Never receives meaningful data due to the empty buffer.

---

## Verification Plan

1. **Unit test**: Create a test that downloads the NASA OEM ZIP and verifies the parser extracts valid OEM data containing `CCSDS_OEM_VERS`.
2. **Local test**: Run `vercel dev` and confirm `/api/oem` returns 200 with valid OEM text.
3. **Deployment test**: After deploying the fix, confirm `curl https://artemis-tracker-murex.vercel.app/api/oem` returns 200 with OEM data.
4. **Integration test**: Verify the frontend `useOEM` hook receives live OEM data instead of falling back to the bundled file.
5. **Edge case**: Test with a stored (method 0) ZIP file to ensure the fix doesn't break the uncompressed path.

---

## Hypotheses Eliminated

| Hypothesis | Status | Evidence |
|------------|--------|----------|
| Vercel network restrictions blocking `www.nasa.gov` | **Eliminated** | The fetch succeeds (0.42s response time, not a timeout). Other NASA domains work. The same URL works with curl simulating cloud user-agents. |
| NASA WAF/bot protection blocking Vercel IPs | **Eliminated** | NASA serves the file via nginx with no WAF headers (no Akamai/Cloudflare). `access-control-allow-origin: *` is set. File downloads successfully from any user-agent. |
| Vercel serverless timeout | **Eliminated** | Response arrives in 0.42s; Hobby plan timeout is 300s. A timeout would produce 504, not 502. |
| Vercel response body size limit (4.5MB) | **Eliminated** | Decompressed OEM is 444KB, well under 4.5MB. |
| Dynamic `require('zlib')` failing in ESM | **Partially relevant** | The require may work fine on current Vercel Node.js runtime, but it is a secondary risk. The primary failure is the empty buffer passed to inflate, not a module loading error. |
| **ZIP parser data descriptor bug** | **CONFIRMED** | Reproduced exactly: `compressedSize` reads as 0 from local header, central directory has correct value of 188,267. |

---

**Investigation Complete**: 2026-04-03 19:20 UTC
**Ready for**: RCA Document + Implementation Prompt (`/rca-bugfix`)
