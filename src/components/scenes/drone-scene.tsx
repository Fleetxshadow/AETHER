'use client';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, RoundedBox } from '@react-three/drei';
import {
  CanvasTexture,
  Group,
  Vector3,
  SRGBColorSpace,
  MathUtils,
  PerspectiveCamera,
  PMREMGenerator,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useReducedMotion } from '@/lib/motion';
import { useNexus } from '@/lib/store';
import { WebGLGate } from './scene-boundary';
import { droneParts, type DronePart } from '@/lib/drone';
import { LabelProjector } from './label-projector';
import { useTheme } from '../theme-provider';
import { themes } from '@/lib/themes';
import type { MotionValue } from 'motion/react';

function StudioReflections() {
  const { gl, get, invalidate } = useThree();
  const quality = useNexus((s) => s.quality);
  useEffect(() => {
    if (quality === 'low') return;
    const generator = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const environment = generator.fromScene(room, 0.04);
    const scene = get().scene;
    const previous = scene.environment;
    scene.environment = environment.texture;
    room.dispose();
    generator.dispose();
    invalidate();
    return () => {
      scene.environment = previous;
      environment.dispose();
    };
  }, [gl, get, invalidate, quality]);
  return null;
}

function StudioCamera({
  exploded,
  selected,
  reset,
  sequence,
  onManual,
}: {
  exploded: boolean;
  selected: DronePart;
  reset: number;
  sequence?: MotionValue<number>;
  onManual?: () => void;
}) {
  const controls = useRef<OrbitControlsImpl>(null);
  const reduced = useReducedMotion();
  const { camera, size, invalidate } = useThree();
  const destination = useRef(new Vector3());
  const target = useRef(new Vector3());
  const moving = useRef(false);
  const framing = useRef(20);
  const previousSequence = useRef(-1);
  useEffect(() => {
    previousSequence.current = -1;
    invalidate();
    return sequence?.on('change', () => invalidate());
  }, [sequence, invalidate]);
  useEffect(() => {
    const view = camera as PerspectiveCamera;
    const halfVertical = MathUtils.degToRad(view.fov / 2);
    const halfHorizontal = Math.atan((Math.tan(halfVertical) * size.width) / size.height);
    const radius = exploded
      ? 6.3
      : selected === 'airframe' || selected === 'controller'
        ? 3.8
        : selected === 'camera'
          ? 3.3
          : 4.1;
    const distance = (radius / Math.sin(Math.min(halfVertical, halfHorizontal))) * 1.08;
    framing.current = distance;
    const direction =
      selected === 'camera'
        ? new Vector3(0.35, 0.18, 1)
        : selected === 'battery' || selected === 'controller'
          ? new Vector3(0.55, 0.8, 0.75)
          : new Vector3(0.65, 0.5, 0.8);
    target.current.set(0, exploded ? 0.2 : selected === 'camera' ? -0.35 : 0.1, 0);
    destination.current.copy(direction.normalize().multiplyScalar(distance)).add(target.current);
    moving.current = true;
    invalidate();
  }, [camera, size.width, size.height, exploded, selected, reset, invalidate]);
  useFrame((_, delta) => {
    if (sequence && Math.abs(sequence.get() - previousSequence.current) > 0.001) {
      previousSequence.current = sequence.get();
      const angle = -0.8 + sequence.get() * 2.1;
      const elevation = 0.35 + Math.sin(sequence.get() * Math.PI) * 0.3;
      destination.current
        .set(Math.sin(angle), elevation, Math.cos(angle))
        .normalize()
        .multiplyScalar(framing.current);
      target.current.set(0, 0, 0);
      moving.current = true;
    }
    if (!moving.current || !controls.current) return;
    const alpha = reduced ? 1 : 1 - Math.exp(-delta * 4);
    camera.position.lerp(destination.current, alpha);
    controls.current.target.lerp(target.current, alpha);
    controls.current.update();
    if (camera.position.distanceTo(destination.current) < 0.01) moving.current = false;
    else invalidate();
  });
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      minDistance={7}
      maxDistance={48}
      maxPolarAngle={Math.PI * 0.75}
      enableDamping
      onStart={() => {
        moving.current = false;
        onManual?.();
      }}
    />
  );
}
function Assembly({
  exploded,
  selected,
  onPart,
  labels,
}: {
  exploded: boolean;
  selected: DronePart;
  onPart: (part: DronePart) => void;
  labels: RefObject<HTMLDivElement | null>;
}) {
  const group = useRef<Group>(null);
  const battery = useRef<Group>(null);
  const controller = useRef<Group>(null);
  const camera = useRef<Group>(null);
  const arms = useRef<(Group | null)[]>([]);
  const reduced = useReducedMotion();
  const enabled = useNexus((s) => s.motion);
  const { invalidate } = useThree();
  const stamp = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#29362e';
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = '#bec6ae';
    ctx.font = '28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('AETHER / X1', 128, 72);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }, []);
  useEffect(() => () => stamp.dispose(), [stamp]);
  useEffect(() => {
    invalidate();
  }, [exploded, invalidate]);
  const [hover, setHover] = useState<DronePart | null>(null);
  const separationAge = useRef(0);
  useEffect(() => {
    separationAge.current = 0;
  }, [exploded]);
  useFrame((state, delta) => {
    let moving = false;
    separationAge.current += delta;
    const blend = (delay: number) =>
      reduced || !enabled ? 1 : separationAge.current < delay ? 0 : 1 - Math.exp(-delta * 5);
    if (battery.current && Math.abs((exploded ? 2.4 : 0.4) - battery.current.position.y) > 0.001) {
      moving = true;
      battery.current.position.y +=
        ((exploded ? 2.4 : 0.4) - battery.current.position.y) * blend(exploded ? 0 : 0.24);
    }
    if (
      controller.current &&
      Math.abs((exploded ? 1.3 : 0.03) - controller.current.position.y) > 0.001
    ) {
      moving = true;
      controller.current.position.y +=
        ((exploded ? 1.3 : 0.03) - controller.current.position.y) * blend(exploded ? 0.1 : 0.15);
    }
    if (camera.current && Math.abs((exploded ? -2 : -0.78) - camera.current.position.y) > 0.001) {
      moving = true;
      camera.current.position.y +=
        ((exploded ? -2 : -0.78) - camera.current.position.y) * blend(exploded ? 0.18 : 0.05);
    }
    arms.current.forEach((arm, i) => {
      if (!arm) return;
      const angle = Math.PI / 4 + (i * Math.PI) / 2;
      const distance = exploded ? 1.2 : 0;
      const target = new Vector3(
        Math.sin(angle) * distance,
        exploded ? 0.6 : 0,
        Math.cos(angle) * distance,
      );
      if (arm.position.distanceTo(target) > 0.001) {
        moving = true;
        arm.position.lerp(target, blend(exploded ? 0.24 + i * 0.06 : i * 0.05));
      }
    });

    if (moving) state.invalidate();
  });
  const active = (part: DronePart) => hover === part || selected === part;
  const handlers = (part: DronePart) => ({
    onPointerOver: () => setHover(part),
    onPointerOut: () => setHover(null),
    onClick: () => onPart(part),
  });
  return (
    <group ref={group} rotation={[0.05, -0.3, 0]}>
      <group {...handlers('airframe')}>
        <RoundedBox args={[1.65, 0.46, 2.05]} radius={0.2} smoothness={4}>
          <meshStandardMaterial
            color={active('airframe') ? '#d5b476' : '#38443c'}
            transparent={selected === 'controller'}
            opacity={selected === 'controller' ? 0.2 : 1}
            emissive={active('airframe') ? '#ffb347' : '#000000'}
            emissiveIntensity={active('airframe') ? 0.38 : 0}
            metalness={0.7}
            roughness={0.35}
          />
        </RoundedBox>
        <RoundedBox args={[1.35, 0.07, 1.75]} position={[0, -0.24, 0]} radius={0.1}>
          <meshStandardMaterial
            color="#121818"
            transparent={selected === 'controller'}
            opacity={selected === 'controller' ? 0.2 : 1}
            roughness={0.3}
            metalness={0.8}
          />
        </RoundedBox>
        <mesh position={[0, 0.03, -1.03]}>
          <boxGeometry args={[0.42, 0.08, 0.03]} />
          <meshBasicMaterial color="#ffb347" />
        </mesh>
      </group>
      {[0, 1, 2, 3].map((i) => {
        const angle = Math.PI / 4 + (i * Math.PI) / 2;
        return (
          <group
            key={i}
            ref={(node) => {
              arms.current[i] = node;
            }}
            {...handlers('propulsion')}
          >
            <group rotation={[0, angle, 0]}>
              <RoundedBox args={[0.2, 0.17, 2.35]} position={[0, 0, 1.68]} radius={0.06}>
                <meshStandardMaterial
                  color={active('propulsion') ? '#d5b476' : '#38443c'}
                  emissive={active('propulsion') ? '#ffb347' : '#000000'}
                  emissiveIntensity={active('propulsion') ? 0.38 : 0}
                  metalness={0.7}
                  roughness={0.4}
                />
              </RoundedBox>
              <group position={[0, 0.06, 2.65]}>
                <mesh>
                  <cylinderGeometry args={[0.28, 0.25, 0.4, 24]} />
                  <meshStandardMaterial color="#5a6462" metalness={0.9} roughness={0.25} />
                </mesh>
                <mesh position={[0, 0.18, 0]}>
                  <torusGeometry args={[0.25, 0.035, 8, 24]} />
                  <meshStandardMaterial color="#bdad80" metalness={0.8} roughness={0.3} />
                </mesh>
                <group position={[0, 0.31, 0]} rotation={[0, i * 0.8, 0]}>
                  {[0, Math.PI].map((r, j) => (
                    <RoundedBox
                      key={j}
                      args={[0.27, 0.045, 1.6]}
                      radius={0.1}
                      rotation={[0.04, r, -0.02]}
                      position={[0, 0, j === 0 ? 0.74 : -0.74]}
                    >
                      <meshStandardMaterial
                        color={active('propulsion') ? '#af925e' : '#202828'}
                        emissive={active('propulsion') ? '#ffb347' : '#000000'}
                        emissiveIntensity={0.2}
                        metalness={0.5}
                        roughness={0.32}
                      />
                    </RoundedBox>
                  ))}
                  <mesh>
                    <sphereGeometry args={[0.15, 16, 12]} />
                    <meshStandardMaterial color="#9ca69d" metalness={0.9} roughness={0.2} />
                  </mesh>
                </group>
              </group>
            </group>
          </group>
        );
      })}
      <group ref={battery} position={[0, 0.4, 0]} {...handlers('battery')}>
        <RoundedBox args={[0.95, 0.4, 1.48]} radius={0.12}>
          <meshStandardMaterial
            color={active('battery') ? '#d5b476' : '#38443c'}
            transparent={selected === 'controller'}
            opacity={selected === 'controller' ? 0.2 : 1}
            emissive={active('battery') ? '#ffb347' : '#000000'}
            emissiveIntensity={active('battery') ? 0.38 : 0}
            metalness={0.5}
            roughness={0.45}
          />
        </RoundedBox>
        <mesh position={[0, 0.21, 0]}>
          <boxGeometry args={[0.72, 0.014, 0.75]} />
          <meshStandardMaterial color="#232d2b" />
        </mesh>
        <mesh position={[0, 0.216, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.72, 0.55]} />
          <meshStandardMaterial map={stamp} roughness={0.5} />
        </mesh>
      </group>
      <group ref={controller} {...handlers('controller')}>
        <RoundedBox args={[1.2, 0.08, 1.35]} radius={0.03}>
          <meshStandardMaterial
            color={active('controller') ? '#d5b476' : '#38443c'}
            emissive={active('controller') ? '#ffb347' : '#000000'}
            emissiveIntensity={active('controller') ? 0.38 : 0}
            metalness={0.35}
            roughness={0.55}
          />
        </RoundedBox>
        <mesh position={[0, 0.07, 0]}>
          <boxGeometry args={[0.43, 0.12, 0.43]} />
          <meshStandardMaterial color="#737c73" metalness={0.8} />
        </mesh>
        {[-0.44, 0.44].map((x) => (
          <mesh position={[x, 0.08, 0.2]} key={x}>
            <boxGeometry args={[0.13, 0.12, 0.6]} />
            <meshStandardMaterial color="#d0b980" metalness={0.6} />
          </mesh>
        ))}
      </group>
      <group ref={camera} position={[0, -0.78, 0.45]} {...handlers('camera')}>
        <mesh position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.5, 12]} />
          <meshStandardMaterial color="#9caaa0" metalness={0.8} />
        </mesh>
        <RoundedBox args={[0.65, 0.5, 0.6]} radius={0.12}>
          <meshStandardMaterial
            color={active('camera') ? '#d5b476' : '#38443c'}
            emissive={active('camera') ? '#ffb347' : '#000000'}
            emissiveIntensity={active('camera') ? 0.38 : 0}
            metalness={0.7}
            roughness={0.3}
          />
        </RoundedBox>
        <mesh position={[0, 0, 0.36]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.22, 0.24, 0.16, 24]} />
          <meshStandardMaterial color="#161e1d" metalness={0.9} roughness={0.08} />
        </mesh>
        <mesh position={[0, 0, 0.45]}>
          <circleGeometry args={[0.17, 24]} />
          <meshStandardMaterial color="#729ca0" metalness={1} roughness={0.05} />
        </mesh>
      </group>
      <LabelProjector
        container={labels}
        points={
          exploded || selected
            ? [
                { id: 'battery', position: [2.5, 0.15, 0], object: battery },
                { id: 'controller', position: [2.8, -0.05, 0], object: controller },
                { id: 'camera', position: [2.3, -0.1, 0], object: camera },
              ]
            : []
        }
      />
    </group>
  );
}
export default function DroneScene({
  exploded = false,
  selected = 'camera',
  onPart,
  reset = 0,
  sequence,
  onManual,
}: {
  reset?: number;
  exploded?: boolean;
  selected?: DronePart;
  onPart: (part: DronePart) => void;
  sequence?: MotionValue<number>;
  onManual?: () => void;
}) {
  const quality = useNexus((s) => s.quality);
  const { theme } = useTheme();
  const labels = useRef<HTMLDivElement>(null);
  return (
    <div
      className="drone-scene"
      data-selected-part={selected}
      data-exploded={exploded}
      role="group"
      aria-label="Interactive illustrative quadcopter. Drag to rotate and scroll to zoom."
    >
      <WebGLGate
        fallback={
          <div className="drone-fallback">
            <svg viewBox="0 0 500 360" role="img" aria-label="Illustrative quadcopter diagram">
              <g transform="translate(250 180)" stroke="#899488" strokeWidth="14">
                {[45, 135, 225, 315].map((angle) => (
                  <g key={angle} transform={`rotate(${angle})`}>
                    <path d="M0 0L120 0" />
                    <ellipse cx="140" rx="58" ry="10" fill="#252c29" strokeWidth="4" />
                    <circle cx="140" r="18" fill="#7d735d" strokeWidth="3" />
                  </g>
                ))}
                <rect
                  x="-40"
                  y="-50"
                  width="80"
                  height="100"
                  rx="15"
                  fill="#434d46"
                  strokeWidth="3"
                />
                <circle cy="56" r="16" fill="#d4b77e" strokeWidth="3" />
              </g>
            </svg>
            <p className="mono">ILLUSTRATIVE AIRFRAME / SIMPLIFIED VIEW</p>
          </div>
        }
      >
        <Canvas
          camera={{ position: [11, 9, 15], fov: 40 }}
          dpr={quality === 'high' ? [1, 1.7] : 1}
          gl={{ antialias: quality !== 'low', powerPreference: 'low-power' }}
          frameloop="demand"
        >
          <ambientLight intensity={1.6} />
          <StudioReflections />
          <hemisphereLight args={['#e3e4d3', '#242e2a', 1.5]} />
          <directionalLight position={[5, 8, 3]} color="#fff0d0" intensity={4} />
          <directionalLight
            position={[-5, 3, -3]}
            color={theme === 'original' ? '#b6d0ce' : themes[theme].scene.rim}
            intensity={3}
          />
          <Assembly exploded={exploded} selected={selected} onPart={onPart} labels={labels} />
          <StudioCamera
            exploded={exploded}
            selected={selected}
            reset={reset}
            sequence={sequence}
            onManual={onManual}
          />
        </Canvas>
        <div className="scene-overlays" ref={labels}>
          {(exploded ? ['battery', 'controller', 'camera'] : [selected])
            .filter((id) => ['battery', 'controller', 'camera'].includes(id))
            .map((id) => (
              <div className="projected-label" data-point={id} key={id}>
                <button
                  className={`scene-marker ${selected === id ? 'selected' : ''}`}
                  aria-pressed={selected === id}
                  onClick={() => onPart(id as DronePart)}
                >
                  {droneParts[id as DronePart].number} / {id.toUpperCase()}
                </button>
              </div>
            ))}
        </div>
      </WebGLGate>
    </div>
  );
}
