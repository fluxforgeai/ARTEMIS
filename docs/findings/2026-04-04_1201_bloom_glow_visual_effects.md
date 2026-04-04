# Finding: Bloom/Glow Visual Effects Missing — Postprocessing Installed but Unused

**Date**: 2026-04-04
**Discovered by**: Post-MVP feature analysis
**Type**: Gap
**Severity**: Medium
**Status**: Open

---

## What Was Found

The `@react-three/postprocessing` package (v3.0.4) is installed but entirely unused. The 3D scene in `src/components/Scene.tsx` renders without any postprocessing pipeline — no EffectComposer, no bloom, no tone mapping.

Current "glow" effects are faked with transparent overlay spheres:
- Spacecraft (`src/components/Spacecraft.tsx`): outer transparent sphere simulates glow
- Earth atmosphere (`src/components/Earth.tsx`): transparent overlay simulates atmospheric haze

These manual overlays produce flat, unconvincing results compared to screen-space bloom. The scene also lacks HDR tone mapping, meaning emissive materials cannot bloom naturally.

---

## Affected Components

- `src/components/Scene.tsx` — Canvas setup, no EffectComposer
- `src/components/Spacecraft.tsx` — manual glow overlay (transparent sphere)
- `src/components/Earth.tsx` — manual atmosphere overlay
- `src/components/Moon.tsx` — no glow or rim lighting
- `src/components/Stars.tsx` — no bloom contribution from bright stars
- `package.json` — `@react-three/postprocessing` v3.0.4 installed, unused

---

## Evidence

Scene.tsx renders a bare Canvas with no postprocessing:
```tsx
<Canvas camera={{ position: [0, 5, 25], fov: 45, far: 1000 }}>
  <ambientLight intensity={0.1} />
  <directionalLight position={[100, 0, 0]} intensity={1.5} />
  <Suspense fallback={null}>
    {/* scene objects — no EffectComposer wrapping */}
  </Suspense>
</Canvas>
```

Spacecraft glow is a transparent sphere overlay:
```tsx
// Outer glow sphere
<mesh>
  <sphereGeometry args={[0.25]} />
  <meshBasicMaterial color="#00ff88" transparent opacity={0.15} />
</mesh>
```

---

## Preliminary Assessment

**Likely cause**: MVP prioritized core functionality (trajectory, telemetry, chat) over visual polish. The postprocessing dependency was added during initial setup but never integrated.

**Likely scope**: Scene-wide. Adding an EffectComposer with Bloom pass would enhance Spacecraft, Earth atmosphere, emissive materials, and bright stars simultaneously.

**Likely impact**: Without bloom, the visualization looks flat and lacks the cinematic space aesthetic expected from a mission tracker. This is the highest-impact visual upgrade available — single integration point, multiple beneficiaries.

---

## Classification Rationale

**Type: Gap** — This is a missing capability, not a bug or regression. The infrastructure (dependency) exists but the feature was never built.

**Severity: Medium** — Visual enhancement with no functional impact. However, it is the single highest-impact visual improvement and was listed as Priority 1 for post-MVP.

---

**Finding Logged**: 2026-04-04 12:01 UTC
