import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { root, workspace, build, serve, cleanup } from './support.mjs';
const work = await workspace();
let server, browser;
try {
  const output = path.join(work, 'public');
  build(root, output);
  for (const route of ['index.html', 'services/index.html', 'contact/index.html', 'blog/index.html']) {
    const html = await readFile(path.join(output, route), 'utf8');
    assert(html.includes('@view-transition'), `${route}: missing native navigation opt-in`);
    assert(html.includes('prefers-reduced-motion: reduce'));
    assert(html.indexOf('id="navigation-paint"') < html.indexOf('rel="stylesheet"'), 'Canvas must be styled before external CSS');
  }
  server = await serve(output);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.addEventListener('pageswap', event => sessionStorage.setItem('transition-swap', String(Boolean(event.viewTransition))));
    window.addEventListener('pagereveal', event => { window.nativeReveal = Boolean(event.viewTransition); });
  });
  await page.goto(server.url);
  await page.evaluate(() => { window.oldDocumentMarker = true; });
  await page.getByRole('link', { name: 'Explore our services', exact: true }).click();
  await page.waitForURL('**/services/');
  await page.waitForFunction(() => window.nativeReveal === true);
  assert.equal(await page.evaluate(() => sessionStorage.getItem('transition-swap')), 'true');
  assert.equal(await page.evaluate(() => window.oldDocumentMarker), undefined, 'Must create a fresh document, not an SPA view');
  assert.equal(await page.locator('h1').count(), 1);
  await page.goBack();
  await page.waitForURL(server.url + '/');
  assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).opacity), '1');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement, '::view-transition-old(root)').animationName), 'none');
  await context.close();
  const cold = await browser.newContext();
  const coldPage = await cold.newPage();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await coldPage.route('**/*.css', async route => { await gate; await route.continue(); });
  await coldPage.goto(server.url, { waitUntil: 'commit' });
  await coldPage.waitForFunction(() => document.getElementById('navigation-paint'));
  assert.equal(await coldPage.evaluate(() => getComputedStyle(document.documentElement).backgroundColor), 'rgb(22, 7, 61)');
  release();
  await coldPage.waitForLoadState('load');
  await cold.close();
  const noJS = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const plainPage = await noJS.newPage();
  await plainPage.goto(server.url);
  await plainPage.getByRole('link', { name: 'Explore our services', exact: true }).click();
  await plainPage.waitForURL('**/services/');
  assert.equal(await plainPage.locator('h1').count(), 1);
  assert.equal(await plainPage.locator('body').evaluate(el => getComputedStyle(el).opacity), '1');
  await noJS.close();
  assert.deepEqual(errors, []);
  console.log('PASS native full-document crossfade, back navigation, reduced motion, early dark canvas, mobile/no-JS navigation, and no browser errors');
} finally {
  await browser?.close();
  await server?.close();
  await cleanup(work);
}
