# Root Cause Analysis: ProgressBar Overlays ChatPanel + Height Mismatch (F1 & F2)

**Date**: 2026-04-04
**Severity**: High (F1), Medium (F2)
**Status**: Identified
**Tracker**: `docs/findings/2026-04-04_2200_ui_visual_regressions_session5_FINDINGS_TRACKER.md`
**Investigation**: `docs/investigations/2026-04-04_2215_progressbar_overlay_and_height_mismatch.md`

## Problem Statement

**F1**: The ProgressBar component renders visually on top of the AI ChatPanel on desktop despite correct z-index hierarchy (HUD z-10 < ChatPanel z-45). The ProgressBar physically extends across the full viewport width due to `sm:flex-1`, overlapping the ChatPanel's fixed-position area on the right side. This is a **3rd-time recurring regression**.

**F2**: The ProgressBar sits visually higher than adjacent TelemetryCards (Speed, Earth Distance, Moon Distance) in the bottom HUD row due to inconsistent padding and extra internal content (milestone countdown line).

## Symptoms

- ProgressBar visible on top of / behind the ChatPanel when chat is open on desktop
- ProgressBar top edge extends above the top edge of adjacent TelemetryCards
- Bottom HUD row appears vertically misaligned

## Root Cause

### F1: Three Contributing Factors

**Factor 1 — Unconstrained flex growth (Primary)**:
ProgressBar uses `sm:flex-1` (= `flex: 1 1 0%`), growing to fill all remaining horizontal space in the bottom row. The HUD container spans full viewport (`absolute inset-0`). On a 1440px viewport, after 3 sibling cards (~420px + gaps), ProgressBar fills ~960px — extending well into the ChatPanel zone (rightmost ~384px).

```
|-- SpeedCard --|-- EarthDist --|-- MoonDist --|-------- ProgressBar (flex-1) --------|
                                                              |--- ChatPanel (360px) ---|
                                                              ^^ OVERLAP ZONE ^^
```

**Factor 2 — Stacking context interference (Secondary)**:
`backdrop-blur-sm` on ProgressBar creates an independent GPU compositing layer. While CSS spec says HUD (z-10) children should never paint above ChatPanel (z-45), the GPU compositing of backdrop-filter layers can produce rendering artifacts where the blur texture paints over sibling stacking contexts in some browsers.

**Factor 3 — No spatial boundary (Tertiary)**:
HUD and ChatPanel are sibling components in App.tsx with no layout coordination. Neither component is aware of the other's screen area. The HUD bottom row has no right-side constraint to keep content out of the ChatPanel zone.

### F2: Two Contributing Factors

**Factor 1 — Padding mismatch**:
- TelemetryCard: `py-2 sm:py-3` (8px mobile, 12px desktop)
- ProgressBar: `py-3` always (12px on all viewports)

On mobile (<640px), ProgressBar has 8px more total vertical padding than TelemetryCards.

**Factor 2 — Extra internal content**:
ProgressBar has 3 content rows (label + progress track + countdown) vs TelemetryCard's 2 rows (label + value). The extra "Next: {milestone} in {countdown}" line adds ~14-18px intrinsic height. With `sm:items-center` on the parent flex row, the taller ProgressBar centers vertically, pushing its top above sibling card tops.

## Evidence

### Regression History (F1)

| Occurrence | Session | What happened |
|------------|---------|---------------|
| 1st | Pre-S4 | Original overlap — no spatial constraints |
| 2nd | S4 mid | Commit `45a73d7` added `sm:mr-16` (64px right margin) to ProgressBar. Worked but only covered the chat toggle button area (48px), not the full 360px chat panel. |
| 3rd (current) | S4 late → S5 | Commit `4534bb6` removed `sm:mr-16` during mobile-first HUD pass — flagged as "layout artifact" by mobile responsiveness audit. Desktop overlap re-exposed. |

**Pattern**: Fixes have targeted symptoms (add margin, change z-index) rather than the structural problem. The margin was added to one component (ProgressBar) and removed when that component was refactored for mobile.

### Code Evidence

```tsx
// App.tsx:36 — siblings, no layout coordination
<div className="w-full h-full relative">  // NO stacking context (no z-index)
  <Scene />
  <HUD />        // absolute inset-0, z-10
  <ChatPanel />  // fixed, z-45 (panel) / z-50 (toggle)
</div>

// HUD.tsx:99 — bottom row, flex-1 unconstrained
<div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-3 pointer-events-auto">
  <SpeedCard />     // min-w-[140px]
  <EarthDistCard /> // min-w-[140px]
  <MoonDistCard />  // min-w-[140px], hidden on mobile
  <ProgressBar />   // sm:flex-1 — grows to fill ALL remaining space
</div>

// ProgressBar.tsx:72 — flex-1 + backdrop-blur
<div className="... backdrop-blur-sm ... py-3 ... sm:flex-1">

// ChatPanel.tsx:46 — fixed in rightmost ~384px
<div className="fixed ... sm:right-6 bottom-20 z-[var(--z-chat)] ... sm:w-[360px] ...">
```

## Impact

| Aspect | F1 | F2 |
|--------|-----|-----|
| Scope | Desktop only (>=640px) | Desktop primarily |
| User impact | Chat panel partially obscured | Visual misalignment in HUD |
| Frequency | Always when chat open on desktop | Always on desktop |
| Functional | Chat panel interaction may be blocked | Cosmetic only |

## Resolution

### F1 Fix: Structural Right Padding on Bottom Row Container (2 changes)

**Change 1**: Add `sm:pr-16` (64px) to the bottom telemetry row in HUD.tsx. This reserves right-side space at the **container level**, not on individual children. Container-level padding survives child component refactors — preventing the regression pattern where a margin on ProgressBar gets removed during ProgressBar changes.

```tsx
// HUD.tsx:99
// Before:
<div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-3 pointer-events-auto">

// After:
<div className="grid grid-cols-2 sm:flex sm:items-end gap-2 sm:gap-3 sm:pr-16 pointer-events-auto">
//                                                                    ^^^^^^^^
```

**Why 64px and not 384px?** The ChatPanel body is at `bottom-20` (80px up) while the HUD row sits at the very bottom (~16px up). Vertical overlap is minimal (~6px). The 64px clears the chat toggle button (48px at `bottom-6 right-6`) with breathing room. Reserving 384px for the full chat panel width would break ProgressBar's `min-w-[420px]` on viewports under 1280px.

**Change 2**: Add `isolate` to the HUD container div. This explicitly creates a stacking context via `isolation: isolate`, providing a belt-and-suspenders guarantee that HUD children (including GPU-composited backdrop-blur layers) stay within HUD's z-10 stacking context. While `z-[var(--z-hud)]` + `absolute` already creates a stacking context per CSS spec, `isolate` is an explicit browser signal that's not dependent on position+z-index interaction.

```tsx
// HUD.tsx:43
// Before:
<div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2 sm:p-4 z-[var(--z-hud)] safe-area-pad">

// After:
<div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2 sm:p-4 z-[var(--z-hud)] isolate safe-area-pad">
//                                                                                                              ^^^^^^^
```

### F2 Fix: Padding Normalization + Bottom Alignment (2 changes)

**Change 1**: Normalize ProgressBar padding to match TelemetryCard's responsive pattern.

```tsx
// ProgressBar.tsx:72
// Before: py-3
// After:  py-2 sm:py-3
```

**Change 2**: Change flex alignment from center to bottom in the bottom row.

```tsx
// HUD.tsx:99
// Before: sm:items-center
// After:  sm:items-end
```

Bottom-alignment is more natural for a bottom-of-screen HUD — all cards share a common bottom edge regardless of height differences. This accommodates ProgressBar's extra countdown row without pushing its top above siblings.

## Prevention

1. **Container-level spatial reservation**: The `sm:pr-16` is on the bottom row container, not on ProgressBar itself. This prevents the regression pattern where individual component margins get removed during component-level refactors.
2. **Code comment**: Add a brief comment on the `sm:pr-16` explaining its purpose and linking to this RCA, so future refactors don't remove it as an "artifact."
3. **`isolate` on HUD**: Provides explicit stacking context containment independent of the z-index mechanism.

## Debug Strategy

- **Self-debug**: enabled
- **Verifier**: Visual inspection — open chat panel on desktop (1280px+), verify ProgressBar does not extend into ChatPanel zone, verify bottom row cards are bottom-aligned
- **Max iterations**: 3
- **Completion criteria**: (1) ChatPanel renders fully above ProgressBar when open (2) Bottom HUD row cards share a common bottom edge (3) Mobile layout unchanged
- **Escape hatch**: After 3 iterations, document blockers and request human review
- **Invoke with**: `/wrought-rca-fix`
