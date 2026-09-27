import * as THREE from 'three';
import { Graphics, QUALITY } from './graphics.js';
import { World, CELL, BLOCK } from './world.js';
import { Gore } from './gore.js';
import { NPCManager, CRIMES } from './npc.js';
import { Player } from './player.js';
import { Cutscenes } from './cutscene.js';
import { CHAPTERS, MISSIONS } from './story.js';
import { initAudio, play } from './audio.js';
import { Items, ITEMS } from './items.js';
import { CheatCodes } from './cheats.js';

const $ = (id) => document.getElementById(id);
const INNOCENT_QUIPS = [
  'INNOCENT. They hadn\'t done anything. Yet.', 'INNOCENT. Pre-crime is still crime-adjacent.', 'INNOCENT. Alfred sighs audibly.',
  'INNOCENT. "Collateral," you whisper.', 'INNOCENT. They looked like they were thinking about it.',
];
const METHOD_NAMES = { gib: 'DISASSEMBLED', decap: 'DECAPITATED', snap: 'NECK SNAPPED', halve: 'BISECTED', crush: 'FLATTENED', headsplode: 'HEAD POPPED',
  shatter: 'SHATTERED', ash: 'CREMATED', spine: 'SPINE REMOVED', corpse: 'EXECUTED', explode: 'DETONATED' };
const RANKS = ['Concerned Citizen', 'Neighborhood Watch', 'HOA President', 'Hall Monitor', 'Vigilante', 'The Dark Knight', 'The Petty Knight', 'God of Minor Infractions'];

class Game {
  constructor() {
    this.gfx = new Graphics($('game'));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 400);
    addEventListener('resize', () => { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); });
    this.setupLights();
    this.world = new World(this.scene, this.gfx);
    this.gore = new Gore(this.scene, this.world, this.gfx.qname);
    this.npcs = new NPCManager(this.scene, this.world, this.gore);
    this.npcs.onPunish = (n, res, method) => this.onPunish(n, res, method);
    this.player = new Player(this);
    this.cuts = new Cutscenes(this);
    this.items = new Items(this);
    const W = this.world, P = W.blocksOfType('X')[0];
    const v = (b, dx = 0, dz = 0) => new THREE.Vector3(b.x + dx, 0, b.z + dz);
    this.anchors = {
      plaza: v(P), street: v(P, CELL / 2, 0), funeral: v(W.blocksOfType('C')[0]), houses: v(W.blocksOfType('H')[0]),
      market: v(W.blocksOfType('M')[0]), park: v(W.blocksOfType('P')[0]),
    };
    this.spawnOff = { street: [0, 0], plaza: [0, 20.5], funeral: [0, 20.5], houses: [0, 0], market: [-4, 20.5], park: [0, 20.5] };
    this.buildRain(); this.buildSky();
    this.mode = 'menu'; this.paused = false; this.cutscene = false;
    this.cheats = new CheatCodes(this);
    this.slowmo = 0; this.hitstop = 0; this.hurtFlash = 0; this.flash = 0; this.detective = false; this.detK = 0;
    this.frameDt = 0.016; this.last = performance.now(); this.acc = 0; this.t = 0;
    this.lightT = 0;
    this.setupInput(); this.setupMenus();
    this.npcs.populate({ walkers: 25 });
    this.player.root.visible = false;
    requestAnimationFrame((t) => this.loop(t));
  }

  setupLights() {
    const s = this.scene;
    this.bg = new THREE.Color('#0a0d14');
    s.background = this.bg.clone();
    s.fog = new THREE.FogExp2(this.bg.getHex(), 0.03);
    this.hemi = new THREE.HemisphereLight('#5a6a8a', '#1a120c', 0.55); s.add(this.hemi);
    this.moon = new THREE.DirectionalLight('#9fb4e0', 1.1);
    this.moon.position.set(30, 60, 20);
    this.moon.shadow.mapSize.set(2048, 2048);
    const sc = this.moon.shadow.camera; sc.left = sc.bottom = -35; sc.right = sc.top = 35; sc.near = 1; sc.far = 150;
    this.moon.shadow.bias = -0.0008; this.moon.castShadow = true;
    s.add(this.moon); s.add(this.moon.target);
    this.pLights = [];
    for (let i = 0; i < 6; i++) { const l = new THREE.PointLight('#ffc070', 25, 18, 2); s.add(l); this.pLights.push(l); }
  }
  buildRain() {
    const n = 5000;
    const g = new THREE.BufferGeometry();
    this.rainPos = new Float32Array(n * 6);
    this.rainOff = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { this.rainOff[i * 3] = (Math.random() - .5) * 60; this.rainOff[i * 3 + 1] = Math.random() * 30; this.rainOff[i * 3 + 2] = (Math.random() - .5) * 60; }
    g.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    this.rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#8090b0', transparent: true, opacity: 0.35 }));
    this.rain.frustumCulled = false; this.scene.add(this.rain);
  }
  buildSky() {
    const moon = new THREE.Mesh(new THREE.CircleGeometry(8, 24), new THREE.MeshBasicMaterial({ color: '#c8d0e0', fog: false }));
    moon.position.set(120, 110, -200); moon.lookAt(0, 0, 0); this.scene.add(moon);
    this.skyMoon = moon;
    this.sun = new THREE.Mesh(new THREE.CircleGeometry(10, 24), new THREE.MeshBasicMaterial({ color: '#ffe6a0', fog: false }));
    this.sun.position.set(-140, 100, -180); this.sun.lookAt(0, 0, 0); this.sun.visible = false; this.scene.add(this.sun);
    // bat signal
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    const grad = g.createRadialGradient(128, 128, 20, 128, 128, 128); grad.addColorStop(0, 'rgba(255,240,180,.9)'); grad.addColorStop(1, 'rgba(255,240,180,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#000'; g.font = '130px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🦇', 128, 136);
    const sig = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    sig.position.set(-60, 95, -140); sig.lookAt(0, 0, 0); this.scene.add(sig);
    this.batSignal = sig;
    // objective beacon
    this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 200, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: '#ff1010', transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    this.beacon.position.y = 100; this.beacon.visible = false; this.scene.add(this.beacon);
  }
  lightning(k = 1) { this.flash = k; setTimeout(() => play('sting', { vol: 0.35 * k, rate: 0.55, dur: 3 }), 300 + Math.random() * 500); }

  // ---------------- input ----------------
  setupInput() {
    const canvas = $('game');
    addEventListener('keydown', (e) => {
      this.player.keys[e.code] = true;
      if (this.mode !== 'play' || this.cutscene || this.paused) return;
      if (e.code === 'KeyE') this.player.tryTakedown();
      if (e.code === 'KeyQ') this.detective = !this.detective;
      if (e.code === 'KeyR') this.cheats.interact();
      if (e.code === 'KeyF') this.player.punch(this.items.cur.type === 'melee' ? this.items.cur : undefined);
      if (e.code.startsWith('Digit')) { const d = +e.code.slice(5); this.items.select(d === 0 ? 9 : d - 1); }
      if (e.code === 'Escape' && !this.paused) this.pause();
    });
    addEventListener('keyup', (e) => { this.player.keys[e.code] = false; });
    addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mousedown', (e) => {
      if (this.mode !== 'play' || this.cutscene || this.paused) return;
      if (document.pointerLockElement !== canvas) { canvas.requestPointerLock?.(); return; }
      if (e.button === 0) this.items.use();
      if (e.button === 2) this.detective = !this.detective;
    });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.items.release(); });
    addEventListener('wheel', (e) => { if (this.mode === 'play' && !this.paused) this.items.scroll(e.deltaY > 0 ? 1 : -1); });
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== canvas || this.cutscene) return;
      this.player.yaw -= e.movementX * 0.0025;
      this.player.pitch = Math.max(-0.35, Math.min(1.2, this.player.pitch + e.movementY * 0.0025));
    });
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && this.mode === 'play' && !this.cutscene && !this.paused && this.player.alive) this.pause();
    });
  }
  lock() { $('game').requestPointerLock?.(); }

  // ---------------- menus ----------------
  show(id) { for (const s of document.querySelectorAll('.screen')) s.classList.toggle('hidden', s.id !== id); }
  setupMenus() {
    document.addEventListener('click', () => initAudio(), { once: true });
    document.addEventListener('keydown', () => initAudio(), { once: true });
    $('mainbtns').onclick = (e) => {
      const a = e.target.closest('button')?.dataset.act; if (!a) return;
      initAudio(); play('whoosh', { vol: 0.4 });
      if (a === 'story') { this.renderChapters(); this.show('chapters'); }
      if (a === 'missions') { this.renderMissions(); this.show('missions'); }
      if (a === 'freeplay') this.startFreeplay();
      if (a === 'cheats') { this.renderCheats('menu'); this.show('cheats'); }
      if (a === 'settings') { this.renderGfx(); this.show('settings'); }
    };
    for (const b of document.querySelectorAll('.back')) b.onclick = () => {
      if (b.closest('#cheats') && this.cheatReturn === 'pause') this.show('pause');
      else this.show('menu');
    };
    $('gfxlist').onclick = (e) => { const q = e.target.closest('button')?.dataset.q; if (q) { this.setQuality(q); this.renderGfx(); } };
    $('cheatform').onsubmit = (e) => {
      e.preventDefault();
      const input = $('cheatinput');
      const result = this.cheats.enter(input.value);
      $('cheatstatus').textContent = result.message;
      if (result.ok) {
        input.value = '';
        this.renderCheats(this.cheatReturn || 'menu');
        $('cheatstatus').textContent = result.message;
      }
      input.focus();
    };
    $('pause').onclick = (e) => {
      const a = e.target.closest('button')?.dataset.act;
      if (a === 'resume') this.resume();
      if (a === 'cheats') { this.renderCheats('pause'); this.show('cheats'); }
      if (a === 'pgfx') { const ks = Object.keys(QUALITY); this.setQuality(ks[(ks.indexOf(this.gfx.qname) + 1) % ks.length]); $('pgfxname').textContent = this.gfx.q.name; }
      if (a === 'quit') this.toMenu();
    };
    $('result').onclick = (e) => { if (e.target.closest('button')) this.resultAction?.(); };
  }
  setQuality(q) { this.gfx.set(q); this.scene.fog.density = this.gfx.q.fog; }
  renderGfx() { for (const b of $('gfxlist').children) b.classList.toggle('sel', b.dataset.q === this.gfx.qname); }
  renderCheats(returnTo) {
    this.cheatReturn = returnTo;
    this.cheats.render($('cheatlist'), (id) => {
      this.cheats.toggle(id);
      this.renderCheats(returnTo);
    });
  }
  applyCheatSettings() {
    if (!this.cheats) return;
    const psx = this.cheats.enabled('psx');
    const previous = localStorage.getItem('pj_precheat_quality');
    if (psx && this.gfx.qname !== 'psx') {
      if (!previous) localStorage.setItem('pj_precheat_quality', this.gfx.qname);
      this.setQuality('psx');
    } else if (!psx && previous) {
      this.setQuality(previous);
      localStorage.removeItem('pj_precheat_quality');
    }
    const scale = this.cheats.enabled('tinybat') ? 0.55 : this.cheats.enabled('giantbat') ? 1.8 : 1;
    this.player.root.scale.setScalar(scale);
    this.npcs.pacifist = this.cheats.enabled('pacifist');
  }
  renderChapters() {
    const un = +(localStorage.getItem('pj_story') || 0);
    $('chapterlist').innerHTML = '';
    CHAPTERS.forEach((c, i) => {
      const b = document.createElement('button'); b.disabled = i > un;
      b.innerHTML = `${c.title}<small>${i > un ? 'Locked' : c.obj.text}</small>`;
      b.onclick = () => this.startChapter(i); $('chapterlist').appendChild(b);
    });
  }
  renderMissions() {
    const stars = JSON.parse(localStorage.getItem('pj_stars') || '{}');
    $('missionlist').innerHTML = '';
    MISSIONS.forEach((m) => {
      const b = document.createElement('button'); const s = stars[m.id] || 0;
      b.innerHTML = `${m.title}<span class="stars">${'★'.repeat(s)}${'☆'.repeat(3 - s)}</span><small>${m.desc} · ${m.time}s${m.clean ? ' · no innocents' : ''}${m.item ? ' · ' + ITEMS.find(i => i.id === m.item).name : ''}</small>`;
      b.onclick = () => this.startMission(m); $('missionlist').appendChild(b);
    });
  }
  pause() { this.paused = true; document.exitPointerLock?.(); $('pgfxname').textContent = this.gfx.q.name; this.show('pause'); }
  resume() { this.paused = false; this.show(null); this.lock(); }
  toMenu() {
    this.mode = 'menu'; this.paused = false; this.beacon.visible = false; this.detective = false;
    this.cheats.leaveFreeplay();
    document.exitPointerLock?.(); $('hud').classList.add('hidden');
    this.resetCity({ walkers: 25 }); this.player.root.visible = false; this.show('menu');
  }

  // ---------------- sessions ----------------
  resetCity(pop) {
    this.npcs.clear(); this.gore.dispose();
    this.gore = new Gore(this.scene, this.world, this.gfx.qname); this.npcs.gore = this.gore;
    this.npcs.populate(pop);
  }
  begin(def, kind) {
    this.cheats.leaveFreeplay();
    this.def = def; this.kind = kind;
    this.stats = { kills: 0, beatings: 0, innocents: 0, progress: 0, punished: 0 };
    this.timeLeft = def.time || 0; this.waveIdx = 0; this.thugs = [];
    this.stats.methods = {}; this.nextFinisher = null;
    this.items.reset();
    if (def.item) this.items.select(ITEMS.findIndex(i => i.id === def.item));
    this.resetCity(def.pop || {});
    const a = this.anchors[def.at], so = this.spawnOff[def.at] || [0, 0];
    this.player.reset(a.x + so[0], a.z + so[1], Math.PI);
    this.player.camPos.set(a.x, 5, a.z + 30);
    this.beacon.visible = def.at !== 'street'; this.beacon.position.x = a.x; this.beacon.position.z = a.z;
    this.show(null); $('feed').innerHTML = '';
    if (def.boss) {
      const j = this.npcs.add('joker', 'boss', { crime: 'joker', active: true, hp: 420, laughT: 3 });
      j.place(a.x, a.z + 5, 0); this.boss = j;
      this.thugs = this.npcs.spawnThugs(4, { x: a.x, z: a.z + 8 });
      this.thugTimer = 25;
    } else this.boss = null;
    if (def.waves) this.nextWave();
  }
  nextWave() {
    const a = this.anchors[this.def.at];
    const n = this.def.waves[this.waveIdx++]; if (!n) return;
    this.thugs = this.npcs.spawnThugs(n, this.player.pos);
    this.big(`WAVE ${this.waveIdx}`, 'armed robbery · assault · also jaywalking');
  }
  async startChapter(i) {
    initAudio();
    const c = CHAPTERS[i]; this.chapterIdx = i;
    this.mode = 'cut'; this.begin(c, 'story');
    await this.cuts.play(c.intro);
    this.goPlay();
    c.hints?.forEach((h, k) => setTimeout(() => this.feed(h, true), 800 + k * 3500));
  }
  startMission(m) { initAudio(); this.mode = 'cut'; this.begin(m, 'mission'); this.goPlay(); this.big(m.title.toUpperCase(), m.desc); }
  startFreeplay() {
    initAudio();
    this.begin({ at: 'plaza', pop: { walkers: Math.round(45 * this.gfx.q.npcMul) }, obj: null }, 'free');
    this.beacon.visible = false;
    this.goPlay(); this.cheats.enterFreeplay(); this.big('FREEPLAY', 'Gotham is full of criminals. All of them.');
    this.freeT = 0;
    if (this.cheats.enabled('joker')) this.spawnCheatJoker();
  }
  spawnCheatJoker() {
    if (this.kind !== 'free' || (this.boss && this.boss.state !== 'dead')) return;
    const a = this.anchors.plaza;
    this.boss = this.npcs.add('joker', 'boss', { crime: 'joker', active: true, hp: 420, laughT: 3 });
    this.boss.place(a.x, a.z + 5, 0);
    this.thugs = this.npcs.spawnThugs(4, { x: a.x, z: a.z + 8 });
    this.thugTimer = 25;
    this.feed('JOKER PARTY: the Clown Prince and his henchmen have arrived.');
  }
  goPlay() { this.mode = 'play'; $('hud').classList.remove('hidden'); this.lock(); }

  // ---------------- events ----------------
  onPunish(n, res, method) {
    if (this.mode !== 'play' && this.mode !== 'cut') return;
    const finisher = this.nextFinisher; this.nextFinisher = null;
    const guilty = n.wasGuilty;
    if (res === 'killed') { this.npcs.scare(n.pos, 24); if (Math.random() < 0.6) play('gasp', { vol: 0.5 }); }
    if (!this.stats) return;
    if (!guilty) {
      this.stats.innocents++;
      this.feed(INNOCENT_QUIPS[(Math.random() * INNOCENT_QUIPS.length) | 0]);
      if (this.kind === 'mission' && this.def.clean) this.end(false, 'You punished an innocent. Even you have rules.');
      return;
    }
    const crime = CRIMES[n.crime];
    if (res === 'killed') { this.stats.kills++; this.stats.methods[method] = (this.stats.methods[method] || 0) + 1; } else this.stats.beatings++;
    this.stats.punished++;
    const label = res === 'killed' ? (METHOD_NAMES[method] || 'EXECUTED') : 'BEATEN';
    this.feed(`${label} — ${crime.name}`, true);
    if (!finisher && res === 'killed' && Math.random() < 0.35) this.big(METHOD_NAMES[method] || 'OVERKILL', crime.name);
    const obj = this.def.obj;
    if (obj && obj.variety) {
      this.stats.progress = Object.keys(this.stats.methods).length;
      if (this.stats.progress >= obj.variety) setTimeout(() => this.end(true), 1800);
    } else if (obj && (obj.crime == null || obj.crime === n.crime) && (!obj.res || obj.res === res) && (!obj.method || (res === 'killed' && obj.method.includes(method))) && (!obj.item || this.items.cur.id === obj.item || res === 'beaten')) {
      this.stats.progress++;
      if (this.stats.progress >= obj.count) setTimeout(() => this.end(true), 1800);
    }
    if (this.def.waves && this.thugs.every(t => t.state === 'dead')) setTimeout(() => this.nextWave(), 1500);
  }
  onPlayerDeath() {
    this.feed('Batman has fallen. Gotham remains technically lawful.');
    if (this.kind === 'free') setTimeout(() => { if (this.mode === 'play') { this.player.reset(this.player.pos.x, this.player.pos.z, this.player.yaw); this.big('BACK FROM THE DEAD', 'crime never sleeps, neither do you'); } }, 2500);
    else setTimeout(() => this.end(false, 'You were beaten to death by people committing actual crimes.'), 2000);
  }
  async end(win, reason = '') {
    if (this.mode !== 'play') return;
    this.mode = 'end'; document.exitPointerLock?.(); this.detective = false;
    const s = this.stats;
    let rewardText = '';
    if (this.kind === 'story' && win) {
      await this.cuts.play(CHAPTERS[this.chapterIdx].outro);
      const un = +(localStorage.getItem('pj_story') || 0);
      if (this.chapterIdx + 1 > un) localStorage.setItem('pj_story', Math.min(CHAPTERS.length - 1, this.chapterIdx + 1));
      if (this.chapterIdx === CHAPTERS.length - 1 && localStorage.getItem('pj_story_cheat') !== '1') {
        this.cheats.unlockStory();
        if (!this.cheats.entered.includes('noir')) rewardText = 'CHEAT CODE TRANSLATED: N0IR — NOIR VISION';
      }
    }
    $('hud').classList.add('hidden');
    let stars = 0;
    if (win && this.kind === 'mission') {
      stars = 1 + (s.innocents === 0 ? 1 : 0) + (this.timeLeft > this.def.time * 0.4 ? 1 : 0);
      const all = JSON.parse(localStorage.getItem('pj_stars') || '{}');
      all[this.def.id] = Math.max(all[this.def.id] || 0, stars); localStorage.setItem('pj_stars', JSON.stringify(all));
      const completed = JSON.parse(localStorage.getItem('pj_missions_completed') || '{}');
      completed[this.def.id] = true;
      localStorage.setItem('pj_missions_completed', JSON.stringify(completed));
      if (MISSIONS.every((mission) => completed[mission.id]) && localStorage.getItem('pj_missions_cheat') !== '1') {
        this.cheats.unlockMissions();
        if (!this.cheats.entered.includes('gold')) rewardText = 'CHEAT CODE TRANSLATED: G0LD — GOLDEN REPUTATION';
      }
    }
    const last = this.kind === 'story' && this.chapterIdx === CHAPTERS.length - 1;
    $('restitle').textContent = win ? (last ? 'GOTHAM IS SAFE' : 'JUSTICE SERVED') : 'FAILED';
    $('resbody').innerHTML = `${stars ? `<div class="big">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>` : ''}
      ${reason ? `<div>${reason}</div>` : ''}
      ${rewardText ? `<div class="cheatreward">${rewardText}</div>` : ''}
      Executions: <b>${s.kills}</b> · Beatings: <b>${s.beatings}</b> · Innocents: <b>${s.innocents}</b>`;
    this.show('result');
    this.resultAction = () => {
      if (this.kind === 'story') {
        if (win && !last) this.startChapter(this.chapterIdx + 1);
        else if (!win) this.startChapter(this.chapterIdx);
        else this.toMenu();
      } else if (this.kind === 'mission') { this.toMenu(); this.renderMissions(); this.show('missions'); }
      else this.toMenu();
    };
  }
  feed(text, good) {
    const d = document.createElement('div'); d.textContent = text; if (good) d.className = 'good';
    $('feed').appendChild(d); setTimeout(() => d.remove(), 5000);
    while ($('feed').children.length > 5) $('feed').firstChild.remove();
  }
  big(text, sub = '') {
    const b = $('bigtext'); b.innerHTML = `${text}<small>${sub}</small>`; b.classList.add('show');
    clearTimeout(this.bigT); this.bigT = setTimeout(() => b.classList.remove('show'), 2200);
  }

  // ---------------- loop ----------------
  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    let dt = Math.min(0.1, (now - this.last) / 1000);
    const fps = this.gfx.q.fps;
    if (fps) { this.acc += dt; this.last = now; if (this.acc < 1 / fps) return; dt = Math.min(0.1, this.acc); this.acc = 0; }
    else this.last = now;
    this.frameDt = dt; this.t += dt;
    let sdt = dt;
    if (this.hitstop > 0) { this.hitstop -= dt; sdt *= 0.05; }
    if (this.slowmo > 0) { this.slowmo -= dt; sdt *= 0.25; }

    this.npcs.frozen = this.cutscene || this.cheats.enabled('ghosttown');
    this.npcs.pacifist = this.cheats.enabled('pacifist');
    if (this.cutsceneTick) { const f = this.cutsceneTick; this.cutsceneTick = null; f(); this.npcs.update(dt, this.player); this.gore.update(dt); this.player.ch.animate(dt, 0); }
    else if (this.mode === 'play' && !this.paused) {
      this.applyCheatSettings();
      if (this.cheats.enabled('slowmo')) sdt *= 0.45;
      if (this.cheats.enabled('fast')) sdt *= 1.7;
      this.player.update(sdt, { locked: false });
      this.items.update(sdt);
      this.npcs.update(sdt, this.player);
      this.gore.update(sdt);
      this.gameLogic(dt);
      this.updateHud();
    } else if (this.mode === 'menu') {
      const z = ((this.t * 4) % 240) - 120;
      this.camera.position.set(CELL / 2 + Math.sin(this.t * 0.2) * 2, 16 + Math.sin(this.t * 0.13) * 4, z);
      this.camera.lookAt(CELL / 2 - 6, 5, z + 30);
      this.npcs.update(dt, this.player);
    } else if (this.mode === 'end' || this.paused) { /* frozen */ }
    this.updateEnv(dt);
    this.gfx.render(this.scene, this.camera, this.t);
  }
  gameLogic(dt) {
    if (this.def.time) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) { this.timeLeft = 0; this.end(false, 'Time\'s up. Somewhere, a grandma is jaywalking freely.'); }
    }
    if (this.boss && this.boss.state !== 'dead') {
      this.thugTimer -= dt;
      if (this.thugTimer < 0 && this.thugs.filter(t => t.state !== 'dead').length < 3) { this.thugTimer = 25; this.thugs.push(...this.npcs.spawnThugs(3, this.boss.pos)); this.feed('More henchmen. How dull.'); }
    }
    if (this.kind === 'free') {
      this.freeT -= dt;
      if (this.freeT < 0) {
        this.freeT = 2;
        const target = Math.round(45 * this.gfx.q.npcMul);
        const walkers = this.npcs.list.filter(n => n.role === 'walker' && n.state !== 'dead').length;
        if (walkers < target) this.npcs.populate({ walkers: 1, funeral: false, pledge: false, houses: false, grass: false, carts: false });
        if (this.cheats.enabled('thugmagnet') || Math.random() < 0.04) {
          this.npcs.spawnThugs(this.cheats.enabled('thugmagnet') ? 3 : 2, this.player.pos);
          this.feed('Armed thugs approach. Boring, but punchable.');
        }
      }
    }
  }
  updateHud() {
    const p = this.player, s = this.stats;
    $('hpfill').style.width = p.hp + '%';
    const o = this.def.obj;
    if (o) {
      const text = this.def.obj.text || this.def.desc || '';
      $('objective').innerHTML = `${text} — ${s.progress}/${o.variety || o.count}${this.def.time ? `<small>${Math.ceil(this.timeLeft)}s remaining</small>` : ''}`;
    } else {
      const rankBoost = this.cheats.enabled('gold') ? 2 : 1;
      const rank = RANKS[Math.min(RANKS.length - 1, Math.floor(Math.sqrt(s.punished * rankBoost) * 1.2))];
      $('objective').innerHTML = `Rank: ${rank}<small>punish anyone doing anything</small>`;
    }
    $('stats').innerHTML = `EXECUTIONS <b>${s.kills}</b><br>BEATINGS <b>${s.beatings}</b><br>INNOCENTS <b>${s.innocents}</b>`;
    const n = !p.takedown && this.npcs.nearestGuilty(p.pos, 3.6);
    const targetPrompt = n ? `[E] TAKEDOWN — <span class="crime">${CRIMES[n.crime]?.name || ''}</span> (${n.sev === 'kill' || n.role === 'boss' ? 'DEATH' : 'BEATING'})` : '';
    const secretPrompt = this.cheats.prompt();
    $('prompt').innerHTML = [targetPrompt, secretPrompt ? `[${secretPrompt}]` : ''].filter(Boolean).join('<br>');
  }
  updateEnv(dt) {
    const q = this.gfx.q, cam = this.camera;
    // detective
    const forcedVision = this.cheats.enabled('detective') || this.cheats.enabled('noir');
    this.detK += (((this.detective || forcedVision) && this.mode === 'play' ? 1 : 0) - this.detK) * Math.min(1, dt * 6);
    this.npcs.detective = this.detK;
    $('detective-tint').classList.toggle('on', (this.detective || forcedVision) && this.mode === 'play');
    const u = this.gfx.postMat.uniforms;
    u.detective.value = this.detK;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2); u.hurt.value = this.hurtFlash;
    // lightning
    this.lightT -= dt;
    if (this.lightT < 0) {
      this.lightT = this.cheats.enabled('storm') ? 2 + Math.random() * 3 : 8 + Math.random() * 18;
      if (q.lights) this.lightning(0.7 + Math.random() * 0.3);
    }
    this.flash = Math.max(0, this.flash - dt * 3);
    const fl = this.flash > 0.5 ? this.flash : this.flash * (Math.random() < 0.5 ? 1 : 0.2);
    u.flash.value = fl * 0.25;
    const daytime = this.cheats.enabled('day');
    const bgColor = daytime ? '#859eb1' : '#0a0d14';
    this.scene.background.set(bgColor);
    this.scene.fog.color.set(bgColor);
    this.hemi.color.set(daytime ? '#d7e5ed' : '#5a6a8a');
    this.hemi.groundColor.set(daytime ? '#5b594b' : '#1a120c');
    this.hemi.intensity = (daytime ? 1.15 : 0.55) + fl * 3;
    this.moon.color.set(daytime ? '#fff0cb' : '#9fb4e0');
    this.moon.intensity = daytime ? 1.55 : 1.1;
    if (this.skyMoon) this.skyMoon.visible = !daytime;
    if (this.batSignal) this.batSignal.visible = !daytime;
    if (this.sun) this.sun.visible = daytime;
    this.scene.fog.density = q.fog;
    // moon shadow follows player
    const focus = this.mode === 'play' ? this.player.pos : cam.position;
    this.moon.position.set(focus.x + 30, 60, focus.z + 20); this.moon.target.position.set(focus.x, 0, focus.z);
    // lamp lights
    this.lampT = (this.lampT || 0) - dt;
    if (this.lampT < 0) {
      this.lampT = 0.5;
      const ref = this.mode === 'play' ? this.player.pos : cam.position;
      const sorted = this.world.lamps.slice().sort((a, b) => a.distanceToSquared(ref) - b.distanceToSquared(ref));
      this.pLights.forEach((l, i) => { l.visible = q.lights; if (sorted[i]) l.position.copy(sorted[i]); });
    }
    // rain
    const n = this.cheats.enabled('dry') ? 0 : q.rain, P = this.rainPos, O = this.rainOff;
    for (let i = 0; i < n; i++) {
      O[i * 3 + 1] -= dt * 28; if (O[i * 3 + 1] < 0) O[i * 3 + 1] += 30;
      const x = cam.position.x + O[i * 3], y = cam.position.y - 8 + O[i * 3 + 1], z = cam.position.z + O[i * 3 + 2];
      P[i * 6] = x; P[i * 6 + 1] = y; P[i * 6 + 2] = z; P[i * 6 + 3] = x + 0.05; P[i * 6 + 4] = y - 0.7; P[i * 6 + 5] = z;
    }
    this.rain.geometry.setDrawRange(0, n * 2);
    this.rain.geometry.attributes.position.needsUpdate = true;
    const bigHead = this.cheats.enabled('bighead') ? 2.1 : 1;
    const characters = [this.player.ch, ...this.npcs.list.map((npc) => npc.ch)];
    for (const ch of characters) {
      if (!ch.head.userData.cheatBaseScale) ch.head.userData.cheatBaseScale = ch.head.scale.clone();
      ch.head.scale.copy(ch.head.userData.cheatBaseScale).multiplyScalar(bigHead);
    }
    // flag
    const flag = this.world.spots.flag;
    if (flag) {
      const pos = flag.geometry.attributes.position;
      if (!flag.userData.base) flag.userData.base = pos.array.slice();
      const b = flag.userData.base;
      for (let i = 0; i < pos.count; i++) pos.array[i * 3 + 2] = Math.sin(this.t * 4 + b[i * 3] * 2) * 0.2 * b[i * 3] / 3;
      pos.needsUpdate = true;
    }
  }
}

window.game = new Game();
