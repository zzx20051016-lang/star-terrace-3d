/* =========================================================================
   02 · 地形：浮空山岛、顶部土层、断裂岩壁、底部悬垂岩体、小浮岛与残桥
   ========================================================================= */

const islandGroup = new THREE.Group();
islandGroup.name = 'island';
APP.world.add(islandGroup);

/* --------------------------- 顶部土层（网格） ---------------------------- */
function buildIslandTop() {
  const SEG = 128;
  const RINGS = 64;
  const positions = [];
  const colors = [];
  const uvs = [];
  const indices = [];
  const grass = new THREE.Color(0x6f7d50);
  const grassDry = new THREE.Color(0x8b8556);
  const earth = new THREE.Color(0x8a7355);
  const dirt = new THREE.Color(0x685741);
  const c = new THREE.Color();

  for (let j = 0; j <= RINGS; j++) {
    const t = j / RINGS;
    const radial = Math.pow(t, 0.94);
    for (let i = 0; i <= SEG; i++) {
      const theta = (i / SEG) * TAU;
      const R = rimRadius(theta);
      const r = radial * R;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      const edge = smoothstep(0.82, 1.0, t);

      // 岛缘锯齿与缺口
      const jag = 1
        + (vnoise(theta * 9.3, 4.1) - 0.5) * 0.055 * edge
        + (vnoise(theta * 23.0, 8.7) - 0.5) * 0.020 * edge;
      const px = x * jag;
      const pz = z * jag;
      let y = terrainHeight(px, pz);
      y -= edge * edge * 0.85;

      positions.push(px, y, pz);
      uvs.push((px + 50) / 100, (pz + 50) / 100);

      const n = fbm2(px * 0.105 + 9.2, pz * 0.105 - 3.4, 4);
      const n2 = vnoise(px * 0.52, pz * 0.52);
      const n3 = fbm2(px * 0.28 - 2.2, pz * 0.28 + 6.1, 3);
      c.copy(grass).lerp(grassDry, smoothstep(0.40, 0.80, n));
      c.lerp(earth, smoothstep(0.56, 0.90, n2) * 0.50);
      c.lerp(dirt, smoothstep(0.86, 1.0, t) * 0.72);
      // 苔斑与浅色砂土
      c.lerp(new THREE.Color(0x5d7046), smoothstep(0.55, 0.85, n3) * 0.35);
      const shade = 0.88 + n * 0.24;
      c.multiplyScalar(shade);
      colors.push(c.r, c.g, c.b);
    }
  }

  for (let j = 0; j < RINGS; j++) {
    for (let i = 0; i < SEG; i++) {
      const a = j * (SEG + 1) + i;
      const b = a + 1;
      const d = (j + 1) * (SEG + 1) + i;
      const e = d + 1;
      indices.push(a, d, b, b, d, e);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const topMat = withSurfaceDetail(new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    map: TEX.rock,
    bumpMap: TEX.rock,
    bumpScale: 0.08,
    roughness: 0.98,
    metalness: 0.0
  }), { scale: 0.22, colorJitter: 0.05, strata: 0.0, wet: 0.15, grainRough: 0.10 });

  const mesh = new THREE.Mesh(geo, topMat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.name = 'island-top';
  islandGroup.add(mesh);
  return mesh;
}

/* --------------------------- 岛缘土层断面 -------------------------------- */
function buildIslandRim() {
  const SEG = 160;
  const RINGS = 8;
  const positions = [];
  const colors = [];
  const uvs = [];
  const indices = [];
  const soil = new THREE.Color(0x6b5943);
  const soil2 = new THREE.Color(0x4b4034);
  const c = new THREE.Color();

  for (let j = 0; j <= RINGS; j++) {
    const t = j / RINGS;
    for (let i = 0; i <= SEG; i++) {
      const theta = (i / SEG) * TAU;
      const R = rimRadius(theta);
      const edgeJag = (vnoise(theta * 13.0, 2.2) - 0.5) * 1.9 + (vnoise(theta * 31.0, 5.7) - 0.5) * 0.7;
      const inset = t * 1.6 + edgeJag * (0.22 + t * 1.0);
      const r = R - inset;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      const y = -0.75 * (1 - t) - t * (4.6 + Math.sin(theta * 5.0) * 1.4);
      positions.push(x, y, z);
      uvs.push((i / SEG) * 9, t * 2.8);
      c.copy(soil).lerp(soil2, t * 0.85);
      c.multiplyScalar(0.86 + vnoise(theta * 17, t * 6) * 0.28);
      // 草根向下垂挂的暗色条纹
      const root = Math.pow(vnoise(theta * 41.0, t * 3.0), 4) * 0.35;
      c.lerp(new THREE.Color(0x3b3428), root);
      colors.push(c.r, c.g, c.b);
    }
  }
  for (let j = 0; j < RINGS; j++) {
    for (let i = 0; i < SEG; i++) {
      const a = j * (SEG + 1) + i;
      const b = a + 1;
      const d = (j + 1) * (SEG + 1) + i;
      const e = d + 1;
      indices.push(a, d, b, b, d, e);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, MAT.stoneDark);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  islandGroup.add(mesh);
  return mesh;
}

/* ---------------------------- 主岩体（径向网格） ------------------------- */
/* 轮廓关键帧：t=0 顶部，t=1 底部。数值为相对岛缘半径的系数。 */
const ROCK_PROFILE = [
  [0.00, 1.000],
  [0.05, 0.985],
  [0.10, 0.948],
  [0.16, 0.965],
  [0.24, 0.890],
  [0.32, 0.910],
  [0.42, 0.780],
  [0.50, 0.790],
  [0.58, 0.660],
  [0.66, 0.560],
  [0.74, 0.475],
  [0.82, 0.370],
  [0.88, 0.275],
  [0.93, 0.190],
  [0.97, 0.115],
  [1.00, 0.060]
];

function profileAt(t) {
  const p = ROCK_PROFILE;
  for (let i = 0; i < p.length - 1; i++) {
    if (t >= p[i][0] && t <= p[i + 1][0]) {
      const k = (t - p[i][0]) / (p[i + 1][0] - p[i][0]);
      return lerp(p[i][1], p[i + 1][1], k);
    }
  }
  return p[p.length - 1][1];
}

/** 岩壁扶壁：不同经度的垂直脊，让剪影不是光滑圆锥。 */
function buttress(theta) {
  const a = Math.pow(0.5 + 0.5 * Math.sin(theta * 7.0 + 0.9), 2.2);
  const b = Math.pow(0.5 + 0.5 * Math.sin(theta * 13.0 + 3.7), 3.0);
  const c = Math.pow(0.5 + 0.5 * Math.sin(theta * 3.0 + 5.2), 2.0);
  return a * 0.085 + b * 0.045 + c * 0.055;
}

function buildMainRock() {
  const SEG = 176;
  const LEVELS = 40;
  const positions = [];
  const colors = [];
  const uvs = [];
  const indices = [];

  const strataA = new THREE.Color(0xb0a189);
  const strataB = new THREE.Color(0x94856e);
  const strataC = new THREE.Color(0x7b6e5b);
  const deep = new THREE.Color(0x5e5345);
  const moss = new THREE.Color(0x76805a);
  const ochre = new THREE.Color(0xb59b73);
  const c = new THREE.Color();

  // 每个经度的深度与底部位移
  const info = [];
  for (let i = 0; i <= SEG; i++) {
    const theta = (i / SEG) * TAU;
    const n1 = vnoise(theta * 2.7 + 1.3, 8.7);
    const n2 = vnoise(theta * 5.9 + 4.1, 2.9);
    info.push({
      theta,
      depth: 62 + n1 * 14 + n2 * 7,
      lean: 2.0 + n1 * 2.4,
      leanDir: theta + 0.8 + n2 * 1.2
    });
  }

  for (let j = 0; j <= LEVELS; j++) {
    const t = j / LEVELS;
    for (let i = 0; i <= SEG; i++) {
      const { theta, depth, lean, leanDir } = info[i];
      const R = rimRadius(theta);
      const base = profileAt(t);

      // 扶壁：中段最强，底部收敛
      const bAmt = smoothstep(0.04, 0.22, t) * (1 - smoothstep(0.80, 1.0, t));
      let radial = R * base * (1 + buttress(theta) * bAmt);

      // 垂直沟壑
      const gully = (vnoise(theta * 46.0, t * 2.2) - 0.5) * 0.055 * smoothstep(0.06, 0.3, t) * (1 - smoothstep(0.86, 1, t));
      radial *= 1 + gully;

      // 岩层台阶的轻微横向起伏
      radial *= 1 + Math.sin(t * 27.0 + theta * 1.7) * 0.008;

      const x = Math.cos(theta) * radial;
      const z = Math.sin(theta) * radial;
      const y = -0.55 - depth * t;

      // 底部向一侧偏斜，形成悬垂的岩体
      const leanAmt = Math.pow(t, 2.3) * lean;
      const sx = x + Math.cos(leanDir) * leanAmt;
      const sz = z + Math.sin(leanDir) * leanAmt;

      positions.push(sx, y, sz);
      uvs.push((i / SEG) * 12, t * 9);

      const band = 0.5 + 0.5 * Math.sin(y * 0.72 + vnoise(theta * 4.0, y * 0.22) * 5.0);
      c.copy(strataA).lerp(strataB, band);
      c.lerp(strataC, smoothstep(0.5, 0.95, t) * 0.7);
      c.lerp(deep, smoothstep(0.9, 1.0, t) * 0.45);
      c.lerp(ochre, Math.pow(vnoise(theta * 8.0, y * 0.08), 2) * 0.30);
      c.lerp(moss, smoothstep(0.30, 0.05, t) * 0.30 * (0.4 + vnoise(theta * 9, 3.1) * 0.6));
      c.multiplyScalar(0.92 + vnoise(theta * 21, t * 17) * 0.20);
      colors.push(c.r, c.g, c.b);
    }
  }
  for (let j = 0; j < LEVELS; j++) {
    for (let i = 0; i < SEG; i++) {
      const a = j * (SEG + 1) + i;
      const b = a + 1;
      const d = (j + 1) * (SEG + 1) + i;
      const e = d + 1;
      indices.push(a, d, b, b, d, e);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, MAT.rock);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.name = 'island-rock';
  islandGroup.add(mesh);
  return mesh;
}

/* ---------------------------- 悬垂岩柱 ---------------------------------- */
function buildHangingSpurs() {
  const group = new THREE.Group();
  const rnd = rngFor(301);
  const specs = [
    { theta: 0.42, t: 0.64, len: 13.0, rad: 4.0 },
    { theta: 2.28, t: 0.52, len: 9.0, rad: 3.0 },
    { theta: 3.80, t: 0.70, len: 15.0, rad: 4.4 },
    { theta: 5.18, t: 0.58, len: 8.0, rad: 2.6 },
    { theta: 1.55, t: 0.80, len: 7.0, rad: 2.2 }
  ];
  for (const s of specs) {
    const theta = s.theta + (rnd() - 0.5) * 0.10;
    const R = rimRadius(theta);
    const radial = R * profileAt(s.t) * 0.86;
    const x = Math.cos(theta) * radial;
    const z = Math.sin(theta) * radial;
    const y = -0.55 - (62 + 14) * s.t;
    const geo = new THREE.ConeGeometry(s.rad, s.len, 9, 5, true);
    geo.rotateX(Math.PI);
    geo.translate(0, -s.len / 2, 0);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
      const k = 1 + (vnoise(px * 1.5 + 3, py * 0.6) - 0.5) * 0.45;
      pos.setXYZ(i, px * k, py + (vnoise(pz * 1.9, px * 1.1) - 0.5) * 1.6, pz * k);
    }
    geo.computeVertexNormals();
    addColorAttribute(geo, 0x7d705c, 0.10, 31 + Math.floor(theta * 10));
    const m = new THREE.Mesh(geo, MAT.rock);
    m.position.set(x, y, z);
    m.rotation.y = rnd() * TAU;
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  islandGroup.add(group);
  return group;
}

/* ---------------------- 岛缘斜出的断裂岩层 ------------------------------ */
/* 在几处崖壁上外挑出倾斜的岩板，打破光滑的旋转体轮廓。 */
function buildStrataSlabs() {
  const rnd = rngFor(361);
  const specs = [
    { theta: 0.95, t: 0.30, size: [9, 2.2, 6], tilt: 0.30 },
    { theta: 1.95, t: 0.24, size: [7, 1.8, 5], tilt: -0.24 },
    { theta: 3.05, t: 0.34, size: [10, 2.4, 6.5], tilt: 0.22 },
    { theta: 4.30, t: 0.27, size: [8, 2.0, 5.5], tilt: -0.30 },
    { theta: 5.35, t: 0.38, size: [6, 1.6, 4.2], tilt: 0.18 },
    { theta: 2.55, t: 0.46, size: [7.5, 1.9, 4.8], tilt: 0.26 }
  ];
  for (let k = 0; k < specs.length; k++) {
    const s = specs[k];
    const theta = s.theta + (rnd() - 0.5) * 0.12;
    const R = rimRadius(theta);
    const radial = R * profileAt(s.t) * 0.94;
    const x = Math.cos(theta) * radial;
    const z = Math.sin(theta) * radial;
    const y = -0.55 - 47 * s.t;
    const geo = new THREE.BoxGeometry(s.size[0], s.size[1], s.size[2], 3, 2, 3);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
      const n = vnoise(px * 0.9 + k * 3.1, pz * 0.9 + py) - 0.5;
      pos.setXYZ(i, px * (1 + n * 0.12), py + n * 0.5, pz * (1 + n * 0.16));
    }
    geo.computeVertexNormals();
    addColorAttribute(geo, 0x93836b, 0.08, 370 + k);
    const m = new THREE.Mesh(geo, MAT.rock);
    m.position.set(x, y, z);
    m.rotation.y = -theta + Math.PI / 2;
    m.rotation.z = s.tilt;
    m.rotation.x = (rnd() - 0.5) * 0.12;
    m.castShadow = true;
    m.receiveShadow = true;
    islandGroup.add(m);
  }
}

/* ------------------------------ 浮岩碎块 -------------------------------- */
function makeChunkGeometry(seed, detail = 1) {
  const rnd = rngFor(seed);
  const geo = new THREE.IcosahedronGeometry(1, detail);
  const pos = geo.attributes.position;
  const ox = rnd() * 10, oy = rnd() * 10, oz = rnd() * 10;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n = fbm3(x * 1.4 + ox, y * 1.4 + oy, z * 1.4 + oz, 3);
    const k = 0.62 + n * 0.72;
    const taper = y < 0 ? lerp(0.55, 1.0, smoothstep(-1, 0.1, y)) : 1;
    pos.setXYZ(i, x * k * taper, y * k * 1.15, z * k * taper);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildDebrisChunks() {
  const rnd = rngFor(311);
  const geos = [makeChunkGeometry(401, 1), makeChunkGeometry(402, 1), makeChunkGeometry(403, 0)];
  geos.forEach((g, i) => addColorAttribute(g, i === 2 ? 0x6b6153 : 0x847663, 0.10, 51 + i));

  for (let i = 0; i < 16; i++) {
    const theta = rnd() * TAU;
    const R = rimRadius(theta);
    const r = R * (1.10 + rnd() * 0.30);
    const y = -8 - rnd() * 30;
    const geo = geos[i % geos.length];
    const mesh = new THREE.Mesh(geo, MAT.rock);
    const s = 0.6 + Math.pow(rnd(), 1.8) * 3.0;
    mesh.scale.set(s * (0.8 + rnd() * 0.5), s * (0.7 + rnd() * 0.7), s * (0.8 + rnd() * 0.5));
    mesh.position.set(Math.cos(theta) * r, y, Math.sin(theta) * r);
    mesh.rotation.set(rnd() * TAU, rnd() * TAU, rnd() * TAU);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    islandGroup.add(mesh);
  }
}

/* ------------------------------ 远浮岛 -------------------------------- */
function buildFarIslet({ x, y, z, scale, seed, bridge = false }) {
  const g = new THREE.Group();
  const rnd = rngFor(seed);
  const topR = 4.2;

  const topGeo = new THREE.CircleGeometry(topR, 26, 0, TAU);
  topGeo.rotateX(-Math.PI / 2);
  const tpos = topGeo.attributes.position;
  for (let i = 0; i < tpos.count; i++) {
    const px = tpos.getX(i), pz = tpos.getZ(i);
    const d = Math.hypot(px, pz) / topR;
    tpos.setY(i, (0.4 + vnoise(px * 0.9 + seed, pz * 0.9) * 0.55) * (1 - d * 0.35));
  }
  topGeo.computeVertexNormals();
  addColorAttribute(topGeo, 0x74805b, 0.06, seed);
  const top = new THREE.Mesh(topGeo, MAT.stone);
  top.receiveShadow = true;
  g.add(top);

  const rockGeo = new THREE.ConeGeometry(topR * 0.98, topR * 3.6, 12, 8, true);
  rockGeo.rotateX(Math.PI);
  rockGeo.translate(0, -topR * 1.8, 0);
  const rpos = rockGeo.attributes.position;
  for (let i = 0; i < rpos.count; i++) {
    const px = rpos.getX(i), py = rpos.getY(i), pz = rpos.getZ(i);
    const n = fbm3(px * 0.6 + seed, py * 0.35, pz * 0.6, 3);
    const k = 0.8 + n * 0.5;
    rpos.setXYZ(i, px * k, py + (n - 0.5) * 1.4, pz * k);
  }
  rockGeo.computeVertexNormals();
  addColorAttribute(rockGeo, 0x7f7361, 0.10, seed + 3);
  const rock = new THREE.Mesh(rockGeo, MAT.rock);
  rock.castShadow = true;
  rock.receiveShadow = true;
  g.add(rock);

  const treeCount = 1 + Math.floor(rnd() * 2);
  for (let i = 0; i < treeCount; i++) {
    const t = makePineTree({
      seed: seed + i * 13,
      height: 3.0 + rnd() * 2.0,
      scale: 0.6,
      simple: true
    });
    const a = rnd() * TAU;
    const rr = rnd() * topR * 0.5;
    t.position.set(Math.cos(a) * rr, 0.55, Math.sin(a) * rr);
    g.add(t);
  }

  g.position.set(x, y, z);
  g.scale.setScalar(scale);
  APP.world.add(g);

  if (bridge) {
    const bridgeGroup = new THREE.Group();
    const span = 17;
    const segments = 5;
    for (let i = 0; i < segments; i++) {
      if (i === 3) continue;
      const t = i / (segments - 1);
      const geo = new THREE.BoxGeometry(span / segments * 0.92, 0.34, 1.9);
      addColorAttribute(geo, 0xa49b8a, 0.05, seed + i);
      const m = new THREE.Mesh(geo, MAT.stone);
      m.position.set(-span / 2 + t * span + (rnd() - 0.5) * 0.3, -t * 0.5 + Math.sin(t * 3) * 0.5, (rnd() - 0.5) * 0.2);
      m.rotation.z = (rnd() - 0.5) * 0.06;
      m.rotation.y = (rnd() - 0.5) * 0.08;
      m.castShadow = true;
      bridgeGroup.add(m);
      if (i % 2 === 0 && i < segments - 1) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.1, 0.22), MAT.stone);
        rail.position.set(m.position.x, m.position.y + 0.62, 0.78);
        bridgeGroup.add(rail);
      }
    }
    bridgeGroup.position.set(x - 9, y - 0.4, z);
    bridgeGroup.rotation.y = 0.32;
    APP.world.add(bridgeGroup);
  }
  return g;
}

/* ------------------------------- 组装地形 ------------------------------- */
const islandTop = buildIslandTop();
const islandRim = buildIslandRim();
const islandRock = buildMainRock();
buildHangingSpurs();
buildStrataSlabs();
buildDebrisChunks();

buildFarIslet({ x: -92, y: 16, z: -46, scale: 0.66, seed: 901, bridge: false });
buildFarIslet({ x: 82, y: 6, z: -86, scale: 0.50, seed: 902, bridge: true });
buildFarIslet({ x: -58, y: -12, z: 98, scale: 0.42, seed: 903, bridge: false });
buildFarIslet({ x: 112, y: -16, z: 36, scale: 0.30, seed: 904, bridge: false });

/* 细碎的悬空石子 */
(function smallFloatingRocks() {
  const rnd = rngFor(333);
  const geo = makeChunkGeometry(777, 0);
  addColorAttribute(geo, 0x837662, 0.09, 71);
  for (let i = 0; i < 22; i++) {
    const theta = rnd() * TAU;
    const R = rimRadius(theta);
    const r = R * (1.12 + rnd() * 0.5);
    const mesh = new THREE.Mesh(geo, MAT.rock);
    const s = 0.18 + rnd() * 0.65;
    mesh.scale.setScalar(s);
    mesh.position.set(Math.cos(theta) * r, -4 - rnd() * 36, Math.sin(theta) * r);
    mesh.rotation.set(rnd() * TAU, rnd() * TAU, rnd() * TAU);
    islandGroup.add(mesh);
  }
})();
