# Root Cause Analysis: Cumulative 31s Worst-Case Latency Across Retry Chain

**Date**: 2026-04-10
**Severity**: Medium
**Status**: Identified
**Finding**: F15 in Chatbot Security & Quality Tracker
**Investigation**: `docs/investigations/2026-04-10_1300_retry_chain_cumulative_latency.md`

## Problem Statement

The retry chain in `generateTextResponse()` (`api/chat.ts:155-185`) uses 3 independent `AbortSignal.timeout(10_000)` signals with no shared time budget. Worst case for 500/503: 31s. Worst case for 429 with unbounded `Retry-After`: 90s+. The client-side fetch has no timeout at all. This was introduced by the F14 fix (retry logic for Gemini 500 intermittency).

## Symptoms

- UI spinner blocks for up to 31s during transient Gemini API failures
- On Vercel Hobby plan (10s timeout), the retry chain beyond Fetch 1 is unreachable dead code
- On 429 with large `Retry-After` header, total duration could exceed even Pro plan's 60s limit
- Client-side fetch has no timeout — browser spinner persists for full server duration

## Root Cause

**Independent per-request timeouts instead of a shared budget.**

The F14 fix correctly added retry logic and per-fetch timeouts, but each fetch creates its own `AbortSignal.timeout(10_000)`. These are independent timers — they don't share a budget. The cumulative worst case is:

```
Fetch 1 (10s) + Fetch 2 (10s) + Sleep (1-60s) + Fetch 3 (10s) = 31-90s
```

```typescript
// api/chat.ts:155-185 — current code: 3 independent timeouts
let response = await fetch(url, { signal: AbortSignal.timeout(10_000) });  // 10s budget
if (!response.ok) {
  response = await fetch(url, { signal: AbortSignal.timeout(10_000) });    // 10s budget (independent)
  if (!response.ok && isTransient(response.status)) {
    const retryAfter = /* 1s for 500/503, unbounded for 429 */;
    await new Promise(r => setTimeout(r, retryAfter));                     // 1-60s sleep
    response = await fetch(url, { signal: AbortSignal.timeout(10_000) });  // 10s budget (independent)
  }
}
```

A single `AbortSignal.timeout()` created at function entry and shared across all fetches would cap the total wall-clock time regardless of how many retries occur.

### Contributing: Unbounded `Retry-After` for 429

```typescript
// api/chat.ts:175-176 — no upper cap
const retryAfter = response.status === 429
  ? Math.max(1_000, Number(response.headers.get('retry-after') || '1') * 1_000)
  : 1_000;
```

If Gemini returns `Retry-After: 60`, the sleep becomes 60s. Total: 90s.

### Contributing: No client-side timeout

```typescript
// src/hooks/useChat.ts:51-58 — no signal
const res = await fetch('/api/chat', { method: 'POST', headers, body });
```

The browser will wait indefinitely (Chrome default ~300s) for the server to respond.

## Evidence

- Code trace confirms 3 independent `AbortSignal.timeout(10_000)` at lines 159, 169, 184
- `retryAfter` has `Math.max(1_000, ...)` but no `Math.min(...)` upper cap
- `useChat.ts:51` fetch has no `signal` parameter
- Vercel `vercel.json` has no `maxDuration` configured (defaults: Hobby 10s, Pro 60s)
- Investigation confirmed by 3 independent forge-review subagents (Complexity, DS&A, Efficiency)

## Impact

| Scenario | Wall-clock | Outcome |
|----------|-----------|---------|
| Happy path (Gemini responds) | 1-5s | No issue |
| 500/503 worst case | 31s | UI spinner, wasted serverless budget |
| 429 with Retry-After: 60 | 90s | Exceeds Pro plan timeout, function killed |
| Hobby plan | 10s max | Platform kills function, retry chain unreachable |

## Resolution

Replace 3 independent per-request timeouts with one shared deadline signal, cap the Retry-After delay, and add a client-side timeout.

### Fix 1: Shared `AbortSignal.timeout(15_000)` across all fetches

Create a single deadline signal at the start of `generateTextResponse()`. Pass it to all 3 fetches. Total wall-clock is capped at 15s for all fetch I/O regardless of retry path.

**Why 15s**: Gives ~5s per fetch in the worst case (3 fetches), or the full 15s for a single slow-but-successful Fetch 1. Fits within Vercel Pro 60s with margin. On Hobby (10s), Fetch 1 has 10s before the platform kills the function, and the deadline signal would fire at 15s if the platform didn't intervene.

### Fix 2: Cap `retryAfter` to `Math.min(3_000, ...)`

Prevent unbounded sleep from 429 `Retry-After` headers. 3s gives the API breathing room without consuming excessive budget.

### Fix 3: Client-side `AbortSignal.timeout(20_000)` on `useChat.ts:51`

Cap the browser's wait to 20s. Covers both normal latency (~5s) and worst-case retry (~18s with sleep), plus catches cases where the Vercel function is killed by the platform with no response.

## Prevention

1. When adding retry logic, always use a shared timeout budget — not independent per-request timeouts.
2. Always cap parsed delay headers (`Retry-After`, `X-RateLimit-Reset`) to prevent unbounded waits.
3. Client-side timeouts should always be set on external API calls.

## Debug Strategy

- **Self-debug**: enabled
- **Verifier**: `npm run build`
- **Max iterations**: 5
- **Completion criteria**: Build passes, shared deadline signal on all 3 fetches, retryAfter capped, client-side timeout added
- **Escape hatch**: After 5 iterations, document blockers and request human review
- **Invoke with**: `/wrought-rca-fix`
