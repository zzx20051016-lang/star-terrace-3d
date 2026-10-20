/* =========================================================================
   05 · 四象庭院与二十八宿碑
   每个庭院：一段弧形矮墙 + 一座亭阁 + 中央四象浅浮雕石台 + 七枚星宿碑。
   二十八宿碑每枚代表一宿（天区），不是一颗星。
   ========================================================================= */

const courtyardGroups = [];
const pickTargets = [];

/* ------------------------------ 通用构件 -------------------------------- */

/** 轻微翘角的庑殿顶。用四条曲面屋坡 + 正脊 + 垂脊构成。 */
function makeCurvedRoof(width, depth, height, overhang = 0.55, seed = 1) {
  const g = new THREE.Group();
  const w = width / 2 + overhang;
  const d = depth / 2 + overhang;
  const h = height;
  const rnd = rngFor(seed);

  // 单个屋坡：横向分 8 段，纵向分 5 段，形成下凹曲线与两端起翘
  function slope(signX, signZ) {
    const cols = 10, rows = 6;
    const pos = [], uv = [], idx = [];
    for (let j = 0; j <= rows; j++) {
      const v = j / rows;
      for (let i = 0; i <= cols; i++) {
        const u = i / cols;
        // 从檐口(u 端)到屋脊
        const x = lerp(-w, w, u) * (1 - v * 0.0);
        const z = lerp(d, 0, v);
        // 檐口曲线：两端上翘
        const eaveLift = Math.pow(Math.abs(u - 0.5) * 2, 2.4) * h * 0.22;
        const y = lerp(0.06 + eaveLift, h, Math.pow(v, 0.82));
        const px = signX * (x * (1 - v * 0.92) + (u - 0.5) * 0.0);
        const pz = signZ * z;
        pos.push(px, y, pz);
        uv.push(u * 3, v * 1.4);
      }
    }
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const a = j * (cols + 1) + i;
        const b = a + 1;
        const c = (j + 1) * (cols + 1) + i;
        const dd = c + 1;
        if (signZ > 0) idx.push(a, c, b, b, c, dd);
        else idx.push(a, b, c, b, dd, c);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  const geoN = slope(1, 1);
  const geoW = slope(1, -1);
  const merged = mergeGeometries([geoN, geoW], false);
  addColorAttribute(merged, 0x5c646d, 0.05, seed);
  const roof = new THREE.Mesh(merged, MAT.roof);
  roof.castShadow = true;
  roof.receiveShadow = true;
  g.add(roof);

  // 正脊
  const ridgeGeo = new THREE.BoxGeometry(0.18, 0.20, w * 2 * 0.98);
  addColorAttribute(ridgeGeo, 0x3a4149, 0.04, seed + 1);
  const ridge = new THREE.Mesh(ridgeGeo, MAT.roof);
  ridge.position.y = h + 0.06;
  ridge.castShadow = true;
  g.add(ridge);

  // 脊端鸱吻：小翘片
  for (const sx of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.52, 4), MAT.roof);
    tip.position.set(0, h + 0.32, sx * w * 0.97);
    tip.rotation.x = sx * 0.38;
    tip.castShadow = true;
    g.add(tip);
  }

  // 垂脊（四角）
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const len = Math.hypot(w, d);
      const geo = new THREE.BoxGeometry(0.13, 0.12, len);
      addColorAttribute(geo, 0x3d444c, 0.04, seed + 2);
      const m = new THREE.Mesh(geo, MAT.roof);
      m.position.set(sx * w * 0.5, h * 0.5 + 0.05, sz * d * 0.5);
      m.rotation.y = Math.atan2(sx * w, sz * d);
      m.rotation.x = -Math.atan2(h, len) * 0.9;
      m.castShadow = true;
      g.add(m);
    }
  }
  return g;
}

/** 亭阁：台基 + 四柱 + 枋 + 屋顶。用于庭院与岛缘。 */
function makePavilion({ size = 4.6, height = 3.0, seed = 1, roofColor = 0x5c646d, accents = 0x8a5a3c } = {}) {
  const g = new THREE.Group();
  const rnd = rngFor(seed);

  // 台基
  const baseGeo = new THREE.BoxGeometry(size + 1.3, 0.46, size + 1.3);
  addColorAttribute(baseGeo, 0xa8a08e, 0.04, seed + 10);
  const base = new THREE.Mesh(baseGeo, MAT.stone);
  base.position.y = 0.23;
  base.receiveShadow = true;
  base.castShadow = true;
  g.add(base);

  const base2Geo = new THREE.BoxGeometry(size + 0.7, 0.22, size + 0.7);
  addColorAttribute(base2Geo, 0xb2aa97, 0.04, seed + 11);
  const base2 = new THREE.Mesh(base2Geo, MAT.stone);
  base2.position.y = 0.55;
  base2.receiveShadow = true;
  g.add(base2);

  // 地面
  const floorGeo = new THREE.BoxGeometry(size, 0.14, size);
  addColorAttribute(floorGeo, 0x8d8574, 0.05, seed + 12);
  const floor = new THREE.Mesh(floorGeo, MAT.stone);
  floor.position.y = 0.7;
  floor.receiveShadow = true;
  g.add(floor);

  // 柱
  const colGeo = new THREE.CylinderGeometry(0.14, 0.17, height, 10);
  addColorAttribute(colGeo, accents, 0.05, seed + 13);
  const colPositions = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * (size / 2 - 0.25);
      const z = sz * (size / 2 - 0.25);
      const col = new THREE.Mesh(colGeo, MAT.wood);
      col.position.set(x, 0.77 + height / 2, z);
      col.castShadow = true;
      col.receiveShadow = true;
      g.add(col);
      colPositions.push([x, z]);

      // 柱础
      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.16, 10), MAT.stone);
      plinth.position.set(x, 0.83, z);
      g.add(plinth);
    }
  }

  // 枋（横梁）
  const beamGeoX = new THREE.BoxGeometry(size - 0.3, 0.20, 0.16);
  const beamGeoZ = new THREE.BoxGeometry(0.16, 0.20, size - 0.3);
  addColorAttribute(beamGeoX, accents, 0.04, seed + 14);
  addColorAttribute(beamGeoZ, accents, 0.04, seed + 15);
  for (const sz of [-1, 1]) {
    const b = new THREE.Mesh(beamGeoX, MAT.wood);
    b.position.set(0, 0.77 + height - 0.1, sz * (size / 2 - 0.25));
    b.castShadow = true;
    g.add(b);
  }
  for (const sx of [-1, 1]) {
    const b = new THREE.Mesh(beamGeoZ, MAT.wood);
    b.position.set(sx * (size / 2 - 0.25), 0.77 + height - 0.1, 0);
    b.castShadow = true;
    g.add(b);
  }

  // 斗拱暗示：柱头小方块
  const blockGeo = new THREE.BoxGeometry(0.32, 0.18, 0.32);
  addColorAttribute(blockGeo, 0x8f6a44, 0.04, seed + 16);
  for (const [x, z] of colPositions) {
    const blk = new THREE.Mesh(blockGeo, MAT.wood);
    blk.position.set(x, 0.77 + height + 0.08, z);
    blk.castShadow = true;
    g.add(blk);
  }

  // 屋顶
  const roof = makeCurvedRoof(size + 1.5, size + 1.5, 1.55, 0.62, seed + 20);
  roof.position.y = 0.77 + height + 0.2;
  g.add(roof);

  // 匾额
  const plaqueTex = canvasTexture(makePlaqueTexture('观星', 'ART · NOT A SKY MAP'), { repeat: 1 });
  plaqueTex.wrapS = plaqueTex.wrapT = THREE.ClampToEdgeWrapping;
  const plaqueMat = new THREE.MeshStandardMaterial({
    map: plaqueTex,
    roughness: 0.6,
    metalness: 0.1,
    emissive: new THREE.Color(0xffd9a0),
    emissiveMap: plaqueTex,
    emissiveIntensity: 0.0
  });
  APP.emissiveMats.push({ mat: plaqueMat, day: 0.0, night: 0.35 });
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.71), plaqueMat);
  plaque.position.set(0, 0.77 + height - 0.42, size / 2 - 0.18);
  g.add(plaque);

  // 内部石案
  const tableGeo = new THREE.BoxGeometry(1.2, 0.16, 0.7);
  addColorAttribute(tableGeo, 0x8f8776, 0.05, seed + 30);
  const table = new THREE.Mesh(tableGeo, MAT.stone);
  table.position.set(0, 1.02, 0);
  table.castShadow = true;
  g.add(table);

  return g;
}

/** 弧形矮墙，用于庭院围合；带断口，避免封闭感。 */
function makeArcWall(radius, from, to, { height = 0.85, seed = 1, gaps = [] } = {}) {
  const g = new THREE.Group();
  const segments = Math.max(6, Math.round((to - from) / 0.14));
  const postGeo = new THREE.BoxGeometry(0.30, height, 0.30);
  addColorAttribute(postGeo, 0x9a9280, 0.05, seed);
  const panelGeo = new THREE.BoxGeometry(1, height * 0.72, 0.20);
  addColorAttribute(panelGeo, 0xa8a08e, 0.05, seed + 1);
  const capGeo = new THREE.BoxGeometry(1, 0.10, 0.30);
  addColorAttribute(capGeo, 0x8e8778, 0.05, seed + 2);

  let prev = null;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = lerp(from, to, t);
    const gapped = gaps.some(([g0, g1]) => a > g0 && a < g1);
    if (gapped) { prev = null; continue; }
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    const y = terrainHeight(x, z);

    if (i % 2 === 0) {
      const post = new THREE.Mesh(postGeo, MAT.stone);
      post.position.set(x, y + height / 2, z);
      post.rotation.y = -a;
      post.castShadow = true;
      post.receiveShadow = true;
      g.add(post);
      const cap = new THREE.Mesh(capGeo, MAT.stone);
      cap.position.set(x, y + height + 0.05, z);
      cap.rotation.y = -a;
      g.add(cap);
    }
    if (prev) {
      const dx = x - prev.x, dz = z - prev.z;
      const len = Math.hypot(dx, dz);
      const panel = new THREE.Mesh(panelGeo, MAT.stone);
      panel.position.set((x + prev.x) / 2, (y + prev.y) / 2 + height * 0.36, (z + prev.z) / 2);
      panel.scale.x = len * 0.92;
      panel.rotation.y = Math.atan2(dx, dz) - Math.PI / 2;
      panel.castShadow = true;
      panel.receiveShadow = true;
      g.add(panel);
    }
    prev = { x, z, y };
  }
  return g;
}

/** 四象浅浮雕石台。 */
function makeSymbolAltar(courtyard, seed) {
  const g = new THREE.Group();

  // 石台
  const baseGeo = new THREE.CylinderGeometry(1.75, 1.95, 0.30, 8);
  addColorAttribute(baseGeo, 0x9d9583, 0.05, seed);
  const base = new THREE.Mesh(baseGeo, MAT.stone);
  base.position.y = 0.15;
  base.castShadow = true;
  base.receiveShadow = true;
  g.add(base);

  const midGeo = new THREE.CylinderGeometry(1.45, 1.58, 0.24, 8);
  addColorAttribute(midGeo, 0xa8a08e, 0.05, seed + 1);
  const mid = new THREE.Mesh(midGeo, MAT.stone);
  mid.position.y = 0.42;
  mid.castShadow = true;
  g.add(mid);

  // 斜置浮雕面
  const tex = canvasTexture(makeMotifTexture(courtyard.motif, '#3a332a', {
    size: 512, lineWidth: 4.5, alpha: 1
  }), { repeat: 1 });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    transparent: true,
    roughness: 0.72,
    metalness: 0.18,
    color: 0xffffff,
    emissive: new THREE.Color(courtyard.color),
    emissiveMap: tex,
    emissiveIntensity: 0.0,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2
  });
  APP.emissiveMats.push({ mat, day: 0.0, night: 0.55 });

  const plate = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.5), mat);
  plate.rotation.x = -Math.PI / 2;
  plate.position.y = 0.555;
  g.add(plate);

  // 四角小铜钉
  const studGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.08, 8);
  addColorAttribute(studGeo, 0xb08a4e, 0.04, seed + 2);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    const stud = new THREE.Mesh(studGeo, MAT.bronze);
    stud.position.set(Math.cos(a) * 1.25, 0.58, Math.sin(a) * 1.25);
    g.add(stud);
  }

  return g;
}

/* ------------------------------- 星宿碑 --------------------------------- */
/**
 * 碑 = 底座 + 碑身 + 碑额 + 正面文字贴图。
 * 返回 mesh（可拾取）并登记资料。
 */
function makeStele(mansion, courtyard, { height = 2.3, seed = 1 } = {}) {
  const g = new THREE.Group();
  const w = height * 0.46;
  const t = height * 0.115;

  // 底座：两级
  const plinthGeo = new THREE.BoxGeometry(w * 1.7, height * 0.10, t * 2.4);
  addColorAttribute(plinthGeo, 0x8f8776, 0.05, seed);
  const plinth = new THREE.Mesh(plinthGeo, MAT.stoneDark);
  plinth.position.y = height * 0.05;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  g.add(plinth);

  const plinth2Geo = new THREE.BoxGeometry(w * 1.38, height * 0.07, t * 2.0);
  addColorAttribute(plinth2Geo, 0xa09887, 0.05, seed + 1);
  const plinth2 = new THREE.Mesh(plinth2Geo, MAT.stone);
  plinth2.position.y = height * 0.135;
  plinth2.castShadow = true;
  g.add(plinth2);

  // 碑身：顶部微收
  const bodyH = height * 0.70;
  const bodyGeo = new THREE.BoxGeometry(w, bodyH, t, 2, 6, 1);
  const bp = bodyGeo.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i), y = bp.getY(i);
    const k = 1 - smoothstep(bodyH * 0.28, bodyH * 0.5, y) * 0.10;
    bp.setX(i, x * k);
    bp.setZ(i, bp.getZ(i) * (1 + (vnoise(y * 1.7 + seed, x * 1.3) - 0.5) * 0.08));
  }
  bodyGeo.computeVertexNormals();
  addColorAttribute(bodyGeo, courtyard.stoneTint, 0.06, seed + 2);
  const body = new THREE.Mesh(bodyGeo, MAT.stoneDark);
  body.position.y = height * 0.17 + bodyH / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  // 碑额：小方盖
  const capGeo = new THREE.BoxGeometry(w * 1.12, height * 0.08, t * 1.4);
  addColorAttribute(capGeo, 0x8a8272, 0.04, seed + 3);
  const cap = new THREE.Mesh(capGeo, MAT.stone);
  cap.position.y = height * 0.17 + bodyH + height * 0.03;
  cap.castShadow = true;
  g.add(cap);

  // 碑面文字（发光贴图，昼夜变化）
  const faceMat = new THREE.MeshStandardMaterial({
    map: null,
    transparent: false,
    roughness: 0.82,
    metalness: 0.06,
    emissive: new THREE.Color(0xffc37a),
    emissiveIntensity: 0.0,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  });
  const faceTex = canvasTexture(makeSteleTexture(mansion, courtyard, false), { repeat: 1 });
  faceTex.wrapS = faceTex.wrapT = THREE.ClampToEdgeWrapping;
  faceMat.map = faceTex;
  faceMat.emissiveMap = faceTex;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.985, bodyH * 0.985), faceMat);
  face.position.set(0, height * 0.17 + bodyH / 2, t / 2 + 0.006);
  g.add(face);

  APP.emissiveMats.push({ mat: faceMat, day: 0.0, night: 0.62 });

  // 背面小铭文
  const backMat = new THREE.MeshStandardMaterial({
    color: courtyard.color,
    roughness: 0.7,
    metalness: 0.12,
    emissive: new THREE.Color(courtyard.color),
    emissiveIntensity: 0.0
  });
  APP.emissiveMats.push({ mat: backMat, day: 0.0, night: 0.22 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.5, bodyH * 0.5), backMat);
  back.position.set(0, height * 0.17 + bodyH / 2, -t / 2 - 0.004);
  back.rotation.y = Math.PI;
  g.add(back);

  // 可拾取代理：覆盖碑身与底座，保证触摸容易
  const hitGeo = new THREE.BoxGeometry(w * 1.75, height * 1.02, t * 2.6);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hit = new THREE.Mesh(hitGeo, hitMat);
  hit.position.y = height * 0.51;
  hit.userData.mansion = mansion;
  hit.userData.steleGroup = g;
  g.add(hit);

  return { group: g, hit, faceMat, body };
}

/* ------------------------------ 庭院构造 -------------------------------- */
function buildCourtyard(c, index) {
  const rnd = rngFor(1700 + index * 37);
  const g = new THREE.Group();
  const dir = c.center.clone().normalize();
  const angle = Math.atan2(dir.x, dir.z); // 让亭阁朝向中央
  const baseY = terrainHeight(c.center.x, c.center.z);

  g.position.set(0, 0, 0);

  // 庭院铺地：低矮的十六边形石坪
  const plazaGeo = new THREE.CylinderGeometry(5.8, 6.05, 0.18, 16);
  addColorAttribute(plazaGeo, 0xa39b89, 0.05, 1701 + index);
  const plaza = new THREE.Mesh(plazaGeo, MAT.stone);
  plaza.position.set(c.center.x, baseY + 0.07, c.center.z);
  plaza.receiveShadow = true;
  g.add(plaza);

  // 内圈铺地，颜色更深，形成层次
  const innerGeo = new THREE.CylinderGeometry(3.8, 3.8, 0.11, 16);
  addColorAttribute(innerGeo, 0x948c7b, 0.05, 1711 + index);
  const inner = new THREE.Mesh(innerGeo, MAT.stone);
  inner.position.set(c.center.x, baseY + 0.17, c.center.z);
  inner.receiveShadow = true;
  g.add(inner);

  // 四象石台（略偏后）
  const altar = makeSymbolAltar(c, 1720 + index);
  const altarPos = c.center.clone().add(dir.clone().multiplyScalar(1.75));
  altar.position.set(altarPos.x, baseY + 0.18, altarPos.z);
  altar.rotation.y = angle;
  g.add(altar);

  // 亭阁：放在庭院外侧，作为尺度参照
  const pavilion = makePavilion({
    size: 4.1,
    height: 2.85,
    seed: 1730 + index * 11,
    accents: c.key === 'south' ? 0x7a4436 : 0x6a4a34
  });
  const pavPos = c.center.clone().add(dir.clone().multiplyScalar(5.15));
  pavilion.position.set(pavPos.x, terrainHeight(pavPos.x, pavPos.z) - 0.1, pavPos.z);
  pavilion.rotation.y = angle;
  g.add(pavilion);

  // 弧形矮墙：以庭院中心为圆心，开口朝向中央路径
  const wallRadius = 9.4;
  const wallFrom = angle - Math.PI * 0.82;
  const wallTo = angle + Math.PI * 0.82;
  const wall = makeArcWall(wallRadius, wallFrom, wallTo, {
    height: 0.8,
    seed: 1750 + index,
    gaps: [
      [angle - 0.30, angle + 0.30],
      [angle - Math.PI * 0.62, angle - Math.PI * 0.44]
    ]
  });
  wall.position.set(c.center.x, 0, c.center.z);
  g.add(wall);

  // 七枚星宿碑：以庭院中心为圆心，朝向中央观星台排列
  const mansions = MANSIONS.filter((m) => m.key === c.key);
  const steleR = 3.35;
  const startA = angle + Math.PI * 0.5 - 0.16;
  const endA = angle + Math.PI * 1.5 + 0.16;
  mansions.forEach((m, i) => {
    const a = lerp(startA, endA, i / (mansions.length - 1));
    const x = c.center.x + Math.cos(a) * steleR;
    const z = c.center.z + Math.sin(a) * steleR;
    const y = terrainHeight(x, z) + 0.19;
    const stele = makeStele(m, c, { height: 2.25 + rnd() * 0.16, seed: 1800 + m.id * 13 });
    stele.group.position.set(x, y, z);
    stele.group.rotation.y = Math.atan2(-x, -z);
    g.add(stele.group);

    stele.hit.userData.mansion = m;
    stele.hit.userData.baseScale = 1;
    pickTargets.push(stele.hit);
    APP.steleMeshes.push(stele.hit);
    APP.steleRecords.push({ mansion: m, hit: stele.hit, group: stele.group, faceMat: stele.faceMat });
  });

  // 庭院灯火：两盏石灯
  for (const a of [angle + 0.9, angle - 0.9]) {
    const x = c.center.x + Math.cos(a) * 4.9;
    const z = c.center.z + Math.sin(a) * 4.9;
    const lantern = makeStoneLantern(0.85);
    lantern.position.set(x, terrainHeight(x, z) - 0.02, z);
    lantern.rotation.y = rnd() * TAU;
    g.add(lantern);
  }

  // 小型石堆与点缀
  const rockGeo = makeChunkGeometry(1850 + index, 0);
  addColorAttribute(rockGeo, c.stoneTint, 0.08, 1860 + index);
  for (let i = 0; i < 7; i++) {
    const a = rnd() * TAU;
    const rr = 4.0 + rnd() * 4.2;
    const x = c.center.x + Math.cos(a) * rr;
    const z = c.center.z + Math.sin(a) * rr;
    const s = 0.18 + rnd() * 0.45;
    const rock = new THREE.Mesh(rockGeo, MAT.rock);
    rock.position.set(x, terrainHeight(x, z) + s * 0.3, z);
    rock.scale.setScalar(s);
    rock.rotation.set(rnd() * TAU, rnd() * TAU, rnd() * TAU);
    rock.castShadow = true;
    rock.receiveShadow = true;
    g.add(rock);
  }

  APP.world.add(g);
  courtyardGroups.push({ courtyard: c, group: g, angle, baseY, pavilion, altar });
  return g;
}

COURTYARDS.forEach((c, i) => buildCourtyard(c, i));

/* --------------------------- 牌坊 / 入口标记 ----------------------------- */
function buildCourtyardGate(c, index) {
  // 在通往庭院的路径末端立一对短柱，形成入口
  const dir = c.center.clone().normalize();
  const g = new THREE.Group();
  const p = dir.clone().multiplyScalar(18.4);
  const tangent = new THREE.Vector3(-dir.z, 0, dir.x);
  const y = terrainHeight(p.x, p.z);

  const postGeo = new THREE.BoxGeometry(0.28, 2.1, 0.28);
  addColorAttribute(postGeo, 0x9a9280, 0.05, 1900 + index);
  for (const s of [-1, 1]) {
    const x = p.x + tangent.x * 2.1 * s;
    const z = p.z + tangent.z * 2.1 * s;
    const post = new THREE.Mesh(postGeo, MAT.stone);
    post.position.set(x, terrainHeight(x, z) + 1.05, z);
    post.rotation.y = Math.atan2(dir.x, dir.z);
    post.castShadow = true;
    g.add(post);

    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.34, 4), MAT.stone);
    cap.position.set(x, terrainHeight(x, z) + 2.2, z);
    cap.rotation.y = Math.PI / 4;
    g.add(cap);
  }

  const beam = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.2, 0.2), MAT.stone);
  beam.position.set(p.x, y + 1.9, p.z);
  beam.rotation.y = Math.atan2(tangent.x, tangent.z);
  beam.castShadow = true;
  g.add(beam);

  // 小铜牌：四象名
  const tex = canvasTexture(makeGlyphTexture(c.short, '#e3c58c'), { repeat: 1 });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const mat = new THREE.MeshStandardMaterial({
    map: tex, transparent: true, roughness: 0.45, metalness: 0.5,
    emissive: new THREE.Color(c.color), emissiveMap: tex, emissiveIntensity: 0.0, depthWrite: false
  });
  APP.emissiveMats.push({ mat, day: 0.0, night: 0.9 });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.82), mat);
  sign.position.set(p.x, y + 1.9, p.z);
  sign.rotation.y = Math.atan2(-dir.x, -dir.z);
  sign.position.add(dir.clone().multiplyScalar(0.12));
  g.add(sign);

  APP.world.add(g);
  return g;
}

COURTYARDS.forEach((c, i) => buildCourtyardGate(c, i));
