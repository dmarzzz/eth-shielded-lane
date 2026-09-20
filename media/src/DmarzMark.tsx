import { useCurrentFrame, useVideoConfig } from "remotion";
import { HudChrome } from "./Juice";

/**
 * The signature lockup.
 *
 * The cube from the terminal shader (rotating-cube.glsl) grows a dimension: it is now a tesseract,
 * rotating in the XW and YZ planes, because the thing being signed is a shape rotator's work.
 * It keeps the shader's behaviour: holographic hue sweep along the edges, and the 16 s cycle in
 * which the solid wireframe dissolves into an ordered-dither dot cloud and recomposes.
 *
 * Added on top: depth-sorted edges, white-hot vertices, dichroic facets on one cell, a lens split,
 * two orbit rings with a node each, and a dot-matrix wordmark whose dots carry the same hue sweep,
 * resolve out of noise at the start, and tear for a few frames when the cube starts to dissolve.
 * Everything sits in a small dark glass capsule so it reads on any background.
 *
 * Colour follows the terminal, not a rainbow. The terminal tints itself by task: a hue per project,
 * phosphor green when unbound (task-tint presets: flashbots 108, grove 180, research 252,
 * random 324; rotating-cube.glsl draws edges at hsl(hue, 100%, 55%)). The mark does the same with
 * two hues: `primary` for the outer cell, `secondary` for the inner cell, shaded by depth.
 * The wordmark is bone white in front, with its extrusion in the two hues.
 */
export const TERMINAL_HUES = { phosphor: 126, flashbots: 108, grove: 180, research: 252, random: 324, amber: 36 } as const;
const tone = (hue: number, l: number, sat = 100) => `hsl(${hue}, ${sat}%, ${l}%)`;
// Iridescent, not Easter: saturated jewel stops (cyan, cobalt, violet, magenta, ember), no pastels,
// no yellow-green. `b` scales brightness so depth can dim an edge without washing it out.
const SLICK: [number, number, number][] = [
  [20, 214, 255],
  [48, 96, 255],
  [140, 58, 255],
  [255, 40, 150],
  [255, 122, 24],
];
// ping-pong through the stops, so ember never has to blend back into cyan through mud
const slick = (u: number, b = 1) => {
  const w = ((u % 1) + 1) % 1;
  const t = (w < 0.5 ? w * 2 : (1 - w) * 2) * (SLICK.length - 1);
  const i = Math.min(SLICK.length - 2, Math.floor(t)), f = t - i;
  const A = SLICK[i], B = SLICK[i + 1];
  const e = f * f * (3 - 2 * f);
  return `rgb(${A.map((a, n) => Math.min(255, Math.round((a + (B[n] - a) * e) * b))).join(",")})`;
};

const CYCLE_TIME = 16;
const SOLID_TIME = 10;
const DECOMPOSE_DUR = 3;
const RECOMPOSE_DUR = 3;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const hash = (n: number) => {
  const x = Math.sin(n * 91.17 + 17.3) * 43758.5453;
  return x - Math.floor(x);
};

// iridescent cosine palette, mixed over phosphor green
const holo = (u: number, mix = 0.7, lift = 0) => {
  const c = (o: number) => 0.5 + 0.5 * Math.cos(6.28318 * (u + o));
  const g = [0.62, 0.95, 0.5];
  const p = [c(0.0), c(0.33), c(0.67)];
  const v = g.map((x, i) => Math.round(255 * Math.min(1, x * (1 - mix) + p[i] * mix + lift)));
  return `rgb(${v[0]},${v[1]},${v[2]})`;
};

const bayer8 = (px: number, py: number) => {
  const X = ((px % 8) + 8) % 8, Y = ((py % 8) + 8) % 8;
  const x0 = X % 2, y0 = Y % 2;
  const x1 = Math.floor(X / 2) % 2, y1 = Math.floor(Y / 2) % 2;
  const x2 = Math.floor(X / 4) % 2, y2 = Math.floor(Y / 4) % 2;
  return (16 * (Math.abs(x0 - y0) * 2 + y0) + 4 * (Math.abs(x1 - y1) * 2 + y1) + (Math.abs(x2 - y2) * 2 + y2) + 0.5) / 64;
};

const segDist = (px: number, py: number, a: number[], b: number[]) => {
  const abx = b[0] - a[0], aby = b[1] - a[1];
  const apx = px - a[0], apy = py - a[1];
  const t = Math.min(1, Math.max(0, (apx * abx + apy * aby) / (abx * abx + aby * aby || 1)));
  return Math.hypot(apx - abx * t, apy - aby * t);
};

// tesseract: 16 vertices, 32 edges
const V4: number[][] = [];
for (let i = 0; i < 16; i++) V4.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1, i & 8 ? 1 : -1]);
const E4: [number, number][] = [];
for (let i = 0; i < 16; i++) for (let b = 0; b < 4; b++) if (!(i & (1 << b))) E4.push([i, i | (1 << b)]);
// the six faces of the w = +1 cell
const FACES: number[][] = [
  [8, 9, 11, 10], [12, 13, 15, 14], [8, 9, 13, 12], [10, 11, 15, 14], [8, 10, 14, 12], [9, 11, 15, 13],
];

const GLYPHS: Record<string, string[]> = {
  d: ["....#", "....#", ".####", "#...#", "#...#", "#...#", ".####"],
  m: [".....", ".....", "##.#.", "#.#.#", "#.#.#", "#.#.#", "#.#.#"],
  a: [".....", ".....", ".###.", "....#", ".####", "#...#", ".####"],
  r: [".....", ".....", "#.##.", "##..#", "#....", "#....", "#...."],
  z: [".....", ".....", "#####", "...#.", "..#..", ".#...", "#####"],
};

export const DmarzMark: React.FC<{ right?: number; bottom?: number; top?: number; scale?: number; opacity?: number; cycleOffset?: number; primary?: number; secondary?: number; still?: boolean }> = ({
  right = 80,
  bottom = 40,
  top,
  scale = 1,
  opacity = 1,
  cycleOffset = 6,
  primary = TERMINAL_HUES.phosphor,
  secondary = TERMINAL_HUES.grove,
  still = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // `still`: for static figures. A plain cube at one fixed angle, identical on every image,
  // no animation, no dissolve. Films keep the rotating tesseract.
  const time = still ? 0 : frame / fps;
  const k = scale;

  const S = 19 * k; // tesseract unit in px
  const box = 50 * k; // half extent of the cube viewport
  const padX = 0, padY = 0, gap = 8 * k;
  const pitch = 6 * k;
  const G = 4 * k;

  // --- geometry
  let pts: number[][];
  let edgeList: [number, number][];
  if (still) {
    const ry = 0.62, rx = 0.44; // slightly angled, the same on every figure
    const C = 1.25;
    edgeList = [[0, 1], [1, 3], [3, 2], [2, 0], [4, 5], [5, 7], [7, 6], [6, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
    pts = Array.from({ length: 8 }, (_, i) => {
      const x = (i & 1 ? 1 : -1) * C, y = (i & 2 ? 1 : -1) * C, z = (i & 4 ? 1 : -1) * C;
      const x1 = x * Math.cos(ry) + z * Math.sin(ry), z1 = -x * Math.sin(ry) + z * Math.cos(ry);
      const y2 = y * Math.cos(rx) - z1 * Math.sin(rx), z2 = y * Math.sin(rx) + z1 * Math.cos(rx);
      const k3 = 6 / (6 - z2);
      return [x1 * k3 * S, -y2 * k3 * S, z2, 0];
    });
  } else {
    // 4D rotation (XW, YZ) plus a slow XY drift, then two perspective divides
    const a = time * 0.55 + 0.4, b = time * 0.38 + 1.1, c = time * 0.16;
    edgeList = E4;
    pts = V4.map(([x, y, z, w]) => {
      const x1 = x * Math.cos(a) - w * Math.sin(a), w1 = x * Math.sin(a) + w * Math.cos(a);
      const y1 = y * Math.cos(b) - z * Math.sin(b), z1 = y * Math.sin(b) + z * Math.cos(b);
      const x2 = x1 * Math.cos(c) - y1 * Math.sin(c), y2 = x1 * Math.sin(c) + y1 * Math.cos(c);
      const k4 = 2.6 / (2.6 - w1 * 0.62);
      const X = x2 * k4, Y = y2 * k4, Z = z1 * k4;
      const k3 = 5 / (5 - Z);
      return [X * k3 * S, -Y * k3 * S, Z, w1];
    });
  }

  // --- dissolve phase, as in the shader
  const cyc = (time + cycleOffset) % CYCLE_TIME;
  let phase = 0;
  if (cyc > SOLID_TIME && cyc <= SOLID_TIME + DECOMPOSE_DUR) phase = (cyc - SOLID_TIME) / DECOMPOSE_DUR;
  else if (cyc > SOLID_TIME + DECOMPOSE_DUR) phase = 1 - (cyc - SOLID_TIME - DECOMPOSE_DUR) / RECOMPOSE_DUR;
  phase = still ? 0 : Math.min(1, Math.max(0, phase));
  // one sweep across the whole lockup, cube first, then through the letters
  const lockW = box * 2 + 8 * k + 29 * 6 * k;
  const sweepPos = phase * 1.7 - 0.32;
  const decompU = (u: number) => smoothstep(u - 0.32, u + 0.05, sweepPos); // wide band: the dither lingers
  const decompAt = (xpx: number) => decompU((xpx + box) / lockW); // xpx in cube coordinates
  // the first frames of a dissolve tear the lockup
  const tear = !still && cyc > SOLID_TIME && cyc < SOLID_TIME + 0.22 ? 1 : 0;

  const dots: { x: number; y: number; a: number }[] = [];
  if (phase > 0.001) {
    const n = Math.floor(box / G);
    for (let i = -n; i <= n; i++)
      for (let j = -n; j <= n; j++) {
        const x = (i + 0.5) * G, y = (j + 0.5) * G;
        const d = decompAt(x);
        if (d < 0.001) continue;
        let md = 1e9;
        for (const [p, q] of edgeList) md = Math.min(md, segDist(x, y, pts[p], pts[q]));
        const wide = Math.max(Math.exp(-md / (5 * k)), md < 1 ? 1 : 0);
        const fade = smoothstep(0.15, 1, d * d * (3 - 2 * d));
        if (bayer8(i + 64, j + 64) < wide * (1 - fade)) dots.push({ x, y, a: smoothstep(0, 0.2, d) });
      }
  }
  const stops = Array.from({ length: 9 }, (_, i) => ({ off: i / 8, a: 1 - smoothstep(0, 0.2, decompAt(-box + (i / 8) * 2 * box)) }));

  // depth-sorted edges
  const edges = edgeList.map(([p, q], i) => ({ p, q, i, z: (pts[p][2] + pts[q][2]) / 2, w: (pts[p][3] + pts[q][3]) / 2 })).sort((m, n) => m.z - n.z);
  const depth = (z: number) => smoothstep(-2.2, 2.2, z);

  const wordW = 29 * pitch;
  const W = padX * 2 + box * 2 + gap + wordW;
  const H = padY * 2 + box * 2;
  const cx = padX + box, cyy = padY + box;
  const appear = still ? 1 : Math.min(1, time / 0.7);
  const uid = `dmz${Math.round(right)}${Math.round(scale * 100)}h${primary}${secondary}`;

  const wire = (dx: number, color?: string, op = 1) => (
    <g transform={`translate(${dx},0)`} opacity={op}>
      {edges.map((e) => (
        <line
          key={e.i}
          x1={pts[e.p][0]} y1={pts[e.p][1]} x2={pts[e.q][0]} y2={pts[e.q][1]}
          stroke={color ?? slick(e.i / edgeList.length + e.w * 0.1 + time * 0.12, 0.62 + 0.5 * depth(e.z))}
          strokeWidth={(0.9 + 1.5 * depth(e.z)) * k}
          strokeLinecap="round"
          opacity={0.35 + 0.65 * depth(e.z)}
        />
      ))}
    </g>
  );

  return (
    <svg width={W} height={H} style={{ position: "absolute", right, ...(top === undefined ? { bottom } : { top }), opacity, overflow: "visible", pointerEvents: "none", filter: "drop-shadow(0 0 10px rgba(0,0,0,0.95)) drop-shadow(0 0 3px rgba(0,0,0,0.9))" }}>
      <defs>
        <linearGradient id={`${uid}-sweep`} gradientUnits="userSpaceOnUse" x1={-box} x2={box} y1={0} y2={0}>
          {stops.map((s, i) => (
            <stop key={i} offset={s.off} stopColor="#fff" stopOpacity={s.a} />
          ))}
        </linearGradient>
        <mask id={`${uid}-mask`} maskUnits="userSpaceOnUse" x={-box * 2} y={-box * 2} width={box * 4} height={box * 4}>
          <rect x={-box * 2} y={-box * 2} width={box * 4} height={box * 4} fill={`url(#${uid}-sweep)`} />
        </mask>
        <filter id={`${uid}-glow`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur in="SourceGraphic" stdDeviation={1.1 * k} result="tight" />
          <feMerge>
            <feMergeNode in="tight" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`${uid}-wglow`} x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur stdDeviation={2.6 * k} result="soft" />
          <feMerge>
            <feMergeNode in="soft" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id={`${uid}-iris`} x1="0" x2="1" y1="0" y2="0" gradientTransform={`translate(${((time * 0.18) % 1) - 0.5},0)`} spreadMethod="reflect">
          <stop offset="0" stopColor={tone(primary, 60)} />
          <stop offset="0.5" stopColor={tone(secondary, 62)} />
          <stop offset="1" stopColor={tone(primary, 60)} />
        </linearGradient>
        <linearGradient id={`${uid}-word`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={tone(primary, 80)} />
          <stop offset="0.5" stopColor="#ffffff" />
          <stop offset="1" stopColor={tone(secondary, 80)} />
        </linearGradient>
        <radialGradient id={`${uid}-core`}>
          <stop offset="0" stopColor={tone(primary, 45)} stopOpacity="0.5" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${uid}-clip`}>
          <rect x={0} y={0} width={W} height={H} rx={H / 2} />
        </clipPath>
      </defs>

      {/* tesseract */}
      <g transform={`translate(${cx + tear * 3 * k}, ${cyy})`}>
        <g mask={`url(#${uid}-mask)`}>
          {/* lens split under the sharp wire */}
          {wire(-1.4 * k * (1 + 3 * tear), "#19d6ff", 0.32)}
          {wire(1.4 * k * (1 + 3 * tear), "#ff2896", 0.28)}
          <g filter={`url(#${uid}-glow)`}>{wire(0)}</g>
          {/* white-hot vertices */}
          {pts.map((p, i) => (
            <circle key={i} cx={p[0]} cy={p[1]} r={(0.9 + 1.5 * depth(p[2])) * k} fill="#ffffff" opacity={0.45 + 0.55 * depth(p[2])} />
          ))}
        </g>
        {dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={1.35 * k} fill={slick(d.x / (box * 4) + time * 0.12)} opacity={d.a} />
        ))}
      </g>

      {/* wordmark: 8-bit squares on the 5x7 grid, the sweep running through the columns */}
      <g transform={`translate(${box * 2 + gap}, ${cyy - (7 * pitch) / 2 + pitch * 0.9})`}>
        {"dmarz".split("").map((ch, ci) =>
          GLYPHS[ch].map((row, ry) =>
            row.split("").map((cell, rx) => {
              if (cell !== "#") return null;
              const n = ci * 100 + ry * 10 + rx;
              if (hash(n) > appear) return null; // resolves out of noise
              const col = ci * 6 + rx;
              const shift = tear && (ry === 2 || ry === 3 || ry === 5) ? Math.round((hash(ry + Math.floor(time * 30)) - 0.5) * 3) * pitch : 0;
              const x = col * pitch + shift, y = ry * pitch;
              const dd = decompU((box * 2 + gap + col * pitch + pitch / 2) / lockW);
              const fade = smoothstep(0.3, 1, dd * dd * (3 - 2 * dd));
              if (dd > 0.001 && bayer8(col + 3, ry + 5) >= 1 - fade) return null; // ordered drop-out
              const shrink = 1 - 0.5 * smoothstep(0, 0.35, dd); // a pixel becomes a dither dot before it goes
              const q = pitch * 0.86 * shrink;
              const o = (pitch * 0.86 - q) / 2;
              return (
                <g key={n}>
                  <rect x={x + o + pitch * 0.2} y={y + o + pitch * 0.2} width={q} height={q} fill="#000" opacity={0.55 * shrink} />
                  <rect x={x + o} y={y + o} width={q} height={q} rx={dd > 0.3 ? q / 2 : 0} fill={slick(col / 58 + time * 0.12 + 0.15, 1.12)} />
                  {dd < 0.05 ? <rect x={x} y={y} width={q} height={q * 0.24} fill="#ffffff" opacity={0.35} /> : null}
                </g>
              );
            })
          )
        )}
      </g>
    </svg>
  );
};

// A transparent plate carrying the chrome and the mark, for compositing over stills rendered elsewhere.
export const SL_MarkPlate: React.FC = () => (
  <>
    <DmarzMark right={72} bottom={34} scale={0.8} still />
  </>
);

// The lockup alone, large, for judging it.
export const SL_MarkHero: React.FC = () => (
  <div style={{ position: "absolute", inset: 0, background: "#04060b" }}>
    <DmarzMark right={360} bottom={390} scale={4} />
  </div>
);

// The lockup in each terminal preset, to choose the two hues.
const COMBOS: { name: string; p: number; s: number }[] = [
  { name: "phosphor + grove  (terminal default green, cyan)", p: 126, s: 180 },
  { name: "research + grove  (indigo, cyan)", p: 252, s: 180 },
  { name: "grove + research  (cyan, indigo)", p: 180, s: 252 },
  { name: "flashbots + amber  (green, amber)", p: 108, s: 36 },
  { name: "random + research  (magenta, indigo)", p: 324, s: 252 },
  { name: "amber + random  (amber, magenta)", p: 36, s: 324 },
  { name: "phosphor only  (one hue)", p: 126, s: 126 },
  { name: "research only  (one hue)", p: 252, s: 252 },
];
export const SL_MarkPalette: React.FC = () => (
  <div style={{ position: "absolute", inset: 0, background: "#04060b", display: "grid", gridTemplateColumns: "1fr 1fr", gridAutoRows: "1fr", padding: "30px 60px" }}>
    {COMBOS.map((c) => (
      <div key={c.name} style={{ position: "relative" }}>
        <div style={{ position: "absolute", left: 96, bottom: 8, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 20, color: "#f2b661", letterSpacing: "0.05em" }}>{c.name}</div>
        <DmarzMark right={150} bottom={48} scale={1.9} primary={c.p} secondary={c.s} />
      </div>
    ))}
  </div>
);

// The still logo alone on transparent, large, for export.
export const SL_MarkStill: React.FC = () => <DmarzMark right={396} bottom={390} scale={4} still />;

