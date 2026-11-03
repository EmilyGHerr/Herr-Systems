import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import YAML from 'yaml';
import { chromium, firefox } from 'playwright';
import { workspace, fixture, build, serve, cleanup } from './support.mjs';
const work = await workspace();
try {
  const source = await fixture(work);
  const home = source + '/content/_index.md';
  const raw = await readFile(home, 'utf8');
  const match = raw.match(/^---\n([\s\S]*?)\n---([\s\S]*)$/);
  const data = YAML.parse(match[1]);
  for (const enabled of [false, true]) {
    data.copy.notice_2.enabled = enabled;
    await writeFile(home, '---\n' + YAML.stringify(data) + '---' + match[2]);
    const output = work + '/public-' + enabled;
    build(source, output);
    const server = await serve(output);
    try {
      for (const engine of [firefox, chromium]) {
        const browser = await engine.launch();
        try {
          for (const width of [360, 720, 1440]) {
            const page = await browser.newPage({viewport:{width,height:1000}});
            await page.goto(server.url);
            await page.evaluate(() => document.fonts.ready);
            for (const theme of ['dark', 'light']) {
              await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
              assert.equal(await page.locator('main > .notice').count(), Number(enabled));
              const gap = await page.evaluate(() => {
                const services = document.querySelector('.home-services').getBoundingClientRect();
                const previous = document.querySelector('.home-services').previousElementSibling.getBoundingClientRect();
                return services.top - previous.bottom;
              });
              assert(gap >= 19.9 && gap <= 40.1, `${engine.name()} ${width}px ${theme} alert=${enabled}: section gap ${gap}px`);
              console.log(`PASS ${engine.name()} ${width}px ${theme} alert=${enabled}: ${gap}px gap`);
            }
            await page.close();
          }
        } finally { await browser.close(); }
      }
    } finally { await server.close(); }
  }
} finally { await cleanup(work); }
