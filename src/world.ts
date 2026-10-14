import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Builder } from './builder';
import { GlowPoints, LightPool } from './glow';
import { house, isNight, pole, streetLamp, wire, type Ctx } from './kit';
import { createMaterials } from './materials';
import { fbm3, mulberry32, smoothstep } from './noise';
import { Physics } from './physics';
import { Frame, R, ROAD_BAND, dirFromLatLon, terrainHeight } from './planet';
import { Trees } from './trees';
import { inZone, ZONES } from './zones/layout';
import { buildSchool } from './zones/school';
import { buildShopping } from './zones/shopping';
import { buildYokocho } from './zones/yokocho';
import { buildApproach, buildPark } from './zones/shrine';
import { buildStation } from './zones/station';

export interface WorldBuild {
  root: THREE.Group;
  planet: THREE.Mesh;
  phys: Physics;
  glows: GlowPoints;
  glowPoints: THREE.Points;
  lights: LightPool;
  zones: typeof ZONES;
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

function planetMesh(gradient: THREE.Texture) {
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, 96);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-6);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const d = new THREE.Vector3();
  const c = new THREE.Color();
  const grassA = new THREE.Color('#8cc163'), grassB = new THREE.Color('#5f9a4c'), grassC = new THREE.Color('#b5d36d');
  const pink = new THREE.Color('#f3c6d3');
  for (let i = 0; i < pos.count; i++) {
    d.fromBufferAttribute(pos, i).normalize();
    const h = terrainHeight(d);
    pos.setXYZ(i, d.x * (R + h), d.y * (R + h), d.z * (R + h));
    const n1 = fbm3(d.x * 14, d.y * 14, d.z * 14, 3);
    const n2 = fbm3(d.x * 40 + 5, d.y * 40, d.z * 40, 2);
    c.copy(grassA).lerp(grassB, smoothstep(0.35, 0.7, n1)).lerp(grassC, smoothstep(0.62, 0.8, n2) * 0.7);
    c.multiplyScalar(0.9 + h * 0.025);
    if (fbm3(d.x * 22 - 3, d.y * 22, d.z * 22, 2) > 0.66) c.lerp(pink, 0.45);
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradient }));
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.name = 'planet';
  return mesh;
}

/** Ring road + sidewalks around the equator, subdivided across so it hugs the curvature. */
function ringRoad(b: Builder) {
  const N = 900;
  const bands: [string, number, number, number, number][] = [
    ['road', -3.5, 3.5, 0.03, 8],
    ['sidewalk', 3.5, 5.6, 0.045, 3],
    ['sidewalk', -5.6, -3.5, 0.045, 3],
  ];
  for (const [key, a0, a1, y, M] of bands) {
    const pos: number[] = [], nor: number[] = [], uv: number[] = [];
    const d = new THREE.Vector3();
    for (let i = 0; i <= N; i++) {
      const lon = (i / N) * 360;
      const len = (i / N) * Math.PI * 2 * R;
      for (let k = 0; k <= M; k++) {
        const w = a0 + ((a1 - a0) * k) / M;
        dirFromLatLon(((w / R) * 180) / Math.PI, lon, d);
        const r = R + terrainHeight(d) + y;
        pos.push(d.x * r, d.y * r, d.z * r);
        nor.push(d.x, d.y, d.z);
        uv.push(key === 'road' ? k / M : (w - a0) / 2, key === 'road' ? len / 8 : len / 2);
      }
    }
    const idx: number[] = [];
    const S = M + 1;
    for (let i = 0; i < N; i++) {
      for (let k = 0; k < M; k++) {
        const a = i * S + k;
        idx.push(a, a + S, a + 1, a + 1, a + S, a + S + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    b.raw(key, g);
  }
}

/** Residential filler along the ring road and on the hills, plus poles, lamps and trees. */
function filler(mk: () => Ctx, sectors: Ctx[]) {
  const rnd = mulberry32(2024);
  const houses: THREE.Vector3[] = [];
  const sectorOf = (lon: number) => sectors[Math.floor((((lon % 360) + 360) % 360) / (360 / sectors.length))];
  void mk;

  // Houses along the road, both sides, two rows
  for (const side of [-1, 1]) {
    for (const row of [0, 1]) {
      let lon = rnd() * 4;
      while (lon < 360) {
        const w = 6 + rnd() * 2.5, d = 6 + rnd() * 2;
        const f = Frame.at(0, lon, 0);
        const x = side * (6.8 + d / 2 + rnd() * 1.5 + row * 12);
        const z = rnd() * 2;
        const dir = f.dirAt(x, z);
        lon += (((w + 1.5 + rnd() * 3) / R) * 180) / Math.PI;
        if (inZone(dir, w / 2 + 2)) continue;
        if (row === 1 && rnd() < 0.3) continue;
        const ry = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        const base = f.minHeight(x, z, d + 1, w + 1, ry);
        const c = sectorOf(lon);
        house(c, f.matrix(x, z, ry, 0, base), { w, d, floors: rnd() < 0.8 ? 2 : 3, balcony: rnd() < 0.6, gable: rnd() < 0.8 });
        houses.push(dir.clone());
        if (rnd() < 0.5) c.trees.add(rnd() < 0.6 ? 'sakura' : 'round', f.matrix(x + side * (d / 2 + 2.4), z + (rnd() - 0.5) * w * 0.6), 0.85);
      }
    }
  }

  // Utility poles + lamps along the south side of the ring road
  let prev: THREE.Vector3[] | null = null;
  let prevLon = -999;
  for (let lon = 0; lon < 360; lon += 10) {
    const f = Frame.at(0, lon, 0);
    const dir = f.dirAt(-5.2, 0);
    if (inZone(dir, 1)) {
      prev = null;
      continue;
    }
    const c = sectorOf(lon);
    const p = pole(c, f.matrix(-5.2, 0));
    if (prev && lon - prevLon < 11) for (let k = 0; k < 3; k++) wire(c, prev[k], p[k], 0.5);
    prev = p;
    prevLon = lon;
    if (lon % 30 === 20) streetLamp(c, f.matrix(5.1, 0), 0, 0, -Math.PI / 2);
  }

  // Trees scattered over the hills
  const tmp = new THREE.Vector3();
  let placed = 0;
  for (let i = 0; i < 2600 && placed < 520; i++) {
    tmp.set(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1);
    if (tmp.lengthSq() > 1 || tmp.lengthSq() < 0.01) continue;
    tmp.normalize();
    const latM = Math.abs(Math.asin(tmp.y)) * R;
    if (latM < ROAD_BAND + 2.5) continue;
    if (inZone(tmp, 2.5)) continue;
    if (houses.some((h) => h.dot(tmp) > Math.cos(6 / R))) continue;
    const lon = (Math.atan2(tmp.x, tmp.z) * 180) / Math.PI;
    const f = new Frame(tmp, new THREE.Vector3(0, 1, 0).cross(tmp).lengthSq() > 1e-4 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0));
    const r = rnd();
    const kind = r < 0.42 ? 'sakura' : r < 0.78 ? 'round' : 'cedar';
    const c = sectorOf(lon);
    c.trees.add(kind, f.matrix(0, 0, 0, -0.1), 0.8 + rnd() * 0.6, kind === 'sakura');
    placed++;
  }
}

/** Instanced grass tufts and wildflowers over the open hills (no shadows, cheap). */
function grassTufts(gradient: THREE.Texture) {
  const blade = new THREE.ConeGeometry(0.08, 0.5, 3);
  blade.translate(0, 0.22, 0);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const g = blade.clone();
    g.rotateZ((i - 1) * 0.35);
    g.rotateY(i * 2.1);
    parts.push(g);
  }
  const g = mergeGeometries(parts)!;
  const mat = new THREE.MeshToonMaterial({ gradientMap: gradient });
  const count = 5000;
  const mesh = new THREE.InstancedMesh(g, mat, count);
  const rnd = mulberry32(77);
  const d = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const col = new THREE.Color();
  const Y = new THREE.Vector3(0, 1, 0);
  const flowers = ['#ffffff', '#ffe066', '#ff9fc0', '#c3a6ff'];
  let n = 0;
  for (let i = 0; i < count * 3 && n < count; i++) {
    d.set(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1);
    if (d.lengthSq() > 1 || d.lengthSq() < 0.01) continue;
    d.normalize();
    if (Math.abs(Math.asin(d.y)) * R < 6.5) continue;
    if (inZone(d, 0.5)) continue;
    q.setFromUnitVectors(Y, d).multiply(new THREE.Quaternion().setFromAxisAngle(Y, rnd() * 6.28));
    const flower = rnd() < 0.12;
    const k = flower ? 0.7 : 0.7 + rnd() * 0.9;
    s.set(k, k, k);
    m.compose(d.clone().multiplyScalar(R + terrainHeight(d) - 0.05), q, s);
    mesh.setMatrixAt(n, m);
    if (flower) col.set(flowers[Math.floor(rnd() * flowers.length)]);
    else col.setHSL(0.25 + rnd() * 0.06, 0.45, 0.32 + rnd() * 0.12);
    mesh.setColorAt(n, col);
    n++;
  }
  mesh.count = n;
  mesh.computeBoundingSphere();
  mesh.name = 'grass';
  return mesh;
}

export async function buildWorld(progress: (t: number, msg: string) => void): Promise<WorldBuild> {
  const world = createMaterials();
  const { atlas, gradient, mats } = world;
  const phys = new Physics();
  const glows = new GlowPoints();
  const lights = new LightPool(8);
  const root = new THREE.Group();
  const petalBuilder = new Builder();
  const trees = new Trees(petalBuilder, phys);
  const rnd = mulberry32(42);
  const mk = (): Ctx => ({ b: new Builder(), phys, trees, glows, lights, atlas, rnd });

  progress(0.05, '地形を生成中… Shaping the hills');
  await tick();
  const planet = planetMesh(gradient);
  root.add(planet);
  root.add(grassTufts(gradient));

  progress(0.25, '道路を敷設中… Laying the ring road');
  await tick();
  const roadCtx = mk();
  ringRoad(roadCtx.b);
  root.add(roadCtx.b.build(mats, 'road'));

  const steps: [string, (c: Ctx) => void][] = [
    ['校門 School gate', buildSchool],
    ['商店街 Shopping street', buildShopping],
    ['横丁 Yokocho', buildYokocho],
    ['参道 Shrine approach', buildApproach],
    ['公園 Shrine park', buildPark],
    ['駅 Station & train', buildStation],
  ];
  let i = 0;
  for (const [name, fn] of steps) {
    progress(0.3 + (i++ / steps.length) * 0.45, `${name} を建設中…`);
    await tick();
    const c = mk();
    fn(c);
    root.add(c.b.build(mats, name));
  }

  progress(0.8, '住宅街と木々… Neighbourhoods & trees');
  await tick();
  const sectors = Array.from({ length: 12 }, mk);
  filler(mk, sectors);
  sectors.forEach((c, k) => root.add(c.b.build(mats, `filler-${k}`)));
  root.add(trees.build(gradient));
  root.add(petalBuilder.build(mats, 'petals'));

  const glowPoints = glows.build();
  root.add(glowPoints);
  for (const l of lights.lights) root.add(l);

  console.info(`sign atlas ${(atlas.used * 100).toFixed(0)}% used`);
  progress(1, 'できあがり！');
  void isNight;
  return { root, planet, phys, glows, glowPoints, lights, zones: ZONES };
}
