import { useMemo } from 'react';
import { useTexture, Html } from '@react-three/drei';
import { useMissionStore } from '../store/mission-store';
import { SCALE_FACTOR } from '../data/mission-config';

export default function Moon() {
  const texture = useTexture('/textures/moon.jpg');
  const oemData = useMissionStore((s) => s.oemData);

  // Position Moon near the flyby point but OFFSET from the trajectory.
  // The spacecraft flies ~8,900 km above the Moon's surface (~10,637 km from center).
  // Place Moon further from Earth than the max-distance trajectory point.
  const flybyPos = useMemo((): [number, number, number] => {
    if (!oemData || oemData.length === 0) return [38.44, 0, 0];

    // Find the flyby point (max distance from Earth)
    let maxDist = 0;
    let flybyVector = oemData[0];
    for (const v of oemData) {
      const dist = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
      if (dist > maxDist) {
        maxDist = dist;
        flybyVector = v;
      }
    }

    // Direction from Earth to flyby point
    const dx = flybyVector.x / maxDist;
    const dy = flybyVector.y / maxDist;
    const dz = flybyVector.z / maxDist;

    // Offset Moon further from Earth along that direction
    // ~10,637 km (8,900 surface + 1,737 radius) from spacecraft → Moon center
    const offsetKm = 10637;
    const moonX = (flybyVector.x + dx * offsetKm) / SCALE_FACTOR;
    const moonY = (flybyVector.y + dy * offsetKm) / SCALE_FACTOR;
    const moonZ = (flybyVector.z + dz * offsetKm) / SCALE_FACTOR;

    return [moonX, moonY, moonZ];
  }, [oemData]);

  return (
    <group position={flybyPos}>
      <mesh>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial map={texture} />
      </mesh>
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
