# Implementation Prompt: Fix 5 Critical Forge Review Findings

**RCA Reference**: docs/RCAs/2026-04-03_1235_forge_review_critical_fixes.md

## Context

The forge review identified 5 critical issues in the Artemis II tracker MVP: a 60fps re-render storm from Zustand object identity, an O(n) linear scan in the interpolator hot path, per-frame array allocations, a stale closure in the chat hook, and a StrictMode-incompatible polling guard. All root causes are confirmed.

## Goal

Fix all 5 critical findings while maintaining the existing 15 unit tests passing.

## Requirements

### Fix 1: Eliminate 60fps re-render storm (C1)

**`src/components/Spacecraft.tsx`**: Remove Zustand subscription to `s.spacecraft`. Instead, use a `useRef` for the group position and update it inside `useFrame` by reading `useMissionStore.getState().spacecraft`. The component should not re-render on position changes — Three.js object properties are set imperatively.

**`src/hud/HUD.tsx`**: Remove the `spacecraft` subscription. Instead, have each `TelemetryCard` subscribe to its own scalar value using individual selectors:
- `useMissionStore((s) => s.spacecraft.speed)`
- `useMissionStore((s) => s.spacecraft.earthDist)`
- `useMissionStore((s) => s.spacecraft.moonDist)`

This way, TelemetryCards only re-render when their specific value changes. Since `setSpacecraft` still creates a new object, also add a throttle: **`DataDriver` should only call `setSpacecraft` at ~4Hz** (every 250ms) instead of every frame. The interpolation still runs every frame for smooth 3D positioning, but the store update (which triggers HUD re-renders) is throttled.

**`src/components/DataDriver.tsx`**: 
- Continue interpolating every frame for smooth 3D movement
- Only call `store.setSpacecraft()` every ~250ms (use a timestamp check)
- Write interpolated position to a shared ref that `Spacecraft.tsx` reads directly

### Fix 2: Binary search in interpolator (C2)

**`src/data/interpolator.ts`**: Replace the O(n) linear scan (lines 26-34) with binary search. The `vectors` array is sorted by `epochMs`. Use standard binary search to find the insertion point, then compare at most 2 neighbors to find the closest index.

```typescript
// Binary search for closest index
let lo = 0, hi = vectors.length - 1;
while (lo < hi) {
  const mid = (lo + hi) >> 1;
  if (vectors[mid].epochMs < t) lo = mid + 1;
  else hi = mid;
}
// lo is the first element >= t, compare with lo-1
const closestIdx = (lo > 0 && Math.abs(vectors[lo - 1].epochMs - t) <= Math.abs(vectors[lo].epochMs - t))
  ? lo - 1 : lo;
```

### Fix 3: Eliminate per-frame allocations (C3)

**`src/data/interpolator.ts`**:
1. Hoist `COMPONENTS` to module scope: `const COMPONENTS = ['x', 'y', 'z', 'vx', 'vy', 'vz'] as const;`
2. Don't use `vectors.slice()` — pass `startIdx` and `numPoints` to `lagrangeBasis` instead
3. Extract `times` array once before the component loop (same for all 6 components)
4. Update `lagrangeBasis` to accept vectors array + startIdx + count instead of separate times/values arrays, reading directly from the vectors

Change the function signature to accept `targetEpochMs: number` instead of `Date` to avoid `new Date()` allocation in the caller.

### Fix 4: Fix stale closure in useChat (C4)

**`src/hooks/useChat.ts`**: Use a `useRef` to track the latest messages. Update the ref whenever `messages` state changes. In `sendMessage`, read from the ref instead of the closure:

```typescript
const messagesRef = useRef<ChatMessage[]>([]);
// Keep ref in sync
useEffect(() => { messagesRef.current = messages; }, [messages]);

const sendMessage = useCallback(async (text: string) => {
  const userMsg = { role: 'user' as const, text };
  setMessages((prev) => [...prev, userMsg]);
  // ...
  const allMessages = [...messagesRef.current, userMsg].map(...)
  // ...
}, []); // No messages dependency needed
```

### Fix 5: Fix StrictMode polling + orphaned setTimeout (C5)

**`src/hooks/useOEM.ts`**: Remove the `fetchedRef` guard entirely. Use AbortController for fetch cancellation. Store retry timeout IDs in a ref and clear in cleanup:

```typescript
useEffect(() => {
  const controller = new AbortController();
  let retryTimeout: ReturnType<typeof setTimeout>;
  let oemInterval: ReturnType<typeof setInterval>;
  let moonInterval: ReturnType<typeof setInterval>;

  async function fetchOEM() {
    try {
      const res = await fetch('/api/oem', { signal: controller.signal });
      // ... parse and store
    } catch (err) {
      if (controller.signal.aborted) return;
      retryTimeout = setTimeout(fetchOEM, 30_000);
    }
  }

  fetchOEM();
  fetchMoonPosition();
  oemInterval = setInterval(fetchOEM, OEM_POLL_INTERVAL);
  moonInterval = setInterval(fetchMoonPosition, HORIZONS_POLL_INTERVAL);

  return () => {
    controller.abort();
    clearTimeout(retryTimeout);
    clearInterval(oemInterval);
    clearInterval(moonInterval);
  };
}, []);
```

**`src/hooks/useDSN.ts`**: Same pattern — remove `fetchedRef`, use AbortController.

## Files to Modify

- `src/data/interpolator.ts` — Binary search + eliminate allocations + accept epochMs
- `src/components/DataDriver.tsx` — Throttle store updates + expose position ref + use Date.now()
- `src/components/Spacecraft.tsx` — Read position from ref/getState in useFrame
- `src/hud/HUD.tsx` — Remove spacecraft subscription, let children subscribe individually
- `src/hud/TelemetryCard.tsx` — Accept Zustand selector instead of value prop (or keep value prop and let parent subscribe granularly)
- `src/hooks/useChat.ts` — useRef for messages, remove stale closure
- `src/hooks/useOEM.ts` — AbortController, remove fetchedRef, clear retry timeout
- `src/hooks/useDSN.ts` — AbortController, remove fetchedRef
- `tests/interpolator.test.ts` — Update to pass epochMs number instead of Date (if signature changes)

## Acceptance Criteria

- [ ] `npm run build` passes with no TS errors
- [ ] `npm run test -- --run` — all 15 tests pass
- [ ] Spacecraft position updates smoothly in 3D scene (no visual regression)
- [ ] HUD telemetry numbers still update (at throttled ~4Hz rate)
- [ ] Chat quick answers still work
- [ ] Polling resumes correctly after StrictMode double-mount
- [ ] No console errors

---

## Plan Output Instructions

**IMPORTANT**: Before creating the implementation plan, you MUST enter plan mode:

1. Call `EnterPlanMode` to enter plan mode
2. Write the plan to `docs/plans/2026-04-03_1235_forge_review_critical_fixes.md`
3. Call `ExitPlanMode` to present the plan for user approval
4. After plan approval, invoke `/wrought-rca-fix` to start the autonomous bugfix loop.
