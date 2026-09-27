const files = ['punch', 'gore', 'crack', 'scream', 'rain', 'sting', 'whoosh', 'gasp', 'laugh'];
let ctx, master, buffers = {}, rainNode;

export async function initAudio() {
  if (ctx) { ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
  await Promise.all(files.map(async (f) => {
    try {
      const r = await fetch(`sfx/${f}.wav`);
      buffers[f] = await ctx.decodeAudioData(await r.arrayBuffer());
    } catch (e) { console.warn('sfx', f, e); }
  }));
  startRain();
}

export function play(name, { vol = 1, rate = 1, jitter = 0.1, offset = 0, dur } = {}) {
  if (!ctx || !buffers[name]) return;
  const src = ctx.createBufferSource();
  src.buffer = buffers[name];
  src.playbackRate.value = rate * (1 + (Math.random() - 0.5) * jitter * 2);
  const g = ctx.createGain(); g.gain.value = vol;
  src.connect(g); g.connect(master);
  src.start(0, offset, dur);
  return src;
}

function startRain() {
  if (rainNode || !buffers.rain) return;
  rainNode = ctx.createBufferSource(); rainNode.buffer = buffers.rain; rainNode.loop = true;
  const g = ctx.createGain(); g.gain.value = 0.35;
  rainNode.connect(g); g.connect(master); rainNode.start();
}
