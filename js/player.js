import * as THREE from 'three';
import { Character } from './character.js';
import { play } from './audio.js';
import { KILLS, BEATS, ITEM_KILLS } from './takedowns.js';

const UP = new THREE.Vector3(0, 1, 0);

export class Player {
  constructor(game) {
    this.game = game;
    this.ch = new Character('batman', { scale: 1, skin: '#d8a888' });
    this.root = this.ch.root; game.scene.add(this.root);
    this.pos = this.root.position;
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0.25; this.facing = 0;
    this.hp = 100; this.alive = true;
    this.punchT = 0; this.combo = 0; this.comboT = 0;
    this.keys = {};
    this.takedown = null;
    this.camPos = new THREE.Vector3(); this.shake = 0;
    this.onGround = true;
    this.recent = [];
  }
  reset(x, z, yaw = 0) { this.pos.set(x, 0.2, z); this.yaw = yaw; this.facing = yaw; this.hp = 100; this.alive = true; this.takedown = null; this.vel.set(0, 0, 0); this.root.visible = true; }

  damage(d, dir) {
    if (!this.alive || this.takedown || this.game.paused || this.game.cutscene || this.game.cheats.enabled('immortal') || this.game.cheats.enabled('pacifist')) return;
    this.hp -= d; this.shake = 0.4; this.game.hurtFlash = 1;
    this.vel.addScaledVector(dir, 4);
    play('punch', { vol: 0.6, rate: 0.8 });
    this.game.gore.spray(this.pos.clone().setY(this.pos.y + 1.6), dir, 10, 4, 0.5);
    if (this.hp <= 0) { this.hp = 0; this.alive = false; this.game.onPlayerDeath(); }
  }

  punch(item = { dmg: 26, heavy: 45, cd: 0.26, id: 'fists' }) {
    if (this.punchT > 0 || this.takedown || !this.alive) return;
    this.punchT = item.cd; this.combo++; this.comboT = 1.1;
    const heavy = this.combo % 4 === 0;
    const mallet = item.id === 'mallet';
    const kickN = this.combo % 3 === 0 && !mallet;
    this.ch.pose = mallet ? 'slam' : heavy ? 'uppercut' : kickN ? 'kick' : (this.combo % 2 ? 'punchL' : 'punchR');
    this.poseT = mallet ? 0.35 : 0.2;
    play('whoosh', { vol: 0.35, rate: mallet ? 0.7 : 1.3 });
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    let best = null, bs = -1;
    for (const n of this.game.npcs.list) {
      if (n.state === 'dead') continue;
      const d = new THREE.Vector3().subVectors(n.pos, this.pos); d.y = 0;
      const l = d.length(); if (l > (mallet ? 3.6 : 3.2)) continue;
      const dot = d.normalize().dot(fwd);
      const score = dot * 2 - l * 0.3;
      if (dot > 0.3 && score > bs) { bs = score; best = n; }
    }
    if (!best) return;
    const dir = new THREE.Vector3().subVectors(best.pos, this.pos).setY(0).normalize();
    this.facing = Math.atan2(dir.x, dir.z);
    const dist = best.pos.distanceTo(this.pos);
    if (dist > 1.3) this.pos.addScaledVector(dir, dist - 1.2);
    setTimeout(() => {
      if (mallet) this.ch.pose = 'hammer';
      const g = this.game.gore;
      const method = item.kill || (heavy ? pickOne(['gib', 'decap', 'headsplode']) : null);
      if (item.id === 'shock') { g.arcs(best.ch, 0.4); g.sparks(best.pos.clone().setY(best.pos.y + 1.2), '#9fd8ff', 12); best.stun(0.8, 'shock'); }
      if (mallet) { g.shockwave(best.pos, 3); if (best.state === 'down') { best.die(dir, g, 1, 'crush'); } }
      const damageBoost = this.game.cheats.enabled('onepunch') ? 4 : 1;
      const res = best.hit((heavy ? item.heavy : item.dmg) * damageBoost, dir, g, heavy || mallet, method);
      play('punch', { vol: heavy || mallet ? 1 : 0.8, rate: heavy ? 0.8 : mallet ? 0.6 : 1 });
      if (heavy || mallet) play('crack', { vol: 0.5 });
      if (kickN && res === 'hit') { best.vel.addScaledVector(dir, 6); best.vel.y = 3; }
      this.game.hitstop = heavy || mallet ? 0.09 : 0.05; this.shake = heavy || mallet ? 0.35 : 0.18;
    }, mallet ? 180 : 70);
  }

  tryTakedown() {
    if (this.takedown || !this.alive) return;
    const n = this.game.npcs.nearestGuilty(this.pos, 3.6);
    if (!n) return;
    if (n.role === 'boss' && n.hp > n.maxHp * 0.35) { this.game.feed('He\'s too slippery. Soften him up first.'); return; }
    const kill = n.sev === 'kill' || n.role === 'boss' || n.role === 'thug';
    const itemId = this.game.items.cur.id;
    let td;
    if (kill && ITEM_KILLS[itemId]) td = ITEM_KILLS[itemId];
    else {
      const pool = (kill ? KILLS : BEATS).filter(t => !this.recent.includes(t.name));
      td = pool[(Math.random() * pool.length) | 0];
      this.recent.push(td.name); if (this.recent.length > 5) this.recent.shift();
    }
    n.state = 'held'; n.vel.set(0, 0, 0); n.frozenT = n.frozenT > 0 ? 99 : 0; n.stunT = 0;
    const dir = new THREE.Vector3().subVectors(n.pos, this.pos).setY(0).normalize();
    this.facing = this.yaw = Math.atan2(dir.x, dir.z);
    n.facing = this.facing + Math.PI; n.root.rotation.y = n.facing;
    const side = new THREE.Vector3(dir.z, 0, -dir.x);
    const p = this, g = this.game;
    const ctx = {
      n, p, g: g.gore, game: g, dir, side, up: UP.clone(),
      head: () => { const v = new THREE.Vector3(); n.ch.head.getWorldPosition(v); return v; },
      sfx: (name, o) => play(name, o),
      shake: (v) => { p.shake = Math.max(p.shake, v); },
      slow: (t) => { g.slowmo = Math.max(g.slowmo, t); },
      kill: (method, power = 1, extra = {}) => { n.state = 'normal'; g.nextFinisher = td.name; n.die(dir.clone().setY(0.3), g.gore, power * 1.4, method, extra); },
      beat: (pose) => { n.state = 'normal'; n.hp = 1; g.nextFinisher = td.name; n.knockDown(g.gore, pose); },
      tintTo: (c, t) => { this.tintAnim = { c, t, k: 0 }; },
      charTo: (t) => { this.tintAnim = { c: '#050505', t, k: 0, em: '#301000' }; },
      heart: () => {
        const h = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), g.gore.meatMats[1]); h.scale.set(1, 1.2, 0.9);
        h.position.set(0, -0.32, 0.05); p.ch.armR.elbow.add(h); g.gore.fountain(n.ch.spine, 2, 80, dir.clone().negate().setY(0.3));
        g.gore.spray(this.pos.clone().setY(this.pos.y + 1.3), dir, 60, 7, 0.4); play('gore');
        setTimeout(() => { g.scene.attach(h); g.gore.addGib(h, dir.clone().multiplyScalar(-2).setY(3), 0.07); }, 1500);
      },
    };
    this.takedown = { n, td, ctx, i: 0, t: 0.25, step: null, camA: Math.random() < 0.5 ? 1 : -1, camT: 0 };
    play('sting', { vol: 0.5, dur: 1.6 });
    g.big(td.name, '');
  }

  updateTakedown(dt) {
    const T = this.takedown, n = T.n, ctx = T.ctx;
    T.t -= dt; T.camT += dt;
    // victim placement
    const vp = T.step?.vp || { f: 1.2 };
    const target = this.pos.clone().addScaledVector(ctx.dir, vp.f ?? 1.2);
    target.y = this.game.world.groundY(target.x, target.z) + (vp.y || 0);
    n.pos.lerp(target, Math.min(1, dt * (vp.spd || 10)));
    n.root.rotation.y = n.facing + (vp.ry || 0);
    this.ch.animate(dt, 0); n.ch.animate(dt, 0);
    if (this.tintAnim) { const a = this.tintAnim; a.k = Math.min(1, a.k + dt / a.t); n.ch.tint(a.c, a.k * 0.85, a.em); if (a.k >= 1) this.tintAnim = null; }
    if (T.t > 0) return;
    const step = T.td.steps[T.i++];
    if (!step) {
      this.tintAnim = null;
      T.td.end(ctx);
      this.shake = 0.7; this.takedown = null; this.game.hitstop = 0.1;
      return;
    }
    T.step = step;
    this.ch.pose = step.b; n.ch.pose = step.v;
    if (step.hit) {
      const head = ctx.head();
      this.game.gore.spray(head, ctx.dir.clone().setY(0.4), step.hit > 1 ? 60 : 25, step.hit > 1 ? 9 : 6, 0.5);
      n.bruise(); play('punch', { vol: 1, rate: 0.85 + Math.random() * 0.3 });
      this.shake = step.hit > 1 ? 0.45 : 0.22; this.game.hitstop = 0.06;
    }
    if (step.crack) { play('crack', { vol: 1, rate: 0.8 + Math.random() * 0.4 }); this.shake = Math.max(this.shake, 0.4); if (step.crack > 1) this.game.gore.spray(ctx.head(), UP, 20, 4, 0.8); }
    if (Math.random() < 0.3) play('scream', { vol: 0.5, dur: 0.8 });
    if (step.fx) step.fx(ctx);
    T.t = step.t;
  }

  update(dt, input) {
    if (this.takedown) { this.updateTakedown(dt); this.updateCam(dt, true); return; }
    this.punchT -= dt; this.comboT -= dt; if (this.comboT < 0) this.combo = 0;
    if (this.alive && this.hp < 100) this.hp = Math.min(100, this.hp + dt * (this.game.cheats.enabled('regen') ? 18 : 3));
    const k = this.keys;
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const mv = new THREE.Vector3();
    if (this.alive) {
      if (k.KeyW || k.ArrowUp) mv.add(fwd); if (k.KeyS || k.ArrowDown) mv.sub(fwd);
      if (k.KeyD || k.ArrowRight) mv.add(right); if (k.KeyA || k.ArrowLeft) mv.sub(right);
    }
    const sprint = k.ShiftLeft || k.ShiftRight;
    const spd = (sprint ? 9.5 : 5) * (this.game.cheats.enabled('speed') ? 2 : 1);
    if (mv.lengthSq() > 0) {
      mv.normalize();
      const f = Math.atan2(mv.x, mv.z);
      let df = f - this.facing; df = Math.atan2(Math.sin(df), Math.cos(df));
      if (this.punchT <= 0) this.facing += df * Math.min(1, dt * 12);
    }
    this.pos.addScaledVector(mv, spd * dt);
    this.pos.addScaledVector(this.vel, dt); this.vel.x *= Math.pow(0.01, dt); this.vel.z *= Math.pow(0.01, dt);
    const gy = this.game.world.groundY(this.pos.x, this.pos.z);
    this.vel.y -= 25 * dt; this.pos.y += this.vel.y * dt;
    if (this.pos.y <= gy) { this.pos.y = gy; this.vel.y = 0; this.onGround = true; } else if (this.pos.y > gy + 0.05) this.onGround = false;
    if (k.Space && this.onGround && this.alive) { this.vel.y = this.game.cheats.enabled('jump') ? 18 : 9; this.onGround = false; play('whoosh', { vol: 0.3 }); }
    this.game.world.collide(this.pos, 0.45);
    this.root.rotation.y = this.facing;
    this.poseT = (this.poseT || 0) - dt;
    if (!this.alive) this.ch.pose = 'down';
    else if (this.poseT <= 0) this.ch.pose = !this.onGround ? 'crouch' : mv.lengthSq() > 0 ? (sprint ? 'run' : 'walk') : 'idle';
    this.ch.animate(dt, mv.lengthSq() > 0 ? (sprint ? 1 : 0.7) : 0);
    this.updateCam(dt, false);
  }

  updateCam(dt, cine) {
    const cam = this.game.camera;
    let target, want;
    if (cine && this.takedown) {
      const T = this.takedown, n = T.n;
      const mid = new THREE.Vector3().addVectors(this.pos, n.pos).multiplyScalar(0.5);
      const a = T.camT * 0.35 * T.camA;
      const side = T.ctx.side.clone().applyAxisAngle(UP, a).multiplyScalar(T.camA);
      const high = n.pos.y - this.pos.y;
      want = mid.clone().addScaledVector(side, 3.4 + Math.max(0, high) * 0.4).add(new THREE.Vector3(0, 1.0 + Math.max(0, high) * 0.5, 0));
      target = mid.clone().setY(mid.y + 1.1 + Math.max(0, high) * 0.5);
      this.camPos.lerp(want, Math.min(1, dt * 6));
    } else {
      target = this.pos.clone().add(new THREE.Vector3(0, 1.9, 0));
      const d = 5.2;
      want = target.clone().add(new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch) * d, Math.sin(this.pitch) * d + 0.3, -Math.cos(this.yaw) * Math.cos(this.pitch) * d));
      if (want.y < 0.4) want.y = 0.4;
      this.camPos.lerp(want, Math.min(1, dt * 14));
    }
    cam.position.copy(this.camPos);
    if (this.shake > 0) { this.shake -= dt; const s = this.shake * 0.35; cam.position.add(new THREE.Vector3((Math.random() - .5) * s, (Math.random() - .5) * s, (Math.random() - .5) * s)); }
    cam.lookAt(target);
  }
}
const pickOne = (a) => a[(Math.random() * a.length) | 0];
