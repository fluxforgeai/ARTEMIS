# Implementation Prompt: Chatbot Intermittent API Failure — Retry Logic + Timeout + Error UX

**RCA Reference**: docs/RCAs/2026-04-10_1225_chatbot_intermittent_api_failure.md

## Context

The Gemini `gemini-3-flash-preview` API returns intermittent HTTP 500 errors (~33% failure rate). The chatbot has no retry logic for transient errors, no fetch timeouts (F12), and shows a generic error message that doesn't indicate the transient nature of the failure. The same request succeeds on immediate retry.

## Goal

Make the chatbot resilient to intermittent Gemini API 500 errors by adding server-side retry, fetch timeouts, and an improved client-side error experience.

## Requirements

### R1: Server-side retry on transient errors in `generateTextResponse()`

In `api/chat.ts`, after the existing grounding fallback logic (lines 146-159), add a retry-once pattern for transient HTTP errors:

- If the final response status is 500, 503, or 429: wait 1 second, then retry once **without** grounding tools (simpler request = fewer failure points)
- If the retry also fails, throw as before
- Do NOT retry on 400-level errors (client errors) other than 429 — those indicate a request problem, not a transient failure
- Keep the existing grounding fallback logic unchanged — the retry is a NEW layer after the grounding fallback

### R2: `AbortSignal.timeout(10_000)` on all fetch calls in `api/chat.ts`

Add `signal: AbortSignal.timeout(10_000)` to every `fetch()` call in `api/chat.ts`:

1. `generateTextResponse()` line 147 — grounding request
2. `generateTextResponse()` line 154 — fallback request (no grounding)
3. The new retry request from R1
4. `generateImage()` line 203 — Gemini image generation
5. `searchNasaImages()` line 230 — NASA Images API

This resolves F12 from the Chatbot Security & Quality tracker.

### R3: Improved client-side error message in `useChat.ts`

In `src/hooks/useChat.ts`, update the catch block (lines 79-84):

- Change the error message text to indicate the transient nature: "The AI service is temporarily unavailable. This usually resolves quickly — please try your question again."
- This is a simple text change, no auto-retry logic on the client side (the server-side retry from R1 handles this)

## Files Likely Affected

- `api/chat.ts` — `generateTextResponse()`, `generateImage()`, `searchNasaImages()` (R1 + R2)
- `src/hooks/useChat.ts` — catch block in `sendMessage()` (R3)

## Constraints

- Do NOT change the Gemini model — `gemini-3-flash-preview` stays (the retry handles its instability)
- Do NOT add external dependencies — use built-in `AbortSignal.timeout()` and `setTimeout`
- Keep the retry simple — one retry with 1s delay, not exponential backoff (this is a serverless function with limited execution time)
- Do NOT add client-side auto-retry — the server-side retry is sufficient, and client-side retry would double request volume
- Preserve the existing grounding fallback pattern (try with `google_search`, then without) — the new retry is an additional layer
- The `AbortSignal.timeout()` value of 10 seconds leaves headroom within Vercel's default 60s Pro timeout for the retry sequence (10s + 1s delay + 10s = 21s worst case per grounding path)

## Acceptance Criteria

- [ ] `generateTextResponse()` retries once on 500/503/429 after a 1-second delay
- [ ] All 5 fetch calls in `api/chat.ts` include `AbortSignal.timeout(10_000)`
- [ ] Client error message updated to indicate transient nature
- [ ] TypeScript compiles clean (`npx tsc --noEmit`)
- [ ] ESLint passes on both modified files
- [ ] No changes to intent detection, system prompt, or response parsing logic

---

## Plan Output Instructions

**IMPORTANT**: Before creating the implementation plan, you MUST enter plan mode:

1. Call `EnterPlanMode` to enter plan mode (compresses context and enables read-only exploration)
2. Explore the codebase and design your implementation approach using read-only tools (Read, Grep, Glob)
3. Write the plan to `docs/plans/2026-04-10_1225_chatbot_intermittent_api_failure.md` including:
   - Summary of the approach
   - Step-by-step implementation tasks
   - Files to modify with specific changes
   - Testing strategy
   - Rollback plan (if applicable)
4. Call `ExitPlanMode` to present the plan for user approval
5. **Wait for user approval** before proceeding to implementation
6. After plan approval, invoke `/wrought-rca-fix` to start the autonomous bugfix loop with test verification.
