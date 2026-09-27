import * as THREE from 'three';
import { mat } from './graphics.js';
import { play } from './audio.js';

// type: melee (modifies punches), throw (projectile), tool (instant)
export const ITEMS = [
  { id: 'fists', name: 'Fists', type: 'melee', max: 0, dmg: 26, heavy: 45, cd: 0.26, kill: null, desc: 'Classic.' },
  { id: 'batarang', name: 'Batarang', type: 'throw', max: 6, recharge: 2, cd: 0.35, desc: 'Sharp. Decapitates on kill.' },
  { id: 'gel', name: 'Explosive Gel', type: 'throw', max: 3, recharge: 7, cd: 0.8, desc: 'Sticks. Detonates. Rains people.' },
  { id: 'grapple', name: 'Grapple Hook', type: 'tool', max: 4, recharge: 3, cd: 0.6, desc: 'Yank a citizen into your fist.' },
  { id: 'freeze', name: 'Freeze Grenade', type: 'throw', max: 2, recharge: 8, cd: 0.8, desc: 'Freeze a crowd. Kick it apart.' },
  { id: 'shock', name: 'Shock Gauntlets', type: 'melee', max: 0, dmg: 34, heavy: 60, cd: 0.3, kill: 'ash', desc: 'Punches that cook.' },
  { id: 'mallet', name: 'Bat-Mallet', type: 'melee', max: 0, dmg: 70, heavy: 110, cd: 0.7, kill: 'crush', desc: 'Justice, but flatter.' },
  { id: 'chainsaw', name: 'Bat-Chainsaw', type: 'hold', max: 0, cd: 0, kill: 'halve', desc: 'Hold to saw. Disturbingly effective.' },
  { id: 'flamer', name: 'Bat-Flamer', type: 'hold', max: 0, cd: 0, kill: 'ash', desc: 'Hold to purify.' },
  { id: 'smoke', name: 'Smoke Pellet', type: 'tool', max: 3, recharge: 6, cd: 1, desc: 'Everyone nearby chokes. Free hits.' },
];

const UP = new THREE.Vector3(0, 1, 0);

export class Items {
  constructor(game) {
    this.game = game; this.sel = 0; this.proj = []; this.cd = 0;
    this.charges = ITEMS.map(i => i.max); this.rc = ITEMS.map(() => 0);
    this.holding = false; this.sawSnd = 0;
    this.buildHotbar();
    this.buildModels();
  }
  get cur() { return ITEMS[this.sel]; }
  reset() { this.charges = ITEMS.map(i => i.max); this.rc = ITEMS.map(() => 0); this.clearProj(); this.select(0); }
  clearProj() { for (const p of this.proj) p.mesh.removeFromParent(); this.proj = []; }

  buildHotbar() {
    const bar = document.getElementById('hotbar'); bar.innerHTML = '';
    this.slots = ITEMS.map((it, i) => {
      const d = document.createElement('div'); d.className = 'slot';
      d.innerHTML = `<span class="k">${(i + 1) % 10}</span><span class="n">${it.name}</span><span class="c"></span><div class="cdbar"></div>`;
      bar.appendChild(d); return d;
    });
  }
  buildModels() {
    const dark = mat('#1a1a1c', { metalness: 0.7, roughness: 0.35 });
    const steel = mat('#8a8c90', { metalness: 0.9, roughness: 0.25 });
    const mk = (fn) => { const g = new THREE.Group(); fn(g); g.traverse(o => o.castShadow = true); return g; };
    this.batGeo = (() => {
      const s = new THREE.Shape(); s.moveTo(0, 0.02);
      [[0.05, 0.04], [0.12, 0.02], [0.2, 0.05], [0.16, -0.02], [0.1, -0.03], [0.05, -0.01], [0, -0.05]].forEach(([x, y]) => s.lineTo(x, y));
      [[-0.05, -0.01], [-0.1, -0.03], [-0.16, -0.02], [-0.2, 0.05], [-0.12, 0.02], [-0.05, 0.04]].forEach(([x, y]) => s.lineTo(x, y));
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.01, bevelEnabled: false }); g.rotateX(-Math.PI / 2); return g;
    })();
    this.models = {
      batarang: mk(g => { const m = new THREE.Mesh(this.batGeo, dark); m.rotation.z = Math.PI / 2; g.add(m); }),
      mallet: mk(g => {
        const h = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.9, 8), mat('#2a1a10')); h.position.y = -0.4; g.add(h);
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.42), dark); head.position.set(0, -0.85, 0); g.add(head);
        const band = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.23, 0.05), mat('#b8960a', { metalness: 0.8 })); band.position.set(0, -0.85, 0.12); g.add(band);
      }),
      chainsaw: mk(g => {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.36), mat('#1a1a1a', { roughness: 0.4 })); body.position.set(0, -0.05, 0.1); g.add(body);
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.7), steel); blade.position.set(0, -0.05, 0.6); g.add(blade); g.blade = blade;
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.05, 0.2), mat('#b8960a')); stripe.position.set(0, 0.05, 0.1); g.add(stripe);
      }),
      flamer: mk(g => {
        const t = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8), dark); t.rotation.x = Math.PI / 2; t.position.set(0, -0.05, 0.3); g.add(t);
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), new THREE.MeshBasicMaterial({ color: '#4af' })); tip.position.set(0, -0.05, 0.62); g.add(tip);
      }),
    };
  }
  select(i) {
    if (i < 0 || i >= ITEMS.length) return;
    this.sel = i;
    this.slots.forEach((s, k) => s.classList.toggle('sel', k === i));
    const hand = this.game.player.ch.armR.elbow;
    for (const m of Object.values(this.models)) m.removeFromParent();
    const m = this.models[this.cur.id];
    if (m) { m.position.set(0, -0.3, 0.02); m.rotation.set(this.cur.id === 'mallet' ? 0 : -Math.PI / 2 + 0.2, 0, 0); if (this.cur.id === 'mallet') m.rotation.x = Math.PI / 2 - 0.3; hand.add(m); }
    const glow = this.cur.id === 'shock';
    for (const arm of [this.game.player.ch.armL, this.game.player.ch.armR]) {
      const h = arm.hand; if (!h.userData.m0) { h.userData.m0 = h.material; h.userData.m1 = new THREE.MeshStandardMaterial({ color: '#224', emissive: '#4ab8ff', emissiveIntensity: 2 }); }
      h.material = glow ? h.userData.m1 : h.userData.m0;
    }
    if (this.game.mode === 'play') this.game.feed(`${this.cur.name} — ${this.cur.desc}`, true);
  }
  scroll(d) { this.select((this.sel + d + ITEMS.length) % ITEMS.length); }

  aimDir() {
    const d = new THREE.Vector3(); this.game.camera.getWorldDirection(d);
    d.y += 0.12; return d.normalize();
  }
  use() {
    const it = this.cur, p = this.game.player;
    if (it.type === 'melee') { p.punch(it); return; }
    if (it.type === 'hold') { this.holding = true; return; }
    if (this.cd > 0 || p.takedown || !p.alive) return;
    const idx = this.sel;
    const infinite = this.game.cheats.enabled('ammo');
    if (it.max && this.charges[idx] <= 0 && !infinite) { this.game.feed(`${it.name}: recharging`); return; }
    this.cd = it.cd; if (it.max && !infinite) this.charges[idx]--;
    const start = p.pos.clone().add(new THREE.Vector3(0, 1.6, 0));
    const dir = this.aimDir();
    p.facing = Math.atan2(dir.x, dir.z); p.ch.pose = 'throw'; p.poseT = 0.3;
    play('whoosh', { vol: 0.5, rate: 1.2 });
    if (it.id === 'batarang') this.spawn('batarang', start, dir.multiplyScalar(32), { g: 2 });
    if (it.id === 'gel') this.spawn('gel', start, dir.multiplyScalar(16), { g: 18 });
    if (it.id === 'freeze') this.spawn('freeze', start, dir.multiplyScalar(16), { g: 18 });
    if (it.id === 'grapple') this.grapple(start, dir);
    if (it.id === 'smoke') this.smoke(p.pos);
  }
  release() { this.holding = false; }

  spawn(type, pos, vel, o) {
    let mesh;
    if (type === 'batarang') { mesh = new THREE.Mesh(this.batGeo, mat('#1a1a1c', { metalness: 0.7, roughness: 0.3 })); mesh.scale.setScalar(1.4); }
    else if (type === 'gel') mesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: '#40ff60' }));
    else mesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshStandardMaterial({ color: '#9fe0ff', emissive: '#2a8aff', emissiveIntensity: 1.5 }));
    mesh.position.copy(pos); this.game.scene.add(mesh);
    this.proj.push({ type, mesh, vel, g: o.g, t: 0, stuck: false });
  }
  grapple(start, dir) {
    const g = this.game;
    let best = null, bs = 0.93;
    for (const n of g.npcs.list) {
      if (n.state === 'dead') continue;
      const d = n.pos.clone().add(new THREE.Vector3(0, 1.2, 0)).sub(start); const l = d.length();
      if (l > 30 || l < 2) continue;
      const dot = d.normalize().dot(dir); if (dot > bs) { bs = dot; best = n; }
    }
    // rope visual
    const end = best ? best.pos.clone().setY(best.pos.y + 1.3) : start.clone().addScaledVector(dir, 25);
    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#111' })); g.scene.add(line);
    g.gore.fx.push({ mesh: line, t: 0, dur: 0.35, update: () => { const a = geo.attributes.position; if (best) { a.setXYZ(1, best.pos.x, best.pos.y + 1.3, best.pos.z); } const p = g.player.pos; a.setXYZ(0, p.x, p.y + 1.6, p.z); a.needsUpdate = true; } });
    if (!best) return;
    const to = g.player.pos.clone().sub(best.pos); const l = to.length(); to.normalize();
    best.vel.copy(to.multiplyScalar(Math.min(22, l * 1.9))).setY(5);
    best.pos.y += 0.1; best.stun(1.6, 'hurt'); best.hurtT = 0.8;
    if (!best.guilty && best.role !== 'thug') best.fleeT = 5;
    play('whoosh', { vol: 0.8, rate: 0.7 });
    g.feed('GET OVER HERE.');
  }
  smoke(pos) {
    const g = this.game;
    for (let i = 0; i < 26; i++) g.gore.smoke(pos.clone().add(new THREE.Vector3((Math.random() - .5) * 8, Math.random() * 1.5, (Math.random() - .5) * 8)), '#555', 2.2, 4);
    for (const n of g.npcs.list) if (n.state === 'normal' && n.pos.distanceTo(pos) < 7) n.stun(4, 'hurt');
    play('whoosh', { vol: 1, rate: 0.5 });
  }
  detonate(p, type) {
    const g = this.game, pos = p.mesh.position.clone();
    p.dead = true; p.mesh.removeFromParent();
    if (type === 'gel') {
      g.gore.explosion(pos, 5); g.gore.shockwave(pos, 8); play('gore', { vol: 1, rate: 0.6 }); play('crack', { vol: 1, rate: 0.5 });
      g.player.shake = 0.9;
      for (const n of g.npcs.list) {
        if (n.state === 'dead') continue;
        const d = n.pos.clone().sub(pos); const l = d.length();
        if (l < 4) n.die(d.setY(1).normalize(), g.gore, 2, 'explode');
        else if (l < 8) { n.vel.add(d.normalize().multiplyScalar(14).setY(9)); n.pos.y += 0.1; n.hit(30, d.clone().setY(0).normalize(), g.gore, true, 'gib'); }
      }
      if (g.player.pos.distanceTo(pos) < 4) g.player.damage(20, g.player.pos.clone().sub(pos).setY(0).normalize());
    } else if (type === 'freeze') {
      g.gore.shockwave(pos, 5); g.gore.sparks(pos, '#cfefff', 40);
      for (let i = 0; i < 10; i++) g.gore.smoke(pos.clone().add(g.gore.rv(3)), '#cfe8ff', 1.5, 2);
      play('crack', { vol: 0.8, rate: 1.6 });
      for (const n of g.npcs.list) if (n.state === 'normal' && n.pos.distanceTo(pos) < 5.5) n.freeze(7);
    }
  }

  update(dt) {
    const g = this.game;
    this.cd -= dt;
    ITEMS.forEach((it, i) => {
      if (it.max && this.game.cheats.enabled('ammo')) this.charges[i] = it.max;
      if (it.max && this.charges[i] < it.max) { this.rc[i] += dt; if (this.rc[i] >= it.recharge) { this.rc[i] = 0; this.charges[i]++; } }
      const s = this.slots[i]; const c = s.children[2];
      const txt = it.max ? `${this.charges[i]}/${it.max}` : ''; if (c.textContent !== txt) c.textContent = txt;
      s.children[3].style.width = it.max && this.charges[i] < it.max ? (this.rc[i] / it.recharge * 100) + '%' : '0';
    });
    // continuous weapons
    const p = g.player;
    const m = this.models.chainsaw;
    if (this.holding && (this.cur.id === 'chainsaw' || this.cur.id === 'flamer') && p.alive && !p.takedown) {
      p.ch.pose = 'aim'; p.poseT = 0.1;
      const fwd = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw)); p.facing = p.yaw;
      const saw = this.cur.id === 'chainsaw';
      const range = saw ? 2.2 : 7;
      this.sawSnd -= dt;
      if (this.sawSnd < 0) { this.sawSnd = saw ? 0.12 : 0.25; play(saw ? 'punch' : 'whoosh', { vol: saw ? 0.2 : 0.4, rate: saw ? 2.5 : 0.6, dur: 0.2 }); }
      if (saw) { m.blade.position.x = (Math.random() - 0.5) * 0.02; p.shake = Math.max(p.shake, 0.05); }
      else {
        const tip = p.pos.clone().add(new THREE.Vector3(0, 1.4, 0)).addScaledVector(fwd, 0.9);
        for (let i = 0; i < 3; i++) this.flame(tip, fwd);
      }
      for (const n of g.npcs.list) {
        if (n.state === 'dead' || n.state === 'held') continue;
        const d = n.pos.clone().sub(p.pos); d.y = 0; const l = d.length();
        if (l > range || d.normalize().dot(fwd) < (saw ? 0.5 : 0.8)) continue;
        if (saw) {
          const c = n.pos.clone().setY(n.pos.y + 1.1);
          g.gore.spray(c, fwd.clone().negate().setY(0.8), 6, 6, 0.6);
          n.hp -= 110 * dt; n.hurtT = 0.2; n.bruise && Math.random() < 0.1 && n.bruise();
          if (Math.random() < dt * 1.5 && n.state === 'normal') { const part = ['armL', 'armR'][Math.random() * 2 | 0]; if (n.ch[part].parent !== g.scene) g.gore.dismember(n.ch, [part], fwd.clone().multiplyScalar(4).setY(3)); }
        } else {
          n.hp -= 70 * dt; n.hurtT = 0.2; n.fleeT = 3;
          n.burn = (n.burn || 0) + dt; n.ch.tint('#0a0806', Math.min(0.9, n.burn * 0.5));
          if (Math.random() < dt * 4) g.gore.smoke(n.pos.clone().setY(n.pos.y + 1.5), '#222', 0.6, 1.5);
          if (Math.random() < dt * 2) play('scream', { vol: 0.5, dur: 1 });
        }
        if (n.hp <= 0) {
          if (n.guilty && n.sev === 'beat') n.knockDown(g.gore);
          else n.die(fwd, g.gore, 1.2, saw ? (Math.random() < 0.5 ? 'halve' : 'gib') : 'ash');
        }
      }
    }
    // projectiles
    for (const pr of this.proj) {
      if (pr.dead) continue;
      pr.t += dt;
      if (pr.stuck) { if (pr.type === 'gel') { pr.mesh.scale.setScalar(1 + Math.sin(pr.t * 20) * 0.2); if (pr.t > pr.fuse) this.detonate(pr, 'gel'); } continue; }
      pr.vel.y -= pr.g * dt;
      pr.mesh.position.addScaledVector(pr.vel, dt);
      if (pr.type === 'batarang') { pr.mesh.rotation.y += dt * 30; if (pr.t > 1.5) { pr.dead = true; pr.mesh.removeFromParent(); continue; } }
      // hit npc
      for (const n of g.npcs.list) {
        if (n.state === 'dead') continue;
        const c = n.pos.clone(); c.y += 1.1;
        if (c.distanceTo(pr.mesh.position) > 0.7) continue;
        if (pr.type === 'batarang') {
          const dir = pr.vel.clone().setY(0).normalize();
          const head = c.y + 0.5 < pr.mesh.position.y + 0.3;
          const res = n.hit(head ? 70 : 45, dir, g.gore, true, head ? 'decap' : pickOne(['decap', 'gib', 'corpse']));
          if (res === 'hit' && Math.random() < 0.35) g.gore.dismember(n.ch, [pickOne(['armL', 'armR'])], dir.clone().multiplyScalar(5));
          g.gore.sparks(pr.mesh.position, '#fff', 6);
          play('punch', { vol: 0.7, rate: 1.4 });
          pr.dead = true; pr.mesh.removeFromParent();
        } else if (pr.type === 'gel') { pr.stuck = true; pr.fuse = 1.2; pr.mesh.position.copy(c); n.stun(1.2, 'hurt'); pr.attach = n; }
        else this.detonate(pr, 'freeze');
        break;
      }
      if (pr.dead) continue;
      const gy = g.world.groundY(pr.mesh.position.x, pr.mesh.position.z);
      const tmp = pr.mesh.position.clone(); g.world.collide(tmp, 0.1);
      const wall = tmp.distanceToSquared(pr.mesh.position) > 1e-6;
      if (pr.mesh.position.y < gy + 0.05 || wall) {
        if (pr.type === 'batarang') { pr.dead = true; g.gore.sparks(pr.mesh.position, '#fff', 8); pr.mesh.removeFromParent(); }
        else if (pr.type === 'gel') { pr.stuck = true; pr.fuse = 1.6; pr.mesh.position.y = Math.max(gy + 0.05, pr.mesh.position.y); }
        else this.detonate(pr, 'freeze');
      }
    }
    // gel stuck to a person follows them
    for (const pr of this.proj) if (pr.attach && !pr.dead && pr.attach.state !== 'dead') pr.mesh.position.copy(pr.attach.pos).y += 1.1;
    this.proj = this.proj.filter(p => !p.dead);
  }
  flame(pos, fwd) {
    const g = this.game;
    const m = new THREE.Mesh(g.gore.chunkGeo, new THREE.MeshBasicMaterial({ color: '#ffa030', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.copy(pos); g.scene.add(m);
    const v = fwd.clone().multiplyScalar(11 + Math.random() * 4).add(new THREE.Vector3((Math.random() - .5) * 2.5, (Math.random() - .3) * 2, (Math.random() - .5) * 2.5));
    g.gore.fx.push({ mesh: m, t: 0, dur: 0.6, update: (e, dt) => { m.position.addScaledVector(v, dt); v.y += 3 * dt; const k = e.t / 0.6; m.scale.setScalar(0.15 + k * 0.9); m.material.opacity = 1 - k; m.material.color.setHSL(0.1 - k * 0.1, 1, 0.55 - k * 0.3); } });
  }
}
const pickOne = (a) => a[(Math.random() * a.length) | 0];
