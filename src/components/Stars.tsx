import { useMemo, useRef } from 'react';
import { Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';

export default function Stars() {
  const ref = useRef<THREE.Points>(null);

  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(5000 * 3);
    const col = new Float32Array(5000 * 3);
    for (let i = 0; i < 5000; i++) {
      const r = 200 + Math.random() * 300;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      // ~5% of stars get bright values that will bloom, rest stay dim
      const isBright = Math.random() < 0.05;
      const brightness = isBright
        ? 1.5 + Math.random() * 1.5  // 1.5-3.0: exceeds luminanceThreshold
        : 0.6 + Math.random() * 0.4; // 0.6-1.0: below threshold
      col[i * 3] = brightness;
      col[i * 3 + 1] = brightness;
      col[i * 3 + 2] = brightness;
    }
    return { positions: pos, colors: col };
  }, []);

  return (
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
  );
}
