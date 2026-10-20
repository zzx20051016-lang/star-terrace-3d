/**
 * 无头 Chrome 检查脚本（CDP）。
 * 用法：
 *   node scripts/check.mjs --url http://127.0.0.1:8177/ --out previews/check
 * 功能：加载页面、收集控制台错误、截图、模拟交互。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9333;

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const URL = arg('--url', 'http://127.0.0.1:8177/');
const OUT = path.resolve(arg('--out', 'previews/check'));
const WIDTH = Number(arg('--width', 1600));
const HEIGHT = Number(arg('--height', 900));
const DPR = Number(arg('--dpr', 1));
const MODE = arg('--mode', 'all');
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method && this.events.has(msg.method)) {
        for (const fn of this.events.get(msg.method)) fn(msg.params);
      }
    });
  }
  on(method, fn) {
    if (!this.events.has(method)) this.events.set(method, []);
    this.events.get(method).push(fn);
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

async function waitForDevtools() {
  for (let i = 0; i < 160; i++) {
    try {
      return await getJson(`http://127.0.0.1:${PORT}/json/version`);
    } catch {
      await sleep(250);
    }
  }
  throw new Error('Chrome DevTools did not start');
}

const profile = path.resolve('.chrome-check-profile');
fs.rmSync(profile, { recursive: true, force: true });

const chrome = spawn(CHROME, [
  '--headless=new',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  '--hide-scrollbars',
  '--mute-audio',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--disable-gpu-sandbox',
  `--window-size=${WIDTH},${HEIGHT}`,
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  'about:blank'
], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });

let chromeStderr = '';
chrome.stderr.on('data', (d) => {
  chromeStderr += d.toString();
  if (chromeStderr.length > 12000) chromeStderr = chromeStderr.slice(-8000);
});

const consoleMessages = [];
const pageErrors = [];
const requestFailures = [];

try {
  await waitForDevtools();
  const pages = await getJson(`http://127.0.0.1:${PORT}/json/list`);
  const page = pages.find((p) => p.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  const cdp = new CDP(ws);
  cdp.on('Runtime.consoleAPICalled', (p) => {
    const text = (p.args || []).map((a) => a.value ?? a.description ?? a.type).join(' ');
    consoleMessages.push({ type: p.type, text });
  });
  cdp.on('Runtime.exceptionThrown', (p) => {
    const d = p.exceptionDetails;
    pageErrors.push(d.exception ? (d.exception.description || d.exception.value) : d.text);
  });
  cdp.on('Log.entryAdded', (p) => {
    if (p.entry.level === 'error') consoleMessages.push({ type: 'log-error', text: p.entry.text });
  });
  cdp.on('Network.loadingFailed', (p) => {
    requestFailures.push(p.errorText);
  });

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  await cdp.send('Network.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: WIDTH, height: HEIGHT, deviceScaleFactor: DPR, mobile: false,
    screenWidth: WIDTH, screenHeight: HEIGHT
  });
  await cdp.send('Emulation.setScrollbarsHidden', { hidden: true });
  await cdp.send('Page.navigate', { url: URL });

  let ready = false;
  for (let i = 0; i < 200; i++) {
    await sleep(250);
    const r = await cdp.send('Runtime.evaluate', {
      expression: 'Boolean(window.__READY__)', returnByValue: true
    });
    if (r.result && r.result.value === true) { ready = true; break; }
  }
  const bootInfo = await cdp.send('Runtime.evaluate', {
    expression: `JSON.stringify({
      ready: Boolean(window.__READY__),
      fatal: document.getElementById('fatal') ? !document.getElementById('fatal').hidden : null,
      fatalMsg: document.getElementById('fatal-msg') ? document.getElementById('fatal-msg').textContent : '',
      hasScene: Boolean(window.__SCENE__),
      mansions: window.__SCENE__ ? window.__SCENE__.mansions.length : -1,
      canvas: (() => { const c = document.querySelector('#stage canvas'); return c ? [c.width, c.height] : null; })()
    })`,
    returnByValue: true
  });
  console.log('BOOT', bootInfo.result.value);

  const shot = async (name) => {
    const s = await cdp.send('Page.captureScreenshot', {
      format: 'png', fromSurface: true, captureBeyondViewport: false
    });
    fs.writeFileSync(path.join(OUT, name), Buffer.from(s.data, 'base64'));
    console.log('shot', name);
  };

  const evalJs = async (expr, awaitPromise = false) => {
    const r = await cdp.send('Runtime.evaluate', {
      expression: expr, returnByValue: true, awaitPromise
    });
    if (r.exceptionDetails) {
      console.log('EVAL ERROR', JSON.stringify(r.exceptionDetails).slice(0, 800));
    }
    return r.result ? r.result.value : undefined;
  };

  await sleep(1800);
  await shot('01-day.png');

  if (MODE === 'all') {
    // 切换到夜晚
    await evalJs(`window.__SCENE__.setNight(true); 'ok'`);
    await sleep(3400);
    await shot('02-night.png');

    // 点开第一枚碑
    const pick = await evalJs(`(async () => {
      const s = window.__SCENE__;
      const m = s.mansions[0];
      s.openCard(m);
      return m.name + '/' + m.group;
    })()`, true);
    console.log('OPEN CARD', pick);
    await sleep(600);
    await shot('03-card-night.png');

    // 检查信息卡文本
    const cardText = await evalJs(`document.getElementById('card').innerText`);
    console.log('CARD TEXT', JSON.stringify(cardText));

    // 关闭卡片，回到白天，重置视角
    await evalJs(`window.__SCENE__.closeCard(); window.__SCENE__.setNight(false); window.__SCENE__.resetView(false); 'ok'`);
    await sleep(3400);
    await shot('04-day-reset.png');

    // 旋转视角：模拟拖动
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: WIDTH * 0.5, y: HEIGHT * 0.5, button: 'left', clickCount: 1 });
    for (let i = 1; i <= 12; i++) {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: WIDTH * 0.5 + i * 14, y: HEIGHT * 0.5 - i * 3, button: 'left' });
      await sleep(16);
    }
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: WIDTH * 0.5 + 168, y: HEIGHT * 0.5 - 36, button: 'left', clickCount: 1 });
    await sleep(900);
    await shot('05-rotated.png');

    const camState = await evalJs(`JSON.stringify({
      pos: window.__SCENE__.camera.position.toArray().map(v=>+v.toFixed(2)),
      target: window.__SCENE__.controls.target.toArray().map(v=>+v.toFixed(2)),
      cardOpen: document.getElementById('card').classList.contains('open')
    })`);
    console.log('CAM', camState);

    // 窄窗口检查
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 430, height: 860, deviceScaleFactor: 1, mobile: true,
      screenWidth: 430, screenHeight: 860
    });
    await sleep(1200);
    await shot('06-narrow.png');
    const narrow = await evalJs(`JSON.stringify({
      canvas: (()=>{const c=document.querySelector('#stage canvas');return [c.clientWidth,c.clientHeight,c.width,c.height]})(),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    })`);
    console.log('NARROW', narrow);
  }

  const perf = await evalJs(`JSON.stringify(window.__SCENE__ ? {
    fps: window.__SCENE__.app.quality.level,
    calls: window.__SCENE__.renderer.info.render.calls,
    tris: window.__SCENE__.renderer.info.render.triangles,
    programs: window.__SCENE__.renderer.info.programs.length,
    geometries: window.__SCENE__.renderer.info.memory.geometries,
    textures: window.__SCENE__.renderer.info.memory.textures
  } : null)`);
  console.log('PERF', perf);

  console.log('CONSOLE', JSON.stringify(consoleMessages.slice(0, 40), null, 1));
  console.log('PAGE ERRORS', JSON.stringify(pageErrors.slice(0, 20), null, 1));
  console.log('REQ FAILURES', JSON.stringify(requestFailures.slice(0, 10)));
  console.log('READY', ready);
  ws.close();
} finally {
  chrome.kill();
  await sleep(600);
}
