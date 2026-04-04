import { useState } from 'react';
import { useTexture, Billboard, Html } from '@react-three/drei';
import { useMissionStore } from '../store/mission-store';

export default function Earth() {
  const texture = useTexture('/textures/earth-hires.png');
  const moonPosition = useMissionStore((s) => s.moonPosition);
  const [hovered, setHovered] = useState(false);

  const moonDistKm = moonPosition
    ? Math.sqrt(moonPosition.x ** 2 + moonPosition.y ** 2 + moonPosition.z ** 2) * 10000
    : 384400;

  return (
    <group>
      <Billboard>
        <mesh
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
        >
          <circleGeometry args={[1.5, 64]} />
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>
      </Billboard>
      {hovered && (
        <Html position={[1.8, 0, 0]} style={{ pointerEvents: 'none' }}>
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
