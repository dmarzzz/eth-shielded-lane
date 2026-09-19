/**
 * SL_Film - one slot pair in the life of a shielded-lane block, ~27.7 s at 30 fps (830 frames).
 *
 * v9 stages confirmation in two steps: the proposer's commit runs one green light around the hull's
 * outer perimeter and leaves the edges lit; the attestations then fill the hull's outer faces with
 * translucent green in proportion to the count, so the whole block reads as secured at the quorum.
 * v8's other experiment stays: B, the
 * builder is an actor - a gantry press on the floor that public transactions run through, bids to
 * the proposer, and hands over the payload at the reveal. The lane committee is a ring of 16 nodes
 * above the shielded compartment: slabs touch the ring, gossip hops node to node, the copy drops in.
 *
 * The 3D scene is the SL-Hero3D look (variant "c" camera): a chain of glass blocks on a fogged
 * floor, the beacon row above, the attester field behind. Block N is ONE glass hull on one base
 * plate with a thin internal partition at ~72 % of its length: left compartment = public lane,
 * right compartment = shielded lane (smoked, frosted). A swimlane timeline along the bottom keeps
 * the real slot clock (builder, lane committee, lane proposer, proposer, attesters, execution).
 *
 *   act 1  f0-240    slot N t=0..8    public cubes queue onto the builder's rail, are pressed under its
 *                                     gantry and leave aligned into the public compartment (dim); shielded
 *                                     slabs fly to the committee ring, gossip hops around the 16 nodes,
 *                                     and a copy drops into the shielded compartment
 *   act 2  f240-360  slot N t=8..12   t=8 the lane lists are broadcast (the ring flashes); t=9 view freeze;
 *                                     t=11 one aggregate proof slab forms on the hull top, proof line rises
 *   act 3  f360-720  slot N+1         t=0 the proposer emits the beacon block, the commit trunk lands on
 *                                     the hull top and branches to both compartments; attesters stream
 *                                     attestations until quorum at t=3; t=6 payload snaps to colour;
 *                                     t~7.8 a cursor executes public then shielded with counters;
 *                                     t=9 the PTC votes payload available; t=11 the hull seals
 *   tail   f690-830  hold, one-block camera advance, hold on the empty N+1, fade, end card
 *
 * Render: npx remotion render src/index.tsx SL-Film out/shieldedlane/video/SL-Film.mp4 --gl=angle --codec=h264 --crf=18
 *
 * Colour pipeline: HDR composite -> bloom (high threshold) -> AgX -> grain -> vignette; sRGB out.
 * Lighting: procedural PMREM environment + one shadowed key + one cool rim; no flat ambient.
 */

import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { DmarzMark } from './DmarzMark';
import { ThreeCanvas } from '@remotion/three';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBox, MeshReflectorMaterial } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, DepthOfField, ToneMapping, Noise } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode, DepthOfFieldEffect } from 'postprocessing';

const MONO = "ui-monospace, 'SF Mono', Menlo, monospace";
type V3 = [number, number, number];

// ---------------------------------------------------------------------------
// Scene constants
// ---------------------------------------------------------------------------
const VOID = '#04070f';
const FOG_NEAR = 8;
const FOG_FAR = 32;

// One hull: public compartment | partition | shielded compartment
const BLOCK = { height: 1.5, depth: 2.6, payload: 5.75, join: 0.04, lane: 2.25, chainGap: 1.9 };
const BLOCK_LEN = BLOCK.payload + BLOCK.join + BLOCK.lane;
const PITCH = BLOCK_LEN + BLOCK.chainGap;
const PLATE = { pad: 0.36, h: 0.05 };
const HY = PLATE.h; // the hull sits on the base plate
const HULL_TOP = HY + BLOCK.height;
const BEACON = { y: 3.05, w: 1.15, h: 0.26, d: 0.72 };
const CAM = { pos: [6.3, 4.8, 11.3] as V3, look: [-1.0, -0.05, 0] as V3, fov: 40, laneGlow: 0.35 };

const blockX0 = (k: number) => k * PITCH - BLOCK_LEN / 2;
const X0_N = blockX0(0);
const LANE_X0 = X0_N + BLOCK.payload + BLOCK.join;
const PAY_CX = X0_N + BLOCK.payload / 2;
const LANE_CX = LANE_X0 + BLOCK.lane / 2;
const BLOCK_CX = X0_N + BLOCK_LEN / 2;

// Film-only anchors
const MEMPOOL: V3 = [-7.6, 0.25, 4.8];
// The builder is an actor, not a caption: a gantry press on a low metal platform, standing on the
// empty floor between the mempool cloud and the hull, on the line the public transactions travel.
// Cubes queue onto its rail, a scanning bar presses each one, and they leave aligned and dim.
const BUILDER: V3 = [-5.0, 0.34, 3.0];
// the rig's bounding box: platform on the floor up to the crossbar. Same footprint as the old slab.
const BUILDER_SIZE: V3 = [1.05, 0.78, 0.62];
const SHIELD_ORIGIN: V3 = [8.6, 2.3, -0.9];
// the lane committee: 16 nodes on a tilted ring floating above-right of the shielded compartment
const RING_C: V3 = [4.7, 2.7, 1.4];
const RING_R = 0.72;
const RING_N = 16;
const PROPOSER: V3 = [BLOCK_CX - 0.35, BEACON.y + 0.48, -0.5];

// the builder's own axis: it faces the public compartment, so cubes run in one end and out the other
const BUILDER_DIR: V3 = (() => {
  const dx = PAY_CX - BUILDER[0];
  const dz = 0 - BUILDER[2];
  const L = Math.hypot(dx, dz);
  return [dx / L, 0, dz / L];
})();
const BUILDER_ROTY = Math.atan2(-BUILDER_DIR[2], BUILDER_DIR[0]);
const bPort = (t: number): V3 => [BUILDER[0] + BUILDER_DIR[0] * t, BUILDER[1], BUILDER[2] + BUILDER_DIR[2] * t];
const BUILDER_IN: V3 = bPort(-BUILDER_SIZE[0] / 2 + 0.03);
const BUILDER_OUT: V3 = bPort(BUILDER_SIZE[0] / 2 - 0.03);
const BUILDER_TOP: V3 = [BUILDER[0], BUILDER[1] + 0.44, BUILDER[2]]; // the crossbar's top edge
// every packed cube leaves along the same short rail, so the exit reads as one queue
const BUILDER_RAIL: V3 = [BUILDER_OUT[0] + BUILDER_DIR[0] * 1.45, HY + 0.66, BUILDER_OUT[2] + BUILDER_DIR[2] * 1.45];
// the reveal pulse runs from the builder to the near end of the public compartment
const PAY_DOOR: V3 = [PAY_CX - 1.25, HY + BLOCK.height * 0.44, 0.35];

// the rig, in the builder's local frame (+x = the direction of travel, y=0 = the cube lane).
// The platform bottom sits on the floor; the crossbar top is BUILDER_TOP.
const RIG = {
  plat: [1.05, 0.06, 0.62] as V3,
  platY: -0.31,
  railY: -0.20,
  railZ: 0.115,
  legX: 0.24,
  postZ: 0.27,
  postY: 0.08,
  postH: 0.72,
  barY: 0.40,
  capY: 0.437,
  headUp: 0.325,
  headDown: 0.19,
};
const PRESS_P = 8; // frames per press stroke

// Palette (from SL-Timing)
const FG = '#e8eaed';
const BL = '#7aa2f7';
const SL = '#c792ea';
const OK = '#9ece6a';
// confirmation emerald: deliberately cooler and higher-chroma than the attester
// green, so a confirmed block never reads as "the lane"
const CONF = '#3ff0a2';
const VA = '#e0af68';
const fgA = (a: number) => `rgba(232,234,237,${a})`;

// ---------------------------------------------------------------------------
// Beats (frames)
// ---------------------------------------------------------------------------
const SLOT_FRAMES = 720; // two slots on the timeline
const DUR = 830;
const F = {
  broadcast: 240,
  freeze: 270,
  agg: 330,
  commit: 360,
  attest: 450,
  reveal: 540,
  exec: 594, // sequential executor starts (N+1 t=7.8)
  execEnd: 662, // cursor leaves the hull
  ptc: 630,
  seal: 690,
  dollyA: 711, // hold 0.7 s after the seal, then advance one block
  dollyB: 743,
  fadeA: 773, // hold 1 s on the empty N+1, then fade
  fadeB: 785,
  card: 785, // end card 1.5 s
};
const EXEC_SPEED = 0.12; // world units per frame through the whole hull
const NODE: V3 = [BLOCK_CX, HULL_TOP + 0.02, 0]; // where the commitment lands: the hull's top centre
const PAY_TOP: V3 = [PAY_CX, HULL_TOP + 0.02, 0];
const LANE_TOP: V3 = [LANE_CX, HULL_TOP + 0.02, 0];
const ROOT_HEX = '0x9f3a7c…41e2';
const FLIGHT_PUB = 66;
const PUB_IN = 22; // mempool -> builder
const PUB_HOLD = 8; // on the builder's rail: pressed square, colour goes private
const PUB_OUT = FLIGHT_PUB - PUB_IN - PUB_HOLD; // builder -> its slot in the public compartment
const FLIGHT_SH = 56;
const RING_ARRIVE = 0.55; // the fraction of the flight spent reaching the committee ring
const GOSSIP_LEN = 20;
const GOSSIP_POOL = 16;
const ATT_N = 512;
const QUORUM = 342; // ceil(2/3 * 512)
const ATT_FLIGHT = 14;
const PTC_N = 32;
// step 1, the commit: one light around the whole hull's outer perimeter, ~0.85 s
const CONFIRM_A = F.commit + 2;
const CONFIRM_B = F.commit + 28;
// step 2, the attestations: the outer faces fill with green as the counter climbs to quorum
const SECURE_PEAK = 0.60; // face opacity at the quorum: clearly opaque, interiors still faintly visible
const SECURE_REST = 0.27; // resting confirmed look, open enough for the payload reveal to read through
// step 3, the seal: the walls go dense green and the block moves on. The outline already says
// "block", so the seal is carried by the faces, not by a brighter edge.
const SECURE_SEALED = 0.9; // wall opacity once the last op is in and the root is committed
const SEAL_CAP = 0.32; // top and bottom take a fraction of the wall alpha, so the hull stays readable from above
const WIPE_SPAN = 2.2; // arc-units a dropped vertical takes to fill

// ---------------------------------------------------------------------------
// Easing
// ---------------------------------------------------------------------------
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const easeOutQuad = (x: number) => 1 - (1 - clamp01(x)) * (1 - clamp01(x));
const easeInOut = (x: number) => {
  const t = clamp01(x);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
const ramp = (f: number, a: number, b: number) => smooth((f - a) / (b - a)); // symmetric fades
const rampOut = (f: number, a: number, b: number) => easeOut((f - a) / (b - a)); // arrivals, label enters, fills
const rampIO = (f: number, a: number, b: number) => easeInOut((f - a) / (b - a)); // camera
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const gauss = (x: number, c: number, s: number) => Math.exp(-((x - c) * (x - c)) / (s * s));

// attestation count: reaches exactly QUORUM at t=3, then keeps climbing past two thirds
const attCount = (f: number) => {
  if (f < F.commit) return 0;
  if (f < F.attest) return Math.min(QUORUM - 1, Math.floor(QUORUM * easeOutQuad((f - F.commit) / (F.attest - F.commit))));
  return Math.min(ATT_N, QUORUM + Math.floor(72 * easeOut((f - F.attest) / 42)));
};

// ---------------------------------------------------------------------------
// Camera: one slow drift with parallax over the whole film, plus the block advance at the end
// ---------------------------------------------------------------------------
function cameraAt(frame: number): { pos: V3; look: V3 } {
  const drift = easeInOut(clamp01(frame / F.dollyA));
  const adv = rampIO(frame, F.dollyA, F.dollyB) * PITCH;
  return {
    pos: [CAM.pos[0] + lerp(-0.36, 0.36, drift) + adv, CAM.pos[1] - 0.1 * drift, CAM.pos[2] - 0.45 * drift],
    look: [CAM.look[0] + lerp(-0.1, 0.1, drift) + adv, CAM.look[1], CAM.look[2]],
  };
}

interface Film {
  frame: number;
  dolly: number;
  camX: number;
  ringA: number;
  ringFlash: number;
  freeze: number;
  agg: number;
  aggFlash: number;
  proofLine: number;
  lit: number;
  beaconBirth: number;
  proposerA: number;
  proposerPulse: number;
  commitPulse: number;
  trunk: number;
  nodeA: number;
  branch: number;
  attest: number;
  attField: number;
  attCounterA: number;
  quorum: number;
  confirmTrace: number;
  confirmLit: number;
  confirmTint: number;
  confirmMute: number;
  secure: number;
  secureFace: number;
  securePulse: number;
  secureTick: number;
  ptcA: number;
  ptcCheck: number;
  reveal: number;
  revealOver: number;
  execX: number;
  cursorA: number;
  solidify: number;
  sealFlash: number;
  sealed: number;
  sealFace: number;
  execCounterA: number;
  opsA: number;
  sealLineA: number;
  sealCapA: number;
  capIn: number;
  capOut: number;
  builderA: number;
  builderObjA: number;
  builderLit: number;
  builderWork: number;
  bidLen: number;
  bidA: number;
  bidT: number;
  bidPulse: number;
  revealT: number;
  revealPulse: number;
  mempoolA: number;
  routeA: number;
  tlA: number;
  endFade: number;
  cardA: number;
  focusDist: number;
  focusRange: number;
}

function filmAt(frame: number): Film {
  const f = frame;
  const dolly = rampIO(f, F.dollyA, F.dollyB);
  const execX = f < F.exec ? -1e9 : f > F.execEnd ? 1e9 : X0_N - 0.05 + EXEC_SPEED * (f - F.exec);
  const cam = cameraAt(f);
  const camV = new THREE.Vector3(...cam.pos);
  const dBlock = camV.distanceTo(new THREE.Vector3(BLOCK_CX + dolly * PITCH, HY + 0.7, 0));
  const dBeacon = camV.distanceTo(new THREE.Vector3(BLOCK_CX, BEACON.y, 0));
  const rack = rampOut(f, F.commit - 8, F.commit + 8) * (1 - ramp(f, F.commit + 46, F.commit + 76));
  // the seal fill: lands just after the last op and holds while the camera moves on
  const sealFace = rampOut(f, F.seal - 2, F.seal + 12);
  const attest = gauss(f, F.attest + 6, 11);
  return {
    frame: f,
    dolly,
    camX: dolly * PITCH,
    // the committee ring is up for the whole of slot N and stands down once block N is attested
    ringA: rampOut(f, 0, 18) * (1 - ramp(f, F.attest + 8, F.attest + 44)),
    ringFlash: gauss(f, F.broadcast + 3, 6),
    freeze: gauss(f, F.freeze + 3, 6),
    agg: rampOut(f, F.agg - 4, F.agg + 10) * (1 - ramp(f, F.agg + 18, F.agg + 34)),
    aggFlash: gauss(f, F.agg + 9, 6),
    proofLine: rampOut(f, F.agg + 8, F.agg + 28) * (1 - ramp(f, F.commit + 2, F.commit + 20)),
    lit: rampOut(f, F.commit, F.commit + 12) * (1 - dolly),
    beaconBirth: rampOut(f, F.commit - 2, F.commit + 12),
    proposerA: rampOut(f, F.commit - 42, F.commit - 34) * (1 - ramp(f, F.attest + 36, F.attest + 56)),
    proposerPulse: gauss(f, F.commit - 1, 5),
    commitPulse: gauss(f, F.commit + 9, 9),
    trunk: rampOut(f, F.commit + 4, F.commit + 16),
    nodeA: rampOut(f, F.commit + 12, F.commit + 18),
    branch: rampOut(f, F.commit + 16, F.commit + 32),
    attest,
    attField: 0.14 + 0.86 * (rampOut(f, F.commit - 12, F.commit) * (1 - ramp(f, F.attest + 44, F.attest + 74))),
    attCounterA: rampOut(f, F.commit + 2, F.commit + 8) * (1 - ramp(f, F.attest + 52, F.attest + 64)),
    quorum: rampOut(f, F.attest, F.attest + 5),
    // near-constant speed with gentle ends, so the head reads as one light travelling one path
    confirmTrace: f < CONFIRM_A ? 0 : 0.72 * clamp01((f - CONFIRM_A) / (CONFIRM_B - CONFIRM_A)) + 0.28 * smooth((f - CONFIRM_A) / (CONFIRM_B - CONFIRM_A)),
    confirmLit: rampOut(f, CONFIRM_B - 4, CONFIRM_B + 6),
    confirmTint: rampOut(f, CONFIRM_B - 2, CONFIRM_B + 22),
    confirmMute: rampOut(f, F.attest - 8, F.attest + 2),
    // the faces track the attestation counter's own curve, so the fill and the number rise together
    secure: f < F.commit ? 0 : clamp01(easeOutQuad((f - F.commit) / (F.attest - F.commit))),
    secureFace: lerp(
      lerp(
        SECURE_PEAK * (f < F.commit ? 0 : clamp01(easeOutQuad((f - F.commit) / (F.attest - F.commit)))),
        SECURE_REST,
        rampOut(f, F.attest + 8, F.attest + 34)
      ),
      SECURE_SEALED,
      sealFace
    ),
    sealFace,
    // one soft pulse of edges and faces together as the quorum lands
    securePulse: gauss(f, F.attest + 4, 5.5),
    secureTick: rampOut(f, F.attest, F.attest + 8),
    ptcA: rampOut(f, F.ptc - 10, F.ptc - 4) * (1 - ramp(f, F.ptc + 40, F.ptc + 52)),
    ptcCheck: rampOut(f, F.ptc + 16, F.ptc + 22) * (1 - ramp(f, F.seal - 6, F.seal)),
    reveal: rampOut(f, F.reveal, F.reveal + 10),
    revealOver: gauss(f, F.reveal + 9, 10) * 0.45,
    execX,
    cursorA: rampOut(f, F.exec, F.exec + 4) * (1 - ramp(f, F.execEnd, F.execEnd + 8)),
    solidify: rampOut(f, F.exec, F.exec + 16),
    sealFlash: gauss(f, F.seal + 3, 5),
    sealed: rampOut(f, F.seal - 4, F.seal + 6),
    // left-side captions never overlap: each one fully exits (~0.2 s) before the next enters
    execCounterA: rampOut(f, F.exec, F.exec + 6) * (1 - ramp(f, F.execEnd - 7, F.execEnd - 1)),
    opsA: rampOut(f, F.execEnd + 1, F.execEnd + 7) * (1 - ramp(f, F.seal - 9, F.seal - 3)),
    sealLineA: rampOut(f, F.seal + 2, F.seal + 8),
    sealCapA: rampOut(f, F.seal + 4, F.seal + 10),
    capIn: rampOut(f, 2, 10),
    capOut: 1 - ramp(f, F.dollyA, F.dollyA + 14),
    builderA: rampOut(f, 4, 10) * (1 - ramp(f, F.reveal, F.reveal + 8)),
    // the object itself outlives its caption: it still has to bid, and to hand over the payload
    builderObjA: rampOut(f, 6, 18) * (1 - ramp(f, F.dollyA, F.dollyA + 14)),
    builderLit: 1 - 0.82 * ramp(f, F.reveal + 10, F.reveal + 32),
    builderWork: rampOut(f, 30, 44) * (1 - ramp(f, 344, 360)),
    // the bid: builder -> proposer, landing exactly as the beacon block is emitted
    bidLen: rampOut(f, F.commit - 26, F.commit - 6),
    bidA: rampOut(f, F.commit - 28, F.commit - 22) * (1 - ramp(f, F.commit + 14, F.commit + 32)),
    bidT: clamp01((f - (F.commit - 26)) / 20),
    bidPulse: gauss(f, F.commit - 25, 5),
    // the reveal: one pulse from the builder into the public compartment
    revealT: clamp01((f - (F.reveal - 2)) / 16),
    revealPulse: gauss(f, F.reveal + 6, 6),
    // the mempool names itself once, in the first two seconds, then gets out of the way
    mempoolA: rampOut(f, 4, 10) * 0.5 * (1 - ramp(f, 54, 64)),
    // how each lane's txs travel: one quiet line under each actor, up for the first ~7 s only
    routeA: rampOut(f, 16, 28) * (1 - ramp(f, 204, 224)),
    tlA: 1 - ramp(f, F.dollyA, F.dollyA + 14),
    endFade: ramp(f, F.fadeA, F.fadeB),
    cardA: rampOut(f, F.card, F.card + 8),
    focusDist: lerp(dBlock, dBeacon, rack),
    focusRange: lerp(7.5, 3.6, rack),
  };
}

// ---------------------------------------------------------------------------
// Seeded content
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

const SPECTRUM = ['#ff6a5c', '#ff8f4a', '#ffb43d', '#f5d43a', '#b8f04a', '#55f0b5', '#4ddcff', '#4e8cff', '#8b6bff', '#c86bff', '#ff5bd8', '#ff6f9c'];

interface Item {
  pos: V3;
  size: V3;
  color: THREE.Color;
}

function payloadCrowd(seed: number, count: number, x0: number): Item[] {
  const rnd = mulberry32(seed);
  const items: Item[] = [];
  const H = BLOCK.height;
  const D = BLOCK.depth;
  const L = BLOCK.payload;
  const inset = 0.07;
  for (let i = 0; i < count; i++) {
    const r = rnd();
    let sx: number, sy: number, sz: number;
    if (r < 0.58) {
      const b = 0.09 + rnd() * 0.14;
      sx = b * (0.7 + rnd() * 0.8);
      sy = b * (0.7 + rnd() * 0.8);
      sz = b * (0.7 + rnd() * 0.8);
    } else if (r < 0.9) {
      const b = 0.22 + rnd() * 0.22;
      sx = b * (0.6 + rnd() * 0.9);
      sy = b * (0.6 + rnd() * 0.9);
      sz = b * (0.6 + rnd() * 0.9);
    } else {
      const long = 0.5 + rnd() * 0.5;
      const thin = 0.06 + rnd() * 0.08;
      const mid = 0.25 + rnd() * 0.3;
      const axis = rnd();
      if (axis < 0.4) [sx, sy, sz] = [thin, mid, long];
      else if (axis < 0.75) [sx, sy, sz] = [long, mid, thin];
      else [sx, sy, sz] = [mid, long, thin];
    }
    const x = x0 + inset + sx / 2 + rnd() * (L - 2 * inset - sx);
    const y = HY + inset + sy / 2 + rnd() * (H - 2 * inset - sy);
    const z = -D / 2 + inset + sz / 2 + rnd() * (D - 2 * inset - sz);
    const base = new THREE.Color(SPECTRUM[Math.floor(rnd() * SPECTRUM.length)]);
    const hsl = { h: 0, s: 0, l: 0 };
    base.getHSL(hsl);
    base.setHSL((hsl.h + (rnd() - 0.5) * 0.04 + 1) % 1, Math.min(1, hsl.s * (0.9 + rnd() * 0.15)), hsl.l * (0.92 + rnd() * 0.16));
    items.push({ pos: [x, y, z], size: [sx, sy, sz], color: base });
  }
  return items;
}

const LANE_SLAB: V3 = [0.17, 0.36, 0.11];
interface LaneItem {
  pos: V3;
  rotY: number;
  prox: number;
}
function laneCrowd(seed: number, x0: number): LaneItem[] {
  const rnd = mulberry32(seed);
  const nx = 6;
  const ny = 3;
  const nz = 8;
  const inset = 0.12;
  const px = (BLOCK.lane - 2 * inset) / nx;
  const py = (BLOCK.height - 2 * inset) / ny;
  const pz = (BLOCK.depth - 2 * inset) / nz;
  const items: LaneItem[] = [];
  for (let ix = 0; ix < nx; ix++) {
    for (let iy = 0; iy < ny; iy++) {
      for (let iz = 0; iz < nz; iz++) {
        const x = x0 + inset + (ix + 0.5) * px + (rnd() - 0.5) * 0.12;
        const y = HY + inset + (iy + 0.5) * py + (rnd() - 0.5) * 0.16;
        const z = -BLOCK.depth / 2 + inset + (iz + 0.5) * pz + (rnd() - 0.5) * 0.12;
        const dWall = Math.min(x - x0, x0 + BLOCK.lane - x, BLOCK.depth / 2 - Math.abs(z), HULL_TOP - y);
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
    float k1 = 1.0 + floor(vSeed * 3.0);
    float k2 = 2.0 + floor(fract(vSeed * 7.31) * 3.0);
    float ph = vSeed * 6.2831853;
    float w = 6.2831853 / 8.0;
    float shim = 0.6 * sin(uTime * w * k1 + ph) + 0.4 * sin(uTime * w * k2 + ph * 2.7);
    float bright = uBrightness * (1.0 + uShimmer * shim);
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
    float fres = pow(1.0 - ndv, 9.0);
    float top = clamp(n.y, 0.0, 1.0);
    float core = 1.0 - abs((vWorldPos.y - ${HY.toFixed(2)}) / ${BLOCK.height.toFixed(2)} * 2.0 - 1.0);
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
    float soft = smoothstep(0.0, 0.9, ndv);
    float top = clamp(n.y, 0.0, 1.0);
    vec3 col = uHue * (0.65 + 0.35 * top) * soft * vColor.r * uBrightness;
    float d = distance(cameraPosition, vWorldPos);
    float f = smoothstep(uFogNear, uFogFar, d);
    col *= (1.0 - f * 0.9);
    gl_FragColor = vec4(col, 1.0);
  }
`;

// A sealed transaction in flight: dark opaque body, one faint uniform cool rim. No colour, no shimmer.
const sealedFrag = /* glsl */ `
  uniform vec3 uBody;
  uniform vec3 uRim;
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
    float fres = pow(1.0 - ndv, 3.0);
    float top = clamp(n.y, 0.0, 1.0);
    vec3 col = uBody * (0.8 + 0.4 * top) + uRim * (0.03 + 0.4 * fres);
    float d = distance(cameraPosition, vWorldPos);
    float f = smoothstep(uFogNear, uFogFar, d);
    col = mix(col, uFog, f);
    gl_FragColor = vec4(col, 1.0);
  }
`;

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

const fogUniforms = () => ({
  uFog: { value: new THREE.Color(VOID) },
  uFogNear: { value: FOG_NEAR },
  uFogFar: { value: FOG_FAR },
});

// ---------------------------------------------------------------------------
// Materials that are built once and driven per frame
// ---------------------------------------------------------------------------
const makeGlassMat = () =>
  new THREE.ShaderMaterial({
    vertexShader: glassVert,
    fragmentShader: glassFrag,
    uniforms: {
      uFill: { value: new THREE.Color('#3a5aa8') },
      uEdge: { value: new THREE.Color('#c8e2ff') },
      uFillAlpha: { value: 0.02 },
      uEdgeStrength: { value: 0.45 },
      uFresnelPow: { value: 4.5 },
      uKeyDir: { value: new THREE.Vector3(-0.3, 1.0, 0.6) },
      uKeyStrength: { value: 0.04 },
      ...fogUniforms(),
      uFogPush: { value: 1.0 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
  });

const makeCrowdMat = (frag: string, extra: Record<string, { value: unknown }>, additive = false) =>
  new THREE.ShaderMaterial({
    vertexShader: crowdVert,
    fragmentShader: frag,
    uniforms: {
      uDesat: { value: 0 },
      uBrightness: { value: 1 },
      uAlpha: { value: 1 },
      uTime: { value: 0 },
      uShimmer: { value: 0 },
      uKeyDir: { value: new THREE.Vector3(-0.3, 1.0, 0.6) },
      ...fogUniforms(),
      ...extra,
    },
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: THREE.FrontSide,
  });

// Additive specular layer: black physical material that only contributes environment + key reflections.
const makeSpecMat = () =>
  new THREE.MeshPhysicalMaterial({
    color: '#000000',
    roughness: 0.3,
    metalness: 0,
    specularIntensity: 0.35,
    clearcoat: 0, // clearcoat on the additive layer produced NaN rings on rounded edges under ANGLE
    envMapIntensity: 0.5,
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.FrontSide,
  });

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const tmpObj = new THREE.Object3D();
const tmpColor = new THREE.Color();
const X_AXIS = new THREE.Vector3(1, 0, 0);
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpDir = new THREE.Vector3();

// A glass shell whose colours and alphas are set every frame.
const GlassShell: React.FC<{
  size: V3;
  position: V3;
  fill: string;
  edge: string;
  fillAlpha: number;
  edgeStrength: number;
  fillMix?: [string, number];
  edgeMix?: [string, number];
  fillMix2?: [string, number];
  edgeMix2?: [string, number];
  order?: number;
}> = ({ size, position, fill, edge, fillAlpha, edgeStrength, fillMix, edgeMix, fillMix2, edgeMix2, order = 3 }) => {
  const mat = useMemo(makeGlassMat, []);
  (mat.uniforms.uFill.value as THREE.Color).set(fill);
  if (fillMix) (mat.uniforms.uFill.value as THREE.Color).lerp(tmpColor.set(fillMix[0]), fillMix[1]);
  if (fillMix2) (mat.uniforms.uFill.value as THREE.Color).lerp(tmpColor.set(fillMix2[0]), fillMix2[1]);
  (mat.uniforms.uEdge.value as THREE.Color).set(edge);
  if (edgeMix) (mat.uniforms.uEdge.value as THREE.Color).lerp(tmpColor.set(edgeMix[0]), edgeMix[1]);
  if (edgeMix2) (mat.uniforms.uEdge.value as THREE.Color).lerp(tmpColor.set(edgeMix2[0]), edgeMix2[1]);
  mat.uniforms.uFillAlpha.value = fillAlpha;
  mat.uniforms.uEdgeStrength.value = edgeStrength;
  return <RoundedBox args={size} radius={0.03} smoothness={4} position={position} material={mat} renderOrder={order} />;
};

// Thin luminous edges for a box. `bright` > 1 pushes the line into HDR for bloom.
const BoxEdges: React.FC<{ size: V3; position: V3; color: string; opacity: number; mix?: [string, number]; bright?: number }> = ({ size, position, color, opacity, mix, bright = 1 }) => {
  const geo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(...size)), [size]);
  const mat = useMemo(() => new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false, fog: true }), []);
  mat.color.set(color);
  if (mix) mat.color.lerp(tmpColor.set(mix[0]), mix[1]);
  mat.color.multiplyScalar(bright);
  mat.opacity = opacity;
  return <lineSegments geometry={geo} material={mat} position={position} renderOrder={4} visible={opacity > 0.002} />;
};

// A line that grows from `from` toward `to` (fraction `len`), as a thin box so it can go over-bright for bloom.
const GrowLine: React.FC<{ from: V3; to: V3; len: number; color: string; opacity: number; bright: number; thick?: number }> = ({ from, to, len, color, opacity, bright, thick = 0.012 }) => {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false }), []);
  mat.color.set(color).multiplyScalar(bright);
  mat.opacity = opacity;
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const dir = b.clone().sub(a);
  const L = dir.length() * Math.max(0.0001, len);
  const mid = a.clone().add(dir.clone().normalize().multiplyScalar(L / 2));
  const q = new THREE.Quaternion().setFromUnitVectors(X_AXIS, dir.clone().normalize());
  return (
    <mesh position={mid} quaternion={q} scale={[L, thick, thick]} material={mat} renderOrder={5} visible={opacity > 0.002 && len > 0.002}>
      <boxGeometry args={[1, 1, 1]} />
    </mesh>
  );
};

// ---------------------------------------------------------------------------
// Camera, environment, lights
// ---------------------------------------------------------------------------
const CameraRig: React.FC<{ frame: number }> = ({ frame }) => {
  const { camera } = useThree();
  useLayoutEffect(() => {
    const c = cameraAt(frame);
    camera.position.set(...c.pos);
    (camera as THREE.PerspectiveCamera).fov = CAM.fov;
    camera.lookAt(new THREE.Vector3(...c.look));
    camera.updateProjectionMatrix();
  }, [camera, frame]);
  return null;
};

// Procedural studio environment baked through PMREM once: a soft box above-front, a cool strip
// behind-right, a faint warm strip low-left. Physical materials (floor, spec layers) reflect it.
const EnvLight: React.FC = () => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useLayoutEffect(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const env = new THREE.Scene();
    env.background = new THREE.Color('#05091a');
    const panel = (w: number, h: number, pos: V3, color: string, intensity: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
      m.position.set(...pos);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    panel(7, 3.5, [-2, 7, 3], '#dfe9ff', 3.2);
    panel(2.2, 9, [8, 3, -6], '#6f8dff', 1.6);
    panel(9, 1.6, [-8, 0.8, 5], '#ffd9e6', 0.35);
    panel(3, 3, [6, 5, 6], '#c9d6ff', 0.9);
    const tex = pm.fromScene(env, 0.05).texture;
    scene.environment = tex;
    pm.dispose();
    return () => {
      scene.environment = null;
      tex.dispose();
    };
  }, [gl, scene]);
  return null;
};

const KEY_POS: V3 = [-3.5, 9, 6];
const Lights: React.FC = () => {
  const key = useRef<THREE.DirectionalLight>(null);
  useLayoutEffect(() => {
    const l = key.current;
    if (!l) return;
    l.target.position.set(0, 0, 0);
    l.target.updateMatrixWorld();
    const c = l.shadow.camera;
    c.left = -13;
    c.right = 13;
    c.top = 9;
    c.bottom = -7;
    c.near = 1;
    c.far = 30;
    c.updateProjectionMatrix();
    l.shadow.bias = -0.0006;
    l.shadow.normalBias = 0.02;
  }, []);
  return (
    <>
      <directionalLight ref={key} position={KEY_POS} color="#dfe8ff" intensity={0.8} castShadow shadow-mapSize={[2048, 2048]} />
      <directionalLight position={[8, 3.5, -9]} color="#6f8dff" intensity={0.6} />
    </>
  );
};

// ---------------------------------------------------------------------------
// Static crowds for the blocks behind
// ---------------------------------------------------------------------------
const sortFarToNear = <T extends { pos: V3 }>(items: T[]) => {
  const cam = new THREE.Vector3(...CAM.pos);
  items.sort((p, q) => cam.distanceTo(new THREE.Vector3(...q.pos)) - cam.distanceTo(new THREE.Vector3(...p.pos)));
  return items;
};

const StaticCrowd: React.FC<{ seed: number; count: number; x0: number; desat: number; brightness: number; alpha: number }> = ({ seed, count, x0, desat, brightness, alpha }) => {
  const mesh = useMemo(() => {
    const items = sortFarToNear(payloadCrowd(seed, count, x0));
    const mat = makeCrowdMat(crowdFrag, {});
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, items.length);
    items.forEach((it, i) => {
      tmpObj.position.set(...it.pos);
      tmpObj.scale.set(...it.size);
      tmpObj.rotation.set(0, 0, 0);
      tmpObj.updateMatrix();
      m.setMatrixAt(i, tmpObj.matrix);
      m.setColorAt(i, it.color);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.renderOrder = 1;
    m.frustumCulled = false;
    m.castShadow = true;
    return m;
  }, [seed, count, x0]);
  const u = (mesh.material as THREE.ShaderMaterial).uniforms;
  u.uDesat.value = desat;
  u.uBrightness.value = brightness;
  u.uAlpha.value = alpha;
  return <primitive object={mesh} />;
};

const StaticLaneCrowd: React.FC<{ seed: number; x0: number; dim: number }> = ({ seed, x0, dim }) => {
  const mesh = useMemo(() => {
    const items = laneCrowd(seed, x0);
    const mat = makeCrowdMat(laneCrowdFrag, { uHue: { value: new THREE.Color('#4576e8') } }, true);
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(...LANE_SLAB), mat, items.length);
    items.forEach((it, i) => {
      tmpObj.position.set(...it.pos);
      tmpObj.scale.set(1, 1, 1);
      tmpObj.rotation.set(0, it.rotY, 0);
      tmpObj.updateMatrix();
      m.setMatrixAt(i, tmpObj.matrix);
      const b = 0.22 + 0.78 * it.prox;
      m.setColorAt(i, new THREE.Color(b, b, b));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.renderOrder = 1;
    m.frustumCulled = false;
    return m;
  }, [seed, x0]);
  (mesh.material as THREE.ShaderMaterial).uniforms.uBrightness.value = 0.42 * dim;
  return <primitive object={mesh} />;
};

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Confirmation outline
// One light runs the outer perimeter of the whole hull as a single path: the
// bottom ring, up a corner, the top ring. It crosses the partition four times
// and never stops there. The three remaining corner posts drop as the head
// passes over them, so all twelve outer edges end lit and the box is outlined
// as one object. The partition is not part of the path.
// ---------------------------------------------------------------------------
interface OutlineSeg {
  a: V3;
  dir: V3;
  len: number;
  s0: number;
  span: number;
  q: THREE.Quaternion;
}

function outlineSegs(x0: number): { segs: OutlineSeg[]; total: number } {
  const X0 = x0;
  const X1 = x0 + BLOCK_LEN;
  const Y0 = HY;
  const Y1 = HY + BLOCK.height;
  const Z0 = -BLOCK.depth / 2;
  const Z1 = BLOCK.depth / 2;
  const BFL: V3 = [X0, Y0, Z1];
  const BFR: V3 = [X1, Y0, Z1];
  const BBR: V3 = [X1, Y0, Z0];
  const BBL: V3 = [X0, Y0, Z0];
  const TFL: V3 = [X0, Y1, Z1];
  const TFR: V3 = [X1, Y1, Z1];
  const TBR: V3 = [X1, Y1, Z0];
  const TBL: V3 = [X0, Y1, Z0];
  const segs: OutlineSeg[] = [];
  const push = (a: V3, b: V3, s0: number, span: number) => {
    const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = d.length();
    const n = d.clone().normalize();
    segs.push({ a, dir: [n.x, n.y, n.z], len, s0, span, q: new THREE.Quaternion().setFromUnitVectors(X_AXIS, n) });
    return len;
  };
  const walk: [V3, V3][] = [
    [BFL, BFR], // bottom, front, the long way — straight across the partition
    [BFR, BBR],
    [BBR, BBL], // bottom, back, the long way
    [BBL, BFL],
    [BFL, TFL], // up the near-left post
    [TFL, TFR], // top, front, the long way
    [TFR, TBR],
    [TBR, TBL], // top, back, the long way
    [TBL, TFL],
  ];
  let s = 0;
  const at: number[] = [];
  for (const [a, b] of walk) {
    s += push(a, b, s, new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).length());
    at.push(s);
  }
  // the three remaining posts fall as the head reaches the corner above them
  push(TFR, BFR, at[5], WIPE_SPAN);
  push(TBR, BBR, at[6], WIPE_SPAN);
  push(TBL, BBL, at[7], WIPE_SPAN);
  return { segs, total: s };
}

const ConfirmOutline: React.FC<{ x0: number; progress: number; level: number; boost?: number }> = ({ x0, progress, level, boost = 1 }) => {
  const { segs, total } = useMemo(() => outlineSegs(x0), [x0]);
  const mats = useMemo(
    () => segs.map(() => new THREE.MeshBasicMaterial({ color: CONF, transparent: true, depthWrite: false, toneMapped: false })),
    [segs]
  );
  const headMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#e6fff4', transparent: true, depthWrite: false, toneMapped: false }), []);
  const S = progress * total;
  const running = progress > 0.002 && progress < 0.999;
  const head = new THREE.Vector3();
  if (running) {
    for (let i = 0; i < 9; i++) {
      const g = segs[i];
      if (S >= g.s0 && S <= g.s0 + g.span + 0.001) {
        head.set(g.a[0] + g.dir[0] * (S - g.s0), g.a[1] + g.dir[1] * (S - g.s0), g.a[2] + g.dir[2] * (S - g.s0));
        break;
      }
    }
  }
  const thick = 0.042 + 0.030 * level;
  return (
    <group>
      {segs.map((g, i) => {
        const frac = clamp01((S - g.s0) / g.span);
        if (frac <= 0.001 || level <= 0.004) return null;
        const front = g.s0 + frac * g.span;
        const hot = running ? Math.exp(-Math.pow((S - front) / 3.4, 2)) : 0;
        const mat = mats[i];
        mat.color.set(CONF).multiplyScalar((0.6 + 0.5 * level) * boost * (1 + 3.6 * hot));
        mat.opacity = Math.min(1, level * (0.9 + 0.9 * hot));
        const L = Math.max(0.0001, frac * g.len);
        return (
          <mesh
            key={i}
            position={[g.a[0] + g.dir[0] * (L / 2), g.a[1] + g.dir[1] * (L / 2), g.a[2] + g.dir[2] * (L / 2)]}
            quaternion={g.q}
            scale={[L, thick, thick]}
            material={mat}
            renderOrder={6}
          >
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
        );
      })}
      {running && (
        <group position={[head.x, head.y, head.z]}>
          <mesh material={headMat} renderOrder={7}>
            <sphereGeometry args={[0.09, 12, 12]} />
          </mesh>
          <pointLight color={CONF} intensity={16} distance={4.5} decay={2} />
        </group>
      )}
    </group>
  );
};

// The hull: one glass box on one base plate, a thin partition, a smoked shielded compartment
// ---------------------------------------------------------------------------
const HULL_SIZE: V3 = [BLOCK_LEN, BLOCK.height, BLOCK.depth];
const PLATE_SIZE: V3 = [BLOCK_LEN + 2 * PLATE.pad, PLATE.h, BLOCK.depth + 2 * PLATE.pad];
const WALL_SIZE: V3 = [BLOCK.join, BLOCK.height - 0.02, BLOCK.depth - 0.02];
const WALL_EDGE_SIZE: V3 = [BLOCK.join, BLOCK.height, BLOCK.depth];
const LANE_BODY_SIZE: V3 = [BLOCK.lane - 0.03, BLOCK.height - 0.03, BLOCK.depth - 0.03];
const LANE_FROST_SIZE: V3 = [BLOCK.lane - 0.01, BLOCK.height - 0.01, BLOCK.depth - 0.01];
const LANE_EDGE_SIZE: V3 = [BLOCK.lane, BLOCK.height, BLOCK.depth];

const LaneBody: React.FC<{ x0: number; bodyAlpha: number; glow: number; dim: number; rimMix: number; edgePulse: number; rimEdge?: number }> = ({ x0, bodyAlpha, glow, dim, rimMix, edgePulse, rimEdge }) => {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: glassVert,
        fragmentShader: laneFrag,
        uniforms: {
          uBody: { value: new THREE.Color('#10143a') },
          uRim: { value: new THREE.Color('#6d8cff') },
          uGlow: { value: 0.35 },
          uBodyAlpha: { value: 0.76 },
          ...fogUniforms(),
          uFogPush: { value: 1.0 },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.FrontSide,
      }),
    []
  );
  const frost = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: glassVert,
        fragmentShader: frostFrag,
        uniforms: { uMilk: { value: new THREE.Color('#b7c6ea') }, uStrength: { value: 1 }, ...fogUniforms() },
        transparent: true,
        depthWrite: false,
        side: THREE.FrontSide,
      }),
    []
  );
  (mat.uniforms.uRim.value as THREE.Color).set('#6d8cff').lerp(tmpColor.set(OK), rimMix).multiplyScalar(dim);
  mat.uniforms.uGlow.value = glow;
  mat.uniforms.uBodyAlpha.value = bodyAlpha;
  frost.uniforms.uStrength.value = dim * (0.35 + (0.65 * bodyAlpha) / 0.76);
  const pos: V3 = [x0 + BLOCK.lane / 2, HY + BLOCK.height / 2, 0];
  const rimE = rimEdge === undefined ? rimMix : rimEdge;
  const pulse = Math.max(rimE, edgePulse);
  return (
    <group>
      <RoundedBox args={LANE_BODY_SIZE} radius={0.03} smoothness={4} position={pos} material={mat} renderOrder={2.6} />
      <RoundedBox args={LANE_FROST_SIZE} radius={0.03} smoothness={4} position={pos} material={frost} renderOrder={2.7} />
      {/* the compartment only shows its own edges when it pulses (broadcast, freeze, attest) */}
      <BoxEdges size={LANE_EDGE_SIZE} position={pos} color={rimE > edgePulse ? OK : SL} opacity={Math.min(1, 0.85 * pulse)} bright={1 + 0.6 * pulse} />
      <pointLight position={[pos[0], HY + BLOCK.height * 0.6, 0.3]} color={OK} intensity={12 * rimMix} distance={6} decay={2} />
    </group>
  );
};

// Luminous hairline joining two neighbours across the chain gap.
const Link: React.FC<{ from: number; to: number; dim: number }> = ({ from, to, dim }) => {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#9fd4ff', transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }), []);
  mat.color.set('#9fd4ff').multiplyScalar(0.85 * dim);
  const len = to - from;
  const y = HY + BLOCK.height * 0.5;
  return (
    <group>
      <mesh position={[from + len / 2, y, 0]} material={mat} renderOrder={2}>
        <boxGeometry args={[len, 0.014, 0.014]} />
      </mesh>
      <mesh position={[from, y, 0]} material={mat} renderOrder={2}>
        <sphereGeometry args={[0.035, 12, 12]} />
      </mesh>
    </group>
  );
};

// The secured skin: one translucent green pass over the whole hull, both compartments and the
// partition together, so the attestations read as securing one block rather than two lanes.
// `uSideBias` 0 = one even pass over the whole hull (the attested look); 1 = the walls carry the
// green and the top and bottom fall back to SEAL_CAP of it (the sealed look).
const makeSecureSkinMat = () => {
  const mat = new THREE.MeshStandardMaterial({
    color: '#1d8f68',
    roughness: 0.26,
    metalness: 0.05,
    envMapIntensity: 0.6,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.FrontSide,
  });
  const uSideBias = { value: 0 };
  mat.userData.uSideBias = uSideBias;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSideBias = uSideBias;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSkinN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvSkinN = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSkinN;\nuniform float uSideBias;')
      .replace(
        'vec4 diffuseColor = vec4( diffuse, opacity );',
        'float sideness = smoothstep(0.18, 0.72, 1.0 - abs(vSkinN.y));\n\tvec4 diffuseColor = vec4( diffuse, opacity * mix(1.0, mix(' +
          SEAL_CAP.toFixed(2) +
          ', 1.0, sideness), uSideBias) );'
      );
  };
  return mat;
};

const SecureSkin: React.FC<{ position: V3; opacity: number; boost: number; seal?: number }> = ({ position, opacity, boost, seal = 0 }) => {
  const mat = useMemo(makeSecureSkinMat, []);
  mat.opacity = opacity;
  mat.color.set('#1d8f68').lerp(tmpColor.set(CONF), 0.28 * boost).lerp(tmpColor.set('#0d6f4e'), 0.45 * seal);
  // the sealed slab is denser, not brighter: the emissive lift comes back down as the walls fill
  mat.emissive.set(CONF).multiplyScalar((0.09 + 0.5 * boost) * lerp(1, 0.5, seal));
  (mat.userData.uSideBias as { value: number }).value = seal;
  return (
    <RoundedBox args={HULL_SIZE} radius={0.03} smoothness={4} position={position} material={mat} renderOrder={3.5} visible={opacity > 0.004} />
  );
};

// `solid` 0 = ghost silhouette (edges only), 1 = glass hull; `focus` 1 = block N look, 0 = previous-block look.
const Hull: React.FC<{
  k: number;
  solid: number;
  focus: number;
  laneBodyAlpha: number;
  laneGlow: number;
  laneRimMix: number;
  laneEdgePulse?: number;
  laneRimEdge?: number;
  edgeBoost?: number;
  flash?: number;
  confirm?: number;
  confirmTrace?: number;
  tint?: number;
  secure?: number;
  secureFace?: number;
  securePulse?: number;
  sealFace?: number;
}> = ({
  k,
  solid,
  focus,
  laneBodyAlpha,
  laneGlow,
  laneRimMix,
  laneEdgePulse = 0,
  laneRimEdge,
  edgeBoost = 0,
  flash = 0,
  confirm = 0,
  confirmTrace = 0,
  tint = 0,
  secure = 0,
  secureFace = 0,
  securePulse = 0,
  sealFace = 0,
}) => {
  const x0 = blockX0(k);
  const cx = x0 + BLOCK_LEN / 2;
  const dim = lerp(0.55, 1, focus);
  const hullPos: V3 = [cx, HY + BLOCK.height / 2, 0];
  const wallX = x0 + BLOCK.payload + BLOCK.join / 2;
  const plateMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1a2647', roughness: 0.5, metalness: 0.3, envMapIntensity: 0.7, transparent: true, opacity: 1 }), []);
  plateMat.opacity = solid;
  plateMat.color
    .set('#1a2647')
    .lerp(tmpColor.set('#12503c'), 0.5 * tint)
    .lerp(tmpColor.set('#136a4a'), 0.8 * secure * clamp01(0.45 + 0.55 * securePulse + 0.55 * (secureFace / SECURE_REST)))
    .lerp(tmpColor.set('#0e5f44'), 0.5 * sealFace)
    .multiplyScalar(lerp(0.7, 1, focus) * (1 + 0.5 * securePulse));
  const specMat = useMemo(makeSpecMat, []);
  specMat.envMapIntensity = 0.38 * solid * dim;
  const edgeMul = 1 + edgeBoost;
  return (
    <group>
      <mesh position={[cx, PLATE.h / 2, 0]} material={plateMat} visible={solid > 0.01} receiveShadow renderOrder={0}>
        <boxGeometry args={PLATE_SIZE} />
      </mesh>
      <GlassShell
        size={HULL_SIZE}
        position={hullPos}
        fill="#2a3c6e"
        fillMix={['#3a5aa8', focus]}
        fillMix2={['#1f7f5e', 0.5 * tint]}
        edge="#c8e2ff"
        edgeMix2={[CONF, 0.55 * tint]}
        fillAlpha={solid * lerp(0.015, 0.02, focus) * (1 + 0.5 * tint)}
        edgeStrength={solid * lerp(0.3, 0.45, focus)}
      />
      <RoundedBox args={HULL_SIZE} radius={0.03} smoothness={4} position={hullPos} material={specMat} renderOrder={3.2} visible={solid > 0.01} />
      <SecureSkin position={hullPos} opacity={secureFace * solid} boost={securePulse} seal={sealFace} />
      <LaneBody x0={x0 + BLOCK.payload + BLOCK.join} bodyAlpha={laneBodyAlpha * solid} glow={laneGlow} dim={dim * solid} rimMix={laneRimMix} rimEdge={laneRimEdge} edgePulse={laneEdgePulse} />
      {/* the internal partition */}
      <GlassShell size={WALL_SIZE} position={[wallX, HY + BLOCK.height / 2, 0]} fill="#7f9bff" edge="#e4edff" fillAlpha={solid * 0.07} edgeStrength={solid * 0.55} order={2.8} />
      <BoxEdges size={WALL_EDGE_SIZE} position={[wallX, HY + BLOCK.height / 2, 0]} color="#9fb4e6" mix={['#d6e4ff', solid]} opacity={lerp(0.16, 0.42 * dim, solid) * lerp(1, 0.62, confirm)} />
      {/* one set of hull edges; brighter as one object during execute, HDR on the seal */}
      <BoxEdges size={HULL_SIZE} position={hullPos} color="#7f93c4" mix={['#c4dbff', solid]} opacity={Math.min(1, lerp(0.3, 0.5 * dim, solid) * lerp(1, 0.34, confirm) * edgeMul)} bright={edgeMul} />
      {(confirm > 0.004 || confirmTrace > 0.002) && (
        <ConfirmOutline
          x0={x0}
          progress={confirmTrace}
          level={(confirmTrace > 0.002 && confirmTrace < 0.999 ? 1 : confirm * lerp(0.34, 0.8, focus)) * solid}
          boost={1 + 1.6 * flash + 1.1 * securePulse}
        />
      )}
      <Link from={blockX0(k - 1) + BLOCK_LEN} to={x0} dim={lerp(0.35, dim, solid)} />
      <pointLight position={[cx, HY + BLOCK.height * 0.6, 0.6]} color="#e8f0ff" intensity={4.5 * flash} distance={9} decay={2} />
      <pointLight position={[cx, HY + BLOCK.height * 0.55, 0]} color={CONF} intensity={9 * securePulse * solid} distance={10} decay={2} />
    </group>
  );
};

// ---------------------------------------------------------------------------
// The public stream: cubes fly mempool -> builder -> public compartment, then sit dim until the reveal
// ---------------------------------------------------------------------------
const PAY_ITEMS = sortFarToNear(payloadCrowd(17, 340, X0_N));
const PAY_XS = PAY_ITEMS.map((it) => it.pos[0]).sort((a, b) => a - b);
const countPassed = (xs: number[], x: number) => {
  let lo = 0;
  let hi = xs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
};

const TICK_GREEN = new THREE.Color(OK).multiplyScalar(0.95);
const makeTicks = (n: number) => {
  const m = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.024, 8, 8),
    new THREE.MeshBasicMaterial({ color: TICK_GREEN, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false }),
    n
  );
  for (let i = 0; i < n; i++) m.setMatrixAt(i, HIDDEN);
  m.renderOrder = 6;
  m.frustumCulled = false;
  return m;
};

const PayloadFill: React.FC<{ film: Film }> = ({ film }) => {
  const data = useMemo(() => {
    const items = PAY_ITEMS;
    const n = items.length;
    const rnd = mulberry32(991);
    const key = items.map((it) => it.pos[1] + rnd() * 0.7);
    const order = items.map((_, i) => i).sort((a, b) => key[a] - key[b]);
    const arrival = new Array<number>(n);
    order.forEach((idx, rank) => {
      arrival[idx] = 42 + (rank * (352 - 42)) / (n - 1) + (rnd() - 0.5) * 4;
    });
    const origin: V3[] = items.map(() => [MEMPOOL[0] + (rnd() - 0.5) * 2.0, MEMPOOL[1] + (rnd() - 0.5) * 0.9, MEMPOOL[2] + (rnd() - 0.5) * 1.6]);
    // each cube drops onto the builder's rail between the gantry posts, then leaves by one exit port
    const perp: V3 = [-BUILDER_DIR[2], 0, BUILDER_DIR[0]];
    const entry: V3[] = items.map(() => {
      const w = (rnd() - 0.5) * 0.18;
      const h = (rnd() - 0.5) * 0.11;
      return [BUILDER_IN[0] + perp[0] * w, BUILDER_IN[1] + h, BUILDER_IN[2] + perp[2] * w] as V3;
    });
    // oversized transactions are compressed to fit the builder, and spring back once packed
    const shrink = items.map((it) => Math.min(1, 0.27 / Math.max(it.size[0], it.size[1], it.size[2])));
    const lift = items.map(() => 0.5 + rnd() * 0.8);
    const spin = items.map(() => (rnd() - 0.5) * 1.6);
    const box = new THREE.BoxGeometry(1, 1, 1);
    const settled = new THREE.InstancedMesh(box, makeCrowdMat(crowdFrag, {}), n);
    const flight = new THREE.InstancedMesh(box, makeCrowdMat(crowdFrag, {}), n);
    // what leaves the builder is already private: the settled treatment, not the mempool's colour
    const queue = new THREE.InstancedMesh(box, makeCrowdMat(crowdFrag, {}), n);
    // the specular layer shares the settled matrices, so reflections follow for free
    const spec = new THREE.InstancedMesh(box, makeSpecMat(), n);
    spec.instanceMatrix = settled.instanceMatrix;
    items.forEach((it, i) => {
      settled.setMatrixAt(i, HIDDEN);
      flight.setMatrixAt(i, HIDDEN);
      queue.setMatrixAt(i, HIDDEN);
      settled.setColorAt(i, it.color);
      flight.setColorAt(i, it.color);
      queue.setColorAt(i, it.color);
    });
    settled.renderOrder = 1;
    flight.renderOrder = 1;
    queue.renderOrder = 1;
    spec.renderOrder = 1.5;
    settled.frustumCulled = false;
    flight.frustumCulled = false;
    queue.frustumCulled = false;
    spec.frustumCulled = false;
    settled.castShadow = true;
    flight.castShadow = true;
    queue.castShadow = true;
    const ticks = makeTicks(n);
    return { items, arrival, origin, entry, shrink, lift, spin, settled, flight, queue, spec, ticks };
  }, []);

  const { items, arrival, origin, entry, shrink, lift, spin, settled, flight, queue, spec, ticks } = data;
  const f = film.frame;
  const desat = lerp(lerp(0.88, 0, film.reveal), 0.9, film.dolly);
  const brightness = lerp(lerp(0.42, 1, film.reveal) + film.revealOver, 0.4, film.dolly);
  const alpha = lerp(lerp(0.72, 1, film.reveal), 0.55, film.dolly);
  const su = (settled.material as THREE.ShaderMaterial).uniforms;
  su.uDesat.value = desat;
  su.uBrightness.value = brightness;
  su.uAlpha.value = alpha;
  const fu = (flight.material as THREE.ShaderMaterial).uniforms;
  fu.uDesat.value = 0;
  fu.uBrightness.value = 1.25;
  fu.uAlpha.value = 1;
  // the queue carries the settled treatment, lifted just enough to read while it is moving
  const qu = (queue.material as THREE.ShaderMaterial).uniforms;
  qu.uDesat.value = desat;
  qu.uBrightness.value = brightness * 1.18;
  qu.uAlpha.value = Math.min(1, alpha * 1.1);
  (spec.material as THREE.MeshPhysicalMaterial).envMapIntensity = lerp(0.18, 0.55, film.reveal) * (1 - 0.7 * film.dolly);
  (ticks.material as THREE.MeshBasicMaterial).opacity = 0.95 * (1 - film.dolly);

  const execX = film.execX;
  const passedMul = 1 + 0.25 * (1 - film.dolly);
  for (let i = 0; i < items.length; i++) {
    const a = arrival[i];
    const d = a - FLIGHT_PUB;
    const it = items[i];
    if (f < d) {
      settled.setMatrixAt(i, HIDDEN);
      flight.setMatrixAt(i, HIDDEN);
      queue.setMatrixAt(i, HIDDEN);
    } else if (f < a) {
      const u = f - d;
      let x: number, y: number, z: number, rot: number, sc: number;
      let inBuilder = true;
      if (u < PUB_IN) {
        // tumbling in from the mempool to the builder's intake
        const s = u / PUB_IN;
        const o = origin[i];
        const v = entry[i];
        const cx = (o[0] + v[0]) / 2;
        const cy = (o[1] + v[1]) / 2 + lift[i];
        const cz = (o[2] + v[2]) / 2;
        const t1 = 1 - s;
        x = t1 * t1 * o[0] + 2 * t1 * s * cx + s * s * v[0];
        y = t1 * t1 * o[1] + 2 * t1 * s * cy + s * s * v[1];
        z = t1 * t1 * o[2] + 2 * t1 * s * cz + s * s * v[2];
        rot = spin[i] * (1 - 0.3 * s);
        sc = lerp(1, shrink[i], clamp01((s - 0.68) / 0.32));
      } else if (u < PUB_IN + PUB_HOLD) {
        // on the rail under the gantry: straightened, pressed square, converging on the exit port
        const s = (u - PUB_IN) / PUB_HOLD;
        const v = entry[i];
        x = lerp(v[0], BUILDER_OUT[0], s);
        y = lerp(v[1], BUILDER_OUT[1], s);
        z = lerp(v[2], BUILDER_OUT[2], s);
        rot = spin[i] * 0.7 * (1 - s) * (1 - s);
        sc = shrink[i];
      } else {
        // the queue out: one shared rail off the builder, then each cube eases into its slot
        inBuilder = false;
        const s = (u - PUB_IN - PUB_HOLD) / PUB_OUT;
        const e = easeOutQuad(s);
        const t1 = 1 - e;
        x = t1 * t1 * BUILDER_OUT[0] + 2 * t1 * e * BUILDER_RAIL[0] + e * e * it.pos[0];
        y = t1 * t1 * BUILDER_OUT[1] + 2 * t1 * e * BUILDER_RAIL[1] + e * e * it.pos[1];
        z = t1 * t1 * BUILDER_OUT[2] + 2 * t1 * e * BUILDER_RAIL[2] + e * e * it.pos[2];
        rot = 0;
        sc = lerp(shrink[i], 1, clamp01(s / 0.3));
      }
      tmpObj.position.set(x, y, z);
      tmpObj.scale.set(it.size[0] * sc, it.size[1] * sc, it.size[2] * sc);
      tmpObj.rotation.set(0, rot, 0);
      tmpObj.updateMatrix();
      flight.setMatrixAt(i, inBuilder ? tmpObj.matrix : HIDDEN);
      queue.setMatrixAt(i, inBuilder ? HIDDEN : tmpObj.matrix);
      settled.setMatrixAt(i, HIDDEN);
    } else {
      const q = clamp01((f - a) / 14);
      const pop = 1 + 0.4 * Math.sin(Math.PI * q) * (1 - 0.5 * q);
      tmpObj.position.set(...it.pos);
      tmpObj.scale.set(it.size[0] * pop, it.size[1] * pop, it.size[2] * pop);
      tmpObj.rotation.set(0, 0, 0);
      tmpObj.updateMatrix();
      settled.setMatrixAt(i, tmpObj.matrix);
      flight.setMatrixAt(i, HIDDEN);
      queue.setMatrixAt(i, HIDDEN);
    }
    const passed = it.pos[0] <= execX;
    settled.setColorAt(i, tmpColor.copy(it.color).multiplyScalar(passed ? passedMul : 1));
    if (passed) {
      tmpObj.position.set(it.pos[0], it.pos[1] + it.size[1] / 2 + 0.06, it.pos[2]);
      tmpObj.scale.set(1, 1, 1);
      tmpObj.rotation.set(0, 0, 0);
      tmpObj.updateMatrix();
      ticks.setMatrixAt(i, tmpObj.matrix);
    } else {
      ticks.setMatrixAt(i, HIDDEN);
    }
  }
  settled.instanceMatrix.needsUpdate = true;
  flight.instanceMatrix.needsUpdate = true;
  queue.instanceMatrix.needsUpdate = true;
  ticks.instanceMatrix.needsUpdate = true;
  if (settled.instanceColor) settled.instanceColor.needsUpdate = true;
  return (
    <>
      <primitive object={settled} />
      <primitive object={spec} />
      <primitive object={queue} />
      <primitive object={flight} />
      <primitive object={ticks} />
    </>
  );
};

// ---------------------------------------------------------------------------
// The lane committee: 16 nodes in a tilted ring above-right of the shielded compartment
// ---------------------------------------------------------------------------
function ringNodes(): V3[] {
  const n = new THREE.Vector3(0.2, 1, 0.55).normalize();
  const u = new THREE.Vector3(1, 0, 0).cross(n).normalize();
  const v = n.clone().cross(u).normalize();
  const out: V3[] = [];
  for (let i = 0; i < RING_N; i++) {
    const a = (i / RING_N) * Math.PI * 2;
    const p = new THREE.Vector3(...RING_C).addScaledVector(u, Math.cos(a) * RING_R).addScaledVector(v, Math.sin(a) * RING_R);
    out.push([p.x, p.y, p.z]);
  }
  return out;
}
const RING_NODES = ringNodes();
const RING_Q = (() => {
  const n = new THREE.Vector3(0.2, 1, 0.55).normalize();
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
})();

interface Gossip {
  at: number;
  from: number;
  to: [number, number, number];
}

const Committee: React.FC<{ film: Film; gossip: Gossip[] }> = ({ film, gossip }) => {
  const nodeMat = useMemo(() => new THREE.MeshBasicMaterial({ color: SL, transparent: true, opacity: 1, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }), []);
  const torusMat = useMemo(() => new THREE.MeshBasicMaterial({ color: SL, transparent: true, opacity: 0.1, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }), []);
  const pool = useMemo(
    () =>
      Array.from({ length: GOSSIP_POOL * 3 }, () => ({
        line: new THREE.MeshBasicMaterial({ color: SL, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
        dot: new THREE.MeshBasicMaterial({ color: SL, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }),
      })),
    []
  );
  const a = film.ringA;
  nodeMat.opacity = a;
  nodeMat.color.set(SL).multiplyScalar(0.95 + 3.5 * film.ringFlash);
  torusMat.opacity = a * (0.22 + 0.8 * film.ringFlash);
  torusMat.color.set(SL).multiplyScalar(0.85 + 2.5 * film.ringFlash);

  const f = film.frame;
  const active: Gossip[] = [];
  for (const g of gossip) {
    if (f >= g.at && f < g.at + GOSSIP_LEN) active.push(g);
    if (active.length >= GOSSIP_POOL) break;
  }
  const segs: React.ReactNode[] = [];
  active.forEach((g, gi) => {
    g.to.forEach((t, ti) => {
      const slot = gi * 3 + ti;
      const stagger = ti * 3;
      const p = easeOut((f - g.at - stagger) / (GOSSIP_LEN - 6));
      const env = Math.sin(Math.PI * clamp01((f - g.at - stagger) / (GOSSIP_LEN - 6)));
      const A = new THREE.Vector3(...RING_NODES[g.from]);
      const B = new THREE.Vector3(...RING_NODES[t]);
      const dir = B.clone().sub(A);
      const L = dir.length();
      const q = new THREE.Quaternion().setFromUnitVectors(X_AXIS, dir.clone().normalize());
      const mid = A.clone().add(B).multiplyScalar(0.5);
      const dot = A.clone().addScaledVector(dir, p);
      const m = pool[slot];
      m.line.opacity = 0.7 * env * a;
      m.line.color.set(SL).multiplyScalar(1.1);
      m.dot.opacity = env * a;
      m.dot.color.set(SL).multiplyScalar(1.6);
      segs.push(
        <group key={slot}>
          <mesh position={mid} quaternion={q} scale={[L, 0.007, 0.007]} material={m.line} renderOrder={5}>
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
          <mesh position={dot} material={m.dot} renderOrder={5}>
            <sphereGeometry args={[0.046, 10, 10]} />
          </mesh>
        </group>
      );
    });
  });

  return (
    <group visible={a > 0.002}>
      {RING_NODES.map((p, i) => (
        <mesh key={i} position={p} material={nodeMat} renderOrder={5}>
          <sphereGeometry args={[0.075, 14, 14]} />
        </mesh>
      ))}
      <mesh position={RING_C} quaternion={RING_Q} material={torusMat} renderOrder={5}>
        <torusGeometry args={[RING_R, 0.008, 6, 64]} />
      </mesh>
      <pointLight position={RING_C} color={SL} intensity={14 * film.ringFlash * a} distance={7} decay={2} />
      {segs}
    </group>
  );
};

// ---------------------------------------------------------------------------
// The shielded stream: sealed slabs fly in from the right, touch the ring, drop into the compartment
// ---------------------------------------------------------------------------
function buildShieldSchedule() {
  const items = laneCrowd(101, LANE_X0);
  const n = items.length;
  const rnd = mulberry32(4242);
  const order = items.map((_, i) => i).sort(() => rnd() - 0.5);
  const arrival = new Array<number>(n);
  order.forEach((idx, rank) => {
    arrival[idx] = 58 + (rank * (268 - 58)) / (n - 1) + (rnd() - 0.5) * 3;
  });
  const origin: V3[] = items.map(() => [SHIELD_ORIGIN[0] + (rnd() - 0.5) * 1.2, SHIELD_ORIGIN[1] + (rnd() - 0.5) * 0.8, SHIELD_ORIGIN[2] + (rnd() - 0.5) * 1.2]);
  // a slab touching the ring sets off a gossip round: the node that saw it tells three others
  const gossip: Gossip[] = items.map((_, i) => {
    const from = Math.floor(rnd() * RING_N);
    const pick = () => (from + 3 + Math.floor(rnd() * (RING_N - 5))) % RING_N;
    return { at: arrival[i] - FLIGHT_SH + RING_ARRIVE * FLIGHT_SH, from, to: [pick(), pick(), pick()] as [number, number, number] };
  });
  gossip.sort((p, q) => p.at - q.at);
  return { items, arrival, origin, gossip };
}

const LaneFill: React.FC<{ film: Film; sched: ReturnType<typeof buildShieldSchedule> }> = ({ film, sched }) => {
  const { items, arrival, origin } = sched;
  const meshes = useMemo(() => {
    const n = items.length;
    const settled = new THREE.InstancedMesh(new THREE.BoxGeometry(...LANE_SLAB), makeCrowdMat(laneCrowdFrag, { uHue: { value: new THREE.Color('#4576e8') } }, true), n);
    const flight = new THREE.InstancedMesh(
      new THREE.BoxGeometry(...LANE_SLAB),
      makeCrowdMat(sealedFrag, { uBody: { value: new THREE.Color('#0a0d24') }, uRim: { value: new THREE.Color('#7d93ff') } }),
      n
    );
    for (let i = 0; i < n; i++) {
      settled.setMatrixAt(i, HIDDEN);
      flight.setMatrixAt(i, HIDDEN);
      const b = 0.22 + 0.78 * items[i].prox;
      settled.setColorAt(i, new THREE.Color(b, b, b));
    }
    settled.renderOrder = 1;
    flight.renderOrder = 1;
    settled.frustumCulled = false;
    flight.frustumCulled = false;
    flight.castShadow = true;
    const ticks = makeTicks(n);
    (ticks.material as THREE.MeshBasicMaterial).color.copy(TICK_GREEN).multiplyScalar(1.3);
    return { settled, flight, ticks };
  }, [items]);
  const { settled, flight, ticks } = meshes;
  (ticks.material as THREE.MeshBasicMaterial).opacity = 0.95 * (1 - film.dolly);
  const f = film.frame;
  const su = (settled.material as THREE.ShaderMaterial).uniforms;
  su.uBrightness.value = 0.42 * lerp(1, 0.55, film.dolly) * (1 + 1.2 * film.attest) * (1 + 1.5 * film.aggFlash);

  for (let i = 0; i < items.length; i++) {
    const a = arrival[i];
    const d = a - FLIGHT_SH;
    const it = items[i];
    if (f < d) {
      settled.setMatrixAt(i, HIDDEN);
      flight.setMatrixAt(i, HIDDEN);
    } else if (f < a) {
      // out of the shielded origin, up to the committee ring, then the copy drops into the compartment
      const ring = RING_C;
      const u = (f - d) / FLIGHT_SH;
      let x: number, y: number, z: number;
      if (u < RING_ARRIVE) {
        const s = u / RING_ARRIVE;
        const o = origin[i];
        const cx = (o[0] + ring[0]) / 2;
        const cy = (o[1] + ring[1]) / 2 + 0.9;
        const cz = (o[2] + ring[2]) / 2 + 0.5;
        const t1 = 1 - s;
        x = t1 * t1 * o[0] + 2 * t1 * s * cx + s * s * ring[0];
        y = t1 * t1 * o[1] + 2 * t1 * s * cy + s * s * ring[1];
        z = t1 * t1 * o[2] + 2 * t1 * s * cz + s * s * ring[2];
      } else if (u < RING_ARRIVE + 0.09) {
        x = ring[0];
        y = ring[1];
        z = ring[2];
      } else {
        const s = easeOut((u - RING_ARRIVE - 0.09) / (1 - RING_ARRIVE - 0.09));
        x = lerp(ring[0], it.pos[0], s);
        y = lerp(ring[1], it.pos[1], s);
        z = lerp(ring[2], it.pos[2], s);
      }
      tmpObj.position.set(x, y, z);
      tmpObj.scale.set(1, 1, 1);
      tmpObj.rotation.set(0, it.rotY, 0);
      tmpObj.updateMatrix();
      flight.setMatrixAt(i, tmpObj.matrix);
      settled.setMatrixAt(i, HIDDEN);
    } else {
      tmpObj.position.set(...it.pos);
      tmpObj.scale.set(1, 1, 1);
      tmpObj.rotation.set(0, it.rotY, 0);
      tmpObj.updateMatrix();
      settled.setMatrixAt(i, tmpObj.matrix);
      flight.setMatrixAt(i, HIDDEN);
    }
    const passed = it.pos[0] <= film.execX;
    const b = (0.22 + 0.78 * it.prox) * (passed ? 1 + 0.7 * (1 - film.dolly) : 1);
    settled.setColorAt(i, tmpColor.setRGB(b, b, b));
    if (passed) {
      tmpObj.position.set(it.pos[0], it.pos[1] + LANE_SLAB[1] / 2 + 0.05, it.pos[2]);
      tmpObj.scale.set(1, 1, 1);
      tmpObj.rotation.set(0, 0, 0);
      tmpObj.updateMatrix();
      ticks.setMatrixAt(i, tmpObj.matrix);
    } else {
      ticks.setMatrixAt(i, HIDDEN);
    }
  }
  settled.instanceMatrix.needsUpdate = true;
  flight.instanceMatrix.needsUpdate = true;
  ticks.instanceMatrix.needsUpdate = true;
  if (settled.instanceColor) settled.instanceColor.needsUpdate = true;
  return (
    <>
      <primitive object={settled} />
      <primitive object={flight} />
      <primitive object={ticks} />
    </>
  );
};

// The aggregate proof: one bright thin slab on top of the shielded compartment.
const Aggregate: React.FC<{ film: Film }> = ({ film }) => {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#d9c2ff', transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }), []);
  const a = film.agg;
  mat.opacity = a * 0.9;
  mat.color.set('#d9c2ff').multiplyScalar(0.85 + 3.0 * film.aggFlash);
  return (
    <group visible={a > 0.002}>
      <mesh position={[LANE_CX, HULL_TOP + 0.1, 0]} material={mat} renderOrder={5}>
        <boxGeometry args={[BLOCK.lane * 0.88, 0.05, BLOCK.depth * 0.88]} />
      </mesh>
      <pointLight position={[LANE_CX, HULL_TOP + 0.5, 0.6]} color={SL} intensity={16 * film.aggFlash} distance={7} decay={2} />
    </group>
  );
};

// The executor's cursor: a thin plane that moves through the hull at constant speed. No bloom.
const Cursor: React.FC<{ film: Film }> = ({ film }) => {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: VA, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }), []);
  mat.opacity = film.cursorA * 0.55;
  mat.color.set(VA).multiplyScalar(0.62);
  const x = Math.min(Math.max(film.execX, X0_N - 0.05), X0_N + BLOCK_LEN + 0.05);
  return (
    <mesh position={[x, HY + BLOCK.height / 2, 0]} material={mat} renderOrder={5} visible={film.cursorA > 0.002}>
      <boxGeometry args={[0.02, BLOCK.height * 1.03, BLOCK.depth * 1.03]} />
    </mesh>
  );
};

// ---------------------------------------------------------------------------
// Beacon chain: slabs on a row, the proposer node, the commitment trunk + branches
// ---------------------------------------------------------------------------
const BEACON_SIZE: V3 = [BEACON.w, BEACON.h, BEACON.d];
const BeaconSlab: React.FC<{ pos: V3; ghost: number; lit: number; dim: number; pulse: number }> = ({ pos, ghost, lit, dim, pulse }) => {
  const core = useMemo(() => new THREE.MeshBasicMaterial({ color: '#c9f0ff', transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }), []);
  core.opacity = lit * (1 - ghost) * 0.85;
  core.color.set('#c9f0ff').multiplyScalar(0.8 + 3.6 * pulse);
  const solid = 1 - ghost;
  return (
    <group>
      <mesh position={pos} material={core} renderOrder={2} visible={core.opacity > 0.002}>
        <boxGeometry args={[BEACON.w * 0.5, BEACON.h * 0.3, BEACON.d * 0.46]} />
      </mesh>
      <GlassShell size={BEACON_SIZE} position={pos} fill="#6f9ad0" fillMix={['#8fd3ff', lit]} edge="#cfe2ff" edgeMix={['#eafaff', lit]} fillAlpha={solid * lerp(0.05, 0.1, lit)} edgeStrength={solid * lerp(0.35, 0.7, lit)} />
      <BoxEdges size={BEACON_SIZE} position={pos} color="#9ab6e0" mix={[lit > 0.5 ? '#e6f7ff' : '#bcd6ff', solid]} opacity={ghost * 0.28 + solid * lerp(0.42 * dim, 0.75, lit)} />
    </group>
  );
};

const BeaconLink: React.FC<{ from: number; to: number; dim: number }> = ({ from, to, dim }) => {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#bfe6ff', transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }), []);
  mat.color.set('#bfe6ff').multiplyScalar(0.9 * dim);
  const len = to - from;
  return (
    <mesh position={[from + len / 2, BEACON.y, 0]} material={mat} renderOrder={2} visible={dim > 0.002}>
      <boxGeometry args={[len, 0.01, 0.01]} />
    </mesh>
  );
};

const BeaconChain: React.FC<{ film: Film }> = ({ film }) => {
  const p = film.dolly;
  const half = BEACON.w / 2;
  const linkBase = (toK: number) => (toK <= -2 ? 0.35 : toK === -1 ? 0.6 : 0.3);
  const linkDim = (toK: number) => lerp(linkBase(toK), linkBase(toK - 1), p);
  const cxOf = (k: number) => blockX0(k) + BLOCK_LEN / 2;
  const bottom: V3 = [cxOf(0), BEACON.y - BEACON.h / 2, 0];
  const hairA = 0.6 * (1 - p);
  const nodeMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#dfe9ff', transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }), []);
  nodeMat.opacity = film.nodeA * (1 - p);
  nodeMat.color.set('#dfe9ff').multiplyScalar(0.9 + 3.2 * film.commitPulse);
  const propMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#eaf3ff', transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }), []);
  propMat.opacity = film.proposerA;
  propMat.color.set('#eaf3ff').multiplyScalar(0.9 + 3.0 * film.proposerPulse);
  // the beacon block is emitted by the proposer: it travels from the node to its place on the row
  const b = film.beaconBirth;
  const slab0: V3 = [cxOf(0), BEACON.y, 0];
  const born: V3 = [lerp(PROPOSER[0], slab0[0], b), lerp(PROPOSER[1], slab0[1], b), lerp(PROPOSER[2], slab0[2], b)];
  const bornScale = lerp(0.08, 1, b);
  return (
    <group>
      <BeaconSlab pos={[cxOf(-2), BEACON.y, 0]} ghost={0} lit={0} dim={0.35} pulse={0} />
      <BeaconSlab pos={[cxOf(-1), BEACON.y, 0]} ghost={0} lit={0} dim={lerp(0.6, 0.35, p)} pulse={0} />
      <group position={born} scale={bornScale} visible={b > 0.002}>
        <BeaconSlab pos={[0, 0, 0]} ghost={0} lit={film.lit} dim={lerp(1, 0.6, p)} pulse={film.commitPulse} />
      </group>
      <BeaconSlab pos={[cxOf(1), BEACON.y, 0]} ghost={1} lit={0} dim={1} pulse={0} />
      <BeaconSlab pos={[cxOf(2), BEACON.y, 0]} ghost={1} lit={0} dim={1} pulse={0} />
      <BeaconLink from={cxOf(-2) + half} to={cxOf(-1) - half} dim={linkDim(-1)} />
      <BeaconLink from={cxOf(-1) + half} to={cxOf(0) - half} dim={linkDim(0) * b} />
      <BeaconLink from={cxOf(0) + half} to={cxOf(1) - half} dim={linkDim(1) * b} />
      <BeaconLink from={cxOf(1) + half} to={cxOf(2) - half} dim={linkDim(2) * b} />
      {/* the proposer: a distinct node above the row */}
      <mesh position={PROPOSER} material={propMat} renderOrder={6} visible={film.proposerA > 0.002}>
        <sphereGeometry args={[0.09, 16, 16]} />
      </mesh>
      <pointLight position={PROPOSER} color="#eaf3ff" intensity={10 * film.proposerPulse} distance={6} decay={2} />
      {/* the proof rising from the shielded compartment to the hull top (slot N t=11) */}
      <GrowLine from={LANE_TOP} to={NODE} len={0.85 * film.proofLine} color={SL} opacity={0.85 * film.proofLine} bright={1.1} thick={0.01} />
      {/* the commitment: one trunk drops from the beacon block onto the hull's top centre ... */}
      <GrowLine from={bottom} to={NODE} len={film.trunk} color="#dfe9ff" opacity={hairA} bright={1.0 + 2.5 * film.commitPulse} thick={0.016} />
      <mesh position={NODE} material={nodeMat} renderOrder={6} visible={nodeMat.opacity > 0.002}>
        <sphereGeometry args={[0.07, 14, 14]} />
      </mesh>
      {/* ... then two branches run along the top, one to each compartment */}
      <GrowLine from={NODE} to={PAY_TOP} len={film.branch} color={BL} opacity={hairA} bright={1.1 + 2.0 * film.commitPulse} thick={0.018} />
      <GrowLine from={NODE} to={LANE_TOP} len={film.branch} color={SL} opacity={hairA} bright={1.1 + 2.0 * film.commitPulse} thick={0.018} />
      <pointLight position={[NODE[0], NODE[1] + 0.2, 0.5]} color="#bfe6ff" intensity={14 * film.commitPulse} distance={8} decay={2} />
    </group>
  );
};

// ---------------------------------------------------------------------------
// The builder: one small glass slab on the floor between the mempool and the hull.
// Public transactions run through it; it bids to the proposer; it hands over the payload.
// ---------------------------------------------------------------------------
const BuilderNode: React.FC<{ film: Film }> = ({ film }) => {
  const a = film.builderObjA;
  const lit = film.builderLit;
  const work = film.builderWork;
  const flash = film.bidPulse + film.revealPulse;

  // the press cycle: the scanning bar drops over the rail, flashes at the bottom, retracts
  const f = film.frame;
  const ph = ((f % PRESS_P) + PRESS_P) % PRESS_P / PRESS_P;
  const stroke = ph < 0.5 ? easeOutQuad(ph / 0.5) : 1 - easeInOut((ph - 0.5) / 0.5);
  const headY = lerp(RIG.headUp, RIG.headDown, stroke * work);
  const press = work * gauss(ph, 0.5, 0.075);

  // dark anodised frame; the platform is darker and rougher so the gantry reads against it
  const frameMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#465a83', metalness: 0.66, roughness: 0.29, envMapIntensity: 1.15, transparent: true }), []);
  const platMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1d2740', metalness: 0.5, roughness: 0.5, envMapIntensity: 0.8, transparent: true }), []);
  const railMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5b70a0', metalness: 0.82, roughness: 0.2, envMapIntensity: 1.4, transparent: true }), []);
  frameMat.opacity = a;
  platMat.opacity = a;
  railMat.opacity = a;
  frameMat.emissive.set('#1c4d96').multiplyScalar(0.38 * lit);
  railMat.emissive.set('#1c4d96').multiplyScalar(0.3 * lit);

  // blue accents: the platform seam, the rail seam, the post caps
  const accent = useMemo(
    () => new THREE.MeshBasicMaterial({ color: BL, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }),
    []
  );
  accent.opacity = a * (0.22 + 0.78 * lit) * (0.78 + 0.4 * work);
  accent.color.set(BL).multiplyScalar(1.35 + 1.6 * flash);

  // the scanning bar: the one bright thing on the rig
  const scan = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#a8d6ff', transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }),
    []
  );
  scan.opacity = a * lit * (0.3 + 0.7 * work) * (0.6 + 0.4 * stroke);
  scan.color.set('#bfe2ff').multiplyScalar(1.45 + 1.5 * press + 1.2 * flash);

  // the press light rides the bar, so the flash lands on the cubes under it
  const pressW: V3 = [BUILDER[0], BUILDER[1] + headY - 0.05, BUILDER[2]];

  const dia = useMemo(
    () => new THREE.MeshBasicMaterial({ color: BL, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }),
    []
  );
  const diaA = film.bidA * (1 - clamp01((film.bidT - 0.9) / 0.1));
  dia.opacity = diaA;
  dia.color.set('#c2daff').multiplyScalar(1.2);
  const diaPos: V3 = [
    lerp(BUILDER_TOP[0], PROPOSER[0], film.bidT),
    lerp(BUILDER_TOP[1], PROPOSER[1], film.bidT),
    lerp(BUILDER_TOP[2], PROPOSER[2], film.bidT),
  ];

  const pulseMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: BL, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }),
    []
  );
  pulseMat.opacity = 0.9 * film.revealPulse;
  pulseMat.color.set('#7fb0ff').multiplyScalar(1.9);
  const pa = new THREE.Vector3(...BUILDER_OUT);
  const pb = new THREE.Vector3(...PAY_DOOR);
  const pdir = pb.clone().sub(pa);
  const ppos = pa.clone().add(pdir.clone().multiplyScalar(smooth(film.revealT)));
  const pq = new THREE.Quaternion().setFromUnitVectors(X_AXIS, pdir.clone().normalize());

  return (
    <group>
      <group position={BUILDER} rotation={[0, BUILDER_ROTY, 0]} visible={a > 0.004}>
        {/* the platform: a low dark slab on the floor, with one blue seam along its front edge */}
        <mesh position={[0, RIG.platY, 0]} material={platMat} castShadow receiveShadow>
          <boxGeometry args={[RIG.plat[0], RIG.plat[1], RIG.plat[2]]} />
        </mesh>
        <mesh position={[0, RIG.platY + 0.036, RIG.plat[2] / 2 - 0.01]} material={accent} renderOrder={4}>
          <boxGeometry args={[RIG.plat[0] * 0.95, 0.006, 0.006]} />
        </mesh>

        {/* the conveyor: two rails on ties, running the length of the platform */}
        {[-1, 1].map((k) => (
          <mesh key={`rail${k}`} position={[0, RIG.railY, k * RIG.railZ]} material={railMat} castShadow>
            <boxGeometry args={[0.98, 0.026, 0.05]} />
          </mesh>
        ))}
        {[-0.42, -0.21, 0, 0.21, 0.42].map((x) => (
          <mesh key={`tie${x}`} position={[x, RIG.railY - 0.013, 0]} material={frameMat}>
            <boxGeometry args={[0.028, 0.016, 0.30]} />
          </mesh>
        ))}
        <mesh position={[0, RIG.railY + 0.016, 0]} material={accent} renderOrder={4}>
          <boxGeometry args={[0.94, 0.005, 0.005]} />
        </mesh>

        {/* the gantry: four legs carrying two crossbars, bridged along the rail */}
        {[-1, 1].map((kx) => (
          <group key={`portal${kx}`}>
            {[-1, 1].map((kz) => (
              <group key={kz}>
                <mesh position={[kx * RIG.legX, RIG.postY, kz * RIG.postZ]} material={frameMat} castShadow>
                  <boxGeometry args={[0.07, RIG.postH, 0.065]} />
                </mesh>
                <mesh position={[kx * RIG.legX, RIG.capY, kz * RIG.postZ]} material={accent} renderOrder={4}>
                  <boxGeometry args={[0.082, 0.014, 0.078]} />
                </mesh>
              </group>
            ))}
            <mesh position={[kx * RIG.legX, RIG.barY, 0]} material={frameMat} castShadow>
              <boxGeometry args={[0.09, 0.08, 0.615]} />
            </mesh>
          </group>
        ))}
        {[-1, 0, 1].map((kz) => (
          <mesh key={`spine${kz}`} position={[0, RIG.barY, kz * RIG.postZ]} material={frameMat} castShadow>
            <boxGeometry args={[0.49, 0.055, 0.062]} />
          </mesh>
        ))}

        {/* the ram, and the scanning bar that sweeps down over each cube on the rail */}
        <mesh position={[0, (RIG.barY + headY) / 2, 0]} material={frameMat}>
          <boxGeometry args={[0.034, Math.max(0.006, RIG.barY - headY), 0.034]} />
        </mesh>
        <mesh position={[0, headY, 0]} material={frameMat} castShadow>
          <boxGeometry args={[0.10, 0.05, 0.44]} />
        </mesh>
        <mesh position={[0, headY - 0.042, 0]} material={scan} renderOrder={5} visible={scan.opacity > 0.004}>
          <boxGeometry args={[0.16, 0.011, 0.42]} />
        </mesh>
      </group>
      <pointLight position={pressW} color="#9ecbff" intensity={a * lit * (0.4 + 0.8 * work + 2.2 * press)} distance={1.8} decay={2} />
      <pointLight position={[BUILDER_TOP[0], BUILDER_TOP[1] + 0.7, BUILDER_TOP[2] + 0.5]} color="#cfe2ff" intensity={2.6 * a + 3.2 * flash} distance={4.2} decay={2} />

      {/* the bid: one hairline up to the proposer, with a diamond running it */}
      <GrowLine from={BUILDER_TOP} to={PROPOSER} len={film.bidLen} color={BL} opacity={0.48 * film.bidA} bright={1.15} thick={0.008} />
      <mesh position={diaPos} material={dia} renderOrder={6} rotation={[0, Math.PI / 4, 0]} visible={diaA > 0.004}>
        <octahedronGeometry args={[0.07, 0]} />
      </mesh>

      {/* the reveal: the payload goes from the builder into the public compartment */}
      <mesh
        position={[ppos.x, ppos.y, ppos.z]}
        quaternion={pq}
        scale={[0.8, 0.034, 0.034]}
        material={pulseMat}
        renderOrder={6}
        visible={pulseMat.opacity > 0.004}
      >
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <pointLight position={[ppos.x, ppos.y, ppos.z]} color="#7aa2f7" intensity={6 * film.revealPulse} distance={4} decay={2} />
    </group>
  );
};

// ---------------------------------------------------------------------------
// Attesters: a wide field of validator dots behind the beacon row; attestation pulses; the PTC subset
// ---------------------------------------------------------------------------
function attesterField() {
  const rnd = mulberry32(77);
  const dots: V3[] = [];
  for (let i = 0; i < ATT_N; i++) {
    const t = i / (ATT_N - 1);
    const x = -12.5 + 18.5 * t + (rnd() - 0.5) * 0.5;
    const z = -5.0 - 0.03 * x * x + (rnd() - 0.5) * 1.4;
    const y = 1.7 + rnd() * 1.4 + 0.03 * Math.abs(x);
    dots.push([x, y, z]);
  }
  const order = dots.map((_, i) => i).sort(() => rnd() - 0.5);
  const rankOf = new Array<number>(ATT_N);
  order.forEach((di, r) => (rankOf[di] = r));
  const ptc = dots
    .map((d, i) => ({ i, dd: Math.abs(d[0] - 2.6) + Math.abs(d[2] + 5.0) * 0.6 }))
    .sort((a, b) => a.dd - b.dd)
    .slice(0, PTC_N)
    .map((o) => o.i);
  const ptcC = ptc.reduce<V3>((acc, i) => [acc[0] + dots[i][0] / PTC_N, acc[1] + dots[i][1] / PTC_N, acc[2] + dots[i][2] / PTC_N], [0, 0, 0]);
  return { dots, rankOf, ptc, ptcC };
}
const ATT = attesterField();
// arrival frame of the r-th attestation, derived from the count curve so the counter equals the arrivals
const ATT_ARR: number[] = (() => {
  const arr = new Array<number>(ATT_N).fill(1e9);
  let r = 0;
  for (let f = F.commit; f <= F.attest + 60 && r < ATT_N; f++) {
    const c = attCount(f);
    while (r < c) arr[r++] = f;
  }
  return arr;
})();
const ATT_TARGET: V3 = [BLOCK_CX, BEACON.y - 0.02, -BEACON.d / 2];
const PTC_TARGET: V3 = [PAY_CX + 0.6, HULL_TOP + 0.02, -0.2];

const Attesters: React.FC<{ film: Film }> = ({ film }) => {
  const data = useMemo(() => {
    const dots = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.024, 8, 8),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending, fog: true }),
      ATT_N
    );
    ATT.dots.forEach((d, i) => {
      tmpObj.position.set(...d);
      tmpObj.scale.set(1, 1, 1);
      tmpObj.rotation.set(0, 0, 0);
      tmpObj.updateMatrix();
      dots.setMatrixAt(i, tmpObj.matrix);
      dots.setColorAt(i, tmpColor.set('#c9d6f5'));
    });
    dots.instanceMatrix.needsUpdate = true;
    dots.renderOrder = 2;
    dots.frustumCulled = false;
    const pulses = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#dfe9ff').multiplyScalar(1.3), transparent: true, opacity: 1, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending, fog: true }),
      ATT_N
    );
    pulses.renderOrder = 5;
    pulses.frustumCulled = false;
    const ptcPulses = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: OK, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }),
      PTC_N
    );
    ptcPulses.renderOrder = 5;
    ptcPulses.frustumCulled = false;
    return { dots, pulses, ptcPulses };
  }, []);
  const { dots, pulses, ptcPulses } = data;
  const f = film.frame;
  (dots.material as THREE.MeshBasicMaterial).opacity = 0.5 * film.attField * (1 - film.dolly);
  const ptcOn = film.ptcA;
  const ptcSet = new Set(ATT.ptc);
  const streak = (mesh: THREE.InstancedMesh, i: number, from: V3, to: V3, p: number, len: number, thick: number) => {
    tmpA.set(...from);
    tmpB.set(...to);
    tmpDir.copy(tmpB).sub(tmpA);
    const L = tmpDir.length();
    tmpDir.normalize();
    const head = Math.min(L, p * L);
    const tail = Math.max(0, head - len);
    tmpObj.position.copy(tmpA).addScaledVector(tmpDir, (head + tail) / 2);
    tmpObj.quaternion.setFromUnitVectors(X_AXIS, tmpDir);
    tmpObj.scale.set(Math.max(0.001, head - tail), thick, thick);
    tmpObj.updateMatrix();
    mesh.setMatrixAt(i, tmpObj.matrix);
  };
  for (let i = 0; i < ATT_N; i++) {
    const a = ATT_ARR[ATT.rankOf[i]];
    const arrived = f >= a;
    const inFlight = f >= a - ATT_FLIGHT && f < a;
    const isPtc = ptcSet.has(i);
    if (arrived) tmpColor.set(OK).multiplyScalar(0.55 + 0.45 * film.quorum);
    else tmpColor.set('#c9d6f5').multiplyScalar(0.75);
    if (isPtc && ptcOn > 0) tmpColor.lerp(tmpColor.clone().set(OK).multiplyScalar(1.8), ptcOn);
    dots.setColorAt(i, tmpColor);
    if (inFlight) {
      const p = easeOutQuad((f - (a - ATT_FLIGHT)) / ATT_FLIGHT);
      streak(pulses, i, ATT.dots[i], ATT_TARGET, p, 0.75, 0.018);
    } else {
      pulses.setMatrixAt(i, HIDDEN);
    }
  }
  for (let j = 0; j < PTC_N; j++) {
    const start = F.ptc + (j % 8) * 2 + Math.floor(j / 8) * 3;
    const flight = 16;
    if (f >= start && f < start + flight) {
      const p = easeOutQuad((f - start) / flight);
      streak(ptcPulses, j, ATT.dots[ATT.ptc[j]], PTC_TARGET, p, 0.6, 0.014);
    } else {
      ptcPulses.setMatrixAt(j, HIDDEN);
    }
  }
  dots.instanceMatrix.needsUpdate = true;
  if (dots.instanceColor) dots.instanceColor.needsUpdate = true;
  pulses.instanceMatrix.needsUpdate = true;
  ptcPulses.instanceMatrix.needsUpdate = true;
  (pulses.material as THREE.MeshBasicMaterial).opacity = 1 - film.dolly;
  return (
    <>
      <primitive object={dots} />
      <primitive object={pulses} />
      <primitive object={ptcPulses} />
    </>
  );
};

// ---------------------------------------------------------------------------
// Floor + haze
// ---------------------------------------------------------------------------
const Floor: React.FC = () => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
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
      envMapIntensity={0.15}
    />
  </mesh>
);

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

const HorizonHaze: React.FC<{ camX: number }> = ({ camX }) => {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: hazeFrag,
        uniforms: { uColor: { value: new THREE.Color('#0b1530') }, uAccent: { value: new THREE.Color('#12304a') } },
        depthWrite: false,
        fog: false,
      }),
    []
  );
  return (
    <mesh position={[-30 + camX, 30, -60]} rotation={[0, 0.25, 0]} material={mat}>
      <planeGeometry args={[320, 60]} />
    </mesh>
  );
};

// Drives the depth-of-field focus per frame without recreating the effect.
const DofDriver: React.FC<{ film: Film; dof: React.RefObject<DepthOfFieldEffect> }> = ({ film, dof }) => {
  useLayoutEffect(() => {
    const e = dof.current;
    if (!e) return;
    e.cocMaterial.worldFocusDistance = film.focusDist;
    e.cocMaterial.worldFocusRange = film.focusRange;
  }, [film.focusDist, film.focusRange, dof]);
  return null;
};

// ---------------------------------------------------------------------------
// The scene
// ---------------------------------------------------------------------------
const Scene: React.FC<{ film: Film; sched: ReturnType<typeof buildShieldSchedule> }> = ({ film, sched }) => {
  const p = film.dolly;
  const f = film.frame;
  const dof = useRef<DepthOfFieldEffect>(null);
  const laneFill = clamp01((f - 58) / (268 - 58));
  const laneBodyN = lerp(0.18, 0.76, smooth(laneFill));
  const laneGlowN = CAM.laneGlow * (0.3 + 0.7 * smooth(laneFill)) + 1.4 * film.attest + 1.6 * film.aggFlash + 0.8 * film.freeze;
  const payFill = clamp01((f - 42) / (352 - 42));
  const payLight = 3.5 * (0.12 + 0.3 * payFill + 0.58 * film.reveal) * (1 - 0.75 * p);
  // the seal reads on the walls now, so the outline keeps only a short beat
  const edgeBoost = 0.55 * film.solidify * (1 - p) + 0.12 * film.sealed * (1 - p) + 0.9 * film.sealFlash;
  return (
    <>
      <CameraRig frame={f} />
      <EnvLight />
      <Lights />
      <color attach="background" args={[VOID]} />
      <fog attach="fog" args={[VOID, FOG_NEAR * 0.8, FOG_FAR]} />
      <pointLight position={[PAY_CX, HY + BLOCK.height * 0.8, 0]} color="#ffd9e6" intensity={payLight} distance={11} decay={2} />
      <pointLight position={[PAY_CX + PITCH, HY + BLOCK.height * 0.8, 0]} color="#ffd9e6" intensity={3.5 * 0.12 * p} distance={11} decay={2} />
      <pointLight position={[LANE_CX, HY + BLOCK.height * 0.5, 0]} color="#5f7dff" intensity={(1.2 + laneGlowN * 2.0) * (1 - 0.5 * p)} distance={5} decay={2} />
      <HorizonHaze camX={film.camX} />
      <Floor />

      {/* blocks behind: full and fogged */}
      {[-2, -1].map((k) => (
        <group key={k}>
          <StaticCrowd seed={17 + k * 31} count={340} x0={blockX0(k)} desat={0.9} brightness={0.4} alpha={0.55} />
          <StaticLaneCrowd seed={101 + k * 7} x0={blockX0(k) + BLOCK.payload + BLOCK.join} dim={0.55} />
          <Hull
            k={k}
            solid={1}
            focus={0}
            laneBodyAlpha={0.76}
            laneGlow={CAM.laneGlow * 0.5}
            laneRimMix={0}
            confirm={1}
            confirmTrace={1}
            tint={1}
            secure={1}
            secureFace={SECURE_SEALED}
            sealFace={1}
          />
        </group>
      ))}

      {/* block N: filled over the film */}
      <PayloadFill film={film} />
      <LaneFill film={film} sched={sched} />
      <Hull
        k={0}
        solid={1}
        focus={1 - p}
        laneBodyAlpha={laneBodyN}
        laneGlow={lerp(laneGlowN, CAM.laneGlow * 0.5, p)}
        laneRimMix={film.attest * (1 - 0.6 * film.confirmMute)}
        laneRimEdge={film.attest * (1 - film.confirmMute)}
        laneEdgePulse={film.freeze + film.ringFlash * 0.6}
        edgeBoost={edgeBoost}
        flash={film.sealFlash}
        confirm={film.confirmLit}
        confirmTrace={film.confirmTrace}
        tint={film.confirmTint}
        secure={film.secure}
        secureFace={film.secureFace}
        securePulse={film.securePulse}
        sealFace={film.sealFace}
      />

      {/* N+1 ghost becomes the next empty hull during the advance; N+2 stays a ghost */}
      <Hull k={1} solid={p} focus={1} laneBodyAlpha={0.22} laneGlow={CAM.laneGlow * 0.3} laneRimMix={0} />
      <Hull k={2} solid={0} focus={1} laneBodyAlpha={0.22} laneGlow={0} laneRimMix={0} />

      <Attesters film={film} />
      <Committee film={film} gossip={sched.gossip} />
      <Aggregate film={film} />
      <Cursor film={film} />
      <BeaconChain film={film} />
      <BuilderNode film={film} />

      <EffectComposer multisampling={4}>
        <DepthOfField ref={dof} worldFocusDistance={film.focusDist} worldFocusRange={film.focusRange} bokehScale={2.2} />
        <Bloom intensity={1.1} luminanceThreshold={0.92} luminanceSmoothing={0.18} mipmapBlur radius={0.6} />
        <ToneMapping mode={ToneMappingMode.AGX} />
        <Noise blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.32} />
        <Vignette offset={0.28} darkness={0.55} blendFunction={BlendFunction.NORMAL} />
      </EffectComposer>
      <DofDriver film={film} dof={dof} />
    </>
  );
};

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------
function makeProjector(frame: number, width: number, height: number) {
  const c = cameraAt(frame);
  const cam = new THREE.PerspectiveCamera(CAM.fov, width / height, 0.1, 120);
  cam.position.set(...c.pos);
  cam.lookAt(new THREE.Vector3(...c.look));
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  return (x: number, y: number, z: number): [number, number] => {
    const p = new THREE.Vector3(x, y, z).project(cam);
    return [((p.x + 1) / 2) * width, ((1 - p.y) / 2) * height];
  };
}

// A label that enters and exits on a short fade with a small rise (the alpha is driven by the film).
const Label: React.FC<{ at: [number, number]; a: number; color?: string; align?: 'center' | 'right' | 'left'; size?: number; weight?: number; children: React.ReactNode }> = ({
  at,
  a,
  color = '#e6edf7',
  align = 'center',
  size = 26,
  weight = 400,
  children,
}) => {
  if (a <= 0.002) return null;
  const tx = align === 'center' ? 'translateX(-50%)' : align === 'right' ? 'translateX(-100%)' : 'translateX(0)';
  return (
    <div
      style={{
        position: 'absolute',
        left: at[0],
        top: at[1],
        transform: `${tx} translateY(${((1 - a) * 8).toFixed(2)}px)`,
        fontFamily: MONO,
        fontSize: size,
        lineHeight: `${size + 6}px`,
        letterSpacing: '0.02em',
        color,
        opacity: a,
        fontWeight: weight,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Timeline: the slot diagram as swimlanes (builder, lane committee, lane proposer, proposer, attesters, execution)
// ---------------------------------------------------------------------------
const TL = { labelX: 100, x0: 530, xe: 1790, evY: 780, rowY0: 836, rowP: 28, barH: 8, axis: 998, tick: 8, tickLabel: 1008, slotLabel: 1040 };
const SLOT_W = (TL.xe - TL.x0) / 2;
const XB = TL.x0 + SLOT_W;
const xN1 = (t: number) => XB + (t * SLOT_W) / 12;
const xAt = (frame: number) => TL.x0 + ((TL.xe - TL.x0) * Math.min(frame, SLOT_FRAMES)) / SLOT_FRAMES;
const rowY = (i: number) => TL.rowY0 + i * TL.rowP;

interface Row {
  label: string;
  color: string;
  from?: number; // frames
  to?: number;
}
const ROWS: Row[] = [
  { label: 'builder', color: BL, from: 0, to: F.reveal },
  { label: 'lane committee', color: SL, from: 0, to: F.broadcast },
  { label: 'lane merge', color: SL, from: F.freeze, to: F.agg },
  { label: 'proposer', color: FG },
  { label: 'attesters', color: OK, from: F.commit, to: F.attest },
  { label: 'execution', color: VA, from: F.reveal, to: SLOT_FRAMES },
];

interface Ev {
  at: number;
  text: string;
  color: string;
}
const EVENTS: Ev[] = [
  { at: 0, text: 'txs arrive', color: FG },
  { at: F.broadcast, text: 'lane lists broadcast', color: SL },
  { at: F.freeze, text: 'view freeze', color: SL },
  { at: F.agg, text: 'lists merged into one lane', color: SL },
  { at: F.commit, text: 'commit: bid + lane', color: FG },
  { at: F.attest, text: 'attested: block N secured', color: CONF },
  { at: F.reveal, text: 'payload revealed', color: BL },
  { at: F.exec, text: 'execute in committed order', color: VA },
  { at: F.ptc, text: 'PTC: payload available', color: OK },
  { at: F.seal, text: 'sealed', color: OK },
];

const TICKS: { x: number; label: string; align: 'left' | 'center' | 'right' }[] = [
  { x: TL.x0, label: 't=0', align: 'center' },
  { x: TL.x0 + (3 * SLOT_W) / 12, label: 't=3', align: 'center' },
  { x: TL.x0 + (6 * SLOT_W) / 12, label: 't=6', align: 'center' },
  { x: TL.x0 + (9 * SLOT_W) / 12, label: 't=9', align: 'center' },
  { x: XB, label: 't=12', align: 'right' },
  { x: XB, label: 't=0', align: 'left' },
  { x: xN1(3), label: 't=3', align: 'center' },
  { x: xN1(6), label: 't=6', align: 'center' },
  { x: xN1(9), label: 't=9', align: 'center' },
  { x: xN1(12), label: 't=12', align: 'center' },
];

const Mono: React.FC<{ x: number; y: number; align?: 'left' | 'center' | 'right'; color?: string; opacity?: number; weight?: number; size?: number; children: React.ReactNode }> = ({
  x,
  y,
  align = 'left',
  color = FG,
  opacity = 1,
  weight = 400,
  size = 24,
  children,
}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      transform: align === 'center' ? 'translateX(-50%)' : align === 'right' ? 'translateX(-100%)' : 'none',
      fontFamily: MONO,
      fontSize: size,
      lineHeight: `${size + 4}px`,
      color,
      opacity,
      fontWeight: weight,
      whiteSpace: 'pre',
    }}
  >
    {children}
  </div>
);

const Timeline: React.FC<{ frame: number; alpha: number }> = ({ frame, alpha }) => {
  const px = xAt(frame);
  const labelIn = rampOut(frame, 6, 14);
  const ptcA = rampOut(frame, F.ptc, F.ptc + 6);
  const revA = rampOut(frame, F.reveal, F.reveal + 6);
  const diamond = rampOut(frame, F.commit, F.commit + 8);
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: alpha }}>
      <svg width={1920} height={1080} style={{ position: 'absolute', left: 0, top: 0 }}>
        {/* slot boundary + reveal, across all rows */}
        <line x1={XB} y1={rowY(0) - 12} x2={XB} y2={TL.axis} stroke={fgA(0.32)} strokeWidth={1.5} strokeDasharray="3 7" strokeLinecap="round" />
        <line x1={xN1(6)} y1={rowY(0) - 12} x2={xN1(6)} y2={TL.axis} stroke={fgA(0.18)} strokeWidth={1.5} strokeDasharray="3 7" strokeLinecap="round" opacity={revA} />
        {/* swimlane tracks and bars growing with the clock */}
        {ROWS.map((r, i) => {
          const cy = rowY(i);
          const from = r.from === undefined ? 0 : xAt(r.from);
          const to = r.to === undefined ? 0 : Math.min(px, xAt(r.to));
          return (
            <g key={i}>
              <rect x={TL.x0} y={cy - TL.barH / 2} width={TL.xe - TL.x0} height={TL.barH} fill={fgA(0.06)} rx={3} />
              {r.from !== undefined && to > from + 1 && <rect x={from} y={cy - TL.barH / 2} width={to - from} height={TL.barH} fill={r.color} rx={3} />}
            </g>
          );
        })}
        {/* the proposer's beacon block at the slot boundary */}
        <polygon points={`${XB},${rowY(3) - 11} ${XB + 11},${rowY(3)} ${XB},${rowY(3) + 11} ${XB - 11},${rowY(3)}`} fill={FG} opacity={diamond} transform={`translate(${XB} ${rowY(3)}) scale(${0.3 + 0.7 * diamond}) translate(${-XB} ${-rowY(3)})`} />
        {/* the reveal cap on the builder bar, the PTC tick on the attester row */}
        <rect x={xN1(6) - 2} y={rowY(0) - 9} width={4} height={18} fill="#d2e0ff" rx={1.5} opacity={revA} />
        <rect x={xN1(9) - 2} y={rowY(4) - 11} width={4} height={22} fill={OK} rx={1.5} opacity={ptcA} />
        {/* axis */}
        <line x1={TL.x0 - 2} y1={TL.axis} x2={TL.xe + 18} y2={TL.axis} stroke={FG} strokeWidth={2} />
        <polygon points={`${TL.xe + 36},${TL.axis} ${TL.xe + 16},${TL.axis - 8} ${TL.xe + 16},${TL.axis + 8}`} fill={FG} />
        {TICKS.filter((t) => t.align !== 'left').map((t, i) => (
          <line key={i} x1={t.x} y1={TL.axis - TL.tick} x2={t.x} y2={TL.axis + TL.tick} stroke={FG} strokeWidth={2} />
        ))}
        {/* playhead */}
        <line x1={px} y1={TL.evY + 34} x2={px} y2={TL.axis + TL.tick + 2} stroke={FG} strokeWidth={3} opacity={0.95} />
      </svg>
      <div style={{ position: 'absolute', left: px - 5, top: TL.evY + 34, width: 10, height: TL.axis + TL.tick + 4 - TL.evY - 34, boxShadow: `0 0 18px 3px ${fgA(0.35)}`, borderRadius: 5 }} />

      {/* actor labels */}
      {ROWS.map((r, i) => (
        <Mono key={i} x={TL.labelX} y={rowY(i) - 14} color={r.color} weight={600} opacity={labelIn}>
          {r.label}
        </Mono>
      ))}

      {/* one event label at a time, at its moment on the clock */}
      {EVENTS.map((e, i) => {
        const next = EVENTS[i + 1];
        const a = rampOut(frame, e.at, e.at + 6) * (next ? 1 - rampOut(frame, next.at - 5, next.at) : 1); // exit before the next enters
        if (a <= 0.002) return null;
        const right = xAt(e.at) > 1440;
        const x = xAt(e.at) + (right ? -10 : 10);
        return (
          <Mono key={i} x={x} y={TL.evY + (1 - a) * 6} align={right ? 'right' : 'left'} color={e.color} weight={600} size={28} opacity={a}>
            {e.text}
          </Mono>
        );
      })}

      {/* tick labels + slot names */}
      {TICKS.map((t, i) => {
        const dx = t.align === 'left' ? 10 : t.align === 'right' ? -10 : 0;
        return (
          <Mono key={i} x={t.x + dx} y={TL.tickLabel} align={t.align} opacity={0.92}>
            {t.label}
          </Mono>
        );
      })}
      <Mono x={TL.x0 + SLOT_W / 2} y={TL.slotLabel} align="center">
        slot N
      </Mono>
      <Mono x={XB + SLOT_W / 2} y={TL.slotLabel} align="center">
        slot N+1
      </Mono>
    </div>
  );
};

// ---------------------------------------------------------------------------
export const SL_Film: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const film = useMemo(() => filmAt(frame), [frame]);
  const sched = useMemo(buildShieldSchedule, []);

  const labels = useMemo(() => {
    const project = makeProjector(frame, width, height);
    const front = BLOCK.depth / 2;
    // the block caption rides higher than the hull corner so the builder's bid hairline,
    // which runs from the builder up to the proposer across this corner, passes clear beneath it
    const hullTag = (k: number) => project(blockX0(k) + 0.12, HULL_TOP + 0.75, front);
    const compTag = (cx: number) => project(cx, 0, front + PLATE.pad);
    const builder = project(BUILDER[0], BUILDER[1] - 0.52, BUILDER[2]);
    const mempool = project(MEMPOOL[0], MEMPOOL[1] - 0.35, MEMPOOL[2]);
    const ring = project(RING_C[0] + 0.1, RING_C[1] + RING_R + 0.28, RING_C[2]);
    const counter = project(X0_N - 0.45, 0.05, front);
    const attCounter = project(BLOCK_CX + BEACON.w / 2 + 0.22, BEACON.y + 0.04, BEACON.d / 2);
    const proposer = project(PROPOSER[0], PROPOSER[1] + 0.2, PROPOSER[2]);
    const attesters = project(-11.2, 3.35, -5.0);
    const ptc = project(ATT.ptcC[0], ATT.ptcC[1] + 1.05, ATT.ptcC[2]);
    const ptcCheck = project(PAY_CX + 0.9, HULL_TOP + 0.55, -0.2);
    return {
      hull: hullTag(0),
      hullNext: hullTag(1),
      pub: compTag(PAY_CX),
      sh: compTag(LANE_CX),
      pubNext: compTag(PAY_CX + PITCH),
      shNext: compTag(LANE_CX + PITCH),
      counter,
      attCounter,
      builder,
      mempool,
      ring: [ring[0], ring[1] - 30] as [number, number],
      proposer: [proposer[0], proposer[1] - 42] as [number, number],
      attesters,
      ptc: [ptc[0], ptc[1] - 30] as [number, number],
      ptcCheck,
    };
  }, [frame, width, height]);

  const cap = film.capIn * film.capOut;
  const f = frame;
  const nPay = PAY_ITEMS.length;
  const nLane = sched.items.length;
  const laneXs = useMemo(() => sched.items.map((it) => it.pos[0]).sort((a, b) => a - b), [sched]);
  const payDone = countPassed(PAY_XS, film.execX);
  const laneDone = countPassed(laneXs, film.execX);
  const inLane = film.execX >= LANE_X0 - 0.2;
  const counterLines = inLane ? [`executing shielded lane ${laneDone}/${nLane}`, `public lane ${nPay}/${nPay}`] : [`executing public lane ${payDone}/${nPay}`, ''];
  const att = attCount(f);
  const attColor = att >= QUORUM ? OK : FG;
  const nextA = rampOut(f, F.dollyB - 4, F.dollyB + 4);

  const hullCaptions = (name: string, hull: [number, number], pub: [number, number], sh: [number, number], a: number, sealed: number) => (
    <>
      <Label at={[hull[0], hull[1] - 34]} a={0.92 * a} align="left" size={26} weight={600}>
        {name}
        {sealed > 0.002 && <span style={{ color: CONF, opacity: sealed }}>{' ✓'}</span>}
      </Label>
      <Label at={[pub[0], pub[1] + 4]} a={0.62 * a} size={22}>
        public lane
      </Label>
      <Label at={[sh[0], sh[1] + 4]} a={0.62 * a} size={22}>
        shielded lane
      </Label>
    </>
  );

  return (
    <div style={{ width: '100%', height: '100%', background: VOID, position: 'relative', overflow: 'hidden' }}>
      <ThreeCanvas
        width={width}
        height={height}
        style={{ width, height }}
        dpr={1}
        shadows="soft"
        camera={{ position: CAM.pos, fov: CAM.fov, near: 0.1, far: 120 }}
        gl={{ antialias: false, alpha: false, powerPreference: 'high-performance', toneMapping: THREE.NoToneMapping, outputColorSpace: THREE.SRGBColorSpace }}
      >
        <Scene film={film} sched={sched} />
      </ThreeCanvas>

      {hullCaptions('block N', labels.hull, labels.pub, labels.sh, cap, film.secureTick)}
      {f >= F.dollyB - 4 && hullCaptions('block N+1', labels.hullNext, labels.pubNext, labels.shNext, nextA * (1 - film.endFade), 0)}

      {/* counters */}
      <Label at={labels.counter} a={film.execCounterA} align="right" size={28} color={VA}>
        {counterLines[0]}
      </Label>
      <Label at={[labels.counter[0], labels.counter[1] + 36]} a={film.execCounterA * 0.75} align="right" size={28} color={VA}>
        {counterLines[1]}
      </Label>
      <Label at={labels.counter} a={film.opsA} align="right" size={28} color={VA}>
        block-end ops:
      </Label>
      <Label at={[labels.counter[0], labels.counter[1] + 36]} a={film.opsA * 0.75} align="right" size={28} color={VA}>
        seal notes root, deposit root
      </Label>
      {/* one line, hex included; sits on the empty floor left of the hull, below the counters' spot */}
      <Label at={[100, labels.counter[1] + 150]} a={film.sealLineA * film.capOut} align="left" size={24} color={OK}>
        {`block N sealed · state root committed · ${ROOT_HEX}`}
      </Label>
      <Label at={labels.attCounter} a={film.attCounterA} align="left" size={28} color={attColor} weight={600}>
        {`attestations ${att}/${ATT_N}`}
      </Label>

      {/* actor labels, only while their flow is active */}
      <Label at={labels.builder} a={0.9 * film.builderA} color={BL}>builder</Label>
      <Label at={labels.mempool} a={0.9 * film.mempoolA}>orderflow</Label>
      <Label at={[labels.builder[0], labels.builder[1] + 34]} a={0.6 * film.routeA * film.builderA} size={20}>public txs, sent privately</Label>
      <Label at={[labels.ring[0], labels.ring[1] + 32]} a={0.6 * film.routeA * film.ringA} size={20}>private txs, gossiped publicly</Label>
      {/* the committee caption sits just above the ring */}
      <Label at={labels.ring} a={0.9 * film.ringA} color={SL}>lane committee (16)</Label>
      <Label at={labels.proposer} a={0.9 * film.proposerA}>proposer</Label>
      <Label at={labels.attesters} a={0.7 * (film.attField - 0.14) / 0.86} align="left" size={24}>attesters</Label>
      <Label at={labels.ptc} a={0.9 * film.ptcA} color={OK} size={24}>PTC</Label>
      <Label at={labels.ptcCheck} a={film.ptcCheck} color={OK} size={24}>payload available {'✓'}</Label>

      <Timeline frame={frame} alpha={film.tlA} />

      <DmarzMark right={44} top={26} scale={0.8} opacity={0.8 * (1 - film.endFade)} />

      {/* tail: fade to the end card */}
      <div style={{ position: 'absolute', inset: 0, background: VOID, opacity: film.endFade, pointerEvents: 'none' }} />
      {film.cardA > 0.002 && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: `translate(-50%, -50%) translateY(${((1 - film.cardA) * 8).toFixed(2)}px)`,
            fontFamily: MONO,
            fontSize: 30,
            lineHeight: '40px',
            letterSpacing: '0.02em',
            color: FG,
            opacity: film.cardA,
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ fontWeight: 600 }}>eth-shielded-lane</span>
          <span style={{ opacity: 0.55 }}> · </span>
          <span style={{ opacity: 0.8 }}>github.com/dmarzzz/eth-shielded-lane</span>
        </div>
      )}
    </div>
  );
};

export default SL_Film;
