import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { DmarzMark } from "./DmarzMark";

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
const MONO = "ui-monospace, 'SF Mono', Menlo, monospace";
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
type Line = { segs: Seg[]; note?: string; nc?: string; mt?: number };

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
  children: React.ReactNode;
}> = ({ title, footer, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const foot = riseIn(frame, fps, 16);
  return (
    <AbsoluteFill style={{ background: BG, fontFamily: SANS, color: FG }}>
      <div style={{ position: "absolute", top: 84, left: 100, right: 100 }}>
        <div style={{ ...riseIn(frame, fps, 0), fontSize: 72, fontWeight: 600, letterSpacing: -2, lineHeight: 1.15 }}>{title}</div>
      </div>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "200px 100px 150px" }}>{children}</AbsoluteFill>
      <div style={{ position: "absolute", bottom: 70, left: 100, right: 420, transform: foot.transform, opacity: foot.opacity * 0.88, fontFamily: MONO, fontSize: 28, color: FG }}>{footer}</div>
      <DmarzMark right={96} bottom={42} />
    </AbsoluteFill>
  );
};

const CodeLine: React.FC<{ line: Line }> = ({ line }) => (
  <div style={{ display: "flex", alignItems: "baseline", marginTop: line.mt ?? 0 }}>
    <span style={{ whiteSpace: "pre" }}>
      {line.segs.map((seg, i) => (
        <span key={i} style={{ color: seg.c ?? FG, fontWeight: seg.b ? 700 : 400 }}>{seg.t}</span>
      ))}
    </span>
    {line.note ? (
      <span style={{ marginLeft: "auto", paddingLeft: 48, color: line.nc ?? NOTE, fontStyle: "italic", whiteSpace: "pre" }}>{"← " + line.note}</span>
    ) : null}
  </div>
);

const Card: React.FC<{ accent: string; lines: Line[]; rule?: number; fontSize?: number; width?: number; lh?: number; pad?: number }> = ({ accent, lines, rule, fontSize, width, lh, pad }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        ...riseIn(frame, fps, 8),
        width: width ?? 1540,
        background: "rgba(255,255,255,0.022)",
        border: `1px solid ${wA(0.1)}`,
        borderRadius: 18,
        boxShadow: `0 40px 120px rgba(0,0,0,0.4)`,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "16px 22px", borderBottom: `1px solid ${wA(0.07)}` }}>
        <span style={{ width: 11, height: 11, borderRadius: "50%", background: wA(0.16) }} />
        <span style={{ width: 11, height: 11, borderRadius: "50%", background: wA(0.16) }} />
        <span style={{ width: 11, height: 11, borderRadius: "50%", background: accent, opacity: 0.7 }} />
      </div>
      <div style={{ padding: `${pad ?? 40}px 52px`, fontFamily: MONO, fontSize: fontSize ?? 32, lineHeight: lh ?? 1.62 }}>
        {lines.map((line, i) => (
          <div key={i}>
            {rule === i ? <div style={{ height: 1, background: wA(0.1), margin: "20px 0" }} /> : null}
            <CodeLine line={line} />
          </div>
        ))}
      </div>
    </div>
  );
};

/* ===== FRAME 1 — the block: two lanes ===== */
export const SL_Block: React.FC = () => (
  <Shell
    accent={SL}
    title="two lanes, one block"
    footer="the lane commutes with the payload: one writer per structure, nothing read from the same block"
  >
    <Card
      accent={SL}
      rule={12}
      width={1700}
      lines={[
        { segs: [s("block ", VERB), s("N", FG, true), s(" {", PUNC)] },
        { segs: [s("  payload         ", BL, true), s(": ", PUNC), s("ExecutionPayload", STR)], note: "the builder's block", nc: BL },
        { segs: [s("    pay_outbox()  ", FG), s(": ", PUNC), s("credits from earlier lanes, paid first", STR)], note: "like withdrawals, EIP-4895" },
        { segs: [s("    txs[]         ", FG), s(": ", PUNC), s("Deposit", VA), s(" { vault, commitment, value }", FG)], note: "appends to the deposit tree" },
        { segs: [s("                    … every other tx, as today", PUNC)] },
        { segs: [s("  shielded_lane   ", SL, true), s(": ", PUNC), s("ShieldedLane", STR), s(" {", PUNC)], note: "built by the FOCIL committee (16)", nc: SL, mt: 8 },
        { segs: [s("    ops           ", FG), s(": ", PUNC), s("LaneOp[]", STR), s("  = Transfer | Unshield", PUNC)], note: "nullifiers revealed only here" },
        { segs: [s("    anchors       ", FG), s(": ", PUNC), s("notes ≤ ", STR), s("N-1", SL, true), s(", deposits ≤ ", STR), s("N-2", VA, true)], note: "known before the payload exists" },
        { segs: [s("    validity      ", FG), s(": ", PUNC), s("per op. a bad or conflicting op is a no-op", STR)], note: "a lane can't be invalid", nc: OK },
        { segs: [s("    gas           ", FG), s(": ", PUNC), s("gas(lane) ≤ LANE_GAS_LIMIT", STR)], note: "own budget, own base fee" },
        { segs: [s("    fees, tips    ", FG), s(": ", PUNC), s("paid from consumed value", STR)], note: "never reads an account", nc: OK },
        { segs: [s("  } }", PUNC)] },
        { segs: [s("beacon block ", VERB), s("N", FG, true), s(": shielded_lane_root, shielded_state_root", FG), s("[N-1]", SL, true)], note: "root checked one slot late" },
        { segs: [s("writers", VERB), s(": lane → notes, nullifiers, outbox", SL)], note: "one writer each", nc: OK, mt: 4 },
        { segs: [s("         payload → accounts, vault ETH, deposit tree", BL)] },
      ]}
      fontSize={25}
      lh={1.5}
      pad={30}
    />
  </Shell>
);

/* ===== FRAME 2 — what a node keeps ===== */
export const SL_State: React.FC = () => (
  <Shell
    accent={SL}
    title="a ring and a window, nothing else"
    footer="note set and nullifier history live in history and are proven on demand"
  >
    <Card
      accent={SL}
      rule={6}
      lines={[
        { segs: [s("ShieldedState", SL, true), s(" {", PUNC)] },
        { segs: [s("  notes_root_ring      ", FG), s(": ", PUNC), s("bytes32[8192]", STR)], note: "~256 KB, written by the lane only" },
        { segs: [s("  nullifier_window     ", FG), s(": ", PUNC), s("last W blocks", STR)], note: "the leading edge only" },
        { segs: [s("  credit_outbox        ", FG), s(": ", PUNC), s("Credit[]", STR)], note: "paid by the next full payload" },
        { segs: [s("  pending_burn         ", FG), s(": ", PUNC), s("uint256", STR)], note: "lane base fees, debited from the vault" },
        { segs: [s("}", PUNC)] },
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
    title="unshield writes zero account state"
    footer="the lane writes the outbox, the payload pays it a block later. one writer each"
  >
    <Card
      accent={VA}
      rule={9}
      width={1700}
      lines={[
        { segs: [s("LaneOp::Unshield", SL, true), s(" {", PUNC)] },
        { segs: [s("  proof           ", FG), s(": ", PUNC), s("Groth16 ", STR), s("(v0)", PUNC)], note: "checked after attesting, before N+1" },
        { segs: [s("  notes_anchor    ", FG), s(": ", PUNC), s("bytes32", STR)], note: "∈ notes_root_ring, ≤ N-1" },
        { segs: [s("  deposit_anchor  ", FG), s(": ", PUNC), s("bytes32", STR)], note: "∈ deposit_root_ring, ≤ N-2" },
        { segs: [s("  nullifiers      ", FG), s(": ", PUNC), s("bytes32[2]", STR)], note: "∉ nullifier_state (v0 set, v2 window)" },
        { segs: [s("  out_commitments ", FG), s(": ", PUNC), s("bytes32[2]", STR)], note: "the change notes, still shielded" },
        { segs: [s("  fee             ", FG), s(": ", PUNC), s("uint256", STR)] },
        { segs: [s("  credit_out      ", FG), s(": { recipient: ", PUNC), s("address", VA), s(", value: ", PUNC), s("uint256", VA), s(" }", PUNC)], note: "public at the crossing", nc: VA },
        { segs: [s("}  proof asserts  ", PUNC), s("sum(in) == sum(out) + credit_out.value + fee", STR)] },
        { segs: [s("block ", VERB), s("N", FG, true), s("  ", FG), s("apply_lane", FG, true), s("   # reads no account, runs even if the payload is withheld", NOTE)], mt: 10 },
        { segs: [s("  nullifier_state.add", VERB), s("(op.nullifiers);  ", FG), s("insert", VERB), s("(notes, change)", FG)] },
        { segs: [s("  credit_outbox.push", VERB), s("(op.credit_out)", FG)], note: "lane-only write", nc: OK },
        { segs: [s("block ", VERB), s("N+1", FG, true), s("  ", FG), s("pay_outbox()", BL, true), s("   # first thing in the payload", NOTE)], mt: 10 },
        { segs: [s("  vault −= value;  balance[recipient] += value", FG)], note: "no gas, no code, no user tx", nc: OK },
      ]}
      fontSize={25}
      lh={1.5}
      pad={30}
    />
  </Shell>
);

/* ===== FRAME 4 — inclusion: focil already enforces it ===== */
export const SL_Focil: React.FC = () => (
  <Shell
    accent={SL}
    title="focil already enforces it"
    footer="EIP-7805 FOCIL · 16-member committee · 8 KiB per inclusion list"
  >
    <Card
      accent={SL}
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
    title="one writer per structure"
    footer="neither side ever reads what the other wrote in the same block"
  >
    <Card
      accent={OK}
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
