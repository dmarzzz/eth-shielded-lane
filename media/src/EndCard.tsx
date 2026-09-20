import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { DmarzMark } from "./DmarzMark";
import { MONO } from "./Fonts";
import { REPO_QR, REPO_URL } from "./RepoQR";

/**
 * The closing card: "made by" over the dmarz lockup, and a QR code that opens the repo.
 * The QR sits on a light panel with a full quiet zone, dark on light, so any phone camera reads it.
 */
const K = 2.6; // lockup scale
const LOCK_W = 282 * K, LOCK_H = 100 * K;

export const QR: React.FC<{ size: number }> = ({ size }) => {
  const n = REPO_QR.length, quiet = 4;
  const m = size / (n + quiet * 2);
  return (
    <svg width={size} height={size} style={{ borderRadius: 16, display: "block" }}>
      <rect width={size} height={size} fill="#f4f1e8" />
      {REPO_QR.flatMap((row, y) =>
        row.split("").map((c, x) => (c === "1" ? <rect key={`${x}-${y}`} x={(x + quiet) * m} y={(y + quiet) * m} width={m + 0.4} height={m + 0.4} fill="#070a18" /> : null))
      )}
    </svg>
  );
};

export const EndCard: React.FC<{ a?: number; cycleOffset?: number }> = ({ a = 1, cycleOffset = 6.3 }) => (
  <AbsoluteFill style={{ opacity: a, transform: `translateY(${((1 - a) * 10).toFixed(2)}px)`, fontFamily: MONO, color: "#e8eaed" }}>
    <div style={{ position: "absolute", left: 250, top: 330 }}>
      <div style={{ fontSize: 30, letterSpacing: "0.34em", textTransform: "uppercase", color: "#9aa3b5", marginLeft: 8 }}>made by</div>
      <div style={{ position: "relative", width: LOCK_W, height: LOCK_H, marginTop: 34 }}>
        <DmarzMark right={0} bottom={0} scale={K} cycleOffset={cycleOffset} />
      </div>
    </div>
    <div style={{ position: "absolute", left: 1150, top: 300, width: 580, textAlign: "center" }}>
      <div style={{ fontSize: 22, letterSpacing: "0.2em", textTransform: "uppercase", color: "#f2b661", marginBottom: 22 }}>research + spec</div>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <QR size={340} />
      </div>
      <div style={{ fontSize: 21, marginTop: 22, color: "#c9d2e6", whiteSpace: "nowrap" }}>{REPO_URL.replace("https://", "")}</div>
    </div>
  </AbsoluteFill>
);

// Standalone, to look at it and to tack onto other films.
export const SL_EndCard: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#04060b" }}>
      <EndCard a={Math.min(1, f / 8)} cycleOffset={0} />
    </AbsoluteFill>
  );
};
