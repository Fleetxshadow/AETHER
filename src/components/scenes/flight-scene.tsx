'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { MeshReflectorMaterial } from '@react-three/drei';
import {
  BackSide,
  Color,
  Fog,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PointLight,
  type ShaderMaterial,
} from 'three';
import type { MotionValue } from 'motion/react';

// Illustrative chase-camera flight. No geography, telemetry or aircraft control.
export const flightWorlds = [
  {
    top: '#5b3cff',
    horizon: '#ff8fc6',
    bottom: '#ffd6a8',
    fog: '#f6a3cf',
    ground: '#f1b2d8',
    sun: '#fff1c9',
    accent: '#ff5fae',
  },
  {
    top: '#0d0633',
    horizon: '#ff3d9a',
    bottom: '#2a0d5c',
    fog: '#33105f',
    ground: '#160b30',
    sun: '#ff9f1c',
    accent: '#3df5ff',
  },
  {
    top: '#1c7dff',
    horizon: '#9fe9ff',
    bottom: '#e9fcff',
    fog: '#a8e8ff',
    ground: '#13c3bd',
    sun: '#ffffff',
    accent: '#ffd23d',
  },
] as const;
const mix = (
  key: 'top' | 'horizon' | 'bottom' | 'fog' | 'ground' | 'sun' | 'accent',
  w: number,
  out: Color,
) => {
  const i = Math.max(0, Math.min(1.999, w));
  const a = Math.floor(i);
  return out
    .set(flightWorlds[a][key])
    .lerp(new Color(flightWorlds[a + 1 > 2 ? 2 : a + 1][key]), i - a);
};
const weight = (w: number, i: number) => Math.max(0, 1 - Math.abs(w - i) * 1.4);
const LANE = 140;

function Sky({ world }: { world: MotionValue<number> }) {
  const material = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      top: { value: new Color() },
      horizon: { value: new Color() },
      bottom: { value: new Color() },
    }),
    [],
  );
  useFrame(() => {
    const w = world.get();
    mix('top', w, uniforms.top.value);
    mix('horizon', w, uniforms.horizon.value);
    mix('bottom', w, uniforms.bottom.value);
  });
  return (
    <mesh>
      <sphereGeometry args={[220, 32, 16]} />
      <shaderMaterial
        ref={material}
        side={BackSide}
        depthWrite={false}
        uniforms={uniforms}
        vertexShader="varying vec3 d; void main(){ d = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }"
        fragmentShader="varying vec3 d; uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom;
          void main(){ float y = d.y; vec3 c = y > 0. ? mix(horizon, top, smoothstep(0., .55, y)) : mix(horizon, bottom, smoothstep(0., -.25, y));
          gl_FragColor = vec4(c, 1.);
          #include <colorspace_fragment>
          }"
      />
    </mesh>
  );
}

function Atmosphere({ world }: { world: MotionValue<number> }) {
  const sun = useRef<Mesh>(null);
  useFrame(({ scene }) => {
    const w = world.get();
    if (scene.fog) mix('fog', w, (scene.fog as Fog).color);
    if (sun.current) mix('sun', w, (sun.current.material as MeshStandardMaterial).emissive);
  });
  return (
    <>
      <fog attach="fog" args={['#f6a3cf', 18, 120]} />
      <mesh ref={sun} position={[18, 14, -150]}>
        <circleGeometry args={[11, 48]} />
        <meshStandardMaterial color="#000" emissive="#fff1c9" emissiveIntensity={2.2} fog={false} />
      </mesh>
    </>
  );
}

function Ground({ world, lite }: { world: MotionValue<number>; lite: boolean }) {
  const ref = useRef<Mesh>(null);
  useFrame(() => {
    const m = ref.current?.material as MeshStandardMaterial | undefined;
    if (m) mix('ground', world.get(), m.color);
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, -60]}>
      <planeGeometry args={[400, 400]} />
      {lite ? (
        <meshStandardMaterial color="#f1b2d8" metalness={0.55} roughness={0.28} />
      ) : (
        <MeshReflectorMaterial
          resolution={384}
          mixStrength={1.6}
          mirror={0.85}
          roughness={0.55}
          blur={[400, 120]}
          mixBlur={1}
          depthScale={0.6}
          color="#f1b2d8"
          metalness={0.4}
        />
      )}
    </mesh>
  );
}

// One recycled lane of props per world; scale follows that world's weight.
function Lane({
  world,
  index,
  count,
  speed,
  make,
  geometry,
  color,
  emissive,
}: {
  world: MotionValue<number>;
  index: number;
  count: number;
  speed: MotionValue<number>;
  make: (i: number) => { x: number; y: number; z: number; s: [number, number, number]; r: number };
  geometry: React.ReactNode;
  color: string;
  emissive?: string;
}) {
  const mesh = useRef<InstancedMesh>(null);
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => make(i)), [count, make]);
  const dummy = useMemo(() => new Object3D(), []);
  useFrame((_, delta) => {
    if (!mesh.current) return;
    const k = weight(world.get(), index);
    mesh.current.visible = k > 0.01;
    if (!mesh.current.visible) return;
    const step = Math.min(delta, 0.05) * speed.get();
    seeds.forEach((p, i) => {
      p.z += step;
      if (p.z > 8) p.z -= LANE;
      dummy.position.set(p.x, p.y * (0.4 + 0.6 * k), p.z);
      dummy.rotation.set(0, p.r + p.z * 0.01, 0);
      dummy.scale.set(p.s[0] * k, p.s[1] * k, p.s[2] * k);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
      {geometry}
      <meshStandardMaterial
        color={color}
        emissive={emissive ?? '#000'}
        emissiveIntensity={emissive ? 1.6 : 0}
        roughness={0.35}
        metalness={0.2}
      />
    </instancedMesh>
  );
}
const rand = (i: number, k: number) => {
  const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return v - Math.floor(v);
};
const side = (i: number) => (i % 2 ? 1 : -1);
const crystals = (i: number) => ({
  x: side(i) * (5 + rand(i, 1) * 26),
  y: 1.5 + rand(i, 2) * 7,
  z: -rand(i, 3) * LANE,
  s: [0.8 + rand(i, 4) * 1.6, 1.4 + rand(i, 5) * 2.4, 0.8 + rand(i, 4) * 1.6] as [
    number,
    number,
    number,
  ],
  r: rand(i, 6) * 6,
});
const mesas = (i: number) => ({
  x: side(i) * (30 + rand(i, 1) * 40),
  y: 2,
  z: -rand(i, 3) * LANE,
  s: [8 + rand(i, 4) * 10, 4 + rand(i, 5) * 8, 6 + rand(i, 2) * 8] as [number, number, number],
  r: rand(i, 6),
});
const towers = (i: number) => {
  const h = 4 + rand(i, 2) * 18;
  return {
    x: side(i) * (6 + rand(i, 1) * 18),
    y: h / 2,
    z: -rand(i, 3) * LANE,
    s: [1.6 + rand(i, 4) * 2.6, h, 1.6 + rand(i, 5) * 2.6] as [number, number, number],
    r: 0,
  };
};
const beacons = (i: number) => ({
  x: side(i) * 3.2,
  y: 0.05,
  z: -(i / 60) * LANE,
  s: [0.12, 0.05, 2.4] as [number, number, number],
  r: 0,
});
const gridBars = (i: number) => ({
  x: 0,
  y: 0.02,
  z: -(i / 48) * LANE,
  s: [60, 0.02, 0.12] as [number, number, number],
  r: 0,
});
const cliffs = (i: number) => {
  const h = 6 + rand(i, 2) * 14;
  return {
    x: side(i) * (12 + rand(i, 1) * 30),
    y: h / 2 - 0.5,
    z: -rand(i, 3) * LANE,
    s: [4 + rand(i, 4) * 5, h, 4 + rand(i, 5) * 5] as [number, number, number],
    r: rand(i, 6) * 6,
  };
};
const clouds = (i: number) => ({
  x: (rand(i, 1) - 0.5) * 80,
  y: 9 + rand(i, 2) * 8,
  z: -rand(i, 3) * LANE,
  s: [3 + rand(i, 4) * 4, 1.4 + rand(i, 5) * 1.4, 2.4 + rand(i, 4) * 3] as [number, number, number],
  r: 0,
});

function Drone({ reduced }: { reduced: boolean }) {
  const root = useRef<Group>(null);
  const rotors = useRef<(Group | null)[]>([]);
  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    if (root.current && !reduced) {
      root.current.position.y = 1.2 + Math.sin(t * 1.6) * 0.12;
      root.current.position.x = Math.sin(t * 0.45) * 0.55;
      root.current.rotation.z = -Math.cos(t * 0.45) * 0.16;
      root.current.rotation.x = -0.12 + Math.sin(t * 1.6) * 0.02;
    }
    rotors.current.forEach(
      (r) => r && (r.rotation.y += Math.min(delta, 0.05) * (reduced ? 0 : 40)),
    );
  });
  const arms: [number, number][] = [
    [0.95, 0.75],
    [-0.95, 0.75],
    [0.95, -0.75],
    [-0.95, -0.75],
  ];
  return (
    <group ref={root} position={[0, 1.2, 0]} scale={0.9}>
      <mesh castShadow>
        <boxGeometry args={[1.1, 0.32, 1.5]} />
        <meshStandardMaterial color="#f3efff" roughness={0.22} metalness={0.35} />
      </mesh>
      <mesh position={[0, 0.17, 0]}>
        <boxGeometry args={[0.7, 0.06, 1.1]} />
        <meshStandardMaterial color="#ff4fa3" emissive="#ff4fa3" emissiveIntensity={1.4} />
      </mesh>
      <mesh position={[0, 0, 0.76]}>
        <boxGeometry args={[0.9, 0.08, 0.04]} />
        <meshStandardMaterial color="#ff9f1c" emissive="#ff9f1c" emissiveIntensity={2} />
      </mesh>
      <mesh position={[0, -0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.95, 48]} />
        <meshBasicMaterial color="#3df5ff" transparent opacity={0.55} depthWrite={false} />
      </mesh>
      <mesh position={[0, -0.28, -0.45]}>
        <sphereGeometry args={[0.2, 20, 16]} />
        <meshStandardMaterial color="#0b0b14" roughness={0.1} metalness={0.9} />
      </mesh>
      {arms.map(([x, z], i) => (
        <group key={i}>
          <mesh position={[x / 2, 0, z / 2]} rotation={[0, Math.atan2(x, z), 0]}>
            <boxGeometry args={[0.14, 0.1, Math.hypot(x, z)]} />
            <meshStandardMaterial color="#d9d3f2" metalness={0.4} roughness={0.3} />
          </mesh>
          <mesh position={[x, 0.08, z]}>
            <cylinderGeometry args={[0.14, 0.16, 0.22, 16]} />
            <meshStandardMaterial color="#ff4fa3" metalness={0.5} roughness={0.25} />
          </mesh>
          <group position={[x, 0.22, z]} ref={(g) => void (rotors.current[i] = g)}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.62, 40]} />
              <meshBasicMaterial color="#e8f9ff" transparent opacity={0.28} depthWrite={false} />
            </mesh>
            <mesh>
              <boxGeometry args={[1.2, 0.02, 0.08]} />
              <meshStandardMaterial color="#e9e6ff" />
            </mesh>
          </group>
          <mesh position={[x, -0.05, z + (z > 0 ? 0.12 : -0.12)]}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshBasicMaterial color={z > 0 ? '#ff3d6e' : '#3df5ff'} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Rig({
  world,
  speed,
  reduced,
}: {
  world: MotionValue<number>;
  speed: MotionValue<number>;
  reduced: boolean;
}) {
  const key = useRef<PointLight>(null);
  useFrame(({ camera, clock, size }) => {
    const t = clock.elapsedTime;
    // Portrait screens pull the chase camera back and frame the drone higher,
    // leaving the lower third for the headline.
    const aspect = size.width / Math.max(1, size.height);
    const pull = aspect < 1 ? Math.min(2.1, 1 / aspect) : 1;
    camera.position.set(
      Math.sin(t * 0.3) * (reduced ? 0 : 0.35),
      2.35 + (pull - 1) * 0.9,
      5.4 * pull,
    );
    camera.lookAt(0, aspect < 1 ? -1.9 : 1.05, -6);
    if (key.current) mix('accent', world.get(), key.current.color);
  });
  return (
    <>
      <hemisphereLight args={['#ffffff', '#6b3d8f', 1.4]} />
      <directionalLight position={[6, 10, 4]} intensity={2.2} color="#fff4e8" />
      <pointLight ref={key} position={[0, 2.5, 2]} intensity={6} distance={9} color="#ff5fae" />
      <Lane
        world={world}
        index={0}
        count={36}
        speed={speed}
        make={crystals}
        geometry={<octahedronGeometry args={[1, 0]} />}
        color="#ffb3d9"
        emissive="#ff5fae"
      />
      <Lane
        world={world}
        index={0}
        count={14}
        speed={speed}
        make={mesas}
        geometry={<boxGeometry args={[1, 1, 1]} />}
        color="#e98fb8"
      />
      <Lane
        world={world}
        index={1}
        count={70}
        speed={speed}
        make={towers}
        geometry={<boxGeometry args={[1, 1, 1]} />}
        color="#241452"
        emissive="#7a2cff"
      />
      <Lane
        world={world}
        index={1}
        count={60}
        speed={speed}
        make={beacons}
        geometry={<boxGeometry args={[1, 1, 1]} />}
        color="#3df5ff"
        emissive="#3df5ff"
      />
      <Lane
        world={world}
        index={1}
        count={48}
        speed={speed}
        make={gridBars}
        geometry={<boxGeometry args={[1, 1, 1]} />}
        color="#ff3d9a"
        emissive="#ff3d9a"
      />
      <Lane
        world={world}
        index={2}
        count={34}
        speed={speed}
        make={cliffs}
        geometry={<coneGeometry args={[0.6, 1, 7]} />}
        color="#2fbf71"
      />
      <Lane
        world={world}
        index={2}
        count={26}
        speed={speed}
        make={clouds}
        geometry={<icosahedronGeometry args={[1, 1]} />}
        color="#ffffff"
      />
    </>
  );
}

// On-demand rendering (reduced motion) still repaints when the world changes.
function Invalidate({ world }: { world: MotionValue<number> }) {
  const { invalidate } = useThree();
  useEffect(() => world.on('change', () => invalidate()), [world, invalidate]);
  return null;
}
export default function FlightScene({
  world,
  speed,
  active,
  reduced,
}: {
  world: MotionValue<number>;
  speed: MotionValue<number>;
  active: boolean;
  reduced: boolean;
}) {
  // Software rasterizers (no GPU) get a lighter floor without the reflection pass.
  const [lite, setLite] = useState(false);
  return (
    <Canvas
      className="flight-canvas"
      frameloop={active ? (reduced ? 'demand' : 'always') : 'never'}
      dpr={lite ? 1 : [1, 1.5]}
      onCreated={({ gl }) => {
        const context = gl.getContext();
        const info = context.getExtension('WEBGL_debug_renderer_info');
        const renderer = info ? String(context.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
        if (/swiftshader|llvmpipe|software|basic render/i.test(renderer)) setLite(true);
      }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 52, near: 0.1, far: 400, position: [0, 2.35, 5.4] }}
      aria-hidden="true"
    >
      <Invalidate world={world} />
      <Sky world={world} />
      <Atmosphere world={world} />
      <Ground world={world} lite={lite} />
      <Rig world={world} speed={speed} reduced={reduced} />
      <Drone reduced={reduced} />
    </Canvas>
  );
}
