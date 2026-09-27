import * as THREE from 'three';
import { mat } from './graphics.js';

export const BLOCK = 44, ROAD = 14, CELL = BLOCK + ROAD, N = 5;
const HALF = (N * CELL) / 2;
// B buildings, H houses, C cemetery, P park, X city hall plaza, M market
const MAP = [
  'BBHHB',
  'BCBHB',
  'BPXBH',
  'BBBMB',
  'BHBBH',
];
export const blockCenter = (i) => (i - (N - 1) / 2) * CELL;

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

function canvasTex(w, h, draw, nearest = false) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (nearest) t.magFilter = THREE.NearestFilter;
  return t;
}

function windowTex(seed) {
  return canvasTex(256, 256, (g) => {
    const base = ['#16161a', '#1c1814', '#141a1c', '#1d1a1a'][seed % 4];
    g.fillStyle = base; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const lit = Math.random() < 0.28;
      g.fillStyle = lit ? pick(['#ffcf7a', '#ffe0a0', '#e8b060', '#cfe3ff']) : pick(['#0a0c10', '#0e1016', '#080808']);
      g.fillRect(x * 32 + 7, y * 32 + 6, 18, 20);
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x * 32 + 15, y * 32 + 6, 2, 20);
    }
    g.fillStyle = 'rgba(0,0,0,.25)';
    for (let y = 0; y < 8; y++) g.fillRect(0, y * 32 + 29, 256, 3);
  });
}
function emissiveFrom(tex) {
  // same image, dimmed non-windows via separate canvas
  const src = tex.image; const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const g = c.getContext('2d'); g.drawImage(src, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) { const b = d.data[i] + d.data[i + 1]; if (b < 200) { d.data[i] = d.data[i + 1] = d.data[i + 2] = 0; } }
  g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export function signTex(text, bg = '#eee', fg = '#111', w = 256, h = 128) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = fg; g.font = `bold ${h / 4}px Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const lines = text.split('\n');
    lines.forEach((l, i) => g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * h / 3.4));
  });
}

function sizedBox(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  for (let f = 0; f < 6; f++) {
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      let su = 1, sv = 1;
      if (f < 2) { su = d / 32; sv = h / 32; } else if (f < 4) { su = 0; sv = 0; } else { su = w / 32; sv = h / 32; }
      uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    }
  }
  return g;
}

export class World {
  constructor(scene, gfx) {
    this.scene = scene; this.gfx = gfx;
    this.group = new THREE.Group(); scene.add(this.group);
    this.colliders = [];
    this.lamps = [];
    this.spots = { funeral: [], casket: null, pledge: [], flag: null, lounge: [], grass: [], carts: [], crosswalks: [], chores: [] };
    this.loops = [];
    this.build();
  }
  add(mesh, cast = true, recv = true) { mesh.castShadow = cast; mesh.receiveShadow = recv; this.group.add(mesh); return mesh; }
  box(w, h, d, m, x, y, z, collide = false) {
    const b = this.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m));
    b.position.set(x, y, z);
    if (collide) this.colliders.push({ minx: x - w / 2, maxx: x + w / 2, minz: z - d / 2, maxz: z + d / 2, h: y + h / 2 });
    return b;
  }

  build() {
    const S = HALF + 60;
    // ground / asphalt
    const asphalt = mat('#1a1b1e', { roughness: 0.32, metalness: 0.15 });
    const ground = this.add(new THREE.Mesh(new THREE.PlaneGeometry(S * 2, S * 2), asphalt), false, true);
    ground.rotation.x = -Math.PI / 2;

    // road markings
    const lineMat = mat('#8a7a30', { roughness: 0.5 });
    const white = mat('#bbbbbb', { roughness: 0.5 });
    for (let i = 0; i < N - 1; i++) {
      const c = blockCenter(i) + CELL / 2;
      for (let t = -HALF; t < HALF; t += 6) {
        this.box(0.25, 0.02, 3, lineMat, c, 0.01, t, false).castShadow = false;
        this.box(3, 0.02, 0.25, lineMat, t, 0.01, c, false).castShadow = false;
      }
    }
    // crosswalks at each intersection (4 per intersection)
    for (let i = -1; i < N; i++) for (let j = -1; j < N; j++) {
      const cx = blockCenter(i) + CELL / 2, cz = blockCenter(j) + CELL / 2;
      if (Math.abs(cx) > HALF || Math.abs(cz) > HALF) continue;
      const off = ROAD / 2 + 2.2;
      for (const [dx, dz, horiz] of [[off, 0, 0], [-off, 0, 0], [0, off, 1], [0, -off, 1]]) {
        const x = cx + dx, z = cz + dz;
        for (let s = -ROAD / 2 + 1; s < ROAD / 2; s += 1.6) {
          if (horiz) this.box(0.8, 0.025, 3.2, white, x + s, 0.012, z).castShadow = false;
          else this.box(3.2, 0.025, 0.8, white, x, 0.012, z + s).castShadow = false;
        }
        this.spots.crosswalks.push({ minx: x - (horiz ? ROAD / 2 : 2), maxx: x + (horiz ? ROAD / 2 : 2), minz: z - (horiz ? 2 : ROAD / 2), maxz: z + (horiz ? 2 : ROAD / 2) });
      }
    }

    this.winTex = [0, 1, 2, 3].map(windowTex);
    this.winEm = this.winTex.map(emissiveFrom);
    const walk = mat('#3a3a3c', { roughness: 0.6 });
    const curb = mat('#555', { roughness: 0.7 });

    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const x = blockCenter(i), z = blockCenter(j), type = MAP[j][i];
      // sidewalk slab
      const sw = this.add(new THREE.Mesh(new THREE.BoxGeometry(BLOCK, 0.2, BLOCK), walk), false, true);
      sw.position.set(x, 0.1, z);
      this.box(BLOCK + 0.3, 0.22, 0.3, curb, x, 0.11, z - BLOCK / 2).castShadow = false;
      this.box(BLOCK + 0.3, 0.22, 0.3, curb, x, 0.11, z + BLOCK / 2).castShadow = false;
      this.box(0.3, 0.22, BLOCK, curb, x - BLOCK / 2, 0.11, z).castShadow = false;
      this.box(0.3, 0.22, BLOCK, curb, x + BLOCK / 2, 0.11, z).castShadow = false;
      this.loops.push({ x, z, r: BLOCK / 2 - 1.6 });
      // lamps on corners + mids
      for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
        this.lamp(x + lx * (BLOCK / 2 - 0.8), z + lz * (BLOCK / 2 - 0.8));
      }
      const inner = BLOCK - 7;
      if (type === 'B') this.buildings(x, z, inner);
      else if (type === 'H') this.houses(x, z, inner);
      else if (type === 'C') this.cemetery(x, z, inner);
      else if (type === 'P') this.park(x, z, inner);
      else if (type === 'X') this.plaza(x, z, inner);
      else if (type === 'M') this.market(x, z, inner);
    }
    // boundary skyline
    for (let a = -HALF - 30; a <= HALF + 30; a += 22) {
      for (const [bx, bz] of [[a, -HALF - 26], [a, HALF + 26], [-HALF - 26, a], [HALF + 26, a]]) this.tower(bx, bz, 20, rand(40, 110), 20);
    }
    this.bounds = HALF - 1;
  }

  tower(x, z, w, h, d) {
    const k = (Math.random() * 4) | 0;
    const side = mat('#ffffff', { map: this.winTex[k], emissiveMap: this.winEm[k], emissive: '#ffffff', emissiveIntensity: 1.1, roughness: 0.7, unique: true });
    const roof = mat('#141416');
    const b = this.add(new THREE.Mesh(sizedBox(w, h, d), [side, side, roof, roof, side, side]));
    b.position.set(x, h / 2, z);
    this.colliders.push({ minx: x - w / 2, maxx: x + w / 2, minz: z - d / 2, maxz: z + d / 2, h });
    // gargoyle-ish roof trim
    this.box(w + 0.6, 0.8, d + 0.6, mat('#0e0e10'), x, h, z);
    if (Math.random() < 0.3) { const ant = this.box(0.3, rand(4, 12), 0.3, mat('#222'), x, h + 4, z); ant.castShadow = false; }
  }
  buildings(x, z, s) {
    const q = s / 2;
    const layout = Math.random() < 0.5 ? [[-q / 2, -q / 2], [q / 2, -q / 2], [-q / 2, q / 2], [q / 2, q / 2]] : [[0, -q / 2], [0, q / 2]];
    const w = layout.length === 4 ? q - 1 : s;
    for (const [dx, dz] of layout) this.tower(x + dx, z + dz, w, rand(18, 70), q - 1);
  }
  lamp(x, z) {
    const pole = mat('#1a1a1a', { metalness: 0.6, roughness: 0.4 });
    this.box(0.18, 6, 0.18, pole, x, 3, z);
    const head = this.box(0.7, 0.25, 0.7, pole, x, 6.1, z);
    const bulb = this.box(0.45, 0.08, 0.45, new THREE.MeshBasicMaterial({ color: '#ffd9a0' }), x, 5.95, z);
    bulb.castShadow = false;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(2.6, 5.8, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: '#ffcf80', transparent: true, opacity: 0.045, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    cone.position.set(x, 3, z); this.group.add(cone);
    this.lamps.push(new THREE.Vector3(x, 5.8, z));
    this.colliders.push({ minx: x - 0.2, maxx: x + 0.2, minz: z - 0.2, maxz: z + 0.2, h: 6 });
  }
  grassPatch(x, z, w, d) {
    const g = this.add(new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), mat('#1c2a16', { roughness: 1 })), false, true);
    g.position.set(x, 0.24, z); return g;
  }
  tree(x, z) {
    this.box(0.5, 4, 0.5, mat('#2a1c12'), x, 2, z, true);
    const f = this.add(new THREE.Mesh(new THREE.IcosahedronGeometry(rand(1.8, 2.6), 0), mat('#15200f', { flatShading: true })));
    f.position.set(x, 5, z);
  }
  signPost(x, z, text, rotY = 0, bg, fg) {
    this.box(0.12, 2.2, 0.12, mat('#333'), x, 1.1, z);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), mat('#fff', { map: signTex(text, bg, fg), unique: true, emissive: '#333' }));
    s.position.set(x, 2.3, z); s.rotation.y = rotY; this.add(s);
  }
  houses(x, z, s) {
    const q = s / 2;
    const cols = ['#3b2e2a', '#2c3338', '#3a3a2c', '#332630', '#2d2d2d'];
    for (const [dx, dz, rot] of [[-q / 2, -q / 2, 0], [q / 2, -q / 2, 0], [-q / 2, q / 2, Math.PI], [q / 2, q / 2, Math.PI]]) {
      const hx = x + dx, hz = z + dz, face = dz < 0 ? -1 : 1; // porch faces outward
      this.grassPatch(hx, hz, q - 1, q - 1);
      const w = q * 0.6, d = q * 0.45, h = 5;
      const cz = hz - face * q * 0.12;
      const k = (Math.random() * 4) | 0;
      const wall = mat(pick(cols), { roughness: 0.9 });
      this.box(w, h, d, wall, hx, h / 2 + 0.2, cz, true);
      const roof = this.add(new THREE.Mesh(new THREE.ConeGeometry(w * 0.78, 3, 4), mat('#1a1414', { flatShading: true })));
      roof.position.set(hx, h + 1.7, cz); roof.rotation.y = Math.PI / 4; roof.scale.z = d / w;
      // window glow
      const win = this.box(1.2, 1.1, 0.05, new THREE.MeshBasicMaterial({ color: '#ffb866' }), hx - w / 4, 3, cz + face * (d / 2 + 0.03));
      win.castShadow = false;
      this.box(1, 2, 0.05, mat('#2a1a10'), hx + w / 5, 1.2, cz + face * (d / 2 + 0.03));
      // porch
      const porchZ = cz + face * (d / 2 + 1.6);
      this.box(w, 0.25, 3, mat('#3a2c20'), hx, 0.35, porchZ);
      // lounge chair
      const chairX = hx - w / 4;
      this.box(1, 0.5, 1, mat('#5a2020'), chairX, 0.75, porchZ, false);
      this.box(1, 1, 0.2, mat('#5a2020'), chairX, 1.2, porchZ - face * 0.45);
      this.spots.lounge.push({ x: chairX, z: porchZ, face, choreX: hx + w / 4, choreZ: porchZ + face * 2.5 });
    }
  }
  cemetery(x, z, s) {
    this.grassPatch(x, z, s, s);
    // fence
    const iron = mat('#111', { metalness: 0.7, roughness: 0.4 });
    for (let t = -s / 2; t <= s / 2; t += 1) {
      for (const [fx, fz] of [[x + t, z - s / 2], [x + t, z + s / 2], [x - s / 2, z + t], [x + s / 2, z + t]]) {
        if (Math.abs(t) < 3) continue; // gates
        this.box(0.08, 1.8, 0.08, iron, fx, 1.1, fz).castShadow = false;
      }
    }
    const stone = mat('#5a5a5e', { roughness: 0.95 });
    for (let gx = -s / 2 + 3; gx < s / 2 - 2; gx += 3.2) for (let gz = -s / 2 + 3; gz < s / 2 - 2; gz += 4) {
      if (Math.abs(gx) < 9 && Math.abs(gz) < 9) continue;
      if (Math.random() < 0.8) {
        const g = this.box(1, rand(1, 1.6), 0.25, stone, x + gx, 0.8, z + gz, true);
        g.rotation.z = rand(-0.08, 0.08);
      }
    }
    // grave + casket
    this.box(2.2, 0.05, 4, mat('#0a0806'), x, 0.3, z);
    const casket = this.box(1.4, 0.8, 3, mat('#3a1c0e', { roughness: 0.3, metalness: 0.2 }), x + 2.6, 0.9, z, true);
    this.box(1.5, 0.08, 3.1, mat('#b09040', { metalness: 0.8, roughness: 0.3 }), x + 2.6, 1.32, z);
    this.box(0.8, 1.6, 0.2, stone, x, 1, z - 2.6, true);
    // flowers
    for (let k = 0; k < 6; k++) this.box(0.3, 0.3, 0.3, mat(pick(['#a01818', '#ddd', '#c8b020'])), x + 2.6 + rand(-0.5, 0.5), 1.45, z + rand(-1.2, 1.2));
    this.spots.casket = new THREE.Vector3(x + 2.6, 0, z);
    for (let a = 0; a < 10; a++) {
      const ang = (a / 10) * Math.PI * 2;
      this.spots.funeral.push({ x: x + 1.3 + Math.cos(ang) * 5.2, z: z + Math.sin(ang) * 5.2, face: Math.atan2(-Math.cos(ang), -Math.sin(ang)) });
    }
    this.signPost(x + 3.5, z + s / 2 + 0.8, 'GOTHAM\nCEMETERY', 0, '#222', '#aaa');
    for (let k = 0; k < 4; k++) this.tree(x + pick([-1, 1]) * rand(12, s / 2 - 2), z + pick([-1, 1]) * rand(12, s / 2 - 2));
  }
  park(x, z, s) {
    this.grassPatch(x, z, s, s);
    const path = mat('#4a4642', { roughness: 0.9 });
    this.box(3, 0.12, s, path, x, 0.3, z).castShadow = false;
    this.box(s, 0.12, 3, path, x, 0.3, z).castShadow = false;
    for (let k = 0; k < 10; k++) {
      let tx = rand(-s / 2 + 2, s / 2 - 2), tz = rand(-s / 2 + 2, s / 2 - 2);
      if (Math.abs(tx) < 3 || Math.abs(tz) < 3) continue;
      this.tree(x + tx, z + tz);
    }
    for (const [sx, sz] of [[3, 3], [-3, -3], [3, -3], [-3, 3]]) this.signPost(x + sx * 1.3, z + sz * 1.3, 'KEEP OFF\nTHE GRASS', Math.PI / 4, '#1c4a1c', '#eee');
    // fountain
    const f = this.add(new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 0.8, 16), mat('#555')));
    f.position.set(x, 0.6, z);
    this.colliders.push({ minx: x - 2.4, maxx: x + 2.4, minz: z - 2.4, maxz: z + 2.4, h: 1 });
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) for (let k = 0; k < 3; k++)
      this.spots.grass.push({ x: x + dx * rand(6, s / 2 - 3), z: z + dz * rand(6, s / 2 - 3) });
  }
  plaza(x, z, s) {
    const marble = mat('#4a4845', { roughness: 0.5 });
    this.box(s, 0.15, s, marble, x, 0.28, z).castShadow = false;
    // city hall facade
    const hz = z - s / 2 + 5;
    this.box(s - 4, 14, 8, mat('#3a3834', { roughness: 0.8 }), x, 7, hz - 1, true);
    for (let c = -s / 2 + 4; c <= s / 2 - 4; c += 3.5) this.box(0.8, 10, 0.8, mat('#57544e'), x + c, 5.2, hz + 3.6, true);
    const ped = this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.01, (s - 4) / 2, 3, 3), mat('#44413c', { flatShading: true })));
    ped.position.set(x, 15.4, hz + 2.5); ped.rotation.y = Math.PI / 2; ped.scale.z = 0.3;
    // flagpole
    this.box(0.2, 12, 0.2, mat('#aaa', { metalness: 0.8, roughness: 0.3 }), x, 6, z + 2, true);
    const flagTex = canvasTex(96, 64, (g) => {
      for (let r = 0; r < 7; r++) { g.fillStyle = r % 2 ? '#eee' : '#a01010'; g.fillRect(0, r * 64 / 7, 96, 64 / 7 + 1); }
      g.fillStyle = '#18204a'; g.fillRect(0, 0, 40, 30);
      g.fillStyle = '#fff'; for (let a = 0; a < 12; a++) g.fillRect(4 + (a % 4) * 9, 4 + ((a / 4) | 0) * 9, 2, 2);
    });
    const flagGeo = new THREE.PlaneGeometry(3, 2, 12, 4); flagGeo.translate(1.5, 0, 0);
    const flag = new THREE.Mesh(flagGeo, mat('#fff', { map: flagTex, side: THREE.DoubleSide, unique: true }));
    flag.position.set(x + 0.1, 11, z + 2); this.add(flag);
    this.spots.flag = flag;
    this.box(1.6, 1.2, 0.8, mat('#2a1c14'), x, 0.9, z - 2, true); // podium
    this.signPost(x - 6, z + s / 2 - 1, 'GOTHAM CITY\nHALL', 0, '#222', '#ccb070');
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++)
      this.spots.pledge.push({ x: x - 6 + c * 3, z: z + 7 + r * 3, face: Math.PI });
  }
  market(x, z, s) {
    const lot = mat('#222326', { roughness: 0.5 });
    this.box(s, 0.12, s, lot, x, 0.27, z).castShadow = false;
    const store = this.box(s - 4, 7, 10, mat('#2c2e30'), x, 3.7, z - s / 2 + 6, true);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(12, 2.2), new THREE.MeshBasicMaterial({ map: signTex('GOTHAM MART', '#300', '#f44', 512, 96) }));
    sign.position.set(x, 6, z - s / 2 + 11.05); this.group.add(sign);
    for (let p = -s / 2 + 4; p < s / 2 - 2; p += 3.5) this.box(0.15, 0.02, 5, white(), x + p, 0.34, z + 5).castShadow = false;
    // cart corral
    const rail = mat('#888', { metalness: 0.8, roughness: 0.3 });
    this.box(6, 1, 0.1, rail, x + 8, 0.8, z - 2); this.box(6, 1, 0.1, rail, x + 8, 0.8, z - 0.4);
    this.signPost(x + 11.5, z - 1.2, 'RETURN\nCARTS', 0, '#113', '#fff');
    this.spots.corral = new THREE.Vector3(x + 8, 0, z - 1.2);
    for (let k = 0; k < 8; k++) this.spots.carts.push({ x: x + rand(-s / 2 + 3, s / 2 - 3), z: z + rand(0, s / 2 - 3) });
    // parked cars
    for (let k = 0; k < 5; k++) this.car(x - s / 2 + 5 + k * 7, z + 5 + (k % 2) * 8);
    function white() { return mat('#999'); }
  }
  car(x, z) {
    const c = mat(pick(['#301010', '#15202a', '#202020', '#2a2a18']), { roughness: 0.25, metalness: 0.6 });
    this.box(2, 0.9, 4.2, c, x, 0.8, z, true);
    this.box(1.8, 0.7, 2.2, mat('#0a0c10', { roughness: 0.1, metalness: 0.9 }), x, 1.55, z - 0.2);
  }

  // --- queries ---
  blockAt(x, z) {
    const i = Math.round(x / CELL + (N - 1) / 2), j = Math.round(z / CELL + (N - 1) / 2);
    if (i < 0 || j < 0 || i >= N || j >= N) return null;
    const bx = blockCenter(i), bz = blockCenter(j);
    return { i, j, x: bx, z: bz, type: MAP[j][i], inside: Math.abs(x - bx) < BLOCK / 2 && Math.abs(z - bz) < BLOCK / 2 };
  }
  isRoad(x, z) { const b = this.blockAt(x, z); return !b || !b.inside; }
  isCrosswalk(x, z) { return this.spots.crosswalks.some(c => x > c.minx && x < c.maxx && z > c.minz && z < c.maxz); }
  groundY(x, z) {
    const b = this.blockAt(x, z);
    if (!b || !b.inside) return 0;
    const e = BLOCK / 2 - 3.5;
    if (Math.abs(x - b.x) < e && Math.abs(z - b.z) < e) {
      if (b.type === 'X') return 0.36;
      if (b.type === 'M') return 0.33;
      if (b.type === 'C' || b.type === 'P') return 0.29;
    }
    return 0.2;
  }
  collide(pos, r) {
    for (const c of this.colliders) {
      if (pos.y > c.h - 0.1) continue;
      const nx = Math.max(c.minx, Math.min(pos.x, c.maxx)), nz = Math.max(c.minz, Math.min(pos.z, c.maxz));
      const dx = pos.x - nx, dz = pos.z - nz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 < 1e-6) { pos.x += r; continue; }
        const d = Math.sqrt(d2), push = (r - d) / d;
        pos.x += dx * push; pos.z += dz * push;
      }
    }
    const B = HALF + 4;
    pos.x = Math.max(-B, Math.min(B, pos.x)); pos.z = Math.max(-B, Math.min(B, pos.z));
  }
  blocksOfType(t) {
    const out = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (MAP[j][i] === t) out.push({ x: blockCenter(i), z: blockCenter(j) });
    return out;
  }
}
