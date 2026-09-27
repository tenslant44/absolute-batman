import * as THREE from 'three';
import { mat, shared } from './graphics.js';

const pick = (a) => a[(Math.random() * a.length) | 0];
const SKINS = ['#e8c2a0', '#c99a78', '#8d5a3c', '#5a3824', '#f0d0b8', '#b07a56', '#d8a888'];
const SHIRTS = ['#3a3a44', '#4a2a22', '#223040', '#2d3a2a', '#554433', '#402034', '#5a5a5a', '#1f2a36', '#6a4a20', '#7a7266', '#2a2a2a'];
const JACKETS = ['#1c1c20', '#2a2218', '#1a2430', '#3a2a1a', '#202a20', '#3a3a3a', '#4a1a1a'];
const PANTS = ['#1a1a22', '#2a2622', '#202a33', '#333', '#2a2018', '#1a2438'];
const HAIR = ['#1a1410', '#3a2414', '#6a4a24', '#101010', '#8a6a3a', '#2a1a10'];

// geometry cache, detail depends on quality at build time
const gcache = new Map();
function seg() { return shared.q === 'normal' ? 1 : shared.q === 'psx' ? 0.5 : 0.3; }
function capG(r, len) {
  const k = seg(), key = `c${r}${len}${k}`;
  if (!gcache.has(key)) gcache.set(key, new THREE.CapsuleGeometry(r, len, Math.max(2, Math.round(4 * k)), Math.max(4, Math.round(12 * k))));
  return gcache.get(key);
}
function sphG(r) {
  const k = seg(), key = `s${r}${k}`;
  if (!gcache.has(key)) gcache.set(key, new THREE.SphereGeometry(r, Math.max(5, Math.round(16 * k)), Math.max(4, Math.round(12 * k))));
  return gcache.get(key);
}
function boxG(w, h, d) { const key = `b${w},${h},${d}`; if (!gcache.has(key)) gcache.set(key, new THREE.BoxGeometry(w, h, d)); return gcache.get(key); }
function cylG(rt, rb, h) { const k = seg(), key = `y${rt},${rb},${h}${k}`; if (!gcache.has(key)) gcache.set(key, new THREE.CylinderGeometry(rt, rb, h, Math.max(5, Math.round(14 * k)), 1, true)); return gcache.get(key); }

function M(geo, m, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
  const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz);
  o.castShadow = true; o.receiveShadow = true; return o;
}
const G = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

// default pose (all angles radians)
const BASE = { hy: 0.95, hx: 0, hz: 0, sp: 0, spy: 0, hdx: 0, hdy: 0, al: [0, 0, 0.08], ar: [0, 0, -0.08], el: 0.15, er: 0.15, ll: 0, lr: 0, kl: 0.05, kr: 0.05, lz: 0, rz: 0 };
export const POSES = {
  idle: {}, smug: { al: [0.1, 0, 0.35], ar: [-0.3, 0, -0.35], el: 1.9, er: 1.9, hdx: -0.18 },
  cry: { al: [-1.3, 0.4, -0.2], ar: [-1.3, -0.4, 0.2], el: 2.3, er: 2.3, hdx: 0.4, sp: 0.2 },
  pledge: { ar: [-0.7, -0.2, 0.55], er: 2.1, hdx: -0.08 },
  sit: { hy: 0.52, ll: -1.5, lr: -1.5, kl: 1.5, kr: 1.5, al: [-0.5, 0, 0.1], ar: [-0.5, 0, -0.1], el: 0.8, er: 0.8, sp: -0.1 },
  lounge: { hy: 0.55, ll: -1.3, lr: -1.2, kl: 1.0, kr: 1.1, sp: -0.45, al: [-2.7, 0, 0.5], ar: [-2.7, 0, -0.5], el: 2.2, er: 2.2, lz: -0.2, rz: 0.2 },
  push: { al: [-1.1, 0, 0], ar: [-1.1, 0, 0], el: 0.5, er: 0.5, sp: 0.15 },
  toe: { lr: -0.45, kr: 0.2, ll: 0.1, sp: 0.3, hdx: 0.45 },
  hurt: { al: [-1.4, 0, -0.4], ar: [-1.4, 0, 0.4], el: 1.8, er: 1.8, sp: 0.55, hdx: 0.3, hy: 0.86, ll: -0.35, kl: 0.6, lr: 0.2, kr: 0.3 },
  kneel: { hy: 0.5, ll: -1.5, kl: 1.6, lr: 0.1, kr: 2.2, sp: 0.35, al: [-0.9, 0, -0.3], ar: [-0.9, 0, 0.3], el: 1.2, er: 1.2, hdx: 0.4 },
  down: { hy: 0.16, hx: -1.52, ll: 0.1, lr: -0.15, kl: 0.3, kr: 0.1, al: [-2.6, 0, 0.4], ar: [-0.3, 0, -1.2], el: 0.4, er: 0.6, hdy: 0.6 },
  corpse: { hy: 0.14, hx: -1.55, ll: 0.3, lr: -0.25, kl: 0.1, kr: 0.6, al: [-1.4, 0, 1.3], ar: [-0.2, 0, -1.4], el: 0.2, er: 1.1, hdy: 0.9, lz: 0.2, rz: -0.3 },
  facedown: { hy: 0.18, hx: 1.5, ll: 0.1, lr: -0.1, al: [-2.8, 0, 0.5], ar: [-0.3, 0, -1.0], el: 0.3, er: 0.2, hdy: -0.9 },
  punchL: { al: [-1.55, 0, 0.1], el: 0.05, ar: [-0.5, 0, -0.2], er: 2.0, sp: 0.15, spy: -0.4, ll: 0.4, kl: 0.3, lr: -0.3 },
  punchR: { ar: [-1.55, 0, -0.1], er: 0.05, al: [-0.5, 0, 0.2], el: 2.0, sp: 0.15, spy: 0.4, lr: 0.4, kr: 0.3, ll: -0.3 },
  uppercut: { ar: [-2.6, 0, -0.1], er: 1.3, al: [-0.4, 0, 0.3], el: 2, sp: -0.2, spy: 0.3, hy: 1.0 },
  slam: { al: [-2.9, 0, 0.2], ar: [-2.9, 0, -0.2], el: 0.4, er: 0.4, sp: -0.35 },
  hammer: { al: [-0.6, 0, 0.1], ar: [-0.6, 0, -0.1], el: 0.3, er: 0.3, sp: 0.7, hdx: 0.3, hy: 0.85, kl: 0.6, kr: 0.6, ll: -0.4, lr: -0.4 },
  stomp: { ll: -1.35, kl: 1.4, lr: 0.2, al: [-0.3, 0, 0.6], ar: [-0.3, 0, -0.6], el: 0.8, er: 0.8 },
  stompdown: { ll: -0.3, kl: 0.1, lr: 0.2, kr: 0.6, sp: 0.3, al: [-0.3, 0, 0.6], ar: [-0.3, 0, -0.6] },
  kick: { lr: -1.8, kr: 0.05, ll: 0.3, kl: 0.2, sp: -0.3, al: [-0.3, 0, 0.9], ar: [-0.8, 0, -0.5], el: 1.2, er: 1.5 },
  spin: { lr: -1.5, kr: 0.1, sp: -0.2, spy: 1.5, al: [0, 0, 1.3], ar: [0, 0, -1.3] },
  grab: { al: [-1.4, 0.2, 0.2], ar: [-1.4, -0.2, -0.2], el: 0.6, er: 0.6, sp: 0.2 },
  lift: { al: [-2.8, 0.1, 0.25], ar: [-2.8, -0.1, -0.25], el: 0.3, er: 0.3, sp: -0.3, hy: 0.93 },
  twist: { al: [-1.5, 0.6, 0.2], ar: [-1.2, -0.8, -0.2], el: 1.0, er: 0.8, sp: 0.2, spy: 0.8 },
  throw: { ar: [-2.4, 0, -0.3], er: 0.3, al: [-0.5, 0, 0.4], el: 1, sp: 0.2, spy: 0.5 },
  aim: { ar: [-1.5, 0, 0], er: 0.1, al: [-0.3, 0, 0.3], el: 1, spy: 0.25 },
  held: { hy: 1.3, al: [-0.3, 0, 0.6], ar: [-0.3, 0, -0.6], el: 0.2, er: 0.2, ll: 0.2, lr: -0.2, kl: 0.4, kr: 0.2, hdx: -0.3 },
  heldhigh: { hy: 2.3, hx: -1.5, al: [-1.6, 0, 1.2], ar: [-1.6, 0, -1.2], ll: 0.1, lr: -0.1, hdy: 0.6 },
  choke: { hy: 1.05, al: [-1.8, 0, -0.3], ar: [-1.8, 0, 0.3], el: 1.6, er: 1.6, ll: -0.3, lr: 0.4, kl: 0.2, kr: 0.6, hdx: -0.5, sp: -0.15 },
  shock: { al: [-0.4, 0, 1.4], ar: [-0.4, 0, -1.4], el: 0.1, er: 0.1, lz: -0.3, rz: 0.3, hdx: -0.6, sp: -0.25 },
  frozen: { al: [-1.0, 0, 0.5], ar: [-1.2, 0, -0.4], el: 1, er: 0.6, hdx: -0.2 },
  fight: { al: [-1.0, 0.3, 0.35], ar: [-0.9, -0.3, -0.35], el: 2.1, er: 2.1, sp: 0.2, kl: 0.25, kr: 0.25 },
  laugh: { al: [-0.4, 0, 1.0], ar: [-0.4, 0, -1.0], el: 1.3, er: 1.3, hdx: -0.5, sp: -0.25 },
  sweep: { al: [-0.8, 0.3, 0.3], ar: [-0.7, -0.3, -0.3], el: 0.9, er: 0.7, sp: 0.35 },
  crouch: { hy: 0.62, ll: -1.1, kl: 1.9, lr: -0.6, kr: 1.5, sp: 0.55, al: [-0.8, 0, 0.3], ar: [-0.6, 0, -0.3], el: 1, er: 1 },
};

export class Character {
  constructor(kind = 'man', opts = {}) {
    this.kind = kind;
    const female = kind === 'woman' || kind === 'grandma';
    const bat = kind === 'batman';
    const skinC = opts.skin || pick(SKINS);
    const skin = mat(skinC, { roughness: 0.55 });
    let shirt = mat(opts.shirt || pick(SHIRTS), { roughness: 0.85 });
    let jacket = Math.random() < 0.55 ? mat(pick(JACKETS), { roughness: 0.75 }) : null;
    let pants = mat(opts.pants || pick(PANTS), { roughness: 0.9 });
    let hair = mat(opts.hair || pick(HAIR), { roughness: 0.9 });
    const shoe = mat('#0c0c0c', { roughness: 0.35, metalness: 0.1 });
    let longSleeve = Math.random() < 0.6 || !!jacket;
    let dress = female && kind !== 'grandma' && Math.random() < 0.4;
    if (kind === 'grandma') { hair = mat('#c8c8c8'); shirt = mat(pick(['#6a4a6a', '#5a6a8a', '#8a5a5a', '#6a7a5a'])); jacket = mat(pick(['#8a7a6a', '#5a4a5a', '#6a6a7a'])); pants = mat(pick(['#3a3040', '#40403a'])); dress = true; longSleeve = true; }
    if (opts.mourn) { shirt = mat('#dedede'); jacket = mat('#101010'); pants = mat('#0c0c0c'); longSleeve = true; dress = false; }
    if (bat) { shirt = mat('#2a2b30', { roughness: 0.5, metalness: 0.25 }); pants = shirt; jacket = null; longSleeve = true; }
    if (kind === 'joker') { shirt = mat('#2a7a2a'); jacket = mat('#4a1a5a', { roughness: 0.6 }); pants = mat('#4a1a5a'); hair = mat('#1a8a2a'); longSleeve = true; }
    if (kind === 'gordon') { shirt = mat('#ddd'); jacket = mat('#6a5a3a', { roughness: 0.9 }); pants = mat('#2a2622'); hair = mat('#a8552a'); longSleeve = true; }
    if (kind === 'thug') { shirt = mat(pick(['#2a2a2a', '#3a1a1a', '#1a1a2a', '#2a3a2a'])); jacket = mat(pick(['#1a1a1a', '#3a3a3a'])); longSleeve = true; }
    const face = kind === 'joker' ? mat('#f2f0ec', { roughness: 0.4 }) : skin;
    this.skinMat = skin;
    const B = bat ? 1.25 : kind === 'thug' ? 1.1 : kind === 'gordon' ? 1.12 : 1;
    const armM = longSleeve ? (jacket || shirt) : skin;

    const root = this.root = new THREE.Group();
    const hips = this.hips = G(root, 0, 0.95, 0);
    this.pelvis = M(sphG(0.15), pants, 0, 0, 0, 1.15 * (female ? 1.08 : 1), 0.75, 0.8); hips.add(this.pelvis);
    // spine
    const spine = this.spine = G(hips, 0, 0.06, 0);
    this.torso = spine; // alias for gib
    const abd = M(capG(0.13, 0.14), shirt, 0, 0.14, 0, 1.25 * B, 1, 0.78 * B); spine.add(abd);
    const chest = this.chest = M(capG(0.15, 0.16), shirt, 0, 0.36, 0, 1.3 * B * (female ? 0.92 : 1), 1, 0.8 * B); spine.add(chest);
    if (female && kind !== 'grandma') spine.add(M(sphG(0.07), jacket || shirt, -0.065, 0.36, 0.1, 1, 0.9, 0.8), M(sphG(0.07), jacket || shirt, 0.065, 0.36, 0.1, 1, 0.9, 0.8));
    if (jacket) {
      const jk = M(capG(0.16, 0.34), jacket, 0, 0.26, -0.01, 1.3 * B, 1, 0.82 * B); spine.add(jk);
      spine.add(M(boxG(0.1, 0.36, 0.02), shirt, 0, 0.3, 0.135 * B));
      spine.add(M(boxG(0.28 * B, 0.06, 0.2 * B), jacket, 0, 0.56, -0.02)); // collar
      if (kind === 'gordon' || kind === 'joker') { // long coat tails
        const tail = M(cylG(0.2, 0.26, 0.6), jacket, 0, -0.25, -0.01, B, 1, 0.8 * B); tail.material = mat(jacket.color.getStyle(), { side: THREE.DoubleSide, roughness: 0.8 }); spine.add(tail);
      }
      if (opts.mourn || kind === 'gordon') spine.add(M(boxG(0.035, 0.22, 0.015), mat('#111'), 0, 0.38, 0.14 * B)); // tie
    }
    if (dress) {
      const sk = M(cylG(0.17, 0.3, 0.55), jacket && kind !== 'grandma' ? shirt : (kind === 'grandma' ? pants : shirt), 0, -0.2, 0);
      sk.material = mat(sk.material.color.getStyle(), { side: THREE.DoubleSide, roughness: 0.9 }); hips.add(sk); this.skirt = sk;
    }
    // neck + head
    const neckG = this.neckG = G(spine, 0, 0.56, 0);
    this.neck = M(capG(0.05 * (bat ? 1.4 : 1), 0.06), bat ? shirt : skin, 0, 0.05, 0); neckG.add(this.neck);
    const head = this.head = G(neckG, 0, 0.14, 0.01);
    const skull = this.skull = M(sphG(0.115), face, 0, 0.06, 0, 0.92, 1.08, 1); head.add(skull);
    head.add(M(sphG(0.08), face, 0, -0.02, 0.035, 0.95, 0.8, 0.9)); // jaw
    head.add(M(boxG(0.03, 0.05, 0.04), face, 0, 0.035, 0.11)); // nose
    head.add(M(sphG(0.025), face, -0.105, 0.05, 0, 0.5, 1, 0.8), M(sphG(0.025), face, 0.105, 0.05, 0, 0.5, 1, 0.8)); // ears
    const white = mat('#e8e4dc', { roughness: 0.3 }), pup = mat('#1a120c', { roughness: 0.2 });
    if (!bat) {
      for (const sx of [-1, 1]) {
        head.add(M(sphG(0.018), white, sx * 0.042, 0.075, 0.095, 1, 0.8, 0.6));
        head.add(M(sphG(0.009), pup, sx * 0.042, 0.075, 0.106));
        head.add(M(boxG(0.045, 0.01, 0.015), hair, sx * 0.043, 0.104, 0.1)); // brows
      }
      head.add(M(boxG(0.05, 0.008, 0.01), mat(kind === 'joker' ? '#b00' : '#7a4a44'), 0, -0.01, 0.112)); // mouth
    }
    // hair / headgear by kind
    if (bat) {
      const cowl = mat('#141518', { roughness: 0.45, metalness: 0.2 });
      head.add(M(sphG(0.125), cowl, 0, 0.08, -0.005, 0.95, 1.05, 1.03));
      head.add(M(boxG(0.2, 0.06, 0.06), cowl, 0, 0.07, 0.09)); // brow ridge
      const ear = new THREE.ConeGeometry(0.025, 0.14, 4);
      head.add(M(ear, cowl, -0.07, 0.24, 0), M(ear, cowl, 0.07, 0.24, 0));
      const eyeM = new THREE.MeshBasicMaterial({ color: '#f0f0ff' });
      head.add(M(boxG(0.04, 0.012, 0.01), eyeM, -0.04, 0.05, 0.118), M(boxG(0.04, 0.012, 0.01), eyeM, 0.04, 0.05, 0.118));
      head.add(M(boxG(0.045, 0.006, 0.01), mat('#6a4a44'), 0, -0.03, 0.105));
      // chest emblem
      const emb = new THREE.Shape(); const pts = [[0, .05], [.03, .02], [.07, .045], [.12, .03], [.16, .05], [.13, 0], [.1, -.02], [.06, -.005], [.03, -.03], [0, -.06]];
      emb.moveTo(0, .05); pts.forEach(([x, y]) => emb.lineTo(x, y)); pts.slice().reverse().forEach(([x, y]) => emb.lineTo(-x, y));
      const e = M(new THREE.ShapeGeometry(emb), mat('#050505', { roughness: 0.3 }), 0, 0.4, 0.155 * B, 1.1, 1.1, 1); spine.add(e);
      // abs + belt + pouches
      for (let r = 0; r < 3; r++) for (const sx of [-1, 1]) spine.add(M(boxG(0.07, 0.05, 0.03), shirt, sx * 0.04, 0.2 - r * 0.055, 0.1 * B));
      const gold = mat('#b8960a', { metalness: 0.8, roughness: 0.3 });
      hips.add(M(cylG(0.2, 0.2, 0.06), gold, 0, 0.04, 0, 1.08, 1, 0.8));
      for (let k = 0; k < 6; k++) { const a = -1.2 + k * 0.48; hips.add(M(boxG(0.05, 0.06, 0.04), gold, Math.sin(a) * 0.22, 0.02, Math.cos(a) * 0.17)); }
      // shoulder pads
      for (const sx of [-1, 1]) spine.add(M(sphG(0.09), shirt, sx * 0.24, 0.5, 0, 1.1, 0.8, 1));
      // cape
      const capeGeo = new THREE.PlaneGeometry(0.95, 1.55, 6, 10); capeGeo.translate(0, -0.77, 0);
      this.cape = new THREE.Mesh(capeGeo, mat('#101013', { side: THREE.DoubleSide, roughness: 0.6, unique: true }));
      this.cape.position.set(0, 0.56, -0.17); this.cape.castShadow = true; spine.add(this.cape);
      this.capeBase = capeGeo.attributes.position.array.slice();
    } else if (kind === 'joker') {
      head.add(M(sphG(0.12), hair, 0, 0.12, -0.02, 1, 0.75, 1.05));
      head.add(M(boxG(0.1, 0.02, 0.015), mat('#c01010'), 0, -0.012, 0.11));
      spine.add(M(boxG(0.06, 0.08, 0.02), mat('#e07a10'), 0, 0.52, 0.12)); // bowtie-ish
    } else if (kind === 'grandma') {
      head.add(M(sphG(0.12), hair, 0, 0.1, -0.015, 1, 0.8, 1.05), M(sphG(0.055), hair, 0, 0.13, -0.12));
      const gl = mat('#999', { metalness: 0.8, roughness: 0.3 });
      head.add(M(new THREE.TorusGeometry(0.022, 0.004, 4, 10), gl, -0.042, 0.075, 0.11), M(new THREE.TorusGeometry(0.022, 0.004, 4, 10), gl, 0.042, 0.075, 0.11));
    } else if (kind === 'gordon') {
      head.add(M(sphG(0.118), hair, 0, 0.1, -0.02, 1, 0.65, 1.02));
      head.add(M(boxG(0.08, 0.02, 0.02), hair, 0, 0.012, 0.112));
      const gl = mat('#222', { metalness: 0.5 });
      head.add(M(new THREE.TorusGeometry(0.022, 0.005, 4, 10), gl, -0.042, 0.075, 0.113), M(new THREE.TorusGeometry(0.022, 0.005, 4, 10), gl, 0.042, 0.075, 0.113));
    } else if (kind === 'thug') {
      head.add(M(sphG(0.124), mat('#111'), 0, 0.11, 0, 1, 0.75, 1));
      head.add(M(boxG(0.2, 0.06, 0.02), mat('#1a1a1a'), 0, 0.0, 0.1)); // bandana
    } else if (female) {
      head.add(M(sphG(0.123), hair, 0, 0.09, -0.015, 1, 0.95, 1.05));
      head.add(M(capG(0.08, 0.15), hair, 0, -0.06, -0.07, 1.3, 1, 0.6));
    } else {
      const style = Math.random();
      if (style < 0.15) {} // bald
      else if (style < 0.35) head.add(M(sphG(0.12), mat(pick(['#2a2a2a', '#3a2a1a', '#5a1a1a', '#1a2a3a'])), 0, 0.12, 0, 1, 0.6, 1)); // beanie/cap
      else head.add(M(sphG(0.118), hair, 0, 0.1, -0.012, 1, 0.7, 1.03));
      if (Math.random() < 0.3) head.add(M(sphG(0.075), hair, 0, -0.035, 0.045, 1, 0.7, 0.8)); // beard
    }

    // arms: shoulder group > upper arm, elbow group > forearm, hand
    const mkArm = (sx) => {
      const sh = G(spine, sx * (0.2 * B), 0.5, 0);
      const up = M(capG(0.052 * B, 0.2), jacket || (longSleeve ? shirt : shirt), 0, -0.14, 0); sh.add(up);
      const el = G(sh, 0, -0.29, 0);
      const fo = M(capG(0.046 * B, 0.19), armM, 0, -0.13, 0); el.add(fo);
      const handM = bat ? mat('#111114', { roughness: 0.4 }) : kind === 'joker' ? mat('#e8e8e8') : skin;
      const hand = M(sphG(0.05 * B), handM, 0, -0.29, 0.005, 0.75, 1.15, 0.5); el.add(hand);
      if (bat) for (let f = 0; f < 3; f++) el.add(M(new THREE.ConeGeometry(0.012, 0.07, 3), mat('#111'), sx * 0.05, -0.08 - f * 0.05, -0.02).rotateZ(sx * -1.2));
      sh.elbow = el; sh.hand = hand; return sh;
    };
    this.armL = mkArm(-1); this.armR = mkArm(1);
    const mkLeg = (sx) => {
      const hp = G(hips, sx * 0.09, -0.03, 0);
      hp.add(M(capG(0.075 * B, 0.28), pants, 0, -0.21, 0));
      const kn = G(hp, 0, -0.44, 0);
      kn.add(M(capG(0.058 * B, 0.3), dress && kind !== 'grandma' ? skin : pants, 0, -0.21, 0));
      const foot = M(boxG(0.1 * B, 0.07, 0.24), bat ? mat('#111') : shoe, 0, -0.45, 0.05); kn.add(foot);
      if (kind === 'joker') kn.add(M(capG(0.062, 0.06), mat('#f6f6f6'), 0, -0.36, 0));
      hp.knee = kn; return hp;
    };
    this.legL = mkLeg(-1); this.legR = mkLeg(1);
    if (kind === 'grandma') {
      this.cane = M(capG(0.015, 0.85), mat('#3a2410', { roughness: 0.4 }), 0, -0.7, 0.08); this.armR.elbow.add(this.cane);
      root.scale.setScalar(0.9);
    }
    if (bat) root.scale.setScalar(1.06);
    if (kind === 'woman') root.scale.setScalar(0.95);
    root.scale.multiplyScalar(opts.scale || (0.96 + Math.random() * 0.08));
    this.phase = Math.random() * 10;
    this.pose = 'idle';
    this.cur = JSON.parse(JSON.stringify(BASE));
    this.blend = 12;
  }

  target(speed) {
    const p = this.phase, s = Math.min(1, speed);
    let t = { ...BASE, ...(typeof this.pose === 'string' ? POSES[this.pose] || {} : this.pose) };
    if (this.pose === 'walk' || this.pose === 'idle' || this.pose === 'run' || this.pose === 'fight' || this.pose === 'push') {
      const run = this.pose === 'run';
      const f = run ? 1.3 : 1, amp = (run ? 1.0 : 0.55) * s;
      const sw = Math.sin(p * f);
      t.ll = sw * amp + (t.ll || 0); t.lr = -sw * amp + (t.lr || 0);
      t.kl = Math.max(0, -Math.cos(p * f)) * amp * 1.4 + 0.08; t.kr = Math.max(0, Math.cos(p * f)) * amp * 1.4 + 0.08;
      if (this.pose !== 'fight' && this.pose !== 'push') {
        t.al = [-sw * amp * 0.9, 0, 0.08]; t.ar = [sw * amp * 0.9, 0, -0.08];
        t.el = 0.2 + (run ? 1.3 : 0.3 * s); t.er = t.el;
      }
      t.hy = 0.95 + Math.abs(Math.cos(p * f)) * 0.04 * s * (run ? 2 : 1) - (run ? 0.04 : 0);
      t.sp = run ? 0.3 : 0.05 * s;
      t.spy = -sw * 0.12 * s;
      if (this.pose === 'idle') { t.hdy = Math.sin(p * 0.2) * 0.25; t.sp = Math.sin(p * 0.5) * 0.015; }
    }
    if (this.pose === 'cry') { t.hdx += Math.sin(p * 3) * 0.08; t.sp += Math.sin(p * 3) * 0.04; }
    if (this.pose === 'laugh') { t.hdx += Math.sin(p * 6) * 0.2; t.sp += Math.sin(p * 6) * 0.1; }
    if (this.pose === 'sweep') { const w = Math.sin(p * 1.2); t.al = [-0.8 + w * 0.35, 0.3, 0.3 + w * 0.25]; t.ar = [-0.7 + w * 0.35, -0.3, -0.3 + w * 0.25]; }
    if (this.pose === 'shock') { const j = () => (Math.random() - 0.5) * 0.6; t.al = [t.al[0] + j(), j(), t.al[2] + j()]; t.ar = [t.ar[0] + j(), j(), t.ar[2] + j()]; t.hdx += j(); t.sp += j() * 0.5; }
    if (this.pose === 'choke') { t.ll += Math.sin(p * 9) * 0.4; t.lr -= Math.sin(p * 9) * 0.4; }
    if (this.kind === 'grandma' && !['down', 'corpse', 'facedown', 'held', 'heldhigh', 'sit'].includes(this.pose)) { t.sp += 0.35; t.hdx -= 0.3; t.kl += 0.15; t.kr += 0.15; t.hy -= 0.03; if (this.pose === 'walk' || this.pose === 'idle') { t.ar = [-0.55 + Math.sin(p) * 0.2, 0, -0.08]; t.er = 0.4; } }
    return t;
  }

  animate(dt, speed = 0) {
    this.phase += dt * (4 + speed * 6);
    const t = this.target(speed), c = this.cur;
    const k = Math.min(1, dt * this.blend);
    for (const key in t) {
      if (Array.isArray(t[key])) for (let i = 0; i < 3; i++) c[key][i] += (t[key][i] - c[key][i]) * k;
      else c[key] += (t[key] - c[key]) * k;
    }
    this.apply(c);
    if (this.cape) this.animCape(speed);
  }
  snap() { this.cur = JSON.parse(JSON.stringify(this.target(0))); this.apply(this.cur); }
  apply(c) {
    this.hips.position.y = c.hy; this.hips.rotation.x = c.hx; this.hips.rotation.z = c.hz;
    this.spine.rotation.x = c.sp; this.spine.rotation.y = c.spy;
    this.head.rotation.x = c.hdx; this.head.rotation.y = c.hdy;
    this.armL.rotation.set(c.al[0], c.al[1], c.al[2]); this.armR.rotation.set(c.ar[0], c.ar[1], c.ar[2]);
    this.armL.elbow.rotation.x = -c.el; this.armR.elbow.rotation.x = -c.er;
    this.legL.rotation.set(c.ll, 0, c.lz); this.legR.rotation.set(c.lr, 0, c.rz);
    this.legL.knee.rotation.x = c.kl; this.legR.knee.rotation.x = c.kr;
  }
  animCape(speed) {
    const pos = this.cape.geometry.attributes.position, b = this.capeBase, t = performance.now() / 1000;
    for (let i = 0; i < pos.count; i++) {
      const y = b[i * 3 + 1], x = b[i * 3], d = -y;
      pos.array[i * 3 + 2] = b[i * 3 + 2] - d * d * (0.06 + speed * 0.4) - Math.sin(t * 5 + d * 3 + x * 2) * 0.04 * d * (0.5 + speed);
      pos.array[i * 3] = x * (1 + d * 0.3);
    }
    pos.needsUpdate = true;
  }
  // private material copies so tints don't leak to other characters
  own() {
    if (this._own) return;
    this._own = true;
    this.root.traverse((o) => { if (o.isMesh && !o.material.isMeshBasicMaterial) { o.material = o.material.clone(); o.userData.c0 = o.material.color.clone(); } });
  }
  tint(color, k, emissive) {
    this.own();
    const c = new THREE.Color(color);
    this.root.traverse((o) => {
      if (!o.isMesh || !o.userData.c0) return;
      o.material.color.copy(o.userData.c0).lerp(c, k);
      if (emissive) { o.material.emissive.set(emissive); o.material.emissiveIntensity = k; }
    });
  }
  limbs() { return [this.head, this.armL, this.armR, this.legL, this.legR, this.spine]; }
}
