'use client';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Line, OrbitControls, PerformanceMonitor, Sparkles } from '@react-three/drei';
import {
  CanvasTexture,
  CatmullRomCurve3,
  DirectionalLight,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  PerspectiveCamera,
  MeshStandardMaterial,
  Object3D,
  SRGBColorSpace,
  Vector3,
} from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useTheme } from '../theme-provider';
import { cityBackground, themes, type ThemeId } from '@/lib/themes';
import { useReducedMotion } from '@/lib/motion';
import { buildings, type CityBuilding } from '@/lib/city';
import { severityColor, visibleObservations, metricsAt } from '@/lib/data';
import { useNexus, type CameraPreset } from '@/lib/store';
import type { Layer } from '@/lib/modules';
import { CityFallback, WebGLGate } from './scene-boundary';
import { LabelProjector, type ProjectedPoint } from './label-projector';
import { AwakeningEffects } from './awakening-effects';
import { CinematicEnvironment } from './cinematic-environment';

const presets: Record<Exclude<CameraPreset, 'selected'>, [number, number, number]> = {
  overview: [38, 31, 43],
  central: [15, 21, 20],
  riverfront: [-31, 18, 26],
  park: [-28, 16, -9],
};
const filmCamera = new CatmullRomCurve3([
  new Vector3(64, 49, 68),
  new Vector3(43, 28, 50),
  new Vector3(27, 15, 34),
  new Vector3(12, 8, 27),
  new Vector3(7, 21, 35),
  new Vector3(24, 30, 42),
  new Vector3(...presets.overview),
]);
const filmTarget = new CatmullRomCurve3([
  new Vector3(0, 4, 0),
  new Vector3(0, 3, 0),
  new Vector3(4, 2, 3.2),
  new Vector3(5, 1, 3.2),
  new Vector3(5, 1, 3.2),
  new Vector3(0, 2, 0),
  new Vector3(0, 2, 0),
]);
function CameraDirector({
  hero,
  intro,
  storyProgress,
  awakening,
  storyChapter,
}: {
  hero: boolean;
  intro: boolean;
  storyProgress?: RefObject<number>;
  awakening?: RefObject<number>;
  storyChapter?: number;
}) {
  const controls = useRef<OrbitControlsImpl>(null);
  const introduced = useRef(false);
  const observations = useNexus((s) => s.records);
  const preset = useNexus((s) => s.camera);
  const id = useNexus((s) => s.selectedId);
  const reduced = useReducedMotion();
  const motionEnabled = useNexus((s) => s.motion);
  const { camera, invalidate, size, get } = useThree();
  const target = useRef(new Vector3(0, 2, 0));
  const destination = useRef(new Vector3(...presets.overview));
  const tourPath = useMemo(
    () =>
      [
        [38, 31, 43],
        [23, 21, 30],
        [13, 30, 26],
        [7, 19, 30],
        [0, 63, 0.1],
      ].map((p) => new Vector3(p[0], p[1], p[2])),
    [],
  );
  const traveling = useRef(false);
  const previousProgress = useRef(-1);
  useEffect(() => {
    if (!intro) introduced.current = false;
    if (hero && intro && !introduced.current && !reduced && motionEnabled) {
      camera.position.set(66, 47, 74);
      introduced.current = true;
    }
    const observation = observations.find((o) => o.id === id);
    let position =
      preset === 'selected' && observation
        ? [observation.position[0] + 12, 17, observation.position[1] + 18]
        : presets[preset === 'selected' ? 'overview' : preset];
    if (storyChapter !== undefined && preset === 'overview' && !id) {
      const view = tourPath[storyChapter];
      position = [view.x, view.y, view.z];
    }
    const heroOverview = hero && preset === 'overview';
    const framing = heroOverview && size.width > 700 ? 0.91 : 1;
    destination.current.set(position[0] * framing, position[1] * framing, position[2] * framing);
    const sceneCamera = get().camera;
    if (hero && sceneCamera instanceof PerspectiveCamera) {
      sceneCamera.fov = size.width < 600 ? 44 : size.width < 900 ? 38 : 34;
      sceneCamera.updateProjectionMatrix();
    }
    target.current.set(
      preset === 'selected' && observation
        ? observation.position[0]
        : preset === 'riverfront'
          ? -13
          : preset === 'park'
            ? -15
            : 0,
      2,
      preset === 'selected' && observation ? observation.position[1] : 0,
    );
    if (
      storyChapter !== undefined &&
      storyChapter > 0 &&
      storyChapter < 4 &&
      preset === 'overview' &&
      !id
    )
      target.current.set(5, 1, 3.2);
    traveling.current = true;
    invalidate();
  }, [
    preset,
    id,
    invalidate,
    observations,
    hero,
    intro,
    reduced,
    motionEnabled,
    camera,
    get,
    size.width,
    storyChapter,
    tourPath,
  ]);
  useFrame((_, delta) => {
    const time = awakening?.current ?? -1;
    if (intro && time >= 0 && !reduced && controls.current) {
      const progress = Math.min(1, time / 7);
      filmCamera.getPoint(progress, camera.position);
      camera.position.multiplyScalar(size.width > 700 ? 0.91 : 1);
      filmTarget.getPoint(progress, controls.current.target);
      destination.current.copy(camera.position);
      target.current.copy(controls.current.target);
      controls.current.update();
      invalidate();
      return;
    }
    if (
      storyProgress &&
      preset === 'overview' &&
      !id &&
      !reduced &&
      motionEnabled &&
      Math.abs(storyProgress.current - previousProgress.current) > 0.002
    ) {
      previousProgress.current = storyProgress.current;
      const position = Math.min(3.999, Math.max(0, storyProgress.current * 4));
      const segment = Math.floor(position);
      destination.current.lerpVectors(tourPath[segment], tourPath[segment + 1], position - segment);
      const focus = Math.sin(storyProgress.current * Math.PI);
      target.current.set(5 * focus, 2, 3.2 * focus);
      traveling.current = true;
    }
    if (!traveling.current || !controls.current) return;
    const alpha = reduced || !motionEnabled ? 1 : 1 - Math.exp(-delta * 3);
    camera.position.lerp(destination.current, alpha);
    controls.current.target.lerp(target.current, alpha);
    controls.current.update();
    if (camera.position.distanceTo(destination.current) < 0.02) traveling.current = false;
    else invalidate();
  });
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enabled={!intro}
      enablePan={!hero}
      enableZoom={!hero}
      minDistance={8}
      maxDistance={90}
      maxPolarAngle={Math.PI / 2.15}
      minPolarAngle={0.15}
      enableDamping={!intro && !reduced}
      dampingFactor={0.06}
      onStart={() => {
        traveling.current = false;
      }}
    />
  );
}
function makeMaterials(day: boolean) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = day ? '#737f7e' : '#3a4243';
  ctx.fillRect(0, 0, 128, 256);
  for (let row = 0; row < 24; row++)
    for (let col = 0; col < 8; col++) {
      const lit = Math.sin(row * 67 + col * 43) > 0.4;
      ctx.fillStyle = lit ? (day ? '#bcc3b3' : '#c2b899') : day ? '#445251' : '#212a2b';
      ctx.fillRect(col * 16 + 4, row * 10 + 3, 7, 5);
      ctx.fillStyle = '#596462';
      ctx.fillRect(col * 16 + 3, row * 10 + 2, 9, 1);
    }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const walls = new MeshStandardMaterial({
    map: texture,
    emissiveMap: texture,
    emissive: new Color('#e4cda4'),
    emissiveIntensity: day ? 0.02 : 0.32,
    roughness: 0.63,
    metalness: 0.28,
  });
  const roof = new MeshStandardMaterial({
    color: day ? '#a0a59d' : '#515b59',
    roughness: 0.8,
    metalness: 0.24,
  });
  return { walls, roof, texture, array: [walls, walls, roof, roof, walls, walls] };
}
function CityBuildings({ layer }: { layer: Layer }) {
  const day = useNexus((s) => s.day);
  const setBuilding = useNexus((s) => s.selectBuilding);
  const body = useRef<InstancedMesh>(null);
  const roofs = useRef<InstancedMesh>(null);
  const terraces = useRef<InstancedMesh>(null);
  const [hover, setHover] = useState<CityBuilding | null>(null);
  const material = useMemo(() => makeMaterials(day), [day]);
  const step = useNexus((s) => s.timeStep);
  useEffect(
    () => () => {
      material.walls.dispose();
      material.roof.dispose();
      material.texture.dispose();
    },
    [material],
  );
  useEffect(() => {
    const object = new Object3D();
    buildings.forEach((b, i) => {
      object.position.set(b.x, b.h / 2 + 0.18, b.z);
      object.scale.set(b.w, b.h, b.d);
      object.updateMatrix();
      body.current?.setMatrixAt(i, object.matrix);
      const color =
        layer === 'thermal'
          ? new Color().setHSL(
              0.15 - Math.min((b.h + metricsAt(step).temperature / 4) / 150, 0.14),
              0.4,
              0.6,
            )
          : layer === 'water' && b.x < -5
            ? new Color('#86b6b4')
            : new Color(day ? '#d4d6cc' : '#b7c2b8');
      body.current?.setColorAt(i, color);
      object.position.set(b.x + b.w * 0.16, b.h + 0.5, b.z);
      object.scale.set(b.w * 0.35, 0.6, b.d * 0.35);
      object.updateMatrix();
      roofs.current?.setMatrixAt(i, object.matrix);
      object.position.set(b.x, b.h + (b.style === 0 ? b.h * 0.12 : 0.18), b.z);
      object.scale.set(b.w * 0.74, b.style === 0 ? b.h * 0.24 : 0.24, b.d * 0.72);
      object.updateMatrix();
      terraces.current?.setMatrixAt(i, object.matrix);
    });
    [body, roofs, terraces].forEach((ref) => {
      if (ref.current) {
        ref.current.instanceMatrix.needsUpdate = true;
        if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
      }
    });
  }, [layer, day, step]);
  const onHover = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    if (event.instanceId !== undefined) setHover(buildings[event.instanceId]);
  };
  return (
    <group>
      <instancedMesh
        ref={body}
        args={[undefined, material.array, buildings.length]}
        onPointerMove={onHover}
        onPointerOut={() => setHover(null)}
        onClick={(event) => {
          event.stopPropagation();
          if (event.instanceId !== undefined) setBuilding(buildings[event.instanceId].name);
        }}
      >
        <boxGeometry />
      </instancedMesh>
      <instancedMesh ref={terraces} args={[undefined, material.array, buildings.length]}>
        <boxGeometry />
      </instancedMesh>
      <instancedMesh ref={roofs} args={[undefined, undefined, buildings.length]}>
        <boxGeometry />
        <meshStandardMaterial color="#555d59" roughness={0.7} metalness={0.5} />
      </instancedMesh>
      {hover && (
        <group position={[hover.x, hover.h / 2 + 0.2, hover.z]}>
          <mesh>
            <boxGeometry args={[hover.w + 0.05, hover.h + 0.05, hover.d + 0.05]} />
            <meshBasicMaterial color="#ffb347" wireframe transparent opacity={0.8} />
          </mesh>
        </group>
      )}
    </group>
  );
}
function Roads({ layer }: { layer: Layer }) {
  const coordinates = [-9.6, 3.2, 16];
  return (
    <group>
      {coordinates.flatMap((v, i) => [
        <group key={`x${i}`} position={[v, 0.075, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[2.1, 44]} />
            <meshStandardMaterial color="#262d2c" roughness={1} />
          </mesh>
          <Line
            points={[
              [0, 0.015, -22],
              [0, 0.015, 22],
            ]}
            color={layer === 'traffic' ? '#d8ed86' : '#737364'}
            lineWidth={layer === 'traffic' ? 2 : 0.6}
            dashed
            dashScale={1}
            dashSize={0.3}
            gapSize={0.35}
          />
        </group>,
        <group key={`z${i}`} position={[0, 0.075, v]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[44, 2.1]} />
            <meshStandardMaterial color="#262d2c" roughness={1} />
          </mesh>
          <Line
            points={[
              [-22, 0.015, 0],
              [22, 0.015, 0],
            ]}
            color={layer === 'traffic' ? '#ffb347' : '#737364'}
            lineWidth={layer === 'traffic' ? 2 : 0.6}
            dashed
            dashSize={0.3}
            gapSize={0.35}
          />
        </group>,
      ])}
      <mesh position={[0, -0.08, 0]}>
        <boxGeometry args={[46, 0.2, 46]} />
        <meshStandardMaterial color="#343c36" roughness={1} />
      </mesh>
      <gridHelper args={[46, 46, '#3c473e', '#3c473e']} position={[0, 0.031, 0]} />
    </group>
  );
}
const treePositions = Array.from(
  { length: 65 },
  (_, i) => [-18 + Math.sin(i * 23) * 3.3, -6 + (i % 13) * 1.1] as const,
);
const lampPositions = [-9.6, 3.2, 16].flatMap((v) =>
  [-19, -13, -6, 0, 7, 13, 20].flatMap((t) => [
    [v + 1.35, t],
    [t, v + 1.35],
  ]),
);
function StreetLights() {
  const poles = useRef<InstancedMesh>(null);
  const lamps = useRef<InstancedMesh>(null);
  const day = useNexus((s) => s.day);
  useEffect(() => {
    const object = new Object3D();
    lampPositions.forEach(([x, z], i) => {
      object.position.set(x, 0.9, z);
      object.scale.set(0.055, 1.6, 0.055);
      object.updateMatrix();
      poles.current?.setMatrixAt(i, object.matrix);
      object.position.set(x, 1.75, z);
      object.scale.set(0.15, 0.08, 0.15);
      object.updateMatrix();
      lamps.current?.setMatrixAt(i, object.matrix);
    });
    if (poles.current) poles.current.instanceMatrix.needsUpdate = true;
    if (lamps.current) lamps.current.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <group>
      <instancedMesh ref={poles} args={[undefined, undefined, lampPositions.length]}>
        <cylinderGeometry args={[1, 1, 1, 6]} />
        <meshStandardMaterial color="#667169" metalness={0.6} roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={lamps} args={[undefined, undefined, lampPositions.length]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color={day ? '#c0c7af' : '#ffdfa0'} />
      </instancedMesh>
    </group>
  );
}
function Park() {
  const trunks = useRef<InstancedMesh>(null);
  const crowns = useRef<InstancedMesh>(null);
  useEffect(() => {
    const matrix = new Matrix4();
    treePositions.forEach(([x, z], i) => {
      matrix.makeScale(0.1, 0.55, 0.1);
      matrix.setPosition(x, 0.42, z);
      trunks.current?.setMatrixAt(i, matrix);
      matrix.makeScale(0.38 + (i % 3) * 0.12, 0.6 + (i % 4) * 0.1, 0.4);
      matrix.setPosition(x, 1, z);
      crowns.current?.setMatrixAt(i, matrix);
    });
    if (trunks.current) trunks.current.instanceMatrix.needsUpdate = true;
    if (crowns.current) crowns.current.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <group>
      <mesh position={[-17, 0.065, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[9, 18]} />
        <meshStandardMaterial color="#364b37" />
      </mesh>
      <instancedMesh ref={trunks} args={[undefined, undefined, 65]}>
        <cylinderGeometry args={[1, 1, 1, 5]} />
        <meshStandardMaterial color="#615b46" />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, undefined, 65]}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#63734e" roughness={1} />
      </instancedMesh>
    </group>
  );
}
const networkPoints: [number, number, number][] = [
  [-7, 4, 2],
  [2, 14, 3],
  [11, 9, 12],
  [13, 4, -4],
  [-5, 6, 13],
  [-14, 2, -7],
  [-15, 3, 7],
];
function DataPackets({ paths }: { paths: [number, number, number][][] }) {
  const ref = useRef<InstancedMesh>(null);
  const enabled = useNexus((s) => s.motion);
  const reduced = useReducedMotion();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const object = new Object3D();
    for (let i = 0; i < paths.length * 3; i++) {
      const path = paths[i % paths.length];
      const progress = (i / 3 + (enabled && !reduced ? clock.elapsedTime * 0.12 : 0)) % 1;
      const sample = progress * (path.length - 1);
      const index = Math.floor(sample);
      const next = Math.min(index + 1, path.length - 1);
      const part = sample - index;
      object.position.set(...path[index]);
      object.position.lerp(new Vector3(...path[next]), part);
      object.scale.setScalar(0.07);
      object.updateMatrix();
      ref.current.setMatrixAt(i, object.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, paths.length * 3]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color="#ffe5a7" />
    </instancedMesh>
  );
}
function Network({ layer }: { layer: Layer }) {
  const links = useMemo(
    () =>
      networkPoints.slice(1).map((p, i) => {
        const start = new Vector3(...networkPoints[0]);
        const end = new Vector3(...p);
        const path: [number, number, number][] = [];
        for (let t = 0; t <= 1.01; t += 0.04) {
          const v = start.clone().lerp(end, t);
          v.y += Math.sin(t * Math.PI) * (5 + i);
          path.push([v.x, v.y, v.z]);
        }
        return path;
      }),
    [],
  ); // Deterministic geometry, independent of application state.
  if (layer !== 'network') return null;
  return (
    <group>
      <DataPackets paths={links} />
      {links.map((path, i) => (
        <Line
          key={i}
          points={path}
          color={i % 3 === 0 ? '#d8ed86' : '#ffb347'}
          transparent
          opacity={0.42}
          lineWidth={0.85}
        />
      ))}
      {networkPoints.map((p, i) => (
        <mesh position={p} key={i}>
          <sphereGeometry args={[0.18, 8, 8]} />
          <meshBasicMaterial color="#ffc46a" />
        </mesh>
      ))}
    </group>
  );
}
function Traffic({ active }: { active: boolean }) {
  const ref = useRef<InstancedMesh>(null);
  const reduced = useReducedMotion();
  const enabled = useNexus((s) => s.motion);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const object = new Object3D();
    const t = reduced || !enabled ? 0 : clock.elapsedTime;
    for (let i = 0; i < 36; i++) {
      const progress = ((i * 3.8 + t * (active ? 1.8 : 0.65)) % 42) - 21;
      object.position.set(
        i < 18 ? progress : [-9.1, 3.7, 16.5][i % 3],
        0.21,
        i < 18 ? [-9.1, 3.7, 16.5][i % 3] : progress,
      );
      object.scale.set(i < 18 ? 0.6 : 0.28, 0.19, i < 18 ? 0.28 : 0.6);
      object.updateMatrix();
      ref.current.setMatrixAt(i, object.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, 36]}>
      <boxGeometry />
      <meshStandardMaterial
        color={active ? '#d8ed86' : '#d5c1a1'}
        emissive={active ? '#d8ed86' : '#b19570'}
        emissiveIntensity={0.6}
      />
    </instancedMesh>
  );
}
function Markers() {
  const observations = useNexus((s) => s.records);
  const step = useNexus((s) => s.timeStep);
  return (
    <>
      {visibleObservations(observations, step)
        .filter((o) => o.severity !== 'normal')
        .map((o) => (
          <group key={o.id} position={[o.position[0], 0.2, o.position[1]]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.65, 0.72, 40]} />
              <meshBasicMaterial
                color={severityColor[o.severity]}
                side={DoubleSide}
                transparent
                opacity={0.7}
              />
            </mesh>
            <Line
              points={[
                [0, 0, 0],
                [0, 6, 0],
              ]}
              color={severityColor[o.severity]}
              transparent
              opacity={0.45}
            />
          </group>
        ))}
    </>
  );
}
function FieldLighting({ theme, awakening }: { theme: ThemeId; awakening?: RefObject<number> }) {
  const day = useNexus((s) => s.day);
  const layer = useNexus((s) => s.layer);
  const reduced = useReducedMotion();
  const rim = useRef<DirectionalLight>(null);
  const desired = useRef(new Color('#d8a862'));
  const moving = useRef(false);
  const { invalidate } = useThree();
  useEffect(() => {
    desired.current.set(
      theme !== 'original'
        ? themes[theme].scene.rim
        : layer === 'water'
          ? '#94d8e0'
          : layer === 'thermal'
            ? '#ff944d'
            : layer === 'traffic'
              ? '#d8ed86'
              : '#d8a862',
    );
    moving.current = true;
    invalidate();
  }, [day, layer, invalidate, theme]);
  useFrame((_, delta) => {
    if (rim.current && awakening && awakening.current >= 0 && !reduced) {
      const time = awakening.current;
      rim.current.color.set(
        time >= 3.7 && time < 5 ? '#e6b774' : time >= 6.7 ? desired.current : '#69e3d1',
      );
      rim.current.intensity = time < 3.7 ? 3.2 : 2.8;
      moving.current = true;
      return;
    }
    if (!rim.current || !moving.current) return;
    const amount = reduced ? 1 : 1 - Math.exp(-delta * 3);
    rim.current.color.lerp(desired.current, amount);
    const target = day ? 1.6 : 2.8;
    rim.current.intensity += (target - rim.current.intensity) * amount;
    if (
      rim.current.color
        .clone()
        .sub(desired.current)
        .toArray()
        .every((v) => Math.abs(v) < 0.002)
    )
      moving.current = false;
    else invalidate();
  });
  return (
    <>
      <ambientLight intensity={day ? 1.5 : 0.68} />
      <hemisphereLight
        args={
          theme === 'nova' || theme === 'prism'
            ? ['#9fb2ff', '#170f2e', day ? 1.8 : 1.25]
            : ['#d5e2d1', '#2b271e', day ? 1.8 : 1.15]
        }
      />
      <directionalLight
        position={[15, 35, -15]}
        color={theme === 'nova' || theme === 'prism' ? '#dfe9ff' : '#fff0d0'}
        intensity={day ? 3 : 2}
      />
      <directionalLight ref={rim} position={[-25, 12, 20]} color="#d8a862" intensity={2.8} />
    </>
  );
}
// Drifting ion motes above the illustrative city: atmosphere only, never data.
function IonMotes() {
  const reduced = useReducedMotion();
  return (
    <group position={[0, 9, 0]}>
      <Sparkles
        count={140}
        scale={[70, 22, 70]}
        size={16}
        speed={reduced ? 0 : 0.35}
        opacity={0.7}
        color="#7cf0ff"
      />
      <Sparkles
        count={60}
        scale={[60, 26, 60]}
        size={22}
        speed={reduced ? 0 : 0.2}
        opacity={0.5}
        color="#b9a4ff"
      />
    </group>
  );
}
function CityWorld({
  hero,
  intro,
  labels,
  points,
  storyProgress,
  theme,
  awakening,
  storyChapter,
}: {
  hero: boolean;
  intro: boolean;
  labels: RefObject<HTMLDivElement | null>;
  points: ProjectedPoint[];
  storyProgress?: RefObject<number>;
  theme: ThemeId;
  awakening?: RefObject<number>;
  storyChapter?: number;
}) {
  const group = useRef<Group>(null);
  const reduced = useReducedMotion();
  const motionEnabled = useNexus((s) => s.motion);
  const layer = useNexus((s) => s.layer);
  const day = useNexus((s) => s.day);
  const start = useRef(0);
  const { invalidate } = useThree();
  useEffect(() => {
    start.current = 0;
    invalidate();
  }, [intro, invalidate]);
  useFrame((_, delta) => {
    if (!group.current) return;
    start.current += delta;
    const time = awakening?.current ?? -1;
    const scale =
      intro && time >= 0 && !reduced
        ? 1
        : intro && !reduced && motionEnabled
          ? Math.min(1, 0.1 + start.current / 1.4)
          : 1;
    group.current.scale.y = scale;
    if (scale < 1) invalidate();
  });
  return (
    <>
      {!hero && <color attach="background" args={[cityBackground(theme, day)]} />}
      <fog attach="fog" args={[cityBackground(theme, day), 58, 115]} />
      <FieldLighting theme={theme} awakening={awakening} />
      {(hero || storyChapter !== undefined) && <CinematicEnvironment />}
      {hero && (theme === 'nova' || theme === 'prism') && <IonMotes />}
      <group ref={group}>
        <Roads layer={layer} />
        <Park />
        <StreetLights />
        <CityBuildings layer={layer} />
        <Network layer={layer} />
        <Traffic active={layer === 'traffic'} />
        <Markers />
        {(awakening || storyChapter !== undefined) && (
          <AwakeningEffects awakening={awakening} chapter={storyChapter} />
        )}
        <mesh position={[2, 0.16, -17]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[10, 2.2]} />
          <meshStandardMaterial
            color={layer === 'water' ? '#a2ccd0' : '#435b5c'}
            metalness={0.35}
            roughness={0.2}
          />
        </mesh>
        <group position={[0, 0.2, 0]}>
          <mesh position={[0, 8.5, 0]}>
            <cylinderGeometry args={[1.1, 1.5, 17, 12]} />
            <meshStandardMaterial color="#7a8580" metalness={0.55} roughness={0.3} />
          </mesh>
          <mesh position={[0, 17.2, 0]}>
            <cylinderGeometry args={[0.8, 1.1, 1.2, 12]} />
            <meshStandardMaterial color="#b9bda8" metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh position={[0, 19.2, 0]}>
            <cylinderGeometry args={[0.03, 0.1, 3, 8]} />
            <meshBasicMaterial color="#ffb347" />
          </mesh>
        </group>
      </group>
      <CameraDirector
        hero={hero}
        intro={intro}
        storyProgress={storyProgress}
        awakening={awakening}
        storyChapter={storyChapter}
      />
      <LabelProjector container={labels} points={points} />
    </>
  );
}
function RendererReady({ onReady }: { onReady: (available: boolean) => void }) {
  const frames = useRef(0),
    sent = useRef(false),
    pending = useRef(0);
  useFrame(() => {
    if (sent.current || ++frames.current < 2) return;
    sent.current = true;
    pending.current = requestAnimationFrame(() => onReady(true));
  });
  useEffect(() => () => cancelAnimationFrame(pending.current), []);
  return null;
}
function UnavailableCity({
  onReady,
  hero,
}: {
  onReady?: (available: boolean) => void;
  hero: boolean;
}) {
  const quality = useNexus((s) => s.quality);
  useEffect(() => {
    onReady?.(false);
  }, [onReady]);
  return (
    <CityFallback
      poster={hero}
      label={
        quality === 'off'
          ? '3D disabled · simplified city plan'
          : 'WebGL unavailable · simplified city plan'
      }
    />
  );
}
export default function CityScene({
  hero = false,
  intro = false,
  paused = false,
  storyProgress,
  awakening,
  storyChapter,
  onReady,
}: {
  hero?: boolean;
  intro?: boolean;
  paused?: boolean;
  storyProgress?: RefObject<number>;
  awakening?: RefObject<number>;
  storyChapter?: number;
  onReady?: (available: boolean) => void;
}) {
  const quality = useNexus((s) => s.quality);
  const { theme } = useTheme();
  const enabled = useNexus((s) => s.motion);
  const reduced = useReducedMotion();
  const labels = useRef<HTMLDivElement>(null);
  const records = useNexus((s) => s.records);
  const step = useNexus((s) => s.timeStep);
  const selected = useNexus((s) => s.selectedId);
  const select = useNexus((s) => s.select);
  const visibleRecords = visibleObservations(records, step).filter((o) => o.severity !== 'normal');
  const points: ProjectedPoint[] = [
    ...visibleRecords.map((o) => ({
      id: o.id,
      position: [o.position[0], 6.3, o.position[1]] as [number, number, number],
    })),
    { id: 'central', position: [0, 21, 0] },
  ];
  const root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [budgetReduced, setBudgetReduced] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => setVisible(entries[0].isIntersecting), {
      rootMargin: '100px',
    });
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={root}
      className={`city-scene ${hero ? 'hero-scene' : ''} ${intro ? 'genesis-scene' : ''}`}
      role="group"
      aria-label="Interactive conceptual city. Drag to orbit. Use camera controls for accessible navigation."
    >
      <WebGLGate fallback={<UnavailableCity onReady={onReady} hero={hero} />}>
        <Canvas
          camera={{ position: presets.overview, fov: hero ? 38 : 42 }}
          dpr={budgetReduced ? 0.85 : quality === 'high' ? [1, 1.7] : 1}
          gl={{ antialias: quality !== 'low', powerPreference: 'low-power', alpha: hero }}
          frameloop={
            !visible || paused
              ? 'never'
              : reduced || !enabled || quality === 'low'
                ? 'demand'
                : 'always'
          }
          onCreated={({ gl }) => {
            gl.toneMappingExposure = 1.3;
            if (hero) gl.setClearColor(0x000000, 0);
          }}
        >
          <PerformanceMonitor
            bounds={() => [28, 55]}
            onDecline={() => setBudgetReduced(true)}
            flipflops={1}
            onFallback={() => setBudgetReduced(true)}
          />
          <CityWorld
            theme={theme}
            hero={hero}
            intro={intro}
            labels={labels}
            points={points}
            storyProgress={storyProgress}
            awakening={awakening}
            storyChapter={storyChapter}
          />
          {onReady && <RendererReady onReady={onReady} />}
        </Canvas>
        <div className="scene-overlays" ref={labels}>
          {visibleRecords.map((o) => (
            <div key={o.id} className="projected-label" data-point={o.id}>
              <button
                className={`scene-marker ${selected === o.id ? 'selected' : ''}`}
                aria-label={`Select ${o.title}`}
                title={`${o.title} / ${o.severity}`}
                aria-pressed={selected === o.id}
                onClick={(event) => {
                  event.currentTarget.focus({ preventScroll: true });
                  select(o.id);
                }}
              >
                <i style={{ background: severityColor[o.severity] }} />
                <span className="marker-copy">
                  {selected === o.id ? o.title : o.id.replace('NX-', '')}
                </span>
              </button>
            </div>
          ))}
          <div className="projected-label" data-point="central">
            <span className="landmark-label">
              <i />
              AETHER CENTRAL
            </span>
          </div>
        </div>
      </WebGLGate>
    </div>
  );
}
