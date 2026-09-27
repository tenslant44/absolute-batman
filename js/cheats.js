import * as THREE from 'three';

export const CHEATS = [
  { id: 'noir', code: 'N0IR', name: 'Noir Vision', effect: 'Keeps Detective Vision active.', source: 'story' },
  { id: 'gold', code: 'G0LD', name: 'Golden Reputation', effect: 'Speeds up Freeplay rank progress.', source: 'missions' },
  { id: 'day', code: 'D4YL', name: 'Daylight', effect: 'Changes Gotham from night to day.', source: 'freeplay' },
  { id: 'immortal', code: 'GODM', name: 'Unbreakable', effect: 'Batman takes no damage.', source: 'freeplay' },
  { id: 'speed', code: 'SP33', name: 'Speed Force', effect: 'Run faster.', source: 'freeplay' },
  { id: 'jump', code: 'JUMP', name: 'Moon Jump', effect: 'Jump much higher.', source: 'freeplay' },
  { id: 'ammo', code: 'AMMO', name: 'Bottomless Utility Belt', effect: 'Gadget charges never run out.', source: 'freeplay' },
  { id: 'dry', code: 'DRY1', name: 'Rain Check', effect: 'Turns off the rain.', source: 'freeplay' },
  { id: 'detective', code: 'D3TC', name: 'Always Watching', effect: 'Keeps Detective Vision active.', source: 'freeplay' },
  { id: 'onepunch', code: '1PCH', name: 'One Punch', effect: 'Punches deal four times as much damage.', source: 'freeplay' },
  { id: 'slowmo', code: 'SL0W', name: 'Slow Motion', effect: 'Slows the action around Batman.', source: 'freeplay' },
  { id: 'fast', code: 'F4ST', name: 'Fast Forward', effect: 'Speeds up the action around Batman.', source: 'freeplay' },
  { id: 'bighead', code: 'B1GH', name: 'Big Head Mode', effect: 'Makes every head larger.', source: 'freeplay' },
  { id: 'tinybat', code: 'T1NY', name: 'Pocket Knight', effect: 'Shrinks Batman.', source: 'freeplay' },
  { id: 'giantbat', code: 'G1NT', name: 'Giant Knight', effect: 'Makes Batman enormous.', source: 'freeplay' },
  { id: 'pacifist', code: 'P4C1', name: 'Disarmed', effect: 'Stops armed enemies from attacking.', source: 'freeplay' },
  { id: 'thugmagnet', code: 'THUG', name: 'Thug Magnet', effect: 'Calls extra armed thugs into Freeplay.', source: 'freeplay' },
  { id: 'joker', code: 'J0KE', name: 'Joker Party', effect: 'Adds the Joker and his henchmen to Freeplay.', source: 'freeplay' },
  { id: 'ghosttown', code: 'G0ST', name: 'Ghost Town', effect: 'Freezes the city in place.', source: 'freeplay' },
  { id: 'psx', code: 'PSX1', name: 'Memory Card', effect: 'Switches to the PSX graphics preset.', source: 'freeplay' },
  { id: 'regen', code: 'H34L', name: 'Healing Factor', effect: 'Restores health much faster.', source: 'freeplay' },
  { id: 'storm', code: 'ST0R', name: 'Storm Warning', effect: 'Makes lightning strike more often.', source: 'freeplay' },
];

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const ROADS = [-87, -29, 29, 87];
const EDGE = [-5.4, 5.4];
const DECODER_POS = new THREE.Vector3(-142, 0, -142);

function shuffle(values) {
  const result = values.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function runePoints() {
  const points = [];
  for (const z of ROADS) for (const x of ROADS) {
    for (const dz of EDGE) for (const dx of EDGE) points.push(new THREE.Vector3(x + dx, 0, z + dz));
  }
  return points;
}

function runeTexture(char) {
  const index = CHARSET.indexOf(char);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#d9f5ff';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = '#57cfff';
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(64, 64, 47, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  const bits = (index + 1).toString(2).padStart(6, '0');
  const angles = [-Math.PI / 2, -Math.PI / 6, Math.PI / 6, Math.PI / 2, Math.PI * 5 / 6, Math.PI * 7 / 6];
  const pts = angles.map((a) => [64 + Math.cos(a) * 32, 64 + Math.sin(a) * 32]);
  ctx.beginPath();
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] !== '1') continue;
    const [x, y] = pts[i];
    ctx.moveTo(64, 64);
    ctx.lineTo(x, y);
    ctx.moveTo(x - 6, y);
    ctx.lineTo(x + 6, y);
  }
  ctx.stroke();
  ctx.fillStyle = '#ffe19a';
  ctx.beginPath();
  ctx.arc(64, 64, 6, 0, Math.PI * 2);
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function iconSprite(texture, size) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  sprite.scale.set(size, size, 1);
  return sprite;
}

export class CheatCodes {
  constructor(game) {
    this.game = game;
    this.active = this.readObject('pj_active_cheats');
    this.entered = this.readArray('pj_entered_cheats');
    this.freeOrder = this.readFreeOrder();
    this.freeCodes = this.readArray('pj_free_cheats');
    this.cursor = Math.min(20, Math.max(0, Number(localStorage.getItem('pj_free_cursor') || 0)));
    this.found = Math.min(4, Math.max(0, Number(localStorage.getItem('pj_free_runes') || 0)));
    this.runeGroup = new THREE.Group();
    this.runeGroup.visible = false;
    game.scene.add(this.runeGroup);
    this.runes = [];
    this.decoder = this.buildDecoder();
    this.decoder.visible = false;
    game.scene.add(this.decoder);
  }

  readObject(key) {
    try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; }
    catch { return {}; }
  }
  readArray(key) {
    try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; }
    catch { return []; }
  }
  readFreeOrder() {
    let order = this.readArray('pj_free_order');
    const expected = CHEATS.filter((c) => c.source === 'freeplay').map((c) => c.id);
    if (order.length !== expected.length || expected.some((id) => !order.includes(id))) {
      order = shuffle(expected);
      localStorage.setItem('pj_free_order', JSON.stringify(order));
    }
    return order;
  }

  enabled(id) { return !!this.active[id]; }

  isUnlocked(def) {
    if (this.entered.includes(def.id)) return true;
    if (def.source === 'story') return localStorage.getItem('pj_story_cheat') === '1';
    if (def.source === 'missions') return localStorage.getItem('pj_missions_cheat') === '1';
    return this.freeCodes.includes(def.id);
  }

  unlockedCount() { return CHEATS.filter((c) => this.isUnlocked(c)).length; }

  toggle(id) {
    const def = CHEATS.find((c) => c.id === id);
    if (!def || !this.isUnlocked(def)) return false;
    this.active[id] = !this.active[id];
    if (!this.active[id]) delete this.active[id];
    localStorage.setItem('pj_active_cheats', JSON.stringify(this.active));
    this.game.applyCheatSettings();
    if (id === 'joker' && this.active[id] && this.game.mode === 'play') this.game.spawnCheatJoker();
    return true;
  }

  enter(code) {
    const normalized = String(code || '').trim().toUpperCase();
    const def = CHEATS.find((c) => c.code === normalized);
    if (!def) return { ok: false, message: 'UNKNOWN CODE' };
    if (!this.entered.includes(def.id)) {
      this.entered.push(def.id);
      localStorage.setItem('pj_entered_cheats', JSON.stringify(this.entered));
    }
    const alreadyOn = this.enabled(def.id);
    this.active[def.id] = true;
    localStorage.setItem('pj_active_cheats', JSON.stringify(this.active));
    this.game.applyCheatSettings();
    if (def.id === 'joker' && this.game.mode === 'play') this.game.spawnCheatJoker();
    return { ok: true, message: `${def.code} ACCEPTED — ${alreadyOn ? `${def.name} is already on.` : `${def.name} activated.`}` };
  }

  unlockStory() { localStorage.setItem('pj_story_cheat', '1'); }
  unlockMissions() { localStorage.setItem('pj_missions_cheat', '1'); }

  buildDecoder() {
    const group = new THREE.Group();
    group.position.copy(DECODER_POS);
    const stone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 1, 0.65, 8),
      new THREE.MeshStandardMaterial({ color: '#22252a', roughness: 0.7, metalness: 0.25 }),
    );
    stone.position.y = 0.35;
    group.add(stone);
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.52, 0.7, 0.22, 8),
      new THREE.MeshStandardMaterial({ color: '#a6874e', emissive: '#423216', metalness: 0.7 }),
    );
    cap.position.y = 0.78;
    group.add(cap);
    const texture = runeTexture('A');
    const sprite = iconSprite(texture, 1.2);
    sprite.position.y = 1.65;
    group.add(sprite);
    const lamp = new THREE.PointLight('#d9ad5a', 2, 7);
    lamp.position.y = 1.4;
    group.add(lamp);
    return group;
  }

  routePositions() {
    const points = runePoints();
    const route = [];
    for (let step = 0; step < 4; step++) {
      const point = points[(this.cursor * 11 + step * 19) % points.length].clone();
      point.y = this.game.world.groundY(point.x, point.z);
      route.push(point);
    }
    return route;
  }

  clearRunes() {
    for (const rune of this.runes) {
      rune.sprite.material.map?.dispose();
      rune.sprite.material.dispose();
      rune.sprite.removeFromParent();
      rune.ring.removeFromParent();
      rune.ring.geometry.dispose();
      rune.ring.material.dispose();
    }
    this.runes = [];
  }

  showCurrentRoute() {
    this.clearRunes();
    if (this.cursor >= this.freeOrder.length) {
      this.decoder.visible = false;
      return;
    }
    const id = this.freeOrder[this.cursor];
    const def = CHEATS.find((c) => c.id === id);
    const positions = this.routePositions();
    for (let i = 0; i < positions.length; i++) {
      const texture = runeTexture(def.code[i]);
      const sprite = iconSprite(texture, 0.9);
      sprite.position.copy(positions[i]).y += 1.15;
      sprite.visible = i === this.found;
      this.runeGroup.add(sprite);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.43, 0.025, 5, 24),
        new THREE.MeshBasicMaterial({ color: '#5aa4bc', transparent: true, opacity: 0.65 }),
      );
      ring.position.copy(positions[i]).y += 0.07;
      ring.rotation.x = -Math.PI / 2;
      ring.visible = i === this.found;
      this.runeGroup.add(ring);
      this.runes.push({ sprite, ring, pos: positions[i] });
    }
    this.decoder.visible = this.found >= 4;
  }

  enterFreeplay() {
    this.showCurrentRoute();
    this.runeGroup.visible = this.cursor < this.freeOrder.length;
    if (this.found >= 4) this.pointBeaconAtDecoder();
  }

  leaveFreeplay() {
    this.runeGroup.visible = false;
    this.decoder.visible = false;
  }

  pointBeaconAtDecoder() {
    const beacon = this.game.beacon;
    beacon.visible = true;
    beacon.position.x = DECODER_POS.x;
    beacon.position.z = DECODER_POS.z;
  }

  currentDef() {
    if (this.cursor >= this.freeOrder.length) return null;
    return CHEATS.find((c) => c.id === this.freeOrder[this.cursor]) || null;
  }

  prompt() {
    if (this.game.mode !== 'play' || this.game.paused || this.game.kind !== 'free' || this.cursor >= 20) return '';
    if (this.found < 4 && this.runes[this.found]?.pos.distanceTo(this.game.player.pos) < 2.8) {
      return `R READ GLYPH ${this.found + 1}/4`;
    }
    if (this.found >= 4 && this.game.player.pos.distanceTo(DECODER_POS) < 3.6) {
      return 'R TRANSLATE SYMBOLS';
    }
    return '';
  }

  interact() {
    if (this.game.mode !== 'play' || this.game.paused || this.game.kind !== 'free' || this.cursor >= 20) return false;
    if (this.found < 4 && this.runes[this.found]?.pos.distanceTo(this.game.player.pos) < 2.8) {
      this.found++;
      localStorage.setItem('pj_free_runes', String(this.found));
      this.runes.forEach((rune, i) => {
        rune.sprite.visible = i === this.found;
        rune.ring.visible = i === this.found;
      });
      if (this.found === 4) {
        this.decoder.visible = true;
        this.pointBeaconAtDecoder();
        this.game.feed('FOUR GLYPHS RECORDED. Find the secluded translator at the northwest edge of Gotham.');
      } else {
        this.game.feed(`GLYPH RECORDED — ${this.found}/4. The next symbol is somewhere in the city.`);
      }
      return true;
    }

    if (this.found >= 4 && this.game.player.pos.distanceTo(DECODER_POS) < 3.6) {
      const def = this.currentDef();
      if (!def) return false;
      this.freeCodes.push(def.id);
      localStorage.setItem('pj_free_cheats', JSON.stringify(this.freeCodes));
      this.cursor++;
      this.found = 0;
      localStorage.setItem('pj_free_cursor', String(this.cursor));
      localStorage.setItem('pj_free_runes', '0');
      this.game.feed(`TRANSLATION: ${def.code} — ${def.name}. Open Cheat Codes to activate it.`);
      this.showCurrentRoute();
      this.runeGroup.visible = this.cursor < 20;
      this.decoder.visible = false;
      return true;
    }
    return false;
  }

  render(container, onToggle) {
    container.innerHTML = '';
    const summary = document.createElement('p');
    summary.className = 'cheat-summary';
    summary.textContent = `UNLOCKED ${this.unlockedCount()}/22 · FREEPLAY GLYPH CODES ${this.freeCodes.length}/20`;
    container.appendChild(summary);

    for (const def of CHEATS) {
      const unlocked = this.isUnlocked(def);
      const button = document.createElement('button');
      button.className = `cheat-entry${this.enabled(def.id) ? ' sel' : ''}`;
      button.disabled = !unlocked;
      const source = def.source === 'story' ? 'Complete the story' :
        def.source === 'missions' ? 'Complete all 20 missions' : 'Find the glyph sequence in Freeplay';
      button.innerHTML = unlocked
        ? `<span>${def.name}<b>${this.enabled(def.id) ? 'ON' : 'OFF'}</b></span><small>${def.code} · ${def.effect}</small>`
        : `<span>UNKNOWN CODE<b>LOCKED</b></span><small>${source}</small>`;
      if (unlocked) button.onclick = () => onToggle(def.id);
      container.appendChild(button);
    }
  }
}
