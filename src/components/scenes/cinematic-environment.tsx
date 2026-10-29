'use client';
import { useEffect, useMemo, useRef } from 'react';
import { BackSide, Color, InstancedMesh, Object3D } from 'three';
import { useTheme } from '../theme-provider';

// Obsidian trades the teal haze for a warm graphite dusk; other themes keep the original set.
const palettes = {
  original: {
    zenith: '#101f2c',
    horizon: '#75938d',
    sun: '#dcb784',
    ground: '#253a38',
    skyline: '#869b94',
    hue: 0.46,
  },
  prism: {
    zenith: '#0a0520',
    horizon: '#6a1f7e',
    sun: '#ff4fa3',
    ground: '#120a2a',
    skyline: '#4b2a7c',
    hue: 0.8,
  },
  nova: {
    zenith: '#03040a',
    horizon: '#2b2f73',
    sun: '#46e8ff',
    ground: '#0a0c18',
    skyline: '#3a4078',
    hue: 0.66,
  },
  obsidian: {
    zenith: '#0b0c10',
    horizon: '#4d4338',
    sun: '#f2a93b',
    ground: '#1c1d20',
    skyline: '#77736a',
    hue: 0.09,
  },
};

// Original illustrative set. No geographic coordinates or operational records.
export function CinematicEnvironment() {
  const skyline = useRef<InstancedMesh>(null);
  const { theme } = useTheme();
  const palette =
    theme === 'prism'
      ? palettes.prism
      : theme === 'nova'
        ? palettes.nova
        : theme === 'obsidian'
          ? palettes.obsidian
          : palettes.original;
  const sky = useMemo(
    () => ({
      zenith: { value: new Color(palette.zenith) },
      horizon: { value: new Color(palette.horizon) },
      sunlight: { value: new Color(palette.sun) },
    }),
    [palette],
  );
  useEffect(() => {
    const object = new Object3D();
    for (let i = 0; i < 160; i++) {
      const angle = i * 2.39996;
      const radius = 90 + (i % 7) * 9;
      const height = 2 + ((i * 17) % 6);
      object.position.set(Math.cos(angle) * radius, height / 2 - 0.35, Math.sin(angle) * radius);
      object.scale.set(2 + (i % 4), height, 2 + ((i * 3) % 4));
      object.updateMatrix();
      skyline.current?.setMatrixAt(i, object.matrix);
      skyline.current?.setColorAt(i, new Color().setHSL(palette.hue, 0.12, 0.12 + (i % 4) * 0.025));
    }
    if (skyline.current) {
      skyline.current.instanceMatrix.needsUpdate = true;
      if (skyline.current.instanceColor) skyline.current.instanceColor.needsUpdate = true;
    }
  }, [palette]);
  return (
    <group>
      <mesh>
        <sphereGeometry args={[240, 32, 20]} />
        <shaderMaterial
          key={theme}
          side={BackSide}
          depthWrite={false}
          uniforms={sky}
          vertexShader={`varying vec3 direction; void main() { direction = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`}
          fragmentShader={`varying vec3 direction; uniform vec3 zenith; uniform vec3 horizon; uniform vec3 sunlight;
            void main() { vec3 d = normalize(direction); float altitude = smoothstep(-.08, .65, d.y);
              vec3 color = mix(horizon, zenith, altitude); float sun = max(0., dot(d, normalize(vec3(-.65,.16,-.75))));
              color += sunlight * (pow(sun, 14.) * .22 + pow(sun, 240.) * .7);
              gl_FragColor = vec4(color, 1.);
              #include <tonemapping_fragment>
              #include <colorspace_fragment>
            }`}
        />
      </mesh>
      <mesh position={[0, -0.28, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[350, 350]} />
        <meshStandardMaterial color={palette.ground} roughness={0.85} metalness={0.15} />
      </mesh>
      <instancedMesh ref={skyline} args={[undefined, undefined, 160]}>
        <boxGeometry />
        <meshStandardMaterial color={palette.skyline} roughness={0.8} metalness={0.15} />
      </instancedMesh>
    </group>
  );
}
