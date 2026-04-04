import { useMemo } from 'react';
import { useTexture, Html } from '@react-three/drei';
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
  const texture = useTexture('/textures/moon.jpg');
  const oemData = useMissionStore((s) => s.oemData);

  // Position Moon near the flyby point but OFFSET from the trajectory.
  // The spacecraft flies ~8,900 km above the Moon's surface (~10,637 km from center).
  // Place Moon further from Earth than the max-distance trajectory point.
  const flybyPos = useMemo((): [number, number, number] => {
    if (!oemData || oemData.length === 0) return [38.44, 0, 0];

    // Find the flyby point (max distance from Earth) — compare squared distances
    let maxDistSq = 0;
    let flybyVector = oemData[0];
    for (const v of oemData) {
      const distSq = v.x * v.x + v.y * v.y + v.z * v.z;
      if (distSq > maxDistSq) {
        maxDistSq = distSq;
        flybyVector = v;
      }
    }

    // Direction from Earth to flyby point (sqrt only on the winner)
    const maxDist = Math.sqrt(maxDistSq);
    const dx = flybyVector.x / maxDist;
    const dy = flybyVector.y / maxDist;
    const dz = flybyVector.z / maxDist;

    // Moon is CLOSER to Earth than the flyby point — spacecraft passes
    // behind the Moon's far side at ~8,900 km above surface.
    // Offset Moon TOWARD Earth by ~10,637 km (8,900 + 1,737 radius).
    const offsetKm = 10637;
    const moonX = (flybyVector.x - dx * offsetKm) / SCALE_FACTOR;
    const moonY = (flybyVector.y - dy * offsetKm) / SCALE_FACTOR;
    const moonZ = (flybyVector.z - dz * offsetKm) / SCALE_FACTOR;

    return [moonX, moonY, moonZ];
  }, [oemData]);

  return (
    <group position={flybyPos}>
      <mesh>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial map={texture} emissive="#cccccc" emissiveIntensity={1.5} toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.65, 16, 16]} />
        <meshBasicMaterial color="#dddddd" transparent opacity={0.03} />
      </mesh>
      <Html
        position={[0, 0.9, 0]}
        center
        zIndexRange={[0, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div style={MOON_LABEL_STYLE}>
          MOON
        </div>
      </Html>
    </group>
  );
}
