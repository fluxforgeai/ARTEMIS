# Investigation: Cumulative 31s Worst-Case Latency Across Retry Chain

**Date**: 2026-04-10
**Investigator**: Claude Code (Session 8)
**Severity**: Medium
**Status**: Investigation Complete
**Mode**: Confirmation (finding from forge-review)
**Finding**: F15 in Chatbot Security & Quality Tracker

---

## Executive Summary

Finding confirmed. The retry chain in `generateTextResponse()` (`api/chat.ts:155-185`) performs up to 3 sequential HTTP requests, each with an independent 10s `AbortSignal.timeout`, plus a variable sleep (1s for 500/503, potentially longer for 429 with `Retry-After`). Worst case for 500/503: 10s + 10s + 1s + 10s = **31s wall-clock**. Worst case for 429 with `Retry-After`: unbounded (no cap on parsed header value). The client-side fetch in `useChat.ts:51` has **no timeout**, so the UI spinner blocks for the full duration. The issue is real, scoped to `generateTextResponse()` only, and the blast radius is user-perceived chatbot unresponsiveness during transient API failures.

---

## Finding Confirmation

### Is the finding real? **Yes**

Verified by tracing the code path in `api/chat.ts:155-185`:

1. **Fetch 1** (grounded, L155-160): `AbortSignal.timeout(10_000)` -- up to 10s
2. **Fetch 2** (ungrounded fallback, L165-170): `AbortSignal.timeout(10_000)` -- up to 10s (only if Fetch 1 fails)
3. **Sleep** (L179): `setTimeout(r, retryAfter)` -- 1s for 500/503, or parsed `Retry-After` header for 429 (no upper bound)
4. **Fetch 3** (transient retry, L180-185): `AbortSignal.timeout(10_000)` -- up to 10s (only if Fetch 2 also fails with transient status)

Each `AbortSignal.timeout()` is independent -- there is no shared time budget across the chain.

### Client-side timeout? **None**

`useChat.ts:51` calls `fetch('/api/chat', {...})` with no `AbortSignal.timeout()` or `AbortController`. The browser fetch will wait indefinitely until the server responds (or the browser's own internal timeout, typically 300s in Chrome).

---

## Scope Assessment

### Isolated, not systemic

The cumulative latency issue is **isolated to `generateTextResponse()`** in the text intent path. Other intent paths have different latency profiles:

| Intent | Fetch chain | Worst-case latency |
|--------|------------|-------------------|
| `text` | 3 fetches + sleep | **31s** (500/503) or **unbounded** (429) |
| `image` | 1 fetch (Gemini) + 1 fallback (NASA) | 20s |
| `nasa-image` | 1 fetch | 10s |
| `chart` | 0 fetches (client-side) | ~0s |
| `video` | 0 fetches (client-side) | ~0s |

The `text` intent is by far the most commonly used path (any question that does not match video/chart/image regexes).

### Vercel platform timeout

`vercel.json` has no `maxDuration` configured. Default limits:
- **Hobby plan**: 10s (serverless function execution)
- **Pro plan**: 60s (configurable up to 300s)

On **Hobby plan**, the 31s worst-case would be killed by the platform at 10s, meaning only Fetch 1 could complete before the function is terminated. The retry chain's benefit (Fetch 2, sleep, Fetch 3) is **unreachable** on Hobby.

On **Pro plan**, the 31s worst-case fits within the 60s limit but consumes over half the budget, leaving no room for response parsing + JSON serialization.

---

## Additional Evidence Beyond Original Finding

### 1. Unbounded `Retry-After` parsing for 429

The forge-review W1 noted the 31s figure for 500/503 paths. However, the 429 path has an additional risk:

```typescript
// api/chat.ts:175-177
const retryAfter = response.status === 429
  ? Math.max(1_000, Number(response.headers.get('retry-after') || '1') * 1_000)
  : 1_000;
```

If Gemini returns `Retry-After: 60` (not uncommon for rate limits), the sleep becomes 60s, making the total worst-case **10s + 10s + 60s + 10s = 90s**. There is no upper-bound cap on the parsed value. This exceeds even Pro plan's 60s default.

### 2. Fetch 1 failure does not distinguish grounding rejection from transient error

When Fetch 1 (grounded) fails, the code assumes it was a grounding rejection and proceeds to Fetch 2 without grounding. But if Fetch 1 failed due to a transient 500, Fetch 2 is also likely to fail with the same transient error. The retry chain then waits + retries (Fetch 3), but all 3 fetches hit the same intermittent issue. This is the exact scenario that triggered F14.

### 3. No early exit when Vercel timeout is approaching

The function has no awareness of its remaining execution budget. On Hobby, the function will be killed mid-retry with no graceful fallback to the client. The client will see a network error or incomplete response.

### 4. `response.body?.cancel()` on L163 is correct but L178 was added after review

The F14 RCA implementation correctly added `await response.body?.cancel()` on L163 and L178 to release sockets. This addresses forge-review S3.

---

## Impact Assessment

| Dimension | Assessment |
|-----------|-----------|
| **User-visible impact** | UI spinner blocks for up to 31s (500/503) or 90s (429) before showing error or response |
| **Vercel Hobby plan** | Retry chain killed at 10s -- Fetch 2 and 3 are unreachable, defeating the purpose of F14's retry logic |
| **Vercel Pro plan** | 31s fits within 60s limit but consumes significant budget; 429 path can exceed 60s |
| **Client-side** | No timeout -- browser spinner persists for full server-side duration |
| **Concurrency** | Each stuck request holds a serverless function instance; under load, could exhaust concurrency |
| **Frequency** | Only during transient API failures (~33% observed in F14 testing); happy path completes in 1-5s |

---

## Past RCAs/Investigations Reviewed

| Document | Relevance |
|----------|-----------|
| `docs/RCAs/2026-04-10_1225_chatbot_intermittent_api_failure.md` | F14 RCA that introduced the retry chain. Proposed retry-once with 1s backoff. The implementation added the full 3-fetch chain. |
| `docs/investigations/2026-04-10_1225_chatbot_intermittent_api_failure.md` | F14 investigation documenting Gemini 500 intermittency. Proposed `AbortSignal.timeout(10000)` per fetch. Did not analyze cumulative timeout. |
| `docs/findings/2026-04-06_1656_fetch_timeout_missing.md` | F12 finding (fetch timeout missing). Resolved by F14 implementation adding `AbortSignal.timeout(10_000)` to all fetches. |
| `docs/investigations/2026-04-06_1430_chatbot_llm_model_upgrade.md` | Noted preview model instability. Relevant context for why retries are needed. |
| `docs/investigations/2026-04-06_1800_chatbot_web_search_upgrade.md` | Documented grounding fallback pattern (2-fetch chain). F14 added a 3rd fetch for transient retry. |
| `docs/RCAs/2026-04-06_1800_chatbot_web_search_upgrade.md` | F13 grounding fix. The grounding fallback itself is correct; cumulative timeout is the new issue. |

### Patterns Identified

1. **F14's retry fix created F15**: The retry chain was added to handle Gemini 500 intermittency (correct), but introduced cumulative timeout risk (unintended consequence). This is a classic fix-introduces-new-issue pattern.
2. **Independent timeouts are a common anti-pattern**: Each `AbortSignal.timeout(10_000)` is isolated. A shared budget (single `AbortController` with one timeout) is the standard pattern for retry chains.
3. **Hobby plan makes retry chain dead code**: If the project is on Hobby plan (10s function timeout), the entire retry logic beyond Fetch 1 is unreachable -- the platform kills the function before Fetch 2 starts.

---

## Root Cause

The retry chain introduced by F14 uses **independent per-request timeouts** instead of a **shared timeout budget**. Each of the 3 fetch calls creates its own `AbortSignal.timeout(10_000)`, and the sleep between retries adds further delay. The cumulative effect is 31-90s worst-case wall-clock time, with no client-side timeout to cap the user's wait.

The root cause is an architectural gap: the F14 fix focused on retry correctness (correct) but did not introduce a shared time budget across the retry chain.

---

## Recommended Fix Direction

Three approaches, in order of preference:

1. **Shared `AbortController` with single budget** -- Create one `AbortController` with a 15s timeout at the start of `generateTextResponse()`. Pass its signal to all 3 fetches and the sleep. Total wall-clock capped at 15s regardless of retry path. Cap `retryAfter` to a maximum of 3s.

2. **Reduce per-request timeout to 5s** -- Each fetch gets `AbortSignal.timeout(5_000)`. Total worst-case: 5s + 5s + 1s + 5s = 16s. Simpler than shared controller but still no single budget.

3. **Client-side `AbortSignal.timeout(20_000)`** -- Add timeout to `useChat.ts:51` fetch. Does not reduce server-side cost but caps user wait time.

Recommended: approach 1 (shared budget) + approach 3 (client-side timeout) together.

---

**Investigation Complete**: 2026-04-10 13:00 UTC
