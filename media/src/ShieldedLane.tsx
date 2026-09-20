import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { DmarzMark } from "./DmarzMark";
import { Field, Swarm, Bloom, Overlay, glass, IrisEdge, Brackets, emit, Title, HudChrome, SpecTag, useBloomPass } from "./Juice";
import { MONO } from "./Fonts";

/**
 * Shielded lane thread — spec / state-transition figures.
 *
 * Same language as the anon-credentials thread: real structs, real
 * validity checks, annotated like a spec, "← note" callouts. Legible
 * first. payload/builder = blue, shielded lane = purple,
 * transparent UTXO / vault = amber.
 */

const BG = "#070a0e";
const FG = "#e8eaed";
const DIM = "rgba(232,234,237,0.5)";
const SANS = "Inter, system-ui, -apple-system, sans-serif";

const BL = "#7aa2f7"; // payload / builder (blue)
const SL = "#c792ea"; // shielded lane (purple)
const VA = "#e0af68"; // transparent UTXO / vault (amber)
const wA = (a: number) => `rgba(255,255,255,${a})`;

const VERB = "#c792ea";
const STR = "#a3be8c";
const PUNC = "rgba(232,234,237,0.42)";
const NOTE = "#7f8896";
const OK = "#9ece6a";
const NO = "#f7768e";

type Seg = { t: string; c?: string; b?: boolean };
// `box`: path of enclosing boxes, outermost first. Consecutive lines that share a prefix are drawn
// inside the same bordered box, so nesting in the data structure is nesting on the page.
type Line = { segs: Seg[]; note?: string; nc?: string; mt?: number; box?: string[] };
const BOX_HUE: Record<string, string> = { block: "#9fb4e6", payload: BL, lane: SL, struct: SL, apply: SL, pay: BL, pub: VA, beacon: "#9fb4e6" };

const s = (t: string, c?: string, b?: boolean): Seg => ({ t, c, b });

type R = { opacity: number; transform: string };
const riseIn = (frame: number, fps: number, delay: number): R => {
  const sp = spring({ frame: frame - delay, fps, config: { damping: 26, stiffness: 130 } });
  return { opacity: Math.max(0, Math.min(1, sp)), transform: `translateY(${interpolate(sp, [0, 1], [14, 0])}px)` };
};

const Shell: React.FC<{
  accent: string;
  title: string;
  footer: string;
  fig: string;
  children: React.ReactNode;
}> = ({ title, footer, fig, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const foot = riseIn(frame, fps, 16);
  return (
    <AbsoluteFill style={{ background: BG, fontFamily: SANS, color: FG }}>
      <Field />
      <Bloom strength={0.6}>
        <div style={{ position: "absolute", top: 84, left: 100, right: 100, ...riseIn(frame, fps, 0) }}>
          <Title>{title}</Title>
        </div>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "200px 100px 150px" }}>{children}</AbsoluteFill>
        <div style={{ position: "absolute", bottom: 70, left: 100, right: 480, transform: foot.transform, opacity: foot.opacity * 0.92, fontFamily: MONO, fontSize: 26, color: FG }}>{footer}</div>
      </Bloom>
      <DmarzMark right={100} bottom={40} scale={0.8} still />
      <Overlay />
    </AbsoluteFill>
  );
};

const CodeLine: React.FC<{ line: Line }> = ({ line }) => (
  <div style={{ display: "flex", alignItems: "baseline", marginTop: line.mt ?? 0 }}>
    <span style={{ whiteSpace: "pre" }}>
      {line.segs.map((seg, i) => (
        <span key={i} style={{ color: seg.c ?? FG, fontWeight: seg.b ? 700 : 400, textShadow: emit(seg.c, 0.8) }}>{seg.t}</span>
      ))}
    </span>
    {line.note ? (
      <span style={{ marginLeft: "auto", paddingLeft: 48, color: line.nc ?? NOTE, fontStyle: "italic", whiteSpace: "pre", textShadow: emit(line.nc, 0.8) }}>{"← " + line.note}</span>
    ) : null}
  </div>
);

const hexA2 = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
const renderLines = (items: { line: Line; i: number }[], depth: number, rule?: number): React.ReactNode[] => {
  const out: React.ReactNode[] = [];
  let k = 0;
  while (k < items.length) {
    const key = items[k].line.box?.[depth];
    if (key === undefined) {
      const { line, i } = items[k];
      out.push(
        <div key={`l${i}`}>
          {rule === i ? <div style={{ height: 1, background: wA(0.1), margin: "14px 0" }} /> : null}
          <CodeLine line={line} />
        </div>
      );
      k++;
      continue;
    }
    let e = k;
    while (e < items.length && items[e].line.box?.[depth] === key) e++;
    const hue = BOX_HUE[key] ?? "#9fb4e6";
    out.push(
      <div
        key={`b${depth}-${items[k].i}`}
        style={{
          border: `1px solid ${hexA2(hue, depth === 0 ? 0.42 : 0.6)}`,
          borderLeft: `3px solid ${hexA2(hue, 0.9)}`,
          borderRadius: 10,
          background: hexA2(hue, depth === 0 ? 0.035 : 0.07),
          boxShadow: `inset 0 0 24px ${hexA2(hue, 0.06)}`,
          padding: "5px 14px 7px",
          margin: "7px 0",
        }}
      >
        {renderLines(items.slice(k, e), depth + 1, rule)}
      </div>
    );
    k = e;
  }
  return out;
};

const Card: React.FC<{ accent: string; lines: Line[]; rule?: number; fontSize?: number; width?: number; lh?: number; pad?: number; tag?: string }> = ({ accent, lines, rule, fontSize, width, lh, pad, tag }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bloomPass = useBloomPass();
  return (
    <div
      style={{
        ...riseIn(frame, fps, 8),
        position: "relative",
        width: width ?? 1540,
        borderRadius: 18,
        ...glass(accent, bloomPass),
      }}
    >
      <IrisEdge />
      <Brackets color={accent} />
      <div style={{ padding: `${pad ?? 40}px 52px`, fontFamily: MONO, fontSize: fontSize ?? 32, lineHeight: lh ?? 1.62 }}>
        {renderLines(lines.map((line, i) => ({ line, i })), 0, rule)}
      </div>
    </div>
  );
};

/* ===== FRAME 1 — the block: two lanes ===== */
export const SL_Block: React.FC = () => (
  <Shell
    accent={SL}
    title="block structure"
    fig="fig 02/07"
    footer="the payload and the shielded lane are siblings inside one block"
  >
    <Card
      accent={SL}
      tag="spec v0.2 · sec 1, 3, 6"
      width={1700}
      lines={[
        { box: ["block"], segs: [s("block ", VERB), s("N", FG, true)], note: "one block, two sibling parts", nc: "#9fb4e6" },
        { box: ["block", "payload"], segs: [s("payload         ", BL, true), s(": ", PUNC), s("ExecutionPayload", STR)], note: "the builder's block", nc: BL },
        { box: ["block", "payload"], segs: [s("  pay_outbox()  ", FG), s(": ", PUNC), s("credits from earlier lanes, paid first", STR)], note: "like withdrawals, EIP-4895" },
        { box: ["block", "payload"], segs: [s("  txs[]         ", FG), s(": ", PUNC), s("Deposit", VA), s(" { vault, commitment, value }", FG)], note: "appends to the deposit tree" },
        { box: ["block", "payload"], segs: [s("                  … every other tx, as today", PUNC)] },
        { box: ["block", "lane"], segs: [s("shielded_lane   ", SL, true), s(": ", PUNC), s("ShieldedLane", STR)], note: "built by the FOCIL committee (16)", nc: SL },
        { box: ["block", "lane"], segs: [s("  ops           ", FG), s(": ", PUNC), s("LaneOp[]", STR), s("  = Transfer | Unshield", PUNC)], note: "nullifiers revealed only here" },
        { box: ["block", "lane"], segs: [s("  anchors       ", FG), s(": ", PUNC), s("notes ≤ ", STR), s("N-1", SL, true), s(", deposits ≤ ", STR), s("N-2", VA, true)], note: "known before the payload exists" },
        { box: ["block", "lane"], segs: [s("  validity      ", FG), s(": ", PUNC), s("per op. a bad or conflicting op is a no-op", STR)], note: "a lane can't be invalid", nc: OK },
        { box: ["block", "lane"], segs: [s("  gas           ", FG), s(": ", PUNC), s("gas(lane) ≤ LANE_GAS_LIMIT", STR)], note: "own budget, own base fee" },
        { box: ["block", "lane"], segs: [s("  fees, tips    ", FG), s(": ", PUNC), s("paid from consumed value", STR)], note: "never reads an account", nc: OK },
        { box: ["beacon"], segs: [s("beacon block ", VERB), s("N", FG, true), s(" : shielded_lane_root, shielded_state_root", FG), s("[N-1]", SL, true)], note: "root checked one slot late" },
        { segs: [s("writers", VERB), s(": lane → notes, nullifiers, outbox", SL), s("   payload → accounts, vault ETH, deposit tree", BL)], mt: 4 },
      ]}
      fontSize={24}
      lh={1.46}
      pad={20}
    />
  </Shell>
);

/* ===== FRAME 2 — what a node keeps ===== */
export const SL_State: React.FC = () => (
  <Shell
    accent={SL}
    fig="fig 04/07"
    title="shielded state"
    footer="note set and nullifier history live in history and are proven on demand"
  >
    <Card
      accent={SL}
      tag="spec v0.2 · sec 2"
      rule={6}
      lines={[
        { box: ["struct"], segs: [s("ShieldedState", SL, true), s(" {", PUNC)] },
        { box: ["struct"], segs: [s("  notes_root_ring      ", FG), s(": ", PUNC), s("bytes32[8192]", STR)], note: "~256 KB, written by the lane only" },
        { box: ["struct"], segs: [s("  nullifier_window     ", FG), s(": ", PUNC), s("last W blocks", STR)], note: "the leading edge only" },
        { box: ["struct"], segs: [s("  credit_outbox        ", FG), s(": ", PUNC), s("Credit[]", STR)], note: "paid by the next full payload" },
        { box: ["struct"], segs: [s("  pending_burn         ", FG), s(": ", PUNC), s("uint256", STR)], note: "lane base fees, debited from the vault" },
        { box: ["struct"], segs: [s("}", PUNC)] },
        { segs: [s("EIP-8182 today", NO, true), s(": mapping(uint256 => bool) nullifiers", FG)], note: "forever", nc: NO },
        { segs: [s("                ~192 B of new state per transfer", NO)] },
        { segs: [s("v2", OK, true), s(": older nullifiers proven absent by the user (PCD), tachyon-style", FG)], mt: 14 },
      ]}
      fontSize={30}
    />
  </Shell>
);

/* ===== FRAME 3 — unshield: back to public money ===== */
export const SL_Unshield: React.FC = () => (
  <Shell
    accent={VA}
    title="unshield"
    fig="fig 07/07"
    footer="the lane writes the outbox. the next payload pays it"
  >
    <Card
      accent={VA}
      tag="ADR-0009 · sec 3, 5"
      width={1700}
      lines={[
        { box: ["struct"], segs: [s("LaneOp::Unshield", SL, true)], note: "one op, lives in the shielded lane", nc: SL },
        { box: ["struct"], segs: [s("  proof           ", FG), s(": ", PUNC), s("Groth16 ", STR), s("(v0)", PUNC)], note: "checked after attesting, before N+1" },
        { box: ["struct"], segs: [s("  notes_anchor    ", FG), s(": ", PUNC), s("bytes32", STR)], note: "∈ notes_root_ring, ≤ N-1" },
        { box: ["struct"], segs: [s("  deposit_anchor  ", FG), s(": ", PUNC), s("bytes32", STR)], note: "∈ deposit_root_ring, ≤ N-2" },
        { box: ["struct"], segs: [s("  nullifiers      ", FG), s(": ", PUNC), s("bytes32[2]", STR)], note: "∉ nullifier_state (v0 set, v2 window)" },
        { box: ["struct"], segs: [s("  out_commitments ", FG), s(": ", PUNC), s("bytes32[2]", STR)], note: "the change notes, still shielded" },
        { box: ["struct"], segs: [s("  fee             ", FG), s(": ", PUNC), s("uint256", STR)] },
        { box: ["struct", "pub"], segs: [s("credit_out      ", VA, true), s(": { recipient: ", PUNC), s("address", VA), s(", value: ", PUNC), s("uint256", VA), s(" }", PUNC)], note: "the only public part", nc: VA },
        { box: ["struct"], segs: [s("  proof asserts   ", PUNC), s("sum(in) == sum(out) + credit_out.value + fee", STR)] },
        { box: ["apply"], segs: [s("block ", VERB), s("N", FG, true), s(" · shielded lane · ", SL), s("apply_lane", FG, true)], note: "reads no account, runs even if the payload is withheld", nc: SL },
        { box: ["apply"], segs: [s("  nullifier_state.add", VERB), s("(op.nullifiers);  ", FG), s("insert", VERB), s("(notes, change);  ", FG), s("credit_outbox.push", VERB), s("(op.credit_out)", FG)] },
        { box: ["pay"], segs: [s("block ", VERB), s("N+1", FG, true), s(" · payload · ", BL), s("pay_outbox()", BL, true)], note: "first thing in the payload", nc: BL },
        { box: ["pay"], segs: [s("  vault −= value;  balance[recipient] += value", FG)], note: "no gas, no code, no user tx", nc: OK },
      ]}
      fontSize={24}
      lh={1.46}
      pad={20}
    />
  </Shell>
);

/* ===== FRAME 4 — inclusion: focil already enforces it ===== */
export const SL_Focil: React.FC = () => (
  <Shell
    accent={SL}
    fig="fig 05/07"
    title="lane inclusion"
    footer="EIP-7805 FOCIL · 16-member committee · 8 KiB per inclusion list"
  >
    <Card
      accent={SL}
      tag="ADR-0010 · sec 7"
      rule={6}
      lines={[
        { segs: [s("committee member ", FG), s("i", SL, true), s(" lists lane op ", FG), s("T", SL, true)], note: "each op is listable by r of 16" },
        { segs: [s("proposer's lane omits ", FG), s("hash(T)", SL, true)] },
        { segs: [s("attesters check, by t=3:", FG)], mt: 14 },
        { segs: [s("    every listed op hash ", FG), s("∈", SL, true), s(" lane", FG)], note: "no proof verified, no state read", nc: OK },
        { segs: [s("    every op body in the lane is available", FG)] },
        { segs: [s("  → block rejected", NO, true)], mt: 6 },
        { segs: [s("and if ", FG), s("T", SL, true), s(" is bad, or conflicts with another op?", FG)] },
        { segs: [s("    it is included anyway and applies as a ", FG), s("no-op", STR)], note: "first in canonical order wins" },
        { segs: [s("  → nobody can make a block invalid through the lane", OK, true)], mt: 6 },
        { segs: [s("own gas budget → ", FG), s("\"block full\"", STR), s(" is per lane", FG)], note: "closes the FOCIL escape hatch", mt: 10 },
      ]}
      fontSize={29}
    />
  </Shell>
);

/* ===== FRAME 5 — the separation property ===== */
export const SL_Writers: React.FC = () => (
  <Shell
    accent={OK}
    fig="fig 03/07"
    title="state writers"
    footer="neither side reads what the other wrote in the same block"
  >
    <Card
      accent={OK}
      tag="ADR-0009"
      rule={6}
      width={1700}
      lines={[
        { segs: [s("structure              writer     the other side reads it", NOTE)] },
        { segs: [s("notes tree + roots     ", FG), s("lane       ", SL, true), s("never", PUNC)], mt: 6 },
        { segs: [s("nullifier set          ", FG), s("lane       ", SL, true), s("never", PUNC)] },
        { segs: [s("credit outbox          ", FG), s("lane       ", SL, true), s("payload, at the start of the next full payload", VA)] },
        { segs: [s("deposit tree + roots   ", FG), s("payload    ", BL, true), s("lane, two blocks late, full payloads only", VA)] },
        { segs: [s("accounts, vault ETH    ", FG), s("payload    ", BL, true), s("never", PUNC)] },
        { segs: [s("shielded_state", SL, true), s("[N] = f( shielded_state[N-1], lane[N], deposit roots ≤ N-2 )", FG)] },
        { segs: [s("    no payload, full, empty or withheld, can change it", OK)], mt: 2 },
        { segs: [s("same shape as the beacon chain and the EVM today:", FG)], mt: 16 },
        { segs: [s("    requests in ", FG), s("(EIP-6110, EIP-7685)", STR), s(", system credits out ", FG), s("(EIP-4895)", STR)] },
      ]}
      fontSize={29}
    />
  </Shell>
);
