/* =========================================================================
   11 · 动画、性能自适应与启动
   ========================================================================= */

/* ------------------------------ 动画状态 -------------------------------- */
const anim = {
  t: 0,
  birds: [],
  lanternPhase: [],
  lastFrame: performance.now(),
  frameCount: 0,
  fpsAccum: 0,
  fpsSamples: 0,
  fps: 60,
  degradeStep: 0
};

/* ------------------------------ 渲染循环 -------------------------------- */
function animate() {
  requestAnimationFrame(animate);
  const dtRaw = APP.clock.getDelta();
  const dt = Math.min(dtRaw, 0.05);
  anim.t += dt;
  const t = anim.t;
  const nowMs = performance.now();
  const nowSec = nowMs / 1000;

  // 昼夜过渡
  updateNight(nowSec);

  // 观星装置：缓慢、有轴心的关系旋转
  if (APP.armillary) {
    const a = APP.armillary;
    a.equatorPivot.rotation.y = t * 0.035;
    a.eclipticPivot.rotation.z = Math.sin(t * 0.05) * 0.05;
    a.sightPivot.rotation.y = -t * 0.06;
    a.sightPivot.rotation.x = Math.sin(t * 0.07) * 0.16;
    // 极轴整体做极缓慢的进动（幅度很小）
    a.frame.rotation.y = Math.sin(t * 0.018) * 0.035;
    if (a.starMat) a.starMat.opacity = APP.night.value * (0.55 + 0.18 * Math.sin(t * 0.9));
  }

  // 水
  for (const u of APP.waterUniforms) {
    if (u.uTime) u.uTime.value = t;
  }
  // 风
  for (const u of APP.windUniforms) {
    if (u.uTime) u.uTime.value = t;
  }
  // 云
  for (const m of APP.cloudMats) {
    if (m.uniforms && m.uniforms.uTime) m.uniforms.uTime.value = t;
  }
  if (APP.cloudSprites) {
    APP.cloudSprites.children.forEach((sp) => {
      sp.position.x = sp.userData.baseX + Math.sin(t * 0.01 * sp.userData.drift + sp.userData.phase) * sp.userData.range;
    });
  }
  // 星空 / 萤火
  if (APP.starUniforms) APP.starUniforms.uTime.value = t;
  if (APP.fireflyUniforms) APP.fireflyUniforms.uTime.value = t;

  // 飞鸟：不同高度、不同速度，振翅有相位差
  if (APP.birds) {
    for (let i = 0; i < APP.birds.length; i++) {
      const b = APP.birds[i];
      const d = b.userData;
      const ang = d.phase + t * d.speed;
      b.position.set(
        Math.cos(ang) * d.radius,
        d.height + Math.sin(t * 0.24 + d.wobble) * 2.2,
        Math.sin(ang) * d.radius
      );
      b.rotation.y = -ang + Math.PI / 2;
      b.rotation.z = Math.sin(t * 0.3 + d.wobble) * 0.12;
      const flap = Math.sin(t * d.flap + d.phase) * 0.55;
      d.left.rotation.z = flap;
      d.right.rotation.z = -flap;
    }
  }

  // 灯焰微动
  if (APP.lanternMats.length) {
    for (let i = 0; i < APP.lanternMats.length; i++) {
      const rec = APP.lanternMats[i];
      if (rec.spriteMat && rec.spriteMat.opacity > 0.001) {
        const f = 0.92 + 0.08 * Math.sin(t * 5.2 + i * 1.7);
        rec.spriteMat.opacity = 0.7 * APP.night.value * f;
      }
    }
  }

  // 视角重置动画
  updateResetTween(nowMs);

  // 控制器
  controls.update();
  clampControlsTarget();

  // 选中碑的轻微脉动
  if (pickState.selected) {
    const rec = APP.steleRecords.find((r) => r.mansion === pickState.selected);
    if (rec) {
      rec.faceMat.emissiveIntensity = 0.30 + 0.10 * Math.sin(t * 2.2);
    }
  }

  // 性能自适应
  updateQuality(dtRaw);

  renderer.render(scene, camera);

  // 首帧标记
  if (!APP.ready && anim.frameCount > 2) {
    APP.ready = true;
    window.__BOOT__ = true;
    window.__READY__ = true;
    if (window.__clearBootTimer) window.__clearBootTimer();
    const loader = document.getElementById('loader');
    if (loader) loader.classList.add('done');
    setTimeout(() => {
      const hint = document.getElementById('hint');
      if (hint) hint.classList.add('fade');
    }, 9000);
  }
  anim.frameCount++;
}

/* ------------------------------ 性能自适应 ------------------------------- */
function updateQuality(dtRaw) {
  const q = APP.quality;
  anim.fpsAccum += dtRaw;
  anim.fpsSamples++;
  if (anim.fpsAccum >= 1.0) {
    const fps = anim.fpsSamples / anim.fpsAccum;
    anim.fps = fps;
    anim.fpsAccum = 0;
    anim.fpsSamples = 0;
    q.samples.push(fps);
    if (q.samples.length > 6) q.samples.shift();
    const avg = q.samples.reduce((a, b) => a + b, 0) / q.samples.length;

    const now = performance.now();
    if (now - q.lastAdjust > 6000) {
      if (avg < 32 && q.level > 0) {
        degradeQuality();
        q.lastAdjust = now;
      } else if (avg > 55 && q.level < 2 && q.samples.length >= 5) {
        // 不自动升档，避免来回抖动
      }
    }
  }
}

function degradeQuality() {
  const q = APP.quality;
  q.level--;
  if (q.level === 1) {
    // 第一步：降低像素比与阴影
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    keyLight.shadow.mapSize.set(1024, 1024);
    if (keyLight.shadow.map) {
      keyLight.shadow.map.dispose();
      keyLight.shadow.map = null;
    }
    keyLight.shadow.radius = 1.2;
    if (APP.fireflies) APP.fireflies.visible = false;
    if (APP.fallSpray) APP.fallSpray.visible = false;
    if (APP.starUniforms) APP.starUniforms.uPixelRatio.value = renderer.getPixelRatio();
    if (APP.fireflyUniforms) APP.fireflyUniforms.uPixelRatio.value = renderer.getPixelRatio();
    if (APP.scatterRocks) APP.scatterRocks.castShadow = false;
  } else if (q.level === 0) {
    // 第二步：关闭阴影、减少草地与云层细节，但保留主岛、观星台与四庭院
    renderer.shadowMap.enabled = false;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.0));
    if (APP.grass) APP.grass.count = Math.floor(APP.grass.count * 0.45);
    if (APP.cloudMats.length > 2) {
      for (const m of APP.cloudMats) {
        if (m.uniforms && m.uniforms.uOpacity) m.uniforms.uOpacity.value *= 0.85;
      }
    }
  }
}

/* ------------------------------ 启动 ----------------------------------- */
function start() {
  APP.clock.start();
  animate();
  // 暴露少量调试接口，便于实际检查
  window.__SCENE__ = {
    scene, camera, renderer, controls,
    app: APP,
    mansions: MANSIONS,
    courtyards: COURTYARDS,
    openCard,
    closeCard,
    resetView,
    setNight: setNightTarget,
    get nightValue() { return APP.night.value; }
  };
}

start();
