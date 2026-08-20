// Builds agreement.html (self-contained) and Tendr_Estimating_Services_Agreement.pdf
// Usage: node build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FONT_CSS = process.env.FONT_CSS || join(dir, 'fonts.css');

// ---- 1. assemble self-contained HTML -------------------------------------
let html = readFileSync(join(dir, 'agreement.template.html'), 'utf8');
const fonts = readFileSync(FONT_CSS, 'utf8');
let logo = readFileSync(join(dir, 'logo-navy.svg'), 'utf8').trim();
logo = logo.replace('<svg ', '<svg class="logo" role="img" aria-label="Tendr" ');

html = html.replace('/*__FONTS__*/', fonts);
html = html.replace('<!--__LOGO__-->', logo);
const htmlPath = join(dir, 'agreement.html');
writeFileSync(htmlPath, html);

// ---- 2. print to PDF via CDP (for the repeating footer) -------------------
const port = 9333 + (process.pid % 500);
const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=' + join(tmpdir(), 'tendr-agreement-chrome'),
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function targets() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/list`);
      const j = await r.json();
      const page = j.find((t) => t.type === 'page');
      if (page) return page;
    } catch {}
    await sleep(250);
  }
  throw new Error('Chrome DevTools did not come up');
}

const footer = `
<div style="width:100%;font-family:'Helvetica Neue',Arial,sans-serif;font-size:6.5pt;
            color:#618794;padding:0 15mm;display:flex;justify-content:space-between;
            letter-spacing:.04em;text-transform:uppercase;">
  <span>Tendr Pty Ltd &nbsp;&middot;&nbsp; Estimating services agreement</span>
  <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
</div>`;
const header = '<div></div>';

const page = await targets();
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const msgId = ++id;
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });

const loaded = new Promise((resolve) => {
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { resolve: res, reject } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? reject(new Error(JSON.stringify(m.error))) : res(m.result);
    }
    if (m.method === 'Page.loadEventFired') resolve();
  });
});

await new Promise((r) => ws.addEventListener('open', r));
await send('Page.enable');
await send('Page.navigate', { url: 'file://' + htmlPath });
await loaded;
await sleep(1200); // let webfonts settle

const { data } = await send('Page.printToPDF', {
  printBackground: true,
  preferCSSPageSize: true,
  displayHeaderFooter: true,
  headerTemplate: header,
  footerTemplate: footer,
  marginTop: 0.63,     // inches — must mirror @page margins
  marginBottom: 0.71,
  marginLeft: 0.591,
  marginRight: 0.59,
});

const pdfPath = join(dir, 'Tendr_Estimating_Services_Agreement.pdf');
writeFileSync(pdfPath, Buffer.from(data, 'base64'));
ws.close();
chrome.kill();
console.log('wrote', htmlPath);
console.log('wrote', pdfPath);
process.exit(0);
