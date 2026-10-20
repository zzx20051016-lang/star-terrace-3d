/* =========================================================================
   07 · 水：庭院水渠与静水池、崖边溪流、瀑布水幕、飞沫与底部雾化
   水流全部由 ShaderMaterial 动画；水从池/渠经崖口落下，不从岩壁中间喷出。
   ========================================================================= */

const WATER_Y = 0.46;

/* ------------------------------ 水面着色器 ------------------------------- */
function makeWaterMaterial({ colorDeep = 0x234e52, colorShallow = 0x5b8f8c, opacity = 0.86, flow = 1.0 } = {}) {
  const uniforms = {
    uTime: { value: 0 },
    uDeep: { value: new THREE.Color(colorDeep) },
    uShallow: { value: new THREE.Color(colorShallow) },
    uOpacity: { value: opacity },
    uFlow: { value: flow },
    uNight: { value: 0 },
    uFogColor: { value: new THREE.Color(0xcfd9df) },
    uFogDensity: { value: 0.0034 }
  };
  APP.waterUniforms.push(uniforms);

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      varying vec2 vUv;
      varying vec3 vWorld;
      varying float vFogDepth;
      void main(){
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mv = viewMatrix * wp;
        vFogDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform float uOpacity;
      uniform float uFlow;
      uniform float uNight;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      varying vec2 vUv;
      varying vec3 vWorld;
      varying float vFogDepth;

      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
                   mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
      }
      float fbm(vec2 p){
        float a = 0.5, s = 0.0, n = 0.0;
        for (int i = 0; i < 4; i++){ s += a * noise(p); n += a; p *= 2.03; a *= 0.5; }
        return s / n;
      }
      void main(){
        vec2 p = vWorld.xz;
        float t = uTime * uFlow;
        float n1 = fbm(p * 1.4 + vec2(t * 0.10, t * 0.06));
        float n2 = fbm(p * 3.1 - vec2(t * 0.16, -t * 0.09));
        float ripple = smoothstep(0.52, 0.86, n1 * 0.6 + n2 * 0.4);

        // 边缘变浅，中心偏深
        vec2 c = vUv - 0.5;
        float edge = smoothstep(0.52, 0.16, length(c));
        vec3 col = mix(uDeep, uShallow, edge * 0.65 + ripple * 0.25);
        col = mix(col, vec3(0.86, 0.92, 0.9), ripple * 0.20);
        col *= (1.0 - uNight * 0.38);

        // 薄雾衰减
        float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
        col = mix(col, uFogColor, clamp(fogFactor, 0.0, 1.0));

        float alpha = uOpacity * (0.72 + ripple * 0.24) * (0.55 + edge * 0.5);
        gl_FragColor = vec4(col, alpha);
        #include <colorspace_fragment>
      }
    `
  });
  return mat;
}

/* ------------------------------ 水面片 -------------------------------- */
function makeWaterDisc(radius, y, colorA, colorB, segments = 40, opacity = 0.88) {
  const geo = new THREE.CircleGeometry(radius, segments);
  geo.rotateX(-Math.PI / 2);
  const mat = makeWaterMaterial({ colorDeep: colorA, colorShallow: colorB, opacity, flow: 0.55 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = y;
  mesh.renderOrder = 2;
  return mesh;
}

/* ------------------------------ 弧形水渠 -------------------------------- */
function makeArcCanal(radius, from, to, width, y, colorA, colorB) {
  const segs = 64;
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const a = lerp(from, to, t);
    const inner = radius - width / 2;
    const outer = radius + width / 2;
    positions.push(Math.cos(a) * inner, y, Math.sin(a) * inner);
    positions.push(Math.cos(a) * outer, y, Math.sin(a) * outer);
    uvs.push(t * 5, 0, t * 5, 1);
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    indices.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mat = makeWaterMaterial({ colorDeep: colorA, colorShallow: colorB, opacity: 0.8, flow: 0.9 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 2;
  return mesh;
}

/* ------------------------------ 水渠石沿 -------------------------------- */
function makeCanalBank(radius, from, to, width, seed) {
  const parts = [];
  const segs = 34;
  const rnd = rngFor(seed);
  for (let i = 0; i < segs; i++) {
    const t = (i + 0.5) / segs;
    const a = lerp(from, to, t);
    for (const side of [-1, 1]) {
      const r = radius + side * (width / 2 + 0.16);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const geo = new THREE.BoxGeometry(0.34, 0.22 + rnd() * 0.06, width / segs * 1.6);
      geo.rotateY(-a);
      geo.translate(x, WATER_Y + 0.05, z);
      addColorAttribute(geo, 0x9a9384, 0.05, seed + i);
      parts.push(geo);
    }
  }
  const merged = mergeGeometries(parts, false);
  const mesh = new THREE.Mesh(merged, MAT.stone);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/* ------------------------------ 瀑布 ----------------------------------- */
const waterfallUniforms = [];
function makeWaterfall({ width = 2.6, height = 26, seed = 1, intensity = 1.0 } = {}) {
  const g = new THREE.Group();
  const uniforms = {
    uTime: { value: 0 },
    uOpacity: { value: 0.92 },
    uIntensity: { value: intensity },
    uNight: { value: 0 },
    uSeed: { value: seed * 0.37 }
  };
  waterfallUniforms.push(uniforms);
  APP.waterUniforms.push(uniforms);

  // 水幕：竖向分 18 段，横向 10 段；带厚薄与横向起伏
  const W = 10, H = 18;
  const positions = [], uvs = [], indices = [];
  for (let j = 0; j <= H; j++) {
    const v = j / H;
    for (let i = 0; i <= W; i++) {
      const u = i / W;
      const x = (u - 0.5) * width * (1 + v * 0.22);
      const y = -v * height;
      // 横向鼓出与纵向摆动
      const bulge = Math.sin(u * Math.PI) * (0.22 + v * 0.35);
      const z = bulge + Math.sin(v * 9.0 + u * 3.0) * 0.06 * (1 - v * 0.4);
      positions.push(x, y, z);
      uvs.push(u, v);
    }
  }
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const a = j * (W + 1) + i;
      const b = a + 1;
      const c = (j + 1) * (W + 1) + i;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      varying vec2 vUv;
      varying vec3 vWorld;
      varying float vFogDepth;
      void main(){
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mv = viewMatrix * wp;
        vFogDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform float uOpacity;
      uniform float uIntensity;
      uniform float uNight;
      uniform float uSeed;
      varying vec2 vUv;
      varying vec3 vWorld;
      varying float vFogDepth;

      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
                   mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
      }
      float fbm(vec2 p){
        float a = 0.5, s = 0.0, n = 0.0;
        for (int i = 0; i < 4; i++){ s += a * noise(p); n += a; p *= 2.05; a *= 0.5; }
        return s / n;
      }
      void main(){
        vec2 uv = vUv;
        float t = uTime;
        // 纵向流动纹理
        float streak = fbm(vec2(uv.x * 7.0, uv.y * 3.2 - t * 1.35 + uSeed));
        float streak2 = fbm(vec2(uv.x * 15.0 + 3.1, uv.y * 6.4 - t * 2.1 + uSeed));
        float water = streak * 0.62 + streak2 * 0.38;
        water = smoothstep(0.32, 0.82, water);

        // 两侧薄、中心厚
        float side = smoothstep(0.0, 0.16, uv.x) * smoothstep(1.0, 0.84, uv.x);
        float top = smoothstep(0.0, 0.06, uv.y);
        float alpha = (0.26 + water * 0.62) * side * top * uOpacity * uIntensity;

        vec3 col = mix(vec3(0.56, 0.68, 0.70), vec3(0.93, 0.96, 0.95), water);
        col = mix(col, vec3(0.72, 0.82, 0.84), 1.0 - uv.y);
        col *= (1.0 - uNight * 0.42);
        // 飞沫：底部更亮
        col += vec3(0.06) * smoothstep(0.55, 1.0, uv.y) * water;

        gl_FragColor = vec4(col, alpha);
        #include <colorspace_fragment>
      }
    `
  });

  const curtain = new THREE.Mesh(geo, mat);
  curtain.renderOrder = 3;
  g.add(curtain);

  // 第二层水幕：更薄、偏移，制造厚薄变化
  const curtain2 = new THREE.Mesh(geo, mat.clone());
  curtain2.material.uniforms = uniforms;
  curtain2.material.transparent = true;
  curtain2.material.depthWrite = false;
  curtain2.position.set(0.35, 0.1, 0.28);
  curtain2.scale.set(0.78, 1.02, 0.7);
  curtain2.renderOrder = 4;
  g.add(curtain2);

  return g;
}

function makeWaterfallMist(width, height, seed) {
  const uniforms = {
    uTime: { value: 0 },
    uOpacity: { value: 0.0 },
    uNight: { value: 0 }
  };
  APP.waterUniforms.push(uniforms);
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform float uOpacity;
      uniform float uNight;
      varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
                   mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
      }
      void main(){
        vec2 p = vUv;
        float n = noise(vec2(p.x * 5.0 + uTime * 0.08, p.y * 4.0 - uTime * 0.35));
        float n2 = noise(vec2(p.x * 11.0 - uTime * 0.12, p.y * 8.0 - uTime * 0.6));
        float m = smoothstep(0.32, 0.86, n * 0.6 + n2 * 0.4);
        float edge = smoothstep(0.0, 0.28, p.x) * smoothstep(1.0, 0.72, p.x)
                   * smoothstep(0.0, 0.30, p.y) * smoothstep(1.0, 0.55, p.y);
        vec3 col = mix(vec3(0.78, 0.84, 0.85), vec3(0.97, 0.98, 0.97), m) * (1.0 - uNight * 0.5);
        gl_FragColor = vec4(col, m * edge * uOpacity);
        #include <colorspace_fragment>
      }
    `
  });
  const geo = new THREE.PlaneGeometry(width, height);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.mistUniforms = uniforms;
  return mesh;
}

/* ------------------------------ 瀑布位置 -------------------------------- */
/* 南偏东的崖口：水从岛面溪流汇入，再越过岛缘落入云海。 */
const FALL_THETA = 0.62;
const FALL_R = rimRadius(FALL_THETA);
const FALL_POS = new THREE.Vector3(
  Math.cos(FALL_THETA) * FALL_R,
  0,
  Math.sin(FALL_THETA) * FALL_R
);

function buildCascade() {
  const g = new THREE.Group();

  // 上游水池：位于岛面内侧，承接庭院水渠
  const poolA = Math.cos(FALL_THETA + 0.10) * (FALL_R - 8.4);
  const poolB = Math.sin(FALL_THETA + 0.10) * (FALL_R - 8.4);
  const poolY = terrainHeight(poolA, poolB) + 0.02;
  const pool = makeWaterDisc(2.35, poolY, 0x2a4f52, 0x6b9490, 36, 0.9);
  pool.position.x = poolA;
  pool.position.z = poolB;
  pool.scale.set(1.35, 1, 0.9);
  g.add(pool);

  // 池沿
  const rimParts = [];
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * TAU;
    const geo = new THREE.BoxGeometry(0.56, 0.28, 0.4);
    geo.rotateY(-a);
    geo.translate(poolA + Math.cos(a) * 2.55 * 1.35, poolY + 0.07, poolB + Math.sin(a) * 2.55 * 0.9);
    addColorAttribute(geo, 0x9c9484, 0.05, 3002 + i);
    rimParts.push(geo);
  }
  const rim = new THREE.Mesh(mergeGeometries(rimParts, false), MAT.stone);
  rim.castShadow = true;
  rim.receiveShadow = true;
  g.add(rim);

  // 溪流：从水池到崖口
  const streamPts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const a = FALL_THETA + 0.10 - t * 0.10;
    const r = lerp(FALL_R - 8.4, FALL_R - 0.25, t);
    streamPts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
  }
  const streamPos = [];
  const streamUv = [];
  const streamIdx = [];
  const segs = 26;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const idx = Math.min(streamPts.length - 2, Math.floor(t * (streamPts.length - 1)));
    const localT = t * (streamPts.length - 1) - idx;
    const p0 = streamPts[idx], p1 = streamPts[idx + 1];
    const p = p0.clone().lerp(p1, localT);
    const tan = p1.clone().sub(p0).normalize();
    const side = new THREE.Vector3(-tan.z, 0, tan.x);
    const w = lerp(0.75, 1.55, t);
    const y = terrainHeight(p.x, p.z) + 0.07;
    streamPos.push(p.x + side.x * w, y, p.z + side.z * w);
    streamPos.push(p.x - side.x * w, y, p.z - side.z * w);
    streamUv.push(t * 6, 0, t * 6, 1);
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    streamIdx.push(a, c, b, b, c, d);
  }
  const stream = new THREE.BufferGeometry();
  stream.setAttribute('position', new THREE.Float32BufferAttribute(streamPos, 3));
  stream.setAttribute('uv', new THREE.Float32BufferAttribute(streamUv, 2));
  stream.setIndex(streamIdx);
  stream.computeVertexNormals();
  const streamMat = makeWaterMaterial({ colorDeep: 0x315b5c, colorShallow: 0x76a09a, opacity: 0.82, flow: 1.4 });
  const streamMesh = new THREE.Mesh(stream, streamMat);
  streamMesh.renderOrder = 2;
  g.add(streamMesh);

  // 崖口石唇：让水流有明确的出口
  const lipParts = [];
  for (let i = 0; i < 9; i++) {
    const a = FALL_THETA + (i - 4) * 0.055;
    const r = FALL_R - 0.1;
    const geo = new THREE.BoxGeometry(0.95, 0.36, 0.55);
    geo.rotateY(-a);
    geo.translate(Math.cos(a) * r, terrainHeight(Math.cos(a) * r, Math.sin(a) * r) + 0.02, Math.sin(a) * r);
    addColorAttribute(geo, 0x8f8777, 0.05, 3020 + i);
    lipParts.push(geo);
  }
  const lip = new THREE.Mesh(mergeGeometries(lipParts, false), MAT.stone);
  lip.castShadow = true;
  lip.receiveShadow = true;
  g.add(lip);

  // 主瀑布：从岛缘一直落入云海
  const fallTop = terrainHeight(FALL_POS.x, FALL_POS.z) - 0.35;
  const fallHeight = 64;
  const fall = makeWaterfall({ width: 3.0, height: fallHeight, seed: 7, intensity: 1.0 });
  fall.position.set(FALL_POS.x, fallTop - fallHeight * 0.5, FALL_POS.z);
  fall.rotation.y = Math.atan2(FALL_POS.x, FALL_POS.z) + Math.PI;
  g.add(fall);

  // 侧瀑：更细，错开高度
  const a2 = FALL_THETA + 0.14;
  const fall2 = makeWaterfall({ width: 1.25, height: 48, seed: 11, intensity: 0.7 });
  fall2.position.set(Math.cos(a2) * (FALL_R - 0.9), fallTop - 24, Math.sin(a2) * (FALL_R - 0.9));
  fall2.rotation.y = Math.atan2(Math.cos(a2), Math.sin(a2)) + Math.PI;
  g.add(fall2);

  // 底部雾化：位于云海顶层偏下的位置，承接到瀑布末端
  const mist = makeWaterfallMist(16, 14, 3);
  mist.position.set(FALL_POS.x + 1.4, -46.0, FALL_POS.z + 1.4);
  mist.rotation.y = Math.atan2(FALL_POS.x, FALL_POS.z);
  mist.userData.targetOpacity = 0.55;
  g.add(mist);
  APP.fallMist = mist;

  // 飞沫粒子
  const mistCount = 260;
  const mistPos = new Float32Array(mistCount * 3);
  const mistSeed = new Float32Array(mistCount);
  const rnd = rngFor(3031);
  for (let i = 0; i < mistCount; i++) {
    const t = rnd();
    mistPos[i * 3] = (rnd() - 0.5) * 4.6;
    mistPos[i * 3 + 1] = -t * 64;
    mistPos[i * 3 + 2] = (rnd() - 0.5) * 3.2 + Math.sin(t * 3.0) * 0.6;
    mistSeed[i] = rnd();
  }
  const mistGeo = new THREE.BufferGeometry();
  mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPos, 3));
  mistGeo.setAttribute('aSeed', new THREE.BufferAttribute(mistSeed, 1));
  const mistMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: 0.18 },
      uOpacity: { value: 0.0 },
      uNight: { value: 0 }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute float aSeed;
      uniform float uTime;
      uniform float uSize;
      varying float vA;
      void main(){
        vec3 p = position;
        float t = mod(uTime * (0.5 + aSeed * 0.7) + aSeed * 12.0, 1.0);
        p.x += sin(uTime * 1.3 + aSeed * 20.0) * 0.45;
        p.y += sin(t * 6.283 + aSeed * 9.0) * 1.2;
        p.z += cos(uTime * 1.1 + aSeed * 15.0) * 0.35;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * (240.0 / max(1.0, -mv.z)) * (0.6 + aSeed);
        vA = (1.0 - smoothstep(0.0, 1.0, t)) * 0.7;
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uOpacity;
      uniform float uNight;
      varying float vA;
      void main(){
        vec2 c = gl_PointCoord - 0.5;
        float d = 1.0 - smoothstep(0.1, 0.5, length(c));
        vec3 col = vec3(0.86, 0.92, 0.93) * (1.0 - uNight * 0.45);
        gl_FragColor = vec4(col, d * vA * uOpacity);
        #include <colorspace_fragment>
      }
    `
  });
  const mistPts = new THREE.Points(mistGeo, mistMat);
  mistPts.position.set(FALL_POS.x, fallTop - 0.5, FALL_POS.z);
  mistPts.userData.mistUniforms = mistMat.uniforms;
  mistPts.userData.targetOpacity = 0.85;
  g.add(mistPts);
  APP.fallSpray = mistPts;

  const baseMist = makeWaterfallMist(20, 10, 5);
  baseMist.position.set(FALL_POS.x + 1.0, -48.0, FALL_POS.z + 1.0);
  baseMist.rotation.y = Math.atan2(FALL_POS.x, FALL_POS.z);
  baseMist.userData.targetOpacity = 0.42;
  g.add(baseMist);
  APP.fallBaseMist = baseMist;

  APP.world.add(g);
  APP.cascade = { group: g, fall, fall2, mist };
  return g;
}

/* --------------------------- 庭院水体 -------------------------------- */
function buildCourtyardWater() {
  const g = new THREE.Group();

  // 东方青龙：弧形水渠（半环，绕庭院外侧）
  const east = COURTYARD_BY_KEY.east;
  const ea = Math.atan2(east.center.z, east.center.x);
  const canal = makeArcCanal(6.3, ea - 1.05, ea + 1.05, 0.85, WATER_Y, 0x2a5254, 0x6e9a94);
  canal.position.set(east.center.x, 0, east.center.z);
  g.add(canal);
  const bank = makeCanalBank(6.3, ea - 1.05, ea + 1.05, 0.85, 3100);
  bank.position.set(east.center.x, 0, east.center.z);
  g.add(bank);

  // 水渠与瀑布上游相连的细渠（沿岛面）
  const linkPts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const a = lerp(ea + 0.9, FALL_THETA + 0.35, t);
    const r = lerp(6.3, FALL_R - 8.6, t);
    linkPts.push(new THREE.Vector3(
      east.center.x + Math.cos(a) * r,
      0,
      east.center.z + Math.sin(a) * r
    ));
  }
  const linkSegs = 24;
  const lp = [], lu = [], li = [];
  for (let i = 0; i <= linkSegs; i++) {
    const t = i / linkSegs;
    const idx = Math.min(linkPts.length - 2, Math.floor(t * (linkPts.length - 1)));
    const lt = t * (linkPts.length - 1) - idx;
    const p = linkPts[idx].clone().lerp(linkPts[idx + 1], lt);
    const tan = linkPts[idx + 1].clone().sub(linkPts[idx]).normalize();
    const side = new THREE.Vector3(-tan.z, 0, tan.x);
    const w = lerp(0.55, 0.9, t);
    const y = terrainHeight(p.x, p.z) + 0.06;
    lp.push(p.x + side.x * w, y, p.z + side.z * w);
    lp.push(p.x - side.x * w, y, p.z - side.z * w);
    lu.push(t * 8, 0, t * 8, 1);
  }
  for (let i = 0; i < linkSegs; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    li.push(a, c, b, b, c, d);
  }
  const linkGeo = new THREE.BufferGeometry();
  linkGeo.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
  linkGeo.setAttribute('uv', new THREE.Float32BufferAttribute(lu, 2));
  linkGeo.setIndex(li);
  linkGeo.computeVertexNormals();
  const linkMat = makeWaterMaterial({ colorDeep: 0x2d5556, colorShallow: 0x7aa39b, opacity: 0.8, flow: 1.2 });
  const link = new THREE.Mesh(linkGeo, linkMat);
  link.renderOrder = 2;
  g.add(link);

  // 北方玄武：静水池
  const north = COURTYARD_BY_KEY.north;
  const pool = makeWaterDisc(2.25, terrainHeight(north.center.x, north.center.z) + 0.20, 0x1f3d47, 0x5c858c, 40, 0.9);
  pool.position.x = north.center.x;
  pool.position.z = north.center.z;
  pool.scale.set(1.5, 1, 0.72);
  g.add(pool);

  // 池沿石
  const rimParts = [];
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * TAU;
    const geo = new THREE.BoxGeometry(0.6, 0.28, 0.34);
    geo.rotateY(-a);
    geo.translate(north.center.x + Math.cos(a) * 3.42, terrainHeight(north.center.x, north.center.z) + 0.16, north.center.z + Math.sin(a) * 1.66);
    addColorAttribute(geo, 0x7f8479, 0.05, 3210 + i);
    rimParts.push(geo);
  }
  const rim = new THREE.Mesh(mergeGeometries(rimParts, false), MAT.stone);
  rim.castShadow = true;
  rim.receiveShadow = true;
  g.add(rim);

  // 西方白虎：浅水槽（长条）
  const west = COURTYARD_BY_KEY.west;
  const trough = makeWaterDisc(1.1, terrainHeight(west.center.x, west.center.z) + 0.21, 0x4a5a55, 0x8fa79c, 24, 0.78);
  trough.position.set(west.center.x - 1.0, trough.position.y, west.center.z + 4.2);
  trough.scale.set(2.4, 1, 0.7);
  g.add(trough);

  APP.world.add(g);
  return g;
}

buildCascade();
buildCourtyardWater();
