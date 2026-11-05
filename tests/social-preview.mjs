import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, readdir, mkdtemp, cp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load } from 'cheerio';
import YAML from 'yaml';
import { PNG } from 'pngjs';

const temp = await mkdtemp(join(tmpdir(), 'herr-social-'));
const imageURL = 'https://herrsystems.com/assets/social/herr-systems-terminal.png';
async function* htmlFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(path);
    else if (entry.name.endsWith('.html')) yield path;
  }
}
const meta = ($, key) => $(`meta[property="${key}"],meta[name="${key}"]`).attr('content');
try {
  const output = join(temp, 'public');
  execFileSync('hugo', ['--minify', '--destination', output], { stdio: 'pipe' });
  const image = PNG.sync.read(await readFile(join(output, 'assets/social/herr-systems-terminal.png')));
  assert.equal(image.width, 1200); assert.equal(image.height, 630);
  let count = 0;
  for await (const file of htmlFiles(output)) {
    const $ = load(await readFile(file, 'utf8'));
    if (!$('link[rel="canonical"]').length || !meta($, 'og:title')) continue;
    assert.ok(meta($, 'og:image').startsWith('https://'), file);
    assert.equal(meta($, 'twitter:image'), meta($, 'og:image'), file);
    if (meta($, 'og:image') === imageURL) {
    assert.equal(meta($, 'twitter:card'), 'summary_large_image', file);
    assert.equal(meta($, 'og:image:width'), '1200', file);
    assert.equal(meta($, 'og:image:height'), '630', file);
    assert.equal(meta($, 'og:image:type'), 'image/png', file);
    assert.ok(meta($, 'og:image:alt'), file);
    assert.equal(meta($, 'og:image:alt'), meta($, 'twitter:image:alt'), file);
    }
    assert.equal(meta($, 'og:url'), $('link[rel="canonical"]').attr('href'), file);
    count++;
  }
  assert.ok(count >= 20);
  // Exercise existing per-page overrides in an isolated source tree.
  const source = join(temp, 'site');
  for (const name of ['hugo.yaml', 'layouts', 'content', 'data', 'static']) {
    await cp(name, join(source, name), { recursive: true });
  }
  const homePath = join(source, 'content/_index.md');
  const home = await readFile(homePath, 'utf8');
  const end = home.indexOf('---', 3);
  const data = YAML.parse(home.slice(3, end));
  data.seo ??= {}; data.seo.social = { image: '/assets/davy-hexagon-mark.png', imagealt: 'Custom mark', ogtitle: 'Custom OG title', twittertitle: 'Custom Twitter title' };
  await writeFile(homePath, '---\n' + YAML.stringify(data) + '---' + home.slice(end + 3));
  execFileSync('hugo', ['--source', source, '--destination', join(temp, 'fixture')], { stdio: 'pipe' });
  const $ = load(await readFile(join(temp, 'fixture/index.html'), 'utf8'));
  assert.equal(meta($, 'og:title'), 'Custom OG title');
  assert.equal(meta($, 'twitter:title'), 'Custom Twitter title');
  assert.equal(meta($, 'og:image'), 'https://herrsystems.com/assets/davy-hexagon-mark.png');
  assert.equal(meta($, 'og:image:width'), '85');
  assert.equal(meta($, 'og:image:alt'), 'Custom mark');
  console.log(`PASS: social metadata on ${count} pages, 1200x630 PNG, canonical URLs, alt text, and per-page overrides`);
} finally { await rm(temp, { recursive: true, force: true }); }
