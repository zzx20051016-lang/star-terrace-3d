/* =========================================================================
   云上星台 · 二十八星宿秘境
   00 · 基础：固定种子随机、程序噪声、世界数据、渲染器与相机
   ========================================================================= */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ------------------------------ 固定随机种子 ------------------------------ */
const SEED = 0x5eed2a17;

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 独立随机流，避免新增装饰时改变已有布局。 */
function rngFor(salt) {
  return mulberry32((SEED ^ Math.imul(salt | 0, 2654435761)) >>> 0);
}

/* ------------------------------- 数学与噪声 ------------------------------- */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const TAU = Math.PI * 2;

function hash2i(ix, iy) {
  let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263) ^ SEED;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2i(ix, iy), b = hash2i(ix + 1, iy);
  const c = hash2i(ix, iy + 1), d = hash2i(ix + 1, iy + 1);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
}

function fbm2(x, y, oct = 4, lac = 2.03, gain = 0.5) {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * vnoise(x * freq, y * freq);
    norm += amp;
    amp *= gain;
    freq *= lac;
  }
  return sum / norm;
}

function fbm3(x, y, z, oct = 3) {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    const n = vnoise(x * freq + z * 0.73, y * freq - z * 1.31);
    sum += amp * n;
    norm += amp;
    amp *= 0.5;
    freq *= 2.07;
  }
  return sum / norm;
}

/* -------------------------------- 世界方位 -------------------------------- */
/* Three.js：+Y 上，+X 东，−X 西，−Z 北，+Z 南。 */
const DIRECTIONS = {
  east: { label: '东方', vector: new THREE.Vector3(1, 0, 0) },
  north: { label: '北方', vector: new THREE.Vector3(0, 0, -1) },
  west: { label: '西方', vector: new THREE.Vector3(-1, 0, 0) },
  south: { label: '南方', vector: new THREE.Vector3(0, 0, 1) }
};

const COURTYARDS = [
  {
    key: 'east', group: '东方青龙', short: '青龙', dir: '东方', dirKey: 'east',
    place: '东侧庭院', center: new THREE.Vector3(26.5, 0, 0),
    color: 0x4f7d66, css: '#4f7d66', motif: 'dragon',
    stoneTint: 0x8f9a84, lantern: 0xffc27a
  },
  {
    key: 'north', group: '北方玄武', short: '玄武', dir: '北方', dirKey: 'north',
    place: '北侧庭院', center: new THREE.Vector3(0, 0, -26.5),
    color: 0x455d75, css: '#455d75', motif: 'turtle',
    stoneTint: 0x737b83, lantern: 0xbcd0e6
  },
  {
    key: 'west', group: '西方白虎', short: '白虎', dir: '西方', dirKey: 'west',
    place: '西侧庭院', center: new THREE.Vector3(-26.5, 0, 0),
    color: 0x9a917e, css: '#9a917e', motif: 'tiger',
    stoneTint: 0xb0a794, lantern: 0xffd6a0
  },
  {
    key: 'south', group: '南方朱雀', short: '朱雀', dir: '南方', dirKey: 'south',
    place: '南侧庭院', center: new THREE.Vector3(0, 0, 26.5),
    color: 0xa8553f, css: '#a8553f', motif: 'bird',
    stoneTint: 0xa08a78, lantern: 0xffa765
  }
];

/* 二十八宿：每宿是一枚碑，不是一颗星。 */
const MANSION_DATA = [
  ['角', 'Jiǎo', 'east'], ['亢', 'Kàng', 'east'], ['氐', 'Dī', 'east'],
  ['房', 'Fáng', 'east'], ['心', 'Xīn', 'east'], ['尾', 'Wěi', 'east'],
  ['箕', 'Jī', 'east'],

  ['斗', 'Dǒu', 'north'], ['牛', 'Niú', 'north'], ['女', 'Nǚ', 'north'],
  ['虚', 'Xū', 'north'], ['危', 'Wēi', 'north'], ['室', 'Shì', 'north'],
  ['壁', 'Bì', 'north'],

  ['奎', 'Kuí', 'west'], ['娄', 'Lóu', 'west'], ['胃', 'Wèi', 'west'],
  ['昴', 'Mǎo', 'west'], ['毕', 'Bì', 'west'], ['觜', 'Zī', 'west'],
  ['参', 'Shēn', 'west'],

  ['井', 'Jǐng', 'south'], ['鬼', 'Guǐ', 'south'], ['柳', 'Liǔ', 'south'],
  ['星', 'Xīng', 'south'], ['张', 'Zhāng', 'south'], ['翼', 'Yì', 'south'],
  ['轸', 'Zhěn', 'south']
];

const COURTYARD_BY_KEY = Object.fromEntries(COURTYARDS.map((c) => [c.key, c]));

const MANSIONS = MANSION_DATA.map(([name, pinyin, key], i) => {
  const c = COURTYARD_BY_KEY[key];
  const localIndex = MANSIONS_COUNT_BEFORE(i, key);
  return {
    id: i + 1, name, pinyin, key, group: c.group, dir: c.dir,
    place: c.place, css: c.css, motif: c.motif,
    localIndex, localLabel: ['一', '二', '三', '四', '五', '六', '七'][localIndex]
  };
});

function MANSIONS_COUNT_BEFORE(globalIndex, key) {
  let n = 0;
  for (let i = 0; i < globalIndex; i++) if (MANSION_DATA[i][2] === key) n++;
  return n;
}

/* ------------------------------- 岛屿尺度 -------------------------------- */
const ISLAND = {
  baseR: 44,
  xScale: 1.06,
  zScale: 0.94,
  bottomY: -50,
  plateauY: 2.55
};

const PLATFORM = {
  tiers: [
    { r: 13.0, h: 1.24 },
    { r: 10.5, h: 1.26 },
    { r: 8.2, h: 1.34 }
  ]
};

const PLATFORM_BASE_Y = 2.55;
const TIER_TOPS = [];
{
  let y = PLATFORM_BASE_Y;
  for (const t of PLATFORM.tiers) {
    y += t.h;
    TIER_TOPS.push(y);
  }
}
const PLATFORM_TOP_Y = TIER_TOPS[TIER_TOPS.length - 1];

const HOME_VIEW = {
  position: new THREE.Vector3(82, 18, 102),
  target: new THREE.Vector3(0, 0, 0),
  fov: 42
};

/* 调试参数（仅用于本地检查，不影响正常访问）：
   ?cam=x,y,z&target=x,y,z&fov=39&night=1 */
const DEBUG_PARAMS = new URLSearchParams(location.search);
if (DEBUG_PARAMS.has('cam')) {
  const v = DEBUG_PARAMS.get('cam').split(',').map(Number);
  if (v.length === 3 && v.every(Number.isFinite)) HOME_VIEW.position.set(v[0], v[1], v[2]);
}
if (DEBUG_PARAMS.has('target')) {
  const v = DEBUG_PARAMS.get('target').split(',').map(Number);
  if (v.length === 3 && v.every(Number.isFinite)) HOME_VIEW.target.set(v[0], v[1], v[2]);
}
if (DEBUG_PARAMS.has('fov')) {
  const v = Number(DEBUG_PARAMS.get('fov'));
  if (Number.isFinite(v)) HOME_VIEW.fov = v;
}

/** 岛缘半径（含椭圆缩放与三组低频起伏，保证轮廓不对称）。 */
function rimRadius(theta) {
  const base = ISLAND.baseR
    + 4.4 * Math.sin(3 * theta + 0.7)
    + 2.0 * Math.sin(5 * theta + 2.1)
    + 1.3 * Math.sin(7 * theta + 4.4)
    + 0.8 * Math.sin(11 * theta + 1.2);
  const c = Math.cos(theta), s = Math.sin(theta);
  const rx = base * ISLAND.xScale;
  const rz = base * ISLAND.zScale;
  return 1 / Math.sqrt((c / rx) * (c / rx) + (s / rz) * (s / rz));
}

function rimPoint(theta, inset = 0) {
  const r = rimRadius(theta) - inset;
  return new THREE.Vector3(Math.cos(theta) * r, 0, Math.sin(theta) * r);
}

/** 岛面高度场：中央台地 + 山脊 + 庭院整平 + 岛缘收口。 */
function terrainHeight(x, z) {
  const rr = Math.hypot(x, z);
  const theta = Math.atan2(z, x);
  const R = rimRadius(theta);

  let h = 0.58 * (fbm2(x * 0.052 + 3.1, z * 0.052 - 1.7, 4) * 2 - 1)
    + 0.22 * (fbm2(x * 0.16 - 4.2, z * 0.16 + 7.4, 3) * 2 - 1);

  // 中央观星台台地
  h += 2.55 * Math.exp(-(rr * rr) / (2 * 17 * 17));

  // 西北向山脊，打破对称
  const ridgeAxis = (x * 0.74 + z * 0.67 + 9.0) / 9.5;
  h += 1.35 * Math.exp(-ridgeAxis * ridgeAxis) * Math.exp(-(rr * rr) / (2 * 28 * 28));

  // 西侧小丘
  h += 1.55 * Math.exp(-(((x + 22) * (x + 22)) + ((z + 13) * (z + 13))) / (2 * 7.5 * 7.5));

  // 东侧台地：给青龙庭院一个高差
  h += 1.25 * Math.exp(-(((x - 27) * (x - 27)) + ((z + 6) * (z + 6))) / (2 * 8.0 * 8.0));

  // 观星台基座整平
  h = lerp(h, 2.55, 1 - smoothstep(14.2, 18.8, rr));

  // 庭院整平：各庭院高度略有差异，靠坡地一侧有挡土石
  for (let i = 0; i < COURTYARDS.length; i++) {
    const c = COURTYARDS[i];
    const d = Math.hypot(x - c.center.x, z - c.center.z);
    const w = 1 - smoothstep(5.6, 9.4, d);
    const target = c.key === 'east' ? 1.55 : c.key === 'north' ? 0.75 : c.key === 'west' ? 1.15 : 0.92;
    h = lerp(h, target, w * 0.97);
  }

  // 岛缘收口与轻微下卷
  h *= smoothstep(0, 4.2, R - rr);
  h -= 0.9 * smoothstep(R - 2.6, R, rr);
  return h;
}

/* ------------------------------ 渲染器与相机 ------------------------------ */
const stageEl = document.getElementById('stage');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
    stencil: false
  });
} catch (err) {
  window.__showFatal('WebGL 初始化失败：' + (err && err.message ? err.message : err));
  throw err;
}
if (!renderer.capabilities.isWebGL2) {
  window.__showFatal('当前浏览器或显卡不支持 WebGL 2。');
  throw new Error('WebGL2 required');
}

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.setAttribute('aria-label', '可拖动旋转的云上星台三维场景');
stageEl.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xcfd9df, 0.0034);

const camera = new THREE.PerspectiveCamera(
  HOME_VIEW.fov,
  window.innerWidth / window.innerHeight,
  0.5,
  2200
);
camera.position.copy(HOME_VIEW.position);
camera.lookAt(HOME_VIEW.target);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(HOME_VIEW.target);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.rotateSpeed = 0.52;
controls.zoomSpeed = 0.78;
controls.panSpeed = 0.62;
controls.screenSpacePanning = false;
controls.minDistance = 55;
controls.maxDistance = 185;
controls.minPolarAngle = 0.40;
controls.maxPolarAngle = 1.50;
controls.enablePan = true;
controls.autoRotate = false;
controls.update();

/* 平移限制：不让目标点离开岛体太远。 */
const PAN_LIMIT = 16;
function clampControlsTarget() {
  const t = controls.target;
  t.y = clamp(t.y, -8, 8);
  const r = Math.hypot(t.x, t.z);
  if (r > PAN_LIMIT) {
    const k = PAN_LIMIT / r;
    t.x *= k;
    t.z *= k;
  }
}

/* ------------------------------- 共享工具 -------------------------------- */
function addColorAttribute(geometry, colorHex, jitter = 0.045, seed = 0) {
  const pos = geometry.attributes.position;
  const arr = new Float32Array(pos.count * 3);
  const base = new THREE.Color(colorHex);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const n = hash2i(i + seed * 17, seed * 7 + 3) - 0.5;
    const n2 = hash2i(i * 3 + seed, i + 11) - 0.5;
    c.copy(base);
    c.offsetHSL(n * jitter * 0.16, n2 * jitter * 0.22, n * jitter);
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geometry;
}

function mergeAll(list) {
  if (!list.length) return null;
  if (list.length === 1) return list[0];
  return mergeGeometries(list, false);
}

function disposeGroup(group) {
  group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
  });
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

const APP = {
  renderer, scene, camera, controls,
  clock: new THREE.Clock(),
  world: new THREE.Group(),
  night: { value: 0, target: 0, from: 0, to: 0, start: 0, dur: 2.6, active: false },
  quality: { level: 2, samples: [], lastAdjust: 0 },
  picking: { enabled: true },
  steleMeshes: [],
  steleRecords: [],
  emissiveMats: [],
  textMats: [],
  lanternMats: [],
  lanternLights: [],
  glowSprites: [],
  cloudMats: [],
  waterUniforms: [],
  windUniforms: [],
  deviceGroups: [],
  fireflies: null,
  stars: null,
  skyUniforms: null,
  sunMesh: null,
  moonMesh: null,
  sunGlow: null,
  moonGlow: null,
  keyLight: null,
  fillLight: null,
  hemiLight: null,
  ambientLight: null,
  pathSamples: [],
  ready: false
};
scene.add(APP.world);
