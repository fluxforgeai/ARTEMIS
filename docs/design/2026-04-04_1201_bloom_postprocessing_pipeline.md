# Design Analysis: Bloom/Glow Postprocessing Pipeline

**Date**: 2026-04-04 12:01 UTC
**Analyst**: Claude Code (Session 4)
**Mode**: Tradeoff (from-scratch)
**Finding**: F1 in Post-MVP Visual & Data Features tracker (`docs/findings/2026-04-04_1201_post_mvp_visual_data_features_FINDINGS_TRACKER.md`)

---

## Executive Summary

The ARTEMIS scene currently fakes glow effects with transparent overlay spheres, producing flat, unconvincing results. The `@react-three/postprocessing` package (v3.0.4) is already installed but unused. Adding an EffectComposer with a Bloom pass to `Scene.tsx`, combined with emissive material tuning on existing objects, is the recommended approach --- it delivers cinematic space visuals with minimal code changes (~40 lines net), zero new dependencies, and an acceptable performance cost (estimated 2--5 FPS on mid-range hardware).

---

## Current State Analysis

### Scene Setup (`src/components/Scene.tsx`)

The Canvas renders with no postprocessing pipeline:
- Bare `<Canvas>` with `fov: 45`, `far: 1000`, background `#050510`
- Single `ambientLight` (0.1) + single `directionalLight` (1.5)
- Components: Stars, Earth, Moon, Trajectory, Spacecraft, CameraController, DataDriver
- No `<EffectComposer>`, no tone mapping control, no bloom

### Existing "Glow" Implementation

| Component | Current Technique | Visual Quality |
|-----------|------------------|----------------|
| **Spacecraft** (`Spacecraft.tsx`) | Outer transparent sphere (`opacity: 0.15`, `color: #00ff88`), `toneMapped={false}` on both meshes | Flat green halo, no light bleed, no distance falloff |
| **Earth** (`Earth.tsx`) | Atmosphere overlay sphere (`scale: 1.08`, `opacity: 0.18`, `BackSide`, `color: #77bbff`), emissive on main mesh (`#4488dd`, intensity 0.45) | Visible edge halo, but harsh cutoff at sphere boundary |
| **Moon** (`Moon.tsx`) | Transparent overlay sphere (`opacity: 0.1`, `color: #dddddd`), emissive on main mesh (`#cccccc`, intensity 0.4) | Barely visible, no atmospheric scattering feel |
| **Stars** (`Stars.tsx`) | Point cloud, 5000 points, `size: 0.3`, `PointMaterial`, white | Uniform brightness, no bright-star bloom |
| **Trajectory** (`Trajectory.tsx`) | drei `<Line>` components (`#ff8c00` past, `#00d4ff` future) | Sharp lines, no glow on trajectory path |

### Key Observation

Earth and Moon already have `emissive` + `emissiveIntensity` on their `meshStandardMaterial`. Spacecraft uses `meshBasicMaterial` with `toneMapped={false}`. These materials are already partially configured for bloom --- they just need a bloom pass to pick up the emissive contribution. The transparent overlay spheres can likely be removed or reduced once real bloom is active.

---

## External Research (2026 Sources)

### 1. @react-three/postprocessing Bloom (Official Docs)

The `<Bloom>` component from `@react-three/postprocessing` is the standard R3F bloom solution. Key findings:

- **Bloom is selective by default** when `luminanceThreshold >= 1`. Only materials with colors lifted above the 0--1 range (via `emissiveIntensity > 1` or `toneMapped={false}` with bright colors) will bloom. No layer system needed for basic selectivity.
- **`mipmapBlur`** enables GPU-accelerated multi-pass blurring for better quality and performance than kernel-based blur.
- **Tone mapping must be re-added** inside EffectComposer. The library disables tone mapping during postprocessing, so a `<ToneMapping>` effect must be the last child.
- **Effect merging**: The library automatically merges effects into minimal render passes, so adding Bloom + ToneMapping costs roughly one extra pass, not two.

Source: [Bloom - React Postprocessing](https://react-postprocessing.docs.pmnd.rs/effects/bloom)

### 2. Selective Bloom Approaches

Two documented approaches exist:

- **Emissive-based selectivity** (recommended): Set `luminanceThreshold` to 1. Materials with `toneMapped={false}` and bright colors or high `emissiveIntensity` exceed the threshold and bloom. Everything else stays clean. This is how the pmndrs ecosystem recommends doing it.
- **`<SelectiveBloom>`**: Uses refs to specific lights and a selection array of mesh objects. More complex, requires maintaining ref arrays, and has had cross-browser inconsistency issues. Not recommended unless per-object bloom intensity control is needed.

Source: [SelectiveBloom - React Postprocessing](https://react-postprocessing.docs.pmnd.rs/effects/selective-bloom), [Three.js Forum Discussion](https://discourse.threejs.org/t/pmndrs-post-processing-how-to-get-selective-bloom/58452)

### 3. Performance Impact

- Bloom adds a full-screen GPU pass. On mid-range hardware, expect a 2--5 FPS reduction at typical viewport sizes.
- **Mitigation**: `mipmapBlur` is significantly faster than kernel-based blur. Half-resolution bloom (`resolutionX/Y` at half viewport) can nearly eliminate the cost with minimal visual difference.
- The pmndrs `postprocessing` library (underlying `@react-three/postprocessing`) is optimized compared to Three.js's built-in `EffectComposer` --- it merges shader passes and minimizes draw calls.
- The ARTEMIS scene is lightweight (5 textured spheres, 1 point cloud, 2 lines) --- postprocessing overhead will be small relative to scenes with hundreds of objects.

Source: [100 Three.js Tips (2026)](https://www.utsubo.com/blog/threejs-best-practices-100-tips), [Codrops Performance Guide](https://tympanus.net/codrops/2025/02/11/building-efficient-three-js-scenes-optimize-performance-while-maintaining-quality/)

### 4. Custom Shader Glow (ektogamat/fake-glow-material-r3f)

An alternative approach using a custom GLSL shader material that creates glow on individual meshes without any postprocessing:

- Works by calculating view-angle-dependent opacity in the fragment shader
- Zero postprocessing cost --- runs as a regular material
- But: per-object only, no light bleed between objects, no distance-based bloom, requires smooth geometry
- The project already uses this pattern (transparent overlay spheres) --- the custom shader is just a more sophisticated version of the same idea

Source: [fake-glow-material-r3f](https://github.com/ektogamat/fake-glow-material-r3f)

### 5. Space Visualization Best Practices

Space scenes benefit enormously from bloom because:
- Stars should have varied brightness with bright ones bleeding light
- Spacecraft should have engine/signal glow that bleeds into surrounding space
- Planetary atmospheres should scatter light softly at the edges
- Trajectory lines can subtly glow to convey energy/heat

The "Unreal Bloom" approach (from Unreal Engine, ported to Three.js) is the industry standard for space visualization bloom.

Source: [Three.js Unreal Bloom Example](https://threejs.org/examples/webgl_postprocessing_unreal_bloom.html)

---

## Options Analysis

### Option A: Full-Scene Bloom via EffectComposer + Bloom

**How it works**: Add `<EffectComposer>` with `<Bloom>` and `<ToneMapping>` to `Scene.tsx`. Set `luminanceThreshold: 1` so only bright/emissive materials bloom. Tune emissive properties on existing materials to control which objects glow and how much.

**Implementation**:
1. Add `<EffectComposer>` as last child inside `<Canvas>`
2. Add `<Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.9} intensity={1.5} />` inside it
3. Add `<ToneMapping />` as last effect
4. On Spacecraft: increase `emissiveIntensity` or color brightness (already `toneMapped={false}`)
5. On Earth: increase `emissiveIntensity` from 0.45 to ~2.0, add `toneMapped={false}`
6. On Moon: increase `emissiveIntensity` from 0.4 to ~1.5, add `toneMapped={false}`
7. Optionally remove or reduce transparent overlay spheres (bloom replaces them)
8. Optionally add a few bright stars to the point cloud by varying point sizes/colors

**Pros**:
- Minimal code changes (~30--40 lines across 4 files)
- Zero new dependencies (package already installed)
- Bloom affects everything naturally --- stars, spacecraft, planets, trajectory all benefit
- Emissive-based selectivity is simple and robust
- `mipmapBlur` is high quality and performant
- Community-standard approach with extensive documentation

**Cons**:
- Full-screen GPU pass adds ~2--5 FPS cost
- All bright materials bloom --- cannot easily have one object bright without blooming
- Tone mapping must be managed inside EffectComposer (minor complexity)
- Bloom radius/intensity tuning requires visual iteration

**Effort**: Small (2--4 hours including tuning)

---

### Option B: Selective Bloom via SelectiveBloom + Layers

**How it works**: Use `<SelectiveBloom>` which accepts explicit `lights` and `selection` refs. Only objects in the selection array receive bloom. Other objects render normally regardless of their emissive intensity.

**Implementation**:
1. Add `<EffectComposer>` to `Scene.tsx`
2. Use `<SelectiveBloom>` instead of `<Bloom>`
3. Forward refs from each glowing component (Spacecraft, Earth atmosphere, Moon) up to Scene
4. Pass refs array to `<SelectiveBloom selection={[spacecraftRef, earthAtmoRef, ...]} lights={[lightRef]} />`
5. Add `<ToneMapping />` as last effect
6. Manage ref collection via React context or prop drilling

**Pros**:
- Precise per-object bloom control
- Non-glowing objects are guaranteed clean (no accidental bloom)

**Cons**:
- Significantly more complex --- ref management across component boundaries
- `SelectiveBloom` has known cross-browser inconsistencies (documented in GitHub issues)
- Requires extra render pass for the selection mask
- Ref arrays must be maintained as scene composition changes
- Over-engineered for this scene (only 5--6 objects, all of which should glow)
- Documented community friction --- many issues with `SelectiveBloom` and Three.js version compatibility

**Effort**: Medium (4--8 hours including debugging ref management)

---

### Option C: Custom Shader-Based Glow (No Postprocessing)

**How it works**: Replace transparent overlay spheres with a custom GLSL shader material (e.g., ektogamat's `fake-glow-material-r3f`) that calculates view-angle-dependent glow per mesh. No postprocessing pass needed.

**Implementation**:
1. Install or vendor `fake-glow-material-r3f` (or write equivalent ~80-line shader)
2. Replace Spacecraft overlay sphere with `<FakeGlowMaterial>` mesh
3. Replace Earth atmosphere overlay with `<FakeGlowMaterial>` mesh
4. Replace Moon overlay with `<FakeGlowMaterial>` mesh
5. Stars get no benefit (point cloud, not meshes)
6. Trajectory lines get no benefit

**Pros**:
- Zero postprocessing cost --- runs as regular geometry
- Per-object control of glow color, intensity, falloff
- No tone mapping complications
- Works on any hardware

**Cons**:
- No light bleed between objects --- glow is confined to mesh boundary
- No bloom on stars or trajectory (they are not meshes with normals)
- Requires smooth geometry (already satisfied --- all spheres)
- Each glowing object needs its own glow mesh (already the case, so no regression)
- Visually inferior to screen-space bloom --- no soft, photographic glow
- New dependency or vendored code
- Essentially a more sophisticated version of what already exists

**Effort**: Medium (3--6 hours including shader integration and tuning)

---

### Baseline: Current Transparent Overlays

**Assessment**: The current approach uses transparent `meshBasicMaterial` spheres slightly larger than the base mesh. This produces a hard-edged, flat halo that:
- Does not bleed light into surrounding space
- Does not respond to camera distance (same opacity at any zoom)
- Does not interact with other scene elements
- Looks noticeably artificial compared to screen-space bloom
- Is the cheapest possible approach --- zero GPU cost beyond the overlay geometry

**Visual quality**: Low. Acceptable for MVP, insufficient for a polished space visualization.

---

## Trade-Off Matrix

| Criterion | Weight | Option A: Full Bloom | Option B: Selective Bloom | Option C: Shader Glow | Current |
|-----------|--------|---------------------|--------------------------|----------------------|---------|
| Visual quality | 40% | 9/10 --- cinematic, photographic bloom across all objects | 8/10 --- same bloom quality but only on selected objects | 5/10 --- better than overlays but no light bleed, no stars | 3/10 --- flat halos |
| Simplicity | 30% | 9/10 --- ~40 lines, no new deps, standard pattern | 4/10 --- ref management, cross-component wiring, known bugs | 5/10 --- custom shader or new dep, per-object setup | 10/10 --- already done |
| Performance | 20% | 7/10 --- one extra GPU pass, mipmapBlur is fast | 6/10 --- extra pass + selection mask pass | 9/10 --- zero postprocessing cost | 10/10 --- zero cost |
| Maintainability | 10% | 8/10 --- standard pmndrs pattern, well-documented | 5/10 --- ref arrays, version sensitivity | 6/10 --- custom shader needs understanding | 9/10 --- trivial code |
| **Weighted Score** | 100% | **8.5** | **5.8** | **5.9** | **6.4** |

**Scoring notes**:
- Visual quality weighted highest (40%) per project priorities: "Visual wow-factor" is a core goal
- The current baseline scores 6.4 due to perfect simplicity and performance --- but the whole point of F1 is that visual quality is insufficient
- Option A dominates on the two highest-weighted criteria (visual quality + simplicity)

---

## Recommendation

**Option A: Full-Scene Bloom via EffectComposer + Bloom** is the clear winner.

It scores highest overall (8.5) and dominates on the two most important criteria --- visual quality (9/10) and simplicity (9/10). The performance cost is modest and well-understood. The key trade-off (2--5 FPS) is acceptable for a scene this lightweight, and `mipmapBlur` minimizes it further.

The selective approach (Option B) is over-engineered for a scene where every visible object should glow. The shader approach (Option C) is a lateral move from the current overlay technique --- more sophisticated but fundamentally limited by the lack of screen-space light bleed.

**Key decision**: Use emissive-based selectivity (`luminanceThreshold: 1` + `toneMapped={false}` on glowing materials) rather than `SelectiveBloom` with ref arrays. This is simpler, more robust, and the recommended approach in the pmndrs ecosystem documentation.

---

## Impact Assessment

### Code Changes

| File | Changes |
|------|---------|
| `src/components/Scene.tsx` | Add EffectComposer, Bloom, ToneMapping imports and JSX (~15 lines) |
| `src/components/Spacecraft.tsx` | Tune emissive color/intensity, potentially remove overlay sphere (~5 lines net) |
| `src/components/Earth.tsx` | Increase `emissiveIntensity`, add `toneMapped={false}`, potentially simplify overlay (~5 lines net) |
| `src/components/Moon.tsx` | Increase `emissiveIntensity`, add `toneMapped={false}`, potentially simplify overlay (~5 lines net) |
| `src/components/Stars.tsx` | Optional: vary star brightness for bloom variation (~5 lines) |
| `src/components/Trajectory.tsx` | Optional: add emissive properties to Line material (~3 lines) |

**Total**: ~30--40 lines of meaningful changes across 4--6 files.

### New Dependencies

None. `@react-three/postprocessing` v3.0.4 is already installed and listed in `package.json`.

### Performance

- **Expected FPS impact**: -2 to -5 FPS on mid-range hardware (integrated GPU)
- **Mitigation**: `mipmapBlur` is the fastest blur mode. If needed, halve `resolutionX`/`resolutionY`.
- **Scene baseline**: Very lightweight (5 textured spheres, 5000-point star field, 2 lines) --- the postprocessing cost is proportionally small.

### Risk

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Bloom too intense / washes out scene | Medium | Low | Tune `intensity`, `luminanceThreshold`, `luminanceSmoothing` --- all are props |
| Tone mapping changes overall scene brightness | Medium | Low | Add `<ToneMapping mode={ToneMappingMode.ACES_FILMIC} />` to match R3F default |
| Mobile performance regression | Low | Medium | Test on mobile; if needed, disable bloom via `enabled` prop on mobile viewports |
| drei `<Html>` labels (ORION, MOON) occluded by postprocessing | Low | Low | Html renders to CSS overlay, not WebGL --- should be unaffected |
| drei `<Line>` does not support `toneMapped` | Low | Low | Trajectory bloom is optional; skip if Line material does not support emissive |

---

## Implementation Sketch

### Scene.tsx --- EffectComposer Setup

```tsx
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'

// Inside <Canvas>, after all scene objects:
<EffectComposer>
  <Bloom
    mipmapBlur
    luminanceThreshold={1}
    luminanceSmoothing={0.3}
    intensity={1.5}
    radius={0.8}
  />
  <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
</EffectComposer>
```

### Spacecraft.tsx --- Emissive Tuning

```tsx
// Core mesh: make emissive exceed threshold
<meshBasicMaterial color="#00ff88" toneMapped={false} />
// Already toneMapped={false} --- color #00ff88 in linear space exceeds 1.0
// Bloom will pick this up automatically

// Outer glow sphere: can be removed or kept as subtle fill
// If kept, reduce opacity since bloom now provides the glow
```

### Earth.tsx --- Emissive Boost

```tsx
// Increase emissiveIntensity to push past luminanceThreshold
<meshStandardMaterial
  map={texture}
  emissive="#4488dd"
  emissiveIntensity={2.0}   // was 0.45
  toneMapped={false}         // NEW: prevents clamping to 0-1
/>
// Atmosphere overlay: keep but reduce opacity (bloom supplements it)
```

### Moon.tsx --- Emissive Boost

```tsx
<meshStandardMaterial
  map={texture}
  emissive="#cccccc"
  emissiveIntensity={1.5}   // was 0.4
  toneMapped={false}         // NEW
/>
// Overlay sphere: keep at reduced opacity or remove
```

### Stars.tsx --- Optional Bright Star Variation

```tsx
// Add color attribute with occasional bright stars
// Bright white stars (color > 1.0 in any channel) will bloom
// Dim stars stay below threshold
```

### Key Pattern: Emissive Selectivity

The core pattern is:
1. Set `luminanceThreshold: 1` on Bloom
2. Materials that should glow: set `toneMapped={false}` and use bright colors or high `emissiveIntensity`
3. Materials that should NOT glow: leave `toneMapped={true}` (default) --- their colors get clamped to 0--1

This gives selective bloom without any ref management or layer system.

---

## Sources

### Official Documentation
- [Bloom - React Postprocessing](https://react-postprocessing.docs.pmnd.rs/effects/bloom)
- [SelectiveBloom - React Postprocessing](https://react-postprocessing.docs.pmnd.rs/effects/selective-bloom)
- [pmndrs/react-postprocessing GitHub](https://github.com/pmndrs/react-postprocessing)
- [pmndrs/postprocessing GitHub](https://github.com/pmndrs/postprocessing)
- [Canvas - React Three Fiber Documentation](https://docs.pmnd.rs/react-three-fiber/api/canvas)
- [Three.js Unreal Bloom Example](https://threejs.org/examples/webgl_postprocessing_unreal_bloom.html)

### Tutorials and Guides
- [Post Processing - Wawa Sensei](https://wawasensei.dev/courses/react-three-fiber/lessons/post-processing)
- [Bloom - React Three Fiber Tutorials (sbcode.net)](https://sbcode.net/react-three-fiber/bloom/)
- [Emissive Bloom - R3F by Example](https://onion2k.github.io/r3f-by-example/examples/effects/emissive-bloom/)
- [ToneMapping - React Three Fiber Tutorials](https://sbcode.net/react-three-fiber/tonemapping/)

### Performance
- [100 Three.js Tips That Actually Improve Performance (2026)](https://www.utsubo.com/blog/threejs-best-practices-100-tips)
- [Building Efficient Three.js Scenes (Codrops)](https://tympanus.net/codrops/2025/02/11/building-efficient-three-js-scenes-optimize-performance-while-maintaining-quality/)
- [Performance Issues with Bloom - Three.js Forum](https://discourse.threejs.org/t/performance-issues-with-bloom/66257)

### Alternative Approaches
- [fake-glow-material-r3f (ektogamat)](https://github.com/ektogamat/fake-glow-material-r3f)
- [fake-glow-material-threejs (ektogamat)](https://github.com/ektogamat/fake-glow-material-threejs)

### Community Discussions
- [Selective Bloom - Three.js Forum](https://discourse.threejs.org/t/pmndrs-post-processing-how-to-get-selective-bloom/58452)
- [Outer Glow Sphere Discussion - R3F GitHub](https://github.com/pmndrs/react-three-fiber/discussions/2348)
- [Tone Mapping Configuration - R3F GitHub Issue #1547](https://github.com/pmndrs/react-three-fiber/issues/1547)

### Project Files
- `src/components/Scene.tsx` --- Canvas setup (no postprocessing)
- `src/components/Spacecraft.tsx` --- Spacecraft with transparent overlay glow
- `src/components/Earth.tsx` --- Earth with atmosphere overlay + emissive material
- `src/components/Moon.tsx` --- Moon with overlay + emissive material
- `src/components/Stars.tsx` --- 5000-point star cloud
- `src/components/Trajectory.tsx` --- Past/future trajectory lines
- `package.json` --- `@react-three/postprocessing` v3.0.4 (installed, unused)
- `docs/findings/2026-04-04_1201_bloom_glow_visual_effects.md` --- F1 finding report

---

**Analysis Complete**: 2026-04-04 12:01 UTC
