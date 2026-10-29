import { useEffect, useMemo, useState, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import {
  AdditiveBlending,
  AnimationMixer,
  BackSide,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Euler,
  FogExp2,
  Group,
  HemisphereLight,
  InstancedMesh,
  LoopOnce,
  Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PMREMGenerator,
  PerspectiveCamera,
  PointLight,
  Quaternion,
  RingGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
  type WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import timeline from '@/lib/intro-timeline.json';
import type { IntroModels } from './intro-assets';

// Real-time playback of the Blender-directed film. Blender owns geometry, the camera path and
// the drone's flight/propeller/gimbal animation; this layer adds light, atmosphere, traffic and
// the AETHER observation language. Everything shown is illustrative — no live data.
const cue = timeline.cues;
const CYAN = new Color(0.27, 0.91, 1.0);
const AMBER = new Color(1.0, 0.42, 0.25);
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const window01 = (t: number, a: number, b: number, fade = 0.4) =>
  smooth(a, a + fade, t) * (1 - smooth(b - fade, b, t));
// Blender (x, y, z) → glTF/three (x, z, -y)
const fromBlender = ([x, y, z]: number[]) => new Vector3(x, z, -y);

export interface IntroLabels {
  incident: HTMLElement | null;
  route: HTMLElement | null;
}

interface Lane {
  from: number[];
  to: number[];
  speed: number;
  count: number;
  mode: 'flow' | 'slow' | 'queue' | 'queue_end' | 'metro';
  stop?: number;
}

function hash(n: number) {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

const waveChunk = {
  vertex: 'varying vec3 vAetherWorld;',
  world: 'vAetherWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
  fragment:
    'varying vec3 vAetherWorld;\nuniform float uWave;\nuniform vec3 uOrigin;\nuniform float uBand;',
};

/** Windows and street lights come on as the scan wave passes; a cyan band marks its front. */
function withWave(material: MeshStandardMaterial, uniforms: Record<string, { value: unknown }>) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${waveChunk.vertex}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${waveChunk.world}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${waveChunk.fragment}`)
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float aetherD = distance(vAetherWorld.xz, uOrigin.xz);
        totalEmissiveRadiance *= 1.0 - smoothstep(uWave - 90.0, uWave, aetherD);
        totalEmissiveRadiance += vec3(0.27, 0.91, 1.0) * exp(-pow((aetherD - uWave) / 3.0, 2.0)) * uBand;`,
      );
  };
  material.customProgramCacheKey = () => 'aether-wave';
}

const routeMaterial = () =>
  new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    uniforms: { uProgress: { value: 0 }, uTime: { value: 0 }, uColor: { value: CYAN } },
    vertexShader:
      'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uProgress; uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
      void main(){
        float drawn = step(vUv.x, uProgress);
        float edge = 1.0 - pow(abs(vUv.y - 0.5) * 2.0, 4.0);
        float flow = 0.45 + 0.55 * smoothstep(0.55, 1.0, fract(vUv.x * 70.0 - uTime * 1.4));
        float head = exp(-pow((vUv.x - uProgress) * 260.0, 2.0)) * step(0.001, uProgress) * step(uProgress, 0.999);
        float a = drawn * edge * flow * 0.9 + head * 2.5 * edge;
        gl_FragColor = vec4(uColor * 1.6, a);
      }`,
  });

const disruptionMaterial = () =>
  new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    uniforms: { uOpacity: { value: 0 }, uTime: { value: 0 }, uColor: { value: AMBER } },
    vertexShader:
      'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uOpacity; uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
      void main(){
        float hatch = smoothstep(0.45, 0.55, fract((vUv.x * 18.0 + vUv.y * 2.0) - uTime * 0.6));
        float edge = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.92, vUv.y) * smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.9, vUv.x);
        float pulse = 0.65 + 0.35 * sin(uTime * 4.0);
        gl_FragColor = vec4(uColor * 1.4, uOpacity * edge * (0.25 + 0.45 * hatch) * pulse);
      }`,
  });

const lightPoolMaterial = (uniforms: Record<string, { value: unknown }>) =>
  new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    uniforms,
    vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uWave; uniform vec3 uOrigin; varying vec2 vUv; varying vec3 vW;
      void main(){
        float r = length(vUv - 0.5) * 2.0;
        float lit = 1.0 - smoothstep(uWave - 90.0, uWave, distance(vW.xz, uOrigin.xz));
        gl_FragColor = vec4(vec3(1.0, 0.66, 0.36), pow(max(0.0, 1.0 - r), 2.2) * 0.2 * lit);
      }`,
  });

const beamMaterial = (color: Color) =>
  new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    uniforms: { uOpacity: { value: 0 }, uColor: { value: color }, uTime: { value: 0 } },
    vertexShader:
      'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uOpacity; uniform vec3 uColor; uniform float uTime; varying vec2 vUv;
      void main(){
        float lines = 0.75 + 0.25 * smoothstep(0.4, 0.6, fract(vUv.y * 24.0 + uTime * 1.5));
        gl_FragColor = vec4(uColor * 1.4, uOpacity * pow(vUv.y, 1.6) * lines);
      }`,
  });

const ringMaterial = (color: Color) =>
  new MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -6,
  });

const skyMaterial = () =>
  new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { uWake: { value: 1 } },
    vertexShader:
      'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
    fragmentShader: `uniform float uWake; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float west = pow(max(0.0, dot(normalize(vec3(-1.0, 0.0, 0.35)), normalize(vec3(d.x, 0.0, d.z)))), 3.0);
        vec3 horizon = mix(vec3(0.11, 0.075, 0.12), vec3(0.42, 0.2, 0.15), west);
        vec3 col = mix(horizon, vec3(0.045, 0.05, 0.11), smoothstep(0.0, 0.16, d.y));
        col = mix(col, vec3(0.008, 0.014, 0.04), smoothstep(0.14, 0.6, d.y));
        col = mix(col, horizon * 0.35, smoothstep(0.0, -0.08, d.y));
        gl_FragColor = vec4(col * uWake, 1.0);
      }`,
  });

function buildFilm(models: IntroModels, gl: WebGLRenderer, sparse: boolean) {
  const root = new Group();
  const city = models.city.scene;
  const drone = models.drone.scene;
  root.add(city, drone);
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(item: T) => (disposables.push(item), item);

  const mixers = [
    [models.city, city],
    [models.drone, drone],
  ].map(([gltf, scene]) => {
    const mixer = new AnimationMixer(scene as Object3D);
    for (const clip of (gltf as IntroModels['city']).animations) {
      const action = mixer.clipAction(clip);
      action.setLoop(LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
    }
    return mixer;
  });
  const filmCamera = (city.getObjectByName('AETHER_Cam') ??
    models.city.cameras[0]) as PerspectiveCamera;

  const base = city.getObjectByName('anchor_base')!.position.clone();
  const anchor = (name: string) => city.getObjectByName(name)?.position.clone() ?? new Vector3();
  const incident = anchor('anchor_incident');
  const intersection = anchor('anchor_intersection');
  const routeEnd = anchor('anchor_route_end');

  const wave = { uWave: { value: 0 }, uOrigin: { value: base }, uBand: { value: 0 } };
  const env = new PMREMGenerator(gl);
  const envScene = new Scene();
  const envSky = new Mesh(new SphereGeometry(10, 32, 16), skyMaterial());
  envScene.add(envSky);
  const envMap = track(env.fromScene(envScene, 0.02)).texture;
  envSky.geometry.dispose();
  (envSky.material as Material).dispose();
  env.dispose();

  const named: Record<string, MeshStandardMaterial> = {};
  const fx: Record<string, ShaderMaterial> = {};
  city.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    const material = mesh.material as MeshStandardMaterial;
    named[material.name] = material;
    mesh.frustumCulled = !mesh.name.startsWith('city_ground');
    if (mesh.name === 'fx_route') mesh.material = fx.route = track(routeMaterial());
    else if (mesh.name === 'fx_disruption')
      mesh.material = fx.disruption = track(disruptionMaterial());
    else if (mesh.name === 'fx_lightpool') mesh.material = fx.pool = track(lightPoolMaterial(wave));
    else if (material.name !== 'emit_pad' && !mesh.name.startsWith('veh_'))
      withWave(material, wave);
    if (material.name === 'city_glass') {
      material.envMap = envMap;
      material.envMapIntensity = 1.1;
    }
    if (material.name === 'city_paint') {
      material.polygonOffset = true;
      material.polygonOffsetFactor = -2;
    }
  });

  // ── traffic: Blender lane definitions instanced over prototype vehicles ──
  const lanes: Lane[] = JSON.parse(
    String(city.getObjectByName('meta_traffic')?.userData.lanes ?? '[]'),
  );
  const incidentMeta = JSON.parse(
    String(city.getObjectByName('meta_traffic')?.userData.incident ?? '{}'),
  );
  const kinds = ['veh_car', 'veh_suv', 'veh_auto', 'veh_bus', 'veh_metro'] as const;
  const paint = ['#f2f2ee', '#c9ccd0', '#8d9298', '#1d1f22', '#9a2c26', '#2d4f7c', '#e9e4da'].map(
    (c) => new Color(c),
  );
  type Car = {
    lane: Lane;
    kind: (typeof kinds)[number];
    slot: number;
    offset: number;
    index: number;
  };
  const cars: Car[] = [];
  const counts: Record<string, number> = {};
  lanes.forEach((lane, l) => {
    const total = sparse ? Math.ceil(lane.count / 2) : lane.count;
    for (let i = 0; i < total; i++) {
      const r = hash(l * 31 + i);
      const kind =
        lane.mode === 'metro'
          ? 'veh_metro'
          : r < 0.55
            ? 'veh_car'
            : r < 0.75
              ? 'veh_suv'
              : r < 0.92
                ? 'veh_auto'
                : 'veh_bus';
      cars.push({
        lane,
        kind,
        slot: i,
        offset: hash(l * 7 + i * 3),
        index: (counts[kind] = (counts[kind] ?? 0) + 1) - 1,
      });
    }
  });
  const fleets: Record<string, InstancedMesh[]> = {};
  const lightMaterial = track(new MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
  for (const kind of kinds) {
    const proto = city.getObjectByName(kind);
    if (!proto) continue;
    proto.visible = false;
    const body = city.getObjectByName(`${kind}_body`) as Mesh | undefined;
    const lights = city.getObjectByName(`${kind}_lights`) as Mesh | undefined;
    if (!body || !lights || !counts[kind]) continue;
    const bodyMesh = new InstancedMesh(
      body.geometry as BufferGeometry,
      body.material as Material,
      counts[kind],
    );
    const lightMesh = new InstancedMesh(
      lights.geometry as BufferGeometry,
      lightMaterial,
      counts[kind],
    );
    for (const mesh of [bodyMesh, lightMesh]) {
      mesh.frustumCulled = false;
      root.add(mesh);
    }
    fleets[kind] = [bodyMesh, lightMesh];
  }
  for (const car of cars) {
    const tint =
      car.kind === 'veh_auto' || car.kind === 'veh_metro'
        ? new Color('#ffffff')
        : paint[Math.floor(car.offset * paint.length)];
    fleets[car.kind]?.[0].setColorAt(car.index, tint);
  }
  // Illustrative stalled vehicles at the disruption, with amber hazard flashers.
  const hazard = track(
    new MeshBasicMaterial({ color: new Color(1, 0.55, 0.1), toneMapped: false, transparent: true }),
  );
  const stalled: Mesh[] = [];
  for (const [kind, key] of [
    ['veh_truck', 'truck'],
    ['veh_car', 'car'],
  ] as const) {
    const spec: number[] | undefined = incidentMeta[key];
    const body = city.getObjectByName(`${kind}_body`) as Mesh | undefined;
    const lights = city.getObjectByName(`${kind}_lights`) as Mesh | undefined;
    if (!spec || !body || !lights) continue;
    const group = new Group();
    group.add(new Mesh(body.geometry, body.material), new Mesh(lights.geometry, hazard));
    group.position.copy(fromBlender(spec));
    group.rotation.y = spec[3];
    root.add(group);
    stalled.push(group.children[1] as Mesh);
  }
  const truck = city.getObjectByName('veh_truck');
  if (truck) truck.visible = false;

  const matrix = new Matrix4();
  const quaternion = new Quaternion();
  const unit = new Vector3(1, 1, 1);
  const position = new Vector3();
  const laneVectors = lanes.map((lane) => {
    const a = fromBlender(lane.from);
    const b = fromBlender(lane.to);
    const direction = b.clone().sub(a);
    const length = direction.length();
    direction.normalize();
    const yaw = Math.atan2(-direction.z, direction.x);
    const stopAt = lane.stop === undefined ? length : Math.abs(lane.stop - lane.from[0]);
    return {
      a,
      direction,
      length,
      rotation: new Quaternion().setFromEuler(new Euler(0, yaw, 0)),
      stopAt,
    };
  });
  const placeTraffic = (t: number) => {
    for (const car of cars) {
      const geometry = laneVectors[lanes.indexOf(car.lane)];
      const { lane } = car;
      const total = sparse ? Math.ceil(lane.count / 2) : lane.count;
      let s: number;
      if (lane.mode === 'queue') s = geometry.stopAt - 4 - car.slot * 7.6 - car.offset * 1.5;
      else if (lane.mode === 'queue_end')
        s = geometry.length - 2 - car.slot * 7.4 - car.offset * 1.2;
      else if (lane.mode === 'metro')
        s = ((car.offset * 900 + lane.speed * t) % (geometry.length + 300)) - 150;
      else {
        const speed = lane.mode === 'slow' ? 4.5 : lane.speed * (0.85 + car.offset * 0.3);
        s =
          (((car.slot + car.offset * 0.6) / total) * geometry.length + speed * t) % geometry.length;
      }
      position.copy(geometry.a).addScaledVector(geometry.direction, s);
      quaternion.copy(geometry.rotation);
      matrix.compose(position, quaternion, unit);
      for (const mesh of fleets[car.kind] ?? []) mesh.setMatrixAt(car.index, matrix);
    }
    for (const meshes of Object.values(fleets))
      for (const mesh of meshes) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
  };

  // ── markers, scan cone, rings ──
  const markers = new Group();
  root.add(markers);
  const beam = (color: Color, height: number, at: Vector3) => {
    const mesh = new Mesh(
      track(new CylinderGeometry(0.35, 0.35, height, 16, 1, true)),
      track(beamMaterial(color)),
    );
    mesh.position.copy(at).add(new Vector3(0, height / 2, 0));
    markers.add(mesh);
    return mesh.material as ShaderMaterial;
  };
  const ring = (color: Color, inner: number, outer: number, at: Vector3) => {
    const mesh = new Mesh(track(new RingGeometry(inner, outer, 64)), track(ringMaterial(color)));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(at).add(new Vector3(0, 0.3, 0));
    markers.add(mesh);
    return mesh;
  };
  const incidentBeam = beam(AMBER, 34, incident);
  const incidentRings = [0, 1].map(() => ring(AMBER, 0.92, 1, incident));
  const routeBeam = beam(CYAN, 26, routeEnd);
  const routeRing = ring(CYAN, 0.8, 1, routeEnd);
  const scanRing = ring(CYAN, 0.97, 1, intersection);
  const cone = new Mesh(track(new ConeGeometry(1, 1, 40, 1, true)), track(beamMaterial(CYAN)));
  cone.geometry.translate(0, -0.5, 0); // apex at origin, opening along -Y
  markers.add(cone);
  const footprint = ring(CYAN, 0.86, 1, intersection);
  const gimbal = drone.getObjectByName('drone_gimbal') ?? drone;

  // ── drone details ──
  const droneMaterials: Record<string, MeshStandardMaterial> = {};
  const discs: ShaderMaterial[] = [];
  drone.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    const material = mesh.material as MeshStandardMaterial;
    droneMaterials[material.name] = material;
    if (material.name.startsWith('drone_shell') || material.name === 'drone_metal') {
      material.envMap = envMap;
      material.envMapIntensity = 0.9;
    }
    if (mesh.name.startsWith('propdisc')) {
      const disc = track(
        new ShaderMaterial({
          transparent: true,
          depthWrite: false,
          side: DoubleSide,
          uniforms: { uSpin: { value: 0 } },
          vertexShader:
            'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
          fragmentShader: `uniform float uSpin; varying vec2 vUv;
            void main(){ float r = length(vUv - 0.5) * 2.0;
              float a = smoothstep(1.0, 0.94, r) * (0.3 + 0.7 * smoothstep(0.15, 0.95, r)) + smoothstep(0.99, 0.9, r) * smoothstep(0.84, 0.92, r) * 0.6;
              gl_FragColor = vec4(vec3(0.42, 0.45, 0.5), a * 0.075 * uSpin); }`,
        }),
      );
      mesh.material = disc;
      discs.push(disc);
    }
  });
  const ledBase: Record<string, number> = {};
  for (const [name, material] of Object.entries(droneMaterials))
    ledBase[name] = material.emissiveIntensity;
  const padBase = 1.4;
  if (named.emit_crown) named.emit_crown.emissiveIntensity = 0.9;
  if (named.emit_lamp) named.emit_lamp.emissiveIntensity = 2.5;
  const beaconBase = named.emit_beacon?.emissiveIntensity ?? 8;

  // ── light & atmosphere ──
  const sky = new Mesh(track(new SphereGeometry(3000, 32, 16)), track(skyMaterial()));
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  root.add(sky);
  const hemi = new HemisphereLight('#7084c4', '#2a1d1a', 0);
  const dusk = new DirectionalLight('#ff9a6a', 0);
  dusk.position.set(-500, 90, 180);
  const moon = new DirectionalLight('#9db8ff', 0);
  moon.position.set(200, 400, 300);
  const fill = new PointLight('#e2ecff', 0, 16, 2);
  root.add(hemi, dusk, moon, fill);
  const fogColor = new Color('#151422');
  const fog = new FogExp2(fogColor.getHex(), 0.0021);

  const droneWorld = new Vector3();
  const tmp = new Vector3();
  const filmPos = new Vector3();
  const filmQuat = new Quaternion();
  const aim = new Quaternion();
  const filmScale = new Vector3();
  const project = new Vector3();
  const label = (
    element: HTMLElement | null,
    at: Vector3,
    camera: PerspectiveCamera,
    size: Vector2,
    opacity: number,
  ) => {
    if (!element) return;
    project.copy(at).project(camera);
    const visible = opacity > 0.01 && project.z < 1;
    element.style.opacity = visible ? String(opacity) : '0';
    if (visible)
      element.style.transform = `translate3d(${((project.x + 1) / 2) * size.x}px, ${((1 - project.y) / 2) * size.y}px, 0)`;
  };

  const update = (
    t: number,
    camera: PerspectiveCamera,
    size: Vector2,
    labels: IntroLabels | null,
  ) => {
    for (const mixer of mixers) mixer.setTime(Math.min(t, timeline.duration - 0.001));
    // camera: the Blender-animated camera, re-fitted so portrait screens keep the drone in frame
    filmCamera.updateMatrixWorld(true);
    filmCamera.matrixWorld.decompose(filmPos, filmQuat, filmScale);
    camera.position.copy(filmPos);
    const aspect = size.x / Math.max(1, size.y);
    drone.getObjectByName('AETHER_Drone')?.getWorldPosition(droneWorld);
    // Portrait screens lose the sides of the 16:9 composition: lean toward the drone until
    // the incident beat, whose authored framing already works narrow.
    const lean = Math.max(0, 1 - aspect) * 0.6 * (1 - smooth(cue.incident, cue.incident + 0.8, t));
    if (lean > 0) {
      camera.lookAt(droneWorld);
      aim.copy(camera.quaternion);
      camera.quaternion.copy(filmQuat).slerp(aim, lean);
    } else camera.quaternion.copy(filmQuat);
    const tanHalfH = 0.6; // 30 mm lens on a 36 mm sensor
    const fov = Math.min(78, Math.max(42.5, (2 * Math.atan(tanHalfH / aspect) * 180) / Math.PI));
    if (Math.abs(camera.fov - fov) > 0.01 || camera.aspect !== aspect) {
      camera.fov = fov;
      camera.aspect = aspect;
      camera.near = 0.15;
      camera.far = 3400;
      camera.updateProjectionMatrix();
    }

    // awakening → wave of light → city lit
    const wake = smooth(cue.wake, cue.crane + 1.5, t);
    const front = Math.max(0, t - cue.pulse);
    wave.uWave.value = front <= 0 ? 0 : 1600 * Math.pow(Math.min(1, front / 6.2), 1.7);
    wave.uBand.value = window01(t, cue.pulse, cue.pulse + 6.2, 0.5) * 0.8;
    (sky.material as ShaderMaterial).uniforms.uWake.value = 0.22 + 0.78 * wake;
    fog.color.copy(fogColor).multiplyScalar(0.3 + 0.7 * wake);
    hemi.intensity = 0.12 + 0.6 * wake;
    dusk.intensity = 0.15 + 0.85 * wake;
    moon.intensity = 0.1 + 0.3 * wake;

    // drone: LEDs wake first; fill light keeps it readable against the night city
    const ledOn = smooth(cue.wake, cue.wake + 0.6, t);
    for (const [name, material] of Object.entries(droneMaterials)) {
      if (!name.startsWith('drone_led')) continue;
      let k = ledOn;
      if (name === 'drone_led_strobe')
        k *= (t * 1.1) % 1 < 0.06 || ((t * 1.1) % 1 > 0.14 && (t * 1.1) % 1 < 0.2) ? 1.6 : 0.05;
      if (name === 'drone_led_cyan') k *= 0.75 + 0.25 * Math.sin(t * 2.4);
      material.emissiveIntensity = (ledBase[name] ?? 6) * k;
    }
    const spin = smooth(cue.spinup, cue.spinup + 1.1, t);
    for (const disc of discs) disc.uniforms.uSpin.value = spin;
    fill.position
      .copy(camera.position)
      .lerp(droneWorld, 0.35)
      .add(tmp.set(0, 0.6, 0));
    fill.intensity = 5 * (1 - smooth(cue.pullback, cue.pullback + 2, t)) * (0.4 + 0.6 * ledOn);
    if (named.emit_pad)
      named.emit_pad.emissiveIntensity =
        padBase * smooth(cue.wake + 0.2, cue.wake + 1, t) * (0.7 + 0.3 * Math.sin(t * 3));
    if (named.emit_beacon)
      named.emit_beacon.emissiveIntensity = beaconBase * (Math.sin(t * 4.2) > 0.55 ? 1 : 0.12);

    // observation language: scan sweep → disruption → alternative route
    const scan = window01(t, cue.scan, cue.incident + 1.6, 0.35);
    const target = intersection.clone().lerp(incident, smooth(cue.scan + 0.3, cue.incident, t));
    gimbal.getWorldPosition(tmp);
    const reach = tmp.distanceTo(target);
    cone.position.copy(tmp);
    cone.quaternion.setFromUnitVectors(new Vector3(0, -1, 0), target.clone().sub(tmp).normalize());
    cone.scale.set(reach * 0.16, reach, reach * 0.16);
    cone.visible = scan > 0.01;
    (cone.material as ShaderMaterial).uniforms.uOpacity.value = 0.13 * scan;
    (cone.material as ShaderMaterial).uniforms.uTime.value = t;
    footprint.position.set(target.x, 0.35, target.z);
    footprint.scale.setScalar(reach * 0.16);
    (footprint.material as MeshBasicMaterial).opacity = 0.8 * scan;
    const sweep = smooth(cue.scan - 0.2, cue.scan + 1.4, t);
    scanRing.scale.setScalar(4 + 70 * sweep);
    (scanRing.material as MeshBasicMaterial).opacity =
      0.9 * (1 - sweep) * smooth(cue.scan - 0.2, cue.scan, t);

    const flagged = smooth(cue.incident, cue.incident + 0.6, t);
    incidentBeam.uniforms.uOpacity.value = 0.55 * flagged;
    incidentBeam.uniforms.uTime.value = t;
    incidentRings.forEach((r, i) => {
      const phase = (t * 0.55 + i / 2) % 1;
      r.scale.setScalar(2 + phase * 14);
      (r.material as MeshBasicMaterial).opacity = (1 - phase) * 0.9 * flagged;
    });
    if (fx.disruption) {
      fx.disruption.uniforms.uOpacity.value = flagged;
      fx.disruption.uniforms.uTime.value = t;
    }
    if (stalled.length) hazard.opacity = flagged > 0 && Math.sin(t * 9) > 0 ? 1 : 0.15;
    const routeProgress = smooth(cue.route, cue.route + 2.6, t);
    if (fx.route) {
      fx.route.uniforms.uProgress.value = routeProgress;
      fx.route.uniforms.uTime.value = t;
    }
    const arrived = smooth(0.92, 1, routeProgress);
    routeBeam.uniforms.uOpacity.value = 0.45 * arrived;
    routeBeam.uniforms.uTime.value = t;
    routeRing.scale.setScalar(3 + 1.2 * Math.sin(t * 3));
    (routeRing.material as MeshBasicMaterial).opacity = 0.8 * arrived;

    placeTraffic(t);
    if (labels) {
      label(
        labels.incident,
        tmp.copy(incident).add(new Vector3(0, 7, 0)),
        camera,
        size,
        flagged * (1 - smooth(cue.logo - 0.5, cue.logo, t)),
      );
      label(
        labels.route,
        tmp.copy(routeEnd).add(new Vector3(0, 7, 0)),
        camera,
        size,
        arrived * (1 - smooth(cue.logo - 0.5, cue.logo, t)),
      );
    }
  };

  // Frees GPU memory only; three re-uploads if the same film is shown again (StrictMode remount).
  const dispose = () => {
    for (const item of disposables) item.dispose();
    for (const meshes of Object.values(fleets)) for (const mesh of meshes) mesh.dispose();
  };
  return { root, fog, update, dispose };
}

// One film per loaded model set: building rewires the models' materials and parents in place,
// so it must never run twice for the same models (StrictMode double render, remounts).
const films = new WeakMap<IntroModels, ReturnType<typeof buildFilm>>();
function filmFor(models: IntroModels, gl: WebGLRenderer, sparse: boolean) {
  let film = films.get(models);
  if (!film) films.set(models, (film = buildFilm(models, gl, sparse)));
  return film;
}

function Film({
  models,
  clock,
  labels,
  bloom,
  sparse,
  onReady,
}: {
  models: IntroModels;
  clock: RefObject<number>;
  labels: RefObject<IntroLabels>;
  bloom: boolean;
  sparse: boolean;
  onReady: () => void;
}) {
  const { gl, scene, camera, size, invalidate } = useThree();
  const film = useMemo(() => filmFor(models, gl, sparse), [models, gl, sparse]);
  const viewport = useMemo(() => new Vector2(), []);
  const composer = useMemo(() => {
    if (!bloom) return null;
    const c = new EffectComposer(gl);
    c.addPass(new RenderPass(scene, camera));
    c.addPass(new UnrealBloomPass(new Vector2(256, 256), 0.75, 0.55, 0.78));
    c.addPass(new OutputPass());
    return c;
  }, [bloom, gl, scene, camera]);
  useEffect(() => () => film.dispose(), [film]);
  useEffect(() => {
    if (!composer) return;
    composer.setPixelRatio(gl.getPixelRatio());
    composer.setSize(size.width, size.height);
    return () => composer.dispose();
  }, [composer, gl, size]);
  useEffect(() => {
    let cancelled = false;
    film.update(
      clock.current ?? 0,
      camera as PerspectiveCamera,
      viewport.set(size.width, size.height),
      null,
    );
    // Upload shaders and textures before the visitor presses play: no hitch on frame one.
    gl.compileAsync(scene, camera)
      .catch(() => undefined)
      .then(() => {
        if (cancelled) return;
        invalidate();
        onReady();
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- warm once per film
  }, [film]);
  useFrame(() => {
    film.update(
      clock.current ?? 0,
      camera as PerspectiveCamera,
      viewport.set(size.width, size.height),
      labels.current,
    );
    if (composer) composer.render();
    else gl.render(scene, camera);
  }, 1);
  return (
    <>
      <primitive object={film.root} />
      <primitive object={film.fog} attach="fog" />
    </>
  );
}

export default function IntroScene({
  models,
  clock,
  labels,
  playing,
  quality,
  onReady,
  onFailure,
}: {
  models: IntroModels;
  clock: RefObject<number>;
  labels: RefObject<IntroLabels>;
  playing: boolean;
  quality: 'high' | 'balanced' | 'low';
  onReady: () => void;
  onFailure: () => void;
}) {
  const [lite, setLite] = useState(false);
  const [declined, setDeclined] = useState(false);
  const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
  const reduceLoad = lite || quality === 'low' || coarse;
  const dpr: [number, number] | number =
    reduceLoad || declined ? 1 : quality === 'high' ? [1, 2] : [1, 1.5];
  return (
    <Canvas
      className="aether-intro-canvas"
      frameloop={playing ? 'always' : 'demand'}
      dpr={dpr}
      gl={{ antialias: !reduceLoad, powerPreference: 'high-performance' }}
      camera={{ fov: 42.5, near: 0.15, far: 3400 }}
      onCreated={({ gl }) => {
        const context = gl.getContext();
        const info = context.getExtension('WEBGL_debug_renderer_info');
        const renderer = info ? String(context.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
        if (/swiftshader|llvmpipe|software|basic render/i.test(renderer)) setLite(true);
        gl.domElement.addEventListener('webglcontextlost', onFailure, { once: true });
      }}
      aria-hidden="true"
    >
      <PerformanceMonitor onDecline={() => setDeclined(true)} />
      <Film
        models={models}
        clock={clock}
        labels={labels}
        bloom={!reduceLoad && !declined}
        sparse={coarse || quality === 'low'}
        onReady={onReady}
      />
    </Canvas>
  );
}
