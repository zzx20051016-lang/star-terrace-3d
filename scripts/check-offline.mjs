/**
 * 离线可用性验证：在 CDP 层拦截所有非本机请求，确认场景仍能启动。
 * 用法：node scripts/check-offline.mjs --url http://127.0.0.1:8220/
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, def) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
};

const TARGET_URL = arg('--url', 'http://127.0.0.1:8220/');
const OUT = arg('--out', 'previews/offline');
const PORT = 9411 + Math.floor(Math.random() * 60);

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
];
const chromePath = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
if (!chromePath) {
  console.error('未找到 Chrome / Edge');
  process.exit(2);
}

const profile = path.resolve('.chrome-offline-profile');
fs.mkdirSync(profile, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const chrome = spawn(chromePath, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--headless=new',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--use-gl=swiftshader',
  '--enable-unsafe-swiftshader',
  '--hide-scrollbars',
  '--window-size=1440,810',
  'about:blank'
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  const res = await fetch(url);
  return res.json();
}

async function waitForCdp() {
  for (let i = 0; i < 60; i++) {
    try {
      return await getJson(`http://127.0.0.1:${PORT}/json/version`);
    } catch {
      await sleep(250);
    }
  }
  throw new Error('CDP 未就绪');
}

function makeCdp(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    const handlers = new Map();
    ws.onopen = () => resolve({
      send(method, params = {}) {
        return new Promise((res, rej) => {
          const mid = ++id;
          pending.set(mid, { res, rej });
          ws.send(JSON.stringify({ id: mid, method, params }));
        });
      },
      on(evt, fn) {
        if (!handlers.has(evt)) handlers.set(evt, []);
        handlers.get(evt).push(fn);
      },
      close() { ws.close(); }
    });
    ws.onerror = (e) => reject(e);
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
      } else if (msg.method && handlers.has(msg.method)) {
        for (const fn of handlers.get(msg.method)) fn(msg.params);
      }
    };
  });
}

const blocked = [];
const failed = [];

try {
  await waitForCdp();
  const pages = await getJson(`http://127.0.0.1:${PORT}/json/list`);
  const page = pages.find((p) => p.type === 'page');
  const cdp = await makeCdp(page.webSocketDebuggerUrl);

  await cdp.send('Network.enable');
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  // 关键：只放行本机，其余全部拦截，模拟外网完全不可用
  await cdp.send('Fetch.enable', {
    patterns: [{ urlPattern: '*', requestStage: 'Request' }]
  });
  cdp.on('Fetch.requestPaused', async (p) => {
    const u = p.request.url;
    const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(u);
    try {
      if (isLocal) {
        await cdp.send('Fetch.continueRequest', { requestId: p.requestId });
      } else {
        blocked.push(u);
        await cdp.send('Fetch.failRequest', { requestId: p.requestId, errorReason: 'InternetDisconnected' });
      }
    } catch { /* 已取消 */ }
  });

  cdp.on('Network.requestWillBeSent', (p) => {
    const u = p.request.url;
    if (!/^https?:\/\/(127\.0\.0\.1|localhost)/.test(u) && !u.startsWith('data:') && !u.startsWith('blob:')) {
      blocked.push(u);
    }
  });
  cdp.on('Network.loadingFailed', (p) => {
    if (p.blockedReason || p.errorText) failed.push(`${p.blockedReason || ''} ${p.errorText || ''}`.trim());
  });

  await cdp.send('Page.navigate', { url: TARGET_URL });

  let boot = null;
  for (let i = 0; i < 80; i++) {
    await sleep(250);
    try {
      const r = await cdp.send('Runtime.evaluate', {
        expression: 'JSON.stringify({ready:!!window.__READY__,boot:!!window.__BOOT__,fatal:document.getElementById("fatal")&&!document.getElementById("fatal").hidden,mansions:(window.__SCENE__&&window.__SCENE__.mansions&&window.__SCENE__.mansions.length)||-1})',
        returnByValue: true
      });
      boot = JSON.parse(r.result.value);
      if (boot.ready || boot.fatal) break;
    } catch { /* 页面尚未就绪 */ }
  }

  await sleep(1500);
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, '01-offline.png'), Buffer.from(shot.data, 'base64'));

  console.log('OFFLINE-BOOT', JSON.stringify(boot));
  console.log('BLOCKED-EXTERNAL-REQUESTS', blocked.length, blocked.slice(0, 8));
  console.log('FAILED-REQUESTS', failed.length);

  const ok = boot && boot.ready && !boot.fatal && blocked.length === 0;
  console.log(ok ? 'RESULT PASS 完全离线可运行' : 'RESULT FAIL 仍有外部依赖或未启动');
  cdp.close();
  process.exitCode = ok ? 0 : 1;
} catch (e) {
  console.error('ERROR', e.message);
  process.exitCode = 1;
} finally {
  chrome.kill();
  await sleep(600);
  fs.rmSync(profile, { recursive: true, force: true });
}
