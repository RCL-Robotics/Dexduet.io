// Interactive 3D playback of DexDuet rollouts (scene files built by tools/viewer/build_scene.py).
import * as THREE from 'three';
import { OrbitControls } from './assets/vendor/OrbitControls.js';

const TASKS = [
  { id: 'a008-pour', name: 'Reorient a bottle' },
  { id: 'a001-pad', name: 'Place a gamepad on a block' },
];
// The scene of the third arm task is built only for the sim / real clip (tools/viewer/capture_real.mjs) and is not deployed.
if (new URLSearchParams(location.search).has('o001')) TASKS.push({ id: 'o001-pour', name: 'Pour into a mug' });
const VIEWS = [
  { id: 'robot', name: 'DexDuet' },
  { id: 'human', name: 'Human' },
  { id: 'both', name: 'Both' },
];
const COL = { bg: 0xf3f4f9, left: 0x35a89a, right: 0x8667d4 };

const root = document.getElementById('viewer');
if (root) {
  const io = new IntersectionObserver((es) => {
    if (es.some((e) => e.isIntersecting)) { io.disconnect(); start(); }
  }, { rootMargin: '600px' });
  io.observe(root);
}

async function load(id) {
  const buf = await (await fetch(new URL(`assets/scenes/${id}.bin`, import.meta.url))).arrayBuffer();
  const n = new DataView(buf).getUint32(0, true);
  const head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, n)));
  const base = 4 + n + ((4 - (n % 4)) % 4);
  const f32 = (o, c) => new Float32Array(buf, base + o, c);
  const u32 = (o, c) => new Uint32Array(buf, base + o, c);
  const i16 = (o, c) => new Int16Array(buf, base + o, c);
  return { head, f32, u32, i16 };
}

function build(data) {
  const { head, f32, u32, i16 } = data;
  const g = { all: new THREE.Group(), robot: [], object: [], demo: [], cell: [], human: [], parts: [] };
  const geoms = head.geoms.map((q) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(f32(q.pos[0], q.pos[1]), 3));
    geo.setIndex(new THREE.BufferAttribute(u32(q.idx[0], q.idx[1]), 1));
    geo.computeVertexNormals();
    return geo;
  });
  const mats = new Map();
  const mat = (color, flat) => {
    const k = color + flat;
    if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.05, flatShading: !!flat }));
    return mats.get(k);
  };
  for (const p of head.parts) {
    const m = new THREE.Mesh(geoms[p.geom], mat(p.color, p.flat));
    m.castShadow = true; m.receiveShadow = true;
    g.all.add(m); g[p.group].push(m); g.parts.push({ mesh: m, track: p.track });
  }
  for (const b of head.boxes) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...b.size), mat(b.color, true));
    m.position.set(...b.pos); m.quaternion.set(...b.quat);
    m.receiveShadow = true; m.castShadow = !!b.cast;
    g.all.add(m); g.cell.push(m);
    if (b.robot) g.robot.push(m);
  }
  g.tracks = f32(head.tracks.off, head.frames * head.tracks.count * 7);
  if (head.human) {
    const h = head.human;
    g.hv = i16(h.verts, h.frames * h.nv * 3);
    for (const [s, side] of ['left', 'right'].entries()) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(h.nv / 2 * 3), 3));
      geo.setIndex(new THREE.BufferAttribute(u32(h.faces[side][0], h.faces[side][1]), 1));
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: COL[side], roughness: 0.7, transparent: true, side: THREE.DoubleSide }));
      m.castShadow = true; m.frustumCulled = false; m.userData.s = s;
      g.all.add(m); g.human.push(m);
    }
  }
  return g;
}

function start() {
  const stage = root.querySelector('.stage');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  stage.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COL.bg);
  const camera = new THREE.PerspectiveCamera(36, 1.6, 0.02, 30);
  camera.up.set(0, 0, 1);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xc9cbd8, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.01; sun.shadow.intensity = 0.4; sun.shadow.radius = 6;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xffffff, 0.6);
  scene.add(fill);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = 0.25; controls.maxDistance = 3.5;
  controls.maxPolarAngle = Math.PI * 0.52;
  controls.enableZoom = false;   // wheel zoom only after a click inside, so the page still scrolls
  renderer.domElement.addEventListener('pointerdown', () => { controls.enableZoom = true; stage.classList.add('used'); });
  stage.addEventListener('pointerleave', () => { controls.enableZoom = false; });

  const bar = root.querySelector('.scrub'), fillEl = bar.firstElementChild, clock = root.querySelector('.clock');
  const pauseBtn = root.querySelector('.pp');
  let cur = null, view = 'robot', t = 0, playing = true, visible = true, last = 0, token = 0;
  const cache = new Map();

  const setView = (v) => {
    view = v;
    if (!cur) return;
    const g = cur.g;
    g.robot.forEach((m) => { m.visible = v !== 'human'; });
    g.object.forEach((m) => { m.visible = v !== 'human'; });
    g.demo.forEach((m) => { m.visible = v === 'human'; });
    g.human.forEach((m) => { m.visible = v !== 'robot'; m.material.opacity = v === 'both' ? 0.6 : 1; m.material.depthWrite = v !== 'both'; m.material.depthTest = v !== 'both'; m.renderOrder = v === 'both' ? 5 : 0; m.castShadow = v === 'human'; });
  };

  const P = new THREE.Vector3(), Q = new THREE.Quaternion(), P2 = new THREE.Vector3(), Q2 = new THREE.Quaternion();
  const pose = () => {
    const { head } = cur.data, g = cur.g, K = head.tracks.count;
    const x = Math.min(t * head.fps, head.frames - 1), i = Math.floor(x), j = Math.min(i + 1, head.frames - 1), a = x - i;
    for (const p of g.parts) {
      const o = (i * K + p.track) * 7, o2 = (j * K + p.track) * 7, T = g.tracks;
      P.set(T[o], T[o + 1], T[o + 2]); P2.set(T[o2], T[o2 + 1], T[o2 + 2]);
      Q.set(T[o + 3], T[o + 4], T[o + 5], T[o + 6]); Q2.set(T[o2 + 3], T[o2 + 4], T[o2 + 5], T[o2 + 6]);
      p.mesh.position.copy(P).lerp(P2, a); p.mesh.quaternion.copy(Q).slerp(Q2, a);
    }
    if (head.human && view !== 'robot') {
      const h = head.human, y = Math.min(t * h.fps, h.frames - 1), u = Math.floor(y), w = Math.min(u + 1, h.frames - 1), b = y - u;
      const half = h.nv / 2, s = h.scale;
      for (const m of g.human) {
        const arr = m.geometry.attributes.position.array, c = m.userData.s * half * 3;
        const A = u * h.nv * 3 + c, B = w * h.nv * 3 + c;
        for (let k = 0; k < half * 3; k++) arr[k] = (g.hv[A + k] * (1 - b) + g.hv[B + k] * b) * s + h.origin[k % 3];
        m.geometry.attributes.position.needsUpdate = true;
        m.geometry.computeVertexNormals();
      }
    }
    const dur = (head.frames - 1) / head.fps;
    fillEl.style.width = `${(100 * t / dur).toFixed(2)}%`;
    clock.textContent = `${t.toFixed(1)} / ${dur.toFixed(1)} s`;
  };

  const frame = (now) => {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.1); last = now;
    if (!cur || !visible) return;
    const dur = (cur.data.head.frames - 1) / cur.data.head.fps;
    if (playing && !dragging) { t += dt; if (t > dur + 0.8) t = 0; }
    const hold = t; t = Math.min(t, dur); pose(); t = hold;
    controls.update();
    renderer.render(scene, camera);
  };

  const resize = () => {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(stage); resize();
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(stage);

  const pick = async (id) => {
    const my = ++token;
    stage.classList.add('loading');
    if (!cache.has(id)) { const data = await load(id); cache.set(id, { data, g: build(data) }); }
    if (my !== token) return;
    if (cur) scene.remove(cur.g.all);
    cur = cache.get(id); scene.add(cur.g.all);
    const { target } = cur.data.head.camera;
    controls.target.set(...target); camera.position.set(target[0] + 0.82, target[1] - 0.5, target[2] + 0.5);
    sun.position.set(target[0] + 0.6, target[1] - 0.5, target[2] + 1.6); sun.target.position.set(...target);
    const sc = sun.shadow.camera; sc.left = sc.bottom = -0.9; sc.right = sc.top = 0.9; sc.near = 0.2; sc.far = 4; sc.updateProjectionMatrix();
    fill.position.set(target[0] + 1.5, target[1] + 1.2, target[2] + 0.8);
    t = 0; setView(view); stage.classList.remove('loading');
  };

  // scrub bar
  let dragging = false;
  const seek = (e) => {
    const r = bar.getBoundingClientRect(), dur = (cur.data.head.frames - 1) / cur.data.head.fps;
    t = dur * Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  };
  bar.addEventListener('pointerdown', (e) => { if (!cur) return; dragging = true; bar.setPointerCapture(e.pointerId); seek(e); });
  bar.addEventListener('pointermove', (e) => { if (dragging) seek(e); });
  bar.addEventListener('pointerup', () => { dragging = false; });
  bar.addEventListener('pointercancel', () => { dragging = false; });
  const setPlaying = (p) => { playing = p; pauseBtn.setAttribute('aria-pressed', String(!p)); pauseBtn.textContent = p ? 'Pause' : 'Play'; };
  pauseBtn.addEventListener('click', () => setPlaying(!playing));

  const mk = (box, items, on) => {
    const btns = items.map((it, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'tab'; b.textContent = it.name; b.setAttribute('aria-pressed', String(i === 0));
      b.addEventListener('click', () => { btns.forEach((x) => x.setAttribute('aria-pressed', String(x === b))); on(it.id); });
      box.append(b); return b;
    });
  };
  mk(root.querySelector('.tabs.task'), TASKS, pick);
  mk(root.querySelector('.tabs.view'), VIEWS, setView);

  // test hook
  window.__viewer = { seek: (s) => { t = s; }, setPlaying, camera, controls, get cur() { return cur; } };
  pick(TASKS[0].id);
  requestAnimationFrame((now) => { last = now; frame(now); });
}
