import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { useMissionStore } from '../store/mission-store';
import { SCALE_FACTOR } from '../data/mission-config';

// Visual radii of celestial bodies in scene units (generous padding)
const EARTH_VISUAL_RADIUS = 2.0; // Earth sprite diameter 3.0 → radius 1.5, +0.5 buffer
const MOON_VISUAL_RADIUS = 1.2;  // Moon sprite diameter 1.5 → radius 0.75, +0.45 buffer

type Point3 = [number, number, number];

function distSq(p: Point3): number {
  return p[0] * p[0] + p[1] * p[1] + p[2] * p[2];
}

function distSqFrom(p: Point3, c: Point3): number {
  const dx = p[0] - c[0], dy = p[1] - c[1], dz = p[2] - c[2];
  return dx * dx + dy * dy + dz * dz;
}

/** Split a point array into segments that are outside the celestial body radii */
function splitAroundBodies(
  points: Point3[],
  moonPos: Point3 | null,
): Point3[][] {
  const earthR2 = EARTH_VISUAL_RADIUS * EARTH_VISUAL_RADIUS;
  const moonR2 = MOON_VISUAL_RADIUS * MOON_VISUAL_RADIUS;

  const segments: Point3[][] = [];
  let current: Point3[] = [];

  for (const p of points) {
    const insideEarth = distSq(p) < earthR2;
    const insideMoon = moonPos ? distSqFrom(p, moonPos) < moonR2 : false;

    if (insideEarth || insideMoon) {
      // Point is inside a body — end current segment
      if (current.length >= 2) {
        segments.push(current);
      }
      current = [];
    } else {
      current.push(p);
    }
  }

  if (current.length >= 2) {
    segments.push(current);
  }

  return segments;
}

export default function Trajectory() {
  const oemData = useMissionStore((s) => s.oemData);
  const moonPosition = useMissionStore((s) => s.moonPosition);

  const { pastSegments, futureSegments } = useMemo(() => {
    if (!oemData || oemData.length === 0) {
      return { pastSegments: [] as Point3[][], futureSegments: [] as Point3[][] };
    }

    const now = Date.now();
    const past: Point3[] = [];
    const future: Point3[] = [];

    for (const v of oemData) {
      const point: Point3 = [
        v.x / SCALE_FACTOR,
        v.y / SCALE_FACTOR,
        v.z / SCALE_FACTOR,
      ];
      if (v.epochMs <= now) {
        past.push(point);
      } else {
        future.push(point);
      }
    }

    // Add current position to future for continuity
    if (past.length > 0 && future.length > 0) {
      future.unshift(past[past.length - 1]);
    }

    const moonPos: Point3 | null = moonPosition
      ? [moonPosition.x, moonPosition.y, moonPosition.z]
      : null;

    return {
      pastSegments: splitAroundBodies(past, moonPos),
      futureSegments: splitAroundBodies(future, moonPos),
    };
  }, [oemData, moonPosition]);

  return (
    <group>
      {pastSegments.map((seg, i) => (
        <Line key={`past-${i}`} points={seg} color="#ff8c00" lineWidth={2} />
      ))}
      {futureSegments.map((seg, i) => (
        <Line
          key={`future-${i}`}
          points={seg}
          color="#00d4ff"
          lineWidth={1}
          dashed
          dashSize={0.5}
          gapSize={0.3}
        />
      ))}
    </group>
  );
}
