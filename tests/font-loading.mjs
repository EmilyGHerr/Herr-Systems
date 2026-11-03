import assert from 'node:assert/strict';
import { chromium, firefox } from 'playwright';
import { root, workspace, build, serve, cleanup } from './support.mjs';
const work = await workspace();
let server;
try {
  build(root, work + '/public');
  server = await serve(work + '/public');
  for (const engine of [firefox, chromium]) {
    const browser = await engine.launch();
    try {
      const context = await browser.newContext();
      const externalFonts = [];
      await context.route(/fonts\.(googleapis|gstatic)\.com/, route => { externalFonts.push(route.request().url()); return route.abort(); });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      await page.route(/\.(woff2?|ttf)(\?|$)/, async route => { await gate; await route.continue(); });
      await page.goto(server.url, {waitUntil: 'domcontentloaded'});
      try {
        assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).visibility), 'hidden', 'Do not expose fallback-font layout while fonts are loading');
      } finally { release(); }
      await page.waitForFunction(() => !document.documentElement.hasAttribute('data-fonts-pending'));
      await page.evaluate(() => document.fonts.ready);
      assert(await page.evaluate(() => document.fonts.check('400 48px VT323')));
      assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).visibility), 'visible');
      await page.getByRole('link', {name:'Explore our services', exact:true}).click();
      await page.waitForURL('**/services/');
      await page.waitForFunction(() => !document.documentElement.hasAttribute('data-fonts-pending'));
      await page.goBack();
      await page.waitForURL(server.url + '/');
      await page.waitForFunction(() => getComputedStyle(document.body).visibility === 'visible');
      assert.deepEqual(errors, []);
      assert.deepEqual(externalFonts, [], 'Fonts must not depend on Google at runtime');
      await context.close();

      const failed = await browser.newContext({reducedMotion: 'reduce'});
      const failPage = await failed.newPage();
      await failPage.route(/\.(woff2?|ttf)(\?|$)/, route => route.abort());
      await failPage.goto(server.url);
      await failPage.waitForFunction(() => !document.documentElement.hasAttribute('data-fonts-pending'));
      assert.equal(await failPage.locator('body').evaluate(el => getComputedStyle(el).visibility), 'visible');
      assert.equal(await failPage.locator('body').evaluate(el => getComputedStyle(el).animationName), 'none');
      await failed.close();

      const stalled = await browser.newContext();
      const stallPage = await stalled.newPage();
      let unblock;
      const hold = new Promise(resolve => { unblock = resolve; });
      await stallPage.route(/\.(woff2?|ttf)(\?|$)/, async route => { await hold; await route.abort(); });
      try {
        await stallPage.goto(server.url, {waitUntil:'domcontentloaded'});
        await stallPage.waitForFunction(() => getComputedStyle(document.body).visibility === 'visible', null, {timeout:4000});
      } finally { unblock(); await stalled.close(); }

      const noJS = await browser.newContext({javaScriptEnabled:false, viewport:{width:390,height:844}});
      const plain = await noJS.newPage();
      await plain.goto(server.url);
      assert.equal(await plain.locator('body').evaluate(el => getComputedStyle(el).visibility), 'visible');
      await plain.getByRole('link', {name:'Explore our services', exact:true}).click();
      await plain.waitForURL('**/services/');
      await noJS.close();
      console.log(`PASS ${engine.name()} ${browser.version()}: delayed/local fonts, full navigation, Back, font failure/timeout, reduced motion, no JS`);
    } finally { await browser.close(); }
  }
} finally { await server?.close(); await cleanup(work); }
