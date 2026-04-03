import { describe, it, expect } from 'vitest';
import { lagrangeInterpolate } from '../src/data/interpolator';
import type { StateVector } from '../src/data/oem-parser';

function makeVectors(): StateVector[] {
  const base = new Date('2026-04-01T22:35:00.000Z').getTime();
  const interval = 4 * 60 * 1000; // 4 minutes

  return [
    { epoch: new Date(base + 0 * interval), epochMs: base + 0 * interval, x: 6578.137, y: 0, z: 0, vx: 0, vy: 7.784, vz: 0 },
    { epoch: new Date(base + 1 * interval), epochMs: base + 1 * interval, x: 6500, y: 1800, z: 50, vx: -0.5, vy: 7.7, vz: 0.1 },
    { epoch: new Date(base + 2 * interval), epochMs: base + 2 * interval, x: 6300, y: 3500, z: 100, vx: -1.0, vy: 7.5, vz: 0.2 },
    { epoch: new Date(base + 3 * interval), epochMs: base + 3 * interval, x: 5980, y: 5100, z: 150, vx: -1.5, vy: 7.2, vz: 0.3 },
    { epoch: new Date(base + 4 * interval), epochMs: base + 4 * interval, x: 5540, y: 6500, z: 200, vx: -2.0, vy: 6.8, vz: 0.4 },
    { epoch: new Date(base + 5 * interval), epochMs: base + 5 * interval, x: 4990, y: 7700, z: 250, vx: -2.5, vy: 6.3, vz: 0.5 },
    { epoch: new Date(base + 6 * interval), epochMs: base + 6 * interval, x: 4340, y: 8700, z: 300, vx: -3.0, vy: 5.7, vz: 0.6 },
    { epoch: new Date(base + 7 * interval), epochMs: base + 7 * interval, x: 3600, y: 9500, z: 350, vx: -3.4, vy: 5.0, vz: 0.7 },
    { epoch: new Date(base + 8 * interval), epochMs: base + 8 * interval, x: 2780, y: 10100, z: 400, vx: -3.8, vy: 4.2, vz: 0.8 },
    { epoch: new Date(base + 9 * interval), epochMs: base + 9 * interval, x: 1900, y: 10500, z: 450, vx: -4.1, vy: 3.3, vz: 0.9 },
  ];
}

describe('Lagrange Interpolator', () => {
  const vectors = makeVectors();

  it('returns exact values at data points', () => {
    for (const v of vectors) {
      const result = lagrangeInterpolate(vectors, v.epochMs);
      expect(result).not.toBeNull();
      expect(result!.x).toBeCloseTo(v.x, 0);
      expect(result!.y).toBeCloseTo(v.y, 0);
      expect(result!.z).toBeCloseTo(v.z, 0);
      expect(result!.vx).toBeCloseTo(v.vx, 2);
      expect(result!.vy).toBeCloseTo(v.vy, 2);
      expect(result!.vz).toBeCloseTo(v.vz, 2);
    }
  });

  it('interpolates between data points', () => {
    const midpointMs = vectors[2].epochMs + 2 * 60 * 1000; // 2 min after point 2
    const result = lagrangeInterpolate(vectors, midpointMs);
    expect(result).not.toBeNull();
    // Should be between vectors[2] and vectors[3]
    expect(result!.x).toBeGreaterThan(Math.min(vectors[2].x, vectors[3].x) - 200);
    expect(result!.x).toBeLessThan(Math.max(vectors[2].x, vectors[3].x) + 200);
  });

  it('handles single data point', () => {
    const single = [vectors[0]];
    const result = lagrangeInterpolate(single, vectors[0].epochMs, 0);
    expect(result).not.toBeNull();
    expect(result!.x).toBeCloseTo(vectors[0].x, 3);
  });

  it('clamps to range boundaries', () => {
    const beforeStartMs = vectors[0].epochMs - 60000;
    const result = lagrangeInterpolate(vectors, beforeStartMs);
    expect(result).not.toBeNull();
    expect(result!.x).toBeCloseTo(vectors[0].x, 3);
  });

  it('returns null for empty vectors', () => {
    const result = lagrangeInterpolate([], Date.now());
    expect(result).toBeNull();
  });

  it('handles reduced degree at boundaries', () => {
    const small = vectors.slice(0, 3); // Only 3 points
    const result = lagrangeInterpolate(small, small[1].epochMs, 8);
    expect(result).not.toBeNull();
    expect(result!.x).toBeCloseTo(small[1].x, 0);
  });
});
