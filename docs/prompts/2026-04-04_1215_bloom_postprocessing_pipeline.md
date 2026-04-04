# Implementation Prompt: Bloom/Glow Postprocessing Pipeline

**Blueprint Reference**: docs/blueprints/2026-04-04_1215_bloom_postprocessing_pipeline.md
**Design Reference**: docs/design/2026-04-04_1201_bloom_postprocessing_pipeline.md

## Context

The ARTEMIS 3D scene currently fakes glow effects with transparent overlay spheres on Spacecraft, Earth, and Moon. These produce flat, hard-edged halos with no light bleed or distance falloff. The `@react-three/postprocessing` package (v3.0.4) is already installed but unused. This task integrates a full-scene bloom pipeline using `EffectComposer` + `Bloom` + `ToneMapping`, converting fake overlays to real screen-space bloom driven by emissive material properties.

## Goal

Add cinematic bloom postprocessing to the ARTEMIS scene so that:
- Spacecraft glows with a soft green bloom halo
- Earth has atmospheric blue bloom at its edges
- Moon has subtle gray-white bloom
- Bright stars bloom while dim stars stay clean
- The overall scene gains a photographic, cinematic space aesthetic

## Requirements

1. Add `<EffectComposer>` containing `<Bloom>` and `<ToneMapping>` as the last children inside `<Canvas>` in `src/components/Scene.tsx`
2. Configure `<Bloom>` with: `mipmapBlur`, `luminanceThreshold={1}`, `luminanceSmoothing={0.3}`, `intensity={1.5}`, `radius={0.8}`
3. Add `<ToneMapping mode={ToneMappingMode.ACES_FILMIC} />` as the last effect inside `<EffectComposer>`
4. In `src/components/Spacecraft.tsx`: reduce outer glow sphere opacity from `0.15` to `0.05` (bloom replaces its purpose). Core mesh already has `toneMapped={false}` with bright `#00ff88` -- it will bloom automatically.
5. In `src/components/Earth.tsx`: increase `emissiveIntensity` from `0.45` to `2.0`, add `toneMapped={false}` to the `meshStandardMaterial`. Reduce atmosphere overlay sphere opacity from `0.18` to `0.08`.
6. In `src/components/Moon.tsx`: increase `emissiveIntensity` from `0.4` to `1.5`, add `toneMapped={false}` to the `meshStandardMaterial`. Reduce overlay sphere opacity from `0.1` to `0.03`.
7. In `src/components/Stars.tsx`: add a per-point color attribute (`Float32Array` of 5000 * 3 values) generated alongside positions in the `useMemo` block. Most stars get dim white (RGB ~0.8-1.0). ~5% of stars get bright values (RGB ~1.5-3.0) to bloom. Enable `vertexColors` on `PointMaterial` and remove the static `color="#ffffff"` prop. Attach color data as a `<bufferAttribute>` on the Points geometry.

## Files Likely Affected

### `src/components/Scene.tsx`
- **Add imports** (after existing imports, before component):
  - `import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing'`
  - `import { ToneMappingMode } from 'postprocessing'`
- **Add JSX** (after `<Spacecraft />`, before closing `</Canvas>`):
  ```tsx
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

### `src/components/Spacecraft.tsx`
- **Line 41** (outer glow sphere material): change `opacity={0.15}` to `opacity={0.05}`
- No other changes needed -- core mesh already uses `meshBasicMaterial` with `toneMapped={false}` and bright `#00ff88` which exceeds luminance threshold 1.0

### `src/components/Earth.tsx`
- **Line 22** (`meshStandardMaterial`): change `emissiveIntensity={0.45}` to `emissiveIntensity={2.0}` and add `toneMapped={false}`
  - Before: `<meshStandardMaterial map={texture} emissive="#4488dd" emissiveIntensity={0.45} />`
  - After: `<meshStandardMaterial map={texture} emissive="#4488dd" emissiveIntensity={2.0} toneMapped={false} />`
- **Line 30** (atmosphere overlay material): change `opacity={0.18}` to `opacity={0.08}`

### `src/components/Moon.tsx`
- **Line 48** (`meshStandardMaterial`): change `emissiveIntensity={0.4}` to `emissiveIntensity={1.5}` and add `toneMapped={false}`
  - Before: `<meshStandardMaterial map={texture} emissive="#cccccc" emissiveIntensity={0.4} />`
  - After: `<meshStandardMaterial map={texture} emissive="#cccccc" emissiveIntensity={1.5} toneMapped={false} />`
- **Line 51** (overlay sphere material): change `opacity={0.1}` to `opacity={0.03}`

### `src/components/Stars.tsx`
- **Inside `useMemo` block** (lines 8-19): generate a `colors` Float32Array alongside `positions`:
  ```tsx
  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(5000 * 3);
    const col = new Float32Array(5000 * 3);
    for (let i = 0; i < 5000; i++) {
      // ... existing position generation ...

      // Color: ~5% bright stars that will bloom, rest dim
      const isBright = Math.random() < 0.05;
      const brightness = isBright
        ? 1.5 + Math.random() * 1.5  // 1.5-3.0 range, will exceed luminanceThreshold
        : 0.6 + Math.random() * 0.4; // 0.6-1.0 range, below threshold
      col[i * 3] = brightness;
      col[i * 3 + 1] = brightness;
      col[i * 3 + 2] = brightness;
    }
    return { positions: pos, colors: col };
  }, []);
  ```
- **Points JSX**: attach color buffer attribute and enable vertex colors:
  ```tsx
  <Points ref={ref} positions={positions} stride={3} frustumCulled={false}>
    <bufferAttribute attach="geometry-attributes-color" args={[colors, 3]} />
    <PointMaterial
      transparent
      vertexColors
      size={0.3}
      sizeAttenuation
      depthWrite={false}
    />
  </Points>
  ```
  - Remove `color="#ffffff"` from PointMaterial (replaced by per-vertex colors)
  - Add `vertexColors` prop to PointMaterial

## Implementation Sequence

1. **Scene.tsx -- Add EffectComposer block**: This is the foundation. Add the two import lines and the EffectComposer JSX after `<Spacecraft />`. Without this, no bloom is visible regardless of emissive tuning. Verify `npm run build` compiles.

2. **Spacecraft.tsx -- Reduce overlay opacity**: Change outer glow sphere `opacity` from `0.15` to `0.05`. The core mesh already has the right material properties for bloom. This is the simplest change to visually confirm bloom is working -- the green dot should now have a soft radiating halo.

3. **Earth.tsx -- Boost emissive + reduce overlay**: Change `emissiveIntensity` from `0.45` to `2.0`, add `toneMapped={false}` to the meshStandardMaterial. Reduce atmosphere overlay `opacity` from `0.18` to `0.08`. Earth should now show blue atmospheric bloom at its edges.

4. **Moon.tsx -- Boost emissive + reduce overlay**: Change `emissiveIntensity` from `0.4` to `1.5`, add `toneMapped={false}` to the meshStandardMaterial. Reduce overlay `opacity` from `0.1` to `0.03`. Moon should show subtle gray-white bloom.

5. **Stars.tsx -- Add star brightness variation**: Refactor the `useMemo` to produce both `positions` and `colors` arrays. Add `<bufferAttribute>` for color data. Switch `PointMaterial` from static `color` to `vertexColors`. Bright stars (5%) should produce small visible bloom halos.

6. **Visual tuning (if needed)**: If bloom is too strong or too weak, adjust Bloom `intensity` (try 1.0-2.5 range), `luminanceSmoothing` (try 0.1-0.5), or per-object `emissiveIntensity` values. If scene appears washed out, verify `<ToneMapping>` is the last effect inside EffectComposer.

## Constraints

- Zero new npm dependencies -- use only `@react-three/postprocessing` (already installed v3.0.4) and `postprocessing` (transitive dependency, already present)
- Import components from `@react-three/postprocessing`: `EffectComposer`, `Bloom`, `ToneMapping`
- Import enums from `postprocessing`: `ToneMappingMode`
- Do NOT use `SelectiveBloom` -- use standard `Bloom` with `luminanceThreshold` gating
- Do NOT modify `CameraController.tsx`, `DataDriver.tsx`, `CameraDebug.tsx`, or `Trajectory.tsx`
- Keep overlay spheres in the JSX at reduced opacity (do not delete them) -- they serve as fallback if bloom is ever disabled
- HTML labels (`ORION` in Spacecraft.tsx, `MOON` in Moon.tsx) must remain visible and unaffected
- The Bloom parameter values (intensity 1.5, radius 0.8, etc.) are starting points -- adjust if the visual result is not balanced
- `toneMapped={false}` must be added to any `meshStandardMaterial` that should bloom, otherwise its emissive output gets clamped to 0-1 before the bloom pass sees it

## Acceptance Criteria

- [ ] `npm run build` passes with zero TypeScript errors
- [ ] `<EffectComposer>` with `<Bloom>` and `<ToneMapping>` is rendered inside `<Canvas>` in Scene.tsx
- [ ] Spacecraft shows soft green bloom halo radiating outward from core mesh
- [ ] Earth shows blue atmospheric bloom at edges (soft falloff, not hard cutoff)
- [ ] Moon shows subtle gray-white bloom
- [ ] Some stars visibly bloom (brighter/larger than dim stars)
- [ ] `ORION` and `MOON` HTML labels remain visible and correctly positioned
- [ ] No rendering artifacts (banding, flicker, black frames, depth sorting issues)
- [ ] Scene is not washed out or overly bright (tone mapping is functioning)
- [ ] Overlay spheres are still present in JSX at reduced opacity (not deleted)

---

## Plan Output Instructions

**IMPORTANT**: Before creating the implementation plan, you MUST enter plan mode:

1. Call `EnterPlanMode` to enter plan mode
2. Explore the codebase using read-only tools (Read, Grep, Glob) to verify current file contents match expectations above
3. Write the plan to `docs/plans/PLAN_2026-04-04_bloom_postprocessing_pipeline.md`
4. Call `ExitPlanMode` to present the plan for user approval
5. After approval, invoke `/wrought-implement` to start implementation
