import { useRef, useEffect, useState, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useMissionStore } from '../store/mission-store';
import { SCALE_FACTOR } from '../data/mission-config';
import type { StateVector } from '../data/oem-parser';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
}

/**
 * Compute camera position looking down at the trajectory's orbital plane.
 * Finds the plane normal via cross product of two trajectory vectors,
 * then positions camera along that normal for a true top-down plan view.
 */
function computePlanView(oemData: StateVector[], isMobile: boolean) {
  // Bounding box for sizing
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (const v of oemData) {
    const sx = v.x / SCALE_FACTOR, sy = v.y / SCALE_FACTOR, sz = v.z / SCALE_FACTOR;
    if (sx < minX) minX = sx; if (sx > maxX) maxX = sx;
    if (sy < minY) minY = sy; if (sy > maxY) maxY = sy;
    if (sz < minZ) minZ = sz; if (sz > maxZ) maxZ = sz;
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  const range = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
  const dist = range * (isMobile ? 1.3 : 1.0);

  // Find orbital plane normal using cross product of two trajectory vectors
  const i0 = 0;
  const i1 = Math.floor(oemData.length * 0.25);
  const i2 = Math.floor(oemData.length * 0.5);

  const v1 = new THREE.Vector3(
    (oemData[i1].x - oemData[i0].x) / SCALE_FACTOR,
    (oemData[i1].y - oemData[i0].y) / SCALE_FACTOR,
    (oemData[i1].z - oemData[i0].z) / SCALE_FACTOR,
  );
  const v2 = new THREE.Vector3(
    (oemData[i2].x - oemData[i0].x) / SCALE_FACTOR,
    (oemData[i2].y - oemData[i0].y) / SCALE_FACTOR,
    (oemData[i2].z - oemData[i0].z) / SCALE_FACTOR,
  );

  const normal = new THREE.Vector3().crossVectors(v1, v2).normalize();
  // Ensure normal points toward positive Y (conventional "up")
  if (normal.y < 0) normal.negate();

  return {
    camPos: new THREE.Vector3(
      cx + normal.x * dist,
      cy + normal.y * dist,
      cz + normal.z * dist,
    ),
    target: new THREE.Vector3(cx, cy, cz),
  };
}

export default function CameraController() {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();
  const cameraMode = useMissionStore((s) => s.cameraMode);
  const setCameraMode = useMissionStore((s) => s.setCameraMode);
  const isMobile = useIsMobile();
  const hasAutoFit = useRef(false);

  const targetPos = useRef(new THREE.Vector3());
  const targetLookAt = useRef(new THREE.Vector3());

  const onControlStart = useCallback(() => {
    if (cameraMode !== 'free') {
      setCameraMode('free');
    }
  }, [cameraMode, setCameraMode]);

  const applyPlanView = useCallback((oemData: StateVector[]) => {
    const { camPos, target } = computePlanView(oemData, isMobile);
    camera.position.copy(camPos);
    if (controlsRef.current) {
      controlsRef.current.target.copy(target);
    }
  }, [camera, isMobile]);

  // Auto-fit on first load
  useEffect(() => {
    if (hasAutoFit.current) return;
    const oemData = useMissionStore.getState().oemData;
    if (!oemData || oemData.length === 0) return;
    hasAutoFit.current = true;
    applyPlanView(oemData);
  }, [applyPlanView]);

  useEffect(() => {
    const unsub = useMissionStore.subscribe((state) => {
      if (hasAutoFit.current || !state.oemData || state.oemData.length === 0) return;
      hasAutoFit.current = true;
      applyPlanView(state.oemData);
    });
    return unsub;
  }, [applyPlanView]);

  // Camera presets
  useEffect(() => {
    if (cameraMode === 'free') return;

    const oemData = useMissionStore.getState().oemData;
    const sc = useMissionStore.getState().spacecraft;
    const orionPos = new THREE.Vector3(
      sc.x / SCALE_FACTOR,
      sc.y / SCALE_FACTOR,
      sc.z / SCALE_FACTOR,
    );

    switch (cameraMode) {
      case 'follow-orion':
        // Further back so Orion is a small marker, trajectory visible
        targetPos.current.copy(orionPos).add(new THREE.Vector3(5, 8, 20));
        targetLookAt.current.copy(orionPos);
        break;

      case 'earth-view':
        // Top-down plan view
        if (oemData && oemData.length > 0) {
          const { camPos, target } = computePlanView(oemData, isMobile);
          targetPos.current.copy(camPos);
          targetLookAt.current.copy(target);
        }
        break;

      case 'moon-view': {
        // Show Moon with trajectory curving around it
        if (oemData && oemData.length > 0) {
          let maxDist = 0;
          let flyby = oemData[0];
          for (const v of oemData) {
            const d = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
            if (d > maxDist) { maxDist = d; flyby = v; }
          }
          // Moon is offset from flyby point (see Moon.tsx)
          const dir = new THREE.Vector3(flyby.x, flyby.y, flyby.z).normalize();
          const moonPos = new THREE.Vector3(
            (flyby.x + dir.x * 10637) / SCALE_FACTOR,
            (flyby.y + dir.y * 10637) / SCALE_FACTOR,
            (flyby.z + dir.z * 10637) / SCALE_FACTOR,
          );
          // Camera further back to see Moon + trajectory loop
          targetPos.current.copy(moonPos).add(new THREE.Vector3(0, 15, 10));
          targetLookAt.current.copy(moonPos);
        }
        break;
      }
    }
  }, [cameraMode, isMobile]);

  useFrame(() => {
    if (cameraMode === 'free') return;

    if (cameraMode === 'follow-orion') {
      const sc = useMissionStore.getState().spacecraft;
      const orionPos = new THREE.Vector3(sc.x / SCALE_FACTOR, sc.y / SCALE_FACTOR, sc.z / SCALE_FACTOR);
      targetPos.current.copy(orionPos).add(new THREE.Vector3(5, 8, 20));
      targetLookAt.current.copy(orionPos);
    }

    camera.position.lerp(targetPos.current, 0.03);
    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetLookAt.current, 0.03);
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      minDistance={1}
      maxDistance={300}
      touches={{
        ONE: isMobile ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_ROTATE,
      }}
      rotateSpeed={isMobile ? 0.5 : 1}
      panSpeed={isMobile ? 0.5 : 1}
      onStart={onControlStart}
    />
  );
}
