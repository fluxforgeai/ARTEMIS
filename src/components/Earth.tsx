import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useMissionStore } from '../store/mission-store';

export default function Earth() {
  const meshRef = useRef<THREE.Mesh>(null);
  const texture = useTexture('/textures/earth-day.jpg');
  const moonPosition = useMissionStore((s) => s.moonPosition);
  const [hovered, setHovered] = useState(false);

  const moonDistKm = moonPosition
    ? Math.sqrt(moonPosition.x ** 2 + moonPosition.y ** 2 + moonPosition.z ** 2) * 10000
    : 384400;

  useFrame((_state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += (delta / 86400) * Math.PI * 2;
    }
  });

  return (
    <group>
      {/* Earth sphere */}
      <mesh
        ref={meshRef}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[0.637, 64, 64]} />
        <meshStandardMaterial map={texture} emissive="#4488dd" emissiveIntensity={3.5} toneMapped={false} />
      </mesh>
      {/* Atmosphere glow */}
      <mesh scale={1.08}>
        <sphereGeometry args={[0.637, 32, 32]} />
        <meshBasicMaterial color="#77bbff" transparent opacity={0.08} side={THREE.BackSide} />
      </mesh>
      {hovered && (
        <Html position={[1.0, 0, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(10,10,30,0.9)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(0,212,255,0.3)',
            borderRadius: '8px',
            padding: '10px 14px',
            minWidth: '200px',
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            <div style={{ fontSize: '12px', color: '#00d4ff', fontWeight: 'bold', marginBottom: '8px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Earth
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <InfoRow label="Type" value="Rocky Planet" />
              <InfoRow label="Radius" value="6,371 km" />
              <InfoRow label="Mass" value="5.97 × 10²⁴ kg" />
              <InfoRow label="Gravity" value="9.81 m/s²" />
              <InfoRow label="Atmosphere" value="N₂ / O₂" />
              <InfoRow label="Moon Distance" value={`${Math.round(moonDistKm).toLocaleString()} km`} color="#aaaaaa" />
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
