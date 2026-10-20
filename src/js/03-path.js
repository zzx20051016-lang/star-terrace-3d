/* =========================================================================
   03 · 地形配景：蜿蜒石径、石栏、石灯、踏步、碎石与苔草
   ========================================================================= */

/* ------------------------------ 路径样条 -------------------------------- */
function makePathCurve(points, lift = 0.10) {
  const pts = points.map(([x, z]) => {
    const y = terrainHeight(x, z) + lift;
    return new THREE.Vector3(x, y, z);
  });
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.32);
  curve.arcLengthDivisions = 240;
  return curve;
}

/* 四条庭院路径：从中央台基外缘弯向各庭院。 */
const PATH_CURVES = [
  makePathCurve([[14.2, 3.0], [18.4, 6.6], [22.0, 4.9], [23.8, 1.4]]),
  makePathCurve([[-3.0, -14.2], [-6.6, -18.4], [-4.9, -22.0], [-1.4, -23.8]]),
  makePathCurve([[-14.2, -3.0], [-18.4, -6.6], [-22.0, -4.9], [-23.8, -1.4]]),
  makePathCurve([[3.0, 14.2], [6.6, 18.4], [4.9, 22.0], [1.4, 23.8]])
];

/* ------------------------------ 铺路石 ---------------------------------- */
function buildPaths() {
  const rnd = rngFor(501);
  const group = new THREE.Group();
  const parts = [];
  const colors = [];
  const baseColors = [
    new THREE.Color(0xaaa392), new THREE.Color(0x9f9787),
    new THREE.Color(0xb3ab98), new THREE.Color(0x968e7e)
  ];

  for (const curve of PATH_CURVES) {
    const len = curve.getLength();
    const count = Math.max(12, Math.round(len / 1.15));
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(t);
      const w = 2.05 + Math.sin(t * 8.0) * 0.22;
      const geo = new THREE.BoxGeometry(w, 0.20 + rnd() * 0.07, 1.0 + rnd() * 0.22);
      geo.rotateY(Math.atan2(tan.x, tan.z) + (rnd() - 0.5) * 0.10);
      geo.rotateZ((rnd() - 0.5) * 0.02);
      geo.translate(
        p.x + (rnd() - 0.5) * 0.16,
        p.y - 0.04,
        p.z + (rnd() - 0.5) * 0.16
      );
      const col = baseColors[Math.floor(rnd() * baseColors.length)].clone()
        .offsetHSL(0, 0, (rnd() - 0.5) * 0.06);
      addColorAttribute(geo, col.getHex(), 0.04, 510 + i);
      parts.push(geo);
    }
  }

  const merged = mergeGeometries(parts, false);
  const mesh = new THREE.Mesh(merged, MAT.stone);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  group.add(mesh);

  // 路径边缘碎石
  const rockGeo = makeChunkGeometry(881, 0);
  addColorAttribute(rockGeo, 0x9a9284, 0.08, 91);
  const rocks = [];
  for (const curve of PATH_CURVES) {
    const len = curve.getLength();
    const n = Math.round(len * 2.4);
    for (let i = 0; i < n; i++) {
      const t = rnd();
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(t);
      const side = rnd() > 0.5 ? 1 : -1;
      const off = 1.2 + rnd() * 0.8;
      const x = p.x + tan.z * off * side;
      const z = p.z - tan.x * off * side;
      const geo = rockGeo.clone();
      const s = 0.10 + rnd() * 0.22;
      const mtx = new THREE.Matrix4();
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * TAU, rnd() * TAU, rnd() * TAU));
      mtx.compose(
        new THREE.Vector3(x, terrainHeight(x, z) + s * 0.3, z),
        q,
        new THREE.Vector3(s, s, s)
      );
      geo.applyMatrix4(mtx);
      rocks.push(geo);
    }
  }
  const rockMerged = mergeGeometries(rocks, false);
  const rockMesh = new THREE.Mesh(rockMerged, MAT.rock);
  rockMesh.receiveShadow = true;
  group.add(rockMesh);

  APP.world.add(group);
  return group;
}

/* ------------------------------ 石栏 ----------------------------------- */
function buildBalustrade() {
  const group = new THREE.Group();
  const postGeo = new THREE.BoxGeometry(0.30, 1.05, 0.30);
  addColorAttribute(postGeo, 0xa8a08e, 0.05, 601);
  const capGeo = new THREE.BoxGeometry(0.40, 0.13, 0.40);
  addColorAttribute(capGeo, 0x9d9584, 0.05, 602);
  const railGeo = new THREE.BoxGeometry(1, 0.17, 0.22);
  addColorAttribute(railGeo, 0xaba392, 0.05, 603);
  const rnd = rngFor(604);

  // 1) 观星台顶层栏板：四个开口对准踏步
  const ringR = PLATFORM.tiers[2].r + 0.58;
  const openings = [0.0, Math.PI / 2, Math.PI, -Math.PI / 2];
  const N = 60;
  let prev = null;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    const blocked = openings.some((o) => Math.abs(Math.atan2(Math.sin(a - o), Math.cos(a - o))) < 0.22);
    if (blocked) { prev = null; continue; }
    const x = Math.cos(a) * ringR;
    const z = Math.sin(a) * ringR;
    const y = PLATFORM_TOP_Y + 0.12;
    if (i % 2 === 0) {
      const post = new THREE.Mesh(postGeo, MAT.stone);
      post.position.set(x, y + 0.5, z);
      post.rotation.y = -a;
      post.castShadow = true;
      post.receiveShadow = true;
      group.add(post);
      const cap = new THREE.Mesh(capGeo, MAT.stone);
      cap.position.set(x, y + 1.06, z);
      cap.rotation.y = -a;
      cap.castShadow = true;
      group.add(cap);
    }
    if (prev) {
      const mid = new THREE.Vector3((x + prev.x) / 2, y + 0.78, (z + prev.z) / 2);
      const dx = x - prev.x, dz = z - prev.z;
      const rail = new THREE.Mesh(railGeo, MAT.stone);
      rail.position.copy(mid);
      rail.scale.x = Math.hypot(dx, dz) * 0.94;
      rail.rotation.y = Math.atan2(dx, dz);
      rail.castShadow = true;
      group.add(rail);
    }
    prev = { x, z };
  }

  // 2) 岛缘残破石栏：只保留两段，制造取景与断壁感
  const rimRuns = [
    { from: 0.14, to: 0.66, radiusInset: 2.6, brokenAt: 0.42 },
    { from: 3.30, to: 3.84, radiusInset: 2.8, brokenAt: 0.60 }
  ];
  for (const run of rimRuns) {
    const steps = 18;
    let prevP = null;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = lerp(run.from, run.to, t);
      const R = rimRadius(a) - run.radiusInset;
      const x = Math.cos(a) * R;
      const z = Math.sin(a) * R;
      const y = terrainHeight(x, z);
      const broken = Math.abs(t - run.brokenAt) < 0.08;
      if (broken) { prevP = null; continue; }
      const tilt = (rnd() - 0.5) * 0.10 + (t > 0.78 ? (t - 0.78) * 0.8 : 0);
      if (i % 2 === 0) {
        const post = new THREE.Mesh(postGeo, MAT.stone);
        post.position.set(x, y + 0.48, z);
        post.rotation.y = -a + (rnd() - 0.5) * 0.2;
        post.rotation.z = tilt;
        post.castShadow = true;
        post.receiveShadow = true;
        group.add(post);
        const cap = new THREE.Mesh(capGeo, MAT.stone);
        cap.position.set(x, y + 1.02, z);
        cap.rotation.z = tilt;
        group.add(cap);
      }
      if (prevP) {
        const dx = x - prevP.x, dz = z - prevP.z;
        const rail = new THREE.Mesh(railGeo, MAT.stone);
        rail.position.set((x + prevP.x) / 2, y + 0.72 + tilt * 0.4, (z + prevP.z) / 2);
        rail.scale.x = Math.hypot(dx, dz) * 0.9;
        rail.rotation.y = Math.atan2(dx, dz);
        rail.rotation.z = tilt;
        rail.castShadow = true;
        group.add(rail);
      }
      prevP = { x, z };
    }
  }

  APP.world.add(group);
  return group;
}

/* ------------------------------ 石灯 ----------------------------------- */
function makeStoneLantern(scale = 1, glowColor = 0xffc27a) {
  const g = new THREE.Group();
  const baseGeo = new THREE.CylinderGeometry(0.42, 0.52, 0.24, 8);
  addColorAttribute(baseGeo, 0x9d9686, 0.05, 701);
  const shaftGeo = new THREE.CylinderGeometry(0.15, 0.19, 0.92, 8);
  addColorAttribute(shaftGeo, 0xa39c8c, 0.05, 702);
  const plateGeo = new THREE.CylinderGeometry(0.36, 0.28, 0.14, 8);
  addColorAttribute(plateGeo, 0xa8a190, 0.05, 703);
  const houseGeo = new THREE.BoxGeometry(0.52, 0.52, 0.52);
  addColorAttribute(houseGeo, 0x8f887a, 0.05, 704);
  const roofGeo = new THREE.ConeGeometry(0.58, 0.34, 4);
  addColorAttribute(roofGeo, 0x77736a, 0.05, 705);

  const base = new THREE.Mesh(baseGeo, MAT.stone);
  base.position.y = 0.12;
  base.castShadow = true;
  const shaft = new THREE.Mesh(shaftGeo, MAT.stone);
  shaft.position.y = 0.70;
  shaft.castShadow = true;
  const plate = new THREE.Mesh(plateGeo, MAT.stone);
  plate.position.y = 1.22;
  plate.castShadow = true;
  const house = new THREE.Mesh(houseGeo, MAT.stone);
  house.position.y = 1.55;
  house.castShadow = true;
  const roof = new THREE.Mesh(roofGeo, MAT.stone);
  roof.position.y = 1.94;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  g.add(base, shaft, plate, house, roof);

  const flameMat = new THREE.MeshBasicMaterial({
    color: glowColor,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), flameMat);
  flame.position.y = 1.55;
  g.add(flame);

  const spriteMat = new THREE.SpriteMaterial({
    map: TEX.glowWarm,
    color: glowColor,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: true
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(1.9, 1.9, 1);
  sprite.position.y = 1.56;
  g.add(sprite);

  APP.lanternMats.push({ flameMat, spriteMat, phase: Math.random() * 6.28 });
  g.scale.setScalar(scale);
  return g;
}

function placeLanterns() {
  const group = new THREE.Group();
  const rnd = rngFor(711);
  const spots = [];
  for (const curve of PATH_CURVES) {
    for (const t of [0.18, 0.5, 0.82]) {
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(t);
      const side = (spots.length % 2 === 0 ? 1 : -1);
      const off = 1.6;
      spots.push([p.x + tan.z * off * side, p.z - tan.x * off * side]);
    }
  }
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    spots.push([Math.cos(a) * 14.4, Math.sin(a) * 14.4]);
  }
  for (const [x, z] of spots) {
    const l = makeStoneLantern(0.94 + rnd() * 0.14);
    l.position.set(x, terrainHeight(x, z) - 0.02, z);
    l.rotation.y = rnd() * TAU;
    group.add(l);
  }
  APP.world.add(group);
  return group;
}

/* ------------------------- 庭院踏步与散石 ------------------------------- */
function buildStepsToCourtyard(c, index) {
  const g = new THREE.Group();
  const dir = c.center.clone().normalize();
  const angle = Math.atan2(dir.x, dir.z);
  const start = dir.clone().multiplyScalar(14.6);
  const stepGeo = new THREE.BoxGeometry(3.4, 0.24, 0.78);
  addColorAttribute(stepGeo, 0xaca492, 0.05, 801 + index);
  const baseY = PLATFORM_BASE_Y + 3.84;
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(stepGeo, MAT.stone);
    const p = start.clone().add(dir.clone().multiplyScalar(i * 0.8));
    const y = lerp(baseY, terrainHeight(p.x, p.z) + 0.12, (i + 1) / 6);
    m.position.set(p.x, y, p.z);
    m.rotation.y = angle;
    m.receiveShadow = true;
    m.castShadow = true;
    g.add(m);
  }
  APP.world.add(g);
  return g;
}

/* ------------------------------ 苔草与碎石 ------------------------------ */
function buildGroundDetails() {
  const rnd = rngFor(821);

  const bladeGeo = new THREE.PlaneGeometry(0.75, 0.6, 1, 2);
  const bp = bladeGeo.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const y = bp.getY(i);
    bp.setY(i, y + 0.3);
    bp.setZ(i, Math.sin((y + 0.3) * 2.2) * 0.05);
  }
  bladeGeo.computeVertexNormals();
  addColorAttribute(bladeGeo, 0xffffff, 0.02, 820);

  const COUNT = 1700;
  const inst = new THREE.InstancedMesh(bladeGeo, MAT.leafCard, COUNT);
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  const colors = new Float32Array(COUNT * 3);
  let n = 0;
  let guard = 0;
  while (n < COUNT && guard < COUNT * 10) {
    guard++;
    const theta = rnd() * TAU;
    const rr = 15.5 + Math.pow(rnd(), 0.62) * 29;
    const x = Math.cos(theta) * rr;
    const z = Math.sin(theta) * rr;
    const R = rimRadius(theta);
    if (Math.hypot(x, z) > R - 1.6) continue;
    if (COURTYARDS.some((c) => Math.hypot(x - c.center.x, z - c.center.z) < 5.8)) continue;
    const y = terrainHeight(x, z);
    const s = 0.7 + rnd() * 1.35;
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, rnd() * TAU, 0);
    dummy.scale.set(s, s * (0.8 + rnd() * 0.8), s);
    dummy.updateMatrix();
    inst.setMatrixAt(n, dummy.matrix);
    col.setHex(0x7d8a5c).offsetHSL((rnd() - 0.5) * 0.05, (rnd() - 0.5) * 0.14, (rnd() - 0.5) * 0.16);
    colors[n * 3] = col.r; colors[n * 3 + 1] = col.g; colors[n * 3 + 2] = col.b;
    n++;
  }
  inst.count = n;
  inst.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
  inst.instanceColor.needsUpdate = true;
  inst.receiveShadow = true;
  inst.castShadow = false;
  APP.world.add(inst);
  APP.grass = inst;

  // 灌木状叶团：用实例化的交叉面片补足地表植被，成本低
  const bushGeo = makeChunkGeometry(841, 1);
  addColorAttribute(bushGeo, 0xffffff, 0.02, 842);
  const bushMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.92,
    metalness: 0,
    flatShading: true
  });
  const BUSHES = 190;
  const bushes = new THREE.InstancedMesh(bushGeo, bushMat, BUSHES);
  const bcolors = new Float32Array(BUSHES * 3);
  for (let i = 0; i < BUSHES; i++) {
    let x = 0, z = 0, y = 0, tries = 0;
    do {
      const theta = rnd() * TAU;
      const rr = 14.5 + Math.pow(rnd(), 0.7) * 29;
      x = Math.cos(theta) * rr;
      z = Math.sin(theta) * rr;
      y = terrainHeight(x, z);
      tries++;
    } while ((Math.hypot(x, z) > rimRadius(Math.atan2(z, x)) - 1.8 ||
      COURTYARDS.some((c) => Math.hypot(x - c.center.x, z - c.center.z) < 5.6)) && tries < 40);
    const s = 0.34 + Math.pow(rnd(), 1.6) * 1.1;
    dummy.position.set(x, y + s * 0.42, z);
    dummy.rotation.set(rnd() * 0.3, rnd() * TAU, rnd() * 0.3);
    dummy.scale.set(s * (1 + rnd() * 0.5), s * (0.55 + rnd() * 0.4), s * (1 + rnd() * 0.5));
    dummy.updateMatrix();
    bushes.setMatrixAt(i, dummy.matrix);
    col.setHex(0x5e7148).offsetHSL((rnd() - 0.5) * 0.05, (rnd() - 0.5) * 0.16, (rnd() - 0.5) * 0.14);
    bcolors[i * 3] = col.r; bcolors[i * 3 + 1] = col.g; bcolors[i * 3 + 2] = col.b;
  }
  bushes.instanceColor = new THREE.InstancedBufferAttribute(bcolors, 3);
  bushes.receiveShadow = true;
  bushes.castShadow = true;
  APP.world.add(bushes);

  const rockGeo = makeChunkGeometry(831, 0);
  addColorAttribute(rockGeo, 0x99917f, 0.09, 832);
  const ROCKS = 170;
  const instRock = new THREE.InstancedMesh(rockGeo, MAT.rock, ROCKS);
  const rcol = new Float32Array(ROCKS * 3);
  for (let i = 0; i < ROCKS; i++) {
    const theta = rnd() * TAU;
    const rr = 15.5 + Math.sqrt(rnd()) * 27;
    const x = Math.cos(theta) * rr;
    const z = Math.sin(theta) * rr;
    const y = terrainHeight(x, z);
    const s = 0.16 + Math.pow(rnd(), 2) * 0.9;
    dummy.position.set(x, y + s * 0.22, z);
    dummy.rotation.set(rnd() * TAU, rnd() * TAU, rnd() * TAU);
    dummy.scale.set(s * (0.8 + rnd() * 0.6), s * (0.55 + rnd() * 0.6), s * (0.8 + rnd() * 0.6));
    dummy.updateMatrix();
    instRock.setMatrixAt(i, dummy.matrix);
    col.setHex(0x928a7a).offsetHSL(0, 0, (rnd() - 0.5) * 0.12);
    rcol[i * 3] = col.r; rcol[i * 3 + 1] = col.g; rcol[i * 3 + 2] = col.b;
  }
  instRock.instanceColor = new THREE.InstancedBufferAttribute(rcol, 3);
  instRock.receiveShadow = true;
  instRock.castShadow = true;
  APP.world.add(instRock);
  APP.scatterRocks = instRock;
}

/* ------------------------------- 组装 ---------------------------------- */
buildPaths();
buildBalustrade();
placeLanterns();
COURTYARDS.forEach((c, i) => buildStepsToCourtyard(c, i));
buildGroundDetails();
