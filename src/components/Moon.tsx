import { useState, useMemo, useEffect } from 'react';
import { useTexture, Html } from '@react-three/drei';
import { useMissionStore } from '../store/mission-store';
import { SCALE_FACTOR } from '../data/mission-config';
import { getMoonFlybyPosition } from '../data/moon-ephemeris';

export default function Moon() {
  const texture = useTexture('/textures/moon.jpg');
  const [hovered, setHovered] = useState(false);

  // JPL Horizons ephemeris — the real Moon position, not a geometric approximation
  const flybyPos = useMemo((): [number, number, number] => getMoonFlybyPosition(), []);

  const earthDistKm = Math.sqrt(flybyPos[0] ** 2 + flybyPos[1] ** 2 + flybyPos[2] ** 2) * SCALE_FACTOR;

  useEffect(() => {
    useMissionStore.getState().setMoonPosition({
      x: flybyPos[0], y: flybyPos[1], z: flybyPos[2],
    });
  }, [flybyPos]);

  return (
    <group position={flybyPos}>
      {/* Moon sphere — 0.347 su = 2x real Moon radius (proportional to Earth's 2x) */}
      <mesh
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[0.347, 32, 32]} />
        <meshStandardMaterial map={texture} emissive="#cccccc" emissiveIntensity={1.5} toneMapped={false} />
      </mesh>
      <Html
        position={[0, 0.6, 0]}
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
        }}>MOON</div>
      </Html>
      {hovered && (
        <Html position={[0.7, 0, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(10,10,30,0.9)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(170,170,170,0.3)',
            borderRadius: '8px',
            padding: '10px 14px',
            minWidth: '200px',
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            <div style={{ fontSize: '12px', color: '#aaaaaa', fontWeight: 'bold', marginBottom: '8px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Moon
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <InfoRow label="Type" value="Natural Satellite" />
              <InfoRow label="Radius" value="1,737 km" />
              <InfoRow label="Mass" value="7.35 × 10²² kg" />
              <InfoRow label="Gravity" value="1.62 m/s²" />
              <InfoRow label="Orbital Period" value="27.3 days" />
              <InfoRow label="Earth Distance" value={`${Math.round(earthDistKm).toLocaleString()} km`} color="#00d4ff" />
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
