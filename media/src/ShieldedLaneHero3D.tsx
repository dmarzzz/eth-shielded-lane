/**
 * SL_Hero3D - "one chain, this block": a chain of glass blocks receding into fog.
 *
 * Block N sits front-and-center. It is one object in two parts: the PAYLOAD, a
 * big glass box packed with a crowd of small translucent elements in every hue
 * (swaps, mints, transfers, all different), and, appended after a small gap,
 * the SHIELDED LANE: a thinner box of smoked indigo glass, uniform inside, with
 * only a faint cool rim. Blocks N-1 and N-2 recede behind it, desaturated and
 * fogged; N+1 is a ghost outline ahead, not built yet. A luminous hairline
 * links neighbours. A dark glossy floor reflects everything.
 *
 * Render: npx remotion still src/index.tsx SL-Hero3D out/shieldedlane/SL-Hero3D.png --frame=120 --gl=angle
 * Variants: --props='{"variant":"c"}' (higher camera) or '{"variant":"d"}' (more lane glow)
 *
 * Detail tiers (cumulative, --props='{"variant":"c","detail":2}'):
 *   1  the lane has contents: a uniform crowd of slabs seen as silhouettes through frost
 *   2  + a dashed outline on the floor enclosing payload and lane as one block
 *   3  + the beacon chain floating above, slot N committing to both halves (default)
 *
 * Motion (240 frames at 30 fps, loops; frame 120 is the poster frame):
 *   camera   a slow there-and-back dolly along the chain, at rest on frames 0, 120, 240
 *   lane     the inner glow breathes on a 4 s period, at its base level on the poster frame
 *   beacon   slot N pulses once around the poster frame; the commitment then runs down both
 *            hairlines and the lane answers with a small bump
 *   links    one brightness pulse travels the chain hairlines from before N-1 to past N+1
 *   crowd    a per-instance emissive shimmer, nothing moves
 */

import React, { useLayoutEffect, useMemo } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBox, MeshReflectorMaterial } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';

const MONO = "ui-monospace, 'SF Mono', Menlo, monospace";

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------
export type HeroVariant = 'a' | 'b' | 'c' | 'd';
export type HeroDetail = 1 | 2 | 3;

const VOID = '#04070f';
const FOG_NEAR = 8;
const FOG_FAR = 32;

// One block = payload + gap + lane, all sharing height and depth.
const BLOCK = {
  height: 1.5,
  depth: 2.6, // z extent
  payload: 6.0, // x extent of the payload box
  join: 0.34, // gap between payload and lane, inside the block
  lane: 1.7, // x extent of the lane box
  chainGap: 1.9, // gap between neighbouring blocks
};
const BLOCK_LEN = BLOCK.payload + BLOCK.join + BLOCK.lane;
const PITCH = BLOCK_LEN + BLOCK.chainGap;

// Detail 2: dashed outline margin around block N's footprint.
const OUTLINE_MARGIN = 0.32;

// Detail 3: the beacon row floats this high, one small slab per execution block.
const BEACON = { y: 3.05, w: 1.15, h: 0.26, d: 0.72 };

interface VariantCfg {
  pos: [number, number, number];
  look: [number, number, number];
  fov: number;
  laneGlow: number; // 0..1 inner glow of the shielded lane
}

const VARIANTS: Record<HeroVariant, VariantCfg> = {
  // three-quarter from the near-right, slightly above; chain recedes to the left
  a: { pos: [6.0, 3.8, 11.4], look: [-0.9, 0.3, 0], fov: 40, laneGlow: 0.35 },
  b: { pos: [6.0, 3.8, 11.4], look: [-0.9, 0.3, 0], fov: 40, laneGlow: 0.35 },
  // c: higher camera, more floor and more of the chain
  c: { pos: [6.3, 4.8, 11.0], look: [-1.0, 0.55, 0], fov: 40, laneGlow: 0.35 },
  // d: same camera as a, lane glows a touch more
  d: { pos: [6.0, 3.8, 11.4], look: [-0.9, 0.3, 0], fov: 40, laneGlow: 1.0 },
};

// Block k's x origin (left face of its payload). Block N is k = 0, centred on x = 0.
const blockX0 = (k: number) => k * PITCH - BLOCK_LEN / 2;

// ---------------------------------------------------------------------------
// Motion model: everything time-dependent is derived from the frame here, once,
// so the scene stays a pure function of (frame, cfg) and the loop is exact.
// ---------------------------------------------------------------------------
const LOOP = 240; // frames
const POSTER = 120; // the approved still
const CAM_TRAVEL = 0.36; // world units along the chain, there and back
const COMMIT = { center: 111, sigma: 8 }; // beacon pulse, mostly settled by the poster frame
const PROPAGATE = { start: 122, end: 148 }; // sparks running down the hairlines
const LANE_ANSWER = { center: 152, sigma: 12, amount: 0.28 }; // lane bump after arrival
const LINK_PULSE_W = 0.55;

interface Motion {
  t: number; // seconds
  camOffset: [number, number, number];
  laneGlowMul: number; // 1 on the poster frame
  commit: number; // 0..1
  propagate: number; // 0..1 spark progress, -1 when idle
  hairline: number; // 0..1 hairline brightness envelope
  linkPulseX: number; // world x of the travelling link pulse
  linkPulseA: number; // 0..1 fade at the loop seam
}

const gauss = (x: number, c: number, s: number) => Math.exp(-((x - c) * (x - c)) / (s * s));

function motionAt(frame: number, fps: number): Motion {
  const f = ((frame % LOOP) + LOOP) % LOOP;
  const t = f / fps;
  // camera: cosine there-and-back, zero velocity at 0, POSTER and LOOP
  const dolly = -CAM_TRAVEL * (1 + Math.cos((2 * Math.PI * f) / LOOP)) / 2;
  // lane: 4 s breath, factor 1 at frames 0/120/240, up to 1.6x in between
  const laneGlowMul = 1 + 0.6 * (1 - Math.cos((2 * Math.PI * f) / (LOOP / 2))) / 2 + LANE_ANSWER.amount * gauss(f, LANE_ANSWER.center, LANE_ANSWER.sigma);
  const commit = gauss(f, COMMIT.center, COMMIT.sigma);
  const pRaw = (f - PROPAGATE.start) / (PROPAGATE.end - PROPAGATE.start);
  const propagate = pRaw >= 0 && pRaw <= 1 ? pRaw : -1;
  const hairline = Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (f - (PROPAGATE.start - 4)) / (PROPAGATE.end - PROPAGATE.start + 10)))));
  // links: one pulse from the gap before N-1 to the far end of N+1 over the whole loop
  const xStart = blockX0(-1) - BLOCK.chainGap;
  const xEnd = blockX0(1) + BLOCK_LEN;
  const linkPulseX = xStart + (xEnd - xStart) * (f / LOOP);
  const seam = Math.min(1, f / 18, (LOOP - f) / 18);
  return { t, camOffset: [dolly, 0, 0], laneGlowMul, commit, propagate, hairline, linkPulseX, linkPulseA: seam };
}

// ---------------------------------------------------------------------------
// Seeded content layout for the payload crowd
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The whole spectrum, saturated but meant to be seen through glass.
const SPECTRUM = [
  '#ff6a5c', // coral
  '#ff8f4a', // tangerine
  '#ffb43d', // amber
  '#f5d43a', // yellow
  '#b8f04a', // lime
  '#55f0b5', // mint
  '#4ddcff', // cyan
  '#4e8cff', // azure
  '#8b6bff', // violet
  '#c86bff', // orchid
  '#ff5bd8', // magenta
  '#ff6f9c', // rose
];

interface Item {
  pos: [number, number, number];
  size: [number, number, number];
  color: THREE.Color;
}

// A crowd of cubes and slabs of many sizes, packed inside a payload box.
function payloadCrowd(seed: number, count: number, x0: number): Item[] {
  const rnd = mulberry32(seed);
  const items: Item[] = [];
  const H = BLOCK.height;
  const D = BLOCK.depth;
  const L = BLOCK.payload;
  const inset = 0.06;
  for (let i = 0; i < count; i++) {
    const r = rnd();
    let sx: number, sy: number, sz: number;
    if (r < 0.58) {
      // small cubes and bricks
      const b = 0.09 + rnd() * 0.14;
      sx = b * (0.7 + rnd() * 0.8);
      sy = b * (0.7 + rnd() * 0.8);
      sz = b * (0.7 + rnd() * 0.8);
    } else if (r < 0.9) {
      // medium blocks
      const b = 0.22 + rnd() * 0.22;
      sx = b * (0.6 + rnd() * 0.9);
      sy = b * (0.6 + rnd() * 0.9);
      sz = b * (0.6 + rnd() * 0.9);
    } else {
      // big slabs: thin in one axis, long in another
      const long = 0.5 + rnd() * 0.5;
      const thin = 0.06 + rnd() * 0.08;
      const mid = 0.25 + rnd() * 0.3;
      const axis = rnd();
      if (axis < 0.4) [sx, sy, sz] = [thin, mid, long];
      else if (axis < 0.75) [sx, sy, sz] = [long, mid, thin];
      else [sx, sy, sz] = [mid, long, thin];
    }
    const x = x0 + inset + sx / 2 + rnd() * (L - 2 * inset - sx);
    const y = inset + sy / 2 + rnd() * (H - 2 * inset - sy);
    const z = -D / 2 + inset + sz / 2 + rnd() * (D - 2 * inset - sz);
    const base = new THREE.Color(SPECTRUM[Math.floor(rnd() * SPECTRUM.length)]);
    const hsl = { h: 0, s: 0, l: 0 };
    base.getHSL(hsl);
    base.setHSL((hsl.h + (rnd() - 0.5) * 0.04 + 1) % 1, Math.min(1, hsl.s * (0.9 + rnd() * 0.15)), hsl.l * (0.92 + rnd() * 0.16));
    items.push({ pos: [x, y, z], size: [sx, sy, sz], color: base });
  }
  return items;
}

// The lane's contents: one slab shape, one hue, a jittered grid. `prox` is how
// close the slab sits to an exposed wall (front, sides, top); deep slabs fade so
// the frost reads as depth, not as a texture.
const LANE_SLAB: [number, number, number] = [0.17, 0.36, 0.11];
interface LaneItem {
  pos: [number, number, number];
  rotY: number;
  prox: number;
}
function laneCrowd(seed: number, x0: number): LaneItem[] {
  const rnd = mulberry32(seed);
  const nx = 5;
  const ny = 3;
  const nz = 8;
  const inset = 0.1;
  const px = (BLOCK.lane - 2 * inset) / nx;
  const py = (BLOCK.height - 2 * inset) / ny;
  const pz = (BLOCK.depth - 2 * inset) / nz;
  const items: LaneItem[] = [];
  for (let ix = 0; ix < nx; ix++) {
    for (let iy = 0; iy < ny; iy++) {
      for (let iz = 0; iz < nz; iz++) {
        const x = x0 + inset + (ix + 0.5) * px + (rnd() - 0.5) * 0.12;
        const y = inset + (iy + 0.5) * py + (rnd() - 0.5) * 0.16;
        const z = -BLOCK.depth / 2 + inset + (iz + 0.5) * pz + (rnd() - 0.5) * 0.12;
        const dWall = Math.min(x - x0, x0 + BLOCK.lane - x, BLOCK.depth / 2 - Math.abs(z), BLOCK.height - y);
        const prox = 1 - Math.min(1, Math.max(0, dWall / 0.62));
        items.push({ pos: [x, y, z], rotY: (rnd() - 0.5) * 0.28, prox });
      }
    }
  }
  return items;
}

// ---------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------
const glassVert = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

// Outer glass shell: fresnel edge light + baked depth fog.
const glassFrag = /* glsl */ `
  uniform vec3 uFill;
  uniform vec3 uEdge;
  uniform float uFillAlpha;
  uniform float uEdgeStrength;
  uniform float uFresnelPow;
  uniform vec3 uKeyDir;
  uniform float uKeyStrength;
  uniform vec3 uFog;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uFogPush;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;

  void main() {
    vec3 n = normalize(vWorldNormal);
    vec3 v = normalize(cameraPosition - vWorldPos);
    float ndv = clamp(dot(n, v), 0.0, 1.0);
    float fres = pow(1.0 - ndv, uFresnelPow);
    float key = pow(clamp(dot(n, normalize(uKeyDir)), 0.0, 1.0), 2.0);

    vec3 col = mix(uFill, uEdge, clamp(fres * 1.4 + key * 0.5, 0.0, 1.0));
    float a = uFillAlpha + fres * uEdgeStrength + key * uKeyStrength;

    float d = distance(cameraPosition, vWorldPos);
    float f = smoothstep(uFogNear, uFogFar, d) * uFogPush;
    col = mix(col, uFog, f);
    a *= (1.0 - f * 0.9);

    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
  }
`;

// Payload crowd: instanced, per-instance colour, translucent with bright fresnel
// rims that go over 1.0 so bloom catches them. uDesat pulls the far blocks grey.
const crowdVert = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying vec3 vColor;
  varying float vSeed;
  void main() {
    vec4 local = vec4(position, 1.0);
    vec3 nrm = normal;
    vSeed = 0.0;
    #ifdef USE_INSTANCING
      local = instanceMatrix * local;
      nrm = mat3(instanceMatrix) * nrm;
      // a stable per-instance number from where the instance sits
      vSeed = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    #endif
    vColor = vec3(1.0);
    #ifdef USE_INSTANCING_COLOR
      vColor = instanceColor;
    #endif
    vec4 wp = modelMatrix * local;
    vWorldPos = wp.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * nrm);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const crowdFrag = /* glsl */ `
  uniform float uDesat;
  uniform float uBrightness;
  uniform float uAlpha;
  uniform float uTime;
  uniform float uShimmer;
  uniform vec3 uKeyDir;
  uniform vec3 uFog;
  uniform float uFogNear;
  uniform float uFogFar;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying vec3 vColor;
  varying float vSeed;

  void main() {
    vec3 n = normalize(vWorldNormal);
    vec3 v = normalize(cameraPosition - vWorldPos);
    float ndv = clamp(dot(n, v), 0.0, 1.0);
    float fres = pow(1.0 - ndv, 2.4);
    float key = pow(clamp(dot(n, normalize(uKeyDir)), 0.0, 1.0), 1.5);

    vec3 tint = vColor;
    float lum = dot(tint, vec3(0.299, 0.587, 0.114));
    tint = mix(tint, mix(vec3(lum), vec3(0.42, 0.52, 0.72), 0.6), uDesat);

    // per-instance shimmer: two slow sines whose periods divide the 8 s loop
    float k1 = 1.0 + floor(vSeed * 3.0);            // 1..3 cycles per loop
    float k2 = 2.0 + floor(fract(vSeed * 7.31) * 3.0); // 2..4 cycles per loop
    float ph = vSeed * 6.2831853;
    float w = 6.2831853 / 8.0;
    float shim = 0.6 * sin(uTime * w * k1 + ph) + 0.4 * sin(uTime * w * k2 + ph * 2.7);
    float bright = uBrightness * (1.0 + uShimmer * shim);

    // body colour, a lit top, and a hot rim tinted toward white
    vec3 col = tint * (0.55 + 0.35 * key) * bright
             + mix(tint, vec3(1.0), 0.15) * fres * 1.35 * bright;
    float a = (0.30 + 0.25 * key + 0.5 * fres) * uAlpha;

    float d = distance(cameraPosition, vWorldPos);
    float f = smoothstep(uFogNear, uFogFar, d);
    col = mix(col, uFog, f);
    a *= (1.0 - f * 0.85);

    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
  }
`;

// Shielded lane: smoked indigo glass, near-opaque, cool rim, faint inner glow.
const laneFrag = /* glsl */ `
  uniform vec3 uBody;
  uniform vec3 uRim;
  uniform float uGlow;
  uniform float uBodyAlpha;
  uniform vec3 uFog;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uFogPush;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;

  void main() {
    vec3 n = normalize(vWorldNormal);
    vec3 v = normalize(cameraPosition - vWorldPos);
    float ndv = clamp(dot(n, v), 0.0, 1.0);
    // only true grazing angles light the rim; angled faces stay smoked
    float fres = pow(1.0 - ndv, 9.0);
    float top = clamp(n.y, 0.0, 1.0);

    // a very subtle cool core, brighter toward the vertical middle
    float core = 1.0 - abs(vWorldPos.y / ${BLOCK.height.toFixed(2)} * 2.0 - 1.0);
    vec3 col = uBody * (1.0 + 0.35 * top)
             + uRim * fres * 0.7
             + uRim * core * 0.28 * uGlow;
    float a = uBodyAlpha + (1.0 - uBodyAlpha) * fres;

    float d = distance(cameraPosition, vWorldPos);
    float f = smoothstep(uFogNear, uFogFar, d) * uFogPush;
    col = mix(col, uFog, f);

    gl_FragColor = vec4(col, a);
  }
`;

// Lane contents: soft-faced slabs, one hue, additive so overlaps pool into a
// glow instead of stacking edges. vColor.r carries wall proximity. No rims.
const laneCrowdFrag = /* glsl */ `
  uniform vec3 uHue;
  uniform float uBrightness;
  uniform vec3 uFog;
  uniform float uFogNear;
  uniform float uFogFar;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying vec3 vColor;

  void main() {
    vec3 n = normalize(vWorldNormal);
    vec3 v = normalize(cameraPosition - vWorldPos);
    float ndv = clamp(dot(n, v), 0.0, 1.0);
    // faces turned to the camera glow; grazing faces vanish, so nothing is crisp
    float soft = smoothstep(0.0, 0.9, ndv);
    float top = clamp(n.y, 0.0, 1.0);
    vec3 col = uHue * (0.65 + 0.35 * top) * soft * vColor.r * uBrightness;

    float d = distance(cameraPosition, vWorldPos);
    float f = smoothstep(uFogNear, uFogFar, d);
    col *= (1.0 - f * 0.9);

    gl_FragColor = vec4(col, 1.0);
  }
`;

// Frost: a milky sheen on the lane shell that whitens toward the silhouette.
const frostFrag = /* glsl */ `
  uniform vec3 uMilk;
  uniform float uStrength;
  uniform vec3 uFog;
  uniform float uFogNear;
  uniform float uFogFar;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;

  void main() {
    vec3 n = normalize(vWorldNormal);
    vec3 v = normalize(cameraPosition - vWorldPos);
    float ndv = clamp(dot(n, v), 0.0, 1.0);
    float fres = pow(1.0 - ndv, 3.0);
    float top = clamp(n.y, 0.0, 1.0);
    float a = (0.015 + 0.17 * fres + 0.02 * top) * uStrength;

    float d = distance(cameraPosition, vWorldPos);
    float f = smoothstep(uFogNear, uFogFar, d);
    vec3 col = mix(uMilk, uFog, f);
    a *= (1.0 - f * 0.9);

    gl_FragColor = vec4(col, a);
  }
`;

// Chain hairline: flat luminous colour with one soft travelling brightness pulse.
const linkFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uPulseX;
  uniform float uPulseW;
  uniform float uPulseA;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  void main() {
    float dx = (vWorldPos.x - uPulseX) / uPulseW;
    float p = exp(-dx * dx) * uPulseA;
    gl_FragColor = vec4(uColor * (1.0 + 3.2 * p), min(1.0, uOpacity + 0.1 * p));
  }
`;

const useGlassMaterial = (fill: string, edge: string, fillAlpha: number, edgeStrength: number) =>
  useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: glassVert,
        fragmentShader: glassFrag,
        uniforms: {
          uFill: { value: new THREE.Color(fill) },
          uEdge: { value: new THREE.Color(edge) },
          uFillAlpha: { value: fillAlpha },
          uEdgeStrength: { value: edgeStrength },
          uFresnelPow: { value: 4.5 },
          uKeyDir: { value: new THREE.Vector3(0.3, 1.0, 0.6) },
          uKeyStrength: { value: 0.04 },
          uFog: { value: new THREE.Color(VOID) },
          uFogNear: { value: FOG_NEAR },
          uFogFar: { value: FOG_FAR },
          uFogPush: { value: 1.0 },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.FrontSide,
      }),
    [fill, edge, fillAlpha, edgeStrength]
  );

// ---------------------------------------------------------------------------
// Scene pieces
// ---------------------------------------------------------------------------
// The dolly is a pure translation of both the eye and the look target, so the
// framing parallaxes along the chain without any orbit.
const CameraRig: React.FC<{ cfg: VariantCfg; offset: [number, number, number] }> = ({ cfg, offset }) => {
  const { camera } = useThree();
  const [ox, oy, oz] = offset;
  useLayoutEffect(() => {
    camera.position.set(cfg.pos[0] + ox, cfg.pos[1] + oy, cfg.pos[2] + oz);
    (camera as THREE.PerspectiveCamera).fov = cfg.fov;
    camera.lookAt(new THREE.Vector3(cfg.look[0] + ox, cfg.look[1] + oy, cfg.look[2] + oz));
    camera.updateProjectionMatrix();
  }, [camera, cfg, ox, oy, oz]);
  return null;
};

// Thin luminous edges for a box: the silhouette of a discrete block.
// Opacity is written onto the material each frame rather than rebuilding it.
const BoxEdges: React.FC<{ size: [number, number, number]; position: [number, number, number]; color: string; opacity: number }> = ({
  size,
  position,
  color,
  opacity,
}) => {
  const geo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(...size)), [size]);
  const mat = useMemo(() => new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false, fog: true }), [color]);
  mat.opacity = opacity;
  return <lineSegments geometry={geo} material={mat} position={position} renderOrder={4} />;
};

const Crowd: React.FC<{
  seed: number;
  count: number;
  x0: number;
  desat: number;
  brightness: number;
  alpha: number;
  camPos: [number, number, number];
  time: number;
  shimmer: number;
}> = ({ seed, count, x0, desat, brightness, alpha, camPos, time, shimmer }) => {
  const mesh = useMemo(() => {
    const items = payloadCrowd(seed, count, x0);
    // near-static camera (the dolly is a few percent): draw far to near from the
    // base eye so normal blending stacks sanely
    const cam = new THREE.Vector3(...camPos);
    items.sort((p, q) => cam.distanceTo(new THREE.Vector3(...q.pos)) - cam.distanceTo(new THREE.Vector3(...p.pos)));
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.ShaderMaterial({
      vertexShader: crowdVert,
      fragmentShader: crowdFrag,
      uniforms: {
        uDesat: { value: desat },
        uBrightness: { value: brightness },
        uAlpha: { value: alpha },
        uTime: { value: 0 },
        uShimmer: { value: shimmer },
        uKeyDir: { value: new THREE.Vector3(0.3, 1.0, 0.6) },
        uFog: { value: new THREE.Color(VOID) },
        uFogNear: { value: FOG_NEAR },
        uFogFar: { value: FOG_FAR },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
    });
    const m = new THREE.InstancedMesh(geo, mat, items.length);
    const tmp = new THREE.Object3D();
    items.forEach((it, i) => {
      tmp.position.set(...it.pos);
      tmp.scale.set(...it.size);
      tmp.rotation.set(0, 0, 0);
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
      m.setColorAt(i, it.color);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.renderOrder = 1;
    m.frustumCulled = false;
    return m;
  }, [seed, count, x0, desat, brightness, alpha, camPos, shimmer]);
  (mesh.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
  return <primitive object={mesh} />;
};

// The crowd inside the lane: present, uniform, unreadable.
const LaneCrowd: React.FC<{ seed: number; x0: number; dim: number; camPos: [number, number, number] }> = ({ seed, x0, dim, camPos }) => {
  const mesh = useMemo(() => {
    const items = laneCrowd(seed, x0);
    const cam = new THREE.Vector3(...camPos);
    items.sort((p, q) => cam.distanceTo(new THREE.Vector3(...q.pos)) - cam.distanceTo(new THREE.Vector3(...p.pos)));
    const geo = new THREE.BoxGeometry(...LANE_SLAB);
    const mat = new THREE.ShaderMaterial({
      vertexShader: crowdVert,
      fragmentShader: laneCrowdFrag,
      uniforms: {
        uHue: { value: new THREE.Color('#4576e8') },
        uBrightness: { value: 0.42 * dim },
        uFog: { value: new THREE.Color(VOID) },
        uFogNear: { value: FOG_NEAR },
        uFogFar: { value: FOG_FAR },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
    });
    const m = new THREE.InstancedMesh(geo, mat, items.length);
    const tmp = new THREE.Object3D();
    items.forEach((it, i) => {
      tmp.position.set(...it.pos);
      tmp.scale.set(1, 1, 1);
      tmp.rotation.set(0, it.rotY, 0);
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
      const b = 0.22 + 0.78 * it.prox;
      m.setColorAt(i, new THREE.Color(b, b, b));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.renderOrder = 1;
    m.frustumCulled = false;
    return m;
  }, [seed, x0, dim, camPos]);
  return <primitive object={mesh} />;
};

const LaneBox: React.FC<{ x0: number; glow: number; dim: number; seed: number; camPos: [number, number, number] }> = ({
  x0,
  glow,
  dim,
  seed,
  camPos,
}) => {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: glassVert,
        fragmentShader: laneFrag,
        uniforms: {
          uBody: { value: new THREE.Color('#10143a') },
          uRim: { value: new THREE.Color('#6d8cff').multiplyScalar(dim) },
          uGlow: { value: glow },
          uBodyAlpha: { value: 0.76 },
          uFog: { value: new THREE.Color(VOID) },
          uFogNear: { value: FOG_NEAR },
          uFogFar: { value: FOG_FAR },
          uFogPush: { value: 1.0 },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.FrontSide,
      }),
    [dim]
  );
  mat.uniforms.uGlow.value = glow; // breathes per frame
  const frost = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: glassVert,
        fragmentShader: frostFrag,
        uniforms: {
          uMilk: { value: new THREE.Color('#b7c6ea') },
          uStrength: { value: dim },
          uFog: { value: new THREE.Color(VOID) },
          uFogNear: { value: FOG_NEAR },
          uFogFar: { value: FOG_FAR },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.FrontSide,
      }),
    [dim]
  );
  return (
    <group>
      <LaneCrowd seed={seed} x0={x0} dim={dim} camPos={camPos} />
      <RoundedBox
        args={[BLOCK.lane, BLOCK.height, BLOCK.depth]}
        radius={0.03}
        smoothness={4}
        position={[x0 + BLOCK.lane / 2, BLOCK.height / 2, 0]}
        material={mat}
        renderOrder={3}
      />
      {/* a second, slightly larger shell: the frost */}
      <RoundedBox
        args={[BLOCK.lane * 1.015, BLOCK.height * 1.015, BLOCK.depth * 1.01]}
        radius={0.03}
        smoothness={4}
        position={[x0 + BLOCK.lane / 2, BLOCK.height / 2, 0]}
        material={frost}
        renderOrder={3.5}
      />
      <BoxEdges
        size={[BLOCK.lane, BLOCK.height, BLOCK.depth]}
        position={[x0 + BLOCK.lane / 2, BLOCK.height / 2, 0]}
        color="#8fa6ff"
        opacity={0.35 * dim}
      />
    </group>
  );
};

// Luminous hairline joining two neighbours across the chain gap. One soft
// brightness pulse travels the chain; it is written into the uniforms per frame.
const Link: React.FC<{ from: number; to: number; dim: number; pulseX: number; pulseA: number }> = ({ from, to, dim, pulseX, pulseA }) => {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: glassVert,
        fragmentShader: linkFrag,
        uniforms: {
          uColor: { value: new THREE.Color('#9fd4ff').multiplyScalar(1.6 * dim) },
          uOpacity: { value: 0.9 },
          uPulseX: { value: -1000 },
          uPulseW: { value: LINK_PULSE_W },
          uPulseA: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [dim]
  );
  mat.uniforms.uPulseX.value = pulseX;
  mat.uniforms.uPulseA.value = pulseA;
  const len = to - from;
  return (
    <group>
      <mesh position={[from + len / 2, BLOCK.height * 0.5, 0]} material={mat} renderOrder={2}>
        <boxGeometry args={[len, 0.014, 0.014]} />
      </mesh>
      <mesh position={[from, BLOCK.height * 0.5, 0]} material={mat} renderOrder={2}>
        <sphereGeometry args={[0.035, 12, 12]} />
      </mesh>
      <mesh position={[to, BLOCK.height * 0.5, 0]} material={mat} renderOrder={2}>
        <sphereGeometry args={[0.035, 12, 12]} />
      </mesh>
    </group>
  );
};

interface BlockProps {
  k: number; // 0 = block N
  focus: boolean;
  glow: number;
  camPos: [number, number, number];
  motion: Motion;
}

const Block: React.FC<BlockProps> = ({ k, focus, glow, camPos, motion }) => {
  const x0 = blockX0(k);
  const laneX0 = x0 + BLOCK.payload + BLOCK.join;
  const dim = focus ? 1 : 0.55;
  const shell = useGlassMaterial(focus ? '#3a5aa8' : '#2a3c6e', '#c8e2ff', focus ? 0.02 : 0.015, focus ? 0.45 : 0.3);
  return (
    <group>
      <Crowd
        seed={17 + k * 31}
        count={focus ? 340 : 160}
        x0={x0}
        desat={focus ? 0 : 0.9}
        brightness={focus ? 1 : 0.4}
        alpha={focus ? 1 : 0.55}
        camPos={camPos}
        time={motion.t}
        shimmer={focus ? 0.07 : 0.04}
      />
      <RoundedBox
        args={[BLOCK.payload, BLOCK.height, BLOCK.depth]}
        radius={0.03}
        smoothness={4}
        position={[x0 + BLOCK.payload / 2, BLOCK.height / 2, 0]}
        material={shell}
        renderOrder={3}
      />
      <BoxEdges
        size={[BLOCK.payload, BLOCK.height, BLOCK.depth]}
        position={[x0 + BLOCK.payload / 2, BLOCK.height / 2, 0]}
        color="#bcd6ff"
        opacity={0.45 * dim}
      />
      <LaneBox x0={laneX0} glow={glow} dim={dim} seed={101 + k * 7} camPos={camPos} />
      {/* link back to the previous block */}
      <Link from={blockX0(k - 1) + BLOCK_LEN} to={x0} dim={dim} pulseX={motion.linkPulseX} pulseA={motion.linkPulseA} />
    </group>
  );
};

// N+1: not built yet. Silhouette only.
const GhostBlock: React.FC<{ k: number; motion: Motion }> = ({ k, motion }) => {
  const x0 = blockX0(k);
  const laneX0 = x0 + BLOCK.payload + BLOCK.join;
  return (
    <group>
      <BoxEdges
        size={[BLOCK.payload, BLOCK.height, BLOCK.depth]}
        position={[x0 + BLOCK.payload / 2, BLOCK.height / 2, 0]}
        color="#7f93c4"
        opacity={0.3}
      />
      <BoxEdges
        size={[BLOCK.lane, BLOCK.height, BLOCK.depth]}
        position={[laneX0 + BLOCK.lane / 2, BLOCK.height / 2, 0]}
        color="#7f93c4"
        opacity={0.22}
      />
      <Link from={blockX0(k - 1) + BLOCK_LEN} to={x0} dim={0.35} pulseX={motion.linkPulseX} pulseA={motion.linkPulseA} />
    </group>
  );
};

// ---------------------------------------------------------------------------
// Detail 2: a dashed outline that encloses payload and lane as one block
// ---------------------------------------------------------------------------
const DashedPath: React.FC<{ points: [number, number, number][]; color: string; opacity: number; dash: number; gap: number }> = ({
  points,
  color,
  opacity,
  dash,
  gap,
}) => {
  const line = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(...p)));
    const mat = new THREE.LineDashedMaterial({
      color,
      dashSize: dash,
      gapSize: gap,
      transparent: true,
      opacity,
      depthWrite: false,
      fog: true,
    });
    const l = new THREE.Line(geo, mat);
    l.computeLineDistances();
    l.renderOrder = 5;
    return l;
  }, [points, color, opacity, dash, gap]);
  return <primitive object={line} />;
};

const BlockOutline: React.FC<{ k: number }> = ({ k }) => {
  const m = OUTLINE_MARGIN;
  const xa = blockX0(k) - m;
  const xb = blockX0(k) + BLOCK_LEN + m;
  const za = -BLOCK.depth / 2 - m;
  const zb = BLOCK.depth / 2 + m;
  const y = 0.008;
  const top = BLOCK.height + 0.12;
  const loop = useMemo<[number, number, number][]>(
    () => [
      [xa, y, zb],
      [xb, y, zb],
      [xb, y, za],
      [xa, y, za],
      [xa, y, zb],
    ],
    [xa, xb, za, zb]
  );
  const corners = useMemo<[number, number, number][][]>(
    () =>
      [
        [xa, zb],
        [xb, zb],
        [xb, za],
        [xa, za],
      ].map(([x, z]) => [
        [x, y, z],
        [x, top, z],
      ]),
    [xa, xb, za, zb, top]
  );
  return (
    <group>
      <DashedPath points={loop} color="#d6e4ff" opacity={0.5} dash={0.16} gap={0.11} />
      {corners.map((pts, i) => (
        <DashedPath key={i} points={pts} color="#d6e4ff" opacity={0.22} dash={0.09} gap={0.09} />
      ))}
    </group>
  );
};

// ---------------------------------------------------------------------------
// Detail 3: the beacon chain, a parallel row of small consensus slabs above
// ---------------------------------------------------------------------------
const Hairline: React.FC<{ from: [number, number, number]; to: [number, number, number]; opacity: number }> = ({ from, to, opacity }) => {
  const line = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...from), new THREE.Vector3(...to)]);
    const mat = new THREE.LineBasicMaterial({ color: '#cfe6ff', transparent: true, opacity, depthWrite: false, fog: true });
    const l = new THREE.Line(geo, mat);
    l.renderOrder = 5;
    return l;
  }, [from, to]);
  (line.material as THREE.LineBasicMaterial).opacity = opacity;
  return <primitive object={line} />;
};

// A small point of light sliding down a hairline: the commitment on its way.
const Spark: React.FC<{ from: [number, number, number]; to: [number, number, number]; progress: number }> = ({ from, to, progress }) => {
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#dff3ff').multiplyScalar(1.6),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  );
  if (progress < 0) return null;
  const env = Math.sin(Math.PI * progress);
  mat.opacity = 0.9 * env;
  const p: [number, number, number] = [
    from[0] + (to[0] - from[0]) * progress,
    from[1] + (to[1] - from[1]) * progress,
    from[2] + (to[2] - from[2]) * progress,
  ];
  return (
    <mesh position={p} material={mat} renderOrder={6} scale={0.7 + 0.5 * env}>
      <sphereGeometry args={[0.03, 10, 10]} />
    </mesh>
  );
};

// A small crystalline slab. `bright` = slot N; `ghost` = the slot that is not yet proposed.
// `pulse` (0..1) lifts the bright slot's core and edges once: the commit.
const BeaconBlock: React.FC<{ k: number; bright?: boolean; ghost?: boolean; dim: number; pulse?: number }> = ({ k, bright, ghost, dim, pulse = 0 }) => {
  const cx = blockX0(k) + BLOCK_LEN / 2;
  const shell = useGlassMaterial(bright ? '#8fd3ff' : '#6f9ad0', bright ? '#eafaff' : '#cfe2ff', bright ? 0.1 : 0.05, bright ? 0.7 : 0.35);
  const core = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#c9f0ff').multiplyScalar(1.15),
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  );
  core.color.set('#c9f0ff').multiplyScalar(1.15 * (1 + 0.28 * pulse));
  const pos: [number, number, number] = [cx, BEACON.y, 0];
  const size: [number, number, number] = [BEACON.w, BEACON.h, BEACON.d];
  if (ghost) {
    return <BoxEdges size={size} position={pos} color="#9ab6e0" opacity={0.28} />;
  }
  return (
    <group>
      {bright && (
        <mesh position={pos} material={core} renderOrder={2} scale={[1 + 0.08 * pulse, 1 + 0.2 * pulse, 1 + 0.08 * pulse]}>
          <boxGeometry args={[BEACON.w * 0.5, BEACON.h * 0.3, BEACON.d * 0.46]} />
        </mesh>
      )}
      <RoundedBox args={size} radius={0.02} smoothness={3} position={pos} material={shell} renderOrder={3} />
      <BoxEdges size={size} position={pos} color={bright ? '#e6f7ff' : '#bcd6ff'} opacity={(bright ? 0.75 + 0.18 * pulse : 0.42) * dim} />
    </group>
  );
};

const BeaconLink: React.FC<{ from: number; to: number; dim: number }> = ({ from, to, dim }) => {
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#bfe6ff').multiplyScalar(0.9 * dim),
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        toneMapped: false,
      }),
    [dim]
  );
  const len = to - from;
  return (
    <mesh position={[from + len / 2, BEACON.y, 0]} material={mat} renderOrder={2}>
      <boxGeometry args={[len, 0.01, 0.01]} />
    </mesh>
  );
};

const BeaconChain: React.FC<{ motion: Motion }> = ({ motion }) => {
  const cx = blockX0(0) + BLOCK_LEN / 2;
  const payCx = blockX0(0) + BLOCK.payload / 2;
  const laneCx = blockX0(0) + BLOCK.payload + BLOCK.join + BLOCK.lane / 2;
  const half = BEACON.w / 2;
  const bottom = useMemo<[number, number, number]>(() => [cx, BEACON.y - BEACON.h / 2, 0], [cx]);
  const payTop = useMemo<[number, number, number]>(() => [payCx, BLOCK.height, 0], [payCx]);
  const laneTop = useMemo<[number, number, number]>(() => [laneCx, BLOCK.height, 0], [laneCx]);
  const hair = 0.4 + 0.45 * motion.hairline;
  return (
    <group>
      <BeaconBlock k={-2} dim={0.35} />
      <BeaconBlock k={-1} dim={0.6} />
      <BeaconBlock k={0} bright dim={1} pulse={motion.commit} />
      <BeaconBlock k={1} ghost dim={1} />
      <BeaconLink from={blockX0(-2) + BLOCK_LEN / 2 + half} to={blockX0(-1) + BLOCK_LEN / 2 - half} dim={0.35} />
      <BeaconLink from={blockX0(-1) + BLOCK_LEN / 2 + half} to={cx - half} dim={0.6} />
      <BeaconLink from={cx + half} to={blockX0(1) + BLOCK_LEN / 2 - half} dim={0.3} />
      {/* slot N commits to both halves of block N; after the pulse the commitment runs down */}
      <Hairline from={bottom} to={payTop} opacity={hair} />
      <Hairline from={bottom} to={laneTop} opacity={hair} />
      <Spark from={bottom} to={payTop} progress={motion.propagate} />
      <Spark from={bottom} to={laneTop} progress={motion.propagate} />
    </group>
  );
};

const Floor: React.FC = () => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
    <planeGeometry args={[400, 400]} />
    <MeshReflectorMaterial
      color="#141f38"
      mirror={0.9}
      blur={[600, 600]}
      mixBlur={1.2}
      mixStrength={55}
      mixContrast={1}
      resolution={1024}
      depthScale={0.3}
      minDepthThreshold={0.5}
      maxDepthThreshold={2.0}
      roughness={0.6}
      metalness={0.4}
    />
  </mesh>
);

// Far horizon haze: a soft cool band low in the void behind the chain.
const hazeFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uAccent;
  varying vec2 vUv;
  void main() {
    vec2 c = vUv - vec2(0.42, 0.0);
    c.x *= 2.2;
    float g = exp(-dot(c, c) * 14.0);
    float rise = smoothstep(0.0, 0.06, vUv.y);
    float band = exp(-vUv.y * 9.0) * rise;
    vec3 col = uColor * band * 0.7 + uAccent * g * rise * 0.5;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const HorizonHaze: React.FC = () => {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: hazeFrag,
        uniforms: {
          uColor: { value: new THREE.Color('#0b1530') },
          uAccent: { value: new THREE.Color('#12304a') },
        },
        depthWrite: false,
        fog: false,
      }),
    []
  );
  return (
    <mesh position={[-30, 30, -60]} rotation={[0, 0.25, 0]} material={mat}>
      <planeGeometry args={[320, 60]} />
    </mesh>
  );
};

const Scene: React.FC<{ cfg: VariantCfg; detail: HeroDetail; motion: Motion }> = ({ cfg, detail, motion }) => {
  const laneCx = blockX0(0) + BLOCK.payload + BLOCK.join + BLOCK.lane / 2;
  const payCx = blockX0(0) + BLOCK.payload / 2;
  const laneGlow = cfg.laneGlow * motion.laneGlowMul;
  return (
    <>
      <CameraRig cfg={cfg} offset={motion.camOffset} />
      <color attach="background" args={[VOID]} />
      <fog attach="fog" args={[VOID, FOG_NEAR * 0.8, FOG_FAR]} />
      <hemisphereLight color="#22304f" groundColor="#04070f" intensity={2.0} />
      {/* the payload is the light in this scene: warm-white spill on the floor */}
      <pointLight position={[payCx, BLOCK.height * 0.8, 0]} color="#ffd9e6" intensity={3.5} distance={11} decay={2} />
      {/* the lane keeps to itself: a cool, dim pool that breathes with the inner glow */}
      <pointLight position={[laneCx, BLOCK.height * 0.5, 0]} color="#5f7dff" intensity={1.2 + laneGlow * 2.0} distance={5} decay={2} />
      <HorizonHaze />
      <Floor />
      <Block k={-2} focus={false} glow={cfg.laneGlow * 0.5} camPos={cfg.pos} motion={motion} />
      <Block k={-1} focus={false} glow={cfg.laneGlow * 0.5} camPos={cfg.pos} motion={motion} />
      <Block k={0} focus glow={laneGlow} camPos={cfg.pos} motion={motion} />
      <GhostBlock k={1} motion={motion} />
      {detail >= 2 && <BlockOutline k={0} />}
      {detail >= 3 && <BeaconChain motion={motion} />}
      <EffectComposer multisampling={0}>
        <Bloom intensity={1.4} luminanceThreshold={0.65} luminanceSmoothing={0.3} mipmapBlur radius={0.7} />
        <Vignette offset={0.28} darkness={0.55} blendFunction={BlendFunction.NORMAL} />
      </EffectComposer>
    </>
  );
};

// ---------------------------------------------------------------------------
// HUD captions, placed by projecting scene points with the same camera
// ---------------------------------------------------------------------------
function makeProjector(cfg: VariantCfg, width: number, height: number) {
  const cam = new THREE.PerspectiveCamera(cfg.fov, width / height, 0.1, 120);
  cam.position.set(...cfg.pos);
  cam.lookAt(new THREE.Vector3(...cfg.look));
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  return (x: number, y: number, z: number): [number, number] => {
    const p = new THREE.Vector3(x, y, z).project(cam);
    return [((p.x + 1) / 2) * width, ((1 - p.y) / 2) * height];
  };
}

const Caption: React.FC<{ x: number; y: number; dim?: boolean; children: string }> = ({ x, y, dim, children }) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      transform: 'translateX(-50%)',
      fontFamily: MONO,
      fontSize: 26,
      letterSpacing: '0.02em',
      color: '#e6edf7',
      opacity: dim ? 0.42 : 0.9,
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </div>
);

// ---------------------------------------------------------------------------
export const SL_Hero3D: React.FC<{ variant?: HeroVariant; detail?: HeroDetail }> = ({ variant = 'a', detail = 3 }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const cfg = VARIANTS[variant];
  const motion = useMemo(() => motionAt(frame, fps), [frame, fps]);

  const labels = useMemo(() => {
    const project = makeProjector(cfg, width, height);
    const front = BLOCK.depth / 2;
    const x0 = blockX0(0);
    const payCx = x0 + BLOCK.payload / 2;
    const laneCx = x0 + BLOCK.payload + BLOCK.join + BLOCK.lane / 2;
    const blockCx = x0 + BLOCK_LEN / 2;
    const prevCx = blockX0(-1) + BLOCK_LEN / 2;
    const pay = project(payCx, 0, front);
    const lane = project(laneCx, 0, front);
    const blk = project(blockCx, 0, front);
    const prev = project(prevCx, 0, front);
    const slot = project(blockCx, BEACON.y - BEACON.h / 2, BEACON.d / 2);
    const beacon = project(prevCx, BEACON.y + BEACON.h / 2, BEACON.d / 2);
    return {
      payload: [pay[0], pay[1] + 26] as [number, number],
      lane: [lane[0], lane[1] + 26] as [number, number],
      block: [blk[0], blk[1] + 150] as [number, number],
      prev: [prev[0], prev[1] + 20] as [number, number],
      slot: [slot[0] + 130, slot[1] + 22] as [number, number],
      beacon: [beacon[0], beacon[1] - 48] as [number, number],
    };
  }, [cfg, width, height]);

  return (
    <div style={{ width: '100%', height: '100%', background: VOID, position: 'relative' }}>
      <ThreeCanvas
        width={width}
        height={height}
        style={{ width, height }}
        dpr={1}
        camera={{ position: cfg.pos, fov: cfg.fov, near: 0.1, far: 120 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      >
        <Scene cfg={cfg} detail={detail} motion={motion} />
      </ThreeCanvas>
      <Caption x={labels.payload[0]} y={labels.payload[1]}>public lane</Caption>
      <Caption x={labels.lane[0]} y={labels.lane[1]}>shielded lane</Caption>
      <Caption x={labels.block[0]} y={labels.block[1]}>block N</Caption>
      <Caption x={labels.prev[0]} y={labels.prev[1]} dim>N-1</Caption>
      {detail >= 3 && (
        <>
          <Caption x={labels.beacon[0]} y={labels.beacon[1]} dim>beacon chain</Caption>
          <Caption x={labels.slot[0]} y={labels.slot[1]}>slot N</Caption>
        </>
      )}
    </div>
  );
};

export const SL_Hero3D_A: React.FC = () => <SL_Hero3D variant="a" />;
export const SL_Hero3D_B: React.FC = () => <SL_Hero3D variant="b" />;

export default SL_Hero3D;
