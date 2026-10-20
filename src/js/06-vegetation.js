/* =========================================================================
   06 · 植被：古松、竹林、灌木与岛缘垂枝
   树干为合并几何体；松针/竹叶为实例化面片，顶点着色器做轻微风摆。
   ========================================================================= */

/* ------------------------------ 风摆补丁 -------------------------------- */
function withWind(material, { amplitude = 0.10, speed = 0.55, frequency = 0.42 } = {}) {
  const uniforms = {
    uTime: { value: 0 },
    uWindAmp: { value: amplitude },
    uWindSpeed: { value: speed },
    uWindFreq: { value: frequency }
  };
  material.userData.windUniforms = uniforms;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWindAmp = uniforms.uWindAmp;
    shader.uniforms.uWindSpeed = uniforms.uWindSpeed;
    shader.uniforms.uWindFreq = uniforms.uWindFreq;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uTime;
uniform float uWindAmp;
uniform float uWindSpeed;
uniform float uWindFreq;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
{
  vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz;
  #ifdef USE_INSTANCING
    wp = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
  #endif
  float h = clamp(position.y, 0.0, 3.0);
  float phase = wp.x * uWindFreq + wp.z * uWindFreq * 0.83 + uTime * uWindSpeed;
  float sway = sin(phase) * 0.65 + sin(phase * 2.17 + 1.3) * 0.35;
  transformed.x += sway * uWindAmp * h * 0.55;
  transformed.z += sway * uWindAmp * h * 0.28;
}`);
  };
  material.customProgramCacheKey = () => 'st-wind-' + amplitude + '-' + speed;
  APP.windUniforms.push(uniforms);
  return material;
}

MAT.foliage = withWind(MAT.foliage, { amplitude: 0.085, speed: 0.42, frequency: 0.36 });
MAT.leafCard = withWind(MAT.leafCard, { amplitude: 0.13, speed: 0.52, frequency: 0.44 });
MAT.leafPine = withWind(MAT.leafPine, { amplitude: 0.055, speed: 0.34, frequency: 0.30 });
MAT.foliageSoft = withWind(MAT.foliageSoft, { amplitude: 0.09, speed: 0.4, frequency: 0.33 });

/* ------------------------------ 松针簇 ---------------------------------- */
function makePineNeedleCluster(seed) {
  // 3 个交叉面片 + 中心一簇，形成有体积的针叶团
  const parts = [];
  const rnd = rngFor(seed);
  for (let i = 0; i < 3; i++) {
    const geo = new THREE.PlaneGeometry(1.5, 1.1, 1, 1);
    geo.rotateY((i / 3) * Math.PI);
    geo.translate(0, 0.1, 0);
    parts.push(geo);
  }
  const merged = mergeGeometries(parts, false);
  const pos = merged.attributes.position;
  const uv = merged.attributes.uv;
  // 让贴图在面片上重复一次，并加轻微弯曲
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    pos.setY(i, y + Math.sin(x * 2.0) * 0.05);
    pos.setZ(i, z + Math.cos(x * 1.7) * 0.04);
  }
  merged.computeVertexNormals();
  addColorAttribute(merged, 0xffffff, 0.02, seed);
  return merged;
}

/* ------------------------------ 古松 ----------------------------------- */
function makePineTree({ seed = 1, height = 5.4, scale = 1, simple = false, lean = 0.2 } = {}) {
  const g = new THREE.Group();
  const rnd = rngFor(seed);
  const trunkParts = [];

  // 主干：带方向与弯折
  const segs = 6;
  const trunkR = 0.24 * scale;
  let px = 0, pz = 0;
  let angle = rnd() * TAU;
  const leanDir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
  let prev = new THREE.Vector3(0, 0, 0);

  for (let i = 0; i < segs; i++) {
    const t0 = i / segs, t1 = (i + 1) / segs;
    const r0 = trunkR * (1 - t0 * 0.72);
    const r1 = trunkR * (1 - t1 * 0.78);
    const bend = Math.sin(t0 * Math.PI * 1.1) * lean * height * 0.22;
    const x = leanDir.x * bend + (rnd() - 0.5) * 0.18;
    const z = leanDir.z * bend + (rnd() - 0.5) * 0.18;
    const y = height * t1;
    const dir = new THREE.Vector3(x - prev.x, y - prev.y, z - prev.z);
    const len = dir.length();
    const geo = new THREE.CylinderGeometry(r1, r0, len, 7, 1);
    addColorAttribute(geo, 0x584636, 0.07, seed + i);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    geo.applyQuaternion(q);
    geo.translate((prev.x + x) / 2, (prev.y + y) / 2, (prev.z + z) / 2);
    trunkParts.push(geo);
    prev.set(x, y, z);
  }

  // 分枝：从主干不同高度斜向伸出
  const branchTips = [];
  const branches = simple ? 3 : 6;
  for (let i = 0; i < branches; i++) {
    const t = 0.36 + (i / branches) * 0.58;
    const by = height * t;
    const ba = angle + i * 2.15 + (rnd() - 0.5) * 0.8;
    const blen = height * (0.30 - t * 0.10) * (0.8 + rnd() * 0.5);
    const bdir = new THREE.Vector3(Math.cos(ba), 0.18 + rnd() * 0.3, Math.sin(ba)).normalize();
    const start = new THREE.Vector3(
      leanDir.x * Math.sin(t * Math.PI * 1.1) * lean * height * 0.22,
      by,
      leanDir.z * Math.sin(t * Math.PI * 1.1) * lean * height * 0.22
    );
    const end = start.clone().add(bdir.clone().multiplyScalar(blen));
    const geo = new THREE.CylinderGeometry(trunkR * 0.18, trunkR * 0.4, blen, 5, 1);
    addColorAttribute(geo, 0x5c4a38, 0.06, seed + 20 + i);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), bdir);
    geo.applyQuaternion(q);
    geo.translate((start.x + end.x) / 2, (start.y + end.y) / 2, (start.z + end.z) / 2);
    trunkParts.push(geo);
    branchTips.push(end);
  }

  const trunkGeo = mergeGeometries(trunkParts, false);
  const trunk = new THREE.Mesh(trunkGeo, MAT.wood);
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  g.add(trunk);

  // 针叶层：每层由若干实例化簇构成，整体呈不规则伞状
  const layers = simple ? 2 : 4;
  const clusterGeo = makePineNeedleCluster(seed + 50);
  const clusterMat = MAT.leafPine;
  const instances = [];
  const dummy = new THREE.Object3D();

  for (let l = 0; l < layers; l++) {
    const lt = l / (layers - 1 || 1);
    const y = height * (0.48 + lt * 0.46);
    const spread = height * (0.30 - lt * 0.13) * (0.9 + rnd() * 0.35);
    const count = simple ? 3 : 5 + Math.floor(rnd() * 3);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + rnd() * 0.8 + l;
      const rr = spread * (0.35 + rnd() * 0.75);
      const x = Math.cos(a) * rr + leanDir.x * Math.sin(lt * Math.PI) * lean * height * 0.18;
      const z = Math.sin(a) * rr + leanDir.z * Math.sin(lt * Math.PI) * lean * height * 0.18;
      dummy.position.set(x, y + (rnd() - 0.5) * height * 0.06, z);
      dummy.rotation.set((rnd() - 0.5) * 0.35, rnd() * TAU, (rnd() - 0.5) * 0.3);
      const s = height * (0.20 + rnd() * 0.13) / 1.4;
      dummy.scale.set(s, s * (0.75 + rnd() * 0.3), s);
      dummy.updateMatrix();
      instances.push(dummy.matrix.clone());
    }
  }
  // 顶冠
  dummy.position.set(
    leanDir.x * lean * height * 0.24,
    height * 0.99,
    leanDir.z * lean * height * 0.24
  );
  dummy.rotation.set(0, rnd() * TAU, 0);
  dummy.scale.setScalar(height * 0.14 / 1.4);
  dummy.updateMatrix();
  instances.push(dummy.matrix.clone());

  const inst = new THREE.InstancedMesh(clusterGeo, clusterMat, instances.length);
  const col = new THREE.Color();
  const colors = new Float32Array(instances.length * 3);
  for (let i = 0; i < instances.length; i++) {
    inst.setMatrixAt(i, instances[i]);
    col.setHex(0x4e6348).offsetHSL((rnd() - 0.5) * 0.03, (rnd() - 0.5) * 0.12, (rnd() - 0.5) * 0.12);
    colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
  }
  inst.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
  inst.castShadow = true;
  inst.receiveShadow = true;
  g.add(inst);

  g.scale.setScalar(scale);
  return g;
}

/* ------------------------------ 竹 ------------------------------------- */
function makeBambooCluster({ seed = 1, count = 16, radius = 1.8, height = 6.0 } = {}) {
  const g = new THREE.Group();
  const rnd = rngFor(seed);
  const culmParts = [];
  const leafMatrices = [];
  const dummy = new THREE.Object3D();

  for (let i = 0; i < count; i++) {
    const a = rnd() * TAU;
    const rr = Math.sqrt(rnd()) * radius;
    const x = Math.cos(a) * rr;
    const z = Math.sin(a) * rr;
    const h = height * (0.45 + rnd() * 0.75);
    const leanX = (rnd() - 0.5) * 0.18;
    const leanZ = (rnd() - 0.5) * 0.18;
    const r = 0.035 + rnd() * 0.035;

    // 竹节：3-4 段
    const nodeCount = 3;
    for (let n = 0; n < nodeCount; n++) {
      const t0 = n / nodeCount, t1 = (n + 1) / nodeCount;
      const y0 = h * t0, y1 = h * t1;
      const seg = new THREE.CylinderGeometry(r * 0.8, r, y1 - y0, 5, 1);
      const bendX = leanX * (y0 + y1) * 0.5;
      const bendZ = leanZ * (y0 + y1) * 0.5;
      seg.translate(x + bendX, (y0 + y1) / 2, z + bendZ);
      addColorAttribute(seg, 0x6d7b4c, 0.08, seed + i * 7 + n);
      culmParts.push(seg);
    }

    // 叶簇：顶部与中上部
    const leafCount = 5 + Math.floor(rnd() * 4);
    for (let k = 0; k < leafCount; k++) {
      const ly = h * (0.55 + rnd() * 0.44);
      const la = rnd() * TAU;
      const lr = 0.15 + rnd() * 0.55;
      dummy.position.set(x + Math.cos(la) * lr + leanX * ly, ly, z + Math.sin(la) * lr + leanZ * ly);
      dummy.rotation.set((rnd() - 0.5) * 0.9, rnd() * TAU, (rnd() - 0.5) * 0.9);
      const s = 0.55 + rnd() * 0.6;
      dummy.scale.set(s, s * (0.8 + rnd() * 0.4), s);
      dummy.updateMatrix();
      leafMatrices.push(dummy.matrix.clone());
    }
  }

  const culmGeo = mergeGeometries(culmParts, false);
  const culms = new THREE.Mesh(culmGeo, MAT.foliageSoft);
  culms.castShadow = true;
  culms.receiveShadow = true;
  g.add(culms);

  const leafGeo = new THREE.PlaneGeometry(1.0, 1.0);
  // 叶片法线朝向 +Z，实例旋转时保持双面受光
  const leaves = new THREE.InstancedMesh(leafGeo, MAT.leafCard, leafMatrices.length);
  const col = new THREE.Color();
  const colors = new Float32Array(leafMatrices.length * 3);
  for (let i = 0; i < leafMatrices.length; i++) {
    leaves.setMatrixAt(i, leafMatrices[i]);
    col.setHex(0x778a52).offsetHSL((rnd() - 0.5) * 0.04, (rnd() - 0.5) * 0.14, (rnd() - 0.5) * 0.14);
    colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
  }
  leaves.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
  leaves.castShadow = true;
  leaves.receiveShadow = false;
  g.add(leaves);

  return g;
}

/* ------------------------------ 灌木 ----------------------------------- */
function makeShrub({ seed = 1, radius = 0.7, height = 0.75 } = {}) {
  const g = new THREE.Group();
  const rnd = rngFor(seed);
  const parts = [];
  const count = 5 + Math.floor(rnd() * 4);
  for (let i = 0; i < count; i++) {
    const geo = new THREE.IcosahedronGeometry(radius * (0.5 + rnd() * 0.5), 1);
    const pos = geo.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
      const k = 1 + (vnoise(x * 3 + seed, z * 3 + y) - 0.5) * 0.35;
      pos.setXYZ(v, x * k, y * k * 0.8, z * k);
    }
    geo.computeVertexNormals();
    const a = rnd() * TAU;
    const rr = rnd() * radius * 0.55;
    geo.translate(Math.cos(a) * rr, height * (0.35 + rnd() * 0.35), Math.sin(a) * rr);
    addColorAttribute(geo, 0x667a4e, 0.09, seed + i);
    parts.push(geo);
  }
  const merged = mergeGeometries(parts, false);
  const mesh = new THREE.Mesh(merged, MAT.foliage);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  return g;
}

/* ------------------------------ 布置植被 -------------------------------- */
const vegetationGroup = new THREE.Group();
vegetationGroup.name = 'vegetation';
APP.world.add(vegetationGroup);

function isFreeSpot(x, z, clearance = 2.0) {
  // 避开观星台、路径、庭院中心与碑林
  const rr = Math.hypot(x, z);
  if (rr < 13.5) return false;
  for (const c of COURTYARDS) {
    const d = Math.hypot(x - c.center.x, z - c.center.z);
    if (d < 9.0) return false;
  }
  for (const curve of PATH_CURVES) {
    const samples = curve.getSpacedPoints(30);
    for (const p of samples) {
      if (Math.hypot(x - p.x, z - p.z) < clearance) return false;
    }
  }
  return true;
}

(function plantTrees() {
  const rnd = rngFor(2001);
  const pines = [
    // [x, z, height, scale]
    [-18.0, 10.5, 7.2, 1.12],
    [14.5, -17.0, 6.2, 1.0],
    [-27.0, -12.0, 7.8, 1.18],
    [24.0, 14.5, 5.8, 0.95],
    [-9.0, 29.0, 5.2, 0.9],
    [29.0, -10.0, 4.8, 0.85],
    [-33.0, 6.0, 6.0, 1.0],
    [9.0, 33.0, 4.2, 0.78],
    [20.0, 6.0, 4.6, 0.8],
    [-14.0, -26.0, 5.4, 0.92]
  ];
  for (const [x, z, h, s] of pines) {
    if (Math.hypot(x, z) > rimRadius(Math.atan2(z, x)) - 4) continue;
    const tree = makePineTree({ seed: 2100 + Math.round(x * 7 + z * 3), height: h, scale: s, lean: 0.30 });
    tree.position.set(x, terrainHeight(x, z) - 0.05, z);
    tree.rotation.y = rnd() * TAU;
    vegetationGroup.add(tree);
  }

  // 前景取景松：靠近初始镜头，压住画面右下与左上
  const fg = makePineTree({ seed: 2199, height: 9.0, scale: 1.3, lean: 0.46 });
  fg.position.set(34.0, terrainHeight(34.0, 24.0) - 0.1, 24.0);
  fg.rotation.y = 0.7;
  vegetationGroup.add(fg);

  const fg2 = makePineTree({ seed: 2200, height: 7.6, scale: 1.1, lean: 0.38 });
  fg2.position.set(-33.0, terrainHeight(-33.0, 26.0) - 0.1, 26.0);
  fg2.rotation.y = 2.2;
  vegetationGroup.add(fg2);

  const fg3 = makePineTree({ seed: 2201, height: 6.8, scale: 0.95, lean: 0.34 });
  fg3.position.set(18.0, terrainHeight(18.0, 35.0) - 0.1, 35.0);
  fg3.rotation.y = 3.6;
  vegetationGroup.add(fg3);

  // 竹林：四簇，疏密不同
  const bamboos = [
    { x: -19.5, z: -18.0, count: 24, radius: 2.4, height: 7.0, seed: 2301 },
    { x: 18.5, z: 20.0, count: 16, radius: 1.9, height: 5.8, seed: 2302 },
    { x: 27.0, z: -20.0, count: 13, radius: 1.6, height: 5.0, seed: 2303 },
    { x: -28.0, z: 18.5, count: 11, radius: 1.4, height: 4.6, seed: 2304 }
  ];
  for (const b of bamboos) {
    const cl = makeBambooCluster(b);
    cl.position.set(b.x, terrainHeight(b.x, b.z) - 0.05, b.z);
    cl.rotation.y = rnd() * TAU;
    vegetationGroup.add(cl);
  }

  // 灌木
  for (let i = 0; i < 40; i++) {
    const a = rnd() * TAU;
    const rr = 15 + Math.sqrt(rnd()) * 25;
    const x = Math.cos(a) * rr;
    const z = Math.sin(a) * rr;
    if (!isFreeSpot(x, z, 2.4)) continue;
    const shrub = makeShrub({
      seed: 2400 + i,
      radius: 0.55 + rnd() * 0.6,
      height: 0.55 + rnd() * 0.55
    });
    shrub.position.set(x, terrainHeight(x, z) - 0.04, z);
    shrub.rotation.y = rnd() * TAU;
    vegetationGroup.add(shrub);
  }

  // 岛缘垂枝 / 苔草团
  for (let i = 0; i < 30; i++) {
    const a = rnd() * TAU;
    const R = rimRadius(a) - 1.2 - rnd() * 2.2;
    const x = Math.cos(a) * R;
    const z = Math.sin(a) * R;
    const shrub = makeShrub({ seed: 2500 + i, radius: 0.55 + rnd() * 0.7, height: 0.55 });
    shrub.position.set(x, terrainHeight(x, z) - 0.1, z);
    shrub.scale.set(1, 0.7, 1);
    vegetationGroup.add(shrub);
  }
})();

/* 竹叶 / 松针材质的色调随昼夜由灯光自然变化，无需单独处理。 */
