/* =========================================================================
   08 · 云海、天空、星空、日月光与飞鸟萤火
   云海由三层低对比的程序云面 + 少量近景云团构成，岛底结构保持可见。
   ========================================================================= */

/* ------------------------------ 云层 ----------------------------------- */
function makeCloudLayer({ y, size, opacity, speed, scale, seed, tint = 0xffffff, segments = 1 }) {
  const geo = new THREE.PlaneGeometry(size, size, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const tex = TEX.cloud[seed % TEX.cloud.length];
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTex: { value: tex },
      uScale: { value: scale },
      uOpacity: { value: opacity },
      uSpeed: { value: speed },
      uTint: { value: new THREE.Color(tint) },
      uNight: { value: 0 },
      uFogColor: { value: new THREE.Color(0xcfd9df) },
      uFogDensity: { value: 0.0034 }
    },
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
      uniform sampler2D uTex;
      uniform float uScale;
      uniform float uOpacity;
      uniform float uSpeed;
      uniform vec3 uTint;
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
        for (int i = 0; i < 4; i++){ s += a * noise(p); n += a; p *= 2.07; a *= 0.5; }
        return s / n;
      }
      void main(){
        vec2 p = vWorld.xz;
        vec2 drift = vec2(uTime * uSpeed, uTime * uSpeed * 0.34);
        float n1 = fbm(p * 0.010 * uScale + drift * 0.010);
        float n2 = fbm(p * 0.028 * uScale - drift * 0.017 + 4.3);
        float tex = texture2D(uTex, p * 0.004 * uScale + drift * 0.003).a;
        float density = n1 * 0.52 + n2 * 0.28 + tex * 0.30;
        density = smoothstep(0.30, 0.82, density);

        vec2 c = vUv - 0.5;
        float radial = length(c);
        // 中心到边缘缓慢过渡，几乎全平面都有云，仅最外缘有极轻衰减
        float edge = 1.0 - smoothstep(0.46, 0.50, radial) * 0.45;
        float alpha = density * edge * uOpacity;
        vec3 col = mix(uTint * 0.86, uTint, density);
        // 朝向太阳的一侧微暖
        col = mix(col, vec3(1.0, 0.96, 0.88), 0.12 * density);
        col *= (1.0 - uNight * 0.58);

        float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
        col = mix(col, uFogColor * (1.0 - uNight * 0.72), clamp(fogFactor, 0.0, 1.0));
        gl_FragColor = vec4(col, alpha);
        #include <colorspace_fragment>
      }
    `
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = y;
  mesh.renderOrder = -1;
  APP.cloudMats.push(mat);
  return mesh;
}

function buildCloudSea() {
  const group = new THREE.Group();
  group.name = 'cloud-sea';

  // 云海：多层连续云面，从岛缘以下逐步加厚
  const layers = [
    { y: -54.0, size: 1500, opacity: 0.92, speed: 0.30, scale: 1.05, seed: 0, tint: 0xf6f7f1 },
    { y: -36.0, size: 1100, opacity: 0.78, speed: 0.46, scale: 1.30, seed: 1, tint: 0xffffff },
    { y: -22.0, size: 880,  opacity: 0.46, speed: 0.68, scale: 1.85, seed: 2, tint: 0xfbf7ee },
    { y:  -8.0, size: 720,  opacity: 0.20, speed: 0.92, scale: 2.4,  seed: 4, tint: 0xfdfbf3 }
  ];
  for (const l of layers) {
    const m = makeCloudLayer(l);
    group.add(m);
  }

  // 近景云团：位于画面下半部的两侧，形成“云海翻涌”的体积感
  const spriteGroup = new THREE.Group();
  const rnd = rngFor(4001);
  for (let i = 0; i < 64; i++) {
    const mat = new THREE.SpriteMaterial({
      map: TEX.cloud[i % 3],
      color: 0xffffff,
      transparent: true,
      opacity: 0.28 + rnd() * 0.30,
      depthWrite: false,
      fog: true
    });
    const sp = new THREE.Sprite(mat);
    const a = rnd() * TAU;
    const rr = 56 + rnd() * 280;
    const y = -36 + rnd() * 14 - Math.pow(rnd(), 2) * 6;
    sp.position.set(Math.cos(a) * rr, y, Math.sin(a) * rr);
    const s = 60 + rnd() * 160;
    sp.scale.set(s, s * (0.24 + rnd() * 0.22), 1);
    sp.userData.drift = 0.4 + rnd() * 0.9;
    sp.userData.baseX = sp.position.x;
    sp.userData.range = 18 + rnd() * 40;
    sp.userData.phase = rnd() * TAU;
    spriteGroup.add(sp);
    APP.cloudMats.push(mat);
  }
  group.add(spriteGroup);
  APP.cloudSprites = spriteGroup;

  // 远处山影
  const mtn = new THREE.Group();
  const mtnTint = new THREE.Color(0x8ea1ad);
  for (let i = 0; i < 14; i++) {
    const segCount = 6 + Math.floor(rnd() * 3);
    const geo = new THREE.ConeGeometry(28 + rnd() * 56, 56 + rnd() * 92, segCount, 2);
    const tint = mtnTint.clone().offsetHSL((rnd() - 0.5) * 0.04, -0.08, (rnd() - 0.5) * 0.06);
    const mat = new THREE.MeshBasicMaterial({
      color: tint,
      transparent: true,
      opacity: 0.30 + rnd() * 0.10,
      depthWrite: false,
      fog: true
    });
    const m = new THREE.Mesh(geo, mat);
    const a = rnd() * TAU;
    const rr = 360 + rnd() * 320;
    m.position.set(Math.cos(a) * rr, -48 + rnd() * 6, Math.sin(a) * rr);
    m.rotation.y = rnd() * TAU;
    m.scale.set(1, 0.55 + rnd() * 0.55, 1);
    mtn.add(m);
  }
  group.add(mtn);
  APP.cloudMountains = mtn;

  APP.world.add(group);
  return group;
}

/* ------------------------------ 天空穹顶 -------------------------------- */
function buildSky() {
  const uniforms = {
    uTop: { value: new THREE.Color(0x4f7fa8) },
    uMid: { value: new THREE.Color(0x9fc0cf) },
    uHorizon: { value: new THREE.Color(0xdfe4dc) },
    uSunDir: { value: new THREE.Vector3(0.55, 0.42, 0.72).normalize() },
    uSunColor: { value: new THREE.Color(0xffd9a8) },
    uNight: { value: 0 },
    uTime: { value: 0 }
  };
  APP.skyUniforms = uniforms;

  const geo = new THREE.SphereGeometry(1000, 48, 28);
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main(){
        vDir = normalize(position);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uTop;
      uniform vec3 uMid;
      uniform vec3 uHorizon;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform float uNight;
      uniform float uTime;
      varying vec3 vDir;

      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -1.0, 1.0);
        float t = smoothstep(-0.06, 0.62, h);
        vec3 col = mix(uHorizon, uMid, smoothstep(-0.02, 0.22, h));
        col = mix(col, uTop, smoothstep(0.20, 0.95, h));

        // 太阳方向的暖色散射
        float sunAmt = pow(max(dot(d, uSunDir), 0.0), 7.0);
        col += uSunColor * sunAmt * 0.28 * (1.0 - uNight);
        float halo = pow(max(dot(d, uSunDir), 0.0), 2.0);
        col += uSunColor * halo * 0.06 * (1.0 - uNight);

        // 地平线以下（云海之上）保持浅色，避免出现黑底
        col = mix(col, uHorizon * 0.94, smoothstep(0.0, -0.22, h));

        // 轻微的大气颗粒，避免纯色渐变
        float grain = fract(sin(dot(d.xy * 512.0, vec2(12.9898, 78.233))) * 43758.5453);
        col += (grain - 0.5) * 0.006;

        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.frustumCulled = false;
  APP.world.add(sky);
  APP.sky = sky;
  return sky;
}

/* ------------------------------ 星空 ----------------------------------- */
function buildStars() {
  const COUNT = 1500;
  const pos = new Float32Array(COUNT * 3);
  const size = new Float32Array(COUNT);
  const phase = new Float32Array(COUNT);
  const color = new Float32Array(COUNT * 3);
  const rnd = rngFor(5001);
  const c = new THREE.Color();
  for (let i = 0; i < COUNT; i++) {
    // 半球分布，避免地平线以下
    const u = rnd();
    const v = rnd();
    const theta = u * TAU;
    const phi = Math.acos(1 - v * 0.92);
    const r = 760 + rnd() * 90;
    const x = Math.sin(phi) * Math.cos(theta) * r;
    const y = Math.cos(phi) * r;
    const z = Math.sin(phi) * Math.sin(theta) * r;
    pos[i * 3] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;
    size[i] = 0.8 + Math.pow(rnd(), 3) * 3.4;
    phase[i] = rnd() * TAU;
    const warm = rnd();
    c.setHSL(warm > 0.7 ? 0.09 : 0.58, 0.18 + rnd() * 0.25, 0.72 + rnd() * 0.22);
    color[i * 3] = c.r;
    color[i * 3 + 1] = c.g;
    color[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(color, 3));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0.0 },
      uPixelRatio: { value: renderer.getPixelRatio() }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute float aSize;
      attribute float aPhase;
      attribute vec3 aColor;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uPixelRatio;
      varying vec3 vColor;
      varying float vAlpha;
      void main(){
        vColor = aColor;
        float twinkle = 0.72 + 0.28 * sin(uTime * 0.55 + aPhase * 4.0);
        vAlpha = twinkle;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPixelRatio * (0.9 + 0.1 * twinkle);
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vAlpha;
      void main(){
        vec2 c = gl_PointCoord - 0.5;
        float d = 1.0 - smoothstep(0.0, 0.5, length(c));
        gl_FragColor = vec4(vColor, d * vAlpha * uOpacity);
        #include <colorspace_fragment>
      }
    `
  });
  const stars = new THREE.Points(geo, mat);
  stars.frustumCulled = false;
  APP.world.add(stars);
  APP.stars = stars;
  APP.starUniforms = mat.uniforms;
  return stars;
}

/* ------------------------------ 日月光 ---------------------------------- */
function buildCelestialBodies() {
  // 太阳：billboard 光晕
  const sunMat = new THREE.SpriteMaterial({
    map: TEX.glowWarm,
    color: 0xfff2d2,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false
  });
  const sun = new THREE.Sprite(sunMat);
  sun.scale.set(150, 150, 1);
  const sunDir = new THREE.Vector3(-0.52, 0.40, -0.66).normalize();
  sun.position.copy(sunDir).multiplyScalar(780);
  APP.world.add(sun);
  APP.sunGlow = sun;
  APP.sunDir = sunDir;

  // 月亮
  const moonMat = new THREE.SpriteMaterial({
    map: TEX.glowCool,
    color: 0xdfeaff,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false
  });
  const moon = new THREE.Sprite(moonMat);
  moon.scale.set(120, 120, 1);
  const moonDir = new THREE.Vector3(0.46, 0.42, -0.62).normalize();
  moon.position.copy(moonDir).multiplyScalar(760);
  APP.world.add(moon);
  APP.moonGlow = moon;
  APP.moonDir = moonDir;

  // 月盘：实体圆片，避免只有光晕
  const discMat = new THREE.MeshBasicMaterial({
    color: 0xe8f0ff,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    fog: false
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(16, 32), discMat);
  disc.position.copy(moonDir).multiplyScalar(770);
  disc.lookAt(0, 0, 0);
  APP.world.add(disc);
  APP.moonDisc = disc;
}

/* ------------------------------ 飞鸟 ----------------------------------- */
function buildBirds() {
  const rnd = rngFor(6001);
  const group = new THREE.Group();
  const birdMat = new THREE.MeshStandardMaterial({
    color: 0x3a4048,
    roughness: 0.9,
    metalness: 0,
    side: THREE.DoubleSide
  });
  const wingGeo = new THREE.PlaneGeometry(1.15, 0.32, 1, 1);
  wingGeo.translate(0.57, 0, 0);
  const bodyGeo = new THREE.SphereGeometry(0.10, 6, 4);
  bodyGeo.scale(1.8, 0.7, 0.7);

  APP.birds = [];
  for (let i = 0; i < 9; i++) {
    const bird = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, birdMat);
    bird.add(body);
    const left = new THREE.Mesh(wingGeo, birdMat);
    const right = new THREE.Mesh(wingGeo, birdMat);
    right.scale.x = -1;
    bird.add(left, right);
    bird.userData = {
      left, right,
      radius: 60 + rnd() * 50,
      height: 14 + rnd() * 20,
      speed: 0.035 + rnd() * 0.035,
      phase: rnd() * TAU,
      flap: 2.2 + rnd() * 1.4,
      wobble: rnd() * TAU
    };
    bird.scale.setScalar(0.9 + rnd() * 0.7);
    group.add(bird);
    APP.birds.push(bird);
  }
  APP.world.add(group);
  APP.birdGroup = group;
}

/* ------------------------------ 萤火虫 ---------------------------------- */
function buildFireflies() {
  const COUNT = 140;
  const pos = new Float32Array(COUNT * 3);
  const seed = new Float32Array(COUNT);
  const rnd = rngFor(7001);
  for (let i = 0; i < COUNT; i++) {
    const a = rnd() * TAU;
    const rr = 14 + Math.sqrt(rnd()) * 24;
    pos[i * 3] = Math.cos(a) * rr;
    pos[i * 3 + 1] = terrainHeight(Math.cos(a) * rr, Math.sin(a) * rr) + 0.5 + rnd() * 2.4;
    pos[i * 3 + 2] = Math.sin(a) * rr;
    seed[i] = rnd();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0.0 },
      uPixelRatio: { value: renderer.getPixelRatio() }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute float aSeed;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vAlpha;
      void main(){
        vec3 p = position;
        float t = uTime * (0.16 + aSeed * 0.2);
        p.x += sin(t * 1.7 + aSeed * 20.0) * 1.6;
        p.z += cos(t * 1.3 + aSeed * 13.0) * 1.6;
        p.y += sin(t * 2.1 + aSeed * 31.0) * 0.5;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (2.4 + aSeed * 3.2) * uPixelRatio;
        float blink = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * (0.7 + aSeed) + aSeed * 30.0), 3.0);
        vAlpha = blink;
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uOpacity;
      varying float vAlpha;
      void main(){
        vec2 c = gl_PointCoord - 0.5;
        float d = 1.0 - smoothstep(0.0, 0.5, length(c));
        vec3 col = vec3(1.0, 0.86, 0.52);
        gl_FragColor = vec4(col, d * vAlpha * uOpacity);
        #include <colorspace_fragment>
      }
    `
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  APP.world.add(points);
  APP.fireflies = points;
  APP.fireflyUniforms = mat.uniforms;
}

/* ------------------------------ 组装 ---------------------------------- */
buildSky();
buildCloudSea();
buildStars();
buildCelestialBodies();
buildBirds();
buildFireflies();
