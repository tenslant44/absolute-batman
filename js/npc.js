import * as THREE from 'three';
import { Character, POSES } from './character.js';
import { mat } from './graphics.js';
import { play } from './audio.js';

export const CRIMES = {
  jaywalk: { name: 'Stepped one toe off the crosswalk', sev: 'kill' },
  funeral: { name: 'Did not cry at a funeral', sev: 'kill' },
  chores: { name: "Doesn't help around the house", sev: 'kill' },
  cart: { name: 'Did not return shopping cart', sev: 'kill' },
  litter: { name: 'Dropped a gum wrapper', sev: 'kill' },
  pledge: { name: 'Did not stand for the Pledge', sev: 'beat' },
  grass: { name: 'Standing on the grass', sev: 'beat' },
  slowwalk: { name: 'Walking slowly in the middle of the sidewalk', sev: 'beat' },
  whistle: { name: 'Whistling off-key', sev: 'beat' },
  robbery: { name: 'Armed robbery. Also: no turn signal', sev: 'kill' },
  joker: { name: 'Wore white socks after Labor Day', sev: 'kill' },
};

const labelCache = {};
function labelTex(text, sev) {
  const key = text + sev;
  if (labelCache[key]) return labelCache[key];
  const c = document.createElement('canvas'); c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = sev === 'kill' ? 'rgba(120,0,0,.85)' : 'rgba(120,70,0,.85)';
  g.fillRect(0, 16, 512, 70);
  g.fillStyle = '#fff'; g.font = 'bold 26px monospace'; g.textAlign = 'center';
  g.fillText(text.length > 34 ? text.slice(0, 33) + '…' : text, 256, 48);
  g.font = 'bold 20px monospace'; g.fillStyle = sev === 'kill' ? '#ff6060' : '#ffd060';
  g.fillText(sev === 'kill' ? '— SENTENCE: DEATH —' : '— SENTENCE: BEATING —', 256, 76);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (labelCache[key] = t);
}

const markerMat = new THREE.MeshBasicMaterial({ color: '#ff1a1a' });
const markerMatB = new THREE.MeshBasicMaterial({ color: '#ffb000' });
const markerGeo = new THREE.OctahedronGeometry(0.16, 0);
const rand = (a, b) => a + Math.random() * (b - a);

function perim(r, s) {
  const P = 8 * r; s = ((s % P) + P) % P;
  const side = Math.floor(s / (2 * r)), u = s - side * 2 * r - r;
  switch (side) {
    case 0: return [u, -r, 0, -1];
    case 1: return [r, u, 1, 0];
    case 2: return [-u, r, 0, 1];
    default: return [-r, -u, -1, 0];
  }
}

export class NPC {
  constructor(mgr, kind, role, opts = {}) {
    this.mgr = mgr; this.role = role;
    this.ch = new Character(kind, opts.look || {});
    this.root = this.ch.root; mgr.scene.add(this.root);
    this.pos = this.root.position;
    this.hp = opts.hp || 100; this.maxHp = this.hp;
    this.crime = opts.crime || null;
    this.active = !!opts.active;
    this.state = 'normal';
    this.t = 0; this.speed = 0; this.facing = 0;
    this.vel = new THREE.Vector3();
    this.opts = opts;
    this.marker = new THREE.Mesh(markerGeo, this.crime && CRIMES[this.crime].sev === 'beat' ? markerMatB : markerMat);
    this.marker.position.y = 2.35; this.marker.visible = false; this.root.add(this.marker);
    if (this.crime) {
      this.label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(CRIMES[this.crime].name, CRIMES[this.crime].sev), depthTest: false, transparent: true }));
      this.label.scale.set(3.2, 0.6, 1); this.label.position.y = 2.8; this.label.visible = false; this.label.renderOrder = 10;
      this.root.add(this.label);
    }
    this.hitCd = 0; this.hurtT = 0; this.fleeT = 0; this.bruised = 0;
  }
  get sev() { return this.crime ? CRIMES[this.crime].sev : null; }
  get guilty() { return this.crime && this.active && this.state !== 'down' && this.state !== 'dead'; }
  get wasGuilty() { return !!(this.crime && this.active); }
  place(x, z, face = 0) { this.pos.set(x, this.mgr.world.groundY(x, z), z); this.facing = face; this.root.rotation.y = face; }

  hit(dmg, dir, gore, heavy = false, method) {
    if (this.state === 'dead') return null;
    const head = new THREE.Vector3(); this.ch.head.getWorldPosition(head);
    if (this.frozenT > 0 && dmg > 0) { this.die(dir, gore, 1, 'shatter'); return 'killed'; }
    gore.spray(head, dir.clone().setY(0.3), heavy ? 40 : 18, heavy ? 8 : 5, 0.5);
    if (heavy && Math.random() < 0.5) gore.teeth(head, dir.clone().setY(0.5), 2);
    this.bruise();
    if (this.state === 'down') { gore.pool(this.pos.x, this.pos.z, 0.8); return 'stomp'; }
    this.hp -= dmg;
    this.vel.addScaledVector(dir, heavy ? 7 : 3.5);
    this.hurtT = 0.35;
    if (this.hp <= 0) {
      if (this.guilty && this.sev === 'beat') { this.knockDown(gore); return 'beaten'; }
      this.die(dir, gore, heavy ? 1.4 : 1, method || (heavy ? pickK(['gib', 'decap', 'headsplode']) : pickK(['gib', 'corpse', 'decap']))); return 'killed';
    }
    if (!this.guilty && this.role !== 'thug' && this.role !== 'boss') { this.fleeT = 6; }
    if (Math.random() < 0.3) play('scream', { vol: 0.35, rate: this.ch.kind === 'woman' || this.ch.kind === 'grandma' ? 1.3 : 0.95, dur: 1 });
    return 'hit';
  }
  bruise() {
    if (!this.bruised) { this.ch.skull.material = this.ch.skull.material.clone(); this.bruised = 0; }
    this.bruised = Math.min(1, this.bruised + 0.18);
    this.ch.skull.material.color.lerp(new THREE.Color('#5a1010'), 0.18);
  }
  hideMarks() { this.marker.visible = false; if (this.label) this.label.visible = false; }
  knockDown(gore, pose) {
    this.state = 'down'; this.ch.pose = pose ? { ...POSES.down, ...pose } : 'down'; this.ch.blend = 8; this.hideMarks();
    this.frozenT = 0; this.stunT = 0;
    gore.pool(this.pos.x, this.pos.z, 1.4);
    play('crack', { vol: 0.8 });
    this.mgr.onPunish(this, 'beaten');
  }
  die(dir, gore, power = 1, method = 'gib', extra = {}) {
    if (this.state === 'dead') return;
    this.state = 'dead'; this.deathMethod = method; this.hideMarks();
    const ch = this.ch, f = dir.clone().setY(0).normalize();
    const corpse = (pose = 'corpse') => { this.corpse = true; this.corpseT = 0; ch.pose = typeof pose === 'string' ? pose : { ...POSES.corpse, ...pose }; ch.blend = 7; gore.pool(this.pos.x, this.pos.z, 1.6); };
    switch (method) {
      case 'explode': gore.explosion(this.pos.clone().setY(1), 4); gore.gib(ch, f.multiplyScalar(12).setY(8), 2.6); play('gore'); break;
      case 'decap': { gore.dismember(ch, ['head'], f.clone().multiplyScalar(6 * (extra.headForce || 1)).setY(5 * (extra.headForce || 1))); corpse(); break; }
      case 'snap': corpse({ hdy: 3.1, hdx: 0.6 }); gore.spray(this.pos.clone().setY(1.5), f, 10, 2, 0.5); play('crack', { vol: 1, rate: 0.7 }); break;
      case 'halve': gore.dismember(ch, ['spine'], f.clone().multiplyScalar(4).setY(7)); corpse({ hx: -0.2, hy: 0.5, kl: 1.4, kr: 1.3, ll: -1.3, lr: -1.2 }); break;
      case 'crush': ch.root.scale.y *= 0.18; ch.root.scale.x *= 1.35; ch.root.scale.z *= 1.35; corpse(); gore.pool(this.pos.x, this.pos.z, 2.8);
        for (let i = 0; i < 14; i++) gore.chunk(this.pos.clone().setY(0.3), gore.rv(9), gore.meatMats[i % 5], 0.08); gore.burst(this.pos.clone().setY(0.3), 80, 7); break;
      case 'headsplode': {
        const hp = new THREE.Vector3(); ch.head.getWorldPosition(hp); ch.head.visible = false;
        for (let i = 0; i < 16; i++) gore.chunk(hp, gore.rv(10), i % 4 === 0 ? gore.boneMat : gore.meatMats[i % 5], 0.06);
        gore.teeth(hp, new THREE.Vector3(0, 1, 0), 6); gore.burst(hp, 90, 7); gore.fountain(ch.neckG, 3, 60);
        corpse(ch.pose === 'facedown' ? 'facedown' : 'corpse'); break;
      }
      case 'shatter': gore.shatter(ch, f.multiplyScalar(6)); play('crack', { vol: 1, rate: 1.4 }); break;
      case 'ash': gore.incinerate(ch); break;
      case 'spine': {
        const bone = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.6, 3, 6), gore.boneMat); bone.position.y = -0.4; ch.head.add(bone);
        for (let i = 0; i < 6; i++) { const v = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.06), gore.meatMats[1]); v.position.y = -0.12 * i; bone.add(v); }
        gore.dismember(ch, ['head'], f.clone().multiplyScalar(-2).setY(6)); corpse({ hx: -1.5, sp: 0.4 }); break;
      }
      case 'corpse': corpse(extra.pose || 'corpse'); break;
      default: gore.gib(ch, f.multiplyScalar(10).setY(4), power);
    }
    play('gore', { vol: 1 }); if (method !== 'snap') play('crack', { vol: 0.7, rate: 0.8 });
    this.mgr.onPunish(this, 'killed', method);
  }
  freeze(t = 6) { this.frozenT = t; this.ch.tint('#bfe6ff', 0.75, '#12384f'); this.ch.pose = 'frozen'; this.ch.snap(); }
  stun(t = 3, pose = 'hurt') { this.stunT = t; this.stunPose = pose; }

  update(dt, player) {
    if (this.state === 'dead') {
      if (this.corpse && this.corpseT < 3) {
        this.corpseT += dt; this.ch.animate(dt, 0);
        if (this.vel.lengthSq() > 0.01) { this.pos.addScaledVector(this.vel, dt); this.vel.multiplyScalar(Math.pow(0.02, dt)); this.mgr.world.collide(this.pos, 0.35); }
        const gy = this.mgr.world.groundY(this.pos.x, this.pos.z); this.pos.y += (gy - this.pos.y) * Math.min(1, dt * 8);
      }
      return;
    }
    this.t += dt; this.hitCd -= dt; this.hurtT -= dt;
    const ch = this.ch;
    // knockback (with airborne arcs from explosions / grapples)
    if (this.state !== 'held' && (this.vel.lengthSq() > 0.01 || this.pos.y > this.mgr.world.groundY(this.pos.x, this.pos.z) + 0.05)) {
      this.pos.addScaledVector(this.vel, dt);
      const gy = this.mgr.world.groundY(this.pos.x, this.pos.z);
      if (this.pos.y > gy) this.vel.y -= 22 * dt;
      if (this.pos.y <= gy) { this.pos.y = gy; if (this.vel.y < -9 && this.state !== 'held') { this.hp -= 40; this.mgr.gore.pool(this.pos.x, this.pos.z, 1); play('crack'); if (this.hp <= 0) { if (this.guilty && this.sev === 'beat') this.knockDown(this.mgr.gore); else this.die(this.vel.clone(), this.mgr.gore, 1.5, 'gib'); return; } } this.vel.y = 0; }
      this.vel.x *= Math.pow(0.02, dt); this.vel.z *= Math.pow(0.02, dt);
      this.mgr.world.collide(this.pos, 0.35);
    }
    const toP = new THREE.Vector3().subVectors(player.pos, this.pos); toP.y = 0;
    const dP = toP.length();
    // marker / label
    const det = this.mgr.detective;
    if (this.crime) {
      const show = this.guilty && (dP < 32 || det > 0.5);
      this.marker.visible = show; this.marker.rotation.y += dt * 3; this.marker.position.y = 2.35 + Math.sin(this.t * 4) * 0.08;
      this.label.visible = this.guilty && det > 0.5 && dP < 80;
    }
    if (this.mgr.frozen) { ch.animate(dt, 0); return; }
    if (this.state === 'down') { ch.animate(dt, 0); if (Math.random() < dt * 0.5) this.mgr.gore.spray(this.pos.clone().setY(0.4), new THREE.Vector3(0, 1, 0), 2, 1.5, 1); return; }
    if (this.state === 'held') { ch.animate(dt, 0); return; }
    if (this.frozenT > 0) { this.frozenT -= dt; if (this.frozenT <= 0) { this.ch.tint('#bfe6ff', 0, '#000'); } return; }
    if (this.stunT > 0) { this.stunT -= dt; ch.pose = this.stunPose; ch.animate(dt, 0); return; }
    if (this.hurtT > 0) { ch.pose = 'hurt'; ch.animate(dt, 0); return; }

    // flee
    if (this.fleeT > 0 && this.role !== 'thug' && this.role !== 'boss') {
      this.fleeT -= dt;
      const away = toP.clone().multiplyScalar(-1).normalize();
      this.moveDir(away, 5.5, dt); ch.pose = 'run'; ch.animate(dt, 1);
      if (this.fleeT <= 0) this.resetRole();
      return;
    }
    this.roleUpdate(dt, player, toP, dP);
  }
  moveDir(d, spd, dt) {
    this.pos.x += d.x * spd * dt; this.pos.z += d.z * spd * dt;
    this.mgr.world.collide(this.pos, 0.35);
    this.pos.y = this.mgr.world.groundY(this.pos.x, this.pos.z);
    const f = Math.atan2(d.x, d.z);
    let df = f - this.facing; df = Math.atan2(Math.sin(df), Math.cos(df));
    this.facing += df * Math.min(1, dt * 8); this.root.rotation.y = this.facing;
  }
  faceTo(f, dt) { let df = f - this.facing; df = Math.atan2(Math.sin(df), Math.cos(df)); this.facing += df * Math.min(1, dt * 5); this.root.rotation.y = this.facing; }
  resetRole() { if (this.home) { this.returning = true; } }

  goTo(x, z, spd, dt) {
    const d = new THREE.Vector3(x - this.pos.x, 0, z - this.pos.z), l = d.length();
    if (l < 0.3) return true;
    this.moveDir(d.divideScalar(l), spd, dt); return false;
  }

  roleUpdate(dt, player, toP, dP) {
    const ch = this.ch, o = this.opts;
    if (this.returning && this.home) {
      if (this.goTo(this.home.x, this.home.z, 2.2, dt)) { this.returning = false; this.place(this.home.x, this.home.z, this.home.face || 0); }
      else { ch.pose = 'walk'; ch.animate(dt, 0.6); return; }
    }
    switch (this.role) {
      case 'walker': {
        const loop = o.loop; const slow = this.crime === 'slowwalk';
        const spd = slow ? 0.45 : (this.ch.kind === 'grandma' ? 0.9 : 1.5 + (o.spdVar || 0));
        o.s += o.dir * spd * dt;
        // jaywalk excursion
        if (this.crime === 'jaywalk' || o.canJay) {
          o.jt = (o.jt ?? rand(3, 12)) - dt;
          if (o.jt < 0 && !o.jay) { o.jay = 1; o.jayT = 0; }
        }
        let [lx, lz, nx, nz] = perim(loop.r, o.s);
        let out = 0;
        if (o.jay) {
          o.jayT += dt; o.s -= o.dir * spd * dt; // stop moving along
          const T = o.jayT;
          out = T < 1.2 ? T / 1.2 * 1.9 : T < 3.5 ? 1.9 : Math.max(0, 1.9 - (T - 3.5));
          if (T > 1.1 && T < 3.5) { ch.pose = 'toe'; if (this.crime === 'jaywalk' && !this.active) { this.active = true; this.mgr.onCrime(this); } }
          else ch.pose = 'walk';
          if (T > 5.5) { o.jay = 0; o.jt = rand(10, 25); }
        } else ch.pose = 'walk';
        const tx = loop.x + lx + nx * out, tz = loop.z + lz + nz * out;
        const d = new THREE.Vector3(tx - this.pos.x, 0, tz - this.pos.z); const l = d.length();
        if (l > 0.01) this.moveDir(d.divideScalar(l), Math.min(l / dt, 6), dt);
        if (o.jay && ch.pose === 'toe') this.faceTo(Math.atan2(nx, nz), dt);
        ch.animate(dt, ch.pose === 'walk' ? (slow ? 0.25 : 0.6) : 0);
        // litter
        if (this.crime === 'litter') {
          o.lt = (o.lt ?? rand(4, 10)) - dt;
          if (o.lt < 0 && !this.active) { this.active = true; this.mgr.dropLitter(this.pos); this.mgr.onCrime(this); }
        }
        break;
      }
      case 'mourner': {
        ch.pose = this.crime === 'funeral' ? 'smug' : 'cry';
        this.faceTo(this.home.face, dt); ch.animate(dt, 0);
        if (ch.pose === 'cry' && Math.random() < dt * 3) {
          const h = new THREE.Vector3(); ch.head.getWorldPosition(h);
          this.mgr.tear(h);
        }
        break;
      }
      case 'pledger': {
        ch.pose = this.crime === 'pledge' ? 'sit' : 'pledge';
        this.faceTo(this.home.face, dt); ch.animate(dt, 0); break;
      }
      case 'lounger': ch.pose = 'lounge'; this.faceTo(this.home.face, dt); ch.animate(dt, 0); break;
      case 'sweeper': ch.pose = 'sweep'; this.faceTo(this.home.face + Math.sin(this.t * 0.6) * 0.8, dt); ch.animate(dt, 0.6); break;
      case 'grass': ch.pose = 'idle'; this.faceTo(this.home.face + Math.sin(this.t * 0.3), dt); ch.animate(dt, 0); break;
      case 'shopper': {
        // push cart to a destination; offenders abandon it
        const cart = o.cart;
        if (!o.phase) o.phase = 'push';
        if (o.phase === 'push') {
          const done = this.goTo(o.dest.x, o.dest.z, 1.4, dt);
          const fwd = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
          cart.position.set(this.pos.x + fwd.x * 1, this.pos.y, this.pos.z + fwd.z * 1); cart.rotation.y = this.facing;
          ch.pose = 'push'; ch.animate(dt, 0.6);
          if (done) { o.phase = 'leave'; if (this.crime === 'cart') { this.active = true; this.mgr.onCrime(this); } }
        } else if (o.phase === 'leave') {
          const done = this.goTo(o.car.x, o.car.z, 1.3, dt);
          ch.pose = done ? 'idle' : 'walk'; ch.animate(dt, done ? 0 : 0.6);
          if (done && !this.crime) { o.phase = 'reset'; }
        } else { ch.pose = 'idle'; ch.animate(dt, 0); }
        break;
      }
      case 'thug': case 'boss': {
        if (this.mgr.pacifist) { ch.pose = 'idle'; ch.animate(dt, 0); break; }
        const aggro = dP < (this.role === 'boss' ? 60 : 30);
        if (this.role === 'boss' && o.laughT !== undefined) {
          o.laughT -= dt;
          if (o.laughT < 0) { o.laughT = rand(6, 10); play('laugh', { vol: 0.6, dur: 3 }); }
        }
        if (!aggro) { ch.pose = 'idle'; ch.animate(dt, 0); break; }
        const dir = toP.clone().normalize();
        const reach = 1.6;
        if (this.role === 'boss' && this.hp < this.maxHp && dP < 7 && Math.random() < dt * 0.6) {
          // Joker dodges away
          this.vel.addScaledVector(dir, -9); play('laugh', { vol: 0.4, dur: 1.5, offset: 1 });
        }
        if (dP > reach) { this.moveDir(dir, this.role === 'boss' ? 4.2 : 4, dt); ch.pose = 'fight'; ch.animate(dt, 1); }
        else {
          this.faceTo(Math.atan2(dir.x, dir.z), dt);
          ch.pose = this.t % 1.2 < 0.25 ? 'punchR' : 'fight'; ch.animate(dt, 0);
          if (this.hitCd <= 0 && player.alive) {
            this.hitCd = 1.2 + Math.random() * 0.4;
            setTimeout(() => { if (this.state === 'normal' && this.pos.distanceTo(player.pos) < reach + 0.5) player.damage(this.role === 'boss' ? 14 : 9, dir); }, 220);
          }
        }
        break;
      }
      default: ch.pose = 'idle'; ch.animate(dt, 0);
    }
  }
  remove() { this.root.removeFromParent(); if (this.opts.cart && this.opts.cart.parent) this.opts.cart.removeFromParent(); }
}

export class NPCManager {
  constructor(scene, world, gore) {
    this.scene = scene; this.world = world; this.gore = gore;
    this.list = []; this.litter = []; this.tears = [];
    this.detective = 0;
    this.onPunish = () => {}; this.onCrime = () => {};
    this.tearGeo = new THREE.SphereGeometry(0.025, 4, 3);
    this.tearMat = new THREE.MeshBasicMaterial({ color: '#9fd0ff' });
  }
  add(kind, role, opts) { const n = new NPC(this, kind, role, opts); this.list.push(n); return n; }
  clear() { this.list.forEach(n => n.remove()); this.list = []; this.litter.forEach(l => l.removeFromParent()); this.litter = []; }
  dropLitter(p) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, 0.1), mat('#e8e0d0'));
    w.position.set(p.x, this.world.groundY(p.x, p.z) + 0.02, p.z); w.rotation.y = Math.random() * 3; this.scene.add(w); this.litter.push(w);
  }
  tear(h) {
    const m = new THREE.Mesh(this.tearGeo, this.tearMat);
    m.position.copy(h).add(new THREE.Vector3((Math.random() - .5) * .2, 0.1, (Math.random() - .5) * .2));
    m.userData.v = -0.5; this.scene.add(m); this.tears.push(m);
  }
  update(dt, player) {
    for (const n of this.list) n.update(dt, player);
    for (let i = this.tears.length - 1; i >= 0; i--) {
      const t = this.tears[i]; t.userData.v -= 9 * dt; t.position.y += t.userData.v * dt;
      if (t.position.y < 0.3) { t.removeFromParent(); this.tears.splice(i, 1); }
    }
  }
  scare(pos, r = 20) {
    for (const n of this.list) if (n.state === 'normal' && n.role !== 'thug' && n.role !== 'boss' && n.pos.distanceTo(pos) < r && !n.guilty) n.fleeT = 4 + Math.random() * 3;
  }
  nearestGuilty(pos, maxD = 2.6) {
    let best = null, bd = maxD;
    for (const n of this.list) {
      if (!(n.guilty || ((n.role === 'thug' || n.role === 'boss') && n.state === 'normal'))) continue;
      const d = n.pos.distanceTo(pos); if (d < bd) { bd = d; best = n; }
    }
    return best;
  }
  alive() { return this.list.filter(n => n.state !== 'dead'); }

  // ---------- population builders ----------
  populate(cfg) {
    const W = this.world, rnd = Math.random;
    const loops = W.loops.slice();
    const kinds = ['man', 'man', 'woman', 'woman', 'grandma', 'man'];
    const walkers = cfg.walkers ?? 30;
    for (let i = 0; i < walkers; i++) {
      const loop = loops[(rnd() * loops.length) | 0];
      let crime = null;
      const r = rnd();
      const kind = rnd() < (cfg.grandmaRate ?? 0.18) ? 'grandma' : kinds[(rnd() * 4) | 0];
      if (kind === 'grandma' && r < (cfg.jayRate ?? 0.6)) crime = 'jaywalk';
      else if (r < (cfg.litterRate ?? 0.12)) crime = 'litter';
      else if (r < (cfg.litterRate ?? 0.12) + (cfg.slowRate ?? 0.08)) crime = 'slowwalk';
      else if (r < (cfg.litterRate ?? 0.12) + (cfg.slowRate ?? 0.08) + (cfg.whistleRate ?? 0.06)) { crime = 'whistle'; }
      const n = this.add(kind, 'walker', { crime, active: crime === 'slowwalk' || crime === 'whistle', loop, s: rnd() * 8 * loop.r, dir: rnd() < 0.5 ? 1 : -1, spdVar: rnd() * 0.5 });
      const [lx, lz] = perim(loop.r, n.opts.s); n.place(loop.x + lx, loop.z + lz);
    }
    if (cfg.funeral !== false) {
      const spots = W.spots.funeral; const bad = cfg.funeralBad ?? 2;
      const idx = spots.map((_, i) => i).sort(() => rnd() - 0.5);
      spots.forEach((s, i) => {
        const guilty = idx.indexOf(i) < bad;
        const n = this.add(pickK(['man', 'woman', 'grandma', 'man']), 'mourner', { crime: guilty ? 'funeral' : null, active: guilty, look: { mourn: true } });
        n.home = s; n.place(s.x, s.z, s.face);
      });
    }
    if (cfg.pledge !== false) {
      const spots = W.spots.pledge.slice(0, cfg.pledgeCount ?? 12); const bad = cfg.pledgeBad ?? 2;
      const idx = spots.map((_, i) => i).sort(() => rnd() - 0.5);
      spots.forEach((s, i) => {
        const guilty = idx.indexOf(i) < bad;
        const n = this.add(pickK(['man', 'woman', 'man']), 'pledger', { crime: guilty ? 'pledge' : null, active: guilty });
        n.home = s; n.place(s.x, s.z, s.face);
      });
    }
    if (cfg.houses !== false) {
      const lazyRate = cfg.lazyRate ?? 0.5;
      for (const s of W.spots.lounge) {
        if (rnd() < 0.2 && !cfg.allHouses) continue;
        const lazy = rnd() < lazyRate;
        const sw = this.add(pickK(['woman', 'man', 'woman']), 'sweeper', {});
        sw.home = { x: s.choreX, z: s.choreZ, face: s.face > 0 ? 0 : Math.PI }; sw.place(s.choreX, s.choreZ, sw.home.face);
        const broom = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.3, 0.05), mat('#6a4a2a')); broom.position.set(0, -0.35, 0.2); broom.rotation.x = 0.6; sw.ch.armR.elbow.add(broom);
        if (lazy) {
          const l = this.add('man', 'lounger', { crime: 'chores', active: true });
          l.home = { x: s.x, z: s.z, face: s.face > 0 ? 0 : Math.PI }; l.place(s.x, s.z, l.home.face);
        } else {
          const h = this.add(pickK(['man', 'woman']), 'sweeper', {});
          h.home = { x: s.choreX - 2.5, z: s.choreZ, face: s.face > 0 ? 0 : Math.PI }; h.place(h.home.x, h.home.z, h.home.face);
        }
      }
    }
    if (cfg.grass !== false) {
      const spots = W.spots.grass.slice().sort(() => rnd() - 0.5).slice(0, cfg.grassCount ?? 5);
      for (const s of spots) { const n = this.add(pickK(['man', 'woman', 'grandma']), 'grass', { crime: 'grass', active: true }); n.home = { ...s, face: rnd() * 6 }; n.place(s.x, s.z, n.home.face); }
    }
    if (cfg.carts !== false) {
      const corral = W.spots.corral;
      const n = cfg.cartCount ?? 5;
      for (let i = 0; i < n; i++) {
        const s = W.spots.carts[i % W.spots.carts.length];
        const bad = rnd() < (cfg.cartRate ?? 0.6);
        const cart = makeCart(); this.scene.add(cart);
        const car = { x: s.x + rand(-4, 4), z: s.z + rand(2, 5) };
        const shopper = this.add(pickK(['man', 'woman']), 'shopper', {
          crime: bad ? 'cart' : null, cart, car,
          dest: bad ? { x: s.x + rand(-3, 3), z: s.z } : { x: corral.x + rand(-2, 2), z: corral.z + 1.2 },
        });
        shopper.place(corral.x - 12 + rand(-4, 4), corral.z - 6 + rand(-2, 2));
      }
    }
  }
  spawnThugs(n, near) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, r = 10 + Math.random() * 6;
      const t = this.add('thug', 'thug', { crime: 'robbery', active: true, hp: 70 });
      t.place(near.x + Math.cos(a) * r, near.z + Math.sin(a) * r); out.push(t);
    }
    return out;
  }
}
const pickK = (a) => a[(Math.random() * a.length) | 0];
function makeCart() {
  const g = new THREE.Group(), m = mat('#9a9a9a', { metalness: 0.8, roughness: 0.3 });
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 1), mat('#777', { metalness: 0.8, roughness: 0.3, wireframe: true }));
  b.position.y = 0.7; g.add(b);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.9), m); base.position.y = 0.2; g.add(base);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.05), m); handle.position.set(0, 1, -0.55); g.add(handle);
  g.traverse(o => o.castShadow = true);
  return g;
}
