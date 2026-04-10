# Implementation Prompt: Shared Timeout Budget for Retry Chain (F15)

**RCA Reference**: docs/RCAs/2026-04-10_1300_retry_chain_cumulative_latency.md

## Context

The retry chain in `generateTextResponse()` uses 3 independent `AbortSignal.timeout(10_000)` with no shared budget (31s worst case). The `Retry-After` header for 429 is unbounded. The client-side fetch has no timeout. This was introduced by the F14 fix.

## Goal

Cap total retry chain wall-clock to 15s server-side and 20s client-side.

## Requirements

### R1: Shared deadline signal in `generateTextResponse()` (`api/chat.ts`)

Replace the 3 independent `AbortSignal.timeout(10_000)` with one shared signal:

```typescript
// At the start of generateTextResponse(), before the first fetch:
const deadline = AbortSignal.timeout(15_000);
```

Then replace `signal: AbortSignal.timeout(10_000)` on all 3 fetch calls (lines 159, 169, 184) with `signal: deadline`.

The signal is reusable — `AbortSignal.timeout()` fires once after 15s from creation. All fetches sharing it means the TOTAL I/O time across all retries is capped at 15s. If the signal fires mid-fetch, that fetch throws `TimeoutError`. If the signal already fired before a fetch starts, that fetch throws immediately.

**Do NOT change** the `AbortSignal.timeout(10_000)` on `generateImage()` or `searchNasaImages()` — those make only 1 fetch each and are not affected.

### R2: Cap `retryAfter` to 3 seconds (`api/chat.ts`)

On line 175-176, add `Math.min(3_000, ...)` around the existing calculation:

**Current** (line 175-176):
```typescript
const retryAfter = response.status === 429
  ? Math.max(1_000, Number(response.headers.get('retry-after') || '1') * 1_000)
  : 1_000;
```

**New**:
```typescript
const retryAfter = response.status === 429
  ? Math.min(3_000, Math.max(1_000, Number(response.headers.get('retry-after') || '1') * 1_000))
  : 1_000;
```

This clamps the 429 delay to [1s, 3s]. Combined with the shared deadline, even if the cap weren't hit, the deadline would abort after 15s total.

### R3: Client-side timeout on `useChat.ts:51`

Add `signal: AbortSignal.timeout(20_000)` to the client-side fetch:

**Current** (line 51-58):
```typescript
const res = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: allMessages,
    userTimezone: USER_TIMEZONE,
  }),
});
```

**New**:
```typescript
const res = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: allMessages,
    userTimezone: USER_TIMEZONE,
  }),
  signal: AbortSignal.timeout(20_000),
});
```

**Why 20s**: Server retry chain worst case is 15s (fetches) + 3s (sleep) = 18s. 20s gives 2s margin for response parsing and network latency, while ensuring the UI never waits longer than 20s.

## Files Likely Affected

- `api/chat.ts` — `generateTextResponse()` only (R1 + R2)
- `src/hooks/useChat.ts` — `sendMessage()` fetch call (R3)

## Constraints

- Do NOT change timeouts on `generateImage()` or `searchNasaImages()` — they're single-fetch, no cumulative issue
- Do NOT add a `maxDuration` to `vercel.json` — that's a deployment config decision outside this fix
- The `deadline` signal must be created ONCE and reused on all 3 fetches — do not create 3 separate `AbortSignal.timeout(15_000)` calls (that would reproduce the same bug)
- The sleep (`setTimeout`) is NOT interruptible by the deadline signal, but at 1-3s max this is acceptable

## Acceptance Criteria

- [ ] Single `const deadline = AbortSignal.timeout(15_000)` created once in `generateTextResponse()`
- [ ] All 3 fetch calls in `generateTextResponse()` use `signal: deadline` (not individual timeouts)
- [ ] `retryAfter` capped with `Math.min(3_000, ...)`
- [ ] Client-side fetch in `useChat.ts:51` has `signal: AbortSignal.timeout(20_000)`
- [ ] `generateImage()` and `searchNasaImages()` timeouts unchanged at 10s
- [ ] TypeScript compiles clean (`npm run build`)

---

## Plan Output Instructions

**IMPORTANT**: Before creating the implementation plan, you MUST enter plan mode:

1. Call `EnterPlanMode` to enter plan mode
2. Explore the codebase using read-only tools
3. Write the plan to `docs/plans/2026-04-10_1300_retry_chain_cumulative_latency.md`
4. Call `ExitPlanMode` to present for user approval
5. After plan approval, invoke `/wrought-rca-fix` to start the autonomous bugfix loop.
