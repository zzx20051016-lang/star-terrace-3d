/* =========================================================================
   09 · 昼夜系统：灯光、天空、雾、云、自发光与星空的统一过渡
   ========================================================================= */

const DAY = {
  skyTop: new THREE.Color(0x4a7a9f),
  skyMid: new THREE.Color(0xb6cfd8),
  skyHorizon: new THREE.Color(0xeaeadd),
  fog: new THREE.Color(0xdde5db),
  fogDensity: 0.0010,
  keyColor: new THREE.Color(0xffe0b0),
  keyIntensity: 2.5,
  fillColor: new THREE.Color(0xa9c4d6),
  fillIntensity: 0.8,
  hemiSky: new THREE.Color(0xc4dbea),
  hemiGround: new THREE.Color(0x8a8069),
  hemiIntensity: 0.9,
  ambient: new THREE.Color(0xdfe6e6),
  ambientIntensity: 0.24,
  sunColor: new THREE.Color(0xfff1d2),
  sunOpacity: 0.0,
  exposure: 1.02,
  cloudTint: new THREE.Color(0xffffff),
  cloudOpacity: 1.0,
  mountainOpacity: 0.24,
  waterTint: new THREE.Color(0xffffff)
};

const NIGHT = {
  skyTop: new THREE.Color(0x0a1222),
  skyMid: new THREE.Color(0x172740),
  skyHorizon: new THREE.Color(0x33455e),
  fog: new THREE.Color(0x1a2940),
  fogDensity: 0.0024,
  keyColor: new THREE.Color(0xbcd2f2),
  keyIntensity: 2.2,
  fillColor: new THREE.Color(0x5878a0),
  fillIntensity: 0.8,
  hemiSky: new THREE.Color(0x3c5680),
  hemiGround: new THREE.Color(0x2a2e36),
  hemiIntensity: 0.9,
  ambient: new THREE.Color(0x3a4d6a),
  ambientIntensity: 0.42,
  sunColor: new THREE.Color(0xdfeaff),
  sunOpacity: 0.0,
  exposure: 1.28,
  cloudTint: new THREE.Color(0x8ea3bd),
  cloudOpacity: 0.62,
  mountainOpacity: 0.14,
  waterTint: new THREE.Color(0x93a6c4)
};

/* ------------------------------ 主光 ----------------------------------- */
const keyLight = new THREE.DirectionalLight(DAY.keyColor, DAY.keyIntensity);
keyLight.position.set(-62, 30, -74);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 10;
keyLight.shadow.camera.far = 260;
keyLight.shadow.camera.left = -66;
keyLight.shadow.camera.right = 66;
keyLight.shadow.camera.top = 66;
keyLight.shadow.camera.bottom = -66;
keyLight.shadow.bias = -0.0005;
keyLight.shadow.normalBias = 0.03;
keyLight.shadow.radius = 2.0;
keyLight.target.position.set(0, -2, 0);
APP.world.add(keyLight);
APP.world.add(keyLight.target);
APP.keyLight = keyLight;

const fillLight = new THREE.DirectionalLight(DAY.fillColor, DAY.fillIntensity);
fillLight.position.set(68, 22, 54);
fillLight.castShadow = false;
APP.world.add(fillLight);
APP.fillLight = fillLight;

const hemiLight = new THREE.HemisphereLight(DAY.hemiSky, DAY.hemiGround, DAY.hemiIntensity);
APP.world.add(hemiLight);
APP.hemiLight = hemiLight;

const ambientLight = new THREE.AmbientLight(DAY.ambient, DAY.ambientIntensity);
APP.world.add(ambientLight);
APP.ambientLight = ambientLight;

/* 低角度补光：从镜头一侧照亮岛底，避免岩体成为剪影。不投影。 */
const bounceLight = new THREE.DirectionalLight(0xc9d6d8, 0.85);
bounceLight.position.set(34, -26, 62);
bounceLight.castShadow = false;
APP.world.add(bounceLight);
APP.bounceLight = bounceLight;

/* 夜间庭院暖光：每院一盏低强度点光（不投影），只提亮局部。 */
const courtyardLights = [];
for (const c of COURTYARDS) {
  const l = new THREE.PointLight(c.lantern, 0.0, 17, 1.8);
  l.position.set(c.center.x, 3.4, c.center.z);
  l.castShadow = false;
  APP.world.add(l);
  courtyardLights.push({ light: l, base: c.key === 'south' ? 7.5 : 5.5 });
}

/* 观星台的一盏暖光，夜间突出主视觉 */
const instrumentLight = new THREE.PointLight(0xffc27a, 0.0, 22, 1.9);
instrumentLight.position.set(0, PLATFORM_TOP_Y + 2.4, 3.6);
instrumentLight.castShadow = false;
APP.world.add(instrumentLight);
APP.instrumentLight = instrumentLight;

/* ------------------------------ 状态切换 -------------------------------- */
const nightState = APP.night;

function setNightTarget(on) {
  nightState.active = true;
  nightState.from = nightState.value;
  nightState.to = on ? 1 : 0;
  nightState.start = performance.now() / 1000;
  document.body.classList.toggle('is-night', on);
  const btn = document.getElementById('btn-night');
  const label = document.getElementById('btn-night-label');
  if (btn) {
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    const ico = btn.querySelector('.ico');
    if (ico) ico.textContent = on ? '☀' : '☾';
  }
  if (label) label.textContent = on ? '天明' : '入夜';
  // 重置视角按钮的语义不变
  if (APP.onNightChange) APP.onNightChange(on);
}

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function updateNight(now) {
  if (!nightState.active) return;
  const elapsed = now - nightState.start;
  const t = clamp(elapsed / nightState.dur, 0, 1);
  const e = easeInOutCubic(t);
  nightState.value = lerp(nightState.from, nightState.to, e);
  if (t >= 1) {
    nightState.active = false;
    nightState.value = nightState.to;
  }
  applyNight(nightState.value);
}

function applyNight(k) {
  const n = clamp(k, 0, 1);

  // 天空
  const su = APP.skyUniforms;
  if (su) {
    su.uTop.value.copy(DAY.skyTop).lerp(NIGHT.skyTop, n);
    su.uMid.value.copy(DAY.skyMid).lerp(NIGHT.skyMid, n);
    su.uHorizon.value.copy(DAY.skyHorizon).lerp(NIGHT.skyHorizon, n);
    su.uNight.value = n;
    su.uSunColor.value.copy(DAY.sunColor).lerp(new THREE.Color(0x9fb6dc), n);
    su.uSunDir.value.copy(APP.sunDir);
  }

  // 雾
  scene.fog.color.copy(DAY.fog).lerp(NIGHT.fog, n);
  scene.fog.density = lerp(DAY.fogDensity, NIGHT.fogDensity, n);
  renderer.setClearColor(scene.fog.color, 1);

  // 灯光
  keyLight.color.copy(DAY.keyColor).lerp(NIGHT.keyColor, n);
  keyLight.intensity = lerp(DAY.keyIntensity, NIGHT.keyIntensity, n);
  const dayPos = new THREE.Vector3(-62, 30, -74);
  const nightPos = new THREE.Vector3(58, 52, 44);
  keyLight.position.copy(dayPos).lerp(nightPos, n);

  fillLight.color.copy(DAY.fillColor).lerp(NIGHT.fillColor, n);
  fillLight.intensity = lerp(DAY.fillIntensity, NIGHT.fillIntensity, n);

  hemiLight.color.copy(DAY.hemiSky).lerp(NIGHT.hemiSky, n);
  hemiLight.groundColor.copy(DAY.hemiGround).lerp(NIGHT.hemiGround, n);
  hemiLight.intensity = lerp(DAY.hemiIntensity, NIGHT.hemiIntensity, n);

  ambientLight.color.copy(DAY.ambient).lerp(NIGHT.ambient, n);
  ambientLight.intensity = lerp(DAY.ambientIntensity, NIGHT.ambientIntensity, n);

  // 岛底补光：白天冷白，夜间偏靛
  bounceLight.intensity = lerp(0.85, 0.55, n);
  bounceLight.color.copy(new THREE.Color(0xc9d6d8)).lerp(new THREE.Color(0x5a7396), n);

  renderer.toneMappingExposure = lerp(DAY.exposure, NIGHT.exposure, n);

  // 日、月
  if (APP.sunGlow) {
    APP.sunGlow.material.opacity = DAY.sunOpacity * (1 - n) * (1 - n);
    APP.sunGlow.visible = n < 0.98;
  }
  if (APP.moonGlow) {
    APP.moonGlow.material.opacity = 0.85 * n;
    APP.moonGlow.visible = n > 0.02;
  }
  if (APP.moonDisc) {
    APP.moonDisc.material.opacity = 0.95 * n;
    APP.moonDisc.visible = n > 0.02;
  }

  // 星空
  if (APP.starUniforms) APP.starUniforms.uOpacity.value = smoothstep(0.05, 0.9, n);
  if (APP.stars) APP.stars.visible = n > 0.03;

  // 云海
  for (const m of APP.cloudMats) {
    if (m.uniforms && m.uniforms.uNight) {
      m.uniforms.uNight.value = n;
      if (m.uniforms.uTint) m.uniforms.uTint.value.copy(DAY.cloudTint).lerp(NIGHT.cloudTint, n);
      if (m.uniforms.uOpacity) {
        const base = m.userData && m.userData.baseOpacity;
        // 云层基础不透明度保存在创建时
      }
      if (m.uniforms.uFogColor) m.uniforms.uFogColor.value.copy(scene.fog.color);
    } else if (m.isSpriteMaterial) {
      m.opacity = lerp(m.userData.baseSpriteOpacity || 0.2, (m.userData.baseSpriteOpacity || 0.2) * 0.55, n);
    }
  }
  if (APP.cloudMountains) {
    APP.cloudMountains.children.forEach((m) => {
      m.material.opacity = lerp(DAY.mountainOpacity, NIGHT.mountainOpacity, n);
      m.material.color.setHex(0x8a9aa4).lerp(new THREE.Color(0x38465c), n);
    });
  }

  // 水
  for (const u of APP.waterUniforms) {
    if (u.uNight) u.uNight.value = n;
    if (u.uFogColor) u.uFogColor.value.copy(scene.fog.color);
    if (u.uFogDensity) u.uFogDensity.value = scene.fog.density;
  }

  // 自发光材质
  for (const rec of APP.emissiveMats) {
    if (!rec.mat) continue;
    rec.mat.emissiveIntensity = lerp(rec.day, rec.night, n);
  }

  // 灯焰、光晕与点光
  for (const rec of APP.lanternMats) {
    const flicker = 0.94 + 0.06 * Math.sin(performance.now() * 0.004 + (rec.phase || 0));
    if (rec.flameMat && rec.flameMat.isPointsMaterial) {
      rec.flameMat.opacity = 0.9 * n;
    } else if (rec.flameMat) {
      rec.flameMat.opacity = 0.9 * n * flicker;
    }
    if (rec.spriteMat) rec.spriteMat.opacity = 0.7 * n;
  }
  for (const rec of courtyardLights) {
    rec.light.intensity = rec.base * n;
  }
  if (instrumentLight) instrumentLight.intensity = 11.0 * n;

  // 萤火虫
  if (APP.fireflyUniforms) APP.fireflyUniforms.uOpacity.value = smoothstep(0.25, 1.0, n);

  // 瀑布飞沫与雾
  if (APP.fallMist) APP.fallMist.userData.mistUniforms.uOpacity.value = 0.46 * (1 - n * 0.25);
  if (APP.fallSpray) {
    APP.fallSpray.userData.mistUniforms.uOpacity.value = 0.8 * (1 - n * 0.2);
    APP.fallSpray.userData.mistUniforms.uNight.value = n;
  }
  if (APP.fallBaseMist) APP.fallBaseMist.userData.mistUniforms.uOpacity.value = 0.32 * (1 - n * 0.2);

  // UI 提示与文字对比
  document.documentElement.style.setProperty('--ui-night', String(n));
}

/* 记录云层的基准不透明度 */
APP.cloudMats.forEach((m) => {
  if (m.uniforms && m.uniforms.uOpacity) m.userData.baseOpacity = m.uniforms.uOpacity.value;
  if (m.isSpriteMaterial) m.userData.baseSpriteOpacity = m.opacity;
});

/* ------------------------------ 按钮绑定 -------------------------------- */
(function bindNightButton() {
  const btn = document.getElementById('btn-night');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const target = nightState.to > 0.5 ? 0 : 1;
    setNightTarget(target === 1);
  });
})();

/* 初始为白天 */
applyNight(0);
