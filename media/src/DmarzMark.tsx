import { useCurrentFrame, useVideoConfig } from "remotion";

/**
 * The signature: the rotating wireframe cube from the author's terminal shader (rotating-cube.glsl)
 * (same geometry, rotation, perspective, and the 16 s ordered-dither decompose / recompose cycle),
 * next to "dmarz" set in a 5x7 dot matrix so the wordmark is made of the same dots the cube
 * dissolves into. Sits bottom-right, quiet.
 */

const GREEN = "#9ece6a";
const FG = "#e8eaed";

// --- shader constants, scaled to a small mark ---
const ROTATION_SPEED = 0.15;
const CYCLE_TIME = 16;
const SOLID_TIME = 10;
const DECOMPOSE_DUR = 3;
const RECOMPOSE_DUR = 3;

const H = 0.5;
const VERTS: [number, number, number][] = [
  [-H, -H, -H], [H, -H, -H], [H, H, -H], [-H, H, -H],
  [-H, -H, H], [H, -H, H], [H, H, H], [-H, H, H],
];
const EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const bayer8 = (px: number, py: number) => {
  const X = ((px % 8) + 8) % 8;
  const Y = ((py % 8) + 8) % 8;
  const x0 = X % 2, y0 = Y % 2;
  const x1 = Math.floor(X / 2) % 2, y1 = Math.floor(Y / 2) % 2;
  const x2 = Math.floor(X / 4) % 2, y2 = Math.floor(Y / 4) % 2;
  const m0 = Math.abs(x0 - y0) * 2 + y0;
  const m1 = Math.abs(x1 - y1) * 2 + y1;
  const m2 = Math.abs(x2 - y2) * 2 + y2;
  return (16 * m0 + 4 * m1 + m2 + 0.5) / 64;
};

const segDist = (px: number, py: number, a: [number, number], b: [number, number]) => {
  const abx = b[0] - a[0], aby = b[1] - a[1];
  const apx = px - a[0], apy = py - a[1];
  const t = Math.min(1, Math.max(0, (apx * abx + apy * aby) / (abx * abx + aby * aby)));
  return Math.hypot(apx - abx * t, apy - aby * t);
};

const GLYPHS: Record<string, string[]> = {
  d: ["....#", "....#", ".####", "#...#", "#...#", "#...#", ".####"],
  m: [".....", ".....", "##.#.", "#.#.#", "#.#.#", "#.#.#", "#.#.#"],
  a: [".....", ".....", ".###.", "....#", ".####", "#...#", ".####"],
  r: [".....", ".....", "#.##.", "##..#", "#....", "#....", "#...."],
  z: [".....", ".....", "#####", "...#.", "..#..", ".#...", "#####"],
};

export const DmarzMark: React.FC<{ right?: number; bottom?: number; top?: number; scale?: number; opacity?: number }> = ({ right = 80, bottom = 40, top, scale = 1, opacity = 0.85 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps;

  const S = 40 * scale; // px per unit cube edge
  const box = 44 * scale; // cube viewport (half extent)
  const pitch = 4.6 * scale; // wordmark dot pitch
  const G = 4 * scale; // dither grid

  // rotation + projection, as in the shader
  const t = time * ROTATION_SPEED + 0.6;
  const cy = Math.cos(t), sy = Math.sin(t);
  const cx = Math.cos(t * 0.7), sx = Math.sin(t * 0.7);
  const proj = VERTS.map(([x, y, z]) => {
    const y1 = y * cx - z * sx;
    const z1 = y * sx + z * cx;
    const x2 = x * cy + z1 * sy;
    const z2 = -x * sy + z1 * cy;
    const k = 3 / (3 - z2);
    return [x2 * k * S, -y1 * k * S] as [number, number];
  });

  // decomposition phase
  const cyc = time % CYCLE_TIME;
  let phase = 0;
  if (cyc > SOLID_TIME && cyc <= SOLID_TIME + DECOMPOSE_DUR) phase = (cyc - SOLID_TIME) / DECOMPOSE_DUR;
  else if (cyc > SOLID_TIME + DECOMPOSE_DUR) phase = 1 - (cyc - SOLID_TIME - DECOMPOSE_DUR) / RECOMPOSE_DUR;
  phase = Math.min(1, Math.max(0, phase));
  const sweepPos = phase * 1.6 - 0.3;
  const decompAt = (xpx: number) => {
    const cellNX = (xpx / S + 0.7) / 1.4;
    return smoothstep(cellNX - 0.25, cellNX + 0.05, sweepPos);
  };

  // dots of the halftone cloud
  const dots: { x: number; y: number; a: number }[] = [];
  if (phase > 0.001) {
    const n = Math.floor(box / G);
    for (let i = -n; i <= n; i++) {
      for (let j = -n; j <= n; j++) {
        const x = (i + 0.5) * G, y = (j + 0.5) * G;
        const d = decompAt(x);
        if (d < 0.001) continue;
        let md = 1e9;
        for (const [a, b] of EDGES) md = Math.min(md, segDist(x, y, proj[a], proj[b]));
        const wide = Math.max(Math.exp(-md / (5 * scale)), md < 1 ? 1 : 0);
        const fade = smoothstep(0.15, 1, d * d * (3 - 2 * d));
        if (bayer8(i + 64, j + 64) < wide * (1 - fade)) dots.push({ x, y, a: smoothstep(0, 0.2, d) });
      }
    }
  }
  // the solid wireframe gives way left to right as the sweep passes
  const stops = Array.from({ length: 9 }, (_, k) => {
    const x = -box + (k / 8) * 2 * box;
    return { off: k / 8, a: 1 - smoothstep(0, 0.2, decompAt(x)) };
  });

  const word = "dmarz";
  const wordW = word.length * 6 * pitch - pitch;
  const wordH = 7 * pitch;
  const W = box * 2 + 10 * scale + wordW;
  const Ht = box * 2;

  return (
    <svg
      width={W}
      height={Ht}
      style={{ position: "absolute", right, ...(top === undefined ? { bottom } : { top }), opacity, overflow: "visible", pointerEvents: "none" }}
    >
      <defs>
        <linearGradient id="dmz-sweep" gradientUnits="userSpaceOnUse" x1={-box} x2={box} y1={0} y2={0}>
          {stops.map((s, k) => (
            <stop key={k} offset={s.off} stopColor="#fff" stopOpacity={s.a} />
          ))}
        </linearGradient>
        <mask id="dmz-mask" maskUnits="userSpaceOnUse" x={-box} y={-box} width={box * 2} height={box * 2}>
          <rect x={-box} y={-box} width={box * 2} height={box * 2} fill="url(#dmz-sweep)" />
        </mask>
        <filter id="dmz-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={2.2 * scale} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g transform={`translate(${box}, ${box})`}>
        <g mask="url(#dmz-mask)" filter="url(#dmz-glow)">
          {EDGES.map(([a, b], k) => (
            <line key={k} x1={proj[a][0]} y1={proj[a][1]} x2={proj[b][0]} y2={proj[b][1]} stroke={GREEN} strokeWidth={1.5 * scale} strokeLinecap="round" />
          ))}
        </g>
        {dots.map((d, k) => (
          <circle key={k} cx={d.x} cy={d.y} r={1.25 * scale} fill={GREEN} opacity={d.a} />
        ))}
      </g>
      <g transform={`translate(${box * 2 + 10 * scale}, ${box - wordH / 2 + pitch * 0.5})`}>
        {word.split("").map((ch, ci) =>
          GLYPHS[ch].map((row, ry) =>
            row.split("").map((c, rx) =>
              c === "#" ? <circle key={`${ci}-${ry}-${rx}`} cx={(ci * 6 + rx) * pitch + pitch / 2} cy={ry * pitch} r={1.75 * scale} fill={FG} /> : null
            )
          )
        )}
      </g>
    </svg>
  );
};

// A transparent plate carrying only the mark, for compositing over stills rendered elsewhere.
export const SL_MarkPlate: React.FC = () => <DmarzMark right={72} bottom={40} />;
