import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { DmarzMark } from "./DmarzMark";
import { Field, Swarm, Bloom, Overlay, glass, IrisEdge, Brackets, emit, Title, HudChrome, useBloomPass } from "./Juice";
import { MONO } from "./Fonts";

/**
 * Shielded lane thread — the two crossings, animated.
 *
 * Two blocks side by side (N and N+1) with their structs spelled out, the
 * slice of consensus state that the crossing touches underneath, and one
 * value walked through it step by step. Same language as ShieldedLane.tsx:
 * payload/builder = blue, shielded lane = purple, vault / transparent UTXO
 * = amber. Legible first: one thing lit at a time, one caption at a time.
 */

const BG = "#070a0e";
const FG = "#e8eaed";
const SANS = "Inter, system-ui, -apple-system, sans-serif";

const BL = "#7aa2f7";
const SL = "#c792ea";
const VA = "#e0af68";
const OK = "#9ece6a";
const NO = "#f7768e";
const STR = "#a3be8c";
const PUNC = "rgba(232,234,237,0.42)";
const NOTE = "#7f8896";
const wA = (a: number) => `rgba(255,255,255,${a})`;
const hexA = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

type Seg = { t: string; c?: string; b?: boolean };
const s = (t: string, c?: string, b?: boolean): Seg => ({ t, c, b });

// `sentAt`: the row is a tx the user sends during that step, so it is a ghost until it lands
type Row = { id: string; kind: "section" | "code" | "dim"; segs: Seg[]; note?: string; accent?: string; sentAt?: number };
type CardDef = { title: string; rows: Row[] };
type CellDef = { id: string; name: string; tag?: string; accent: string; values: { step: number; at?: number; segs: Seg[] }[] };
type Anchor = { card: number; row: string } | { cell: string };
type Leg = { step: number; label: string; color: string; from: Anchor; to: Anchor; t0?: number; t1?: number };
// a user-signed tx on its way into a block: public txs go mempool → builder, lane ops go to the committee
type Send = { step: number; label: string; route: "public" | "lane"; to: { card: number; row: string } };
type StepDef = { caption: string; sub?: string; rows: string[]; cells: string[] };
type Link = { step: number; from: Anchor; to: Anchor; color: string };
type FlowDef = { title: string; cards: [CardDef, CardDef]; stateLabel: string; cells: CellDef[]; steps: StepDef[]; legs: Leg[]; links: Link[]; sends: Send[]; fig: string };

// ---------------------------------------------------------------------------
// Layout (absolute, so the moving token always knows where things are)
// ---------------------------------------------------------------------------
const W = 1920;
const MARGIN = 80;
const CARD_W = 860;
const CARD_GAP = 40;
const CARD_TOP = 168;
const HEAD_H = 54;
const PAD_Y = 14;
const ROW_H = 45;
const STATE_TOP = 764;
const CELL_GAP = 20;
const CELL_H = 148;
const STEP_LEN = 96; // frames a step holds
const ARRIVE = 38; // frames into a step when the moving value lands
const TAIL = 36;
const SEND_T0 = 4; // a send leaves the wallet
const SEND_MID = 22; // reaches the mempool / committee
const SEND_T1 = 40; // lands in its row
const AFTER_SEND = 74; // state reacts once the tx is in the block
const USER: [number, number] = [1130, 84];
const GATE_Y = CARD_TOP - 24;
export const FLOW_FRAMES = 5 * STEP_LEN + TAIL;

const cardX = (i: number) => MARGIN + i * (CARD_W + CARD_GAP);
const rowY = (rowIdx: number) => CARD_TOP + HEAD_H + PAD_Y + rowIdx * ROW_H;
const cellW = (n: number) => (W - 2 * MARGIN - (n - 1) * CELL_GAP) / n;
const cellX = (i: number, n: number) => MARGIN + i * (cellW(n) + CELL_GAP);

const ease = Easing.bezier(0.22, 0.8, 0.24, 1);
const ramp = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------
const Segs: React.FC<{ segs: Seg[] }> = ({ segs }) => (
  <span style={{ whiteSpace: "pre" }}>
    {segs.map((g, i) => (
      <span key={i} style={{ color: g.c ?? FG, fontWeight: g.b ? 700 : 400, textShadow: emit(g.c, g.b ? 1.1 : 0.75) }}>
        {g.t}
      </span>
    ))}
  </span>
);

const Card: React.FC<{ def: CardDef; x: number; active: Set<string>; seen: Set<string>; started: boolean; frame: number }> = ({ def, x, active, seen, started, frame }) => {
  const bloomPass = useBloomPass();
  const h = HEAD_H + PAD_Y * 2 + def.rows.length * ROW_H;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: CARD_TOP,
        width: CARD_W,
        height: h,
        borderRadius: 16,
        fontFamily: MONO,
        ...glass(SL, bloomPass),
      }}
    >
      <IrisEdge radius={16} />
      <Brackets color="#8fa2d8" inset={-9} size={16} opacity={0.6} />
      <div style={{ height: HEAD_H, display: "flex", alignItems: "center", padding: "0 26px", borderBottom: `1px solid ${wA(0.07)}`, fontSize: 28 }}>
        <span style={{ color: "#c792ea" }}>block </span>
        <span style={{ fontWeight: 700, marginLeft: 12 }}>{def.title}</span>
      </div>
      {/* nesting: payload, shielded_lane and block-end ops are siblings inside the block */}
      {def.rows.map((r, ri) => {
        if (r.kind !== "section") return null;
        let e = ri + 1;
        while (e < def.rows.length && def.rows[e].kind !== "section") e++;
        const hue = r.accent === OK ? "#8a93a6" : r.accent ?? SL;
        return (
          <div
            key={`box-${r.id}`}
            style={{
              position: "absolute",
              left: 9,
              right: 9,
              top: HEAD_H + PAD_Y + ri * ROW_H + 3,
              height: (e - ri) * ROW_H - 6,
              borderRadius: 9,
              border: `1px solid ${hexA(hue, 0.5)}`,
              borderLeft: `3px solid ${hexA(hue, 0.9)}`,
              background: hexA(hue, 0.055),
            }}
          />
        );
      })}
      <div style={{ paddingTop: PAD_Y, position: "relative" }}>
        {def.rows.map((r) => {
          const landAt = r.sentAt === undefined ? -1 : r.sentAt * STEP_LEN + SEND_T1;
          const landed = r.sentAt === undefined ? 1 : ramp(frame, landAt - 4, landAt + 8);
          const on = active.has(r.id) && landed > 0.5;
          const was = seen.has(r.id);
          const accent = r.accent ?? SL;
          const base = r.kind === "section" ? 0.95 : r.kind === "dim" ? 0.34 : started ? 0.5 : 0.8;
          return (
            <div
              key={r.id}
              style={{
                height: ROW_H,
                display: "flex",
                alignItems: "center",
                margin: "0 12px",
                padding: "0 14px 0 11px",
                borderRadius: 6,
                borderLeft: `3px solid ${on ? accent : "transparent"}`,
                background: on ? hexA(accent, 0.16) : "transparent",
                opacity: (on ? 1 : was ? Math.max(base, 0.78) : base) * (0.13 + 0.87 * landed),
                transform: r.sentAt !== undefined && frame >= landAt - 2 && frame < landAt + 7 ? `translateX(${[3, -4, 2, -2, 5, -3, 1, -1, 0][frame - landAt + 2] ?? 0}px)` : undefined,
                filter: r.sentAt !== undefined && frame >= landAt - 2 && frame < landAt + 7 ? "drop-shadow(-3px 0 rgba(0,229,255,0.8)) drop-shadow(3px 0 rgba(255,64,128,0.7))" : on ? `drop-shadow(0 0 10px ${hexA(accent, 0.35)})` : undefined,
                fontSize: r.kind === "section" ? 24 : 23,
              }}
            >
              <Segs segs={r.segs} />
              {r.note ? <span style={{ marginLeft: "auto", paddingLeft: 24, color: on ? accent : NOTE, fontStyle: "italic", fontSize: 21, whiteSpace: "pre" }}>{"← " + r.note}</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Cell: React.FC<{ def: CellDef; x: number; w: number; frame: number; active: boolean }> = ({ def, x, w, frame, active }) => {
  const bloomPass = useBloomPass();
  // the shown value is the last one whose step has landed
  let idx = 0;
  let changedAt = -1e9;
  def.values.forEach((v, i) => {
    const at = v.step < 0 ? -1e9 : v.step * STEP_LEN + (v.at ?? ARRIVE);
    if (frame >= at) {
      idx = i;
      changedAt = at;
    }
  });
  const flash = 1 - ramp(frame, changedAt, changedAt + 26);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: STATE_TOP,
        width: w,
        height: CELL_H,
        boxSizing: "border-box",
        borderRadius: 14,
        border: `1px solid ${active ? hexA(def.accent, 0.8) : wA(0.13)}`,
        background: bloomPass ? (active ? hexA(def.accent, 0.3 * flash) : "transparent") : active ? `linear-gradient(${hexA(def.accent, 0.12 + 0.18 * flash)}, ${hexA(def.accent, 0.12 + 0.18 * flash)}), rgba(5,7,16,0.66)` : "linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02)), rgba(5,7,16,0.66)",
        ...(bloomPass ? {} : { backdropFilter: "blur(14px) saturate(150%)" }),
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18), 0 0 ${18 + 40 * flash}px ${hexA(def.accent, active ? 0.1 + 0.28 * flash : 0)}`,
        padding: "16px 22px",
        fontFamily: MONO,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", fontSize: 21 }}>
        <span style={{ color: def.accent, fontWeight: 700 }}>{def.name}</span>
        {def.tag ? <span style={{ marginLeft: "auto", color: NOTE, fontStyle: "italic", fontSize: 19 }}>{def.tag}</span> : null}
      </div>
      <div style={{ marginTop: 20, fontSize: 25, opacity: 0.55 + 0.45 * Math.max(active ? 1 : 0, flash) }}>
        <Segs segs={def.values[idx].segs} />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// The flow
// ---------------------------------------------------------------------------
const Flow: React.FC<{ def: FlowDef }> = ({ def }) => {
  const frame = useCurrentFrame();
  const step = Math.min(def.steps.length - 1, Math.floor(frame / STEP_LEN));
  const local = frame - step * STEP_LEN;
  const cur = def.steps[step];
  const active = new Set(cur.rows);
  const seen = new Set(def.steps.slice(0, step).flatMap((st) => st.rows));
  const activeCells = new Set(cur.cells);
  const n = def.cells.length;

  const anchor = (a: Anchor): [number, number] => {
    if ("cell" in a) {
      const i = def.cells.findIndex((c) => c.id === a.cell);
      return [cellX(i, n) + cellW(n) / 2, STATE_TOP + 116];
    }
    const i = def.cards[a.card].rows.findIndex((r) => r.id === a.row);
    return [cardX(a.card) + CARD_W - 250, rowY(i) + ROW_H / 2];
  };

  const capIn = ramp(local, 0, 12);
  const capOut = step < def.steps.length - 1 ? 1 - ramp(local, STEP_LEN - 8, STEP_LEN) : 1;

  return (
    <AbsoluteFill style={{ background: BG, fontFamily: SANS, color: FG }}>
      <Field />
      <Bloom strength={0.5}>
      <div style={{ position: "absolute", top: 50, left: MARGIN }}>
        <Title size={48}>{def.title}</Title>
      </div>

      {def.cards.map((c, i) => (
        <Card key={i} def={c} x={cardX(i)} active={active} seen={seen} started={frame > 6} frame={frame} />
      ))}

      <div style={{ position: "absolute", left: MARGIN, top: STATE_TOP - 36, fontFamily: MONO, fontSize: 21, color: NOTE }}>{def.stateLabel}</div>
      {def.cells.map((c, i) => (
        <Cell key={c.id} def={c} x={cellX(i, n)} w={cellW(n)} frame={frame} active={activeCells.has(c.id)} />
      ))}

      {/* a step change is announced by one analysis sweep down the two blocks */}
      {(() => {
        const p = ramp(local, 0, 18);
        if (step === 0 || p >= 1) return null;
        const y = CARD_TOP + p * (HEAD_H + PAD_Y * 2 + 10 * ROW_H);
        return <div style={{ position: "absolute", left: MARGIN, right: MARGIN, top: y, height: 2, background: "linear-gradient(90deg, transparent, #4df3ff 15%, #4df3ff 85%, transparent)", opacity: 0.55 * (1 - p), boxShadow: "0 0 10px #4df3ff, 0 0 30px rgba(77,243,255,0.3)" }} />;
      })()}

      {/* links: a thin elbow from a piece of state up to the row that uses it */}
      <svg width={W} height={1080} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {def.links.map((l, i) => {
          const start = l.step * STEP_LEN + 6;
          const p = ramp(frame, start, start + 34);
          if (p <= 0) return null;
          const [x0] = anchor(l.from);
          const [, y1] = anchor(l.to);
          const yTop = STATE_TOP - 2;
          const yRun = STATE_TOP - 50; // between the cards and the state label
          const card = "card" in l.to ? l.to.card : 1;
          const gx = cardX(card) - CARD_GAP / 2;
          const xEnd = cardX(card) + 2;
          const d = `M ${x0} ${yTop} L ${x0} ${yRun} L ${gx} ${yRun} L ${gx} ${y1} L ${xEnd} ${y1}`;
          const len = Math.abs(yTop - yRun) + Math.abs(x0 - gx) + Math.abs(yRun - y1) + Math.abs(xEnd - gx);
          return <path key={i} d={d} fill="none" stroke={l.color} strokeWidth={2.5} strokeDasharray={len} strokeDashoffset={len * (1 - p)} opacity={0.95} style={{ filter: `drop-shadow(0 0 8px ${l.color})` }} />;
        })}
      </svg>

      {/* the user and the tx they sign */}
      {(() => {
        const sending = def.sends.reduce((m, sd) => Math.max(m, ramp(frame, sd.step * STEP_LEN, sd.step * STEP_LEN + 8) * (1 - ramp(frame, sd.step * STEP_LEN + SEND_T1, sd.step * STEP_LEN + SEND_T1 + 16))), 0);
        return (
          <div
            style={{
              position: "absolute",
              left: USER[0],
              top: USER[1],
              transform: "translate(-50%, -50%)",
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "9px 20px 9px 12px",
              borderRadius: 999,
              border: `1px solid ${wA(0.16 + 0.5 * sending)}`,
              background: `rgba(255,255,255,${0.035 + 0.06 * sending})`,
              fontFamily: MONO,
              fontSize: 24,
            }}
          >
            <span style={{ width: 26, height: 26, borderRadius: "50%", background: wA(0.82), display: "inline-block" }} />
            <span>user wallet</span>
          </div>
        );
      })()}
      {def.sends.map((sd, i) => {
        const f0 = sd.step * STEP_LEN;
        const color = sd.route === "public" ? BL : SL;
        const a = ramp(frame, f0 + SEND_T0 - 2, f0 + SEND_T0 + 6) * (1 - ramp(frame, f0 + SEND_T1, f0 + SEND_T1 + 10));
        const gateA = ramp(frame, f0, f0 + 10) * (1 - ramp(frame, f0 + SEND_T1 + 6, f0 + SEND_T1 + 22));
        if (gateA <= 0.001) return null;
        const gate: [number, number] = [cardX(sd.to.card) + CARD_W / 2 + (sd.to.card === 0 ? 150 : -150), GATE_Y];
        const [rx, ry] = anchor(sd.to);
        const p1 = ramp(frame, f0 + SEND_T0, f0 + SEND_MID);
        const p2 = ramp(frame, f0 + SEND_MID, f0 + SEND_T1);
        const way: [number, number] = [gate[0], CARD_TOP + HEAD_H / 2];
        const posAt = (fr: number): [number, number] => {
          const q1 = ramp(fr, f0 + SEND_T0, f0 + SEND_MID);
          const q2 = ramp(fr, f0 + SEND_MID, f0 + SEND_T1);
          return q2 > 0 ? [way[0] + (rx - 120 - way[0]) * q2, way[1] + (ry - way[1]) * q2] : [USER[0] + (way[0] - USER[0]) * q1, USER[1] + (way[1] - USER[1]) * q1];
        };
        const [x, y] = posAt(frame);
        const trail = [2, 4, 6, 8, 10].map((d) => posAt(frame - d));
        return (
          <div key={i}>
            <div
              style={{
                position: "absolute",
                left: gate[0],
                top: gate[1],
                transform: "translate(-50%, -50%)",
                opacity: gateA,
                fontFamily: MONO,
                fontSize: 21,
                color,
                border: `1px solid ${hexA(color, 0.6)}`,
                background: BG,
                borderRadius: 8,
                padding: "5px 14px",
                whiteSpace: "pre",
              }}
            >
              {sd.route === "public" ? "public tx, sent privately → builder" : "private op, gossiped publicly → committee (16)"}
            </div>
            {trail.map(([tx, ty], k) => (
              <div key={k} style={{ position: "absolute", left: tx, top: ty, width: 86 - k * 12, height: 10 - k, transform: "translate(-50%, -50%)", borderRadius: 999, background: color, opacity: a * (0.34 - k * 0.06), filter: "blur(5px)" }} />
            ))}
            <div
              style={{
                position: "absolute",
                left: x,
                top: y,
                transform: "translate(-50%, -50%)",
                opacity: a,
                fontFamily: MONO,
                fontSize: 23,
                fontWeight: 700,
                color: "#0b0e13",
                background: color,
                borderRadius: 999,
                padding: "7px 18px",
                whiteSpace: "pre",
                boxShadow: `0 0 10px ${hexA(color, 0.65)}, 0 0 28px ${hexA(color, 0.3)}`,
              }}
            >
              {sd.label}
            </div>
          </div>
        );
      })}

      {/* the value in motion */}
      {def.legs.map((leg, i) => {
        const start = leg.step * STEP_LEN + (leg.t0 ?? 4);
        const end = leg.step * STEP_LEN + (leg.t1 ?? ARRIVE);
        const p = ramp(frame, start, end);
        const a = ramp(frame, start, start + 8) * (1 - ramp(frame, end, end + 12));
        if (a <= 0.001) return null;
        const [x0, y0] = anchor(leg.from);
        const [x1, y1] = anchor(leg.to);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x0 + (x1 - x0) * p,
              top: y0 + (y1 - y0) * p,
              transform: "translate(-50%, -50%)",
              opacity: a,
              fontFamily: MONO,
              fontSize: 23,
              fontWeight: 700,
              color: "#0b0e13",
              background: leg.color,
              borderRadius: 999,
              padding: "7px 18px",
              whiteSpace: "pre",
              boxShadow: `0 0 10px ${hexA(leg.color, 0.65)}, 0 0 28px ${hexA(leg.color, 0.3)}`,
            }}
          >
            {leg.label}
          </div>
        );
      })}

      </Bloom>
      <DmarzMark right={80} bottom={10} scale={0.64} />

      {/* one caption at a time */}
      <div style={{ position: "absolute", left: MARGIN, right: MARGIN, top: 944, fontFamily: MONO, opacity: capIn * capOut }}>
        <div style={{ display: "flex", alignItems: "baseline", fontSize: 28 }}>
          <span style={{ color: NOTE, marginRight: 22, fontSize: 24 }}>{`${step + 1}/${def.steps.length}`}</span>
          <span>{cur.caption}</span>
        </div>
        {cur.sub ? <div style={{ marginTop: 12, marginLeft: 62, fontSize: 23, color: NOTE, fontStyle: "italic" }}>{cur.sub}</div> : null}
      </div>
      <Overlay />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Flow 1 — deposit: public → shielded   (ADR-0009: the deposit tree has one writer, the payload)
// ---------------------------------------------------------------------------
const DEPOSIT: FlowDef = {
  title: "deposit",
  fig: "film 02/03",
  stateLabel: "one writer per structure",
  cards: [
    {
      title: "N",
      rows: [
        { id: "pN", kind: "section", segs: [s("payload", BL, true)], note: "built by the builder", accent: BL },
        { id: "dep", kind: "code", sentAt: 0, segs: [s("  Deposit", VA, true), s(" { vault, commitment: ", PUNC), s("c₀", VA, true), s(", value: ", PUNC), s("5 ETH", VA), s(" }", PUNC)], accent: VA },
        { id: "depw", kind: "code", segs: [s("    → append ", FG), s("c₀", VA, true), s(" to the deposit tree", FG)], note: "payload-only", accent: VA },
        { id: "lN", kind: "section", segs: [s("shielded_lane", SL, true)], note: "built by the committee", accent: SL },
        { id: "preN", kind: "code", segs: [s("  notes_anchor   ", FG), s("≤ ", PUNC), s("notes_root[N-1]", SL, true)], accent: SL },
        { id: "preN2", kind: "code", segs: [s("  deposit_anchor ", FG), s("≤ ", PUNC), s("deposit_root[N-2]", VA, true)], note: "two blocks late", accent: VA },
        { id: "opsN", kind: "dim", segs: [s("  ops : Transfer, Transfer, Unshield …")] },
        { id: "eN", kind: "section", segs: [s("block-end ops", NOTE, true)], accent: OK },
        { id: "sealL", kind: "code", segs: [s("  seal ", FG), s("notes_root[N]", SL, true)], note: "from the lane alone", accent: SL },
        { id: "sealD", kind: "code", segs: [s("  seal ", FG), s("deposit_root[N]", VA, true)], note: "from the payload alone", accent: VA },
      ],
    },
    {
      title: "N+2",
      rows: [
        { id: "pM", kind: "section", segs: [s("payload", BL, true)], note: "built by the builder", accent: BL },
        { id: "pMo", kind: "dim", segs: [s("  … txs")] },
        { id: "pMo2", kind: "dim", segs: [s("")] },
        { id: "lM", kind: "section", segs: [s("shielded_lane", SL, true)], note: "built by the committee", accent: SL },
        { id: "spend", kind: "code", sentAt: 3, segs: [s("  Transfer", SL, true), s(" { deposit_anchor: ", PUNC), s("deposit_root[N]", VA, true), s(",", PUNC)], accent: SL },
        { id: "spend2", kind: "code", sentAt: 3, segs: [s("             nullifiers, outputs, proof }", PUNC)], note: "tree: private", accent: SL },
        { id: "opsM", kind: "dim", segs: [s("  … other ops")] },
        { id: "eM", kind: "section", segs: [s("block-end ops", NOTE, true)], accent: OK },
        { id: "sealLM", kind: "code", segs: [s("  seal ", FG), s("notes_root[N+2]", SL, true)], accent: SL },
        { id: "sealDM", kind: "dim", segs: [s("  seal deposit_root[N+2]")] },
      ],
    },
  ],
  cells: [
    { id: "dtree", name: "deposit tree", tag: "writer: payload", accent: VA, values: [{ step: -1, segs: [s("… ▪ ▪", PUNC)] }, { step: 0, at: AFTER_SEND, segs: [s("… ▪ ▪ ", PUNC), s("c₀", VA, true)] }] },
    { id: "dring", name: "deposit_root_ring", tag: "read 2 late", accent: VA, values: [{ step: -1, segs: [s("[ … N-2, N-1 ]", PUNC)] }, { step: 2, segs: [s("[ … N-1, ", PUNC), s("N", OK, true), s(" ]", PUNC), s("  has c₀", OK)] }] },
    { id: "ntree", name: "notes tree", tag: "writer: lane", accent: SL, values: [{ step: -1, segs: [s("… ▪ ▪ ▪", PUNC)] }, { step: 4, segs: [s("… ▪ ▪ ▪ ", PUNC), s("new notes", SL, true)] }] },
    { id: "vault", name: "vault ETH", tag: "writer: payload", accent: BL, values: [{ step: -1, segs: [s("1,204 ETH", FG)] }, { step: 0, at: AFTER_SEND, segs: [s("1,209 ETH", BL, true), s("  +5", OK)] }] },
  ],
  steps: [
    { caption: "you send a normal public tx. the builder includes it: 5 ETH to the vault, c₀ to the deposit tree", rows: ["dep", "depw"], cells: ["dtree", "vault"] },
    { caption: "one writer each: the payload owns the deposit tree, the lane owns the notes tree. no queue", rows: ["sealL", "sealD"], cells: ["dtree", "ntree"] },
    { caption: "deposit_root[N] is sealed. lanes read it two blocks late, so a withheld payload can't confuse them", rows: ["sealD", "preN2"], cells: ["dring"] },
    { caption: "block N+2: you send a lane op to the committee. it proves c₀ is under deposit_root[N]", rows: ["spend", "spend2"], cells: ["dring"] },
    { caption: "its outputs go into the notes tree. from here on the builder never touches your money", rows: ["sealLM"], cells: ["ntree"] },
  ],
  legs: [
    { step: 0, label: "c₀ · 5 ETH", color: VA, from: { card: 0, row: "depw" }, to: { cell: "dtree" }, t0: SEND_T1 + 4, t1: AFTER_SEND },
    { step: 2, label: "deposit_root[N]", color: OK, from: { cell: "dtree" }, to: { cell: "dring" } },
    { step: 4, label: "notes", color: SL, from: { card: 1, row: "spend2" }, to: { cell: "ntree" } },
  ],
  links: [{ step: 3, from: { cell: "dring" }, to: { card: 1, row: "spend" }, color: OK }],
  sends: [
    { step: 0, label: "Deposit tx", route: "public", to: { card: 0, row: "dep" } },
    { step: 3, label: "Transfer op", route: "lane", to: { card: 1, row: "spend" } },
  ],
};

// ---------------------------------------------------------------------------
// Flow 2 — unshield: shielded → public   (ADR-0009: the outbox has one writer, the lane)
// ---------------------------------------------------------------------------
const UNSHIELD: FlowDef = {
  title: "unshield",
  fig: "film 03/03",
  stateLabel: "one writer per structure",
  cards: [
    {
      title: "N",
      rows: [
        { id: "pN", kind: "section", segs: [s("payload", BL, true)], note: "built by the builder", accent: BL },
        { id: "pNo", kind: "dim", segs: [s("  … txs. nothing here knows about the unshield")] },
        { id: "lN", kind: "section", segs: [s("shielded_lane", SL, true)], note: "built by the committee", accent: SL },
        { id: "preN", kind: "dim", segs: [s("  notes_anchor ≤ notes_root[N-1]")] },
        { id: "un1", kind: "code", sentAt: 0, segs: [s("  Unshield", SL, true), s(" { proof, nullifiers: ", PUNC), s("[n₁, n₂]", NO), s(", change[2],", PUNC)], accent: SL },
        { id: "un2", kind: "code", sentAt: 0, segs: [s("             credit_out: { ", PUNC), s("0xA1c…", VA, true), s(", ", PUNC), s("5 ETH", VA, true), s(" } }", PUNC)], note: "public now", accent: VA },
        { id: "un3", kind: "code", segs: [s("    → push credit to the outbox", FG)], note: "lane-only", accent: VA },
        { id: "opsN", kind: "dim", segs: [s("  … other ops")] },
        { id: "eN", kind: "section", segs: [s("block-end ops", NOTE, true)], accent: OK },
        { id: "sealN", kind: "code", segs: [s("  seal ", FG), s("notes_root[N]", SL, true)], accent: SL },
      ],
    },
    {
      title: "N+1",
      rows: [
        { id: "pM", kind: "section", segs: [s("payload", BL, true)], note: "built by the builder", accent: BL },
        { id: "pay", kind: "code", segs: [s("  pay_outbox()", BL, true), s("  # first, before any tx", NOTE)], note: "as EIP-4895", accent: BL },
        { id: "credit", kind: "code", segs: [s("    ", FG), s("0xA1c…", VA, true), s(" += 5 ETH", FG)], note: "no gas, no tx", accent: BL },
        { id: "debit", kind: "code", segs: [s("    vault  −= 5 ETH", FG)], note: "turnstile", accent: BL },
        { id: "pMo", kind: "dim", segs: [s("  … then everyone's txs, as today")] },
        { id: "lM", kind: "section", segs: [s("shielded_lane", SL, true)], note: "built by the committee", accent: SL },
        { id: "preM", kind: "dim", segs: [s("  notes_anchor ≤ notes_root[N]")] },
        { id: "opsM", kind: "dim", segs: [s("  ops : …")] },
        { id: "eM", kind: "section", segs: [s("block-end ops", NOTE, true)], accent: OK },
        { id: "sealM", kind: "dim", segs: [s("  seal notes_root[N+1]")] },
      ],
    },
  ],
  cells: [
    { id: "nulls", name: "nullifier set", tag: "writer: lane", accent: NO, values: [{ step: -1, segs: [s("{ … }", PUNC)] }, { step: 1, segs: [s("{ … ", PUNC), s("n₁, n₂", NO, true), s(" }", PUNC)] }] },
    { id: "tree", name: "notes tree", tag: "writer: lane", accent: SL, values: [{ step: -1, segs: [s("… ▪ ▪ ▪", PUNC)] }, { step: 1, segs: [s("… ▪ ▪ ▪ ", PUNC), s("change", SL, true)] }] },
    {
      id: "outbox",
      name: "credit outbox",
      tag: "writer: lane",
      accent: VA,
      values: [{ step: -1, segs: [s("[ ]", PUNC)] }, { step: 1, segs: [s("[ ", PUNC), s("(0xA1c…, 5 ETH)", VA, true), s(" ]", PUNC)] }, { step: 3, segs: [s("[ ]", PUNC), s("   paid", NOTE)] }],
    },
    { id: "acct", name: "account 0xA1c…", tag: "writer: payload", accent: BL, values: [{ step: -1, segs: [s("0 ETH", FG)] }, { step: 3, at: AFTER_SEND - 14, segs: [s("5 ETH", BL, true), s("  credited", OK)] }] },
  ],
  steps: [
    { caption: "you send an unshield op to the committee. it rides in the lane, where nullifiers are revealed", rows: ["un1", "un2"], cells: [] },
    { caption: "applied: notes burned, change re-shielded, and a credit (0xA1c…, 5 ETH) pushed to the outbox", rows: ["un1", "un2", "un3"], cells: ["nulls", "tree", "outbox"] },
    { caption: "no account touched. the lane alone writes the outbox, the payload reads it a block later", rows: ["un3", "sealN"], cells: ["outbox", "acct"] },
    { caption: "block N+1: the payload must start by paying the outbox, the way validator withdrawals are paid", rows: ["pay", "credit", "debit"], cells: ["outbox", "acct"] },
    { caption: "you sent nothing the second time. no tx for a builder to censor, and skipping it voids the payload", rows: ["pay", "credit"], cells: ["acct"] },
  ],
  legs: [
    { step: 1, label: "(0xA1c…, 5 ETH)", color: VA, from: { card: 0, row: "un3" }, to: { cell: "outbox" } },
    { step: 3, label: "(0xA1c…, 5 ETH)", color: VA, from: { cell: "outbox" }, to: { card: 1, row: "credit" }, t0: 6, t1: 36 },
    { step: 3, label: "5 ETH", color: BL, from: { card: 1, row: "credit" }, to: { cell: "acct" }, t0: 40, t1: AFTER_SEND - 14 },
  ],
  links: [],
  sends: [{ step: 0, label: "Unshield op", route: "lane", to: { card: 0, row: "un1" } }],
};

export const SL_DepositFlow: React.FC = () => <Flow def={DEPOSIT} />;
export const SL_UnshieldFlow: React.FC = () => <Flow def={UNSHIELD} />;
