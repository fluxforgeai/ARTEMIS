# Implementation Prompt: Fix OEM API 502 — ZIP Parser Data Descriptor Bug

**RCA Reference**: docs/RCAs/2026-04-03_1928_oem_api_502_zip_parser_bug.md
**Investigation Reference**: docs/investigations/2026-04-03_1920_oem_api_502_zip_parser_bug.md

## Context

The `/api/oem` endpoint returns 502 because the custom ZIP parser in `api/oem.ts` cannot handle ZIP files using data descriptors (bit 3 of general purpose flags). The NASA OEM ZIP sets this flag, causing `compressedSize` to read as 0 from the local file header. The parser slices 0 bytes and fails. The correct `compressedSize` (188,267) is in the central directory record.

## Goal

Fix the ZIP parser to correctly extract OEM data from NASA's ZIP file, restoring the `/api/oem` endpoint to return 200 with valid trajectory data.

## Requirements

1. **Handle data descriptor flag**: When `compressedSize === 0` in the local file header and bit 3 of general purpose flags is set, read `compressedSize` from the central directory record instead
2. **Static zlib import**: Replace the dynamic `require('zlib')` on line 57 with a top-level `import { inflateRawSync } from 'zlib'` for proper ESM bundling
3. **Improve error messages**: Replace the generic `"Invalid OEM data in ZIP"` error with specific messages that distinguish ZIP parse failures from OEM content validation failures
4. **Do not break existing paths**: The stored (method 0 / uncompressed) code path must continue to work

## Files Likely Affected

- `api/oem.ts` — primary fix target (ZIP parser function `extractFirstFileFromZip`)

## Constraints

- The parser only needs to handle single-file ZIP archives (NASA's OEM ZIP contains one `.asc` file)
- Do not add external ZIP libraries — keep the parser minimal and dependency-free
- The fix must work in Vercel's serverless Node.js 18+ environment
- `api/` files cannot import from `src/` (Vercel serverless constraint)
- The function signature and response format must not change

## Implementation Details

### Central Directory Lookup

The central directory can be found by scanning backward from the end of the file for the End of Central Directory signature (`PK\x05\x06` = `0x50 0x4B 0x05 0x06`). The EOCD record at offset +16 contains a 4-byte `centralDirectoryOffset`. The first central directory entry at that offset has `compressedSize` at +20 and `uncompressedSize` at +24.

Alternatively, scan forward from after the compressed data for the central directory entry signature (`PK\x01\x02` = `0x50 0x4B 0x01 0x02`).

### Data Descriptor Layout

When bit 3 is set, after the compressed data there is a data descriptor:
- Optional 4-byte signature: `0x08074b50`
- 4 bytes: CRC-32
- 4 bytes: compressed size
- 4 bytes: uncompressed size

However, since we don't know where the compressed data ends (that's the problem), reading from the central directory is the reliable approach.

### ZIP Central Directory Entry Layout (relevant offsets from entry start)

| Offset | Size | Field |
|--------|------|-------|
| 0 | 4 | Signature `PK\x01\x02` |
| 20 | 4 | Compressed size |
| 24 | 4 | Uncompressed size |
| 28 | 2 | Filename length |
| 30 | 2 | Extra field length |
| 32 | 2 | File comment length |

### End of Central Directory Layout (relevant offsets from record start)

| Offset | Size | Field |
|--------|------|-------|
| 0 | 4 | Signature `PK\x05\x06` |
| 16 | 4 | Offset of start of central directory |

## Acceptance Criteria

- [ ] `extractFirstFileFromZip` correctly extracts OEM data from NASA's ZIP file (data descriptor flag handling)
- [ ] `zlib` imported via static ESM import at top of file, not dynamic `require()`
- [ ] Error messages distinguish between ZIP parse failure and OEM content validation failure
- [ ] Stored (method 0) ZIP path still works
- [ ] All existing tests pass (`npx vitest run`)
- [ ] Local verification: function returns valid OEM text containing `CCSDS_OEM_VERS` when given the NASA ZIP

---

## Plan Output Instructions

**IMPORTANT**: Before creating the implementation plan, you MUST enter plan mode:

1. Call `EnterPlanMode` to enter plan mode (compresses context and enables read-only exploration)
2. Explore the codebase and design your implementation approach using read-only tools (Read, Grep, Glob)
3. Write the plan to `docs/plans/2026-04-03_1928_oem_api_502_zip_parser_bug.md` including:
   - Summary of the approach
   - Step-by-step implementation tasks
   - Files to modify with specific changes
   - Testing strategy
   - Rollback plan (if applicable)
4. Call `ExitPlanMode` to present the plan for user approval
5. **Wait for user approval** before proceeding to implementation
6. After plan approval, invoke `/wrought-rca-fix` to start the autonomous bugfix loop with test verification.
