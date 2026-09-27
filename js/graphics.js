import * as THREE from 'three';

export const QUALITY = {
  chromebook: { name: 'School Chromebook', scale: 0.2, maxW: 240, shadows: false, snap: 40, colors: 5, fps: 14, fog: 0.07, npcMul: 0.5, rain: 150, dither: 0, grain: 0.0, lights: false },
  psx:        { name: 'PSX', scale: 1, maxW: 320, shadows: false, snap: 120, colors: 24, fps: 30, fog: 0.045, npcMul: 0.8, rain: 600, dither: 1, grain: 0.0, lights: true },
  normal:     { name: 'Normal', scale: 1, maxW: 99999, shadows: true, snap: 0, colors: 0, fps: 0, fog: 0.028, npcMul: 1, rain: 5000, dither: 0, grain: 1, lights: true },
};

export const shared = { uSnap: { value: 0 }, q: localStorage.getItem('pj_quality') || 'normal' };

// Patch every material with PSX vertex snapping (controlled by a global uniform)
export function patchMaterial(m) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSnap = shared.uSnap;
    sh.vertexShader = 'uniform float uSnap;\n' + sh.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      if (uSnap > 0.0) {
        vec4 p = gl_Position; p.xyz /= p.w;
        p.xy = floor(p.xy * uSnap) / uSnap;
        p.xyz *= p.w; gl_Position = p;
      }`);
  };
  return m;
}

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!opts.unique && matCache.has(key)) return matCache.get(key);
  const { unique, ...rest } = opts;
  const m = patchMaterial(new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05, ...rest }));
  if (!unique) matCache.set(key, m);
  return m;
}

const postVS = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`;
const postFS = `
uniform sampler2D tex; uniform vec2 res; uniform float colors, dither, grain, time, detective, hurt, flash;
varying vec2 vUv;
float bayer(vec2 p){ int x=int(mod(p.x,4.)); int y=int(mod(p.y,4.));
  int i=x+y*4; float m[16];
  m[0]=0.;m[1]=8.;m[2]=2.;m[3]=10.;m[4]=12.;m[5]=4.;m[6]=14.;m[7]=6.;m[8]=3.;m[9]=11.;m[10]=1.;m[11]=9.;m[12]=15.;m[13]=7.;m[14]=13.;m[15]=5.;
  for(int k=0;k<16;k++){ if(k==i) return m[k]/16.; } return 0.; }
float rnd(vec2 c){ return fract(sin(dot(c,vec2(12.9898,78.233)))*43758.5453); }
void main(){
  vec2 uv=vUv;
  vec3 c;
  if(grain>0.){
    float ca=0.0015+hurt*0.006;
    vec2 d=(uv-.5)*ca;
    c=vec3(texture2D(tex,uv+d).r, texture2D(tex,uv).g, texture2D(tex,uv-d).b);
  } else c=texture2D(tex,uv).rgb;
  #ifdef TONE_MAPPING
  c = toneMapping(c);
  #endif
  c = linearToOutputTexel(vec4(c,1.)).rgb;
  if(detective>0.){
    float l=dot(c,vec3(.3,.59,.11));
    vec3 dv=vec3(l*.35,l*.7,l*1.3)+vec3(0.,.02,.06);
    // keep strong reds/oranges (criminal highlight) intact
    float keep=smoothstep(.25,.6,c.r-max(c.g,c.b));
    c=mix(c,mix(dv,c*1.4,keep),detective);
  }
  c = mix(c, vec3(1.,.9,.8), flash);
  c.r += hurt*.25;
  if(grain>0.){
    c += (rnd(uv*res+time)-.5)*.06*grain;
    float v=smoothstep(.95,.25,length(uv-.5)); c*=mix(.55,1.,v);
    c = pow(c, vec3(1.05));
  }
  if(colors>0.){
    float dd = dither>0. ? (bayer(gl_FragCoord.xy)-.5)/colors*1.5 : 0.;
    c = floor((c+dd)*colors+.5)/colors;
  }
  gl_FragColor=vec4(clamp(c,0.,1.),1.);
}`;

export class Graphics {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.rt = new THREE.WebGLRenderTarget(4, 4, { samples: 0, type: THREE.HalfFloatType });
    this.postMat = new THREE.ShaderMaterial({
      vertexShader: postVS, fragmentShader: postFS,
      uniforms: { tex: { value: this.rt.texture }, res: { value: new THREE.Vector2() }, colors: { value: 0 }, dither: { value: 0 },
        grain: { value: 0 }, time: { value: 0 }, detective: { value: 0 }, hurt: { value: 0 }, flash: { value: 0 } },
      depthTest: false, depthWrite: false,
    });
    this.postScene = new THREE.Scene();
    this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMat));
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.set(localStorage.getItem('pj_quality') || 'normal');
    addEventListener('resize', () => this.resize());
  }
  set(q) {
    this.qname = q; this.q = QUALITY[q]; shared.q = q;
    localStorage.setItem('pj_quality', q);
    this.renderer.shadowMap.enabled = this.q.shadows;
    shared.uSnap.value = this.q.snap;
    const u = this.postMat.uniforms;
    u.colors.value = this.q.colors; u.dither.value = this.q.dither; u.grain.value = this.q.grain;
    this.rt.texture.minFilter = this.rt.texture.magFilter = this.q.grain ? THREE.LinearFilter : THREE.NearestFilter;
    this.rt.samples = q === 'normal' ? 4 : 0; this.rt.dispose();
    document.body.classList.toggle('pixel', q !== 'normal');
    this.renderer.toneMapping = q === 'chromebook' ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    // force material recompiles (shadow on/off)
    matCache.forEach(m => m.needsUpdate = true);
    this.resize();
  }
  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setPixelRatio(this.qname === 'normal' ? Math.min(devicePixelRatio, 1.5) : 1);
    this.renderer.setSize(w, h, false);
    let rw = w * this.q.scale, rh = h * this.q.scale;
    if (rw > this.q.maxW) { rh = rh * this.q.maxW / rw; rw = this.q.maxW; }
    if (this.qname === 'normal') { rw = w * this.renderer.getPixelRatio(); rh = h * this.renderer.getPixelRatio(); }
    this.rt.setSize(Math.max(2, rw | 0), Math.max(2, rh | 0));
    this.postMat.uniforms.res.value.set(rw, rh);
    this.aspect = w / h;
  }
  render(scene, camera, t) {
    this.postMat.uniforms.time.value = t;
    this.renderer.setRenderTarget(this.rt);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCam);
  }
}
