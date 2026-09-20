import React from "react";
import { AbsoluteFill, continueRender, delayRender, staticFile } from "remotion";
import { Field, Overlay } from "./Juice";
import { MONO } from "./Fonts";

/**
 * "dmarz" drawn from scratch. Every letter is a handful of straight segments on a unit grid
 * (x right, y up, baseline y = 0), so the wordmark can be rendered as plain lines, as a vector
 * display, as an extruded wireframe, sliced, or coloured stroke by stroke.
 */

type Poly = [number, number][];
type Glyph = { strokes: Poly[]; adv: number };
type Alphabet = { h: number; glyphs: Record<string, Glyph> };

// lowercase, chamfered bowls
export const LOWER: Alphabet = {
  h: 6,
  glyphs: {
    d: { adv: 4, strokes: [[[3, 4], [0.9, 4], [0, 3.1], [0, 0.9], [0.9, 0], [3, 0]], [[3, 6], [3, 0]]] },
    m: { adv: 5.8, strokes: [[[0, 0], [0, 4]], [[0, 3], [1, 4], [1.6, 4], [2.4, 3.2], [2.4, 0]], [[2.4, 3.2], [3.2, 4], [3.9, 4], [4.8, 3.1], [4.8, 0]]] },
    a: { adv: 4, strokes: [[[3, 4], [0.9, 4], [0, 3.1], [0, 0.9], [0.9, 0], [3, 0]], [[3, 4], [3, 0]]] },
    r: { adv: 3.3, strokes: [[[0, 0], [0, 4]], [[0, 2.8], [1.2, 4], [2.6, 4]]] },
    z: { adv: 3.2, strokes: [[[0, 4], [3, 4], [0, 0], [3, 0]]] },
  },
};
// capitals, angular
export const CAPS: Alphabet = {
  h: 5,
  glyphs: {
    d: { adv: 4.2, strokes: [[[0, 0], [0, 5], [1.8, 5], [3.2, 3.6], [3.2, 1.4], [1.8, 0], [0, 0]]] },
    m: { adv: 5, strokes: [[[0, 0], [0, 5], [2, 2], [4, 5], [4, 0]]] },
    a: { adv: 4.4, strokes: [[[0, 0], [1.8, 5], [3.6, 0]], [[0.75, 1.7], [2.85, 1.7]]] },
    r: { adv: 4.2, strokes: [[[0, 0], [0, 5], [2.4, 5], [3.2, 4.2], [3.2, 3.2], [2.4, 2.4], [0, 2.4]], [[1.6, 2.4], [3.3, 0]]] },
    z: { adv: 3.4, strokes: [[[0, 5], [3.4, 5], [0, 0], [3.4, 0]]] },
  },
};
// blades: as few strokes as a letter can survive on
export const BLADE: Alphabet = {
  h: 5,
  glyphs: {
    d: { adv: 4, strokes: [[[0, 0], [0, 5], [3.2, 2.5], [0, 0]]] },
    m: { adv: 5.2, strokes: [[[0, 0], [0.8, 5], [2.2, 1.5], [3.6, 5], [4.4, 0]]] },
    a: { adv: 4.2, strokes: [[[0, 0], [1.7, 5], [3.4, 0]]] },
    r: { adv: 3.8, strokes: [[[0, 0], [0, 5], [3, 3.5], [0, 2.2], [3, 0]]] },
    z: { adv: 3.2, strokes: [[[0, 5], [3.2, 5], [0, 0], [3.2, 0]]] },
  },
};

const PIX: Record<string, string[]> = {
  d: ["....#", "....#", ".####", "#...#", "#...#", "#...#", ".####"],
  m: [".....", ".....", "##.#.", "#.#.#", "#.#.#", "#.#.#", "#.#.#"],
  a: [".....", ".....", ".###.", "....#", ".####", "#...#", ".####"],
  r: [".....", ".....", "#.##.", "##..#", "#....", "#....", "#...."],
  z: [".....", ".....", "#####", "...#.", "..#..", ".#...", "#####"],
};

const holo = (u: number) => {
  const c = (o: number) => Math.round(255 * (0.55 + 0.45 * Math.cos(6.28318 * (u + o))));
  return `rgb(${c(0)},${c(0.33)},${c(0.67)})`;
};

export type Style = "plain" | "vector" | "iso" | "holo" | "glitch" | "kandinsky" | "inline";

// lay the word out: returns strokes in px with y down, plus total size
export const layoutWord = (alpha: Alphabet, U: number, gap = 1) => layout(alpha, U, gap);
function layout(alpha: Alphabet, U: number, gap = 1) {
  let x = 0;
  const out: { pts: [number, number][]; letter: number; k: number }[] = [];
  "dmarz".split("").forEach((ch, li) => {
    const g = alpha.glyphs[ch];
    g.strokes.forEach((st, k) => out.push({ pts: st.map(([px, py]) => [(x + px) * U, (alpha.h - py) * U] as [number, number]), letter: li, k }));
    x += g.adv + gap;
  });
  return { strokes: out, w: (x - gap) * U, h: alpha.h * U };
}
const d = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");

export const LineWord: React.FC<{ alpha: Alphabet; U: number; sw: number; style: Style; color?: string; id: string }> = ({ alpha, U, sw, style, color = "#ffffff", id }) => {
  const { strokes, w, h } = layout(alpha, U, style === "iso" ? 1.5 : 1);
  const pad = sw * 3 + (style === "iso" ? U * 1.6 : 0);
  const join = alpha === LOWER ? "round" : "miter";
  const paths = (col: (i: number) => string, width = sw, dx = 0, dy = 0, op = 1) =>
    strokes.map((s, i) => <path key={`${dx}-${dy}-${i}`} d={d(s.pts)} transform={`translate(${dx},${dy})`} fill="none" stroke={col(i)} strokeWidth={width} strokeLinecap={join === "round" ? "round" : "square"} strokeLinejoin={join} strokeMiterlimit={6} opacity={op} />);

  let body: React.ReactNode;
  if (style === "plain") body = paths(() => color);
  else if (style === "inline")
    body = (
      <>
        {paths(() => color, sw * 2.4)}
        {paths(() => "#05070f", sw * 0.8)}
      </>
    );
  else if (style === "vector")
    body = (
      <g filter={`url(#${id}-glow)`}>
        {paths(() => "#7dffb0", sw)}
        {strokes.flatMap((s, i) => s.pts.map(([x, y], k) => <circle key={`${i}-${k}`} cx={x} cy={y} r={sw * 0.95} fill="#eafff2" />))}
      </g>
    );
  else if (style === "holo")
    body = (
      <>
        {paths(() => "#00e5ff", sw, -sw * 0.45, 0, 0.6)}
        {paths(() => "#ff3d88", sw, sw * 0.45, 0, 0.5)}
        <g filter={`url(#${id}-glow)`}>{paths((i) => holo(i / strokes.length + 0.08), sw)}</g>
      </>
    );
  else if (style === "iso") {
    const ox = U * 1.1, oy = -U * 0.9;
    body = (
      <g filter={`url(#${id}-glow)`}>
        {paths((i) => holo(i / strokes.length + 0.45), sw * 0.6, ox, oy, 0.55)}
        {strokes.flatMap((s, i) => s.pts.map(([x, y], k) => <line key={`${i}-${k}`} x1={x} y1={y} x2={x + ox} y2={y + oy} stroke={holo(i / strokes.length + 0.25)} strokeWidth={sw * 0.5} opacity={0.6} />))}
        {paths((i) => holo(i / strokes.length), sw)}
      </g>
    );
  } else if (style === "glitch") {
    const bands = [
      { y0: 0, y1: 0.3, dx: 0 },
      { y0: 0.3, y1: 0.44, dx: U * 1.3 },
      { y0: 0.44, y1: 0.7, dx: -U * 0.5 },
      { y0: 0.7, y1: 0.78, dx: U * 2.2 },
      { y0: 0.78, y1: 1, dx: 0 },
    ];
    body = (
      <>
        {bands.map((b, bi) => (
          <g key={bi} clipPath={`url(#${id}-band${bi})`} transform={`translate(${b.dx},0)`}>
            {paths(() => "#00e5ff", sw, -sw * 0.7, 0, 0.75)}
            {paths(() => "#ff3d88", sw, sw * 0.7, 0, 0.7)}
            {paths(() => "#ffffff", sw)}
          </g>
        ))}
        <defs>
          {bands.map((b, bi) => (
            <clipPath key={bi} id={`${id}-band${bi}`}>
              <rect x={-pad - U * 3} y={b.y0 * h - (bi === 0 ? pad : 0)} width={w + pad * 2 + U * 6} height={(b.y1 - b.y0) * h + (bi === 0 || bi === bands.length - 1 ? pad : 0)} />
            </clipPath>
          ))}
        </defs>
      </>
    );
  } else {
    // kandinsky: primaries, unequal weights, a circle and a triangle keeping the lines company
    const cols = ["#ffffff", "#f2c230", "#e5402e", "#3d6fe0", "#ffffff", "#f2c230", "#e5402e", "#3d6fe0", "#ffffff"];
    const ws = [1, 1.7, 0.7, 1.3, 1, 0.7, 1.6, 1, 1.3];
    body = (
      <>
        <circle cx={w * 0.31} cy={h * 0.12} r={U * 0.95} fill="#3d6fe0" />
        <polygon points={`${w * 0.74},${h * 1.02} ${w * 0.74 + U * 2.1},${h * 1.02} ${w * 0.74 + U * 1.05},${h * 0.62}`} fill="#f2c230" opacity={0.95} />
        <rect x={w * 0.9} y={-U * 0.2} width={U * 1.3} height={U * 1.3} fill="#e5402e" transform={`rotate(14 ${w * 0.9} 0)`} />
        {strokes.map((s, i) => (
          <path key={i} d={d(s.pts)} fill="none" stroke={cols[i % cols.length]} strokeWidth={sw * ws[i % ws.length]} strokeLinecap="square" strokeLinejoin="miter" strokeMiterlimit={6} transform={`rotate(${((i * 37) % 7) - 3} ${s.pts[0][0]} ${s.pts[0][1]})`} />
        ))}
      </>
    );
  }
  return (
    <svg width={w + pad * 2} height={h + pad * 2} style={{ overflow: "visible" }}>
      <defs>
        <filter id={`${id}-glow`} x="-20%" y="-40%" width="140%" height="180%">
          <feGaussianBlur stdDeviation={sw * 1.5} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g transform={`translate(${pad},${pad})`}>{body}</g>
    </svg>
  );
};

const PixelWord: React.FC<{ P: number }> = ({ P }) => {
  const cells: React.ReactNode[] = [];
  "dmarz".split("").forEach((ch, ci) =>
    PIX[ch].forEach((row, ry) =>
      row.split("").forEach((c, rx) => {
        if (c !== "#") return;
        const x = (ci * 6 + rx) * P, y = ry * P;
        cells.push(
          <g key={`${ci}-${ry}-${rx}`}>
            <rect x={x + P * 0.22} y={y + P * 0.22} width={P} height={P} fill="#1b2a6b" />
            <rect x={x} y={y} width={P} height={P} fill={ry < 3 ? "#ffe066" : ry < 5 ? "#ff9f43" : "#ff5e7e"} />
            <rect x={x} y={y} width={P} height={P * 0.22} fill="rgba(255,255,255,0.55)" />
          </g>
        );
      })
    )
  );
  return (
    <svg width={29 * P + P} height={7 * P + P} style={{ overflow: "visible" }}>
      {cells}
    </svg>
  );
};

const CUSTOM: { n: string; note: string; el: (big: boolean) => React.ReactNode }[] = [
  { n: "A", note: "line · lowercase, chamfered bowls, round ends", el: (b) => <LineWord id={`a${b}`} alpha={LOWER} U={b ? 15 : 6.4} sw={b ? 6 : 2.6} style="plain" /> },
  { n: "B", note: "line · angular capitals, square ends", el: (b) => <LineWord id={`b${b}`} alpha={CAPS} U={b ? 17 : 7.4} sw={b ? 6 : 2.6} style="plain" /> },
  { n: "C", note: "blade · the fewest strokes a letter survives on", el: (b) => <LineWord id={`c${b}`} alpha={BLADE} U={b ? 17 : 7.4} sw={b ? 4 : 2} style="plain" /> },
  { n: "D", note: "vector arcade · phosphor beam, hot vertices", el: (b) => <LineWord id={`d${b}`} alpha={LOWER} U={b ? 15 : 6.4} sw={b ? 3.4 : 1.7} style="vector" /> },
  { n: "E", note: "wireframe · extruded, same language as the tesseract", el: (b) => <LineWord id={`e${b}`} alpha={CAPS} U={b ? 15 : 6.6} sw={b ? 3.6 : 1.8} style="iso" /> },
  { n: "F", note: "holo line · the cube's hue sweep, lens split", el: (b) => <LineWord id={`f${b}`} alpha={LOWER} U={b ? 15 : 6.4} sw={b ? 5.5 : 2.4} style="holo" /> },
  { n: "G", note: "glitch · sliced and torn capitals", el: (b) => <LineWord id={`g${b}`} alpha={CAPS} U={b ? 17 : 7.4} sw={b ? 6 : 2.6} style="glitch" /> },
  { n: "H", note: "kandinsky · primaries, unequal weights, circle triangle square", el: (b) => <LineWord id={`h${b}`} alpha={BLADE} U={b ? 17 : 7.4} sw={b ? 5 : 2.2} style="kandinsky" /> },
  { n: "I", note: "inline · doubled stroke, Bauhaus stencil feel", el: (b) => <LineWord id={`i${b}`} alpha={CAPS} U={b ? 17 : 7.4} sw={b ? 4 : 1.8} style="inline" /> },
  { n: "J", note: "8-bit blocks · arcade title screen", el: (b) => <PixelWord P={b ? 12 : 5.2} /> },
];

const Sheet: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <AbsoluteFill style={{ color: "#fff" }}>
    <Field />
    <div style={{ position: "absolute", top: 26, left: 80, fontFamily: MONO, fontSize: 18, letterSpacing: "0.14em", color: "#f2b661", textTransform: "uppercase" }}>{title}</div>
    <div style={{ position: "absolute", inset: "64px 80px 40px", display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", columnGap: 40, rowGap: 12 }}>{children}</div>
    <Overlay grain={0.05} scan={0.04} />
  </AbsoluteFill>
);
const CardBox: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ background: "rgba(5,7,16,0.66)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 14, padding: "10px 22px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
    <div style={{ fontFamily: MONO, fontSize: 16, color: "#f2b661", letterSpacing: "0.05em" }}>{label}</div>
    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 30 }}>{children}</div>
  </div>
);

export const SL_WordmarkSpecimen: React.FC = () => (
  <Sheet title="dmarz wordmark // drawn from straight lines // big, and at the size it sits in the lockup">
    {CUSTOM.map((c) => (
      <CardBox key={c.n} label={`${c.n}  ${c.note}`}>
        {c.el(true)}
        <div style={{ marginLeft: "auto" }}>{c.el(false)}</div>
      </CardBox>
    ))}
  </Sheet>
);

// ---- off-the-shelf video game and glitch faces, same sheet layout
const GAME: { fam: string; file: string; size: number; note: string; vars?: string }[] = [
  { fam: "Press Start 2P", file: "PressStart2P.ttf", size: 46, note: "Press Start 2P · the NES title screen" },
  { fam: "Sixtyfour", file: "Sixtyfour.ttf", size: 44, note: "Sixtyfour · Commodore 64, with scanlines", vars: "'SCAN' -40" },
  { fam: "Workbench", file: "Workbench.ttf", size: 60, note: "Workbench · Amiga, bleeding phosphor", vars: "'BLED' 60, 'SCAN' -30" },
  { fam: "VT323", file: "VT323.ttf", size: 84, note: "VT323 · the DEC terminal" },
  { fam: "Silkscreen", file: "Silkscreen-Bold.ttf", size: 58, note: "Silkscreen · tiny UI pixels, bold" },
  { fam: "Pixelify Sans", file: "PixelifySans.ttf", size: 66, note: "Pixelify Sans · friendly pixel" },
  { fam: "Jersey 10", file: "Jersey10.ttf", size: 84, note: "Jersey 10 · sports-scoreboard pixel" },
  { fam: "Micro 5", file: "Micro5.ttf", size: 96, note: "Micro 5 · five pixels tall" },
  { fam: "Handjet", file: "Handjet.ttf", size: 80, note: "Handjet · variable element shapes", vars: "'ELSH' 8, 'ELGR' 2" },
  { fam: "Rubik Glitch", file: "RubikGlitch.ttf", size: 70, note: "Rubik Glitch · torn fat sans" },
  { fam: "Rubik Maze", file: "RubikMaze.ttf", size: 66, note: "Rubik Maze · labyrinth fill" },
  { fam: "Nabla", file: "Nabla.ttf", size: 74, note: "Nabla · isometric colour font, cube-built" },
  { fam: "Bungee Shade", file: "BungeeShade.ttf", size: 60, note: "Bungee Shade · arcade marquee" },
  { fam: "Tiny5", file: "Tiny5.ttf", size: 80, note: "Tiny5 · 5 px handheld" },
];
let started = false;
const load = () => {
  if (started || typeof document === "undefined") return;
  started = true;
  const hnd = delayRender("game fonts");
  Promise.all(GAME.map((c) => new FontFace(`game-${c.fam}`, `url(${staticFile("fonts/" + c.file)})`).load().then((f) => document.fonts.add(f))))
    .then(() => continueRender(hnd))
    .catch(() => continueRender(hnd));
};
load();

export const SL_GameFontSpecimen: React.FC = () => (
  <Sheet title="dmarz wordmark // video game and glitch faces, off the shelf">
    {GAME.map((c, i) => (
      <CardBox key={c.fam} label={`${String(i + 1).padStart(2, "0")}  ${c.note}`}>
        <span style={{ fontFamily: `'game-${c.fam}'`, fontSize: c.size, lineHeight: 1, whiteSpace: "nowrap", fontVariationSettings: c.vars, filter: "drop-shadow(-1.5px 0 rgba(0,229,255,0.55)) drop-shadow(1.5px 0 rgba(255,64,128,0.42))" }}>dmarz</span>
        <span style={{ marginLeft: "auto", fontFamily: `'game-${c.fam}'`, fontSize: c.size * 0.45, color: "#9ece6a", whiteSpace: "nowrap", fontVariationSettings: c.vars }}>dmarz</span>
      </CardBox>
    ))}
  </Sheet>
);
