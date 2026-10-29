'use client';
import { useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { Group, Mesh, MeshBasicMaterial } from 'three';
import { useReducedMotion } from '@/lib/motion';

// Fictional presentation geometry. Never used as geographic or operational data.
export function AwakeningEffects({
  awakening,
  chapter,
}: {
  awakening?: RefObject<number>;
  chapter?: number;
}) {
  const root = useRef<Group>(null),
    incident = useRef<Group>(null),
    aerial = useRef<Group>(null),
    area = useRef<Group>(null),
    water = useRef<Group>(null),
    obstruction = useRef<Group>(null),
    queue = useRef<Group>(null);
  const route = useRef<MeshBasicMaterial>(null),
    ripple = useRef<Mesh>(null),
    ringMaterial = useRef<MeshBasicMaterial>(null),
    scan = useRef<Mesh>(null),
    cursor = useRef<Mesh>(null),
    waterMaterial = useRef<MeshBasicMaterial>(null);
  const reduced = useReducedMotion();
  useFrame(({ clock }, delta) => {
    if (!root.current || !incident.current || !aerial.current || !area.current) return;
    const time = awakening?.current ?? -1;
    const opening = time >= 0;
    root.current.visible = !opening || time >= 2.2;
    const anomalous = opening ? time >= 3.7 && time < 6.7 : chapter !== undefined && chapter >= 1;
    incident.current.visible = anomalous;
    aerial.current.visible = opening
      ? time >= 5 && time < 6.7
      : chapter !== undefined && chapter >= 1;
    area.current.visible = !opening && chapter === 4;
    route.current?.color.set(
      opening
        ? anomalous
          ? '#e6b774'
          : '#35d3bc'
        : ['#35d3bc', '#e6b774', '#60c8e2', '#f29b68', '#35d3bc'][chapter ?? 0],
    );
    if (water.current && waterMaterial.current) {
      const target = !opening && chapter === 2 ? 0.68 : !opening && chapter === 4 ? 0.25 : 0;
      waterMaterial.current.opacity +=
        (target - waterMaterial.current.opacity) * (reduced ? 1 : 1 - Math.exp(-delta * 5));
      water.current.visible = waterMaterial.current.opacity > 0.01;
    }
    if (obstruction.current)
      obstruction.current.visible = !opening && (chapter === 3 || chapter === 4);
    if (queue.current)
      queue.current.visible = anomalous && (opening || chapter === 1 || chapter === 4);
    if (cursor.current) {
      const progress = opening ? Math.min(1, Math.max(0, (time - 1.5) / 4.6)) : (chapter ?? 0) / 4;
      cursor.current.position.set(-17 + progress * 34, 0.42, 3.2);
    }
    if (ripple.current && ringMaterial.current) {
      const part = reduced ? 0.5 : opening ? Math.min(1, Math.max(0, (time - 3.7) / 1.3)) : 0.5;
      ripple.current.scale.setScalar(0.3 + part * 3);
      ringMaterial.current.opacity = reduced || !opening ? 0.25 : (1 - part) * 0.7;
    }
    if (scan.current)
      scan.current.position.y = reduced
        ? 3
        : opening
          ? 12 - Math.min(1, Math.max(0, (time - 5) / 1.1)) * 11
          : 5 + Math.sin(clock.elapsedTime * 0.6) * 1.2;
  });
  return (
    <group ref={root}>
      <mesh position={[0, 0.21, 3.2]}>
        <boxGeometry args={[34, 0.035, 0.08]} />
        <meshBasicMaterial ref={route} color="#35d3bc" transparent opacity={0.85} />
      </mesh>
      <mesh ref={cursor} position={[-17, 0.42, 3.2]}>
        <sphereGeometry args={[0.2, 12, 10]} />
        <meshBasicMaterial color="#d5fff2" />
      </mesh>
      {[-17, 17].map((x) => (
        <mesh key={x} position={[x, 0.25, 3.2]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.32, 0.4, 28]} />
          <meshBasicMaterial color="#69e3d1" />
        </mesh>
      ))}
      <group ref={queue}>
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} position={[-7 + i * 1.3, 0.35, 3.65]}>
            <boxGeometry args={[0.8, 0.35, 0.4]} />
            <meshStandardMaterial
              color={i % 2 ? '#d8c9ac' : '#d99c58'}
              metalness={0.4}
              roughness={0.4}
            />
          </mesh>
        ))}
      </group>
      <group ref={water}>
        <mesh position={[5, 0.27, 3.2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[12, 3.8]} />
          <meshBasicMaterial
            ref={waterMaterial}
            color="#43b9d3"
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
        {[1, 2, 3].map((r) => (
          <mesh
            key={r}
            position={[5, 0.29, 3.2]}
            rotation={[-Math.PI / 2, 0, 0]}
            scale={[1, 0.42, 1]}
          >
            <ringGeometry args={[r, r + 0.035, 40]} />
            <meshBasicMaterial color="#b4ecef" transparent opacity={0.4} depthWrite={false} />
          </mesh>
        ))}
      </group>
      <group ref={obstruction} position={[5, 0, 3.2]}>
        {[-0.7, 0.7].map((z) => (
          <mesh key={z} position={[0, 0.55, z]}>
            <boxGeometry args={[0.16, 1, 0.12]} />
            <meshStandardMaterial color="#b4c1b4" />
          </mesh>
        ))}
        <mesh position={[0, 0.7, 0]}>
          <boxGeometry args={[0.2, 0.3, 1.8]} />
          <meshStandardMaterial color="#ed9862" emissive="#8d481a" emissiveIntensity={0.25} />
        </mesh>
        {[-0.5, 0, 0.5].map((z) => (
          <mesh key={z} position={[0.11, 0.7, z]} rotation={[0.3, 0, 0]}>
            <boxGeometry args={[0.015, 0.31, 0.16]} />
            <meshBasicMaterial color="#17272a" />
          </mesh>
        ))}
      </group>
      <group ref={incident}>
        <mesh position={[5, 0.22, 3.2]}>
          <boxGeometry args={[9, 0.04, 0.7]} />
          <meshBasicMaterial color="#e6b774" transparent opacity={0.55} />
        </mesh>
        <mesh ref={ripple} position={[5, 0.24, 3.2]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.97, 1, 40]} />
          <meshBasicMaterial
            ref={ringMaterial}
            color="#e6b774"
            transparent
            opacity={0.5}
            depthWrite={false}
          />
        </mesh>
      </group>
      <group ref={aerial} position={[5, 0, 3.2]}>
        <mesh position={[0, 13, 0]}>
          <octahedronGeometry args={[0.38]} />
          <meshBasicMaterial color="#69e3d1" />
        </mesh>
        <mesh position={[0, 6.65, 0]}>
          <coneGeometry args={[4.3, 12.7, 24, 1, true]} />
          <meshBasicMaterial
            color="#35d3bc"
            transparent
            opacity={0.09}
            depthWrite={false}
            side={2}
          />
        </mesh>
        <mesh ref={scan} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.4, 2.45, 40]} />
          <meshBasicMaterial color="#69e3d1" transparent opacity={0.6} depthWrite={false} />
        </mesh>
        <Line
          points={[
            [0, 13, 0],
            [-5, 19, -3.2],
          ]}
          color="#69e3d1"
          lineWidth={1}
          dashed
          dashSize={0.45}
          gapSize={0.3}
        />
      </group>
      <group ref={area}>
        <mesh position={[5, 0.26, 5]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[13, 8]} />
          <meshBasicMaterial color="#35d3bc" transparent opacity={0.12} depthWrite={false} />
        </mesh>
        <Line
          points={[
            [-1.5, 0.28, 1],
            [11.5, 0.28, 1],
            [11.5, 0.28, 9],
            [-1.5, 0.28, 9],
            [-1.5, 0.28, 1],
          ]}
          color="#69e3d1"
          lineWidth={1}
          dashed
          dashSize={0.35}
          gapSize={0.3}
        />
      </group>
    </group>
  );
}
