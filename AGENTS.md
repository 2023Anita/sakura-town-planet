# AGENTS.md — instructions for Codex and other coding agents

## What this repo is
`Sakura Town Planet` is a **single-file, fully procedural Three.js scene**: an anime-style
sakura town wrapped around a tiny walkable planet. Everything (signs, petals, faces,
windows, sounds) is generated at runtime — there are no models, textures or audio files.

## Run it (no build step, no install, no API keys)
```bash
npm start            # zero-dependency Node server → http://localhost:5173
# or, without Node:
python3 -m http.server 5173
```
Then open `http://localhost:5173/` in a desktop browser with WebGL.
Do **not** open `index.html` via `file://` — browsers block ES-module imports from disk.

Useful URL flags: `?low` forces the low-quality (mobile) profile.

## Verify it works
1. The start screen button changes from "生成中…" to "点击进入 · Click to start".
2. The browser console prints one line like
   `[sakura] built in … ms · blossoms … · lanterns … · colliders …` and **no errors**.
3. Keys `1`–`7` teleport to the seven showcase scenes.

Headless check (optional):
```bash
npx playwright@1.48 install chromium
node -e "const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage();p.on('console',m=>console.log(m.text()));p.on('pageerror',e=>{console.error(e);process.exit(1)});await p.goto('http://localhost:5173/');await p.waitForTimeout(8000);await b.close()})()"
```

## Layout
```
index.html                  ← the whole app (HTML + CSS + one <script type="module">)
vendor/three.module.min.js  ← three.js r170 (vendored, so no CDN is needed)
vendor/addons/utils/BufferGeometryUtils.js
serve.mjs                   ← tiny static server used by `npm start`
docs/                       ← screenshots for the README
PROMPT.md                   ← the design brief / prompt this project was built from
```

Inside `index.html` the script is organised in sections (search for the banners):
`basics` → `town tangent mapping` → `terrain` → `renderer` → `materials` → `static batching`
→ `canvas art` → `WORLD` (ground, sea, sky, railway, lanterns, furniture, laundry, shops,
sakura) → `TOWN` (station, level crossing, train, streets, alley, harbour, countryside)
→ `CHARACTERS` / `NPCs` → `LIGHT & TIME` → `FX` → `PLAYER` → `AUDIO` → `UI` → `MAIN`.

## Key conventions (keep these when editing)
- **Keep it a single HTML file** plus the vendored three.js. No bundler, no npm runtime deps.
- **No external assets.** New textures must be drawn on a `<canvas>`; new sounds synthesised with Web Audio.
- **Planet coordinates:** the town is authored on a flat map (`x` = east, `z` = south, metres) and wrapped
  onto the sphere (radius `R = 150`) with `place(obj, x, z, rotY, heightAboveGround)` / `worldAt(x, z, y)`.
  The railway is the equator (`z = 0`). Objects far from the town use `orient(obj, frameDir(dir), …)`.
- **Static scenery** is built as normal `THREE.Group`s and passed to `staticize(group)`; `flushStatic()`
  merges everything per material. Only animated things (train, NPCs, gates, boats, laundry) stay live.
- Long straight objects must be **segmented** (≤ 6 m) because the ground curves.
- Night-lit materials go through `mat(color, { emi, e, b })` or `nightify(material)` so the day/night cycle drives them.
- Add colliders with `boxCollider(x, z, rot, halfW, halfD, height)` or `circleCollider(worldPos, r, h)`.
- Performance budget: aim for 60 fps on a mid-range laptop; respect the `LOW` flag for mobile.
