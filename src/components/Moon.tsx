import { useMemo, useEffect } from 'react';
import { useTexture, Billboard, Html } from '@react-three/drei';
import { useMissionStore } from '../store/mission-store';
import { SCALE_FACTOR } from '../data/mission-config';

const MOON_LABEL_STYLE = {
  color: '#aaaaaa',
  fontSize: '10px',
  fontFamily: 'monospace',
  fontWeight: 'bold' as const,
  textShadow: '0 0 6px rgba(170,170,170,0.4)',
  whiteSpace: 'nowrap' as const,
};

export default function Moon() {
  const texture = useTexture('/textures/moon-hires.png');
  const oemData = useMissionStore((s) => s.oemData);

  const flybyPos = useMemo((): [number, number, number] => {
    if (!oemData || oemData.length === 0) return [38.44, 0, 0];

    let maxDistSq = 0;
    let flybyVector = oemData[0];
    for (const v of oemData) {
      const distSq = v.x * v.x + v.y * v.y + v.z * v.z;
      if (distSq > maxDistSq) {
        maxDistSq = distSq;
        flybyVector = v;
      }
    }

    const maxDist = Math.sqrt(maxDistSq);
    const dx = flybyVector.x / maxDist;
    const dy = flybyVector.y / maxDist;
    const dz = flybyVector.z / maxDist;

    const offsetKm = 10637;
    const moonX = (flybyVector.x - dx * offsetKm) / SCALE_FACTOR;
    const moonY = (flybyVector.y - dy * offsetKm) / SCALE_FACTOR;
    const moonZ = (flybyVector.z - dz * offsetKm) / SCALE_FACTOR;

    return [moonX, moonY, moonZ];
  }, [oemData]);

  // Store moon position for trajectory culling and moon distance calculation
  useEffect(() => {
    useMissionStore.getState().setMoonPosition({
      x: flybyPos[0], y: flybyPos[1], z: flybyPos[2],
    });
  }, [flybyPos]);

  return (
    <group position={flybyPos}>
      {/* Moon billboard sprite */}
      <Billboard>
        <mesh>
          <planeGeometry args={[1.5, 1.5]} />
          <meshBasicMaterial map={texture} transparent toneMapped={false} />
        </mesh>
      </Billboard>
      <Html
        position={[0, 1.0, 0]}
        center
        zIndexRange={[0, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div style={MOON_LABEL_STYLE}>MOON</div>
      </Html>
    </group>
  );
}
