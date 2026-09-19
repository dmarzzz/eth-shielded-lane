# Media

Everything the public thread shows, plus the source that draws it.

| Path | What |
|---|---|
| `figures/SL-Hero.png` | The block with its two lanes, 3D still |
| `figures/SL-Block.png` | The block as a typed struct (spec sections 1, 3, 6) |
| `figures/SL-Writers.png` | One writer per structure (ADR-0009) |
| `figures/SL-Unshield.png` | The Unshield op, from lane to system credit (ADR-0009) |
| `figures/SL-Focil.png` | Inclusion by hash, validity per op (ADR-0010) |
| `figures/SL-State.png` | What a node keeps, v2 against EIP-8182 |
| `figures/SL-Timing.png` | Slot timing, built in parallel (ADR-0008, ADR-0011) |
| `films/SL-Film.mp4` | 27.7 s explainer: one slot pair in the life of a block |
| `films/SL-DepositFlow.mp4` | A deposit, block N to block N+2 |
| `films/SL-UnshieldFlow.mp4` | An unshield, block N to block N+1 |

## Source

`src/` holds the [Remotion](https://www.remotion.dev) compositions. They are plain React: the spec figures and the two crossing animations are DOM, the explainer film and the hero are three.js through `@remotion/three`.

To render them, drop the files into a Remotion 4 project with `three@0.160`, `@react-three/fiber@8`, `@react-three/drei@9`, `@react-three/postprocessing@2` and `postprocessing@6`, register each export as a 1920x1080, 30 fps composition, and run for example:

```
npx remotion still  src/index.tsx SL-Writers out/SL-Writers.png --frame=60 --gl=angle
npx remotion render src/index.tsx SL-DepositFlow out/SL-DepositFlow.mp4 --gl=angle
```

`--gl=angle` is required for the three.js compositions in headless Chrome.

The figures follow the draft spec. If the spec changes, the figure text changes with it; a figure that disagrees with `docs/design/spec-draft.md` is a bug.

Licensed CC BY 4.0 with the rest of the repository.
