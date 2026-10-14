import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buildWorld } from './world';
import { Player, type MoveInput } from './player';
import { Petals } from './petals';
import { Sky, skyColors } from './sky';
import { R, SUN_DIR, geoDist, terrainHeight } from './planet';
import { smoothstep } from './noise';
import type { ZoneMeta } from './zones/layout';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

function fatal(msg: string) {
  $('loader').classList.add('hidden');
  $('fatal').classList.remove('hidden');
  $('fatal-msg').textContent = msg;
}

type Mode = 'walk' | 'orbit';

async function main() {
  const canvas = $<HTMLCanvasElement>('scene');
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch {
    fatal('WebGL is not available in this browser. Try a recent Chrome, Edge, Firefox or Safari.');
    return;
  }
  const params = new URLSearchParams(location.search);
  let quality: 'high' | 'low' = params.get('quality') === 'low' ? 'low' : 'high';
  renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'high' ? 1.5 : 1));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 3000);
  scene.fog = new THREE.FogExp2(0xcfe8ff, 0.008);

  const sun = new THREE.DirectionalLight(0xfff4e2, 2.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xbfdcff, 0x4a6a3a, 1.0);
  scene.add(hemi);

  const sky = new Sky();
  scene.add(sky.group, sky.atmosphere);

  // ---- build the world (async with progress) ----
  const fill = $('loader-fill'), msg = $('loader-msg');
  const world = await buildWorld((t, m) => {
    fill.style.width = `${Math.round(t * 100)}%`;
    msg.textContent = m;
  });
  scene.add(world.root);

  // Horizon culling: on a small planet anything past the horizon is hidden by the planet itself.
  const chunks: { obj: THREE.Object3D; dir: THREE.Vector3; ang: number }[] = [];
  world.root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m === world.planet || m.name === 'grass') return;
    const bs = (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).boundingSphere : m.geometry.boundingSphere;
    if (!bs) return;
    const c = bs.center.clone().applyMatrix4(m.matrixWorld);
    if (c.length() < R * 0.3) return;
    chunks.push({ obj: m, dir: c.clone().normalize(), ang: bs.radius / R });
  });
  function cullHorizon() {
    const camR = camera.position.length();
    const camDir = camera.position.clone().normalize();
    const ha = Math.acos(Math.min(1, R / camR)) + Math.acos(R / (R + 16));
    for (const ch of chunks) {
      const a = Math.acos(THREE.MathUtils.clamp(ch.dir.dot(camDir), -1, 1));
      ch.obj.visible = a - ch.ang < ha;
    }
  }

  const { gradient } = { gradient: (world.planet.material as THREE.MeshToonMaterial).gradientMap! };
  const player = new Player(gradient, world.phys);
  scene.add(player.model);
  const petals = new Petals(quality === 'high' ? 700 : 350);
  scene.add(petals.mesh);

  // ---- post ----
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.45, 0.5, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---- controls ----
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = R + 14;
  controls.maxDistance = R * 7;
  controls.enablePan = false;
  controls.autoRotateSpeed = 0.45;
  controls.enabled = false;

  let mode: Mode = 'walk';
  let lastZone: ZoneMeta | null = null;
  const camFwd = new THREE.Vector3(1, 0, 0);
  let pitch = 0.32, dist = 6.5;
  const camUp = new THREE.Vector3(0, 1, 0);

  interface Transition { t: number; dur: number; p0: THREE.Vector3; q0: THREE.Quaternion; to: Mode }
  let transition: Transition | null = null;

  const keys = new Set<string>();
  const touch = { x: 0, z: 0, jump: false };
  let idle = 0;

  function walkPose(outPos: THREE.Vector3, outQuat: THREE.Quaternion) {
    const up = player.up;
    const interior = world.phys.isInterior(player.pos);
    const d = interior ? Math.min(dist, 2.4) : dist;
    const pt = interior ? Math.min(pitch, 0.1) : pitch;
    const target = player.pos.clone().addScaledVector(up, interior ? 1.1 : 1.25);
    outPos.copy(target).addScaledVector(up, Math.sin(pt) * d + 0.25).addScaledVector(camFwd, -Math.cos(pt) * d);
    const dir = outPos.clone().normalize();
    const minR = R + terrainHeight(dir) + 0.6;
    if (outPos.length() < minR) outPos.setLength(minR);
    const m = new THREE.Matrix4().lookAt(outPos, target, up);
    outQuat.setFromRotationMatrix(m);
    return target;
  }

  function orbitPose(outPos: THREE.Vector3, outQuat: THREE.Quaternion) {
    const up = player.up.clone();
    outPos.copy(up).multiplyScalar(R * 3.1).addScaledVector(new THREE.Vector3(0, 1, 0), R * 0.9);
    const m = new THREE.Matrix4().lookAt(outPos, new THREE.Vector3(), new THREE.Vector3(0, 1, 0));
    outQuat.setFromRotationMatrix(m);
  }

  function setMode(to: Mode) {
    transition = { t: 0, dur: to === 'orbit' ? 1.8 : 1.9, p0: camera.position.clone(), q0: camera.quaternion.clone(), to };
    controls.enabled = false;
    controls.autoRotate = false;
    mode = to;
    $('btn-mode').textContent = to === 'walk' ? '🪐 Orbit view' : '🚶 Walk here';
  }

  function goToZone(z: ZoneMeta, instant = false) {
    const f = z.frame;
    const p = f.point(z.spawn.x, z.spawn.z, 0);
    const local = f.sub(z.spawn.x, z.spawn.z);
    const fwd = local.fwd.clone().multiplyScalar(Math.cos(z.spawn.yaw)).addScaledVector(local.right, Math.sin(z.spawn.yaw));
    player.teleport(p, fwd);
    camFwd.copy(player.fwd);
    pitch = 0.3;
    dist = 6.5;
    setMode('walk');
    lastZone = null;
    if (instant) {
      transition = null;
      walkPose(camera.position, camera.quaternion);
      camUp.copy(player.up);
    }
  }

  // ---- HUD ----
  const zonesNav = $('zones');
  const zoneBtns: HTMLButtonElement[] = [];
  world.zones.forEach((z, i) => {
    const btn = document.createElement('button');
    btn.className = 'zone-btn';
    btn.innerHTML = `<span class="zone-num">${i + 1}</span><span class="zone-text"><span class="zone-jp">${z.jp}</span><span class="zone-en">${z.en}</span></span>`;
    btn.addEventListener('click', () => goToZone(z));
    zonesNav.appendChild(btn);
    zoneBtns.push(btn);
  });
  const labelsEl = $('labels');
  const labels = world.zones.map((z) => {
    const el = document.createElement('div');
    el.className = 'planet-label';
    el.textContent = z.jp;
    el.addEventListener('click', () => goToZone(z));
    labelsEl.appendChild(el);
    return el;
  });

  const toast = $('toast');
  let toastTimer = 0;
  function showToast(jp: string, en: string) {
    toast.innerHTML = `<div class="t-jp">${jp}</div><div class="t-en">${en}</div>`;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2600);
  }

  $('btn-mode').addEventListener('click', () => {
    if (mode === 'walk') setMode('orbit');
    else landAtScreenCenter();
  });
  function applyQuality() {
    $('btn-quality').textContent = quality === 'high' ? 'High' : 'Low';
    bloom.enabled = quality === 'high';
    renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'high' ? 1.5 : 1));
    const s = quality === 'high' ? 2048 : 1024;
    if (sun.shadow.mapSize.x !== s) {
      sun.shadow.mapSize.set(s, s);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
    onResize();
  }
  $('btn-quality').addEventListener('click', () => {
    quality = quality === 'high' ? 'low' : 'high';
    applyQuality();
  });
  $('btn-help').addEventListener('click', () => {
    $('help').classList.toggle('collapsed');
    $('btn-help').textContent = $('help').classList.contains('collapsed') ? '+' : '–';
  });

  // ---- input ----
  addEventListener('keydown', (e) => {
    if (e.code === 'Tab') {
      e.preventDefault();
      if (mode === 'walk') setMode('orbit');
      else landAtScreenCenter();
      return;
    }
    if (e.code === 'KeyQ') $('btn-quality').click();
    if (/^Digit[1-6]$/.test(e.code)) goToZone(world.zones[Number(e.code.slice(5)) - 1]);
    if (e.code === 'Space') e.preventDefault();
    keys.add(e.code);
    idle = 0;
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  let dragging = false, lastX = 0, lastY = 0, dragId = -1;
  canvas.addEventListener('pointerdown', (e) => {
    idle = 0;
    if (mode !== 'walk') return;
    dragging = true;
    dragId = e.pointerId;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging || e.pointerId !== dragId || mode !== 'walk') return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    camFwd.applyAxisAngle(player.up, -dx * 0.0055).normalize();
    pitch = THREE.MathUtils.clamp(pitch + dy * 0.004, -0.15, 1.25);
  });
  const endDrag = () => (dragging = false);
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', (e) => {
    idle = 0;
    if (mode !== 'walk' || transition) return;
    dist = THREE.MathUtils.clamp(dist * (1 + Math.sign(e.deltaY) * 0.12), 2.5, 16);
    if (dist >= 16 && e.deltaY > 0) setMode('orbit');
  }, { passive: true });

  const raycaster = new THREE.Raycaster();
  function landAt(ndc: THREE.Vector2) {
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObject(world.planet, false)[0];
    let p: THREE.Vector3;
    if (hit) p = hit.point;
    else p = camera.position.clone().normalize().multiplyScalar(R);
    const up = p.clone().normalize();
    const camUpT = camera.up.clone().applyQuaternion(camera.quaternion);
    const fwd = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).addScaledVector(up, -camUpT.dot(up));
    if (fwd.lengthSq() < 1e-4) fwd.set(1, 0, 0);
    player.teleport(p, fwd);
    camFwd.copy(player.fwd);
    dist = 6.5;
    pitch = 0.3;
    setMode('walk');
  }
  function landAtScreenCenter() {
    landAt(new THREE.Vector2(0, 0));
  }
  canvas.addEventListener('dblclick', (e) => {
    if (mode !== 'orbit' || transition) return;
    landAt(new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1));
  });

  // touch joystick
  const stick = $('stick'), knob = $('stick-knob');
  let stickId = -1;
  const stickMove = (e: PointerEvent) => {
    const r = stick.getBoundingClientRect();
    let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    touch.x = x;
    touch.z = -y;
    knob.style.transform = `translate(${x * 36}px, ${y * 36}px)`;
  };
  stick.addEventListener('pointerdown', (e) => {
    stickId = e.pointerId;
    stick.setPointerCapture(e.pointerId);
    stickMove(e);
  });
  stick.addEventListener('pointermove', (e) => e.pointerId === stickId && stickMove(e));
  const stickEnd = () => {
    stickId = -1;
    touch.x = touch.z = 0;
    knob.style.transform = '';
  };
  stick.addEventListener('pointerup', stickEnd);
  stick.addEventListener('pointercancel', stickEnd);
  $('btn-jump').addEventListener('pointerdown', () => (touch.jump = true));

  function onResize() {
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
    composer.setPixelRatio(renderer.getPixelRatio());
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', onResize);

  // ---- start ----
  const startZone = world.zones.find((z) => z.id === params.get('zone')) ?? world.zones[0];
  goToZone(startZone);
  transition = null;
  {
    const p = new THREE.Vector3(), q = new THREE.Quaternion();
    walkPose(p, q);
    camera.position.copy(p);
    camera.quaternion.copy(q);
  }
  if (params.get('mode') === 'orbit') {
    mode = 'orbit';
    const p = new THREE.Vector3(), q = new THREE.Quaternion();
    orbitPose(p, q);
    camera.position.copy(p);
    camera.quaternion.copy(q);
    camera.up.set(0, 1, 0);
    controls.target.set(0, 0, 0);
    controls.enabled = true;
    controls.update();
    $('btn-mode').textContent = '🚶 Walk here';
  }
  applyQuality();

  $('hud').classList.remove('hidden');
  const loader = $('loader');
  loader.classList.add('fade');
  setTimeout(() => loader.classList.add('hidden'), 900);

  // ---- loop ----
  const fixedDt = Number(params.get('fixedDt') ?? 0);
  let lastNow = performance.now();
  let elapsed = 0;
  const lastPlayer = player.pos.clone();
  const moved = new THREE.Vector3();
  let fpsFrames = 0, fpsTime = 0, slowSeconds = 0;
  const tmpP = new THREE.Vector3(), tmpQ = new THREE.Quaternion();
  const proj = new THREE.Vector3();

  function frame() {
    const now = performance.now();
    const realDt = (now - lastNow) / 1000;
    const dt = fixedDt > 0 ? fixedDt : Math.min(realDt, 0.05);
    lastNow = now;
    elapsed += dt;
    const t = elapsed;
    idle += dt;

    // movement
    const input: MoveInput = {
      x: (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + touch.x,
      z: (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) + touch.z,
      run: keys.has('ShiftLeft') || keys.has('ShiftRight') || Math.hypot(touch.x, touch.z) > 0.95,
      jump: keys.has('Space') || touch.jump,
    };
    touch.jump = false;
    if (mode === 'walk' && !transition) {
      player.update(dt, input, camFwd);
      camFwd.addScaledVector(player.up, -camFwd.dot(player.up)).normalize();
    } else if (mode === 'walk') {
      player.update(dt, { x: 0, z: 0, run: false, jump: false }, camFwd);
    }

    // camera
    if (transition) {
      transition.t += dt / transition.dur;
      const k = Math.min(1, transition.t);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      if (transition.to === 'walk') walkPose(tmpP, tmpQ);
      else orbitPose(tmpP, tmpQ);
      const a = transition.p0.clone(), b = tmpP;
      const ra = a.length(), rb = b.length();
      const ang = a.angleTo(b);
      const bump = Math.sin(Math.PI * e) * Math.min(R * 1.4, ang * R * 0.9);
      const dirA = a.normalize(), dirB = b.clone().normalize();
      const qa = new THREE.Quaternion().setFromUnitVectors(dirA, dirB);
      const dirT = dirA.clone().applyQuaternion(new THREE.Quaternion().slerp(qa, e));
      camera.position.copy(dirT).multiplyScalar(ra + (rb - ra) * e + bump);
      camera.quaternion.copy(transition.q0).slerp(tmpQ, e);
      if (k >= 1) {
        const to = transition.to;
        transition = null;
        if (to === 'orbit') {
          camera.up.set(0, 1, 0);
          controls.target.set(0, 0, 0);
          controls.enabled = true;
          controls.update();
        } else camUp.copy(player.up);
      }
    } else if (mode === 'walk') {
      walkPose(tmpP, tmpQ);
      const s = 1 - Math.exp(-dt * 12);
      camera.position.lerp(tmpP, s);
      camUp.lerp(player.up, s).normalize();
      const target = player.pos.clone().addScaledVector(player.up, world.phys.isInterior(player.pos) ? 1.1 : 1.25);
      camera.up.copy(camUp);
      camera.lookAt(target);
    } else {
      controls.autoRotate = idle > 4;
      controls.update();
    }

    // environment
    const camDir = camera.position.clone().normalize();
    const alt = camera.position.length() - R;
    const space = smoothstep(R * 0.25, R * 1.5, alt);
    const viewDir = mode === 'walk' && !transition ? player.up : camDir;
    const day = viewDir.dot(SUN_DIR);
    sky.update(camera, camDir, day, space);
    const { zen, hor } = skyColors(day);
    (scene.fog as THREE.FogExp2).color.copy(hor);
    (scene.fog as THREE.FogExp2).density = 0.0075 * (1 - space);
    const dayK = smoothstep(-0.3, 0.35, day);
    hemi.color.copy(zen).lerp(new THREE.Color('#ffffff'), 0.45);
    hemi.groundColor.set('#3d5a33').lerp(new THREE.Color('#1a1f3a'), 1 - dayK);
    hemi.intensity = THREE.MathUtils.lerp(1.15, 1.25, dayK) * (1 - space) + 0.55 * space;
    hemi.position.copy(viewDir);
    if (space > 0.5) hemi.color.set('#8fa0d8');
    sun.color.set('#ff9b5e').lerp(new THREE.Color('#fff4e2'), smoothstep(0.0, 0.45, day));
    if (space > 0.5) sun.color.set('#fff4e2');

    // shadows follow the player on the surface, cover the planet from space
    const sc = sun.shadow.camera;
    const focus = space > 0.35 ? new THREE.Vector3() : player.pos;
    const half = space > 0.35 ? R * 1.25 : 42;
    sun.position.copy(focus).addScaledVector(SUN_DIR, 220);
    sun.target.position.copy(focus);
    if (sc.right !== half) {
      sc.left = -half;
      sc.right = half;
      sc.top = half;
      sc.bottom = -half;
      sc.near = 1;
      sc.far = 480;
      sc.updateProjectionMatrix();
    }

    world.lights.update(dt, space > 0.35 ? camera.position : player.pos);
    world.glows.material.uniforms.uTime.value = t;
    world.glows.material.uniforms.uScale.value = (renderer.domElement.height * camera.projectionMatrix.elements[5]) / 2;

    moved.subVectors(player.pos, lastPlayer);
    lastPlayer.copy(player.pos);
    petals.mesh.visible = space < 0.25;
    if (petals.mesh.visible) petals.update(dt, t, player.pos, player.up, moved);

    // zone tracking
    let nearest: ZoneMeta | null = null, best = Infinity;
    for (const z of world.zones) {
      const d = geoDist(player.up, z.center);
      if (d < z.radius && d < best) {
        best = d;
        nearest = z;
      }
    }
    if (nearest !== lastZone) {
      lastZone = nearest;
      zoneBtns.forEach((b, i) => b.classList.toggle('active', world.zones[i] === nearest));
      if (nearest && mode === 'walk') showToast(nearest.jp, nearest.en);
    }

    // orbit labels
    const showLabels = mode === 'orbit' && space > 0.4;
    world.zones.forEach((z, i) => {
      const el = labels[i];
      const facing = z.center.dot(camDir);
      if (!showLabels || facing < 0.2) {
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
        return;
      }
      proj.copy(z.center).multiplyScalar(R + terrainHeight(z.center) + 8).project(camera);
      el.style.opacity = String(Math.min(1, (facing - 0.2) * 3));
      el.style.pointerEvents = 'auto';
      el.style.left = `${((proj.x + 1) / 2) * innerWidth}px`;
      el.style.top = `${((1 - proj.y) / 2) * innerHeight}px`;
    });

    cullHorizon();
    composer.render(dt);

    // fps + auto quality
    fpsFrames++;
    fpsTime += realDt;
    if (fpsTime >= 0.5) {
      const fps = fpsFrames / fpsTime;
      $('fps').textContent = `${Math.round(fps)} fps`;
      if (quality === 'high' && fps < 26 && fixedDt === 0) slowSeconds += fpsTime;
      else slowSeconds = 0;
      if (slowSeconds > 4) {
        quality = 'low';
        applyQuality();
        showToast('軽量モード', 'Switched to Low quality for a smoother frame rate');
        slowSeconds = 0;
      }
      fpsFrames = 0;
      fpsTime = 0;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Debug / automation hooks (used for docs screenshots).
  Object.assign(window, {
    sakura: {
      goto: (i: number) => goToZone(world.zones[i]),
      orbit: () => setMode('orbit'),
      info: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures }),
      state: () => ({ mode, t: transition?.t ?? null, elapsed, cam: camera.position.toArray().map((v) => +v.toFixed(1)), player: player.pos.toArray().map((v) => +v.toFixed(1)) }),
      tp: (i: number, x: number, z: number, yaw: number) => goToZone({ ...world.zones[i], spawn: { x, z, yaw } }, true),
      look: (yaw: number, p: number, d: number) => {
        camFwd.applyAxisAngle(player.up, yaw);
        pitch = p;
        dist = d;
      },
      renderer,
      scene,
      camera,
      pick: (x: number, y: number) => {
        raycaster.setFromCamera(new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1), camera);
        const h = raycaster.intersectObjects(world.root.children, true)[0];
        if (!h) return 'none';
        const g = (h.object as THREE.Mesh).geometry;
        const c = g.attributes.color ? [0, 1, 2].map((k) => g.attributes.color.getComponent(h.face!.a, k).toFixed(2)) : [];
        return `${h.object.name} d=${h.distance.toFixed(1)} color=${c} p=${h.point.toArray().map((v) => v.toFixed(1))}`;
      },
    },
  });
}

main().catch((e) => {
  console.error(e);
  fatal(`Something went wrong while building the planet: ${e?.message ?? e}`);
});
