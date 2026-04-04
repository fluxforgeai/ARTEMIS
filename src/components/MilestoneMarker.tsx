import { useMemo } from 'react';
import { Html } from '@react-three/drei';
import { useMissionStore } from '../store/mission-store';
import { LAUNCH_EPOCH, SCALE_FACTOR, MILESTONES } from '../data/mission-config';
import { lagrangeInterpolate } from '../data/interpolator';

const LABEL_STYLE = {
  color: '#00d4ff',
  fontSize: '10px',
  fontFamily: 'monospace',
  fontWeight: 'bold' as const,
  textShadow: '0 0 8px rgba(0,212,255,0.6)',
  whiteSpace: 'nowrap' as const,
  background: 'rgba(10,10,30,0.8)',
  padding: '2px 6px',
  borderRadius: '4px',
  border: '1px solid rgba(0,212,255,0.3)',
};

export default function MilestoneMarker() {
  const hoveredHours = useMissionStore((s) => s.hoveredMilestoneHours);
  const oemData = useMissionStore((s) => s.oemData);

  const marker = useMemo(() => {
    if (hoveredHours === null || !oemData || oemData.length === 0) return null;

    const targetEpochMs = LAUNCH_EPOCH.getTime() + hoveredHours * 3_600_000;
    const state = lagrangeInterpolate(oemData, targetEpochMs);
    if (!state) return null;

    const milestone = MILESTONES.find((m) => m.missionElapsedHours === hoveredHours);

    return {
      position: [
        state.x / SCALE_FACTOR,
        state.y / SCALE_FACTOR,
        state.z / SCALE_FACTOR,
      ] as [number, number, number],
      name: milestone?.name ?? '',
    };
  }, [hoveredHours, oemData]);

  if (!marker) return null;

  return (
    <group position={marker.position}>
      {/* Glowing ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.45, 32]} />
        <meshBasicMaterial color="#00d4ff" transparent opacity={0.7} toneMapped={false} />
      </mesh>
      {/* Inner dot */}
      <mesh>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial color="#00d4ff" toneMapped={false} />
      </mesh>
      {/* Label */}
      <Html
        position={[0, 0.7, 0]}
        center
        zIndexRange={[0, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div style={LABEL_STYLE}>{marker.name}</div>
      </Html>
    </group>
  );
}
