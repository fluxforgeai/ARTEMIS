# Root Cause Analysis: Chatbot Intermittent API Failure — Gemini 500s with No Retry

**Date**: 2026-04-10
**Severity**: High
**Status**: Identified
**Finding**: F14 in Chatbot Security & Quality Tracker
**Investigation**: `docs/investigations/2026-04-10_1225_chatbot_intermittent_api_failure.md`

## Problem Statement

The ARTEMIS AI chatbot intermittently returns "Sorry, I could not process your question right now" when users ask questions. Observed during the critical final hours of the Artemis II mission (Return Coast phase, approaching splashdown). Approximately 1 in 3 requests fails despite the same request succeeding on immediate retry.

## Symptoms

- User submits a chat question and receives a generic error message
- The same question succeeds if the user manually retries
- ~33% failure rate observed in production testing (1 of 3 consecutive identical requests failed)
- No indication to the user that the error is transient or that retry would succeed
- Error occurs on all non-quick-answer queries (text intent routed to Gemini API)

## Root Cause

**Three compounding failures in the error handling pipeline:**

### RC1: Gemini `gemini-3-flash-preview` intermittent 500 errors (external)

The Gemini API returns intermittent HTTP 500 Internal Server Errors. This is a known issue with preview models — documented in Google AI Developer Forum threads. Preview models have no SLA, lower infrastructure redundancy, and Google explicitly notes they "may change" at any time. The `gemini-3-flash-preview` model is NOT deprecated but is NOT GA.

### RC2: No retry logic in `generateTextResponse()` (`api/chat.ts:135-192`)

The function makes up to 2 sequential requests, but these are for **grounding fallback** (try with `google_search` tool, then without), not for **transient error retry**. If the Gemini endpoint itself returns 500, both requests fail because they hit the same unstable endpoint. There is no delay-and-retry pattern for transient HTTP errors.

```typescript
// api/chat.ts:146-159 — current logic
let response = await fetch(GEMINI_TEXT_URL, {
  method: 'POST', headers,
  body: JSON.stringify({ ...baseBody, tools: [{ google_search: {} }] }),
});
if (!response.ok) {
  // This is grounding fallback, NOT transient error retry
  response = await fetch(GEMINI_TEXT_URL, {
    method: 'POST', headers,
    body: JSON.stringify(baseBody),
  });
  if (!response.ok) throw new Error(`Gemini text API ${response.status}`);
}
```

### RC3: Generic error message hides transient nature (`src/hooks/useChat.ts:79-84`)

The client-side catch block shows a static error message with no indication that the failure is temporary or that an immediate retry would likely succeed. The user perceives a broken chatbot rather than a momentary API hiccup.

```typescript
// src/hooks/useChat.ts:79-84
} catch {
  const errorMsg: ChatMessage = {
    role: 'assistant',
    text: 'Sorry, I could not process your question right now. Please try again or use one of the quick-answer buttons.',
  };
```

### Contributing: F12 — No fetch timeout (still Open)

Without `AbortSignal.timeout()`, if the Gemini API hangs instead of returning 500, the user waits up to 10-60 seconds for the Vercel platform timeout. This compounds the user experience problem.

## Evidence

### Production API Test (2026-04-10 ~12:25 UTC)

```
Request 1: HTTP 200 — Full response (431 words, Return Coast phase)
Request 2: HTTP 500 — {"parts":[{"type":"text","content":"Sorry, I encountered an error..."}]}
Request 3: HTTP 200 — Full response (319 words, Return Coast phase)
```

All three requests were identical — same endpoint, same payload. The 500 is transient.

### Community Reports

- [Google AI Forum: 500 errors on Gemini 3 preview](https://discuss.ai.google.dev/t/constantly-getting-500-status-code-for-the-gemini-3-1-flash-image-preview-requests/136510) — multiple users report 500 error rates as high as 50% on preview models
- [Google AI Forum: Gemini 3 broken in AI Studio](https://support.google.com/gemini/thread/396753722) — "An internal error has occurred" on both gemini-3-pro-preview and gemini-3-flash-preview

### User Screenshot

User's screenshot shows the error message in the ARTEMIS chatbot during Return Coast phase at 94.6% mission completion.

## Impact

| Metric | Value |
|--------|-------|
| Affected feature | Chatbot (all non-quick-answer queries) |
| Failure rate | ~33% of requests |
| User impact | Error message instead of answer; no indication retry would work |
| Timing criticality | **HIGH** — splashdown in ~14 hours, peak public interest |
| Quick answers affected | No — client-side matching unaffected |

## Resolution

### Fix 1: Retry-once with backoff on transient errors in `generateTextResponse()` (HIGH)

After the existing grounding fallback, if the final response is 500, 503, or 429, wait 1 second and retry once without grounding tools. This handles the intermittent Gemini instability with minimal code change and no additional dependencies.

**Files**: `api/chat.ts` — `generateTextResponse()` function

### Fix 2: Add `AbortSignal.timeout(10_000)` to all fetch calls (HIGH)

Add timeout to all 5 fetch calls in `api/chat.ts` (2 in `generateTextResponse`, 1 in `generateImage`, 1 in `searchNasaImages`). Resolves F12 simultaneously.

**Files**: `api/chat.ts` — all `fetch()` call sites

### Fix 3: Improve client-side error message (MEDIUM)

Replace the generic error with a message indicating transient nature. Add client-side auto-retry once before showing the error.

**Files**: `src/hooks/useChat.ts` — catch block in `sendMessage()`

## Prevention

1. **Avoid preview models for production features** — prefer GA/stable models. The `gemini-3-flash-preview` was chosen for capability but trades stability for early access.
2. **Always add retry logic for external API calls** — transient failures are expected at scale.
3. **Always add timeouts to external fetch calls** — defensive against hangs.

## Debug Strategy

- **Self-debug**: enabled
- **Verifier**: `npx tsc --noEmit && npx eslint api/chat.ts src/hooks/useChat.ts`
- **Max iterations**: 5
- **Completion criteria**: TypeScript compiles clean, ESLint passes, retry logic handles 500/503/429, all fetch calls have `AbortSignal.timeout()`, error message updated
- **Escape hatch**: After 5 iterations, document blockers and request human review
- **Invoke with**: `/wrought-rca-fix`
