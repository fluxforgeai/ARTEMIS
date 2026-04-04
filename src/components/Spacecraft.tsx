import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
// Read-only shared ref updated by DataDriver each frame — avoids per-frame Zustand subscriptions
import { spacecraftPosition } from './DataDriver';
import { SCALE_FACTOR } from '../data/mission-config';

const ORION_LABEL_STYLE = {
  color: '#00ff88',
  fontSize: '11px',
  fontFamily: 'monospace',
  fontWeight: 'bold' as const,
  textShadow: '0 0 8px rgba(0,255,136,0.5)',
  whiteSpace: 'nowrap' as const,
};

export default function Spacecraft() {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;

    // Read position from shared ref (updated every frame by DataDriver)
    const x = spacecraftPosition.x / SCALE_FACTOR;
    const y = spacecraftPosition.y / SCALE_FACTOR;
    const z = spacecraftPosition.z / SCALE_FACTOR;

    // Only show when we have data
    const hasData = spacecraftPosition.x !== 0 || spacecraftPosition.y !== 0 || spacecraftPosition.z !== 0;
    groupRef.current.visible = hasData;
    groupRef.current.position.set(x, y, z);

    // Pulsing animation
    if (meshRef.current) {
      const pulse = 1 + Math.sin(clock.getElapsedTime() * 3) * 0.3;
      meshRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshBasicMaterial color="#00ff88" toneMapped={false} />
      </mesh>
      {/* Outer glow */}
      <mesh>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshBasicMaterial color="#00ff88" transparent opacity={0.05} toneMapped={false} />
      </mesh>
      <Html
        position={[0, 0.5, 0]}
        center
        zIndexRange={[0, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div style={ORION_LABEL_STYLE}>
          ORION
        </div>
      </Html>
    </group>
  );
}
