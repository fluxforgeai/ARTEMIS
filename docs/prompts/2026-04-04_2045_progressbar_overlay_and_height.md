# Implementation Prompt: ProgressBar Overlay + Height Mismatch Fix (F1 & F2)

**RCA Reference**: docs/RCAs/2026-04-04_2045_progressbar_overlay_and_height.md

## Context

The ProgressBar component overlays the AI ChatPanel on desktop (F1, High) and sits visually higher than adjacent TelemetryCards (F2, Medium). F1 is a 3rd-time recurring regression caused by unconstrained `sm:flex-1` growth + stacking context interference from `backdrop-blur-sm`. F2 is caused by inconsistent padding (`py-3` vs `py-2 sm:py-3`) and extra internal content. Previous fixes targeted individual components and were removed during refactors. This fix applies structural constraints at the container level to prevent re-regression.

## Goal

Fix both layout issues with 4 targeted changes across 2 files, ensuring the ProgressBar no longer overlaps the ChatPanel and aligns vertically with sibling TelemetryCards.

## Requirements

1. Add `isolate` to HUD container to explicitly contain the stacking context
2. Add `sm:pr-16` to the bottom telemetry row container to reserve right-side space for the chat toggle area
3. Change bottom row alignment from `sm:items-center` to `sm:items-end` for natural bottom-aligned HUD
4. Normalize ProgressBar padding from `py-3` to `py-2 sm:py-3` to match TelemetryCard responsive pattern
5. Add a code comment on the `sm:pr-16` explaining its purpose and linking to the RCA to prevent future removal
6. Mobile layout (<640px) must be unaffected — all changes use `sm:` prefixes

## Files Likely Affected

- `src/hud/HUD.tsx` — lines 43 (HUD container) and 99 (bottom row)
- `src/hud/ProgressBar.tsx` — line 72 (outer div padding)

## Specific Changes

### Change 1: HUD.tsx line 43 — Add `isolate`

```tsx
// Before:
<div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2 sm:p-4 z-[var(--z-hud)] safe-area-pad">

// After:
<div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2 sm:p-4 z-[var(--z-hud)] isolate safe-area-pad">
```

### Change 2: HUD.tsx line 99 — Add `sm:pr-16`, change `sm:items-center` to `sm:items-end`

```tsx
// Before:
<div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-3 pointer-events-auto">

// After:
{/* sm:pr-16 reserves space for chat toggle — see RCA docs/RCAs/2026-04-04_2045_progressbar_overlay_and_height.md */}
<div className="grid grid-cols-2 sm:flex sm:items-end gap-2 sm:gap-3 sm:pr-16 pointer-events-auto">
```

### Change 3: ProgressBar.tsx line 72 — Normalize padding

```tsx
// Before:
<div className="bg-[rgba(10,10,30,0.7)] backdrop-blur-sm border border-[rgba(0,212,255,0.2)] rounded-lg px-3 sm:px-4 py-3 min-w-0 sm:min-w-[420px] col-span-2 sm:col-span-1 sm:flex-1">

// After:
<div className="bg-[rgba(10,10,30,0.7)] backdrop-blur-sm border border-[rgba(0,212,255,0.2)] rounded-lg px-3 sm:px-4 py-2 sm:py-3 min-w-0 sm:min-w-[420px] col-span-2 sm:col-span-1 sm:flex-1">
```

## Constraints

- Do NOT remove `sm:flex-1` from ProgressBar — it's needed for responsive growth
- Do NOT add dynamic chat state awareness to HUD — keep components independent
- All layout changes MUST use `sm:` prefix to avoid affecting mobile grid layout
- The `sm:pr-16` comment MUST remain to prevent future removal (this is the 3rd regression)

## Acceptance Criteria

- [ ] ChatPanel renders fully above all HUD elements when open on desktop (>=1024px)
- [ ] ProgressBar does not physically extend into the chat toggle button area (rightmost 64px)
- [ ] Bottom HUD row cards (Speed, Earth Dist, Moon Dist, ProgressBar) share a common bottom edge on desktop
- [ ] ProgressBar padding matches TelemetryCard on mobile (py-2) and desktop (py-3)
- [ ] Mobile layout (<640px) is unchanged — grid-cols-2 layout, progressive disclosure, "More telemetry" toggle all work
- [ ] Milestone tooltips on ProgressBar are not clipped by the right padding
- [ ] No visual regression in the secondary row (DSN, SpaceWeather, Camera) above the bottom row

---

## Plan Output Instructions

**IMPORTANT**: Before creating the implementation plan, you MUST enter plan mode:

1. Call `EnterPlanMode` to enter plan mode (compresses context and enables read-only exploration)
2. Explore the codebase and design your implementation approach using read-only tools (Read, Grep, Glob)
3. Write the plan to `docs/plans/2026-04-04_2045_progressbar_overlay_and_height.md` including:
   - Summary of the approach
   - Step-by-step implementation tasks
   - Files to modify with specific changes
   - Testing strategy
   - Rollback plan (if applicable)
4. Call `ExitPlanMode` to present the plan for user approval
5. **Wait for user approval** before proceeding to implementation
6. After plan approval, invoke `/wrought-implement` to start the autonomous implementation loop with test verification.
