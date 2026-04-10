# Investigation: Chatbot Intermittent API Failure — "Sorry, I could not process your question"

**Date**: 2026-04-10
**Investigator**: Claude Code (Session 8)
**Severity**: High
**Status**: Investigation Complete

---

## Executive Summary

The ARTEMIS AI chatbot intermittently returns "Sorry, I could not process your question right now. Please try again or use one of the quick-answer buttons." when users ask questions. This occurs during the critical final 12 hours of the Artemis II mission (Return Coast phase, 94.6% complete, ~11.7h before splashdown). The root cause is a combination of: (1) the Gemini `gemini-3-flash-preview` API returning intermittent 500 errors (observed ~33% failure rate in testing), (2) no retry logic in the API handler — a single failed request immediately returns an error to the user, and (3) no fetch timeout (F12 from Chatbot Security & Quality tracker — still Open). The client-side `catch` block in `useChat.ts:79` catches all errors (including HTTP 500 from Gemini and network errors) and shows a generic error message with no indication of what went wrong or that a retry would likely succeed.

---

## External Research Findings

### Official Documentation Consulted
- [Gemini API Models page](https://ai.google.dev/gemini-api/docs/models) — `gemini-3-flash-preview` is a preview model, not GA
- [Gemini API Deprecations](https://ai.google.dev/gemini-api/docs/deprecations) — `gemini-3-flash-preview` is NOT currently deprecated but is a preview model with no stability guarantees
- [Google AI Developers Forum: 500 errors](https://discuss.ai.google.dev/t/constantly-getting-500-status-code-for-the-gemini-3-1-flash-image-preview-requests/136510) — Community reports of intermittent 500 errors on Gemini 3 series preview models
- [Google AI Developers Forum: Gemini 3 broken in AI Studio](https://support.google.com/gemini/thread/396753722) — Reports of "An internal error has occurred" on both gemini-3-pro-preview and gemini-3-flash-preview

### Known Issues / Community Reports
- Multiple community reports confirm intermittent 500 Internal Server Errors on Gemini 3 Flash Preview models
- The preview models have no SLA and Google explicitly notes they "may change" at any time
- Some users report 500 error rates as high as 50% during peak periods
- The Gemini 3 Flash stable (non-preview) version is listed as `gemini-3-flash` but has separate availability

### API/Library Behavior Notes
- Preview models have lower rate limits and less infrastructure redundancy than GA models
- The `google_search` grounding tool adds latency and an additional failure point (the tool's search may fail independently of text generation)
- When search grounding is enabled and fails, the current code falls back to a non-grounding request — but if BOTH fail, the error propagates

---

## Learnings from Previous RCAs/Investigations/Research

### Related Past Incidents

| Document | Relevance |
|----------|-----------|
| `docs/findings/2026-04-06_1656_fetch_timeout_missing.md` | F12: No fetch timeout on Gemini API calls. Still OPEN. Directly related — a hanging request would cause the same user-facing error. |
| `docs/investigations/2026-04-06_1430_chatbot_llm_model_upgrade.md` | Noted `gemini-3-flash-preview` is a "preview model" with "quality regressions vs stable releases" and "restrictive rate limits." |
| `docs/investigations/2026-04-06_1800_chatbot_web_search_upgrade.md` | Noted the search grounding fallback pattern: try with `google_search` tool, fall back without it if API rejects. This two-request pattern doubles the chance of hitting a 500 error. |
| `docs/RCAs/2026-04-06_1800_chatbot_web_search_upgrade.md` | F13 fix added proper grounding metadata parsing and fallback. The fallback pattern itself is sound but lacks retry logic. |

### Patterns Identified

1. **No retry logic anywhere in the API pipeline**: `generateTextResponse()` makes up to 2 requests (with grounding, then without) but if both return 500, the error is thrown. There is no exponential backoff or retry-after-delay pattern.
2. **F12 (no fetch timeout) compounds the problem**: Without `AbortSignal.timeout()`, a hanging Gemini request blocks the Vercel function until platform timeout (~10s for Hobby, 60s for Pro), during which the user sees a loading spinner.
3. **Generic error message hides actionable information**: The catch block in `useChat.ts:79` shows a static message. The user has no idea that simply retrying would likely succeed.

### Applicable Previous Solutions

- F12's proposed fix (`AbortSignal.timeout(8000)`) would prevent hangs but not intermittent 500s.
- A simple retry-once pattern on 500/503 responses would resolve the intermittent failure.

---

## Timeline of Events

| Time (UTC) | Event | Details |
|------------|-------|---------|
| ~12:25 | User asks chatbot question | "What is the strategy for Artemis 2's re-entry? Will it be the same as for Artemis 1?" |
| ~12:25 | Client sends POST to /api/chat | Request reaches Vercel serverless function |
| ~12:25 | generateTextResponse() calls Gemini API | First attempt with `google_search` grounding tool |
| ~12:25 | Gemini API returns error | Either 500 Internal Server Error or network error |
| ~12:25 | Fallback: retry without grounding | Second attempt without tools (or first attempt failed with thrown error) |
| ~12:25 | Second attempt also fails | Gemini API intermittent instability |
| ~12:25 | API handler catches error, returns 500 | `res.status(500).json({parts: [{type: 'text', content: 'Sorry, I encountered an error...'}]})` |
| ~12:25 | Client useChat.ts catches thrown error | `res.ok` is false (500), throws. Catch block shows generic error to user. |
| 12:25 | User sees error message | "Sorry, I could not process your question right now." — screenshot captured |

## Reproduction

Tested the production API (artemis-tracker-murex.vercel.app/api/chat) with 3 consecutive identical requests:
- Request 1: **200 OK** — detailed response about Return Coast phase
- Request 2: **500 Error** — "Sorry, I encountered an error. Please try again."
- Request 3: **200 OK** — detailed response

This confirms approximately 33% failure rate on the Gemini API during testing. The same request succeeds on retry.

---

## Root Cause Analysis

### Primary Cause: Gemini `gemini-3-flash-preview` intermittent 500 errors

The Gemini API is returning intermittent 500 Internal Server Errors. This is a known issue with preview models, documented in community forums. The preview model has no SLA and Google does not guarantee availability.

### Secondary Cause: No retry logic in `generateTextResponse()`

`api/chat.ts:135-192` makes one attempt with grounding and one without, but both are sequential attempts at the SAME endpoint. If the endpoint itself is experiencing instability, both fail. There is no retry-after-delay logic for transient 500 errors.

### Tertiary Cause: Generic error message with no retry guidance

`useChat.ts:79-84` shows "Sorry, I could not process your question right now. Please try again or use one of the quick-answer buttons." This does not indicate that the error is transient or that an immediate retry would likely succeed. The user perceives a broken chatbot rather than a temporary API hiccup.

### Contributing Factor: F12 (no fetch timeout) still open

Without `AbortSignal.timeout()`, if the Gemini API hangs instead of returning a 500, the user waits up to 10-60 seconds for the Vercel platform timeout before seeing the error.

---

## Contributing Factors

### 1. Search Grounding Doubles Request Volume
The fallback pattern in `generateTextResponse()` (lines 147-159) first tries with `google_search` tool, then retries without it if the API rejects the tool. This means the function makes 2 sequential requests to the Gemini API per user query. Each request has an independent chance of hitting a 500 error, effectively doubling the probability of at least one failure path being triggered.

### 2. No Client-Side Retry
The `useChat.ts` hook makes a single `fetch('/api/chat')` call. If it fails, the error is displayed immediately. There is no automatic retry logic on the client side.

### 3. Preview Model Instability During High-Traffic Period
The Artemis II mission is at 94.6% completion — splashdown is ~12 hours away. This is likely a high-traffic period as public interest peaks. Preview model infrastructure may be under-provisioned for traffic spikes.

---

## Evidence

### Code Evidence: Error Handler in useChat.ts

```typescript
// src/hooks/useChat.ts:79-84
} catch {
  const errorMsg: ChatMessage = {
    role: 'assistant',
    text: 'Sorry, I could not process your question right now. Please try again or use one of the quick-answer buttons.',
  };
  setMessages((prev) => [...prev, errorMsg]);
}
```

### Code Evidence: API Handler Error Path

```typescript
// api/chat.ts:147-159 — search grounding fallback (but no retry on 500)
let response = await fetch(GEMINI_TEXT_URL, {
  method: 'POST',
  headers,
  body: JSON.stringify({ ...baseBody, tools: [{ google_search: {} }] }),
});
if (!response.ok) {
  // Search grounding may not be available — retry without tools
  response = await fetch(GEMINI_TEXT_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(baseBody),
  });
  if (!response.ok) throw new Error(`Gemini text API ${response.status}`);
}
```

### API Test Evidence

```
Test 1: HTTP 200 — Full response (431 words, Return Coast phase, skip entry strategy)
Test 2: HTTP 500 — {"parts":[{"type":"text","content":"Sorry, I encountered an error. Please try again."}]}
Test 3: HTTP 200 — Full response (319 words, Return Coast phase, mission milestones)
```

### Screenshot Evidence

User's screenshot from `/Users/johanjgenis/.claude/image-cache/73fd9811-74c9-4eba-b8a4-b37a05f59640/1.png` shows: ARTEMIS AI chatbot displaying "Sorry, I could not process your question right now. Please try again or use one of the quick-answer buttons." in response to "What is the strategy for Artemis 2's re-entry? Will it be the same as for Artemis 1?" at 94.6% mission progress.

---

## Impact Assessment

| Metric | Value |
|--------|-------|
| Affected feature | Chatbot (all non-quick-answer queries) |
| Failure rate | ~33% of requests (observed 1 in 3) |
| User impact | Error message shown instead of answer |
| Timing criticality | **HIGH** — splashdown in ~11 hours, peak public interest |
| Quick answers affected | No — client-side matching still works |
| Other API endpoints | Unknown — dsn, oem, horizons, donki may also have intermittent issues |

---

## Recommended Fixes

### Fix 1: Add Retry-Once with Backoff on 500/503 in `generateTextResponse()` (HIGH PRIORITY)

After the grounding fallback, if the response is 500 or 503 (Server Error), wait 1 second and retry once. This handles the intermittent Gemini API instability with minimal code change.

```typescript
// In generateTextResponse(), after the current fallback logic:
if (!response.ok && (response.status === 500 || response.status === 503 || response.status === 429)) {
  await new Promise(r => setTimeout(r, 1000));
  response = await fetch(GEMINI_TEXT_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(baseBody),
  });
}
if (!response.ok) throw new Error(`Gemini text API ${response.status}`);
```

**Informed by**: Pattern from community reports — Gemini 500s are transient and succeed on immediate retry.

### Fix 2: Add `AbortSignal.timeout(10000)` to All Fetch Calls (HIGH PRIORITY)

This is F12 from the existing tracker. Add timeout to prevent hangs.

```typescript
const response = await fetch(GEMINI_TEXT_URL, {
  method: 'POST',
  headers,
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(10000),
});
```

**Informed by**: F12 finding report at `docs/findings/2026-04-06_1656_fetch_timeout_missing.md`.

### Fix 3: Improve Client-Side Error UX (MEDIUM PRIORITY)

Replace the generic error message with a more helpful one that indicates the transient nature and encourages retry. Optionally add automatic retry on the client side.

```typescript
// Option A: Better message
text: 'The AI service is temporarily unavailable. This usually resolves within seconds — please try your question again.'

// Option B: Auto-retry once
// In the catch block, retry the fetch once before showing the error
```

**Informed by**: New approach — improve UX without code complexity.

### Fix 4: Consider Stable Model Fallback (LOW PRIORITY)

If `gemini-3-flash-preview` continues to be unstable, consider falling back to `gemini-2.5-flash` (stable, free tier, supported until June 17, 2026) as a secondary model when the primary returns 500.

**Informed by**: `docs/investigations/2026-04-06_1430_chatbot_llm_model_upgrade.md` — gemini-2.5-flash identified as stable alternative.

---

## Upstream/Downstream Impact Analysis

### Upstream (Callers)
- `useChat.ts:sendMessage()` — React hook called by ChatPanel on user message submit
- ChatPanel UI — displays error message to user

### Downstream (Called Methods)
- `generateTextResponse()` — calls Gemini API (primary failure point)
- `generateImage()` — calls Gemini Image API (same intermittent risk)
- `searchNasaImages()` — calls NASA API (independent, more stable)
- `buildChartParts()` / `buildVideoParts()` — client-side only, not affected

---

## Verification Plan

1. After Fix 1 (retry): Send 10 consecutive requests to `/api/chat` — expect 0 failures (vs current ~3/10)
2. After Fix 2 (timeout): Verify with a simulated slow response that the function returns within 10 seconds
3. After Fix 3 (UX): Verify error message text is updated and user-friendly
4. Monitor Vercel function logs for remaining 500 errors after deployment

---

**Investigation Complete**: 2026-04-10 12:25 UTC
**Ready for**: RCA Document / Implementation Plan / Fix
