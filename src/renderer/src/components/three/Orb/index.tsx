import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { useMemo, useRef } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, type Mesh, type ShaderMaterial } from 'three';
import { useReducedMotion } from '~hooks/useReducedMotion';
import type { Phase } from '~store';
import { orbFragment, orbVertex, particleFragment, particleVertex } from './shaders';
import styles from './Orb.module.css';

interface Props {
  phase: Phase;
  /** 0–1 while scanning, so the orb grows livelier as it goes. */
  progress: number;
}

const TARGETS: Record<Phase, { energy: number; inflow: number; outflow: number; spin: number }> = {
  idle: { energy: 0.12, inflow: 0, outflow: 0, spin: 0.07 },
  scanning: { energy: 0.5, inflow: 1, outflow: 0, spin: 0.32 },
  results: { energy: 0.24, inflow: 0, outflow: 0, spin: 0.12 },
  cleaning: { energy: 0.85, inflow: 0, outflow: 1, spin: 0.5 },
  done: { energy: 0.16, inflow: 0, outflow: 0, spin: 0.09 },
};

/** Phases that land with a soft burst. */
const PULSE_ON: Phase[] = ['results', 'done'];

const ease = (from: number, to: number, delta: number, rate = 2.4) => from + (to - from) * (1 - Math.exp(-delta * rate));

function OrbMesh({ phase, progress }: Props) {
  const mesh = useRef<Mesh>(null);
  const material = useRef<ShaderMaterial>(null);
  const live = useRef({ energy: 0.1, spin: 0.07, pulse: 0, phase });
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uEnergy: { value: 0.1 },
      uPulse: { value: 0 },
      uColorA: { value: new Color('#22c9a6') },
      uColorB: { value: new Color('#6f5cff') },
      uColorC: { value: new Color('#ff6fae') },
    }),
    [],
  );

  useFrame((_, delta) => {
    const s = live.current;
    if (s.phase !== phase) {
      if (PULSE_ON.includes(phase)) s.pulse = 1;
      s.phase = phase;
    }
    const target = TARGETS[phase];
    s.energy = ease(s.energy, target.energy + (phase === 'scanning' ? progress * 0.35 : 0), delta);
    s.spin = ease(s.spin, target.spin, delta);
    s.pulse *= Math.exp(-delta * 2.4);
    const u = material.current?.uniforms;
    if (!u || !mesh.current) return;
    u.uTime.value += delta;
    u.uEnergy.value = s.energy;
    u.uPulse.value = s.pulse;
    mesh.current.rotation.y += delta * s.spin;
    mesh.current.rotation.x = Math.sin(u.uTime.value * 0.21) * 0.18;
    mesh.current.scale.setScalar(1 + Math.sin(u.uTime.value * 0.9) * 0.02);
  });

  return (
    <mesh ref={mesh}>
      <icosahedronGeometry args={[1, 64]} />
      <shaderMaterial ref={material} vertexShader={orbVertex} fragmentShader={orbFragment} uniforms={uniforms} />
    </mesh>
  );
}

const COUNT = 1500;

/** A seeded generator keeps the particle layout identical between renders. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function Particles({ phase }: { phase: Phase }) {
  const material = useRef<ShaderMaterial>(null);
  const dpr = useThree((state) => state.viewport.dpr);
  const live = useRef({ inflow: 0, outflow: 0, pulse: 0, phase });

  const geometry = useMemo(() => {
    const random = seeded(7);
    const attr = (fill: () => number) => new BufferAttribute(Float32Array.from({ length: COUNT }, fill), 1);
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(COUNT * 3), 3));
    g.setAttribute('aRadius', attr(() => 1.35 + random() * 2.1));
    g.setAttribute('aTheta', attr(() => random() * Math.PI * 2));
    g.setAttribute('aLift', attr(() => random() * 2 - 1));
    g.setAttribute('aSpeed', attr(() => 0.4 + random()));
    g.setAttribute('aSize', attr(() => 0.6 + random() * 1.8));
    return g;
  }, []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uInflow: { value: 0 },
      uOutflow: { value: 0 },
      uPulse: { value: 0 },
      uPixelRatio: { value: 1 },
      uColor: { value: new Color('#bfb6ff') },
    }),
    [],
  );

  useFrame((_, delta) => {
    const s = live.current;
    if (s.phase !== phase) {
      if (PULSE_ON.includes(phase)) s.pulse = 1;
      s.phase = phase;
    }
    s.inflow = ease(s.inflow, TARGETS[phase].inflow, delta, 1.6);
    s.outflow = ease(s.outflow, TARGETS[phase].outflow, delta, 1.6);
    s.pulse *= Math.exp(-delta * 1.8);
    const u = material.current?.uniforms;
    if (!u) return;
    u.uTime.value += delta;
    u.uInflow.value = s.inflow;
    u.uOutflow.value = s.outflow;
    u.uPulse.value = s.pulse;
    u.uPixelRatio.value = dpr;
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        vertexShader={particleVertex}
        fragmentShader={particleFragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}

export function Orb({ phase, progress }: Props) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={styles.still} aria-hidden />;
  return (
    // Drawn on black and screen-blended, so the glow adds light to whatever is behind it.
    <Canvas className={styles.canvas} dpr={[1, 2]} camera={{ position: [0, 0, 5.6], fov: 38 }} gl={{ antialias: true, alpha: false }}>
      <color attach="background" args={['#000000']} />
      <OrbMesh phase={phase} progress={progress} />
      <Particles phase={phase} />
      <EffectComposer>
        <Bloom intensity={1.05} luminanceThreshold={0.16} luminanceSmoothing={0.35} mipmapBlur radius={0.75} />
      </EffectComposer>
    </Canvas>
  );
}
