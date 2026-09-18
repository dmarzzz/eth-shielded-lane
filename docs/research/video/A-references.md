# Launch-film references: fintech, crypto, infra

Purpose: a measuring stick for a 24-second three.js explainer. Everything below comes from the actual films (downloaded, frame-sampled at 1 fps, cut-counted with ffmpeg scene detection at threshold 0.3, audio level via volumedetect) or from the studio's own credits page. Where I could not verify something it is marked "unverified" or "not found". No em dashes.

Method notes
- Durations, upload dates and descriptions were scraped from the YouTube watch pages and the X syndication endpoint.
- "cuts" = hard scene changes ffmpeg detected at threshold 0.3 (so slow dissolves and continuous camera moves count as 0).
- "mean vol" = ffmpeg volumedetect mean over the whole file. Around -14 to -19 dB is a normal broadcast-loud music mix; -27 to -35 dB means sparse sound design or near silence.
- Frame sheets live in `scratchpad/research/frames/*.png`; source files in `scratchpad/research/vid/`.

---

## 1. Circle

### 1a. "Introducing Arc" launch film (12 Aug 2025), posted on X
- URL: https://x.com/circle/status/1955246636223135976 (video: https://x.com/circle/status/1955246636223135976/video/1)
- Length: 25.0 s, 24 fps, mastered 3840x2160, 16:9. Posted natively on X, not on Circle's YouTube.
- Cuts: 1 (the only hard cut is to the black legal card at the end). Everything else is one continuous dawn-gradient background with type dissolving over it.
- Sound: mean -35.5 dB, tapering from -32 dB in the first 5 s to -55 dB in the last 5 s. That is a very quiet ambient/sound-design bed, effectively silent for autoplay. No voiceover (unverified by ear, but the level makes VO impossible).
- Shot list (from the 1 fps sheet):
  1. 0 to 2 s: empty gradient. Deep navy top, pale blue band, warm peach horizon line at the bottom. Reads as pre-dawn sky.
  2. 2 to 4 s: "Introducing" small, centered, white sans.
  3. 4 to 6 s: Arc mark (an arch/"A" glyph) + "Arc" wordmark fades in, horizon warms to orange.
  4. 6 to 8 s: "An   Open   Layer 1" with hairline rules between the words that slide together into one line.
  5. 8 to 10 s: "Purpose-Built" arrives via a character-scramble glitch ("Purpose Bu It i"), then settles inside four thin bracket corners.
  6. 10 to 12 s: "Purpose-Built for Stablecoin Finance", "Stablecoin Finance" gets a thin underline.
  7. 12 to 16 s: layout splits: left label "Purpose-Built", a vertical hairline rule, then a six-line feature list on the right: USDC as Native Gas / Built-In FX Engine / Sub-Second Finality / Low, Predictable Fees / Opt-In Privacy / Crosschain Interop. Lines type on one at a time.
  8. 16 to 18 s: thin arc-shaped curves (the logo geometry) sweep across the list.
  9. 18 to 20 s: "Private Testnet / Coming Soon".
  10. 20 to 24 s: Arc logo + "arcnetwork.xyz" over the warm horizon.
  11. 24 to 25 s: hard cut to black legal disclaimer card.
- Typography: one white geometric grotesk throughout, two weights, all set at small-to-medium size with generous letterspacing on labels. On-screen text density is low: never more than one headline or one six-item list on screen.
- Color: two colors only (navy-to-peach gradient + white). No brand blue, no UI.
- Camera language: none. There is no 3D, no product UI, no camera move. It is a typographic ident.
- Credits: none on the post. No studio credited anywhere I could find. Circle's own blog post for the announcement embeds no video: https://www.circle.com/blog/introducing-arc-an-open-layer-1-blockchain-purpose-built-for-stablecoin-finance
- Follow-ups: the Arc public testnet press release (28 Oct 2025) and Arc mainnet press release (16 Sep 2026) embed no video either; mainnet was announced with a live stream on X at @arc. https://www.circle.com/pressroom/circle-launches-arc-public-testnet and https://www.circle.com/pressroom/circle-launches-arc-mainnet-an-economic-operating-system-for-the-internet
- Circle's YouTube "Arc 101: Introduction to Arc" (6 Aug 2026, 7:46) is a talking-head/explainer series, not a launch film: https://www.youtube.com/watch?v=yUG62456UTg
- Verdict: this is the closest comparable in the whole set to a 24-second explainer, and it is pure type on a gradient with near-silent audio.

### 1b. Circle IPO (5 Jun 2025)
- Circle-produced IPO film: not found. Circle's X timeline (syndication scrape) only exposes recent posts; a June 2025 film could not be confirmed.
- NYSE's official bell video: "Circle (NYSE: CRCL) Rings The Opening Bell", 1:43, NYSE channel, 5 Jun 2025. Event coverage, not a brand film. https://www.youtube.com/watch?v=tDX77-VKrbs
- NYSE also posted "Circle Unveils Arc, a Blockchain for Stablecoin Finance" (4:02, 14 Aug 2025), an interview segment. https://www.youtube.com/watch?v=6hZtRXk-0FQ

### 1c. Circle brand motion (YouTube)
- "Money is now open" (21 May 2024), 60 s, 26 cuts, mean -18.7 dB. Live-action anthem: motorbike courier through a city at dawn, apartment doorways, market stalls, a nurse in a corridor, a maker at a bench, aerial city shots. Thin UI chips (payment amounts in USDC) float over live footage in the last third. Final card "Money is now open" then the Circle logo over an aerial. Warm, filmic grade. VO/narration likely (description is written as a manifesto) but unverified. https://www.youtube.com/watch?v=KSToHKLCWgw
- "USDC Powers Open Money" (12 Jun 2024), 15 s cutdown. https://www.youtube.com/watch?v=WzOPBW0in7A
- "Meet Circle" (11 Jul 2023), 30 s corporate explainer, mean -16.4 dB (not frame-inspected). https://www.youtube.com/watch?v=oGplX-iLLTc
- Circle's older in-house rebrand notes (2020, Kristine MacAulay, Sr. Creative Director at Circle): two-ring "programmatic handshake" logo, Poppins Bold headlines. https://www.circle.com/blog/new-breakthroughs-new-momentum-now-circle-has-a-new-look
- USDC identity by Mother Design (published March/April 2026): custom Monument Grotesk wordmark, Baskerville as primary type, Monument Grotesk Mono as secondary, USDC blue plus dollar greens and neon security-strip accents, and a guilloché pattern generator (built with Cotton Design) that outputs static and animated patterns. This is the current motion language for USDC surfaces. https://www.motherdesign.com/work/usdc and https://gdusa.com/mother-design-builds-trust-for-digital-dollar/
- Note: the Arc film uses none of the USDC guilloché language; it is a separate, quieter sub-brand.

---

## 2. Stripe

### 2a. Sessions 2025 product keynote opening (7 May 2025)
- URL: https://www.youtube.com/watch?v=AWXAd2GhHrg (1:12:30 total, first 3 minutes inspected)
- Opening ident: a 3D folded-ribbon/wave object in Stripe's purple-to-orange gradient with "stripe sessions" lockup, roughly 10 s, then a countdown on tilted flat cards (10, 08, 06, 04, 02) over a light grey field, then a wide shot of the Moscone stage and Will Gaybrick. No narrative opening film; the ident goes straight to the stage.
- On-stage product graphics: dark cards with particle-sphere diagrams labeled "AI" and "Stablecoins", set inside the same gradient frame. Speaker slides are text-light.
- Sound: mean -33 dB over the first 3 min (mostly speech).
- Companion: opening keynote (6 May 2025, 49:23) https://www.youtube.com/watch?v=ONIexChUpuw ; Sessions 2026 keynote cut down to 12 minutes https://www.youtube.com/watch?v=8F4XyWYqZi8 ; 2 Oct 2025 product update stream "Launch your own stablecoin, agentic commerce tools, and more" (1:19:23) https://www.youtube.com/watch?v=_Gi3to6aUCQ
- Who produces it: Stripe runs an internal Brand Studio; its own job listings say the Brand Studio's event production covers "the annual tentpole event Stripe Sessions, global events like Stripe Tour". https://stripe.com/jobs/listing/creative-director-brand-experiences/8001909 and https://jobs.generalcatalyst.com/companies/stripe/jobs/41281864-creative-producer-events-brand-studio . No external studio is credited on any Sessions video.
- External studio on the 2026 rebrand: Play (play.studio) designed the product UI system and the data-visualization system (part-to-whole, distributions, geographic dot map + 3D globe, diagrams), expanding "Blurple" into a gradient suite. Credits: ECD Casey Martin, Motion Director Bobby Dazzler, motion designers Larry Brown, Bojan Milinkovic, Xiaoxue Meng, 3D Toby Causton-Ronaldson. Published May 2026. https://www.brandsinmotion.xyz/resource/play-stripe
- Verdict: Stripe does not ship standalone 20 to 30 s product films; launches happen as keynote segments with a house gradient and in-house graphics.

---

## 3. Coinbase, Robinhood, Ramp, Brex, Mercury

### 3a. Coinbase: "System Update" (BUCK + Isle of Any, 2025)
- URLs: https://www.youtube.com/watch?v=SemnKhDNZVU (BUCK's upload, 42 s, 12 May 2025) ; case page https://buck.co/work/coinbase-system-update ; write-up https://www.stashmedia.tv/buck-cracks-the-code-for-coinbase/ ; https://www.brandsinmotion.xyz/resource/buck-coinbase
- Length 42 s, 1 cut. Aired during the NBA playoffs.
- Concept: the Windows blue screen of death "hard reset" of the financial system. Two colors only, blue #-ish and white, everything rendered as ASCII/DOS text. Grayscale animation inputs (cel and 3D) piped through Houdini, C4D, Cavalry and After Effects into procedural character maps.
- Shot list (from sheet): boot text "An update is required" / "Ready >>" ; ASCII particle bursts ; a running figure ; "<<crypto is>>" ; spinning coin ; padlocks ; rows of coin glyphs ; a globe ; "System > Updated / Crypto is: Faster, Secure, Direct, Transparent" ; "The future of money is here." ; "Coinbase".
- Sound: Jamie xx track, sound design Wave (Aaron Reynolds), mean -16.2 dB. No VO.
- Credits: BUCK; agency Isle of Any; EP Justin Harris; GCDs Daniel Oeffinger, Jon Gorman; CD Joyce N. Ho; 2D animation director Anton Thallner; edit Cartel; color Ethos (Sam Howells).
- Also: Coinbase's own 2023 "It's Time to Update the System" (60 s, Mingus "Haitian Fight Song") is the campaign's earlier live-action/typographic spot: https://www.youtube.com/watch?v=VEi7rub0jcs
- Also: "Introducing Base" (23 Feb 2023, 62 s, 4 cuts, mean -14.3 dB). Blue/black, monospace type, typewriter lines "The future is onchain / open source / decentralized / secure / accessible", a grid of quartered-circle logo glyphs, gradient panels "BUILD LENDING / DEXS / NFTS / BRIDGES / STABLECOINS / ANYTHING ON BASE", proof rows "Secured by Ethereum / 10X cheaper / Open Source and Built on the OP Stack / Scaled by Coinbase", ecosystem logo cloud, "Onchain is the new online", "base.org". This is the closest thing in the set to a chain-launch film with a feature list, and it runs 62 s to cover roughly the same list Arc covers in 25 s. https://www.youtube.com/watch?v=khZrWdAOirw

### 3b. Robinhood: "Future Trading" (ManvsMachine, 2025)
- URLs: https://www.youtube.com/watch?v=ivvw5uBvTh4 ("The future of trading is here. On Robinhood.", 30 s, 15 Apr 2025) ; director's cut 33 s on Zelig's channel https://www.youtube.com/watch?v=OPJrRz-Mt5Q ; case page https://mvsm.com/project/future-trading ; Vimeo https://vimeo.com/1094325471
- Length 30 s, 13 cuts, mean -16 dB range. No VO.
- Structure: black open with Robinhood wordmark ; a lone man in a suit standing in a dark particle field holding a phone ; a full trading dashboard (candles, positions, recent orders) fills frame ; three macro inserts each with a one-word label: airflow over a sphere "Fast", jet turbine "Powerful", watch movement "Precise" ; option-chain grid with lime highlight ; the man walking on a mirror-flat horizon at dusk ; candlesticks and price lines composited over landscapes (ridge line as a chart, grass field with USDC and BTC tickers, "+1 LMT" order ticket) ; a triple-monitor desk at sunset ; "Built for the Future" ; Robinhood wordmark with legal text.
- Craft: live action (DP Daniël Bouquet) fused with UI and kinetic type; one accent color (lime) against near-monochrome footage; every UI element is rendered as a real chart, not a mock. Music and sound by Zelig. Edit Toby Heard (Pundersons Gardens), colour George Kyriacou (Black Kite).
- Recognition: One Show 2025 finalist, Brand Impact Awards silver (per ManvsMachine and Communication Arts). https://www.commarts.com/features/manvsmachine
- Gold Card (26 Mar 2024): no dedicated launch film exists on Robinhood's channel. The reveal was the live keynote "Robinhood Presents: The New Gold Standard" (36:53). Opening minutes: dark theatre, gold serif title "The New Gold Standard" with gold light streaks, Vlad Tenev, then a collage of press clippings. https://www.youtube.com/watch?v=eo0AjCbs5Yo ; newsroom https://robinhood.com/us/en/newsroom/the-new-gold-standard-introducing-the-robinhood-gold-card/

### 3c. Ramp: "Introducing Ramp Treasury: Most banks hope you never see this." (22 Jan 2025)
- URL: https://www.youtube.com/watch?v=Lmixruu_ISU
- Length 65 s, 10 cuts, mean -13.3 dB (loudest in the set). Vertical 9:16 composition pillarboxed in a 16:9 upload, so it was cut for social first.
- Structure: "r" on Ramp yellow ; "Ramp Treasury" card with UI chips ("Same-day ACH", "Auto top-up") ; a typographic argument in editorial-serif-vs-grotesk pairs: "For too long, businesses have had to choose" / "Immediate liquidity OR high yield" / "low fees OR compromise!" on textured paper with vintage bank photos ; "So we built business & investment accounts" ; real product UI (Treasury sidebar, $750,000 balance, earnings chart $4,812) ; benefit lines "total liquidity." "Pay bills instantly" "zero fees" "Ramp even works for you in the background" "when there's extra to invest" ; "Welcome to a world without compromise." ; "ramp" logo + "Put your money to work at ramp.com/treasury".
- Craft: mixed-media collage (photocopy textures, halftone, highlighter strokes), one brand color (acid yellow) against black and off-white, heavy kinetic type with word-level emphasis, short UI inserts. VO likely (copy is written as spoken lines) but unverified.
- Design system behind it: Bakken & Baeck's "Bento box" product-graphic system for Ramp (grid, palette, type scales, motion expressions); motion by Usiel Bautista, Remy van der Winden, Calango; CG Robin Barnes; sound Plan 8. https://bakkenbaeck.com/case/ramp
- Verdict: the only film in the set that argues a case before showing the product; 65 s is what that costs.

### 3d. Brex
- No credited launch film found. "Introducing Brex Empower" (13 Apr 2022) is an 8:24 product walkthrough, not a film. https://www.youtube.com/watch?v=DkfYC66rAAU
- Brex AI identity (Studio Freight, debuted at the Brex AI x Finance Summit, Sep 2023): layered undulating-rectangle logomark, custom translucent 3D "unfolding flower" renders, bespoke cuts of Inter and Space Mono, vibrant blue plus Brex orange, dark and light modes. CD Patrick Torres. https://the-brandidentity.com/project/studio-freight-showcase-the-multi-faceted-yet-invisible-nature-of-ai-in-their-identity-for-brex-ai
- Brex core refresh (Studio Freight): curve shape language from the flag logo, Inter with rounded alternates, one definitive orange with a color-blocking ratio system, "seriously optimistic". https://the-brandidentity.com/project/studio-freights-intimate-knowledge-of-brex-drives-its-smart-rebrand
- Gap: if a Brex reference is needed, it is a brand-system reference, not a film reference.

### 3e. Mercury: "Banking Should Do More" (Scholar, 2025)
- URLs: https://helloscholar.com/project/mercury-banking-should-do-more ; https://www.stashmedia.tv/scholar-mercury-know-banking-should-do-more/ ; Motionographer https://motionographer.com/quickie/scholar-mercury-banking-should-do-more/ ; Vimeo https://vimeo.com/1072302876 (30 s, uploaded 3 Apr 2025)
- Length 30 s, 11 cuts, mean -16.3 dB, 30 fps.
- Structure (from sheet): a single purple oil-paint stroke on a pale lilac field becomes a paraglider canopy ; the stroke becomes a river for a rowing crew ; a ski slope ; a diver's arc ; a gymnast's beam ; a climbing wall two figures summit ; the stroke coils into a swirl that resolves to the Mercury mark and wordmark.
- Craft: risograph-textured cel characters (tiny, silhouetted) on oil-paint-stroke environments, seamless match-cuts between sports, one hue family (purple/violet/coral) plus off-white. No UI at all. Music and sound in-house at Scholar (Jay Clarke, Sean Klassen), mix/VO record at LIME (Tom Paolantonio), so a VO exists (unverified by ear).
- Credits: CD Will Johnson, ACD Madison Ellis, AD Jina Kwon, EP Kate Aspell, HoP Nicole Smarsh, producers Kev Jones, Andrew Rindlaub, Caroline Kaczynski, designers Jina Kwon, Vera Babida, Claire Kho, animators Garret Walter, Jee Kim, Olivia Blanc, Ciara Bresnahan, Michael Relth.

---

## 4. Craft ceiling: Apple, Linear, Vercel, Figma

### 4a. Apple
- "iPhone 17 Pro: The most powerful iPhone ever" (60 s, 22 cuts, mean -17.3 dB). https://www.youtube.com/watch?v=TNhX1uR2vO8
  - Structure: extreme macro of the camera plateau in orange, "iPhone 17 PRO" in heavy extended caps, "ALL / PRO" word cards ; then alternating pairs of (product CG detail) + (short label with one word emphasised): "Forged aluminum unibody", "Ceramic Shield 2", "3x better scratch resistance", "A19 PRO" chip, "Vapor-cooled performance" with thermal-map CG, "Breakthrough battery life", "Charge up to 50% in 20 minutes", "All 48MP Fusion rear cameras", "8x optical-quality zoom" (live footage of a woman in a lake at 13/28/100/200 mm), "Center Stage front camera", "Dual Capture video", "Built for Apple Intelligence", three-color lineup, "iPhone 17 Pro / Pro Max", Apple mark.
  - Craft: black background, one hero color (cosmic orange), every label is 2 to 5 words, one label on screen at a time, label typography is the same weight/size throughout with a single bold word. Camera moves are slow pushes and orbits on CG product; humans only appear when a camera feature needs them.
- Apple Event 9 Sep 2025 opening (first 3 min of 1:11:56): a Steve Jobs quote on black ("Design is not just what it looks like and feels like. Design is how it works."), then a fast montage of product details and UI moments (charging ring, Siri remote, Maps, SOS, Digital Crown, Memoji, heart rate, AirPods, Dynamic Island), aerial Apple Park, Tim Cook on the plaza. https://www.youtube.com/watch?v=H3KnMyojEQU
- Craft analysis: 9to5Mac on the invisible transitions (Craig jumping through the floor, pass-through of the camera module into Apple Park). https://9to5mac.com/2023/06/21/apple-keynote-videos-transitions-and-editing/ ; MacObserver on the Sep 2026 "Surprise and Shine" keynote's Bond-style coastline reveal and the variable-aperture "gun barrel" opening, shot on iPhone 18 Pro. https://www.macobserver.com/news/apple-keynote-james-bond-homages/

### 4b. Linear
- "Introducing Linear For Agents" (21 May 2025), 33 s, 0 hard cuts, mean -18.4 dB. https://www.youtube.com/watch?v=sbwOQV5zY34
  - Structure: "Linear for Agents" on black ; a real backlog list with agent avatars (Sentry, Fin, ChatPRD, Codegen, Devin, Charlie, Ranger) in an Assign-to menu ; an issue thread where Codegen replies and opens a PR ; agent directory with Enable buttons ; a Devin thread proposing a fix with code ; cards "Agents for Coding" / "Agents for Triage" / "Linear for Agents" ; Linear logo.
  - The camera glides through real UI in one continuous move; text cards are white on black, a single sans, one line each.
- "Introducing Linear Agent" (24 Mar 2026), 55 s, 2:1 letterbox, mean -27.2 dB (very quiet; sparse sound design). Real UI on a tilted perspective plane in near-black, an "Ask Linear" prompt typed live, results list, a PRD appears, ends "Linear. At your command." https://www.youtube.com/watch?v=mRql2VJ99gM
- "Introducing Linear Releases" (30 Apr 2026), 30 s, 0 cuts, mean -26.8 dB. https://www.youtube.com/watch?v=6dIwFoQ0eVg ; "Introducing Linear Mobile" 54 s https://www.youtube.com/watch?v=xZJZJ7G0J8Y ; "Mobile app redesign" 15 s https://www.youtube.com/watch?v=9IsOcWesym8
- Genre description from a peer (Lago CEO, on why they automated their own launch videos): "No voiceover. No stock footage. No abstract 3D shapes. The camera moves through the real product, one action at a time." https://getlago.com/blog/we-killed-our-motion-design-job
- Made in-house by Linear's design team (no external credits on any of these).

### 4c. Vercel
- Ship 2025 teaser (1 May 2025), 29 s, 0 cuts, mean -16.5 dB. Black liquid-chrome fluid sim that resolves into the Vercel triangle, then "June 25" and "vercel.com/ship" in small white sans. Nothing else on screen. https://www.youtube.com/watch?v=vbhNyRNNYjc
- Ship 2025 opening keynote (25 Jun 2025, 44:32), first 2.5 min: a fully CG short film (a Pixar-style developer at a brownstone desk, a v0 prompt "What can I help you build?", a commute through a stylised NYC, an office with a skyline, then black-chrome Statue of Liberty and skyscraper fragments folding into the triangle), then the Glasshouse stage and Guillermo Rauch with "You can just ship things." Producer/studio not credited. https://www.youtube.com/watch?v=lNmO7fDiyuE ; recap https://vercel.com/blog/vercel-ship-2025-recap

### 4d. Figma
- "All the launches at Config 2025" (7 May 2025), 81 s, 92 cuts (by far the fastest in the set), mean -17.4 dB. Product-name cards on black ("Figma Sites", "Figma Make", "Figma Draw", "Figma Buzz") between bursts of real UI; a saturated, collage-y palette; ends "All in Figma". https://www.youtube.com/watch?v=NHodnYFUT_I
- Config 2025 keynote opening (first 100 s): a countdown of animated glyph tiles on a very wide LED wall, "config" logotype, Dylan Field. https://www.youtube.com/watch?v=5q8YAUTYAyk
- Figma's own process post: condensed Figma Sans for display; glyphs "built from basic shapes" with inner/outer elements that respond to each other; the opening film's frame rate dropped from 60 to 15 fps to feel "handmade"; sound by London studio Sounds Like These, who scored each product launch video and built an ambient "orchestra warming up" countdown; opening film by Copenhagen studio Relay. https://www.figma.com/blog/how-we-shaped-the-visual-identity-for-config-2025/
- Config 2024 opening film with Relay and Chad Colby: one minute, "activation" narrative of shapes touching and transforming. https://www.itsnicethat.com/features/figma-config-2024-identity-graphic-design-spotlight-090724 ; Config 2026 again with Relay. https://www.figma.com/blog/the-visual-identity-behind-config-2026/

---

## 5. Studios that define the genre

### BUCK
- Fintech/crypto piece: Coinbase "System Update" (see 3a). Also the J.P. Morgan Payments creative expression system: Amplitude + Celeste type pairing, J.P. Morgan brown extended with clementine/topaz/blue gradients, straight-line/circle/square linework, metal-and-glass textures with glow, a motion system described as "patient, fluid rhythm that subtly reveals information". GCD Camille Chu, 60+ credits. https://buck.co/work/jpmorgan-payments
- Client list on buck.co/work also includes Cash App (visual identity, taxes, illustration system), Square (restaurant anthem), Bluevine, Bankwest. https://buck.co/work
- Distinctive: technical animation pipelines that turn a single constraint (two colors, ASCII only) into the whole idea.

### ManvsMachine
- Fintech piece: Robinhood "Future Trading" (see 3b). https://mvsm.com/project/future-trading
- Distinctive: lens-based cinematography with CG and UI composited into it; macro physical metaphors (turbine, watch escapement) stand in for product claims; one accent color; the whole spot reads as one grade. Communication Arts profile on their "man and machine" workflow and refusal to substitute AI for lens work. https://www.commarts.com/features/manvsmachine

### Ordinary Folk (Vancouver)
- Crypto pieces: "This is Nouns" (3:04, community-funded via the Nouns treasury, VO Megan Hensley and Jay Preston, music Ambrose Yu, CD Jorge R. Canedo E.) https://www.ordinaryfolk.co/project/this-is-nouns ; DeSo brand videos (1:30 manifesto + explainers, 2022, 3D and 2D geometric, VO Erick David, AD Grace Pedersen) https://www.ordinaryfolk.co/project/deso-brand-videos ; CryptoCubes. https://ordinaryfolk.co/work
- Distinctive: long-form explainer craft (2 to 3 min), many art styles inside one film, humor, always voiced.

### Gunner (Detroit, acquired by Duolingo)
- Fintech piece: Synchrony Bank "The Future" (36 s, agency Giant Spoon). Flat geometric illustration in blue/yellow/coral, a city built from blocks, a plane, a chat bubble "Hi Jane, how can I help?", bar charts, Synchrony logo. VO Ryan Fitzgerald, music Ambrose Yu, design James Noellert. https://legacy.gunner.work/synchrony-bank/
- Distinctive: illustration-first, character-driven, warm; the product is a metaphor, never UI.

### Oddfellows (Portland)
- Infra/web3 pieces: Replit brand anthem (60 s, ECD Colin Trenter, music Joris van Grunsven, sound Cypher; graphic design + intimate footage + generative imagery) https://oddfellows.tv/work/replit ; Iroh (Number 0) web3 brand system (strategy, logo, site, 3D; not a film) https://oddfellows.tv/work/iroh ; Figma "A symbiosis of code and design". https://oddfellows.tv/work
- Distinctive: material-rich mixed media (footage + graphics + generative) for infra brands that want to feel human.

### Giant Ant (Vancouver)
- Fintech piece: KOHO "Metal" (20 s, 2024, directors Eric Pautz and Matthew James, music/sound Jeff Moberg). A 3D origin story for a metal card: reflective renders, the card explored from multiple angles. https://www.giantant.ca/koho-metal
- Crypto piece: Tezos "A Better Blockchain" (2021, agency Blokhaus, VO Carly Walde, music Ambrose Yu, CDs Jay Grandin and Eric Pautz). 3D cubes as the whole visual system. https://www.giantant.ca/tezos-a-better-blockchain
- Distinctive: one object (a card, a cube) carried through an entire spot.

### Others surfaced along the way
- Scholar (LA/NY): Mercury (see 3e).
- Relay (Copenhagen): Figma Config opening films 2024 to 2026 (see 4d).
- Play (London): Stripe UI and data-viz system (see 2a).
- Bakken & Baeck: Ramp product graphic system (see 3c).
- Studio Freight (Ohio): Brex and Brex AI identities (see 3d).
- Mother Design + Cotton Design: USDC identity and guilloché generator (see 1c).
- Aardman: Coinbase "Human Nature" stop-motion series (2025). https://www.animationmagazine.net/2025/07/coinbase-taps-aardman-for-human-nature-crypto-campaign/
- Partizan / Light VFX / Invisible North: Coinbase "Run the Chain" (D&AD 2023 shortlist, 3D). https://www.dandad.org/awards/professional/2023/237369/coinbase-run-the-chain/

---

## Synthesis

### Measured facts across the set

| Film | Length | Hard cuts | Mean vol | UI shown | VO | 3D |
|---|---|---|---|---|---|---|
| Circle Arc (X) | 25 s | 1 | -35.5 dB | no | no | no |
| Linear for Agents | 33 s | 0 | -18.4 dB | real | no | no (camera in flat UI) |
| Linear Agent | 55 s | 0 | -27.2 dB | real, on a 3D plane | no | light |
| Linear Releases | 30 s | 0 | -26.8 dB | real | no | no |
| Vercel Ship teaser | 29 s | 0 | -16.5 dB | no | no | yes (fluid sim) |
| Mercury (Scholar) | 30 s | 11 | -16.3 dB | no | likely | no (2D paint) |
| Robinhood Future Trading (MvsM) | 30 s | 13 | -16 dB | real, composited | no | some |
| BUCK Coinbase System Update | 42 s | 1 | -16.2 dB | no | no | Houdini to ASCII |
| Apple iPhone 17 Pro | 60 s | 22 | -17.3 dB | minimal | no | yes (product CG) |
| Coinbase Introducing Base | 62 s | 4 | -14.3 dB | no | unverified | flat 3D glyphs |
| Ramp Treasury | 65 s | 10 | -13.3 dB | real | likely | no |
| Circle Money is now open | 60 s | 26 | -18.7 dB | overlays on live | likely | no |
| Figma All the launches | 81 s | 92 | -17.4 dB | real | no | no |

### What the best ones all do
1. One visual idea carried end to end. ASCII-only (BUCK), a paint stroke (Scholar), liquid chrome (Vercel), the real UI as the only set (Linear), a dawn gradient (Arc). None of them layer a second concept.
2. Two-color or one-accent palettes. Arc: navy/peach + white. BUCK: blue + white. Ramp: black/off-white + acid yellow. Robinhood: monochrome + lime. Apple: black + cosmic orange. Base: black + blue. The product color is the only color.
3. Very low on-screen text density: one line, or one list, at a time. Apple labels are 2 to 5 words with one bold word. Arc's densest frame is a six-item list. Nobody puts a headline and a list and a UI on screen together.
4. A single typeface, two weights at most. Type is small relative to frame in the quiet films (Arc, Vercel, Linear) and huge only when type is the whole spectacle (Ramp, Apple's "PRO").
5. The 25 to 35 s films are continuous or near-continuous: 0 or 1 hard cuts (Arc, Linear x3, Vercel, BUCK). Cutting rate rises with length: 10 to 13 cuts at 30 to 65 s for narrative spots (Mercury, Robinhood, Ramp), 22 at 60 s for Apple, 92 at 81 s for Figma's recap.
6. Legibility of the claim over spectacle. Even ManvsMachine's most cinematic frames carry a one-word label ("Fast", "Powerful", "Precise"). Figma's own post says the opening film "needed grounding in substance rather than aesthetic spectacle alone".
7. Ends on the wordmark plus a URL, nothing else. Arc: logo + arcnetwork.xyz. Vercel: "June 25" + vercel.com/ship. Base: base.org. Ramp: ramp.com/treasury.
8. Music or sound design carries the piece; no voiceover in the short-form category (Arc, Linear, Vercel, BUCK, Apple, Robinhood). VO appears only in the 60 s+ argumentative or illustrated spots (Ramp, Mercury, Gunner, Ordinary Folk).
9. Real UI, if any, is real. Linear, Ramp, Robinhood and Figma all show the actual product with actual data; the Lago post names it as the Linear rule.
10. Silence is an accepted register for autoplay surfaces. Arc at -35 dB and the Linear 2026 films at -27 dB are built to be watched muted in a feed.

### What none of them do
- None of them use a 3D scene with a moving camera through abstract geometry to explain an infra product. The only 3D in the fintech/infra set is either a fluid sim ident (Vercel teaser), a product-object hero (Apple, KOHO), particle-to-text (BUCK), or a tilted plane the UI sits on (Linear Agent). The "no abstract 3D shapes" rule in the Lago post is a description of the Linear standard, and the launch films from Circle, Coinbase and Stripe conform to it.
- None of them show a diagram of the system (nodes, arrows, blocks, chains). Base, Arc and Stripe all reduce architecture to a word list or a particle sphere.
- None of them show more than one sentence at a time, and none run a sentence longer than about 8 words on screen.
- None of them use multiple typefaces inside a short film (Ramp's serif/grotesk pairing is the only exception, and it is a deliberate "OR" device).
- None of them use gradients as decoration; the one gradient in Arc is the whole environment, and Stripe's is the ident object.
- None of the under-40-second films cut more than once.
- None of them credit a studio in the post itself; credits live only on the studio's own site (BUCK, MvsM, Scholar, Giant Ant, Gunner).
- None of the crypto/infra chain launches (Arc, Base) show a product UI at all; they are typographic manifestos.

### What this means for a 24-second three.js explainer
- Length matches the Arc precedent almost exactly (25 s), and Linear Releases (30 s), Vercel teaser (29 s), Mercury (30 s), Robinhood (30 s).
- At that length the field expects 0 or 1 cuts, one idea, one accent color, one typeface, one line of text at a time, wordmark + URL at the end, and no VO.
- The 3D itself is the risk: nothing in the fintech/infra set uses 3D as an explanatory device. The two ways 3D earns its place in this set are (a) a single hero object rendered with restraint (Apple, KOHO, Vercel's chrome triangle) or (b) 3D as a means to a 2D graphic end (BUCK's Houdini-to-ASCII, Linear's tilted plane). A camera flying through nodes and edges has no precedent here and would read as the category "none of them do".
- Audio for a feed-first piece can be quiet or silent (Arc, Linear), which also removes the mixing cost.

### Watch these five first
1. Circle "Introducing Arc" on X (25 s). The direct comparable: same length, same subject category, pure type on a gradient, near-silent. https://x.com/circle/status/1955246636223135976
2. Linear "Introducing Linear For Agents" (33 s). The house standard for product films: one continuous camera through real UI, no VO, one line of type per card. https://www.youtube.com/watch?v=sbwOQV5zY34
3. BUCK "System Update" for Coinbase (42 s). What a single technical constraint (ASCII, two colors) looks like when it becomes the whole film. https://www.youtube.com/watch?v=SemnKhDNZVU
4. ManvsMachine "Future Trading" for Robinhood (30 s). The ceiling for fintech UI composited into cinematography, one accent color, one-word labels. https://www.youtube.com/watch?v=ivvw5uBvTh4
5. Vercel Ship 2025 teaser (29 s). The one 3D piece in the infra set: a fluid sim that becomes the logo, then two lines of text. https://www.youtube.com/watch?v=vbhNyRNNYjc

Alternates if you want the argumentative register: Ramp Treasury (65 s) https://www.youtube.com/watch?v=Lmixruu_ISU ; Coinbase "Introducing Base" (62 s) https://www.youtube.com/watch?v=khZrWdAOirw ; Apple "iPhone 17 Pro" (60 s) https://www.youtube.com/watch?v=TNhX1uR2vO8

---

## Gaps and unverified items
- No Circle-produced IPO film was found; only the NYSE bell video.
- No studio is credited for the Arc film, the Vercel Ship opening film, or any Stripe Sessions ident.
- Brex has no credited launch film; only identity work by Studio Freight.
- Robinhood Gold Card has no dedicated film; the reveal was a live keynote.
- Voiceover presence was inferred from audio levels and copy style, not confirmed by listening, for Circle "Money is now open", Ramp Treasury, Mercury and Base.
- Typeface identifications inside the films (Arc, Linear, Vercel) are visual reads only and not confirmed.
- KOHO "Metal" downloaded as a 5.5 s loop from the Giant Ant page; the 20 s length comes from their credits page.
