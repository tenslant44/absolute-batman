import * as THREE from 'three';
import { Character } from './character.js';
import { play } from './audio.js';

const $ = (id) => document.getElementById(id);

export class Cutscenes {
  constructor(game) {
    this.game = game; this.active = null;
    addEventListener('keydown', (e) => {
      if (!this.active) return;
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); this.next(); }
      if (e.code === 'Escape') { e.preventDefault(); this.skipAll = true; this.next(); }
    });
    addEventListener('mousedown', () => { if (this.active) this.next(); });
  }
  next() { if (this.active) this.active.advance = true; }

  async play(shots) {
    if (!shots || !shots.length) return;
    const g = this.game;
    this.skipAll = false;
    $('letterbox').classList.remove('hidden'); $('hud').classList.add('hidden');
    g.cutscene = true;
    const actors = [];
    for (const shot of shots) {
      if (this.skipAll) break;
      const a = g.anchors[shot.at] || new THREE.Vector3();
      const off = (v) => new THREE.Vector3(a.x + v[0], (v[1] || 0), a.z + v[2]);
      if (shot.bat) { g.player.reset(a.x + shot.bat[0], a.z + shot.bat[1], shot.bat[2]); g.player.pos.y = g.world.groundY(g.player.pos.x, g.player.pos.z); g.player.ch.pose = 'idle'; }
      for (const s of shot.actors || []) {
        const c = new Character(s.kind); c.root.position.set(a.x + s.p[0], g.world.groundY(a.x + s.p[0], a.z + s.p[1]), a.z + s.p[1]);
        c.root.rotation.y = s.face || 0; c.pose = s.pose || 'idle'; g.scene.add(c.root); actors.push(c);
      }
      if (shot.fx === 'thunder') g.lightning(1);
      if (shot.fx === 'gore') {
        for (const c of actors) { g.gore.gib(c, new THREE.Vector3(0, 6, 0), 2.5); }
        play('gore', { vol: 1 }); play('scream', { vol: 0.6 });
      }
      play('sting', { vol: 0.25, dur: 2 });
      const from = off(shot.cam), to = shot.move ? off(shot.move) : from.clone(), look = off(shot.look);
      const lines = shot.lines || [['', '']];
      const total = lines.reduce((s, l) => s + 1.8 + l[1].length * 0.045, 0);
      let t = 0;
      for (const [who, text] of lines) {
        if (this.skipAll) break;
        $('speaker').textContent = who; $('line').textContent = '';
        const dur = 1.8 + text.length * 0.045;
        const state = this.active = { advance: false };
        let lt = 0;
        await new Promise((res) => {
          const step = () => {
            const dt = g.frameDt;
            lt += dt; t += dt;
            const k = Math.min(1, t / total), e = k * k * (3 - 2 * k);
            g.camera.position.lerpVectors(from, to, e); g.camera.lookAt(look);
            for (const c of actors) c.animate(dt, 0);
            const shown = Math.min(text.length, Math.floor(lt * 55));
            $('line').textContent = text.slice(0, shown);
            if (state.advance) {
              if (shown < text.length) { lt = 99; state.advance = false; }
              else return res();
            }
            if (lt > dur + 1.2) return res();
            g.cutsceneTick = step;
          };
          g.cutsceneTick = step;
        });
      }
    }
    for (const c of actors) c.root.removeFromParent();
    g.cutsceneTick = null; this.active = null; g.cutscene = false;
    $('letterbox').classList.add('hidden');
  }
}
