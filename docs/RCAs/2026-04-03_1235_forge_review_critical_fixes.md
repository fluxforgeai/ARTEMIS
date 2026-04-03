# Root Cause Analysis: 5 Critical Findings from Forge Review

**Date**: 2026-04-03
**Severity**: Critical
**Status**: Identified
**Source**: docs/reviews/2026-04-03_1223_diff.md

## Problem Statement

The forge review identified 5 critical issues in the MVP implementation that cause performance degradation (60fps re-render storms, O(n) hot-path scans, per-frame GC pressure), a chatbot data bug (stale closure), and a polling reliability issue (StrictMode incompatibility).

## Root Causes

### RC1: Zustand object identity triggers 60fps re-renders

**Files**: `src/components/Spacecraft.tsx:10`, `src/hud/HUD.tsx:9`, `src/store/mission-store.ts:52`, `src/components/DataDriver.tsx:35`

**Cause**: `DataDriver` calls `store.setSpacecraft({...})` every frame. The store's `setSpacecraft` uses spread (`{ ...prev.spacecraft, ...state }`), creating a new object reference every frame. `Spacecraft` and `HUD` subscribe to `s.spacecraft`, which returns this new reference. React sees a new reference and re-renders both components and all HUD children at ~60fps. The `Html` drei component in Spacecraft is especially expensive to reconcile.

**Evidence**: `setSpacecraft: (state) => set((prev) => ({ spacecraft: { ...prev.spacecraft, ...state } }))` always produces a new object. `useMissionStore((s) => s.spacecraft)` in Spacecraft.tsx and HUD.tsx triggers re-render on every identity change.

### RC2: O(n) linear scan in interpolator hot path

**File**: `src/data/interpolator.ts:26-34`

**Cause**: `lagrangeInterpolate` finds the closest data point via linear scan over all vectors. The vectors array is sorted by epoch, but the code doesn't exploit this — it checks every element. With ~3,600 vectors (10-day mission at 4-min intervals), this performs ~3,600 comparisons per frame, ~216,000/second.

**Evidence**: Lines 26-34 iterate from `i=1` to `vectors.length` with no early exit.

### RC3: Per-frame array allocations causing GC pressure

**File**: `src/data/interpolator.ts:40-51`

**Cause**: Each call creates: (1) a new array via `vectors.slice(startIdx, startIdx + numPoints)` (line 40), (2) a new `components` array (line 43), (3) 12 arrays from `.map()` calls (2 per component x 6 components, lines 48-49). Total: 14 array allocations per frame, 840/second.

**Evidence**: `window.map(v => v.epochMs)` and `window.map(v => v[comp])` inside the loop. The `times` array is identical across all 6 components but recomputed each time.

### RC4: Stale closure captures pre-update messages

**File**: `src/hooks/useChat.ts:13-55`

**Cause**: `sendMessage` is a `useCallback` with `[messages]` dependency. On line 15, `setMessages((prev) => [...prev, userMsg])` adds the user message. On line 28, `[...messages, userMsg]` reads `messages` from the closure — which was captured before `setMessages` ran. The `messages` value in the closure is stale (missing the user message that was just added). The API receives an incomplete conversation history.

**Evidence**: Line 28 uses the closure `messages` not functional state. The `useCallback` dependency `[messages]` means `sendMessage` is recreated whenever messages change, but within a single invocation the closure is fixed.

### RC5: fetchedRef guard + orphaned setTimeout

**Files**: `src/hooks/useOEM.ts:9-13,26`, `src/hooks/useDSN.ts:8-12`

**Cause**: Both hooks use `fetchedRef.current = true` at the start of useEffect to prevent double execution. In React StrictMode (dev), effects are double-mounted: mount → cleanup → mount. On the first mount, `fetchedRef.current` is set to `true` and intervals start. On cleanup, `clearInterval` stops them. On the second mount, the guard `if (fetchedRef.current) return` prevents re-starting — polling dies silently. Additionally, `useOEM` line 26 creates `setTimeout(fetchOEM, 30_000)` for retry, but this timeout ID is never stored or cleared on unmount.

**Evidence**: The `fetchedRef` pattern is a common React anti-pattern for effects with cleanup. The `setTimeout` on line 26 has no corresponding `clearTimeout` in the cleanup function.

## Resolution

All 5 fixes are well-defined with specific code changes. See implementation prompt at `docs/prompts/2026-04-03_1235_forge_review_critical_fixes.md`.

## Prevention

- Use Zustand's `useShallow` or scalar selectors for components that only need specific fields
- Use `useRef` + `useFrame` for 3D components that need per-frame position updates
- Use binary search on sorted arrays in hot paths
- Avoid allocations in `useFrame` callbacks (pre-allocate buffers at module scope)
- Use `useRef` for mutable state that doesn't need React re-renders
- Use AbortController pattern for fetch cleanup instead of fetchedRef guards

## Debug Strategy

- **Self-debug**: enabled
- **Verifier**: `npm run build && npm run test -- --run`
- **Max iterations**: 5
- **Completion criteria**: Build passes, all 15 tests pass, no regressions
- **Escape hatch**: After 5 iterations, document blockers and request human review
- **Invoke with**: `/wrought-rca-fix`
