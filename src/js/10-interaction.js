/* =========================================================================
   10 · 交互：OrbitControls、星宿碑拾取、信息卡、重置视角与窗口适配
   ========================================================================= */

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const pickState = {
  downX: 0, downY: 0, downTime: 0, moved: false,
  hovering: null, selected: null, downOnStele: null
};

const cardEl = document.getElementById('card');
const cardName = document.getElementById('card-name');
const cardPinyin = document.getElementById('card-pinyin');
const cardGroup = document.getElementById('card-group');
const cardIdx = document.getElementById('card-idx');
const cardSymbol = document.getElementById('card-symbol');
const cardDir = document.getElementById('card-dir');
const cardPlace = document.getElementById('card-place');
const cardSwatch = document.getElementById('card-swatch');
const cardClose = document.getElementById('card-close');

function setPointerFromEvent(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

function pickStele(e) {
  setPointerFromEvent(e);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(APP.steleMeshes, false);
  return hits.length ? hits[0].object.userData.mansion : null;
}

function openCard(m) {
  if (!m) return;
  pickState.selected = m;
  cardName.textContent = m.name;
  cardPinyin.textContent = m.pinyin;
  cardGroup.textContent = m.group;
  cardIdx.textContent = `其${m.localLabel} · 第 ${m.id} 宿`;
  cardSymbol.innerHTML = '';
  const sw = document.createElement('span');
  sw.className = 'swatch';
  sw.style.background = m.css;
  cardSymbol.appendChild(sw);
  cardSymbol.appendChild(document.createTextNode(m.group));
  cardDir.textContent = m.dir;
  cardPlace.textContent = m.place;
  cardEl.classList.add('open');
  cardEl.setAttribute('aria-hidden', 'false');

  // 选中反馈：碑体轻微提亮
  APP.steleRecords.forEach((r) => {
    if (r.mansion === m) {
      r.faceMat.emissiveIntensity = 0.28;
    }
  });
  if (APP.onSelect) APP.onSelect(m);
}

function closeCard() {
  pickState.selected = null;
  cardEl.classList.remove('open');
  cardEl.setAttribute('aria-hidden', 'true');
  APP.steleRecords.forEach((r) => {
    r.faceMat.emissiveIntensity = lerp(0, 0.62, APP.night.value);
  });
  if (APP.onSelect) APP.onSelect(null);
}

if (cardClose) cardClose.addEventListener('click', closeCard);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeCard();
});

/* --------------------------- 指针事件与拾取 ----------------------------- */
const canvas = renderer.domElement;

canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 && e.pointerType === 'mouse') return;
  pickState.downX = e.clientX;
  pickState.downY = e.clientY;
  pickState.downTime = performance.now();
  pickState.moved = false;
  canvas.classList.add('is-grabbing');
});

canvas.addEventListener('pointermove', (e) => {
  const dx = e.clientX - pickState.downX;
  const dy = e.clientY - pickState.downY;
  if (Math.hypot(dx, dy) > 6) pickState.moved = true;

  if (e.pointerType === 'mouse' && e.buttons === 0) {
    const m = pickStele(e);
    if (m !== pickState.hovering) {
      pickState.hovering = m;
      canvas.classList.toggle('is-hovering', !!m);
    }
  }
});

canvas.addEventListener('pointerup', (e) => {
  canvas.classList.remove('is-grabbing');
  const dt = performance.now() - pickState.downTime;
  const dist = Math.hypot(e.clientX - pickState.downX, e.clientY - pickState.downY);
  if (dist < 7 && dt < 700) {
    const m = pickStele(e);
    if (m) {
      openCard(m);
    } else if (pickState.selected) {
      // 点击空白处关闭，但不打断旋转
      closeCard();
    }
  }
});

canvas.addEventListener('pointercancel', () => {
  canvas.classList.remove('is-grabbing');
});

canvas.addEventListener('pointerleave', () => {
  canvas.classList.remove('is-grabbing');
  if (pickState.hovering) {
    pickState.hovering = null;
    canvas.classList.remove('is-hovering');
  }
});

/* 触屏：拖动时禁用拾取，避免误触 */
let lastTouchMove = 0;
canvas.addEventListener('touchmove', () => {
  lastTouchMove = performance.now();
}, { passive: true });

/* ------------------------------ 重置视角 -------------------------------- */
let resetTween = null;

function resetView(animated = true) {
  closeCard();
  if (!animated) {
    camera.position.copy(HOME_VIEW.position);
    controls.target.copy(HOME_VIEW.target);
    camera.fov = HOME_VIEW.fov;
    camera.updateProjectionMatrix();
    controls.update();
    return;
  }
  resetTween = {
    start: performance.now(),
    dur: 900,
    fromPos: camera.position.clone(),
    fromTarget: controls.target.clone(),
    fromFov: camera.fov
  };
}

const btnReset = document.getElementById('btn-reset');
if (btnReset) btnReset.addEventListener('click', () => resetView(true));

function updateResetTween(now) {
  if (!resetTween) return;
  const t = clamp((now - resetTween.start) / resetTween.dur, 0, 1);
  const e = easeInOutCubic(t);
  camera.position.lerpVectors(resetTween.fromPos, HOME_VIEW.position, e);
  controls.target.lerpVectors(resetTween.fromTarget, HOME_VIEW.target, e);
  camera.fov = lerp(resetTween.fromFov, HOME_VIEW.fov, e);
  camera.updateProjectionMatrix();
  if (t >= 1) resetTween = null;
}

/* ------------------------------ 窗口适配 -------------------------------- */
let resizeTimer = 0;
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  // 窄屏时适度增大 fov，保持主岛完整
  const targetFov = HOME_VIEW.fov + (w < 760 ? 8 : 0);
  if (!resetTween) {
    camera.fov = targetFov;
  }
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(w, h);
  if (APP.starUniforms) APP.starUniforms.uPixelRatio.value = renderer.getPixelRatio();
  if (APP.fireflyUniforms) APP.fireflyUniforms.uPixelRatio.value = renderer.getPixelRatio();
  // 移动端 UI
  document.body.classList.toggle('is-narrow', w < 760);
}
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(onResize, 80);
});
onResize();

/* 页面隐藏时暂停时钟积累，避免回来后跳帧 */
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) APP.clock.getDelta();
});
