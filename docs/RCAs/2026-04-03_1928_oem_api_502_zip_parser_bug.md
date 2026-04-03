# Root Cause Analysis: OEM API Proxy Returns 502 — ZIP Parser Data Descriptor Bug

**Date**: 2026-04-03
**Severity**: Medium
**Status**: Identified
**Finding**: F2 in `docs/findings/2026-04-03_1054_artemis_ii_live_visualization_FINDINGS_TRACKER.md`
**Investigation**: `docs/investigations/2026-04-03_1920_oem_api_502_zip_parser_bug.md`

## Problem Statement

The `/api/oem` Vercel serverless endpoint returns HTTP 502 for every request. The function fetches NASA's OEM ZIP file successfully but fails to extract its contents, falling through to the error handler. Users are unaffected because the frontend falls back to the bundled `/fallback-oem.asc`, but the live data refresh path is entirely non-functional.

## Symptoms

- `GET /api/oem` returns `502 {"error":"Failed to fetch OEM data. Use /fallback-oem.asc"}`
- Response time is ~0.42s (not a timeout)
- All four other NASA API proxies (`/api/dsn`, `/api/horizons`, `/api/donki`, `/api/chat`) return 200
- Frontend silently falls back to bundled OEM data

## Root Cause

The custom ZIP parser in `api/oem.ts` does not handle ZIP files that use **data descriptors** (bit 3 of the general purpose flags). The NASA OEM ZIP sets this flag, which per the ZIP specification means `compressedSize` and `uncompressedSize` in the local file header are set to 0, with actual values stored in the central directory record.

The parser reads `compressedSize = 0` from the local header (line 43), slices 0 bytes of compressed data (line 56), and passes an empty buffer to `inflateRawSync`. The result is empty or throws, failing the OEM content validation check (line 24), which triggers the 502 error response.

**Secondary cause**: The `require('zlib')` call on line 57 is a dynamic CommonJS require inside a TypeScript/ESM file. While not the primary failure (the code fails before meaningful inflate), this is a latent risk in Vercel's ESM bundling environment.

## Evidence

```
ZIP Local File Header:
  General purpose flags: 0x0008 (bit 3 SET = data descriptor)
  Compressed size:   0          ← parser reads this (WRONG)
  Uncompressed size: 0          ← parser reads this (WRONG)

ZIP Central Directory (offset 188383):
  Compressed size:   188,267    ← correct value
  Uncompressed size: 444,300    ← correct value
```

```typescript
// api/oem.ts:43 — reads 0 from local header
const compressedSize = bytes[18] | (bytes[19] << 8) | (bytes[20] << 16) | (bytes[21] << 24);
// compressedSize === 0

// api/oem.ts:56 — slices 0 bytes
const compressed = bytes.slice(dataOffset, dataOffset + compressedSize);
// compressed.length === 0

// api/oem.ts:58 — inflates empty buffer → fails
const decompressed = inflateRawSync(Buffer.from(compressed));
```

## Impact

| Metric | Value |
|--------|-------|
| Endpoints affected | 1 (`/api/oem`) |
| User-visible impact | None (fallback works) |
| Data freshness impact | Medium — cannot pick up trajectory updates after correction burns |
| Duration | Since initial deployment (~5 hours at time of discovery) |

## Resolution

Three changes required in `api/oem.ts`:

### Fix 1: Handle data descriptor flag in ZIP parser (HIGH)

When `compressedSize === 0` in the local file header, check bit 3 of general purpose flags. If set, find the central directory signature (`PK\x01\x02`) and read the correct `compressedSize` from offset +20 relative to that entry.

```typescript
// Check data descriptor flag
const flags = bytes[6] | (bytes[7] << 8);
let compressedSize = bytes[18] | (bytes[19] << 8) | (bytes[20] << 16) | (bytes[21] << 24);

if (compressedSize === 0 && (flags & 0x08)) {
  // Read from central directory
  const cdOffset = findCentralDirectoryEntry(bytes);
  if (cdOffset >= 0) {
    compressedSize = bytes[cdOffset+20] | (bytes[cdOffset+21] << 8) |
                     (bytes[cdOffset+22] << 16) | (bytes[cdOffset+23] << 24);
  }
}
```

### Fix 2: Replace dynamic `require('zlib')` with static import (MEDIUM)

Replace line 57:
```typescript
// Before
const { inflateRawSync } = require('zlib');

// After — top-level import
import { inflateRawSync } from 'zlib';
```

### Fix 3: Improve error specificity (LOW)

Replace the generic `"Invalid OEM data in ZIP"` with messages that distinguish between ZIP structure errors and OEM content validation failures.

## Prevention

1. Add an integration test that downloads the actual NASA OEM ZIP and verifies extraction
2. Use a spec-compliant ZIP library (e.g., `fflate` or `jszip`) instead of a custom parser if the file format changes in the future

## Debug Strategy

- **Self-debug**: enabled
- **Verifier**: `npx vitest run --reporter=verbose 2>&1; curl -s -o /dev/null -w "%{http_code}" https://artemis-tracker-murex.vercel.app/api/oem`
- **Max iterations**: 3
- **Completion criteria**: `/api/oem` returns 200 with valid OEM data containing `CCSDS_OEM_VERS` on local dev server (`vercel dev` or vitest mock). All existing tests continue to pass.
- **Escape hatch**: After 3 iterations, document blockers and request human review.
- **Invoke with**: `/wrought-rca-fix`
