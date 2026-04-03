import { useMemo } from 'react';
import { useTexture, Html } from '@react-three/drei';
import { useMissionStore } from '../store/mission-store';
import { SCALE_FACTOR } from '../data/mission-config';

export default function Moon() {
  const texture = useTexture('/textures/moon.jpg');
  const oemData = useMissionStore((s) => s.oemData);

  // Position the Moon at the trajectory's furthest point from Earth (flyby location)
  // This ensures the Moon aligns with the turnaround point in the trajectory
  const flybyPos = useMemo((): [number, number, number] => {
    if (!oemData || oemData.length === 0) return [38.44, 0, 0];

    // Find the point of maximum distance from Earth (the lunar flyby)
    let maxDist = 0;
    let flybyVector = oemData[0];
    for (const v of oemData) {
      const dist = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
      if (dist > maxDist) {
        maxDist = dist;
        flybyVector = v;
      }
    }

    // Place Moon at the flyby point (it was approximately here during closest approach)
    return [
      flybyVector.x / SCALE_FACTOR,
      flybyVector.y / SCALE_FACTOR,
      flybyVector.z / SCALE_FACTOR,
    ];
  }, [oemData]);

  return (
    <group position={flybyPos}>
      <mesh>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial map={texture} />
      </mesh>
      {/* Subtle glow */}
      <mesh>
        <sphereGeometry args={[0.65, 16, 16]} />
        <meshBasicMaterial color="#aaaaaa" transparent opacity={0.06} />
      </mesh>
      <Html
        position={[0, 0.9, 0]}
        center
        zIndexRange={[0, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div style={{
          color: '#aaaaaa',
          fontSize: '10px',
          fontFamily: 'monospace',
          fontWeight: 'bold',
          textShadow: '0 0 6px rgba(170,170,170,0.4)',
          whiteSpace: 'nowrap',
        }}>
          MOON
        </div>
      </Html>
    </group>
  );
}
