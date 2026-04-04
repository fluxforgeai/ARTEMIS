import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture, Billboard, Html } from '@react-three/drei';
import * as THREE from 'three';
import { spacecraftPosition } from './DataDriver';
import { SCALE_FACTOR } from '../data/mission-config';
import { useMissionStore } from '../store/mission-store';
import { useMission } from '../hooks/useMission';

const ORION_LABEL_STYLE = {
  color: '#00ff88',
  fontSize: '11px',
  fontFamily: 'monospace',
  fontWeight: 'bold' as const,
  textShadow: '0 0 8px rgba(0,255,136,0.5)',
  whiteSpace: 'nowrap' as const,
};

const _vel = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _camUp = new THREE.Vector3();

export default function Spacecraft() {
  const groupRef = useRef<THREE.Group>(null);
  const spriteRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const texture = useTexture('/textures/orion.png');
  const [hovered, setHovered] = useState(false);

  // Read telemetry from store for hover card
  const speed = useMissionStore((s) => s.spacecraft.speed);
  const earthDist = useMissionStore((s) => s.spacecraft.earthDist);
  const moonDist = useMissionStore((s) => s.spacecraft.moonDist);
  const { currentPhase } = useMission();

  // Apply brightness-based discard shader to remove dark background
  useEffect(() => {
    if (matRef.current) {
      matRef.current.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <map_fragment>',
          `#include <map_fragment>
           float brightness = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
           if (brightness < 0.06) discard;`
        );
      };
      matRef.current.needsUpdate = true;
    }
  }, []);

  useFrame(({ camera }) => {
    if (!groupRef.current) return;

    const x = spacecraftPosition.x / SCALE_FACTOR;
    const y = spacecraftPosition.y / SCALE_FACTOR;
    const z = spacecraftPosition.z / SCALE_FACTOR;

    const hasData = spacecraftPosition.x !== 0 || spacecraftPosition.y !== 0 || spacecraftPosition.z !== 0;
    groupRef.current.visible = hasData;
    groupRef.current.position.set(x, y, z);

    if (spriteRef.current && hasData) {
      _vel.set(spacecraftPosition.vx, spacecraftPosition.vy, spacecraftPosition.vz);
      if (_vel.lengthSq() > 0) {
        _camRight.setFromMatrixColumn(camera.matrixWorld, 0);
        _camUp.setFromMatrixColumn(camera.matrixWorld, 1);
        const projX = _vel.dot(_camRight);
        const projY = _vel.dot(_camUp);
        spriteRef.current.rotation.z = Math.atan2(projY, projX);
      }
    }
  });

  return (
    <group ref={groupRef}>
      <Billboard>
        <mesh
          ref={spriteRef}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
        >
          <planeGeometry args={[0.8, 0.65]} />
          <meshBasicMaterial ref={matRef} map={texture} transparent toneMapped={false} />
        </mesh>
      </Billboard>
      <Html
        position={[0, 0.6, 0]}
        center
        zIndexRange={[0, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div style={ORION_LABEL_STYLE}>ORION</div>
      </Html>
      {hovered && (
        <Html position={[0.8, 0, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(10,10,30,0.9)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(0,255,136,0.3)',
            borderRadius: '8px',
            padding: '10px 14px',
            minWidth: '200px',
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            <div style={{ fontSize: '12px', color: '#00ff88', fontWeight: 'bold', marginBottom: '8px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Orion MPCV
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <InfoRow label="Phase" value={currentPhase} color="#00d4ff" />
              <InfoRow label="Speed" value={`${Math.round(speed).toLocaleString()} km/h`} color="#ff8c00" />
              <InfoRow label="Earth Dist" value={`${Math.round(earthDist).toLocaleString()} km`} color="#00d4ff" />
              <InfoRow label="Moon Dist" value={moonDist ? `${Math.round(moonDist).toLocaleString()} km` : 'N/A'} color="#aaaaaa" />
              <InfoRow label="Crew" value="4 astronauts" />
              <InfoRow label="Mass" value="26,520 kg" />
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

function InfoRow({ label, value, color = '#ffffff' }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
      <span style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ fontSize: '11px', color, fontWeight: 'bold' }}>{value}</span>
    </div>
  );
}
