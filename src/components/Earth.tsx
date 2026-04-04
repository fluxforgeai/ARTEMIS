import { useTexture, Billboard } from '@react-three/drei';

export default function Earth() {
  const texture = useTexture('/textures/earth-hires.png');

  return (
    <group>
      {/* Earth billboard sprite */}
      <Billboard>
        <mesh>
          <planeGeometry args={[3.0, 3.0]} />
          <meshBasicMaterial map={texture} transparent toneMapped={false} />
        </mesh>
      </Billboard>
    </group>
  );
}
