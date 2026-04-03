import { useTexture, Html } from '@react-three/drei';
import { useMissionStore } from '../store/mission-store';
import { SCALE_FACTOR } from '../data/mission-config';

export default function Moon() {
  const texture = useTexture('/textures/moon.jpg');
  const moonPosition = useMissionStore((s) => s.moonPosition);

  const pos: [number, number, number] = moonPosition
    ? [moonPosition.x / SCALE_FACTOR, moonPosition.y / SCALE_FACTOR, moonPosition.z / SCALE_FACTOR]
    : [38.44, 0, 0];

  return (
    <group position={pos}>
      {/* Moon sphere — slightly enlarged for visibility (real scale 0.1737) */}
      <mesh>
        <sphereGeometry args={[0.4, 32, 32]} />
        <meshStandardMaterial map={texture} />
      </mesh>
      {/* Subtle glow */}
      <mesh>
        <sphereGeometry args={[0.55, 16, 16]} />
        <meshBasicMaterial color="#aaaaaa" transparent opacity={0.06} />
      </mesh>
      <Html
        position={[0, 0.8, 0]}
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
