# Root Cause Analysis: Unbounded Filter Iteration in Message Sanitization

**Date**: 2026-04-04
**Severity**: Medium
**Status**: Identified
**Finding**: F7 in `docs/findings/2026-04-03_2140_chatbot_security_quality_FINDINGS_TRACKER.md`

## Problem Statement

The message sanitization chain in `api/chat.ts:233-236` runs `.filter()` over the entire unbounded input array before `.slice(-20)` truncates it.

## Symptoms

- No user-visible symptoms under normal use
- An attacker sending thousands of messages in a single request forces the server to iterate the full array before truncation

## Root Cause

`.filter()` is placed before `.slice(-20)` in the chain. Since `.filter()` must evaluate every element, it processes the entire input array (unbounded) before `.slice(-20)` reduces it to 20 entries.

## Evidence

```typescript
// api/chat.ts:233-236 — current (filter first, then slice)
const sanitizedMessages = messages
  .filter((m) => typeof m.text === 'string' && typeof m.role === 'string' && validRoles.has(m.role))
  .slice(-20)
  .map((m) => ({ role: m.role, text: m.text.slice(0, 2000) }));
```

## Resolution

Reorder to `.slice(-20)` first, then `.filter()`:

```typescript
const sanitizedMessages = messages
  .slice(-20)
  .filter((m) => typeof m.text === 'string' && typeof m.role === 'string' && validRoles.has(m.role))
  .map((m) => ({ role: m.role, text: m.text.slice(0, 2000) }));
```

This bounds iteration to at most 20 elements regardless of input size.

## Debug Strategy

- **Self-debug**: enabled
- **Verifier**: `npm run build && npm run test -- --run`
- **Max iterations**: 2
- **Completion criteria**: Build passes, all tests pass, `.slice(-20)` appears before `.filter()` in the chain
- **Invoke with**: `/wrought-rca-fix`
