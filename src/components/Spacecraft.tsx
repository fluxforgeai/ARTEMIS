import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture, Billboard, Html } from '@react-three/drei';
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

// Reusable vectors to avoid per-frame allocation
const _vel = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _camUp = new THREE.Vector3();

export default function Spacecraft() {
  const groupRef = useRef<THREE.Group>(null);
  const spriteRef = useRef<THREE.Mesh>(null);
  const texture = useTexture('/textures/orion.png');

  useFrame(({ camera }) => {
    if (!groupRef.current) return;

    const x = spacecraftPosition.x / SCALE_FACTOR;
    const y = spacecraftPosition.y / SCALE_FACTOR;
    const z = spacecraftPosition.z / SCALE_FACTOR;

    const hasData = spacecraftPosition.x !== 0 || spacecraftPosition.y !== 0 || spacecraftPosition.z !== 0;
    groupRef.current.visible = hasData;
    groupRef.current.position.set(x, y, z);

    // Orient Orion sprite along velocity direction projected onto camera plane
    if (spriteRef.current && hasData) {
      _vel.set(spacecraftPosition.vx, spacecraftPosition.vy, spacecraftPosition.vz);

      if (_vel.lengthSq() > 0) {
        // Get camera right and up vectors
        _camRight.setFromMatrixColumn(camera.matrixWorld, 0);
        _camUp.setFromMatrixColumn(camera.matrixWorld, 1);

        // Project velocity onto camera's screen plane
        const projX = _vel.dot(_camRight);
        const projY = _vel.dot(_camUp);

        // Rotate sprite so Orion's nose (pointing right in image) aligns with velocity
        spriteRef.current.rotation.z = Math.atan2(projY, projX);
      }
    }
  });

  return (
    <group ref={groupRef}>
      <Billboard>
        <mesh ref={spriteRef}>
          <planeGeometry args={[0.6, 0.5]} />
          <meshBasicMaterial map={texture} transparent toneMapped={false} />
        </mesh>
      </Billboard>
      <Html
        position={[0, 0.5, 0]}
        center
        zIndexRange={[0, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div style={ORION_LABEL_STYLE}>ORION</div>
      </Html>
    </group>
  );
}
