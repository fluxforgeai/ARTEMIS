import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import Stars from './Stars';
import Earth from './Earth';
import Moon from './Moon';
import Trajectory from './Trajectory';
import Spacecraft from './Spacecraft';
import CameraController from './CameraController';
import DataDriver from './DataDriver';
import CameraDebug from './CameraDebug';

export default function Scene() {
  return (
    <Canvas
      camera={{ fov: 45, position: [0, 5, 25], near: 0.1, far: 1000 }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <color attach="background" args={['#050510']} />
      <ambientLight intensity={0.1} />
      <directionalLight position={[100, 0, 0]} intensity={1.5} />

      <DataDriver />
      <CameraController />
      <CameraDebug />
      <Stars />

      <Suspense fallback={null}>
        <Earth />
        <Moon />
      </Suspense>

      <Trajectory />
      <Spacecraft />

      <EffectComposer>
        <Bloom
          mipmapBlur
          luminanceThreshold={1}
          luminanceSmoothing={0.3}
          intensity={1.5}
          radius={0.8}
        />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </Canvas>
  );
}
