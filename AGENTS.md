# AGENTS.md — instructions for coding agents

## What this repo is
`Sakura Planet` (さくら惑星) is a Vite + TypeScript + Three.js demo: an anime-style Japanese
sakura town on a **true spherical mini-planet**. You walk on the curved surface with radial gravity,
or zoom out to orbit the whole planet. Everything is procedural: there are no GLB/HDRI/texture files.

## Run it
```bash
npm i
npm run dev        # http://localhost:41731
npm run build      # type-check + static bundle in dist/
```

## Verify it works
1. The loader ("惑星を生成中…") fades out and the HUD shows six zone buttons.
2. The console prints `sign atlas NN% used` and **no errors**.
3. Keys `1`–`6` jump between zones; `Tab` flies to orbit and back.
4. `npx tsc --noEmit` passes.

Headless screenshots (software GL is slow, so use a fixed timestep):
`/?zone=park&fixedDt=0.05` and `/?mode=orbit&fixedDt=0.05`. In the console,
`sakura.tp(zoneIndex, x, z, yaw)` teleports instantly and `sakura.info()` reports renderer stats.

## Layout
```
src/main.ts          renderer, bloom, walk/orbit cameras, HUD, input, horizon culling
src/planet.ts        radius, sun, terrain height, Frame (local tangent frame on the sphere)
src/world.ts         planet mesh, ring road, neighbourhood filler, world assembly
src/builder.ts       merge-by-material geometry builder (vertex colours)
src/kit.ts           reusable props (houses, shops, poles, lanterns, torii, komainu…)
src/zones/*.ts       one file per zone; layout.ts holds zone frames + terrain shapers
docs/                README screenshots
legacy/single-file/  the earlier single-HTML-file version (kept for reference)
```

## Conventions
- Author zone content in a zone's local `Frame` (`x` right, `z` forward, `y` up) and place it with
  `frame.matrix(x, z, rotY)`. Never assume world +Y is up.
- Long straight structures should be chunked (≈2–3 m pieces) so they follow the curvature.
- Add colliders via `ctx.phys.box/circle/floor` in the same local matrix.
- Keep the point-light count fixed (use `ctx.lights.add`, which feeds the light pool).
