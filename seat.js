// «Выберите своё место»: план зала сверху + 3D-вид со скамейки (three.js r160, локально)
// Зал по фото: прямые ряды длинных деревянных скамеек со спинками, центральный и боковые проходы,
// светлая плитка, низкая кирпичная стена с белым карнизом, молодые сосны в клумбах вдоль стены, ступени перед сценой.
import * as THREE from './vendor/three.module.min.js';

/* ---------- геометрия (метры). Сцена при z<0, зал z>0, x — вправо со стороны зрителя ---------- */
const ROWS = 22, Z0 = 7.5, DZ = 1.05;
const rowY = k => k < 5 ? k * 0.06 : 0.24 + (k - 4) * 0.28;            // впереди почти ровно, дальше — ступени амфитеатра
const BENCH = 1.75, GAP = 0.15, PER = 3;                               // скамья на 3 места
const HALL_W = 21.5;
const BLOCKS = [[-20, -1.6, 'Л'], [1.6, 20, 'П']];                     // слева и справа от центрального прохода
const HALL_END = Z0 + (ROWS - 1) * DZ + 2.2, TOP = rowY(ROWS - 1);
const seats = [], benches = [];
for (let k = 0; k < ROWS; k++) {
  const z = Z0 + k * DZ, y = rowY(k); let num = 0;
  BLOCKS.forEach(([x0, x1, name]) => {
    const n = Math.floor((x1 - x0 + GAP) / (BENCH + GAP)), used = n * BENCH + (n - 1) * GAP, start = x0 + (x1 - x0 - used) / 2;
    for (let b = 0; b < n; b++) {
      const bx0 = start + b * (BENCH + GAP); benches.push({ x: bx0 + BENCH / 2, z, y });
      for (let q = 0; q < PER; q++) { num++; seats.push({ x: bx0 + (q + 0.5) * BENCH / PER, z, y, row: k + 1, sec: name, num }); }
    }
  });
}
const ZONES = [{ n: 'ПАРТЕР', r: [1, 6], p: 3500, c: '#F7DDD3' }, { n: 'СЕРЕДИНА', r: [7, 14], p: 2500, c: '#F5E8CF' }, { n: 'АМФИТЕАТР', r: [15, 22], p: 1800, c: '#E2EBD3' }];
const zoneOf = s => ZONES.find(z => s.row >= z.r[0] && s.row <= z.r[1]);
let sd2 = 42; const r2 = () => (sd2 = (sd2 * 16807) % 2147483647) / 2147483647;
seats.forEach(s => { s.busy = r2() < (s.row < 7 ? 0.78 : s.row < 15 ? 0.66 : 0.48); });
const yAt = z => rowY(Math.max(0, Math.min(ROWS - 1, Math.round((z - Z0) / DZ))));
// молодые сосны в клумбах у стен, выше к задней стене
const pines = [];
for (let z = 12; z < HALL_END - 2; z += 6.2) [-1, 1].forEach(sd => pines.push({ x: sd * (HALL_W - 0.9), z, y: yAt(z), h: 3.8 + ((z * 7) % 3) * 0.5 }));
for (let x = -17; x <= 17; x += 6.8) pines.push({ x, z: HALL_END - 0.9, y: TOP, h: 4 + ((x * 3 + 40) % 3) * 0.5 });

/* ---------- план сверху (SVG) ---------- */
const S = 12.5, OX = 300, OY = 96;
const P = (x, z) => [OX + x * S, OY + z * S];
const plan = document.getElementById('seatPlan');
const NS = 'http://www.w3.org/2000/svg';
const el = (t, a, p = plan) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); p.appendChild(e); return e; };
{ // плитка зала, центральный проход, стена
  const [x0, y0] = P(-HALL_W, 3), [x1, y1] = P(HALL_W, HALL_END);
  el('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, fill: '#ECE7DE' });
  const [ax0, ay0] = P(-1.6, Z0 - 0.8), [ax1] = P(1.6, 0); el('rect', { x: ax0, y: ay0, width: ax1 - ax0, height: y1 - ay0, fill: '#F6F2EA' });
  el('path', { d: `M${x0} ${y0} V${y1} H${x1} V${y0}`, fill: 'none', stroke: '#C9563F', 'stroke-width': 8, 'stroke-linejoin': 'round' });
}
{ // сцена и ступени
  const [x0, y0] = P(-9, -6), [x1, y1] = P(9, 2); el('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, fill: '#FBF8F1', stroke: '#E2DBCD', 'stroke-width': 2 });
  for (let i = 0; i < 3; i++) { const [sx0, sy0] = P(-8 + i * 0.6, 2 + i * 0.75), [sx1, sy1] = P(8 - i * 0.6, 2 + (i + 1) * 0.75);
    el('rect', { x: sx0, y: sy0, width: sx1 - sx0, height: sy1 - sy0, fill: i % 2 ? '#F3EFE7' : '#FFFFFF', stroke: '#E2DBCD', 'stroke-width': 1 }); }
  const [rx0, ry0] = P(-11, -7.5), [rx1] = P(11, 0); el('path', { d: `M${rx0} ${ry0} H${rx1} L${rx1 - 10} ${ry0 + 24} H${rx0 + 10}Z`, fill: '#DA6150' });
  const t = el('text', { x: OX, y: ry0 + 17, 'text-anchor': 'middle', fill: '#fff', 'font-family': 'Mayak,Oswald,sans-serif', 'font-weight': 600, 'font-size': 13, 'letter-spacing': 2 }); t.textContent = 'СЦЕНА';
  const [ox0, oy0] = P(-6, -1), [ox1, oy1] = P(6, 2); el('rect', { x: ox0, y: oy0, width: ox1 - ox0, height: oy1 - oy0, fill: '#2B2A33' });
}
ZONES.forEach(z => { const [x0, y0] = P(-HALL_W + 0.3, Z0 + (z.r[0] - 1) * DZ - 0.5), [x1, y1] = P(HALL_W - 0.3, Z0 + (z.r[1] - 1) * DZ + 0.52);
  el('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, fill: z.c }); });
// скамейки (сиденье + спинка)
benches.forEach(b => { const [x, y] = P(b.x - BENCH / 2, b.z - 0.32); el('rect', { x, y, width: BENCH * S, height: 0.62 * S, rx: 2, fill: '#C08A57' });
  const [bx, by] = P(b.x - BENCH / 2, b.z + 0.22); el('rect', { x: bx, y: by, width: BENCH * S, height: 2, fill: '#8E5E33' }); });
for (let k = 0; k < ROWS; k += 3) { const [x, y] = P(0, Z0 + k * DZ + 0.15); const t = el('text', { x, y, 'text-anchor': 'middle', fill: '#B9A992', 'font-size': 8, 'font-family': 'Inter,Arial' }); t.textContent = k + 1; }
const gBusy = el('g', {}); seats.forEach(st => { if (!st.busy) return; const [x, y] = P(st.x, st.z); el('circle', { cx: x.toFixed(1), cy: (y + 0.5).toFixed(1), r: 2.2, fill: '#5A4636', opacity: .55 }, gBusy); });
// сосны в клумбах вдоль стены
pines.forEach(p => { const [x, y] = P(p.x, p.z); const g = el('g', { transform: `translate(${x} ${y})` });
  el('rect', { x: -10, y: 6, width: 20, height: 7, rx: 2, fill: '#D9D1C4' }, g);
  el('path', { d: 'M0 -15 L7 -6 H4 L9 1 H5 L10 8 H1.6 V12 H-1.6 V8 H-10 L-5 1 H-9 L-4 -6 H-7Z', fill: '#2F6B45' }, g);
  el('path', { d: 'M0 -15 L-7 -6 H-4 L-9 1 H-5 L-10 8 H0Z', fill: '#4E8A55' }, g); });
// подписи секторов
BLOCKS.forEach(([x0, x1, name]) => { const [x, y] = P((x0 + x1) / 2, Z0 - 1.25); const t = el('text', { x, y, 'text-anchor': 'middle', fill: '#8A7864', 'font-family': 'Mayak,Oswald,sans-serif', 'font-weight': 600, 'font-size': 12 }); t.textContent = name === 'Л' ? 'ЛЕВАЯ СТОРОНА' : 'ПРАВАЯ СТОРОНА'; });
const defs = el('defs', {}); defs.innerHTML = '<radialGradient id="coneG" gradientUnits="userSpaceOnUse" r="420"><stop offset="0" stop-color="#DA6150" stop-opacity=".55"/><stop offset=".7" stop-color="#DA6150" stop-opacity=".12"/><stop offset="1" stop-color="#DA6150" stop-opacity="0"/></radialGradient>';
const cone = el('path', { fill: 'url(#coneG)', stroke: '#DA6150', 'stroke-width': 1, 'stroke-opacity': .45, 'stroke-dasharray': '4 4', 'pointer-events': 'none' });
const marker = el('g', {}); el('circle', { r: 8, fill: 'none', stroke: '#DA6150', 'stroke-width': 3 }, marker); el('circle', { r: 3.5, fill: '#DA6150' }, marker);
marker.style.transition = 'transform .5s cubic-bezier(.6,0,.2,1)';
const hover = el('circle', { r: 6, fill: '#DA6150', 'fill-opacity': .35, stroke: '#DA6150', 'stroke-width': 2, opacity: 0, 'pointer-events': 'none' });
const tip = el('g', { opacity: 0, 'pointer-events': 'none' }); const tipBg = el('rect', { rx: 8, fill: '#2B2019' }, tip); const tipT = el('text', { fill: '#fff', 'font-size': 12, 'font-family': 'Inter,Arial', 'font-weight': 600 }, tip);

const toPlan = e => { const pt = plan.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const p = pt.matrixTransform(plan.getScreenCTM().inverse()); return { x: (p.x - OX) / S, z: (p.y - OY) / S }; };
const nearest = (x, z, lim = 0.8) => { let b = -1, d = lim; seats.forEach((s, i) => { const dd = Math.hypot(s.x - x, s.z - z); if (dd < d) { d = dd; b = i; } }); return b; };
plan.addEventListener('pointermove', e => { const m = toPlan(e), i = nearest(m.x, m.z); if (i < 0) { hover.setAttribute('opacity', 0); tip.setAttribute('opacity', 0); plan.style.cursor = 'default'; return; }
  const st = seats[i], [x, y] = P(st.x, st.z); hover.setAttribute('cx', x); hover.setAttribute('cy', y); hover.setAttribute('opacity', 1); plan.style.cursor = 'pointer';
  tipT.textContent = st.busy ? `Ряд ${st.row} · место ${st.num} · занято` : `Ряд ${st.row} · место ${st.num} · ${zoneOf(st).p.toLocaleString('ru-RU')} ₽`;
  const w = tipT.getComputedTextLength() + 18, tx = Math.min(Math.max(x - w / 2, 44), 556 - w), ty = y - 34; tipBg.setAttribute('x', tx); tipBg.setAttribute('y', ty); tipBg.setAttribute('width', w); tipBg.setAttribute('height', 24);
  tipT.setAttribute('x', tx + 9); tipT.setAttribute('y', ty + 16); tip.setAttribute('opacity', 1); });
plan.addEventListener('pointerleave', () => { hover.setAttribute('opacity', 0); tip.setAttribute('opacity', 0); });
plan.addEventListener('click', e => { const m = toPlan(e), i = nearest(m.x, m.z); if (i >= 0) pick(i); });

/* ---------- 3D ---------- */
const box = document.getElementById('seatView');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
box.prepend(renderer.domElement);

/* ---- процедурные текстуры ---- */
const cvTex = (w, h, draw, rx = 1, ry = 1) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 8; return t; };
const brickTex = (rx, ry) => cvTex(256, 128, (g, w, h) => { g.fillStyle = '#E8E1D6'; g.fillRect(0, 0, w, h);
  for (let r = 0; r < 8; r++) for (let c = -1; c < 5; c++) { const x = c * 64 + (r % 2) * 32, y = r * 16; const v = 190 + Math.random() * 30 | 0;
    g.fillStyle = `rgb(${v},${70 + Math.random() * 18 | 0},${52 + Math.random() * 12 | 0})`; g.fillRect(x + 2, y + 2, 60, 12); } }, rx, ry);
const paveTex = cvTex(256, 256, (g, w, h) => { g.fillStyle = '#E7E2DA'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(150,140,125,.35)'; g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); }
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(120,110,100,${Math.random() * .08})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }, 14, 12);
const panelTex = cvTex(256, 256, (g, w, h) => { g.fillStyle = '#F7F6F2'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(160,160,165,.5)'; g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); } for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, h); g.stroke(); } }, 6, 3);
const barkTex = cvTex(64, 256, (g, w, h) => { g.fillStyle = '#F4F1EA'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) { g.fillStyle = 'rgba(40,36,32,.85)'; g.fillRect(Math.random() * w * .7, Math.random() * h, 10 + Math.random() * 24, 2 + Math.random() * 3); } }, 1, 1);
const roofTex = cvTex(256, 256, (g, w, h) => { g.fillStyle = '#E2705C'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(150,50,35,.35)'; g.lineWidth = 3;
  for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, h); g.stroke(); } for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); } }, 3, 2);
const skyTex = cvTex(4, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#9CC7E2'); gr.addColorStop(.55, '#CFE4EE'); gr.addColorStop(1, '#F3EBDD'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
const gateTex = cvTex(256, 256, (g, w, h) => { g.fillStyle = '#E9E5DD'; g.fillRect(0, 0, w, h); g.fillStyle = '#FFFFFF';
  [[64, 70], [192, 70], [64, 196], [192, 196]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 54, 0, 7); g.fill(); });
  g.strokeStyle = '#FFFFFF'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6); g.beginPath(); g.moveTo(128, 0); g.lineTo(128, h); g.stroke(); });
const skyEve = cvTex(4, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#C98F86'); gr.addColorStop(.35, '#EFA77C'); gr.addColorStop(.7, '#F8C58A'); gr.addColorStop(1, '#FBE0B0'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
const scene = new THREE.Scene();
scene.background = skyTex; scene.fog = new THREE.Fog('#DDEBEF', 55, 130);
const cam = new THREE.PerspectiveCamera(58, 1, 0.1, 300);
const hemi = new THREE.HemisphereLight('#FFF6E6', '#A9B79A', 1.2); scene.add(hemi);
const sun = new THREE.DirectionalLight('#FFF1D6', 1.7); sun.position.set(-24, 34, 26); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -42, right: 42, top: 42, bottom: -42, near: 1, far: 120 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04; scene.add(sun);
const front = new THREE.DirectionalLight('#FFFFFF', 0.9); front.position.set(6, 12, 40); scene.add(front);
const mat = c => new THREE.MeshLambertMaterial({ color: c });
const flat = c => { const m = new THREE.MeshBasicMaterial({ color: c }); m.toneMapped = false; return m; };
const o = new THREE.Object3D();
// земля и плитка зала
const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), mat('#B9CFA0')); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const hallLen = HALL_END - 3, hall = new THREE.Mesh(new THREE.BoxGeometry(HALL_W * 2, 0.2, hallLen), new THREE.MeshLambertMaterial({ map: paveTex })); hall.receiveShadow = true;
hall.position.set(0, 0.1, 3 + hallLen / 2); scene.add(hall);
// пологий подъём рядов
const tier = new THREE.InstancedMesh(new THREE.BoxGeometry(HALL_W * 2 - 0.4, 1, DZ + 0.01), new THREE.MeshLambertMaterial({ map: paveTex, color: '#F2EFE9' }), ROWS); tier.receiveShadow = true;
for (let k = 0; k < ROWS; k++) { const h = Math.max(0.02, rowY(k)); o.position.set(0, 0.2 + h / 2, Z0 + k * DZ); o.scale.set(1, h, 1); o.updateMatrix(); tier.setMatrixAt(k, o.matrix); }
o.scale.set(1, 1, 1); scene.add(tier);
// сцена: белый корпус, портал, экран с афишей, коралловая крыша, белые ступени
const stage = new THREE.Group(); scene.add(stage);
const body = new THREE.Mesh(new THREE.BoxGeometry(18, 7.5, 8), new THREE.MeshLambertMaterial({ map: panelTex, emissive: '#5E5A54' })); body.castShadow = true; body.receiveShadow = true; body.position.set(0, 3.75, -2); stage.add(body);
const portal = new THREE.Mesh(new THREE.BoxGeometry(12, 5.2, 0.3), flat('#1E1F27')); portal.position.set(0, 3.4, 2.02); stage.add(portal);
for (let i = 0; i < 3; i++) { const h = 1.2 - i * 0.4, st = new THREE.Mesh(new THREE.BoxGeometry(16 - i * 1.2, h, 0.75), mat(i % 2 ? '#F1EDE5' : '#FFFFFF')); st.position.set(0, h / 2 + 0.2, 2.4 + i * 0.75); stage.add(st); }
const poster = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.4), flat('#E89A50')); poster.position.set(0, 3.7, 2.2); stage.add(poster);
new THREE.TextureLoader().load('img/ev_hd/00.jpg', t => { t.colorSpace = THREE.SRGBColorSpace; const a = t.image.width / t.image.height, w = 9, h = 3.4;
  if (a > w / h) { t.repeat.set((w / h) / a, 1); t.offset.set((1 - (w / h) / a) / 2, 0); } else { t.repeat.set(1, a / (w / h)); t.offset.set(0, (1 - a / (w / h)) / 2); }
  poster.material = new THREE.MeshBasicMaterial({ map: t }); poster.material.toneMapped = false; }, undefined, () => {});
const vid = document.createElement('video'); vid.src = 'img/stage_loop.mp4'; vid.muted = true; vid.loop = true; vid.playsInline = true; vid.setAttribute('muted', ''); vid.setAttribute('playsinline', '');
vid.addEventListener('playing', () => { const t = new THREE.VideoTexture(vid); t.colorSpace = THREE.SRGBColorSpace; poster.material = new THREE.MeshBasicMaterial({ map: t }); poster.material.toneMapped = false; }, { once: true });
const tryPlay = () => vid.play().catch(() => {}); tryPlay(); box.addEventListener('pointerdown', tryPlay, { once: true });
for (let i = 0; i < 9; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), flat('#FFE3A0')); l.position.set(-4.4 + i * 1.1, 5.7, 2.25); stage.add(l); }
const roof = new THREE.Mesh(new THREE.BoxGeometry(23, 0.7, 11.5), flat('#DA6150')); roof.castShadow = true; roof.position.set(0, 8.4, -1.2); roof.rotation.x = -0.07; stage.add(roof);
const roofU = new THREE.Mesh(new THREE.PlaneGeometry(22.6, 11.2), new THREE.MeshBasicMaterial({ map: roofTex })); roofU.material.toneMapped = false; roofU.rotation.x = Math.PI / 2 - 0.07; roofU.position.set(0, 8.02, -1.2); stage.add(roofU);
// ферма с прожекторами над порталом и подвесные колонки
const truss = new THREE.Group(); stage.add(truss);
[[0, 6.05], [0, 6.45]].forEach(([, y]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.07, 0.07), mat('#8E9196')); b.position.set(0, y, 2.35); truss.add(b); });
for (let i = 0; i <= 24; i++) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.42, 0.04), mat('#8E9196')); d.position.set(-6.3 + i * 0.525, 6.25, 2.35); d.rotation.z = i % 2 ? 0.7 : -0.7; truss.add(d); }
for (let i = 0; i < 8; i++) { const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.42, 10), mat('#2B2A33')); sp.position.set(-5.2 + i * 1.5, 5.82, 2.5); sp.rotation.x = 0.6; truss.add(sp);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.17, 12), flat('#FFF1C2')); lens.position.set(-5.2 + i * 1.5, 5.68, 2.68); lens.rotation.x = -0.95; truss.add(lens); }
const beams = [];
for (let i = 0; i < 8; i++) { const g = new THREE.ConeGeometry(1.5, 10, 24, 1, true); g.translate(0, -5, 0);
  const bm = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#FFE2A8', transparent: true, opacity: .06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  bm.position.set(-5.2 + i * 1.5, 5.7, 2.65); bm.userData.ph = i * 0.8; stage.add(bm); beams.push(bm); }
[-1, 1].forEach(sd => { for (let j = 0; j < 4; j++) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.42, 0.6), mat('#24232A')); c.position.set(sd * 7.4, 6.6 - j * 0.45, 2.6); c.rotation.x = 0.04 * j; c.castShadow = true; stage.add(c); } });
// наклонные белые пилоны по краям, как у настоящей сцены
[-1, 1].forEach(sd => { const pl = new THREE.Mesh(new THREE.BoxGeometry(1.2, 8.2, 1.4), new THREE.MeshLambertMaterial({ map: panelTex, emissive: '#5E5A54' })); pl.position.set(sd * 9.3, 4, 1.6); pl.rotation.z = sd * 0.06; pl.castShadow = true; stage.add(pl); });
// скамейки по фото: сиденье и высокая спинка из реек, серые металлические боковины
const nB = benches.length, SL = 9, BK = 11;
const slatM = new THREE.InstancedMesh(new THREE.BoxGeometry(BENCH / SL - 0.03, 0.05, 0.5), mat('#9A5A33'), nB * SL);
const backM = new THREE.InstancedMesh(new THREE.BoxGeometry(BENCH / BK - 0.025, 0.62, 0.05), mat('#8C4F2C'), nB * BK);
const sideM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.95, 0.62), mat('#B8BCC2'), nB * 2);
benches.forEach((b, i) => { const by = 0.2 + b.y;
  for (let j = 0; j < SL; j++) { o.position.set(b.x - BENCH / 2 + (j + .5) * BENCH / SL, by + 0.45, b.z - 0.04); o.rotation.set(0, 0, 0); o.updateMatrix(); slatM.setMatrixAt(i * SL + j, o.matrix); }
  for (let j = 0; j < BK; j++) { o.position.set(b.x - BENCH / 2 + (j + .5) * BENCH / BK, by + 0.86, b.z + 0.26); o.rotation.set(-0.16, 0, 0); o.updateMatrix(); backM.setMatrixAt(i * BK + j, o.matrix); }
  [-1, 1].forEach((sd, j) => { o.position.set(b.x + sd * (BENCH / 2 + 0.02), by + 0.46, b.z + 0.05); o.rotation.set(-0.08, 0, 0); o.updateMatrix(); sideM.setMatrixAt(i * 2 + j, o.matrix); });
  o.rotation.set(0, 0, 0); });
[slatM, backM, sideM].forEach(m => { m.castShadow = true; m.receiveShadow = true; }); scene.add(slatM, backM, sideM);
// зрители (пример занятости)
const busy = seats.filter(st => st.busy);
const bodyM = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.19, 0.36, 4, 10), new THREE.MeshLambertMaterial(), busy.length);
const headM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.115, 12, 10), new THREE.MeshLambertMaterial(), busy.length);
const shirt = ['#DA6150', '#5E7FA6', '#F2F0EA', '#7FB069', '#E3B04B', '#8E6FA8', '#3E4A5C', '#E98A79', '#2F6B45', '#C9C2B6'], hair = ['#3B2A22', '#6B4A33', '#A0764E', '#D8B57A', '#2A2A2E', '#C9C2B6'];
const cc = new THREE.Color(); let sd3 = 7; const r3 = () => (sd3 = (sd3 * 16807) % 2147483647) / 2147483647;
busy.forEach((st, i) => { const by = 0.2 + st.y, sc = 0.9 + r3() * 0.2;
  o.position.set(st.x + (r3() - .5) * .06, by + 0.78 * sc, st.z + 0.04); o.rotation.set(-0.05, (r3() - .5) * .3, 0); o.scale.set(sc, sc, sc); o.updateMatrix(); bodyM.setMatrixAt(i, o.matrix); bodyM.setColorAt(i, cc.set(shirt[(r3() * shirt.length) | 0]));
  o.position.set(st.x, by + 1.2 * sc, st.z + 0.02); o.updateMatrix(); headM.setMatrixAt(i, o.matrix); headM.setColorAt(i, cc.set(hair[(r3() * hair.length) | 0])); });
o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); bodyM.castShadow = headM.castShadow = true; scene.add(bodyM, headM);
// кирпичная стена с белым карнизом
const wallMat = new THREE.MeshLambertMaterial({ map: brickTex(1, 0.8) }), capMat = mat('#F8F6F1');
const addWall = (x, z, w, d) => { const h = 1.35; const wl = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat); wl.position.set(x, h / 2, z); scene.add(wl);
  const cp = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.12, d + 0.14), capMat); cp.position.set(x, h + 0.06, z); scene.add(cp); };
for (let k = -3; k < ROWS + 2; k++) { const z = Z0 + k * DZ, h = (k < 0 ? 0 : rowY(Math.min(k, ROWS - 1))) + 1.35;
  [-1, 1].forEach(sd => { const wl = new THREE.Mesh(new THREE.BoxGeometry(0.4, h, DZ + 0.02), wallMat); wl.position.set(sd * HALL_W, h / 2, z); scene.add(wl);
    const cp = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.12, DZ + 0.03), capMat); cp.position.set(sd * HALL_W, h + 0.06, z); scene.add(cp); }); }
{ const h = TOP + 1.6; const wl = new THREE.Mesh(new THREE.BoxGeometry(HALL_W * 2 + 0.4, h, 0.4), wallMat); wl.position.set(0, h / 2, HALL_END); scene.add(wl);
  const cp = new THREE.Mesh(new THREE.BoxGeometry(HALL_W * 2 + 0.5, 0.12, 0.54), capMat); cp.position.set(0, h + 0.06, HALL_END); scene.add(cp);
  const top = new THREE.Mesh(new THREE.BoxGeometry(HALL_W * 2 - 0.4, TOP + 0.2, HALL_END - (Z0 + (ROWS - 1) * DZ) - 0.4), mat('#E4E0D9')); top.position.set(0, (TOP + 0.2) / 2, (Z0 + (ROWS - 1) * DZ + HALL_END) / 2 + 0.3); scene.add(top); }
{ const gate = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshLambertMaterial({ map: gateTex })); gate.position.set(-12, TOP + 1.3, HALL_END - 0.21); gate.rotation.y = Math.PI; scene.add(gate); }
const poleM = mat('#B9BDC3'), lampGlows = [];
[[-HALL_W + 1.6, 9], [HALL_W - 1.6, 9], [-HALL_W + 1.6, HALL_END - 3], [HALL_W - 1.6, HALL_END - 3]].forEach(([x, z]) => { const y0 = 0.2 + yAt(z), H = 11;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, H, 8), poleM); pole.position.set(x, y0 + H / 2, z); pole.castShadow = true; scene.add(pole);
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.35, 0.7), poleM); head.position.set(x, y0 + H, z); scene.add(head);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.6), flat('#FFF6DA')); glow.rotation.x = Math.PI / 2; glow.position.set(x, y0 + H - 0.18, z); scene.add(glow); lampGlows.push(glow); });
// молодые сосны в клумбах вдоль стены
const trunkM = mat('#7A4A2A'), pineM = [mat('#2F6B45'), mat('#3F7E52')], potM = mat('#DDD6CA');
pines.forEach(p => { const g = new THREE.Group(); g.position.set(p.x, 0.2 + p.y, p.z);
  const pot = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.3, 1.5), potM); pot.position.y = 0.15; g.add(pot);
  const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, p.h, 7), trunkM); tr.position.y = p.h / 2; g.add(tr);
  for (let q = 0; q < 5; q++) { const c = new THREE.Mesh(new THREE.ConeGeometry(1.35 - q * 0.22, 1.5, 10), pineM[q % 2]); c.position.y = p.h * 0.32 + q * 0.62; c.rotation.y = q; c.castShadow = true; g.add(c); }
  scene.add(g); });
// берёзовая роща за стеной
let seed = 99; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const NBT = 260;
const bTr = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.22, 15, 6), new THREE.MeshLambertMaterial({ map: barkTex, emissive: '#555' }), NBT);
const bCr = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(2.3, 1), new THREE.MeshLambertMaterial({ color: '#8FBF6F', flatShading: true }), NBT * 3);
const crCol = new THREE.Color(), crPal = ['#8FBF6F', '#7DB063', '#A6CC86', '#6FA35A'];
for (let i = 0; i < NBT; i++) { let x, z; const side = rnd();
  if (side < .25) { x = -(HALL_W + 3 + rnd() * 22); z = -8 + rnd() * (HALL_END + 18); } else if (side < .5) { x = HALL_W + 3 + rnd() * 22; z = -8 + rnd() * (HALL_END + 18); } else if (side < .88) { x = -55 + rnd() * 110; z = -10 - rnd() * 30; } else { x = -40 + rnd() * 80; z = HALL_END + 3 + rnd() * 20; }
  if (Math.abs(x) < 13 && z < 2) z -= 14;
  o.position.set(x, 7.5, z); o.scale.set(1, 1, 1); o.updateMatrix(); bTr.setMatrixAt(i, o.matrix);
  for (let q = 0; q < 3; q++) { const sc = 0.6 + rnd() * 0.6; o.position.set(x + (rnd() - .5) * 2.4, 11 + q * 1.6 + rnd() * 2, z + (rnd() - .5) * 2.4); o.scale.set(sc, sc * 1.25, sc); o.updateMatrix(); bCr.setMatrixAt(i * 3 + q, o.matrix); bCr.setColorAt(i * 3 + q, crCol.set(crPal[(i + q) % 4])); } }
o.scale.set(1, 1, 1); scene.add(bTr, bCr);

/* ---------- камера: перелёт к месту + осмотр ---------- */
const camPos = new THREE.Vector3(), camTo = new THREE.Vector3(), lookTo = new THREE.Vector3(), lookCur = new THREE.Vector3(), from = new THREE.Vector3(), fromLook = new THREE.Vector3();
let t0 = 0, yaw = 0, pitch = 0, flying = false, curSeat = null;
function aim(s) { camTo.set(s.x, 0.2 + s.y + 1.42, s.z + 0.08); lookTo.set(s.x * 0.15, 3.4, 1.5); }
/* режим «днём / на закате» */
let mode = 0, modeTo = 0;
const C = (a) => new THREE.Color(a), lerpC = (a, b, k) => a.clone().lerp(b, k);
const DAY = { sun: C('#FFF1D6'), hemi: C('#FFF6E6'), fog: C('#DDEBEF'), glow: C('#FFF6DA') }, EVE = { sun: C('#FFB070'), hemi: C('#FFD6B0'), fog: C('#F1C9A0'), glow: C('#FFD07A') };
function applyMode(k) {
  sun.color.copy(lerpC(DAY.sun, EVE.sun, k)); sun.intensity = 1.7 - 0.75 * k; sun.position.set(-24 - 18 * k, 34 - 24 * k, 26 - 66 * k);
  hemi.color.copy(lerpC(DAY.hemi, EVE.hemi, k)); hemi.intensity = 1.2 - 0.45 * k; front.intensity = 0.9 - 0.55 * k;
  scene.fog.color.copy(lerpC(DAY.fog, EVE.fog, k)); scene.background = k > .5 ? skyEve : skyTex; renderer.toneMappingExposure = 1.05 - 0.1 * k;
  lampGlows.forEach(g => g.material.color.copy(lerpC(DAY.glow, EVE.glow, k)));
}
function render() {
  const now = performance.now();
  if (Math.abs(modeTo - mode) > 0.001) { mode += (modeTo - mode) * 0.05; applyMode(mode); }
  beams.forEach(b => { const t = now / 1000 + b.userData.ph; b.rotation.z = Math.sin(t * 0.7) * 0.32; b.rotation.x = -0.55 + Math.sin(t * 0.5) * 0.12; b.material.opacity = 0.05 + mode * 0.2 + Math.sin(t * 2) * 0.015; });
  if (flying) { const k = Math.min(1, (now - t0) / 1300), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    camPos.lerpVectors(from, camTo, e); camPos.y += Math.sin(Math.PI * e) * 3; lookCur.lerpVectors(fromLook, lookTo, e); if (k >= 1) flying = false; }
  cam.position.copy(camPos);
  const dir = lookCur.clone().sub(camPos), yaw0 = Math.atan2(dir.x, dir.z), pitch0 = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
  const Y = yaw0 + yaw, Pt = pitch0 + pitch;
  cam.lookAt(camPos.x + Math.sin(Y) * Math.cos(Pt), camPos.y + Math.sin(Pt), camPos.z + Math.cos(Y) * Math.cos(Pt));
  renderer.render(scene, cam);
  drawCone();
}
// луч обзора на плане: сразу от ВЫБРАННОГО места (не ждёт перелёта камеры и не зависит от того, виден ли 3D-вид)
function drawCone() {
  if (!curSeat) return;
  const hf = Math.atan(Math.tan(cam.fov * Math.PI / 360) * cam.aspect), L = Math.hypot(curSeat.x, curSeat.z) + 8;
  const Y = Math.atan2(lookTo.x - camTo.x, lookTo.z - camTo.z) + yaw;
  const [sx, sy] = P(camTo.x, camTo.z), [ax, ay] = P(camTo.x + Math.sin(Y + hf) * L, camTo.z + Math.cos(Y + hf) * L), [bx, by] = P(camTo.x + Math.sin(Y - hf) * L, camTo.z + Math.cos(Y - hf) * L);
  cone.setAttribute('d', `M${sx.toFixed(1)} ${sy.toFixed(1)} L${ax.toFixed(1)} ${ay.toFixed(1)} A${(L * S).toFixed(0)} ${(L * S).toFixed(0)} 0 0 0 ${bx.toFixed(1)} ${by.toFixed(1)} Z`);
  const g = document.getElementById('coneG'); g.setAttribute('cx', sx); g.setAttribute('cy', sy); g.setAttribute('r', L * S);
}
let visible = true; const loop = () => { if (visible) render(); requestAnimationFrame(loop); };
new IntersectionObserver(e => { visible = e[0].isIntersecting; }).observe(box);
const resize = () => { const cv = renderer.domElement, w = cv.clientWidth || box.clientWidth, h = cv.clientHeight || box.clientHeight; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
addEventListener('resize', resize); resize(); if (window.ResizeObserver) new ResizeObserver(resize).observe(renderer.domElement);
let drag = null;
box.addEventListener('pointerdown', e => { if (e.target.closest('button,a')) return; drag = { x: e.clientX, y: e.clientY, yaw, pitch }; box.setPointerCapture(e.pointerId); box.classList.add('grab'); });
box.addEventListener('pointermove', e => { if (!drag) return; yaw = Math.max(-1, Math.min(1, drag.yaw - (e.clientX - drag.x) * 0.004)); pitch = Math.max(-0.35, Math.min(0.45, drag.pitch + (e.clientY - drag.y) * 0.003)); });
const end = () => { drag = null; box.classList.remove('grab'); }; box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);

/* ---------- выбор места ---------- */
const $ = id => document.getElementById(id);
const info = { sec: $('sInfoSec'), row: $('sInfoRow'), num: $('sInfoNum'), dist: $('sInfoDist'), view: $('sInfoView'), zone: $('sInfoZone'), price: $('sInfoPrice'), buy: $('sInfoBuy'), st: $('sInfoState') };
const nearestFree = s => { let b = -1, d = 1e9; seats.forEach((q, i) => { if (q.busy) return; const dd = Math.hypot(q.x - s.x, (q.z - s.z) * 1.4); if (dd < d) { d = dd; b = i; } }); return b; };
function pick(i, how) {
  let s = seats[i], note = '';
  if (s.busy) { const j = nearestFree(s); note = `место ${s.num} в ${s.row} ряду занято — показываем ближайшее свободное · `; s = seats[j]; i = j; }
  curSeat = s; const [x, y] = P(s.x, s.z); marker.setAttribute('transform', `translate(${x} ${y})`);
  if (how === 'instant') { aim(s); camPos.copy(camTo); lookCur.copy(lookTo); flying = false; }
  else { from.copy(camPos); fromLook.copy(lookCur); aim(s); t0 = performance.now(); flying = true; }
  yaw = 0; pitch = 0; drawCone();
  const z = zoneOf(s);
  info.sec.textContent = s.sec === 'Л' ? 'ЛЕВАЯ' : 'ПРАВАЯ'; info.row.textContent = s.row; info.num.textContent = s.num; info.dist.textContent = '≈ ' + Math.round(Math.hypot(s.x, s.z - 2)) + ' М';
  info.zone.textContent = z.n; info.price.textContent = z.p.toLocaleString('ru-RU') + ' ₽'; info.buy.textContent = 'Выбрать событие'; info.st.textContent = 'свободно';
  const ang = Math.abs(Math.atan2(s.x, s.z - 2)) * 180 / Math.PI;
  info.view.textContent = note + (ang < 12 ? 'прямой вид на сцену' : ang < 30 ? 'вид немного сбоку' : 'вид сбоку, под углом') + (Math.abs(s.x) > HALL_W - 3.2 ? ' · у стены, рядом сосны' : '') + (s.row > 12 ? ' · сверху видно весь зал' : '');
  document.querySelectorAll('.seat-q button').forEach(b => b.classList.remove('on'));
}
const find = (row, sec, pos) => { const list = seats.filter(q => q.row === row && q.sec === sec); const t = list[Math.floor((list.length - 1) * pos)]; return t.busy ? nearestFree(t) : seats.indexOf(t); };
document.querySelectorAll('.seat-q button').forEach(b => b.addEventListener('click', () => {
  const q = b.dataset.q; const i = q === 'front' ? find(1, 'Л', 1) : q === 'center' ? find(11, 'П', 0) : q === 'back' ? find(ROWS, 'Л', 1) : find(8, 'П', 0.92); pick(i); b.classList.add('on'); }));
// режим дня
document.querySelectorAll('.sv-mode button').forEach(b => b.addEventListener('click', () => { modeTo = b.dataset.m === 'eve' ? 1 : 0;
  document.querySelectorAll('.sv-mode button').forEach(x => x.classList.toggle('on', x === b)); }));
// фото с места (пример: похожий ракурс из архива театра)
const PH = { front: ['img/views/v05.jpg', 'img/views/v02.jpg'], mid: ['img/views/v10.jpg', 'img/views/v02.jpg', 'img/views/v21.jpg'], back: ['img/views/v12.jpg', 'img/views/v21.jpg', 'img/views/v07.jpg', 'img/views/v23.jpg'] };
const lb = $('svPhoto'), lbImg = lb.querySelector('img'), lbCap = lb.querySelector('figcaption');
$('svPhotoBtn').addEventListener('click', () => { if (!curSeat) return; const k = curSeat.row < 7 ? 'front' : curSeat.row < 15 ? 'mid' : 'back', l = PH[k];
  lbImg.src = l[(Math.random() * l.length) | 0]; lbCap.textContent = `Пример: похожий ракурс из архива театра · ${zoneOf(curSeat).n.toLowerCase()}, ряд ${curSeat.row}`; lb.hidden = false; });
lb.addEventListener('click', e => { if (e.target === lb || e.target.closest('.x')) lb.hidden = true; });
addEventListener('keydown', e => { if (e.key === 'Escape') lb.hidden = true; });

pick(find(9, 'Л', 0.93), 'instant');
// общее число мест — реальное (1 181) из разметки; демо-план рисует ${seats.length}
$('seatFree').textContent = seats.filter(q => !q.busy).length.toLocaleString('ru-RU');
scene.traverse(m => { if (m.isInstancedMesh) m.frustumCulled = false; });
loop();
