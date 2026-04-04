# Blueprint: Bloom/Glow Postprocessing Pipeline

**Date**: 2026-04-04
**Design Reference**: docs/design/2026-04-04_1201_bloom_postprocessing_pipeline.md
**Finding**: F1 in `docs/findings/2026-04-04_1201_post_mvp_visual_data_features_FINDINGS_TRACKER.md`

## Objective

Add a full-scene bloom postprocessing pipeline to the ARTEMIS 3D scene by integrating the already-installed `@react-three/postprocessing` package (v3.0.4). This replaces the current fake glow overlays (transparent sphere meshes) with cinematic screen-space bloom driven by emissive material properties. The bloom selectively targets bright/emissive objects (Spacecraft, Earth atmosphere, Moon, bright stars) via `luminanceThreshold` gating, requiring no ref management or layer system.

## Requirements

1. Add `<EffectComposer>` with `<Bloom>` and `<ToneMapping>` as the last children inside `<Canvas>` in `Scene.tsx`
2. Configure Bloom with `mipmapBlur`, `luminanceThreshold={1}`, and tuned `intensity`/`radius`/`luminanceSmoothing` values
3. Add `<ToneMapping mode={ToneMappingMode.ACES_FILMIC} />` as the last effect to restore tone mapping that EffectComposer disables
4. Convert Spacecraft core mesh from `meshBasicMaterial` to emissive bloom source (already `toneMapped={false}` with bright color `#00ff88` -- will bloom automatically past threshold 1)
5. Reduce or remove the Spacecraft outer glow overlay sphere (bloom replaces its purpose)
6. Boost Earth `emissiveIntensity` and add `toneMapped={false}` so emissive contribution exceeds the luminance threshold
7. Reduce Earth atmosphere overlay sphere opacity (bloom supplements it, so less overlay needed)
8. Boost Moon `emissiveIntensity` and add `toneMapped={false}` for bloom contribution
9. Reduce or remove Moon overlay sphere (bloom replaces it)
10. Add varied star brightness by introducing a color attribute to the star point cloud, with occasional bright stars (`> 1.0` in linear space) that will bloom
11. Keep `<Html>` labels (ORION, MOON) unaffected -- they render to CSS overlay, not WebGL

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Bloom approach | Full-scene via `<Bloom>` with `luminanceThreshold` gating | Simpler than `SelectiveBloom` (no ref arrays), covers all objects uniformly, recommended by pmndrs ecosystem. See design analysis Options A vs B. |
| Selectivity mechanism | Emissive-based (`toneMapped={false}` + bright colors or high `emissiveIntensity`) | Materials exceeding luminance threshold 1.0 bloom; others stay clean. No layer system or ref management needed. |
| Blur algorithm | `mipmapBlur` | GPU-accelerated multi-pass mipmap blur is faster and higher quality than kernel-based alternatives. |
| Tone mapping | `ToneMappingMode.ACES_FILMIC` via `<ToneMapping>` effect | EffectComposer disables R3F's default tone mapping. ACES Filmic matches the default Three.js tone mapper and produces natural HDR-to-LDR mapping. |
| Overlay sphere strategy | Reduce opacity, do not remove entirely | Keep overlay spheres at reduced opacity as fill/fallback. Bloom provides the primary glow, overlays provide subtle baseline. Allows easy rollback if bloom is disabled on low-end devices. |
| Star bloom | Color attribute with varied brightness | Point cloud gains a `Float32Array` color buffer. Most stars stay dim (RGB < 1.0). ~5% get bright values (RGB 1.5-3.0) to bloom as prominent stars. |
| Trajectory lines | No changes initially | drei `<Line>` uses `LineBasicMaterial` internally which does not support `emissive`. Trajectory bloom is a stretch goal requiring material override -- skip for now. |

## Scope

### In Scope
- EffectComposer + Bloom + ToneMapping integration in Scene.tsx
- Emissive material tuning on Spacecraft, Earth, Moon
- Overlay sphere reduction (lower opacity) on Spacecraft, Earth, Moon
- Star brightness variation via color attribute for bloom contribution
- TypeScript compilation verification (`npm run build`)

### Out of Scope
- Trajectory line glow (drei `<Line>` material limitation -- stretch goal for future)
- Mobile-specific bloom disabling (can be added later via `enabled` prop + viewport check)
- Half-resolution bloom optimization (only needed if FPS drops below 30)
- `SelectiveBloom` or layer-based bloom (rejected in design analysis)
- Custom GLSL shader glow materials (rejected in design analysis)
- Any new npm dependencies (everything is already installed)

## Files Likely Affected

- **`src/components/Scene.tsx`** -- Add imports for `EffectComposer`, `Bloom`, `ToneMapping` from `@react-three/postprocessing` and `ToneMappingMode` from `postprocessing`. Add `<EffectComposer>` block as the last child inside `<Canvas>`, after `<Spacecraft />`. (~15 lines added)

- **`src/components/Spacecraft.tsx`** -- The core mesh (line 35-37) already uses `meshBasicMaterial` with `color="#00ff88"` and `toneMapped={false}`, which exceeds luminance 1.0 and will bloom automatically. The outer glow sphere (lines 39-42) should have its `opacity` reduced from `0.15` to `0.05` or removed entirely since bloom replaces its purpose. (~3 lines changed)

- **`src/components/Earth.tsx`** -- The main mesh `meshStandardMaterial` (line 22) needs `emissiveIntensity` increased from `0.45` to `~2.0` and `toneMapped={false}` added to push emissive contribution past the luminance threshold. The atmosphere overlay sphere (lines 26-32) should have `opacity` reduced from `0.18` to `~0.08` since bloom supplements atmospheric glow. (~4 lines changed)

- **`src/components/Moon.tsx`** -- The main mesh `meshStandardMaterial` (line 48) needs `emissiveIntensity` increased from `0.4` to `~1.5` and `toneMapped={false}` added. The overlay sphere (lines 50-52) should have `opacity` reduced from `0.1` to `~0.03` or removed. (~4 lines changed)

- **`src/components/Stars.tsx`** -- Replace uniform white `PointMaterial` color with a per-point color attribute (`Float32Array` of 5000 * 3 RGB values). Most stars get dim white (0.8-1.0), ~5% get bright values (1.5-3.0) to bloom as prominent stars. Add `vertexColors` to `PointMaterial`. Change `<PointMaterial color="#ffffff" ...>` to `<PointMaterial vertexColors ...>`. Add `<bufferAttribute>` for color data on the `<Points>` geometry. (~15 lines changed)

## Implementation Sequence

1. **Add EffectComposer to Scene.tsx** -- This is the foundation. Add imports and JSX block. Until this is in place, no emissive tuning will produce visible bloom. Build should compile immediately since the package is already installed.

2. **Tune Spacecraft emissive/overlay** -- The simplest test case. Spacecraft `meshBasicMaterial` with `toneMapped={false}` already exceeds threshold. Reduce overlay opacity. Visually confirm bloom halo around the spacecraft dot.

3. **Tune Earth emissive/overlay** -- Increase `emissiveIntensity` to 2.0, add `toneMapped={false}`, reduce atmosphere overlay opacity. Earth should show soft blue bloom around its edges.

4. **Tune Moon emissive/overlay** -- Same pattern as Earth. Increase `emissiveIntensity` to 1.5, add `toneMapped={false}`, reduce overlay opacity. Moon should show subtle gray-white bloom.

5. **Add star brightness variation** -- Generate color attribute array in the `useMemo` block alongside positions. Apply as `<bufferAttribute>` on the Points geometry. Enable `vertexColors` on PointMaterial. Bright stars should produce small bloom halos.

6. **Visual tuning pass** -- Adjust Bloom `intensity`, `radius`, `luminanceSmoothing`, and per-object `emissiveIntensity` values to achieve balanced cinematic result. This is iterative -- values in this blueprint are starting points.

## Dependencies & Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Bloom oversaturates scene (too intense, washes out colors) | Medium | Low | All Bloom params (`intensity`, `luminanceThreshold`, `luminanceSmoothing`, `radius`) are JSX props -- tune iteratively. Start conservative (intensity 1.5) and increase. |
| Tone mapping shift changes overall scene brightness/color | Medium | Low | `ToneMappingMode.ACES_FILMIC` matches Three.js default. If colors shift, adjust `ToneMapping` exposure or switch mode. |
| `toneMapped={false}` on `meshStandardMaterial` causes Earth/Moon to appear blown out | Medium | Low | If the diffuse map appears too bright, reduce base `emissive` color intensity (e.g. `#224466` instead of `#4488dd`) while keeping high `emissiveIntensity` multiplier. |
| Star `vertexColors` not working with `PointMaterial` from drei | Low | Medium | drei `PointMaterial` extends Three.js `PointsMaterial` which supports `vertexColors`. If it fails, switch to raw `<pointsMaterial vertexColors />`. |
| FPS drops below 30 on low-end hardware | Low | Medium | `mipmapBlur` is the fastest option. If needed, add `resolutionScale={0.5}` to EffectComposer for half-resolution bloom. Can also disable bloom conditionally. |
| drei `<Html>` labels (ORION, MOON) occluded or broken by postprocessing | Low | Low | `<Html>` renders to CSS overlay, not WebGL. Should be completely unaffected by EffectComposer. |

## Acceptance Criteria

- [ ] `npm run build` passes with zero TypeScript errors
- [ ] EffectComposer with Bloom and ToneMapping renders in Scene.tsx
- [ ] Spacecraft shows soft green bloom halo radiating from core mesh
- [ ] Earth shows blue atmospheric bloom at edges (replacing hard cutoff of overlay)
- [ ] Moon shows subtle gray-white bloom
- [ ] At least some stars show visible bloom (bright stars stand out from dim ones)
- [ ] ORION and MOON HTML labels remain visible and correctly positioned
- [ ] No visible rendering artifacts (banding, flicker, black frames)
- [ ] Scene does not appear washed out or overly bright (tone mapping is correct)
- [ ] Overlay spheres are reduced in opacity (not fully removed -- kept as fallback)
- [ ] FPS remains above 30 on desktop

## Constraints

- Zero new npm dependencies -- `@react-three/postprocessing` v3.0.4 and `postprocessing` (transitive) are already installed
- All imports must resolve from `@react-three/postprocessing` (components) and `postprocessing` (enums like `ToneMappingMode`)
- Do not break existing `<Html>` label rendering (CSS overlay layer)
- Do not modify `CameraController`, `DataDriver`, `CameraDebug`, or `Trajectory` components
- Keep overlay spheres at reduced opacity rather than deleting them (fallback for bloom-disabled mode)
- Emissive intensity values in this blueprint (2.0, 1.5, etc.) are starting points -- visual tuning is expected

## Debug Strategy

- **Self-debug**: enabled
- **Verifier**: `npm run build` (TypeScript compilation) + visual inspection via `npm run dev`
- **Max iterations**: 3
- **Completion criteria**: Scene renders with bloom on Spacecraft, Earth atmosphere, Moon, and bright stars; no TypeScript errors; no visual artifacts; HTML labels unaffected
- **Escape hatch**: After 3 iterations, document blockers and request human review
- **Invoke with**: `/wrought-implement`
