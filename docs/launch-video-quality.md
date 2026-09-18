# What makes an animation launch-video grade for a public company, and where the Shielded Lane film stands

Date: 2026-09-18. Three research tracks feed this: measured references (docs/research/video/A-references.md: 23 films downloaded, sampled at 1 fps, cuts counted, audio levels measured), craft and pipeline (B-craft.md), and public-company process (C-process.md). Every claim below is sourced in those files. Inferences are marked.

## 1. The answer in one paragraph

Launch-video grade is three layers, and the first one is not craft. Genre fit: at 25 to 35 seconds the field (Circle's Arc film, Linear, Vercel, BUCK for Coinbase) ships one visual idea, one accent color, one typeface, one line of text at a time, zero or one hard cut, no voiceover, often near-silence, and ends on a wordmark and URL. Craft: physically based light, color management, 4K, easing discipline, restrained post, sound design, and delivery specs per platform. Compliance: for a stablecoin issuer, a 34-item pre-launch checklist that starts with Reg FD sequencing and ends with a launch-day run sheet, including things a studio will not do by default (claims file, NYDFS legend, third-party mark clearance, flash-rate test). A piece is launch grade when it clears all three. Ours clears parts of the second and almost none of the first and third, and the first is the one that matters most.

## 2. The measured norm (from A-references.md)

| Property | What the best short films do | Shielded Lane film today |
|---|---|---|
| Length | 25 to 33 s (Arc 25, Linear 30 to 33, Vercel 29) | 24 s |
| Hard cuts under 40 s | 0 or 1 | 0 (one continuous camera) |
| Visual ideas | exactly one, carried end to end | one (a block with two lanes) |
| Genre of the idea | typographic manifesto, hero object, fluid ident, real UI | a 3D system diagram: no precedent in the category |
| Palette | one or two colors plus white | rainbow payload, purple, blue, green, amber |
| Typeface | one family, two weights | one mono family |
| On-screen text | one line or one list at a time, under 8 words | 8 to 12 labels visible at once plus a timeline |
| Voiceover | none under 40 s | none |
| Sound | music or sound design; silence accepted (Arc at -35 dB) | silent, no design |
| Ending | wordmark + URL | loops to frame 0 |
| 3D usage | one restrained hero object, or a means to a 2D end | camera through geometry as explanation |

The genre finding is the important one. Nothing in the category uses 3D as an explanatory device, and no launch film shows a system diagram. Circle's own Arc film is 25 seconds of type on a gradient, near-silent, with one cut. Base's launch is a particle sphere and a word list. The explainer we made is a different object from a launch film, and that is fine for its purpose (the thread, ethresear.ch, a deck), but it should not be mistaken for the launch asset.

Watch these five first: Circle "Introducing Arc" (x.com/circle/status/1955246636223135976), Linear "Introducing Linear for Agents" (youtube.com/watch?v=sbwOQV5zY34), BUCK "System Update" for Coinbase (youtube.com/watch?v=SemnKhDNZVU), ManvsMachine "Future Trading" for Robinhood (youtube.com/watch?v=ivvw5uBvTh4), Vercel Ship 2025 teaser (youtube.com/watch?v=vbhNyRNNYjc).

## 3. The craft gap (from B-craft.md)

What the three.js raster pipeline cannot do at all: area-light shadows, multi-bounce global illumination, stacked refraction through several glass layers, true temporally reprojected anti-aliasing. Those are the reasons a studio renders offline (Blender Cycles, Redshift, Octane). Everything else is closable inside Remotion + three.js on a local GPU, and Remotion's headless render already produces frame-accurate output at up to 16x device scale.

Ranked by quality per effort, the changes that would move our film most (effort estimates are the researcher's, marked as such):

1. Color pipeline: AgX or ACES tone mapping, sRGB out, BT.709 flagged in the encode. Hours.
2. HDRI environment lighting on every physical material plus one soft key light and a rim. Half a day.
3. Easing and timing pass: asymmetric curves, anticipation and overshoot, staggered secondaries, explicit holds. One to two days, zero render cost, the biggest perceived jump.
4. 4K master via 2x scale and per-frame supersampling, ProRes 4444 master, platform MP4s derived. Half a day plus render time.
5. Camera language: one dolly with parallax layers and a depth-of-field rack focus. One day.
6. Restrained post: bloom on top highlights only, DOF, vignette, 2 to 3 percent grain, sub-pixel chromatic aberration. Half a day.
7. Type system and label choreography: one family, two weights, 5 to 8 words per card, 150 to 250 ms enters, 36 px floor at 1080. One day.
8. Sound: licensed track, 5 to 8 sparse effects, silence before the reveal, loudness normalized to -14 LUFS, captions. One day plus license.
9. Motion blur on camera moves only, 180 degree shutter. Hours.
10. Glass done properly: transmission material with thickness and attenuation, or a path-traced hero still for the one shot that needs stacked refraction. One to three days.

Studio tier for comparison: Buck from about $100k on 12 to 24 weeks, Giant Ant about $75k, Ordinary Folk about $50k, boutique 3D $5k to $15k per minute, freelance $1k to $5k per minute.

## 4. The compliance gap (from C-process.md)

Things a public stablecoin issuer's video must clear that have nothing to do with how it looks:
- Reg FD sequencing: the press release publishes before the first post; every number in the video already appears in the release or a filing.
- Forward-looking statements rewritten as present-tense fact or covered by a legend; Circle's Arc mainnet release carries a PSLRA legend and an NYDFS disclaimer.
- No implication of FDIC insurance or government backing; GENIUS Act penalties for misleading stablecoin marketing run to $500k per violation; NYDFS requires a legend and seven-year retention of video and script.
- Third-party marks: the Ethereum Foundation's trademark policy is permission-only for logo use; Zcash's is permissive nominative. Our film uses neither logo.
- Accessibility: WCAG 2.2 for video, including the three-flashes-per-second rule, 4.5:1 text contrast across the whole shot, captions per language, audio description or transcript.
- Versioning: 16:9, 1:1, 4:5, 9:16 re-framed not center-cropped; 6, 15, 30, 60 s cuts; silent-with-captions versions; live text layers for localization with 130 to 300 percent expansion headroom.
- Process: legal sign-off at two gates (locked script before storyboards; picture lock before sound and grade), watermarked review links, checksum-matched upload, press kit with masters, stills, GIFs, transcripts, license log.

The full 34-item checklist is in C-process.md.

## 5. Our film, scored

- Genre: an explainer, not a launch film. Score as an explainer: strong. Score as a launch asset: wrong object.
- Craft: raster fresnel, no HDRI, no color management, 1080p, no DOF or motion blur, no sound, default easing on most moves. Roughly items 1 to 9 above all open.
- Compliance: no third-party logos, no numbers that need a claims file except the placeholder state root, no flashing beyond a single seal flash (needs a PEAT pass to confirm), no captions, no cut-downs.

## 6. What to do, in order (my recommendation)

1. Keep the explainer as the explainer. It is the right asset for the thread, ethresear.ch, and a technical deck. Give it the cheap craft wins: color pipeline, HDRI, easing pass, 4K master, sound. That is under a week and roughly doubles perceived quality.
2. If a launch-grade piece is wanted, make a second, separate film in the genre the field actually ships: 25 to 30 seconds, one idea, one accent, one typeface, one line at a time, zero cuts, wordmark and URL. The idea for it is already in the thread: the dashed line between state with MEV and state without. A hero object (one block, one lane lighting up) can carry it, but as a single restrained object, not a diagram.
3. Run the compliance checklist on whichever piece goes public, starting with Reg FD sequencing and the flash test, and keep the claims file.

