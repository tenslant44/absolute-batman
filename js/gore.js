import * as THREE from 'three';
import { mat } from './graphics.js';

const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), tmpE = new THREE.Euler();
const UP = new THREE.Vector3(0, 1, 0);

export class Gore {
  constructor(scene, world, quality) {
    this.scene = scene; this.world = world;
    const q = quality;
    this.maxP = q === 'normal' ? 2500 : q === 'psx' ? 900 : 300;
    this.maxD = q === 'normal' ? 500 : 200;
    const pm = new THREE.MeshStandardMaterial({ color: '#6a0000', roughness: 0.25, metalness: 0.1, emissive: '#200000' });
    this.pMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), pm, this.maxP);
    this.pMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.pMesh.frustumCulled = false;
    this.pMesh.count = 0; scene.add(this.pMesh);
    this.parts = [];
    const dm = new THREE.MeshStandardMaterial({ color: '#3a0000', roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.92, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const dg = new THREE.CircleGeometry(0.5, 10); dg.rotateX(-Math.PI / 2);
    this.dMesh = new THREE.InstancedMesh(dg, dm, this.maxD);
    this.dMesh.frustumCulled = false; this.dMesh.receiveShadow = true;
    for (let i = 0; i < this.maxD; i++) { tmpM.makeScale(0, 0, 0); this.dMesh.setMatrixAt(i, tmpM); }
    scene.add(this.dMesh);
    this.dIdx = 0;
    this.gibs = [];
    this.meatMats = [mat('#7a0a0a', { roughness: 0.3 }), mat('#a01818', { roughness: 0.3 }), mat('#5a0606', { roughness: 0.3 }), mat('#d8d0c0'), mat('#9a3040', { roughness: 0.3 })];
    this.chunkGeo = new THREE.BoxGeometry(1, 1, 1);
    this.maxGibs = q === 'normal' ? 260 : q === 'psx' ? 140 : 60;
    this.fountains = []; this.fx = [];
    this.iceMat = new THREE.MeshStandardMaterial({ color: '#bfe6ff', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.8, emissive: '#1a4a6a' });
    this.ashMat = mat('#151210', { roughness: 1 });
    this.boneMat = mat('#e0d8c4', { roughness: 0.6 });
    this.toothMat = mat('#f4f0e0', { roughness: 0.2 });
  }
  groundAt(x, z) { return this.world.groundY(x, z) + 0.015; }

  spray(pos, dir, n = 20, speed = 5, spread = 0.6, size = 1) {
    for (let i = 0; i < n; i++) {
      if (this.parts.length >= this.maxP) this.parts.shift();
      const v = new THREE.Vector3(
        dir.x + (Math.random() - 0.5) * spread * 2, dir.y + (Math.random() - 0.2) * spread * 2, dir.z + (Math.random() - 0.5) * spread * 2
      ).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.9));
      this.parts.push({ p: pos.clone(), v, s: (0.03 + Math.random() * 0.07) * size, life: 3 });
    }
  }
  burst(pos, n = 80, speed = 9) { this.spray(pos, UP, n, speed, 1.4, 1.3); }
  decal(x, z, r) {
    const y = this.groundAt(x, z) + Math.random() * 0.004;
    tmpE.set(0, Math.random() * 6.28, 0); tmpQ.setFromEuler(tmpE);
    tmpS.set(r * (0.7 + Math.random() * 0.6), 1, r * (0.7 + Math.random() * 0.6));
    tmpM.compose(tmpP.set(x, y, z), tmpQ, tmpS);
    this.dMesh.setMatrixAt(this.dIdx, tmpM); this.dIdx = (this.dIdx + 1) % this.maxD;
    this.dMesh.instanceMatrix.needsUpdate = true;
  }
  pool(x, z, r = 1.5) { for (let i = 0; i < 5; i++) this.decal(x + (Math.random() - 0.5) * r, z + (Math.random() - 0.5) * r, r * (0.5 + Math.random() * 0.6)); }

  // tear a character apart
  gib(ch, force, power = 1) {
    ch.root.updateMatrixWorld(true);
    const center = new THREE.Vector3(); ch.torso.getWorldPosition(center);
    for (const limb of ch.limbs()) {
      this.scene.attach(limb);
      const v = force.clone().multiplyScalar(0.6 + Math.random() * 0.7 * power)
        .add(new THREE.Vector3((Math.random() - 0.5) * 10, 3 + Math.random() * 8, (Math.random() - 0.5) * 10).multiplyScalar(power));
      this.addGib(limb, v, 0.3);
    }
    ch.root.visible = false;
    const nChunks = Math.round(18 * power);
    for (let i = 0; i < nChunks; i++) {
      const m = new THREE.Mesh(this.chunkGeo, this.meatMats[(Math.random() * this.meatMats.length) | 0]);
      const s = 0.06 + Math.random() * 0.14;
      m.scale.set(s * (0.6 + Math.random()), s * (0.6 + Math.random()), s * (0.6 + Math.random()));
      m.position.copy(center).add(new THREE.Vector3((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.5));
      m.castShadow = true; this.scene.add(m);
      const v = force.clone().multiplyScalar(0.5 + Math.random()).add(new THREE.Vector3((Math.random() - 0.5) * 14, 2 + Math.random() * 10, (Math.random() - 0.5) * 14).multiplyScalar(power));
      this.addGib(m, v, 0.08);
    }
    // eyeballs
    for (let i = 0; i < 2; i++) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), mat('#eee'));
      e.position.copy(center).y += 0.6; this.scene.add(e);
      this.addGib(e, new THREE.Vector3((Math.random() - 0.5) * 8, 6 + Math.random() * 5, (Math.random() - 0.5) * 8), 0.05);
    }
    this.burst(center, Math.round(160 * power), 10 * Math.sqrt(power));
    this.spray(center, force.clone().normalize(), Math.round(80 * power), 12, 0.5, 1.4);
    this.pool(center.x, center.z, 2.5 * power);
  }
  addGib(mesh, v, r) {
    this.gibs.push({ mesh, v, w: new THREE.Vector3((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20), r, t: 0, rest: false, bleed: 1.5 });
    while (this.gibs.length > this.maxGibs) { const g = this.gibs.shift(); g.mesh.removeFromParent(); }
  }

  update(dt) {
    for (let i = this.fountains.length - 1; i >= 0; i--) {
      const f = this.fountains[i]; f.t -= dt;
      if (f.t <= 0 || !f.obj.parent) { this.fountains.splice(i, 1); continue; }
      f.obj.getWorldPosition(tmpP);
      const d = new THREE.Vector3(0, 1, 0); if (f.dir) d.copy(f.dir); else d.applyQuaternion(f.obj.getWorldQuaternion(tmpQ));
      const pulse = 0.5 + 0.5 * Math.sin(f.t * 14);
      this.spray(tmpP, d, Math.ceil(f.rate * dt * (0.4 + pulse)), 3 + pulse * 4 * Math.min(1, f.t), 0.25, 0.9);
    }
    for (let i = this.fx.length - 1; i >= 0; i--) { const e = this.fx[i]; e.t += dt; if (e.update(e, dt) === false || e.t > e.dur) { e.mesh && e.mesh.removeFromParent(); this.fx.splice(i, 1); } }
    // particles
    let n = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i];
      q.v.y -= 22 * dt; q.p.addScaledVector(q.v, dt); q.life -= dt;
      const gy = this.groundAt(q.p.x, q.p.z);
      if (q.p.y < gy || q.life < 0) {
        if (q.p.y < gy + 0.3 && Math.random() < 0.28) this.decal(q.p.x, q.p.z, 0.1 + q.s * 3 + Math.random() * 0.25);
        this.parts.splice(i, 1); continue;
      }
    }
    for (const q of this.parts) {
      tmpS.set(q.s, q.s * (1 + q.v.length() * 0.06), q.s);
      tmpQ.setFromUnitVectors(UP, tmpP.copy(q.v).normalize());
      tmpM.compose(q.p, tmpQ, tmpS);
      this.pMesh.setMatrixAt(n++, tmpM);
    }
    this.pMesh.count = n; this.pMesh.instanceMatrix.needsUpdate = true;
    // gibs
    for (const g of this.gibs) {
      g.t += dt;
      if (g.rest) continue;
      g.v.y -= 22 * dt;
      g.mesh.position.addScaledVector(g.v, dt);
      g.mesh.rotation.x += g.w.x * dt; g.mesh.rotation.y += g.w.y * dt; g.mesh.rotation.z += g.w.z * dt;
      const gy = this.groundAt(g.mesh.position.x, g.mesh.position.z) + g.r * 0.5;
      if (g.mesh.position.y < gy) {
        g.mesh.position.y = gy;
        if (Math.abs(g.v.y) > 2.5) { this.decal(g.mesh.position.x, g.mesh.position.z, 0.35 + g.r); this.spray(g.mesh.position, UP, 3, 2, 1); }
        g.v.y *= -0.3; g.v.x *= 0.6; g.v.z *= 0.6; g.w.multiplyScalar(0.5);
        if (g.v.lengthSq() < 0.5) { g.rest = true; }
      }
      if (g.bleed > 0) { g.bleed -= dt; if (Math.random() < 0.5) this.parts.push({ p: g.mesh.position.clone(), v: new THREE.Vector3((Math.random() - .5), 0.5, (Math.random() - .5)), s: 0.04, life: 1 }); }
      const tmp = { x: g.mesh.position.x, z: g.mesh.position.z, y: g.mesh.position.y };
      this.world.collide(tmp, 0.1); g.mesh.position.x = tmp.x; g.mesh.position.z = tmp.z;
    }
  }
  // ---------- extended gore ----------
  fountain(obj, dur = 3, rate = 60, dir) { this.fountains.push({ obj, t: dur, rate, dir }); }
  chunk(pos, v, m, s = 0.1, r) {
    const c = new THREE.Mesh(this.chunkGeo, m);
    c.scale.set(s * (0.6 + Math.random()), s * (0.6 + Math.random()), s * (0.6 + Math.random()));
    c.position.copy(pos); c.castShadow = true; this.scene.add(c); this.addGib(c, v, r ?? s * 0.6); return c;
  }
  rv(k = 1) { return new THREE.Vector3((Math.random() - 0.5) * k, Math.random() * k * 0.8, (Math.random() - 0.5) * k); }
  teeth(pos, dir, n = 4) {
    for (let i = 0; i < n; i++) this.chunk(pos, dir.clone().multiplyScalar(4 + Math.random() * 3).add(this.rv(5)), this.toothMat, 0.025, 0.015);
    this.spray(pos, dir, 12, 5, 0.4);
  }
  // detach specific parts: names from ['head','armL','armR','legL','legR','spine']
  dismember(ch, parts, force, fountain = true) {
    ch.root.updateMatrixWorld(true);
    for (const name of parts) {
      const part = ch[name]; if (!part || part.parent === this.scene) continue;
      const anchor = part.parent; const joint = new THREE.Object3D(); joint.position.copy(part.position); anchor.add(joint);
      this.scene.attach(part);
      this.addGib(part, force.clone().multiplyScalar(0.7 + Math.random() * 0.6).add(this.rv(6)).add(new THREE.Vector3(0, 3, 0)), 0.25);
      const wp = new THREE.Vector3(); joint.getWorldPosition(wp);
      this.spray(wp, force.clone().normalize().setY(0.6), 50, 7, 0.5, 1.2);
      this.chunk(wp, this.rv(6), this.boneMat, 0.06);
      this.chunk(wp, this.rv(6), this.meatMats[0], 0.08);
      if (fountain) this.fountain(joint, 3.5, 70);
      // bleeding stump on the flying part too
      const s2 = new THREE.Object3D(); part.add(s2); this.fountain(s2, 1.5, 25);
    }
  }
  shatter(ch, force) {
    ch.root.updateMatrixWorld(true);
    const c = new THREE.Vector3(); ch.spine.getWorldPosition(c);
    const n = shared_q_count(this.maxGibs, 40);
    for (let i = 0; i < n; i++) {
      const p = c.clone().add(new THREE.Vector3((Math.random() - .5) * 0.5, Math.random() * 1.3 - 0.7, (Math.random() - .5) * 0.4));
      const m = Math.random() < 0.25 ? this.meatMats[(Math.random() * 3) | 0] : this.iceMat;
      this.chunk(p, force.clone().multiplyScalar(0.3 + Math.random() * 0.5).add(this.rv(12)), m, 0.06 + Math.random() * 0.12);
    }
    ch.root.visible = false;
    this.spray(c, new THREE.Vector3(0, 1, 0), 30, 5, 1);
  }
  incinerate(ch) {
    ch.root.updateMatrixWorld(true);
    const c = new THREE.Vector3(); ch.spine.getWorldPosition(c);
    for (let i = 0; i < 26; i++) {
      const p = c.clone().add(new THREE.Vector3((Math.random() - .5) * 0.5, Math.random() * 1.4 - 0.8, (Math.random() - .5) * 0.4));
      this.chunk(p, this.rv(3), Math.random() < 0.2 ? this.boneMat : this.ashMat, 0.05 + Math.random() * 0.1);
    }
    for (let i = 0; i < 10; i++) this.smoke(c.clone().add(this.rv(1)), '#111', 1.2);
    ch.root.visible = false; this.decal(c.x, c.z, 1);
  }
  smoke(pos, color = '#333', size = 1, dur = 2.5) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.4, 7, 5), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false }));
    m.position.copy(pos); this.scene.add(m);
    const v = new THREE.Vector3((Math.random() - .5) * 0.6, 0.8 + Math.random(), (Math.random() - .5) * 0.6);
    this.fx.push({ mesh: m, t: 0, dur, update: (e, dt) => { m.position.addScaledVector(v, dt); const k = e.t / dur; m.scale.setScalar(size * (0.5 + k * 2)); m.material.opacity = 0.5 * (1 - k); } });
  }
  explosion(pos, r = 4) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshBasicMaterial({ color: '#ffb040', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.copy(pos); this.scene.add(m);
    const light = new THREE.PointLight('#ff9030', 400, r * 6, 2); light.position.copy(pos).y += 1; this.scene.add(light);
    this.fx.push({ mesh: m, t: 0, dur: 0.6, update: (e) => { const k = e.t / 0.6; m.scale.setScalar(r * (0.3 + k)); m.material.opacity = 1 - k; m.material.color.setHSL(0.08 - k * 0.08, 1, 0.6 - k * 0.3); light.intensity = 400 * (1 - k); if (k >= 0.99) light.removeFromParent(); } });
    for (let i = 0; i < 12; i++) this.smoke(pos.clone().add(this.rv(2)), '#1a1612', 1.5 + Math.random(), 3.5);
    for (let i = 0; i < 6; i++) this.decal(pos.x + (Math.random() - .5) * r, pos.z + (Math.random() - .5) * r, 0.8);
  }
  sparks(pos, color = '#9fd8ff', n = 20) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.chunkGeo, new THREE.MeshBasicMaterial({ color }));
      m.scale.set(0.02, 0.02, 0.15); m.position.copy(pos); this.scene.add(m);
      const v = this.rv(10);
      this.fx.push({ mesh: m, t: 0, dur: 0.3 + Math.random() * 0.3, update: (e, dt) => { v.y -= 20 * dt; m.position.addScaledVector(v, dt); m.lookAt(m.position.clone().add(v)); } });
    }
  }
  // electric arcs crawling over a character for a duration
  arcs(ch, dur = 1.5, color = '#a0e0ff') {
    const g = new THREE.BufferGeometry(); const n = 12; const arr = new Float32Array(n * 6);
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending }));
    l.frustumCulled = false; this.scene.add(l);
    const c = new THREE.Vector3();
    this.fx.push({ mesh: l, t: 0, dur, update: () => {
      if (!ch.root.visible) return false;
      ch.spine.getWorldPosition(c);
      let px = c.x, py = c.y, pz = c.z;
      for (let i = 0; i < n; i++) {
        arr[i * 6] = px; arr[i * 6 + 1] = py; arr[i * 6 + 2] = pz;
        px = c.x + (Math.random() - .5) * 0.8; py = c.y + (Math.random() - .5) * 1.6; pz = c.z + (Math.random() - .5) * 0.8;
        arr[i * 6 + 3] = px; arr[i * 6 + 4] = py; arr[i * 6 + 5] = pz;
      }
      g.attributes.position.needsUpdate = true;
    } });
  }
  shockwave(pos, r = 5) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 32), new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.copy(pos).y += 0.1; this.scene.add(m);
    this.fx.push({ mesh: m, t: 0, dur: 0.4, update: (e) => { const k = e.t / 0.4; m.scale.setScalar(r * k + 0.1); m.material.opacity = 0.6 * (1 - k); } });
  }
  clear() {
    for (const e of this.fx) e.mesh && e.mesh.removeFromParent(); this.fx = []; this.fountains = [];
    for (const g of this.gibs) g.mesh.removeFromParent();
    this.gibs = []; this.parts = [];
    for (let i = 0; i < this.maxD; i++) { tmpM.makeScale(0, 0, 0); this.dMesh.setMatrixAt(i, tmpM); }
    this.dMesh.instanceMatrix.needsUpdate = true;
  }
  dispose() { this.clear(); this.pMesh.removeFromParent(); this.dMesh.removeFromParent(); }
}

function shared_q_count(max, n) { return Math.min(n, Math.max(12, Math.floor(max / 4))); }
