import React, { createContext, useContext } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { DISPLAY, MONO } from "./Fonts";

/**
 * The juice kit for the shielded-lane graphics: swarm-punk instrument grade.
 *
 *   Field     the painting: two stacked soft-edged color fields (payload indigo over lane violet)
 *             with a breathing seam, a teal wash, and one disciplined vertical zip.
 *   Swarm     a few hundred particles streaming left to right in ribbons, the way blocks do.
 *             It lives behind the glass, so the cards blur it.
 *   Bloom     renders its children again as a bright-pass glow with chromatic fringes.
 *             The sharp copy on top is untouched, so text stays crisp.
 *   Overlay   phosphor scanlines, film grain, vignette, over everything.
 *   glass     white-tinted translucent card with a moving dichroic sheen.
 *   Title     dot-matrix headline with a light band travelling across it.
 *   HudChrome figure index, spec version and the repo URL. Real information only.
 *
 * Rule carried over from the instrument work: motion marks real signals (a tx landing, a state
 * change, a step change). The ambient layer moves slowly and never blinks.
 */

export const VOID = "#03050a";
const AMBER = "#f2b661";

// deterministic hash in [0,1)
const h = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export const Field: React.FC = () => {
  const f = useCurrentFrame();
  const a = Math.sin(f / 150);
  const b = Math.cos(f / 190);
  const seam = 50 + 2.2 * Math.sin(f / 120);
  return (
    <AbsoluteFill style={{ background: VOID, overflow: "hidden" }}>
      {/* upper field: payload indigo */}
      <div style={{ position: "absolute", left: "-6%", right: "-6%", top: "-8%", height: `${seam + 4}%`, background: "radial-gradient(70% 90% at 30% 40%, rgba(64,96,255,0.62), rgba(40,60,190,0.34) 55%, transparent 100%)", filter: "blur(70px)", transform: `translate(${a * 26}px, ${b * 14}px)` }} />
      {/* lower field: lane violet into magenta */}
      <div style={{ position: "absolute", left: "-6%", right: "-6%", bottom: "-10%", height: `${100 - seam + 8}%`, background: "radial-gradient(75% 95% at 68% 62%, rgba(176,84,255,0.6), rgba(120,40,200,0.32) 55%, transparent 100%)", filter: "blur(80px)", transform: `translate(${-a * 30}px, ${-b * 12}px)` }} />
      {/* the seam between them vibrates in teal */}
      <div style={{ position: "absolute", left: "8%", right: "8%", top: `${seam - 3}%`, height: "6%", background: "linear-gradient(90deg, transparent, rgba(60,255,230,0.28), rgba(120,190,255,0.22), transparent)", filter: "blur(38px)", opacity: 0.8 + 0.2 * a }} />
      {/* warm counter-light, low and small */}
      <div style={{ position: "absolute", left: "-4%", bottom: "-12%", width: "34%", height: "38%", background: "radial-gradient(closest-side, rgba(255,150,70,0.22), transparent)", filter: "blur(60px)" }} />
      {/* hold the middle down so the cards sit on calm dark */}
      <AbsoluteFill style={{ background: "radial-gradient(62% 58% at 50% 50%, rgba(3,5,10,0.74), rgba(3,5,10,0.38) 70%, transparent 100%)" }} />
      {/* signal grid */}
      <AbsoluteFill
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(170,200,255,0.06) 0 1px, transparent 1px 48px), repeating-linear-gradient(90deg, rgba(170,200,255,0.06) 0 1px, transparent 1px 48px)",
          backgroundPosition: `${(f * 0.16) % 48}px 0px`,
          WebkitMaskImage: "radial-gradient(80% 75% at 50% 50%, rgba(0,0,0,0.85), transparent 100%)",
          maskImage: "radial-gradient(80% 75% at 50% 50%, rgba(0,0,0,0.85), transparent 100%)",
        }}
      />
      {/* the zip */}
      <div style={{ position: "absolute", left: 46, top: 0, bottom: 0, width: 2, background: "linear-gradient(180deg, transparent, #3cffe6 18%, #3cffe6 82%, transparent)", opacity: 0.55, boxShadow: "0 0 8px #3cffe6, 0 0 24px rgba(60,255,230,0.35)" }} />
    </AbsoluteFill>
  );
};

const SWARM_HUES = ["#7aa2f7", "#c792ea", "#c792ea", "#3cffe6", "#7aa2f7", "#f2b661"];
// The swarm is a gossip mesh: nodes drifting in straight lines, linked to whoever is in range.
// No heads, no tails, no wiggle. Links appear and drop as nodes pass, the way peers do.
export const Swarm: React.FC<{ count?: number; opacity?: number }> = ({ count = 120, opacity = 0.9 }) => {
  const f = useCurrentFrame();
  const W = 1920, H = 1080, R = 170;
  const nodes = Array.from({ length: count }, (_, i) => {
    const ang = h(i + 0.31) * 6.283;
    const sp = 0.12 + 0.34 * h(i + 0.57);
    const x = (((h(i + 0.05) * W + Math.cos(ang) * sp * f) % W) + W) % W;
    const y = (((h(i + 0.77) * H + Math.sin(ang) * sp * f) % H) + H) % H;
    return { x, y, c: SWARM_HUES[Math.floor(h(i + 0.66) * SWARM_HUES.length)], s: 2.2 + 2.6 * h(i + 0.44), hub: h(i + 0.9) > 0.86 };
  });
  const links: React.ReactNode[] = [];
  for (let i = 0; i < count; i++)
    for (let k = i + 1; k < count; k++) {
      const dx = nodes[i].x - nodes[k].x, dy = nodes[i].y - nodes[k].y;
      const d2 = dx * dx + dy * dy;
      if (d2 < R * R) {
        const t = 1 - Math.sqrt(d2) / R;
        links.push(<line key={`${i}-${k}`} x1={nodes[i].x} y1={nodes[i].y} x2={nodes[k].x} y2={nodes[k].y} stroke={nodes[i].c} strokeWidth={0.9} opacity={0.5 * t * t} />);
      }
    }
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity, mixBlendMode: "screen" }}>
      <defs>
        <filter id="jz-swarm" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter="url(#jz-swarm)">
        {links}
        {nodes.map((n, i) => (
          <rect key={i} x={n.x - n.s / 2} y={n.y - n.s / 2} width={n.s} height={n.s} fill={n.hub ? "#ffffff" : n.c} opacity={n.hub ? 0.9 : 0.6} transform={`rotate(45 ${n.x} ${n.y})`} />
        ))}
      </g>
    </svg>
  );
};

// Children render once sharp and again as glow. Glow copies skip the expensive glass blur.
const BloomPass = createContext(false);
export const useBloomPass = () => useContext(BloomPass);
export const Bloom: React.FC<{ children: React.ReactNode; strength?: number }> = ({ children, strength = 1 }) => {
  const bright = "contrast(1.9) brightness(0.82) saturate(2.1)";
  return (
    <>
      <BloomPass.Provider value={true}>
        <AbsoluteFill style={{ filter: `${bright} blur(26px) hue-rotate(-28deg)`, opacity: 0.16 * strength, mixBlendMode: "screen", transform: "translateX(-4px)" }}>{children}</AbsoluteFill>
        <AbsoluteFill style={{ filter: `${bright} blur(26px) hue-rotate(28deg)`, opacity: 0.16 * strength, mixBlendMode: "screen", transform: "translateX(4px)" }}>{children}</AbsoluteFill>
        <AbsoluteFill style={{ filter: `${bright} blur(8px)`, opacity: 0.1 * strength, mixBlendMode: "screen" }}>{children}</AbsoluteFill>
      </BloomPass.Provider>
      <AbsoluteFill>{children}</AbsoluteFill>
    </>
  );
};

export const Overlay: React.FC<{ grain?: number; scan?: number; vignette?: number }> = ({ grain = 0.1, scan = 0.09, vignette = 0.55 }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: "repeating-linear-gradient(0deg, rgba(0,0,0,1) 0 1px, transparent 1px 3px)", opacity: scan, mixBlendMode: "multiply" }} />
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: grain, mixBlendMode: "overlay" }}>
        <filter id="jz-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={f % 97} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#jz-grain)" />
      </svg>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 90% 86% at 50% 48%, transparent 56%, rgba(0,0,0,${vignette}) 100%)` }} />
    </AbsoluteFill>
  );
};

export const glass = (accent: string, bloomPass = false): React.CSSProperties => ({
  background: bloomPass ? "transparent" : "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03)), rgba(5,7,16,0.66)",
  ...(bloomPass ? {} : { backdropFilter: "blur(18px) saturate(170%)", WebkitBackdropFilter: "blur(18px) saturate(170%)" }),
  border: "1px solid rgba(255,255,255,0.18)",
  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.34), inset 1px 0 0 ${accent}66, inset 0 0 70px rgba(255,255,255,0.03), 0 40px 120px rgba(0,0,0,0.62), 0 0 110px ${accent}2e`,
});

// The dichroic top edge plus a slow diagonal sheen across the glass.
export const IrisEdge: React.FC<{ radius?: number }> = ({ radius = 18 }) => {
  const f = useCurrentFrame();
  return (
    <>
      <div style={{ position: "absolute", inset: 0, borderRadius: radius, overflow: "hidden", pointerEvents: "none" }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(112deg, transparent 38%, rgba(140,230,255,0.07) 47%, rgba(255,255,255,0.10) 50%, rgba(200,150,255,0.07) 53%, transparent 62%)", backgroundSize: "260% 100%", backgroundPosition: `${100 - ((f * 0.22) % 200)}% 0` }} />
      </div>
      <div
        style={{
          position: "absolute",
          top: -1,
          left: radius,
          right: radius,
          height: 2,
          background: "linear-gradient(90deg, transparent, #4df3ff 12%, #9b7bff 38%, #ffb86b 62%, #4df3ff 88%, transparent)",
          backgroundSize: "200% 100%",
          backgroundPosition: `${(f * 0.35) % 200}% 0`,
          boxShadow: "0 0 6px rgba(120,220,255,0.45)",
        }}
      />
    </>
  );
};

export const Brackets: React.FC<{ color: string; inset?: number; size?: number; opacity?: number }> = ({ color, inset = -12, size = 22, opacity = 0.85 }) => {
  const common: React.CSSProperties = { position: "absolute", width: size, height: size, opacity, filter: `drop-shadow(0 0 3px ${color})` };
  const w = `2px solid ${color}`;
  return (
    <>
      <div style={{ ...common, top: inset, left: inset, borderTop: w, borderLeft: w }} />
      <div style={{ ...common, top: inset, right: inset, borderTop: w, borderRight: w }} />
      <div style={{ ...common, bottom: inset, left: inset, borderBottom: w, borderLeft: w }} />
      <div style={{ ...common, bottom: inset, right: inset, borderBottom: w, borderRight: w }} />
    </>
  );
};

const QUIET = new Set(["#e8eaed", "#7f8896", "rgba(232,234,237,0.42)", "rgba(232,234,237,0.5)"]);
// Emission for coloured tokens only; neutral text stays crisp.
export const emit = (c?: string, k = 1): string | undefined => (!c || QUIET.has(c) ? undefined : `0 0 ${9 * k}px ${c}40`);

// Dot-matrix headline with a band of light travelling across it.
export const Title: React.FC<{ children: string; size?: number; style?: React.CSSProperties }> = ({ children, size = 76, style }) => {
  const f = useCurrentFrame();
  const pos = 130 - ((f * 0.9 + 40) % 260);
  return (
    <div
      style={{
        fontFamily: DISPLAY,
        fontWeight: 900,
        fontSize: size,
        lineHeight: 1.05,
        letterSpacing: "-0.01em",
        whiteSpace: "pre",
        backgroundImage: "linear-gradient(100deg, #ffffff 0%, #dbe4ff 38%, #6ff7ff 48%, #ffffff 50%, #d9a8ff 52%, #dbe4ff 62%, #ffffff 100%)",
        backgroundSize: "260% 100%",
        backgroundPosition: `${pos}% 0`,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
        filter: "drop-shadow(-1.5px 0 rgba(0,229,255,0.55)) drop-shadow(1.5px 0 rgba(255,64,128,0.4)) drop-shadow(0 0 7px rgba(140,170,255,0.16))",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// Instrument chrome: which figure this is, which spec it was drawn from, and where the spec lives.
export const HudChrome: React.FC<{ fig: string; top?: number; left?: number; right?: number }> = ({ fig, top = 38, left = 100, right = 100 }) => (
  <div style={{ position: "absolute", top, left, right, display: "flex", fontFamily: MONO, fontSize: 17, letterSpacing: "0.14em", textTransform: "uppercase", color: AMBER, textShadow: "0 0 12px rgba(242,182,97,0.6)" }}>
    <span>eth-shielded-lane</span>
    <span style={{ opacity: 0.5, margin: "0 14px" }}>//</span>
    <span>{fig}</span>
    <span style={{ opacity: 0.5, margin: "0 14px" }}>//</span>
    <span>spec v0.2</span>
    <span style={{ marginLeft: "auto", color: "#9fb4e6", textShadow: "0 0 12px rgba(122,162,247,0.5)", textTransform: "none", letterSpacing: "0.06em" }}>github.com/dmarzzz/eth-shielded-lane</span>
  </div>
);

// Amber instrument tag: which part of the spec a figure is drawn from.
export const SpecTag: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 17, letterSpacing: "0.1em", color: AMBER, textShadow: "0 0 12px rgba(242,182,97,0.6)", textTransform: "uppercase" }}>{children}</span>
);

// kept for callers that style a plain headline
export const titleFx: React.CSSProperties = {
  color: "#ffffff",
  textShadow: "-1.2px 0 rgba(0,229,255,0.6), 1.2px 0 rgba(255,64,128,0.45), 0 0 42px rgba(150,175,255,0.45)",
};
