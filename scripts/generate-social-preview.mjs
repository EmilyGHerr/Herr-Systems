import { readFile, mkdir, copyFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { load } from 'cheerio';

// Reuse the real homepage artwork, without input, controls, or scripts.
const $ = load(await readFile('layouts/partials/home-terminal.html', 'utf8'));
const artwork = $('.terminal-welcome').html();
if (!artwork) throw new Error('Homepage terminal artwork missing');
const font = (await readFile('static/fonts/dm-mono-400.woff2')).toString('base64');
const css = await readFile('static/home-terminal.css', 'utf8');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><head><style>
    @font-face { font-family: 'DM Mono'; src: url(data:font/woff2;base64,${font}) format('woff2'); }
    ${css}
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; background: #0c1026; }
    body { padding: 30px; --mono: 'DM Mono', monospace; }
    .hero-terminal { height: 570px; border-color: #657496; box-shadow: 7px 7px 0 #10052c; }
    .hero-terminal .terminal-welcome { height: 100%; gap: 34px; padding: 35px; }
    .hero-terminal .terminal-mark { font-size: 23px; line-height: 1; }
    .hero-terminal .terminal-wordmark pre { font-size: 16px; line-height: 1.05; }
  </style></head><body><div class="hero-terminal"><div class="terminal-welcome">${artwork}</div></div></body></html>`);
  await page.evaluate(() => document.fonts.ready);
  if (await page.locator('input, button, form, a, script').count()) throw new Error('Interactive content in social image');
  const overflow = await page.locator('.terminal-welcome pre').evaluateAll(nodes => nodes.some(n => n.getBoundingClientRect().left < 30 || n.getBoundingClientRect().right > 1170));
  if (overflow) throw new Error('Terminal artwork overflows the social image');
  await mkdir('static/assets/social', { recursive: true });
  await page.screenshot({ path: 'static/assets/social/herr-systems-terminal.png' });
  // Keep the existing Decap flat media gallery in sync with the source asset.
  await copyFile('static/assets/social/herr-systems-terminal.png', 'static/uploads/social-herr-systems-terminal.png');
  const catalogPath = 'docs/media-catalog.json';
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  const record = { source: '/assets/social/herr-systems-terminal.png', library: '/uploads/social-herr-systems-terminal.png' };
  if (!catalog.some(item => item.source === record.source)) {
    catalog.push(record);
    await writeFile(catalogPath, JSON.stringify(catalog, null, 2) + '\n');
  }
  console.log('Generated static/assets/social/herr-systems-terminal.png (1200 x 630)');
} finally { await browser.close(); }
