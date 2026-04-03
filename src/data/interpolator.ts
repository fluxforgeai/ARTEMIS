import type { StateVector } from './oem-parser';

const COMPONENTS = ['x', 'y', 'z', 'vx', 'vy', 'vz'] as const;

// Reusable buffer for times array (avoids per-frame allocation)
let _timesBuffer: number[] = [];

/**
 * Lagrange polynomial interpolation for spacecraft state vectors.
 * Uses degree-8 interpolation (9 points) as specified by OEM metadata.
 * Accepts epochMs directly to avoid Date object allocation in hot path.
 */
export function lagrangeInterpolate(
  vectors: StateVector[],
  targetEpochMs: number,
  degree: number = 8,
): { x: number; y: number; z: number; vx: number; vy: number; vz: number } | null {
  if (vectors.length === 0) return null;

  const t = targetEpochMs;

  // Clamp to data range
  const firstEpoch = vectors[0].epochMs;
  const lastEpoch = vectors[vectors.length - 1].epochMs;
  if (t < firstEpoch || t > lastEpoch) {
    const nearest = t < firstEpoch ? vectors[0] : vectors[vectors.length - 1];
    return { x: nearest.x, y: nearest.y, z: nearest.z, vx: nearest.vx, vy: nearest.vy, vz: nearest.vz };
  }

  // Binary search for closest data point (O(log n) instead of O(n))
  let lo = 0, hi = vectors.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (vectors[mid].epochMs < t) lo = mid + 1;
    else hi = mid;
  }
  const closestIdx = (lo > 0 && Math.abs(vectors[lo - 1].epochMs - t) <= Math.abs(vectors[lo].epochMs - t))
    ? lo - 1 : lo;

  // Select window of (degree+1) points centered on closest — no slice allocation
  const numPoints = Math.min(degree + 1, vectors.length);
  let startIdx = closestIdx - Math.floor(numPoints / 2);
  startIdx = Math.max(0, Math.min(startIdx, vectors.length - numPoints));

  // Extract times once (same for all 6 components)
  if (_timesBuffer.length !== numPoints) {
    _timesBuffer = new Array(numPoints);
  }
  for (let i = 0; i < numPoints; i++) {
    _timesBuffer[i] = vectors[startIdx + i].epochMs;
  }

  // Interpolate each component — read directly from vectors, no .map()
  const result = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 };
  for (const comp of COMPONENTS) {
    result[comp] = lagrangeBasisDirect(vectors, startIdx, numPoints, _timesBuffer, comp, t);
  }

  return result;
}

/**
 * Evaluate Lagrange interpolating polynomial directly from vectors array.
 * Avoids creating intermediate value arrays.
 */
function lagrangeBasisDirect(
  vectors: StateVector[],
  startIdx: number,
  count: number,
  times: number[],
  component: typeof COMPONENTS[number],
  t: number,
): number {
  let result = 0;

  for (let i = 0; i < count; i++) {
    let basis = 1;
    for (let j = 0; j < count; j++) {
      if (j !== i) {
        basis *= (t - times[j]) / (times[i] - times[j]);
      }
    }
    result += vectors[startIdx + i][component] * basis;
  }

  return result;
}
