/**
 * 将 src/js/*.js 按文件名顺序内联进 src/template.html，
 * 输出单文件 cloud-terrace/index.html。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const jsDir = path.join(root, 'src', 'js');
const templatePath = path.join(root, 'src', 'template.html');
const outPath = path.join(root, 'index.html');

const files = fs.readdirSync(jsDir).filter((f) => f.endsWith('.js')).sort();
if (!files.length) throw new Error('no js files');

const imports = [];
const bodies = [];
for (const f of files) {
  const raw = fs.readFileSync(path.join(jsDir, f), 'utf8');
  const lines = raw.split(/\r?\n/);
  const body = [];
  for (const line of lines) {
    if (/^\s*import\s.+from\s+['"].+['"];?\s*$/.test(line)) {
      imports.push(line.trim());
    } else {
      body.push(line);
    }
  }
  bodies.push(`\n/* ---- ${f} ---- */\n` + body.join('\n'));
}

const js = [
  '/* 本文件由 src/js/*.js 与 src/template.html 自动内联生成。 */',
  ...imports,
  ...bodies
].join('\n');

const template = fs.readFileSync(templatePath, 'utf8');
if (!template.includes('/* __INLINE_JS__ */')) throw new Error('placeholder missing');
const html = template.replace('/* __INLINE_JS__ */', js);
fs.writeFileSync(outPath, html, 'utf8');

const bytes = Buffer.byteLength(html, 'utf8');
console.log(`built ${path.relative(root, outPath)}  ${(bytes / 1024).toFixed(1)} KB  (${files.length} modules)`);
