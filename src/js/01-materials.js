/* =========================================================================
   01 · 程序化纹理与材质
   所有贴图均由 Canvas 生成；石材、铜器、木作与瓦面共用少量材质实例。
   ========================================================================= */

const CJK_SERIF = '"Songti SC","STSong","Noto Serif SC","Noto Serif CJK SC","SimSun",serif';
const CJK_SANS = '"Noto Sans SC","Microsoft YaHei","PingFang SC",sans-serif';

function makeCanvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function canvasTexture(canvas, { repeat = 1, srgb = true, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = Math.min(aniso, renderer.capabilities.getMaxAnisotropy());
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

function noiseFill(ctx, w, h, base, amp, scale, seed) {
  const rnd = rngFor(seed);
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const baseCol = new THREE.Color(base);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const n = fbm2(x * scale + seed * 3.7, y * scale - seed * 1.9, 4) - 0.5;
      const n2 = vnoise(x * scale * 7.1, y * scale * 7.1) - 0.5;
      const k = n * amp + n2 * amp * 0.28;
      d[i] = clamp((baseCol.r + k) * 255, 0, 255);
      d[i + 1] = clamp((baseCol.g + k * 0.96) * 255, 0, 255);
      d[i + 2] = clamp((baseCol.b + k * 0.88) * 255, 0, 255);
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return rnd;
}

/* ------------------------------- 石材 ----------------------------------- */
function makeStoneTexture(seed, base = '#b9b1a0', dark = '#6f695c') {
  const size = 512;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const rnd = noiseFill(ctx, size, size, base, 0.16, 0.014, seed);

  // 宽而淡的色斑，模拟风化与矿物色差
  for (let i = 0; i < 22; i++) {
    const x = rnd() * size, y = rnd() * size;
    const r = 20 + rnd() * 90;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const tone = rnd() > 0.5 ? '255,246,226' : '86,80,68';
    g.addColorStop(0, `rgba(${tone},${0.035 + rnd() * 0.05})`);
    g.addColorStop(1, `rgba(${tone},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // 细裂纹
  ctx.lineCap = 'round';
  for (let i = 0; i < 13; i++) {
    let x = rnd() * size, y = rnd() * size;
    let ang = rnd() * TAU;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const segs = 4 + Math.floor(rnd() * 7);
    for (let s = 0; s < segs; s++) {
      ang += (rnd() - 0.5) * 1.1;
      const len = 6 + rnd() * 26;
      x += Math.cos(ang) * len;
      y += Math.sin(ang) * len;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(74,68,58,${0.10 + rnd() * 0.14})`;
    ctx.lineWidth = 0.6 + rnd() * 1.2;
    ctx.stroke();
  }

  // 苔痕 / 水渍
  for (let i = 0; i < 26; i++) {
    const x = rnd() * size, y = rnd() * size;
    const r = 8 + rnd() * 34;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(92,110,74,${0.05 + rnd() * 0.10})`);
    g.addColorStop(1, 'rgba(92,110,74,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // 少量深色颗粒
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(${dark},${0.04 + rnd() * 0.12})`;
    const s = 0.5 + rnd() * 1.8;
    ctx.fillRect(rnd() * size, rnd() * size, s, s);
  }
  return c;
}

function makeRockTexture(seed) {
  const size = 512;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const rnd = noiseFill(ctx, size, size, '#8e8577', 0.19, 0.011, seed);
  // 水平层理
  for (let y = 0; y < size; y += 5 + rnd() * 13) {
    const dark = rnd() > 0.4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= size; x += 16) {
      ctx.lineTo(x, y + Math.sin(x * 0.03 + y) * 3 + (rnd() - 0.5) * 2.5);
    }
    ctx.strokeStyle = dark ? `rgba(64,59,51,${0.10 + rnd() * 0.14})` : `rgba(214,204,185,${0.05 + rnd() * 0.08})`;
    ctx.lineWidth = 0.7 + rnd() * 2.2;
    ctx.stroke();
  }
  for (let i = 0; i < 18; i++) {
    const x = rnd() * size, y = rnd() * size, r = 12 + rnd() * 50;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(96,108,72,${0.04 + rnd() * 0.08})`);
    g.addColorStop(1, 'rgba(96,108,72,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return c;
}

/* ------------------------------- 铜器 ----------------------------------- */
function makeBronzeTexture(seed) {
  const size = 512;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const rnd = noiseFill(ctx, size, size, '#7b5a33', 0.14, 0.02, seed);

  // 竖向锈迹与磨亮区
  for (let i = 0; i < 70; i++) {
    const x = rnd() * size;
    const w = 2 + rnd() * 22;
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    const green = rnd() > 0.45;
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.5, green
      ? `rgba(72,104,84,${0.05 + rnd() * 0.14})`
      : `rgba(206,166,98,${0.04 + rnd() * 0.12})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, w, size);
  }
  for (let i = 0; i < 140; i++) {
    ctx.fillStyle = rnd() > 0.5
      ? `rgba(214,178,112,${0.05 + rnd() * 0.16})`
      : `rgba(52,48,38,${0.05 + rnd() * 0.14})`;
    const s = 0.6 + rnd() * 2.6;
    ctx.fillRect(rnd() * size, rnd() * size, s, s);
  }
  return c;
}

/* ------------------------------- 瓦面 ----------------------------------- */
function makeRoofTexture(seed) {
  const w = 256, h = 512;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rnd = noiseFill(ctx, w, h, '#59616a', 0.10, 0.02, seed);
  // 筒瓦竖棱
  const cols = 16;
  const cw = w / cols;
  for (let i = 0; i < cols; i++) {
    const x = i * cw;
    const g = ctx.createLinearGradient(x, 0, x + cw, 0);
    g.addColorStop(0, 'rgba(28,32,36,.30)');
    g.addColorStop(0.35, 'rgba(168,176,182,.20)');
    g.addColorStop(0.62, 'rgba(112,120,126,.05)');
    g.addColorStop(1, 'rgba(24,28,32,.34)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, cw, h);
  }
  // 横向瓦垄
  const rows = 26;
  for (let j = 0; j < rows; j++) {
    const y = (j + 0.5) * (h / rows);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.strokeStyle = `rgba(30,34,38,${0.12 + rnd() * 0.10})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, y + 2);
    ctx.lineTo(w, y + 2);
    ctx.strokeStyle = 'rgba(190,198,202,.06)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // 零星苔点
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(92,110,78,${0.05 + rnd() * 0.10})`;
    ctx.beginPath();
    ctx.arc(rnd() * w, rnd() * h, 1 + rnd() * 6, 0, TAU);
    ctx.fill();
  }
  return c;
}

/* ------------------------------- 木纹 ----------------------------------- */
function makeWoodTexture(seed) {
  const w = 256, h = 512;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rnd = noiseFill(ctx, w, h, '#6a4c34', 0.11, 0.02, seed);
  for (let i = 0; i < 48; i++) {
    const x = rnd() * w;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let y = 0; y <= h; y += 18) {
      ctx.lineTo(x + Math.sin(y * 0.02 + i) * 4 + (rnd() - 0.5) * 2, y);
    }
    ctx.strokeStyle = rnd() > 0.5
      ? `rgba(40,26,16,${0.08 + rnd() * 0.14})`
      : `rgba(160,122,84,${0.05 + rnd() * 0.09})`;
    ctx.lineWidth = 0.7 + rnd() * 2;
    ctx.stroke();
  }
  return c;
}

/* ------------------------------- 光晕 ----------------------------------- */
function makeGlowTexture(inner = 'rgba(255,238,200,1)', outer = 'rgba(255,196,120,0)') {
  const size = 128;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.18, inner);
  g.addColorStop(0.5, outer.replace('0)', '0.35)'));
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

function makeCloudTexture(seed) {
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const rnd = rngFor(seed);
  ctx.clearRect(0, 0, size, size);
  const blobs = 16;
  for (let i = 0; i < blobs; i++) {
    const ang = rnd() * TAU;
    const rad = Math.pow(rnd(), 0.6) * size * 0.24;
    const x = size / 2 + Math.cos(ang) * rad;
    const y = size / 2 + Math.sin(ang) * rad * 0.55;
    const r = size * (0.12 + rnd() * 0.20);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,.30)');
    g.addColorStop(0.45, 'rgba(255,255,255,.16)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return c;
}

function makeLeafTexture(seed, hue = '76,102,62') {
  const size = 128;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const rnd = rngFor(seed);
  ctx.clearRect(0, 0, size, size);
  // 竹叶：细长披针形
  for (let i = 0; i < 5; i++) {
    const cx = 20 + rnd() * 88;
    const cy = 20 + rnd() * 88;
    const len = 40 + rnd() * 50;
    const ang = -0.9 + rnd() * 1.8;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    const g = ctx.createLinearGradient(0, 0, len, 0);
    g.addColorStop(0, `rgba(${hue},0)`);
    g.addColorStop(0.25, `rgba(${hue},.95)`);
    g.addColorStop(0.7, `rgba(${hue},.85)`);
    g.addColorStop(1, `rgba(${hue},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.45, -6.5, len, 0);
    ctx.quadraticCurveTo(len * 0.45, 6.5, 0, 0);
    ctx.fill();
    ctx.strokeStyle = `rgba(${hue},.55)`;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(2, 0);
    ctx.lineTo(len - 4, 0);
    ctx.stroke();
    ctx.restore();
  }
  return c;
}

/* --------------------------- 四象纹样（线描） ---------------------------- */
function drawMotif(ctx, motif, color, w, h, lineWidth = 3, alpha = 1) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const cx = w / 2, cy = h / 2;
  const S = Math.min(w, h) / 2;

  if (motif === 'dragon') {
    // 云龙：一条 S 形身躯 + 头角 + 四足 + 鳞纹
    ctx.beginPath();
    for (let i = 0; i <= 80; i++) {
      const t = i / 80;
      const ang = t * Math.PI * 2.35 - 0.6;
      const rr = S * (0.16 + 0.52 * t);
      const x = cx + Math.cos(ang) * rr * 1.15;
      const y = cy + Math.sin(ang) * rr * 0.86 - S * 0.1 * (1 - t);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // 头
    ctx.beginPath();
    ctx.ellipse(cx + S * 0.60, cy - S * 0.36, S * 0.16, S * 0.11, -0.5, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + S * 0.72, cy - S * 0.44);
    ctx.lineTo(cx + S * 0.86, cy - S * 0.56);
    ctx.moveTo(cx + S * 0.70, cy - S * 0.36);
    ctx.lineTo(cx + S * 0.88, cy - S * 0.42);
    ctx.stroke();
    // 鳞
    for (let i = 0; i < 9; i++) {
      const t = 0.18 + i * 0.08;
      const ang = t * Math.PI * 2.35 - 0.6;
      const rr = S * (0.16 + 0.52 * t);
      const x = cx + Math.cos(ang) * rr * 1.15;
      const y = cy + Math.sin(ang) * rr * 0.86;
      ctx.beginPath();
      ctx.arc(x, y, S * 0.045, ang + 0.7, ang + 2.4);
      ctx.stroke();
    }
    // 足
    for (const [px, py, dx, dy] of [[0.10, 0.55, 0.26, 0.30], [0.72, 0.50, 0.22, -0.28], [0.40, 0.10, -0.28, 0.26]]) {
      ctx.beginPath();
      ctx.moveTo(cx + S * px, cy + S * py);
      ctx.lineTo(cx + S * (px + dx), cy + S * (py + dy));
      ctx.lineTo(cx + S * (px + dx * 1.35), cy + S * (py + dy * 1.1));
      ctx.stroke();
    }
  } else if (motif === 'tiger') {
    // 虎：低伏的脊线与三道虎纹 + 首
    ctx.beginPath();
    ctx.moveTo(cx - S * 0.86, cy + S * 0.26);
    ctx.bezierCurveTo(cx - S * 0.45, cy - S * 0.30, cx + S * 0.20, cy - S * 0.34, cx + S * 0.62, cy + S * 0.02);
    ctx.bezierCurveTo(cx + S * 0.74, cy + S * 0.12, cx + S * 0.80, cy + S * 0.18, cx + S * 0.86, cy + S * 0.30);
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const t = 0.16 + i * 0.14;
      const x = cx - S * 0.86 + t * S * 1.6;
      const y = cy + S * 0.10 - Math.sin(t * 2.4) * S * 0.18;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + S * 0.03, y + S * 0.18, x - S * 0.02, y + S * 0.30);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx + S * 0.82, cy + S * 0.34, S * 0.12, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + S * 0.72, cy + S * 0.30);
    ctx.lineTo(cx + S * 0.66, cy + S * 0.42);
    ctx.moveTo(cx + S * 0.78, cy + S * 0.25);
    ctx.lineTo(cx + S * 0.74, cy + S * 0.38);
    ctx.stroke();
    // 尾部
    ctx.beginPath();
    ctx.moveTo(cx - S * 0.86, cy + S * 0.26);
    ctx.quadraticCurveTo(cx - S * 1.0, cy + S * 0.02, cx - S * 0.9, cy - S * 0.22);
    ctx.stroke();
  } else if (motif === 'bird') {
    // 朱雀：展翼 + 长尾
    ctx.beginPath();
    ctx.moveTo(cx, cy + S * 0.10);
    ctx.quadraticCurveTo(cx - S * 0.40, cy - S * 0.62, cx - S * 0.94, cy - S * 0.34);
    ctx.quadraticCurveTo(cx - S * 0.52, cy - S * 0.20, cx - S * 0.30, cy + S * 0.16);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy + S * 0.10);
    ctx.quadraticCurveTo(cx + S * 0.40, cy - S * 0.62, cx + S * 0.94, cy - S * 0.34);
    ctx.quadraticCurveTo(cx + S * 0.52, cy - S * 0.20, cx + S * 0.30, cy + S * 0.16);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + (i - 1) * S * 0.05, cy + S * 0.16);
      ctx.quadraticCurveTo(cx + (i - 1) * S * 0.12, cy + S * 0.55, cx + (i - 1) * S * 0.28, cy + S * 0.82);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy + S * 0.02, S * 0.11, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + S * 0.10, cy - S * 0.02);
    ctx.lineTo(cx + S * 0.24, cy - S * 0.08);
    ctx.stroke();
    // 羽
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - S * (0.30 + i * 0.13), cy - S * (0.10 + i * 0.04));
      ctx.quadraticCurveTo(cx - S * (0.44 + i * 0.10), cy - S * 0.34, cx - S * (0.60 + i * 0.09), cy - S * 0.30);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + S * (0.30 + i * 0.13), cy - S * (0.10 + i * 0.04));
      ctx.quadraticCurveTo(cx + S * (0.44 + i * 0.10), cy - S * 0.34, cx + S * (0.60 + i * 0.09), cy - S * 0.30);
      ctx.stroke();
    }
  } else if (motif === 'turtle') {
    // 玄武：龟甲 + 缠绕的蛇
    ctx.beginPath();
    ctx.ellipse(cx, cy + S * 0.16, S * 0.52, S * 0.38, 0, 0, TAU);
    ctx.stroke();
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * S * 0.19, cy - S * 0.20);
      ctx.lineTo(cx + i * S * 0.19, cy + S * 0.54);
      ctx.stroke();
    }
    for (let j = 0; j < 3; j++) {
      ctx.beginPath();
      ctx.moveTo(cx - S * 0.48, cy + S * (0.02 + j * 0.16));
      ctx.lineTo(cx + S * 0.48, cy + S * (0.02 + j * 0.16));
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx - S * 0.52, cy + S * 0.18);
    ctx.lineTo(cx - S * 0.76, cy + S * 0.26);
    ctx.lineTo(cx - S * 0.80, cy + S * 0.10);
    ctx.moveTo(cx + S * 0.52, cy + S * 0.18);
    ctx.lineTo(cx + S * 0.76, cy + S * 0.26);
    ctx.lineTo(cx + S * 0.80, cy + S * 0.10);
    ctx.stroke();
    // 蛇
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const x = cx + Math.sin(t * Math.PI * 3.2 + 1.2) * S * 0.62;
      const y = cy + S * 0.74 - t * S * 1.15;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + Math.sin(Math.PI * 3.2 + 1.2) * S * 0.62, cy - S * 0.41, S * 0.07, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

function makeMotifTexture(motif, color, { size = 512, bg = null, lineWidth = 3, alpha = 1 } = {}) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);
  }
  drawMotif(ctx, motif, color, size, size, lineWidth, alpha);
  return c;
}

/* ------------------------------- 碑面 ----------------------------------- */
function makeSteleTexture(mansion, courtyard, night = false) {
  const W = 512, H = 1024;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const rnd = rngFor(700 + mansion.id);

  const base = new THREE.Color(courtyard.stoneTint);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#' + base.clone().offsetHSL(0, -0.03, 0.07).getHexString());
  g.addColorStop(0.55, '#' + base.getHexString());
  g.addColorStop(1, '#' + base.clone().offsetHSL(0, 0.02, -0.06).getHexString());
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // 石面斑驳
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(${rnd() > 0.5 ? '255,250,236' : '52,48,42'},${0.012 + rnd() * 0.035})`;
    const r = 4 + rnd() * 36;
    ctx.beginPath();
    ctx.arc(rnd() * W, rnd() * H, r, 0, TAU);
    ctx.fill();
  }

  // 边框：双线 + 回纹角
  const pad = 42;
  ctx.strokeStyle = 'rgba(58,50,38,.55)';
  ctx.lineWidth = 3;
  ctx.strokeRect(pad, pad, W - pad * 2, H - pad * 2);
  ctx.strokeStyle = 'rgba(58,50,38,.26)';
  ctx.lineWidth = 1.4;
  ctx.strokeRect(pad + 13, pad + 13, W - (pad + 13) * 2, H - (pad + 13) * 2);

  ctx.save();
  ctx.translate(W / 2, pad + 88);
  for (let q = 0; q < 4; q++) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(-18, -18);
    ctx.lineTo(18, -18);
    ctx.strokeStyle = 'rgba(58,50,38,.34)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();

  // 淡纹样水印
  ctx.save();
  ctx.globalAlpha = 0.10;
  drawMotif(ctx, courtyard.motif, '#2c2a24', W * 0.62, W * 0.62, 3, 1);
  ctx.restore();

  // 宿名
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = night ? 'rgba(250,235,198,.98)' : 'rgba(44,38,30,.92)';
  ctx.shadowColor = night ? 'rgba(255,214,150,.85)' : 'rgba(0,0,0,.18)';
  ctx.shadowBlur = night ? 26 : 3;
  ctx.font = `600 ${mansion.name.length > 1 ? 200 : 250}px ${CJK_SERIF}`;
  ctx.fillText(mansion.name, W / 2, H * 0.44);

  // 拼音
  ctx.shadowBlur = 0;
  ctx.fillStyle = night ? 'rgba(244,226,190,.72)' : 'rgba(62,54,42,.66)';
  ctx.font = `300 34px ${CJK_SANS}`;
  ctx.fillText(mansion.pinyin.toUpperCase(), W / 2, H * 0.44 + 176);

  // 所属四象
  ctx.fillStyle = night ? 'rgba(246,230,198,.88)' : 'rgba(56,48,38,.8)';
  ctx.font = `400 40px ${CJK_SERIF}`;
  ctx.fillText(courtyard.group, W / 2, H * 0.72);

  // 七宿序号（点）
  const dotY = H * 0.80;
  for (let i = 0; i < 7; i++) {
    const x = W / 2 + (i - 3) * 42;
    ctx.beginPath();
    ctx.arc(x, dotY, i === mansion.localIndex ? 7.5 : 3.6, 0, TAU);
    ctx.fillStyle = i === mansion.localIndex
      ? (night ? 'rgba(255,220,158,.96)' : 'rgba(58,48,34,.9)')
      : (night ? 'rgba(238,218,180,.30)' : 'rgba(58,48,34,.24)');
    ctx.fill();
  }

  // 底注
  ctx.fillStyle = night ? 'rgba(240,224,192,.55)' : 'rgba(64,56,44,.56)';
  ctx.font = `300 27px ${CJK_SERIF}`;
  ctx.fillText('其七之一 · 非单颗恒星', W / 2, H * 0.885);

  return c;
}

/* ------------------------------- 匾额 ----------------------------------- */
function makePlaqueTexture(text, sub = '') {
  const W = 512, H = 192;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#4a3524');
  g.addColorStop(0.5, '#3a291b');
  g.addColorStop(1, '#2b1e14');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(198,160,96,.85)';
  ctx.lineWidth = 4;
  ctx.strokeRect(9, 9, W - 18, H - 18);
  ctx.strokeStyle = 'rgba(198,160,96,.35)';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(17, 17, W - 34, H - 34);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(230,198,132,.96)';
  ctx.font = `600 ${sub ? 72 : 84}px ${CJK_SERIF}`;
  ctx.fillText(text, W / 2, sub ? H * 0.43 : H * 0.5);
  if (sub) {
    ctx.fillStyle = 'rgba(214,182,122,.62)';
    ctx.font = `300 24px ${CJK_SANS}`;
    ctx.fillText(sub, W / 2, H * 0.76);
  }
  return c;
}

/* --------------------------- 纹理实例（共享） ---------------------------- */
const TEX = {
  stone: canvasTexture(makeStoneTexture(11, '#bbb3a2'), { repeat: 2 }),
  stoneDark: canvasTexture(makeStoneTexture(23, '#8d887c', '#4f4b42'), { repeat: 2 }),
  rock: canvasTexture(makeRockTexture(31), { repeat: 2 }),
  bronze: canvasTexture(makeBronzeTexture(41), { repeat: 2 }),
  roof: canvasTexture(makeRoofTexture(51), { repeat: 1 }),
  wood: canvasTexture(makeWoodTexture(61), { repeat: 1 }),
  glowWarm: canvasTexture(makeGlowTexture('rgba(255,240,208,1)', 'rgba(255,190,112,0)'), { srgb: true }),
  glowCool: canvasTexture(makeGlowTexture('rgba(214,232,255,1)', 'rgba(130,168,220,0)'), { srgb: true }),
  cloud: [canvasTexture(makeCloudTexture(71)), canvasTexture(makeCloudTexture(72)), canvasTexture(makeCloudTexture(73))],
  leafBamboo: canvasTexture(makeLeafTexture(81, '88,112,66')),
  leafPine: canvasTexture(makeLeafTexture(82, '66,88,62'))
};

/* ------------------------------ 着色器补丁 ------------------------------ */
const GLSL_NOISE = /* glsl */`
float stHash(vec3 p){
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float stNoise(vec3 x){
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(stHash(i + vec3(0,0,0)), stHash(i + vec3(1,0,0)), f.x),
        mix(stHash(i + vec3(0,1,0)), stHash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(stHash(i + vec3(0,0,1)), stHash(i + vec3(1,0,1)), f.x),
        mix(stHash(i + vec3(0,1,1)), stHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float stFbm(vec3 p){
  float a = 0.5, s = 0.0, n = 0.0;
  for (int i = 0; i < 3; i++) {
    s += a * stNoise(p);
    n += a;
    p = p * 2.03 + vec3(11.3, 7.7, 5.1);
    a *= 0.5;
  }
  return s / n;
}
`;

/**
 * 在世界空间为石材/岩体叠加细粒噪声、层理与潮湿暗部。
 * 不依赖 UV，因此合并后的几何体不会出现拉伸接缝。
 */
function withSurfaceDetail(material, {
  scale = 0.18,
  colorJitter = 0.055,
  strata = 0.0,
  wet = 0.0,
  grainRough = 0.08,
  sparkle = 0.0
} = {}) {
  const uniforms = {
    uDetailScale: { value: scale },
    uColorJitter: { value: colorJitter },
    uStrata: { value: strata },
    uWet: { value: wet },
    uGrainRough: { value: grainRough },
    uSparkle: { value: sparkle }
  };
  material.userData.detailUniforms = uniforms;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
varying vec3 vStWorld;
varying vec3 vStNormalW;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
{
  vec4 stW = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    stW = instanceMatrix * stW;
  #endif
  stW = modelMatrix * stW;
  vStWorld = stW.xyz;
  vStNormalW = normalize(mat3(modelMatrix) * objectNormal);
}`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vStWorld;
varying vec3 vStNormalW;
uniform float uDetailScale;
uniform float uColorJitter;
uniform float uStrata;
uniform float uWet;
uniform float uGrainRough;
uniform float uSparkle;
${GLSL_NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec3 p = vStWorld * uDetailScale;
  float n = stFbm(p * 1.7);
  float n2 = stNoise(p * 9.0);
  float strataBand = sin(vStWorld.y * 1.35 + stNoise(p * 0.55) * 7.0);
  float strataMask = uStrata * (0.5 + 0.5 * strataBand);
  float shade = (n - 0.5) * uColorJitter * 2.0 + (n2 - 0.5) * 0.035;
  shade -= strataMask * 0.055;
  // 朝下的面更暗、更湿
  float down = clamp(-vStNormalW.y, 0.0, 1.0);
  shade -= down * uWet * 0.16;
  diffuseColor.rgb *= (1.0 + shade);
  // 高处受光轻微泛暖
  diffuseColor.rgb += vec3(0.025, 0.018, 0.010) * clamp(vStNormalW.y, 0.0, 1.0) * n;
  if (uSparkle > 0.0) {
    float sp = step(0.93, stNoise(p * 28.0));
    diffuseColor.rgb += vec3(0.16, 0.15, 0.13) * sp * uSparkle;
  }
}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
{
  float rn = stFbm(vStWorld * uDetailScale * 4.1);
  roughnessFactor = clamp(roughnessFactor + (rn - 0.5) * uGrainRough - uWet * 0.18 * clamp(-vStNormalW.y, 0.0, 1.0), 0.04, 1.0);
}`);
  };
  material.customProgramCacheKey = () => 'st-detail-' + scale + '-' + strata + '-' + wet;
  return material;
}

/* ------------------------------ 材质实例 -------------------------------- */
const MAT = {};

MAT.stone = withSurfaceDetail(new THREE.MeshStandardMaterial({
  color: 0xffffff,
  vertexColors: true,
  map: TEX.stone,
  bumpMap: TEX.stone,
  bumpScale: 0.12,
  roughness: 0.93,
  metalness: 0.0
}), { scale: 0.16, colorJitter: 0.05, strata: 0.25, wet: 0.55, grainRough: 0.10 });

MAT.stoneDark = withSurfaceDetail(new THREE.MeshStandardMaterial({
  color: 0xffffff,
  vertexColors: true,
  map: TEX.stoneDark,
  bumpMap: TEX.stoneDark,
  bumpScale: 0.14,
  roughness: 0.95,
  metalness: 0.0
}), { scale: 0.15, colorJitter: 0.06, strata: 0.35, wet: 0.8, grainRough: 0.12 });

MAT.rock = withSurfaceDetail(new THREE.MeshStandardMaterial({
  color: 0xffffff,
  vertexColors: true,
  map: TEX.rock,
  bumpMap: TEX.rock,
  bumpScale: 0.22,
  roughness: 0.97,
  metalness: 0.0
}), { scale: 0.085, colorJitter: 0.10, strata: 0.9, wet: 0.55, grainRough: 0.10, sparkle: 0.25 });

MAT.bronze = withSurfaceDetail(new THREE.MeshStandardMaterial({
  color: 0xffffff,
  vertexColors: true,
  map: TEX.bronze,
  metalness: 0.82,
  roughness: 0.42,
  envMapIntensity: 0.7,
  emissive: new THREE.Color(0x2a1a08),
  emissiveIntensity: 0.0
}), { scale: 0.5, colorJitter: 0.06, strata: 0.0, wet: 0.1, grainRough: 0.16 });

MAT.gold = withSurfaceDetail(new THREE.MeshStandardMaterial({
  color: 0xffffff,
  vertexColors: true,
  metalness: 0.9,
  roughness: 0.28,
  emissive: new THREE.Color(0x3a2408),
  emissiveIntensity: 0.0
}), { scale: 1.2, colorJitter: 0.03, strata: 0.0, wet: 0.0, grainRough: 0.05 });

MAT.wood = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  vertexColors: true,
  map: TEX.wood,
  roughness: 0.78,
  metalness: 0.0
});

MAT.roof = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  vertexColors: true,
  map: TEX.roof,
  roughness: 0.72,
  metalness: 0.06,
  side: THREE.DoubleSide
});

MAT.plaster = withSurfaceDetail(new THREE.MeshStandardMaterial({
  color: 0xffffff,
  vertexColors: true,
  roughness: 0.94,
  metalness: 0.0
}), { scale: 0.3, colorJitter: 0.045, strata: 0.0, wet: 0.3, grainRough: 0.07 });

MAT.lacquer = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  vertexColors: true,
  roughness: 0.48,
  metalness: 0.04
});

MAT.foliage = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  vertexColors: true,
  roughness: 0.86,
  metalness: 0.0,
  flatShading: true,
  side: THREE.DoubleSide
});

MAT.foliageSoft = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  vertexColors: true,
  roughness: 0.9,
  metalness: 0.0,
  side: THREE.DoubleSide
});

MAT.leafCard = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  map: TEX.leafBamboo,
  alphaTest: 0.42,
  transparent: false,
  roughness: 0.85,
  metalness: 0.0,
  side: THREE.DoubleSide,
  vertexColors: true
});

MAT.leafPine = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  map: TEX.leafPine,
  alphaTest: 0.4,
  roughness: 0.88,
  metalness: 0.0,
  side: THREE.DoubleSide,
  vertexColors: true
});

MAT.stele = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  vertexColors: true,
  roughness: 0.9,
  metalness: 0.02,
  emissive: new THREE.Color(0xffca88),
  emissiveIntensity: 0.0
});

MAT.lanternGlow = new THREE.MeshBasicMaterial({
  color: 0xffd9a0,
  transparent: true,
  opacity: 0.0,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide
});

MAT.water = new THREE.MeshStandardMaterial({
  color: 0x2f5c62,
  roughness: 0.08,
  metalness: 0.12,
  transparent: true,
  opacity: 0.86,
  envMapIntensity: 0.9,
  depthWrite: false
});

MAT.glassDark = new THREE.MeshStandardMaterial({
  color: 0x1b2529,
  roughness: 0.35,
  metalness: 0.2
});

/* 夜间自发光材质登记（统一由昼夜系统调节） */
APP.emissiveMats.push(
  { mat: MAT.bronze, day: 0.0, night: 0.24 },
  { mat: MAT.gold, day: 0.0, night: 0.5 }
);
