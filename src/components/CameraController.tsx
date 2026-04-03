import { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useMissionStore } from '../store/mission-store';
import { SCALE_FACTOR } from '../data/mission-config';

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

export default function CameraController() {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();
  const cameraMode = useMissionStore((s) => s.cameraMode);
  const isMobile = useIsMobile();
  const hasAutoFit = useRef(false);

  const targetPos = useRef(new THREE.Vector3());
  const targetLookAt = useRef(new THREE.Vector3());

  // Auto-fit camera to show full trajectory on first load
  useEffect(() => {
    if (hasAutoFit.current) return;
    const oemData = useMissionStore.getState().oemData;
    if (!oemData || oemData.length === 0) return;
    hasAutoFit.current = true;

    // Find bounding box of trajectory
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
    const dist = range * (isMobile ? 1.2 : 0.9);

    camera.position.set(cx, cy + dist * 0.3, cz + dist);
    if (controlsRef.current) {
      controlsRef.current.target.set(cx, cy, cz);
    }
  }, [camera, isMobile]);

  // Subscribe to store changes for auto-fit trigger
  useEffect(() => {
    const unsub = useMissionStore.subscribe((state) => {
      if (hasAutoFit.current || !state.oemData || state.oemData.length === 0) return;
      hasAutoFit.current = true;

      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;
      for (const v of state.oemData) {
        const sx = v.x / SCALE_FACTOR, sy = v.y / SCALE_FACTOR, sz = v.z / SCALE_FACTOR;
        if (sx < minX) minX = sx; if (sx > maxX) maxX = sx;
        if (sy < minY) minY = sy; if (sy > maxY) maxY = sy;
        if (sz < minZ) minZ = sz; if (sz > maxZ) maxZ = sz;
      }
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const cz = (minZ + maxZ) / 2;
      const range = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
      const dist = range * (isMobile ? 1.2 : 0.9);
      camera.position.set(cx, cy + dist * 0.3, cz + dist);
      if (controlsRef.current) {
        controlsRef.current.target.set(cx, cy, cz);
      }
    });
    return unsub;
  }, [camera, isMobile]);

  useEffect(() => {
    if (cameraMode === 'free') return;

    const sc = useMissionStore.getState().spacecraft;
    const orionPos = new THREE.Vector3(
      sc.x / SCALE_FACTOR,
      sc.y / SCALE_FACTOR,
      sc.z / SCALE_FACTOR,
    );

    switch (cameraMode) {
      case 'follow-orion':
        targetPos.current.copy(orionPos).add(new THREE.Vector3(2, 2, 5));
        targetLookAt.current.copy(orionPos);
        break;
      case 'earth-view':
        targetPos.current.set(0, 2, 5);
        targetLookAt.current.copy(orionPos);
        break;
      case 'moon-view': {
        const moon = useMissionStore.getState().moonPosition;
        if (moon) {
          targetPos.current.set(
            moon.x / SCALE_FACTOR + 2,
            moon.y / SCALE_FACTOR + 2,
            moon.z / SCALE_FACTOR + 5,
          );
        }
        targetLookAt.current.set(0, 0, 0);
        break;
      }
    }
  }, [cameraMode]);

  useFrame(() => {
    if (cameraMode === 'free') return;

    // Continuously track Orion for follow modes
    if (cameraMode === 'follow-orion' || cameraMode === 'earth-view') {
      const sc = useMissionStore.getState().spacecraft;
      const orionPos = new THREE.Vector3(sc.x / SCALE_FACTOR, sc.y / SCALE_FACTOR, sc.z / SCALE_FACTOR);
      if (cameraMode === 'follow-orion') {
        targetPos.current.copy(orionPos).add(new THREE.Vector3(2, 2, 5));
      }
      targetLookAt.current.copy(orionPos);
    }

    camera.position.lerp(targetPos.current, 0.02);
    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetLookAt.current, 0.02);
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      minDistance={1}
      maxDistance={200}
      // Mobile: require two fingers to rotate, one finger pans
      touches={{
        ONE: isMobile ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_ROTATE,
      }}
      // Prevent touch events from being too sensitive on mobile
      rotateSpeed={isMobile ? 0.5 : 1}
      panSpeed={isMobile ? 0.5 : 1}
    />
  );
}
