/* =========================================================================
   04 · 中央观星台：层叠石台、四向踏步、铜金环形观星装置
   装置由基座、支架、子午环、赤道环、黄道环与窥管组成，
   只做有轴心关系的缓慢旋转。
   ========================================================================= */

const observatory = new THREE.Group();
observatory.name = 'observatory';
APP.world.add(observatory);

/* ------------------------------ 石台各层 -------------------------------- */
function buildTiers() {
  const g = new THREE.Group();
  const rnd = rngFor(1101);

  PLATFORM.tiers.forEach((tier, i) => {
    const yBottom = i === 0 ? PLATFORM_BASE_Y : TIER_TOPS[i - 1];
    const h = tier.h;

    // 台身：八边形，轻微收分
    const bodyGeo = new THREE.CylinderGeometry(tier.r - 0.12, tier.r + 0.10, h, 8, 1, false);
    bodyGeo.rotateY(Math.PI / 8);
    const bp = bodyGeo.attributes.position;
    for (let v = 0; v < bp.count; v++) {
      const px = bp.getX(v), py = bp.getY(v), pz = bp.getZ(v);
      const n = (vnoise(px * 0.9 + i * 3.1, pz * 0.9 - i * 1.7) - 0.5) * 0.09;
      bp.setX(v, px * (1 + n));
      bp.setZ(v, pz * (1 + n));
      bp.setY(v, py + (vnoise(px * 2.0, pz * 2.0) - 0.5) * 0.025);
    }
    bodyGeo.computeVertexNormals();
    addColorAttribute(bodyGeo, 0xb0a894, 0.045, 1102 + i);
    const body = new THREE.Mesh(bodyGeo, MAT.stone);
    body.position.y = yBottom + h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);

    // 台面压边
    const capGeo = new THREE.CylinderGeometry(tier.r + 0.16, tier.r + 0.16, 0.17, 8);
    capGeo.rotateY(Math.PI / 8);
    addColorAttribute(capGeo, 0xb9b19d, 0.04, 1120 + i);
    const cap = new THREE.Mesh(capGeo, MAT.stone);
    cap.position.y = yBottom + h - 0.02;
    cap.castShadow = true;
    cap.receiveShadow = true;
    g.add(cap);

    // 台面铺地：轻微色差的内圈
    const topGeo = new THREE.CylinderGeometry(tier.r - 0.35, tier.r - 0.35, 0.08, 8);
    topGeo.rotateY(Math.PI / 8);
    addColorAttribute(topGeo, 0xa8a08c, 0.05, 1140 + i);
    const top = new THREE.Mesh(topGeo, MAT.stone);
    top.position.y = yBottom + h + 0.045;
    top.receiveShadow = true;
    g.add(top);

    // 台壁横向石缝（少量）
    const seamGeo = new THREE.BoxGeometry(0.03, 0.02, 0.02);
    // 用细环代替，控制数量
    const ringGeo = new THREE.TorusGeometry(tier.r + 0.115, 0.022, 3, 8);
    ringGeo.rotateX(Math.PI / 2);
    addColorAttribute(ringGeo, 0x8a8271, 0.03, 1160 + i);
    for (let k = 0; k < 2; k++) {
      const seam = new THREE.Mesh(ringGeo, MAT.stone);
      seam.position.y = yBottom + h * (0.36 + k * 0.3);
      seam.rotation.y = Math.PI / 8;
      g.add(seam);
    }
  });

  observatory.add(g);
  return g;
}

/* ------------------------------ 四向踏步 -------------------------------- */
function buildTierStairs() {
  const g = new THREE.Group();
  const stepGeo = new THREE.BoxGeometry(1, 1, 1);
  const rnd = rngFor(1201);
  const angles = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

  PLATFORM.tiers.forEach((tier, ti) => {
    const yTop = TIER_TOPS[ti];
    const yBottom = ti === 0 ? PLATFORM_BASE_Y : TIER_TOPS[ti - 1];
    const steps = 5;
    const rise = (yTop - yBottom) / steps;
    const run = 0.44;
    for (const a of angles) {
      const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const startR = tier.r + 0.32;
      for (let s = 0; s < steps; s++) {
        const w = 2.9;
        const m = new THREE.Mesh(stepGeo, MAT.stone);
        const r = startR + (steps - 1 - s) * run;
        m.position.set(dir.x * r, yBottom + rise * (s + 0.5) + 0.03, dir.z * r);
        m.scale.set(w, rise + 0.06, run + 0.06);
        m.rotation.y = -a;
        m.castShadow = true;
        m.receiveShadow = true;
        g.add(m);
      }
      // 两侧垂带
      for (const side of [-1, 1]) {
        const sideGeo = new THREE.BoxGeometry(0.26, (yTop - yBottom) + 0.35, steps * run + 0.4);
        addColorAttribute(sideGeo, 0x9e9684, 0.04, 1210 + ti + Math.round(a * 10));
        const sm = new THREE.Mesh(sideGeo, MAT.stone);
        const midR = startR + (steps - 1) * run * 0.5;
        const tangent = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
        sm.position.set(
          dir.x * midR + tangent.x * side * 1.62,
          yBottom + (yTop - yBottom) / 2 + 0.02,
          dir.z * midR + tangent.z * side * 1.62
        );
        sm.rotation.y = -a;
        sm.castShadow = true;
        sm.receiveShadow = true;
        g.add(sm);
      }
    }
  });

  observatory.add(g);
  return g;
}

/* --------------------------- 台面青铜嵌环 -------------------------------- */
function buildFloorInlay() {
  const g = new THREE.Group();
  const y = PLATFORM_TOP_Y + 0.10;

  const ringGeo = new THREE.TorusGeometry(5.1, 0.05, 5, 96);
  ringGeo.rotateX(Math.PI / 2);
  addColorAttribute(ringGeo, 0xb08a4e, 0.05, 1301);
  const ring = new THREE.Mesh(ringGeo, MAT.bronze);
  ring.position.y = y;
  ring.castShadow = true;
  g.add(ring);

  const innerGeo = new THREE.TorusGeometry(3.75, 0.04, 4, 72);
  innerGeo.rotateX(Math.PI / 2);
  addColorAttribute(innerGeo, 0x8f8776, 0.03, 1302);
  const inner = new THREE.Mesh(innerGeo, MAT.stone);
  inner.position.y = y;
  g.add(inner);

  // 八方位短刻线（不使用 28 等分）
  const tickGeo = new THREE.BoxGeometry(0.06, 0.02, 0.62);
  addColorAttribute(tickGeo, 0xc09a58, 0.04, 1303);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const t = new THREE.Mesh(tickGeo, MAT.bronze);
    t.position.set(Math.cos(a) * 4.5, y + 0.02, Math.sin(a) * 4.5);
    t.rotation.y = -a;
    g.add(t);
  }

  observatory.add(g);
  return g;
}

/* --------------------------- 四向铜字小碑 -------------------------------- */
function makeGlyphTexture(char, color = '#e6c584') {
  const S = 256;
  const c = makeCanvas(S);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, S, S);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 132px ${CJK_SERIF}`;
  ctx.fillStyle = color;
  ctx.shadowColor = 'rgba(255,200,120,.5)';
  ctx.shadowBlur = 14;
  ctx.fillText(char, S / 2, S / 2 + 4);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(214,180,120,.55)';
  ctx.lineWidth = 3;
  ctx.strokeRect(34, 34, S - 68, S - 68);
  return c;
}

function buildDirectionPlaques() {
  const g = new THREE.Group();
  const labels = [
    { ch: '东', a: 0, sub: '青龙' },
    { ch: '南', a: Math.PI / 2, sub: '朱雀' },
    { ch: '西', a: Math.PI, sub: '白虎' },
    { ch: '北', a: -Math.PI / 2, sub: '玄武' }
  ];
  for (const l of labels) {
    const tex = canvasTexture(makeGlyphTexture(l.ch), { repeat: 1 });
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      transparent: true,
      roughness: 0.42,
      metalness: 0.55,
      emissive: new THREE.Color(0xffc98a),
      emissiveMap: tex,
      emissiveIntensity: 0.0,
      depthWrite: false
    });
    APP.emissiveMats.push({ mat, day: 0.0, night: 1.15 });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), mat);
    const r = PLATFORM.tiers[1].r + 0.62;
    plane.position.set(Math.cos(l.a) * r, TIER_TOPS[1] + 0.36, Math.sin(l.a) * r);
    plane.rotation.y = -l.a + Math.PI / 2;
    g.add(plane);

    const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.22), MAT.bronze);
    base.position.set(Math.cos(l.a) * r, TIER_TOPS[1] + 0.12, Math.sin(l.a) * r);
    base.rotation.y = -l.a;
    base.castShadow = true;
    g.add(base);
  }
  observatory.add(g);
  return g;
}

/* --------------------------- 观星装置：支架 --------------------------------- */
function buildInstrumentBase() {
  const g = new THREE.Group();
  const y = PLATFORM_TOP_Y + 0.12;

  const plinthGeo = new THREE.CylinderGeometry(2.9, 3.15, 0.36, 32);
  addColorAttribute(plinthGeo, 0x8d6c3e, 0.06, 1401);
  const plinth = new THREE.Mesh(plinthGeo, MAT.bronze);
  plinth.position.y = y + 0.18;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  g.add(plinth);

  const ribGeo = new THREE.BoxGeometry(2.0, 0.08, 0.12);
  addColorAttribute(ribGeo, 0xb08b50, 0.04, 1402);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    const rib = new THREE.Mesh(ribGeo, MAT.bronze);
    rib.position.set(Math.cos(a) * 2.0, y + 0.37, Math.sin(a) * 2.0);
    rib.rotation.y = -a;
    rib.castShadow = true;
    g.add(rib);
  }

  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i / 4) * TAU;
    const foot = new THREE.Group();
    const legGeo = new THREE.CylinderGeometry(0.12, 0.19, 1.0, 8);
    addColorAttribute(legGeo, 0x9c7a46, 0.05, 1410 + i);
    const leg = new THREE.Mesh(legGeo, MAT.bronze);
    leg.position.y = 0.5;
    leg.castShadow = true;
    foot.add(leg);
    const scroll = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.08, 6, 16, Math.PI * 1.35), MAT.bronze);
    scroll.position.set(0, 0.14, 0.28);
    scroll.rotation.set(Math.PI / 2, 0, 0.6);
    scroll.castShadow = true;
    foot.add(scroll);
    foot.position.set(Math.cos(a) * 1.95, y + 0.34, Math.sin(a) * 1.95);
    foot.rotation.y = -a;
    g.add(foot);
  }

  const hubGeo = new THREE.CylinderGeometry(0.5, 0.65, 0.65, 16);
  addColorAttribute(hubGeo, 0xb28c50, 0.04, 1420);
  const hub = new THREE.Mesh(hubGeo, MAT.bronze);
  hub.position.y = y + 0.7;
  hub.castShadow = true;
  g.add(hub);

  observatory.add(g);
  return g;
}

/* --------------------------- 观星装置：铜环 --------------------------------- */
function makeRing(radius, tube, color, seed, segments = 128, arc = TAU) {
  const geo = new THREE.TorusGeometry(radius, tube, 8, segments, arc);
  addColorAttribute(geo, color, 0.05, seed);
  const mesh = new THREE.Mesh(geo, MAT.bronze);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** 在圆环上按角度放置刻度块（共享几何体，合并为一个 mesh）。 */
function addGraduations(parent, radius, tube, count, seed, { major = 4, size = 0.055 } = {}) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU;
    const isMajor = i % major === 0;
    const len = isMajor ? size * 2.6 : size * 1.35;
    const geo = new THREE.BoxGeometry(len, size * 0.9, size * 1.1);
    geo.rotateY(0);
    geo.translate(0, 0, 0);
    const m = new THREE.Matrix4();
    m.makeRotationY(-a);
    geo.applyMatrix4(m);
    geo.translate(Math.cos(a) * radius, Math.sin(a) * radius, tube * 0.55);
    // 刻度位于环的局部 XY 平面，环本身绕 X 旋转后成为水平/竖直
    addColorAttribute(geo, isMajor ? 0xd8b878 : 0xbb9458, 0.04, seed + i);
    parts.push(geo);
  }
  const merged = mergeGeometries(parts, false);
  const mesh = new THREE.Mesh(merged, MAT.bronze);
  mesh.castShadow = false;
  parent.add(mesh);
  return mesh;
}

function buildArmillary() {
  const y = PLATFORM_TOP_Y + 0.72;
  const root = new THREE.Group();
  root.position.y = y;

  // 固定外框：倾斜的子午环（含极轴方向）
  const frame = new THREE.Group();
  frame.rotation.x = -0.62;
  root.add(frame);

  const meridian = makeRing(3.55, 0.095, 0xa9824a, 1501, 160);
  meridian.rotation.y = Math.PI / 2;
  frame.add(meridian);

  const band = makeRing(3.55, 0.042, 0xc09a5c, 1502, 160);
  band.rotation.y = Math.PI / 2;
  band.position.z = 0.065;
  frame.add(band);

  const horizon = makeRing(3.8, 0.07, 0xa07a44, 1503, 160);
  horizon.rotation.x = Math.PI / 2;
  frame.add(horizon);

  const axisGeo = new THREE.CylinderGeometry(0.065, 0.065, 7.9, 10);
  addColorAttribute(axisGeo, 0xc8a468, 0.04, 1504);
  const axis = new THREE.Mesh(axisGeo, MAT.gold);
  axis.castShadow = true;
  frame.add(axis);

  const finialGeo = new THREE.SphereGeometry(0.19, 14, 10);
  addColorAttribute(finialGeo, 0xd8b878, 0.03, 1505);
  const finialTop = new THREE.Mesh(finialGeo, MAT.gold);
  finialTop.position.y = 3.95;
  const finialBottom = new THREE.Mesh(finialGeo, MAT.gold);
  finialBottom.position.y = -3.95;
  finialBottom.scale.setScalar(0.8);
  frame.add(finialTop, finialBottom);

  const pinGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.65, 8);
  pinGeo.rotateZ(Math.PI / 2);
  addColorAttribute(pinGeo, 0xb89050, 0.03, 1506);
  for (const sy of [-1, 1]) {
    const pin = new THREE.Mesh(pinGeo, MAT.bronze);
    pin.position.set(0, sy * 3.55, 0);
    frame.add(pin);
  }

  // 赤道环：绕极轴缓慢旋转
  const equatorPivot = new THREE.Group();
  frame.add(equatorPivot);
  const equator = makeRing(3.08, 0.085, 0xb28c52, 1511, 140);
  equator.rotation.x = Math.PI / 2;
  equatorPivot.add(equator);
  addGraduations(equatorPivot, 3.08, 0.085, 72, 1512, { major: 6, size: 0.055 });

  // 黄道环：与赤道环成约 23.5°
  const eclipticPivot = new THREE.Group();
  eclipticPivot.rotation.x = THREE.MathUtils.degToRad(23.5);
  equatorPivot.add(eclipticPivot);
  const ecliptic = makeRing(2.62, 0.065, 0xc29a5a, 1521, 128);
  ecliptic.rotation.x = Math.PI / 2;
  eclipticPivot.add(ecliptic);
  addGraduations(eclipticPivot, 2.62, 0.065, 48, 1522, { major: 4, size: 0.046 });

  // 窥管
  const sightPivot = new THREE.Group();
  eclipticPivot.add(sightPivot);
  const sightRing = makeRing(1.86, 0.05, 0xc8a060, 1531, 96);
  sightRing.rotation.x = Math.PI / 2;
  sightPivot.add(sightRing);

  const tubeGeo = new THREE.CylinderGeometry(0.09, 0.09, 3.05, 10);
  addColorAttribute(tubeGeo, 0x9a7a48, 0.05, 1532);
  const tube = new THREE.Mesh(tubeGeo, MAT.bronze);
  tube.rotation.z = Math.PI / 2;
  tube.castShadow = true;
  sightPivot.add(tube);

  const tubeEndGeo = new THREE.TorusGeometry(0.16, 0.04, 6, 14);
  addColorAttribute(tubeEndGeo, 0xd0a868, 0.03, 1533);
  for (const sx of [-1, 1]) {
    const end = new THREE.Mesh(tubeEndGeo, MAT.gold);
    end.position.x = sx * 1.5;
    end.rotation.y = Math.PI / 2;
    sightPivot.add(end);
  }

  const coreGeo = new THREE.SphereGeometry(0.26, 16, 12);
  addColorAttribute(coreGeo, 0xd8b070, 0.03, 1534);
  const core = new THREE.Mesh(coreGeo, MAT.gold);
  sightPivot.add(core);

  // 环间支撑
  const strutGeo = new THREE.CylinderGeometry(0.032, 0.032, 2.85, 6);
  addColorAttribute(strutGeo, 0xb08c52, 0.03, 1541);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    const strut = new THREE.Mesh(strutGeo, MAT.bronze);
    strut.position.set(Math.cos(a) * 1.42, 0, Math.sin(a) * 1.42);
    strut.rotation.z = Math.cos(a) * 0.5;
    strut.rotation.x = Math.sin(a) * 0.5;
    equatorPivot.add(strut);
  }

  // 夜间少量低亮度星光：沿环分布
  const starPositions = [];
  const rnd = rngFor(1551);
  for (let i = 0; i < 34; i++) {
    const a = rnd() * TAU;
    const which = i % 3;
    const r = which === 0 ? 3.55 : which === 1 ? 3.08 : 2.62;
    starPositions.push(Math.cos(a) * r, Math.sin(a) * r, (rnd() - 0.5) * 0.4);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xffd9a0,
    size: 0.09,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    map: TEX.glowWarm,
    sizeAttenuation: true
  });
  const starPoints = new THREE.Points(starGeo, starMat);
  frame.add(starPoints);
  APP.instrumentStars = starMat;

  // 火盆放在台面南侧
  const brazier = makeBrazier(1.05);
  brazier.position.set(0, PLATFORM_TOP_Y + 0.12, 5.9);
  observatory.add(brazier);

  root.add(frame);
  observatory.add(root);

  APP.armillary = { root, frame, meridian, equatorPivot, eclipticPivot, sightPivot, starMat };
  return root;
}

/* ------------------------------- 铜火盆 --------------------------------- */
function makeBrazier(scale = 1) {
  const g = new THREE.Group();
  const bowlGeo = new THREE.CylinderGeometry(0.52, 0.34, 0.38, 16, 1, true);
  addColorAttribute(bowlGeo, 0x8a663a, 0.06, 1601);
  const bowl = new THREE.Mesh(bowlGeo, MAT.bronze);
  bowl.position.y = 0.9;
  bowl.castShadow = true;
  g.add(bowl);

  const rimGeo = new THREE.TorusGeometry(0.53, 0.045, 6, 24);
  rimGeo.rotateX(Math.PI / 2);
  addColorAttribute(rimGeo, 0xc09a58, 0.04, 1602);
  const rim = new THREE.Mesh(rimGeo, MAT.gold);
  rim.position.y = 1.09;
  g.add(rim);

  const legGeo = new THREE.CylinderGeometry(0.055, 0.075, 0.78, 6);
  addColorAttribute(legGeo, 0x9a7644, 0.05, 1603);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    const leg = new THREE.Mesh(legGeo, MAT.bronze);
    leg.position.set(Math.cos(a) * 0.3, 0.39, Math.sin(a) * 0.3);
    leg.rotation.z = Math.cos(a) * 0.16;
    leg.rotation.x = -Math.sin(a) * 0.16;
    leg.castShadow = true;
    g.add(leg);
  }

  const emberMat = new THREE.MeshBasicMaterial({
    color: 0xffb266,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const embers = new THREE.Mesh(new THREE.CircleGeometry(0.44, 16), emberMat);
  embers.rotation.x = -Math.PI / 2;
  embers.position.y = 1.02;
  g.add(embers);

  const spriteMat = new THREE.SpriteMaterial({
    map: TEX.glowWarm,
    color: 0xffb974,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: true
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.position.y = 1.2;
  sprite.scale.set(3.0, 3.0, 1);
  g.add(sprite);

  APP.lanternMats.push({ flameMat: emberMat, spriteMat, base: 0 });
  g.scale.setScalar(scale);
  g.userData.isBrazier = true;
  return g;
}

/* ------------------------------- 组装 ---------------------------------- */
buildTiers();
buildTierStairs();
buildFloorInlay();
buildDirectionPlaques();
buildInstrumentBase();
buildArmillary();
