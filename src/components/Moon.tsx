import { useState, useMemo, useEffect } from 'react';
import { useTexture, Billboard, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useMissionStore } from '../store/mission-store';
import { SCALE_FACTOR } from '../data/mission-config';

/**
 * Creates a circular texture by drawing the source image onto a canvas
 * with a circular clip path. Pixels outside the circle get alpha=0.
 */
function useCircularTexture(path: string): THREE.Texture {
  const source = useTexture(path);
  return useMemo(() => {
    const img = source.image as HTMLImageElement;
    const size = Math.max(img.width, img.height);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    const offsetX = (size - img.width) / 2;
    const offsetY = (size - img.height) / 2;
    ctx.drawImage(img, offsetX, offsetY);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = source.colorSpace;
    tex.needsUpdate = true;
    return tex;
  }, [source]);
}

export default function Moon() {
  const texture = useCircularTexture('/textures/moon-hires.png');
  const oemData = useMissionStore((s) => s.oemData);
  const [hovered, setHovered] = useState(false);

  const flybyPos = useMemo((): [number, number, number] => {
    if (!oemData || oemData.length === 0) return [38.44, 0, 0];

    let maxDistSq = 0;
    let flybyVector = oemData[0];
    for (const v of oemData) {
      const distSq = v.x * v.x + v.y * v.y + v.z * v.z;
      if (distSq > maxDistSq) {
        maxDistSq = distSq;
        flybyVector = v;
      }
    }

    const maxDist = Math.sqrt(maxDistSq);
    const dx = flybyVector.x / maxDist;
    const dy = flybyVector.y / maxDist;
    const dz = flybyVector.z / maxDist;

    const offsetKm = 10637;
    const moonX = (flybyVector.x - dx * offsetKm) / SCALE_FACTOR;
    const moonY = (flybyVector.y - dy * offsetKm) / SCALE_FACTOR;
    const moonZ = (flybyVector.z - dz * offsetKm) / SCALE_FACTOR;

    return [moonX, moonY, moonZ];
  }, [oemData]);

  const earthDistKm = Math.sqrt(flybyPos[0] ** 2 + flybyPos[1] ** 2 + flybyPos[2] ** 2) * SCALE_FACTOR;

  useEffect(() => {
    useMissionStore.getState().setMoonPosition({
      x: flybyPos[0], y: flybyPos[1], z: flybyPos[2],
    });
  }, [flybyPos]);

  return (
    <group position={flybyPos}>
      <Billboard>
        <mesh
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
        >
          <planeGeometry args={[1.5, 1.5]} />
          <meshBasicMaterial map={texture} transparent toneMapped={false} />
        </mesh>
      </Billboard>
      <Html
        position={[0, 1.0, 0]}
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
        <Html position={[1.0, 0, 0]} style={{ pointerEvents: 'none' }}>
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
