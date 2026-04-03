# Implementation Prompt: Fix Unbounded Filter Iteration (F7)

**RCA Reference**: docs/RCAs/2026-04-04_0006_unbounded_filter_iteration.md

## Context

Message sanitization chain runs `.filter()` over unbounded input before `.slice(-20)`.

## Goal

Reorder `.slice(-20)` before `.filter()` to bound iteration.

## Requirements

1. In `api/chat.ts`, change the sanitization chain from `.filter().slice(-20).map()` to `.slice(-20).filter().map()`
2. Remove the unnecessary `const validRoles = VALID_ROLES;` alias — use `VALID_ROLES` directly

## Files Likely Affected

- `api/chat.ts` (lines 232-236)

## Acceptance Criteria

- [ ] `.slice(-20)` appears before `.filter()` in the chain
- [ ] Build passes, all tests pass
