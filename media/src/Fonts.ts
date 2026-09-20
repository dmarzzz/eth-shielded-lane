import { continueRender, delayRender, staticFile } from "remotion";

/**
 * Type for the shielded-lane graphics.
 *
 *   DISPLAY  Doto: a dot-matrix face. Headlines are literally a swarm of dots.
 *   MONO     Space Mono: the instrument text. Quirkier and punkier than a house mono, still 0.61em
 *            wide, so the spec figures keep their columns.
 *
 * Both are OFL, loaded from public/fonts so renders do not depend on the network.
 */
export const DISPLAY = "'Doto', ui-monospace, Menlo, monospace";
export const MONO = "'Space Mono', ui-monospace, 'SF Mono', Menlo, monospace";

const FACES: [string, string, FontFaceDescriptors][] = [
  ["Doto", "fonts/Doto.ttf", { weight: "100 900" }],
  ["Space Mono", "fonts/SpaceMono-Regular.ttf", { weight: "400", style: "normal" }],
  ["Space Mono", "fonts/SpaceMono-Bold.ttf", { weight: "700", style: "normal" }],
  ["Space Mono", "fonts/SpaceMono-Italic.ttf", { weight: "400", style: "italic" }],
  ["Space Mono", "fonts/SpaceMono-BoldItalic.ttf", { weight: "700", style: "italic" }],
];

let started = false;
export const ensureFonts = () => {
  if (started || typeof document === "undefined") return;
  started = true;
  const handle = delayRender("fonts");
  Promise.all(
    FACES.map(([family, file, desc]) => {
      const face = new FontFace(family, `url(${staticFile(file)})`, desc);
      return face.load().then((f) => document.fonts.add(f));
    })
  )
    .then(() => continueRender(handle))
    .catch((e) => {
      console.error(e);
      continueRender(handle);
    });
};
ensureFonts();
