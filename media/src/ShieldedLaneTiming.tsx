import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { DmarzMark } from "./DmarzMark";
import { Field, Swarm, Bloom, Overlay, Title, HudChrome, glass, IrisEdge, Brackets } from "./Juice";
import { MONO } from "./Fonts";

/**
 * Shielded lane thread — slot-timing figure (v2, swimlane).
 *
 * One job: show that the builder's payload and the shielded lane are built
 * at the same wall-clock time by different actors, and only meet at the
 * proposer's commitment (slot N+1, t=0).
 *
 * Six actor rows on one shared time axis spanning two slots. Solid bars in
 * the actor's color; a translucent band across slot N marks the overlap;
 * two arrowed connectors (blue from the builder's bid, purple from the lane
 * proposer's hand-off) converge on the proposer's diamond at the commit line.
 * Tick grammar (t= mono labels under tick marks, arrowhead axis) follows
 * Neuder's ethresear.ch slot diagrams.
 *
 * Palette matches the sibling SL-* figures.
 */

const BG = "#070a0e";
const FG = "#e8eaed";
const SANS = "Inter, system-ui, -apple-system, sans-serif";

const BL = "#7aa2f7"; // payload / builder
const BL_HI = "#d2e0ff"; // bid diamond + reveal tick on the blue bar
const SL = "#c792ea"; // shielded lane
const OK = "#9ece6a"; // attesters
const VA = "#e0af68"; // execution

const fgA = (a: number) => `rgba(232,234,237,${a})`;
const hexA = (hex: string, a: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
};

/* ---- horizontal geometry ---- */
const LABEL_X = 100; // actor labels + title + callout share this edge
const X0 = 430; // slot N t=0
const XE = 1820; // slot N+1 t=12
const SLOT_W = (XE - X0) / 2;
const XB = X0 + SLOT_W; // slot boundary = commit
const PX_PER_S = SLOT_W / 12;
const xN = (t: number) => X0 + t * PX_PER_S;
const xN1 = (t: number) => XB + t * PX_PER_S;
const TIP = XE + 44; // axis arrowhead tip

/* ---- vertical geometry ---- */
const TITLE_Y = 72;
const TOPLABEL_Y = 192; // "commit" / "payload reveal" label row
const ROW_Y0 = 242; // first row top
const ROW_H = 84; // row pitch
const BAR_H = 40; // bar height
const BAR_DY = 36; // bar top within row (upper 30px = annotation band)
const ANN_DY = 2; // annotation line top within row
const rowTop = (i: number) => ROW_Y0 + i * ROW_H;
const barTop = (i: number) => rowTop(i) + BAR_DY;
const barMid = (i: number) => barTop(i) + BAR_H / 2;
const ROWS_END = rowTop(6) - (ROW_H - BAR_DY - BAR_H); // bottom of last bar + 4
const AXIS_Y = ROWS_END + 18;
const TICK_H = 12;
const TICK_LABEL_Y = AXIS_Y + 14;
const SLOT_LABEL_Y = AXIS_Y + 46;
const CALLOUT_Y = SLOT_LABEL_Y + 58;
const CALLOUT_LH = 34;


/* ---- rows ---- */
type Row = { label: string; color: string };
const ROWS: Row[] = [
  { label: "builder", color: BL },
  { label: "lane committee (16)", color: SL },
  { label: "lane merge", color: SL },
  { label: "proposer", color: FG },
  { label: "attesters", color: OK },
  { label: "execution", color: VA },
];

/* ---- bars ---- */
type Bar = {
  row: number;
  from: number;
  to: number;
  color: string;
  label: string;
  /** where the label goes: inside the bar, beside it, or in the row's annotation band */
  labelPos: "in" | "left" | "right" | "above-right";
};
const BARS: Bar[] = [
  { row: 0, from: xN(0), to: xN1(6), color: BL, label: "building + bidding on payload N+1", labelPos: "in" },
  { row: 1, from: xN(0), to: xN(8), color: SL, label: "collect + gossip lane lists", labelPos: "in" },
  { row: 2, from: xN(9), to: xN(11), color: SL, label: "merge lists into one lane", labelPos: "left" },
  { row: 4, from: xN1(0), to: xN1(3), color: OK, label: "check lane, attest", labelPos: "right" },
  { row: 5, from: xN1(6), to: xN1(12), color: VA, label: "payload, then lane, then block-end ops", labelPos: "above-right" },
];

/* ---- ticks ---- */
type Tick = { x: number; label: string; align: "center" | "left" | "right" };
const TICKS: Tick[] = [
  { x: xN(0), label: "t=0", align: "center" },
  { x: xN(3), label: "t=3", align: "center" },
  { x: xN(6), label: "t=6", align: "center" },
  { x: xN(9), label: "t=9", align: "center" },
  { x: XB, label: "t=12", align: "right" },
  { x: XB, label: "t=0", align: "left" },
  { x: xN1(3), label: "t=3", align: "center" },
  { x: xN1(6), label: "t=6", align: "center" },
  { x: xN1(9), label: "t=9", align: "center" },
  { x: xN1(12), label: "t=12", align: "center" },
];

type R = { opacity: number; transform: string };
const riseIn = (frame: number, fps: number, delay: number): R => {
  const sp = spring({ frame: frame - delay, fps, config: { damping: 26, stiffness: 130 } });
  return { opacity: Math.max(0, Math.min(1, sp)), transform: `translateY(${interpolate(sp, [0, 1], [14, 0])}px)` };
};

const Mono: React.FC<{
  x: number;
  y: number;
  align?: "left" | "center" | "right";
  size?: number;
  color?: string;
  weight?: number;
  bg?: boolean;
  lh?: number;
  children: React.ReactNode;
}> = ({ x, y, align = "left", size = 24, color = FG, weight = 400, bg, lh, children }) => {
  const tf = align === "center" ? "translateX(-50%)" : align === "right" ? "translateX(-100%)" : "none";
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: tf,
        fontFamily: MONO,
        fontSize: size,
        lineHeight: `${lh ?? 30}px`,
        color,
        fontWeight: weight,
        whiteSpace: "pre",
        background: bg ? "rgba(4,6,11,0.78)" : "transparent",
        borderRadius: 6,
        padding: bg ? "0 8px" : 0,
        marginLeft: bg && align === "left" ? -8 : 0,
        marginRight: bg && align === "right" ? -8 : 0,
      }}
    >
      {children}
    </div>
  );
};

const Diamond: React.FC<{ x: number; y: number; r: number; fill: string; stroke?: string }> = ({ x, y, r, fill, stroke }) => (
  <polygon
    points={`${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`}
    fill={fill}
    stroke={stroke ?? BG}
    strokeWidth={2.5}
    strokeLinejoin="round"
  />
);

export const SL_Timing: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const title = riseIn(frame, fps, 0);
  const diag = riseIn(frame, fps, 6);
  const foot = riseIn(frame, fps, 16);

  const BAND_TOP = rowTop(0) + ANN_DY - 6;
  const BAND_BOT = barTop(2) + BAR_H + 6;

  const bidX = XB;
  const bidY = barMid(0);
  const propX = XB;
  const propY = barMid(3);
  const laneEndX = xN(11);
  const laneEndY = barMid(2);

  return (
    <AbsoluteFill style={{ background: BG, color: FG, fontFamily: SANS }}>
      <Field />
      {/* calm glass under the chart so the swarm never crosses a label */}
      <div style={{ position: "absolute", left: 70, right: 56, top: 184, height: 664, borderRadius: 18, ...glass("#7aa2f7") }}>
        <IrisEdge />
        <Brackets color="#7aa2f7" />
      </div>
      {/* title */}
      <Bloom strength={0.4}>
      <div style={{ position: "absolute", top: TITLE_Y - 6, left: LABEL_X, right: 100, ...title }}>
        <Title size={68}>{"slot timeline"}</Title>
      </div>

      {/* diagram */}
      <div style={{ position: "absolute", inset: 0, ...diag }}>
        <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
          <defs>
            <marker id="arrBL" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={BL} />
            </marker>
            <marker id="arrSL" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={SL} />
            </marker>
          </defs>

          {/* parallel band across slot N, rows 1-3 */}
          <rect x={X0} y={BAND_TOP} width={XB - X0} height={BAND_BOT - BAND_TOP} fill={fgA(0.085)} rx={6} />
          <line x1={X0} y1={BAND_TOP} x2={XB} y2={BAND_TOP} stroke={fgA(0.35)} strokeWidth={1.5} />
          <line x1={X0 + 0.75} y1={BAND_TOP} x2={X0 + 0.75} y2={BAND_TOP + 14} stroke={fgA(0.35)} strokeWidth={1.5} />
          <line x1={XB - 0.75} y1={BAND_TOP} x2={XB - 0.75} y2={BAND_TOP + 14} stroke={fgA(0.35)} strokeWidth={1.5} />

          {/* row tracks */}
          {ROWS.map((_, i) => (
            <rect key={i} x={X0} y={barTop(i)} width={XE - X0} height={BAR_H} fill={fgA(0.055)} rx={5} />
          ))}

          {/* slot boundary + payload reveal: dashed verticals across all rows */}
          <line x1={XB} y1={TOPLABEL_Y + 34} x2={XB} y2={AXIS_Y} stroke={fgA(0.5)} strokeWidth={2} strokeDasharray="4 8" strokeLinecap="round" />
          <line x1={xN1(6)} y1={TOPLABEL_Y + 34} x2={xN1(6)} y2={AXIS_Y} stroke={fgA(0.5)} strokeWidth={2} strokeDasharray="4 8" strokeLinecap="round" />

          {/* bars */}
          {BARS.map((b, i) => (
            <rect key={i} x={b.from} y={barTop(b.row)} width={b.to - b.from} height={BAR_H} fill={b.color} rx={6} style={{ filter: `drop-shadow(0 0 5px ${b.color}73)` }} />
          ))}

          {/* builder: reveal tick at N+1 t=6 (bright, taller than the bar) */}
          <rect x={xN1(6) - 3} y={barTop(0) - 7} width={6} height={BAR_H + 14} fill={BL_HI} rx={2} />

          {/* attesters: PTC tick at N+1 t=9 (dim) */}
          <rect x={xN1(9) - 2.5} y={barTop(4) - 4} width={5} height={BAR_H + 8} fill={hexA(OK, 0.55)} rx={2} />

          {/* connectors into the proposer's diamond */}
          <line x1={bidX} y1={bidY + 20} x2={propX} y2={propY - 26} stroke={BL} strokeWidth={5} markerEnd="url(#arrBL)" />
          <line x1={laneEndX + 6} y1={laneEndY + 6} x2={propX - 26} y2={propY - 6} stroke={SL} strokeWidth={5} markerEnd="url(#arrSL)" />

          {/* diamonds */}
          <Diamond x={bidX} y={bidY} r={15} fill={BL_HI} />
          <g style={{ filter: "drop-shadow(0 0 6px rgba(255,255,255,0.45))" }}><Diamond x={propX} y={propY} r={21} fill={FG} stroke={BG} /></g>

          {/* axis */}
          <line x1={X0 - 2} y1={AXIS_Y} x2={TIP - 22} y2={AXIS_Y} stroke={FG} strokeWidth={2.5} />
          <polygon points={`${TIP},${AXIS_Y} ${TIP - 26},${AXIS_Y - 10} ${TIP - 26},${AXIS_Y + 10}`} fill={FG} />
          {TICKS.filter((t) => t.align !== "left").map((t, i) => (
            <line key={i} x1={t.x} y1={AXIS_Y - TICK_H} x2={t.x} y2={AXIS_Y + TICK_H} stroke={FG} strokeWidth={2.5} />
          ))}
        </svg>

        {/* top-edge labels */}
        <Mono x={X0 + 12} y={rowTop(0) + ANN_DY} size={24} color={fgA(0.72)} lh={30}>same wall clock, different actors</Mono>
        <Mono x={XB} y={TOPLABEL_Y} align="center" size={24} color={fgA(0.92)} bg>commit</Mono>
        <Mono x={xN1(6)} y={TOPLABEL_Y} align="center" size={24} color={fgA(0.92)} bg>payload reveal</Mono>

        {/* actor labels */}
        {ROWS.map((r, i) => (
          <Mono key={i} x={LABEL_X} y={barMid(i) - 17} size={26} color={r.color} weight={600} lh={34}>
            {r.label}
          </Mono>
        ))}

        {/* bar labels */}
        {BARS.map((b, i) => {
          const y = barTop(b.row) + (BAR_H - 30) / 2;
          if (b.labelPos === "in") {
            return (
              <Mono key={i} x={b.from + 14} y={y} size={24} color={BG} weight={600}>{b.label}</Mono>
            );
          }
          if (b.labelPos === "left") {
            return (
              <Mono key={i} x={b.from - 14} y={y} align="right" size={24} color={b.color} weight={600}>{b.label}</Mono>
            );
          }
          if (b.labelPos === "right") {
            return (
              <Mono key={i} x={b.to + 14} y={y} size={24} color={b.color} weight={600}>{b.label}</Mono>
            );
          }
          return (
            <Mono key={i} x={b.to} y={rowTop(b.row) + ANN_DY} align="right" size={24} color={b.color} weight={600} bg>{b.label}</Mono>
          );
        })}

        {/* builder annotations */}
        <Mono x={bidX} y={rowTop(0) + ANN_DY} align="center" size={24} color={BL} weight={600} bg>bid</Mono>
        <Mono x={xN1(6)} y={rowTop(0) + ANN_DY} align="center" size={24} color={BL} weight={600} bg>reveals payload</Mono>

        {/* proposer annotation */}
        <Mono x={propX + 30} y={barTop(3) + (BAR_H - 30) / 2} size={24} color={FG} weight={600}>beacon block: bid + lane commitment</Mono>

        {/* attesters PTC annotation */}
        <Mono x={xN1(9)} y={rowTop(4) + ANN_DY} align="center" size={24} color={hexA(OK, 0.8)} weight={600} bg>PTC: payload available?</Mono>

        {/* tick labels + slot names */}
        {TICKS.map((t, i) => {
          const dx = t.align === "left" ? 12 : t.align === "right" ? -12 : 0;
          return (
            <Mono key={i} x={t.x + dx} y={TICK_LABEL_Y} align={t.align} size={24} color={fgA(0.92)}>
              {t.label}
            </Mono>
          );
        })}
        <Mono x={X0 + SLOT_W / 2} y={SLOT_LABEL_Y} align="center" size={28} lh={34}>slot N</Mono>
        <Mono x={XB + SLOT_W / 2} y={SLOT_LABEL_Y} align="center" size={28} lh={34}>slot N+1</Mono>

        {/* callout */}
        <div style={{ position: "absolute", left: LABEL_X, top: CALLOUT_Y, fontFamily: MONO, fontSize: 26, lineHeight: `${CALLOUT_LH}px`, whiteSpace: "pre", color: fgA(0.88) }}>
          <div><span style={{ color: SL, fontWeight: 600 }}>the lane needs:</span>     last slot's lane (known at t=0), deposit roots two blocks old</div>
          <div><span style={{ color: BL, fontWeight: 600 }}>the payload needs:</span>  only the outbox of earlier lanes, known a slot ahead</div>
          <div><span style={{ color: FG, fontWeight: 600 }}>the proposer needs:</span> both, by t=0</div>
        </div>
      </div>

      {/* footer */}
      <div style={{ position: "absolute", bottom: 56, left: LABEL_X, right: 100, transform: foot.transform, opacity: foot.opacity * 0.88, fontFamily: MONO, fontSize: 28, color: FG }}>
        timings from EIP-7732 ePBS and EIP-7805 FOCIL. purple is the new part.
      </div>
      </Bloom>
      <DmarzMark right={100} bottom={40} scale={0.8} still />
      <Overlay />
    </AbsoluteFill>
  );
};
