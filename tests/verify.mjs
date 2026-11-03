import {verifyStaffBlog} from './staff-blog.mjs';
import {verifyMedia} from './media.mjs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { load } from 'cheerio';
import YAML from 'yaml';
import { chromium } from 'playwright';
import { root, results, workspace, files, build, fixture, serve, cleanup } from './support.mjs';
import { verifyPhone } from './phone.mjs';
import { verifyCollections } from './collections.mjs';
import { verifyCms } from './cms-editing.mjs';
const report=[];
async function check(name,fn) {
  const start=Date.now();
  try {await fn();report.push({name,status:'PASS',ms:Date.now()-start});console.log(`PASS ${name}`);}
  catch(e){report.push({name,status:'FAIL',error:e.stack,ms:Date.now()-start});console.error(`FAIL ${name}\n${e.message}`);}
}
const read=f=>readFile(f,'utf8');
const html=async f=>load(await read(f));
const work=await workspace();let server,browser;
const output=path.join(work,'public');
let built=false;
try {
await check('Hugo production build',async()=>{const log=build(root,output);await writeFile(path.join(results,'hugo-build.txt'),log);assert((await read(path.join(output,'index.html'))).includes('<html'));built=true;});
await check('Decap editor is published at /sudo/ only',async()=>{
  const editor=load(await read(path.join(output,'sudo/index.html')));
  assert(editor('script[src*="decap-cms"]').length,'Missing Decap loader');
  assert(editor('meta[name="robots"]').attr('content').includes('noindex'));
  const robots=await read(path.join(output,'robots.txt'));assert(/Disallow: \/sudo\/|Disallow: \/(?:\s|$)/.test(robots));
  assert(!(await files(output)).some(f=>f.includes('/admin/')),'Old admin route is still published');
  const config=YAML.parse(await read(path.join(output,'sudo/config.yml')));
  assert.equal(config.backend.turbo_site_id,'a9aed266-1523-4548-b632-3cda0ddf7d55');
  assert.equal(config.backend.branch,'main');
});
await check('Decap collections: editorial SEO fields and editable globals',async()=>{
  const config=YAML.parse(await read(path.join(root,'static/sudo/config.yml')));
  assert.equal(config.backend.name,'turbo-github');assert(Array.isArray(config.collections));
  const entries=config.collections.flatMap(c=>c.files||[c]);
  const content=entries.filter(c=>c.folder?.startsWith('content')||c.file?.startsWith('content'));
  assert(content.length>0,'No CMS content collections');
  const missing=[];
  for(const c of content) {
    const names=new Set((c.fields||[]).map(f=>f.name));
    for(const key of ['title','subtitle','description','seo']) if(!names.has(key))missing.push(`${c.name}: ${key}`);
    const seo=c.fields.find(f=>f.name==='seo');
    assert.deepEqual(seo.fields.map(f=>f.name),['search','social']);
    for(const key of ['title','description','noindex','canonicalURL'])assert(seo.fields[0].fields.some(f=>f.name===key),`${c.name}: missing search ${key}`);
    for(const key of ['image','imageAlt','ogTitle','ogDescription','twitterTitle','twitterDescription'])assert(seo.fields[1].fields.some(f=>f.name===key),`${c.name}: missing social ${key}`);
    const copy=c.fields.find(f=>f.name==='copy');if(copy)assert(copy.fields.every(f=>f.widget==='hidden'||(f.widget==='object' && f.collapsed)),`${c.name}: ungrouped copy`);
  }
  assert.deepEqual(missing,[],`Missing CMS fields: ${missing.join(', ')}`);
  const globals=entries.filter(c=>c.file?.startsWith('data/'));
  assert(globals.length>0,'No editable global data file');
  const fields=JSON.stringify(globals.flatMap(c=>c.fields||[]));
  for(const key of ['email','phone','noindex']) assert(fields.toLowerCase().includes(key),`Global ${key} not editable`);
});
if(built) {
await check('Published HTML: local links/assets/fragments, metadata, and honest sample-content disclosures',async()=>{
  const pages=(await files(output)).filter(f=>f.endsWith('.html')&&!f.includes('/sudo/'));
  assert(pages.length>=12,`Only ${pages.length} HTML pages`);const broken=[];
  for(const file of pages) {
    const $=await html(file);assert($('title').text().trim(),`${file}: empty title`);
    assert($('meta[name="description"]').attr('content')?.trim(),`${file}: missing description`);
    $('script,style,noscript,.hero-terminal').remove();
    const text=$('body').text().replace(/\s+/g,' ');
    assert(!/\blorem ipsum\b/i.test(text),`Unfilled filler in ${path.relative(output,file)}`);
    if(/\b(demo (?:profile|content|site|project)|placeholder (?:name|content|image)|fictional (?:client|team|project)|sample (?:case stud|content|profile)|template preview)\b/i.test(text))assert($('.sample-content-notice').text().trim(),`Sample content must carry a visible disclosure in ${path.relative(output,file)}`);
    const original=await html(file);
    for(const el of original('[href],[src],[srcset]').toArray()) {
      const node=original(el);
      const attrs=['href','src'].flatMap(a=>node.attr(a)?[node.attr(a)]:[]);
      if(node.attr('srcset')) attrs.push(...node.attr('srcset').split(',').map(v=>v.trim().split(/\s+/)[0]));
      for(const link of attrs) {
        if(/^(?:mailto:|tel:|data:|javascript:)/i.test(link))continue;
        const route='/'+path.relative(output,file).replaceAll(path.sep,'/');
        const url=new URL(link,`https://herr.test${route}`);
        if(!['herr.test','herrsystems.com','www.herrsystems.com'].includes(url.hostname))continue;
        const name=decodeURIComponent(url.pathname);let target=path.join(output,name);
        try {const {stat}=await import('node:fs/promises');if((await stat(target)).isDirectory())target=path.join(target,'index.html');await readFile(target);
          if(url.hash&&target.endsWith('.html')) {const dest=await html(target), id=decodeURIComponent(url.hash.slice(1));if(!dest('[id],[name]').toArray().some(e=>dest(e).attr('id')===id||dest(e).attr('name')===id))throw Error('missing fragment');}
        }catch{broken.push(`${path.relative(output,file)} → ${link}`);}
      }
    }
  }
  assert.deepEqual([...new Set(broken)],[]);
});
await check('Generated search index and sitemap contain every published service',async()=>{
  const index=JSON.parse(await read(path.join(output,'search-index.json')));assert(Array.isArray(index.pages));
  const serviceFiles=(await files(path.join(root,'content/services'))).filter(f=>/\.(md|html)$/.test(f)&&!path.basename(f).startsWith('_'));
  assert(serviceFiles.length>=6,'Expected all six services');
  const sitemap=await read(path.join(output,'sitemap.xml'));
  const globallyHidden=YAML.parse(await read(path.join(root,'data/settings.yml'))).noindex||YAML.parse(await read(path.join(root,'hugo.yaml'))).params?.noindex;
  for(const f of serviceFiles) {const slug=path.basename(f).startsWith('index.')?path.basename(path.dirname(f)):path.basename(f).replace(/\.(md|html)$/,'');const route=`/services/${slug}/`;assert(index.pages.some(p=>p.url===route&&p.service),`${route} absent from terminal service index`);assert.equal(sitemap.includes(route),!globallyHidden,`${route}: sitemap must respect global visibility`);}
  for(const p of index.pages){assert(p.title&&p.url.startsWith('/'));assert(!p.url.startsWith('//'));}
  assert((await read(path.join(output,'robots.txt'))).includes('Sitemap:'));
});
}
await check('Decap media catalog: every existing image is present in the flat repository gallery and published',async()=>{await verifyMedia(output);});
await check('Phone display formatting and click-to-call links',async()=>{await verifyPhone(work);});
await check('Decap creates services and case studies: detail pages, directories, homepage, search and sitemap',async()=>{await verifyCollections(work);});
await check('Unified Blog and original Staff: discovery, new records, profile edits, sample labels and drafts',()=>verifyStaffBlog(work));
await check('CMS save/rebuild: all section groups, metadata overrides, fallbacks and announcement on/off',async()=>{const count=await verifyCms(work,root);console.log(`Verified edits in ${count} CMS section groups`);});
await check('Isolated fixtures: 10-post pagination, canonical URLs, generic subtitle, per-page and global noindex',async()=>{
  const source=await fixture(work), content=path.join(source,'content');
  await mkdir(path.join(content,'blog'),{recursive:true});
  const existing=(await files(path.join(content,'blog'))).filter(f=>/\.md$/.test(f)&&!path.basename(f).startsWith('_'));
  const required=Math.max(0,11-existing.length);
  for(let i=0;i<required;i++)await writeFile(path.join(content,'blog',`verification-post-${i}.md`),`---\ntitle: Verification post ${i}\nsubtitle: Test fixture\ndescription: Deterministic pagination fixture\ndate: 2026-01-${String(i+1).padStart(2,'0')}\n---\nFixture article.\n`);
  await writeFile(path.join(content,'blog/verification-generic.md'),'---\ntitle: Verification generic post\nsubtitle: Unique generic post subtitle\ndescription: Distinct generic post description\ndate: 2025-01-01\ncanonicalURL: https://example.com/original-post/\n---\nGeneric fixture article.\n');
  const hiddenFile=path.join(content,'verification-private.md');
  await writeFile(hiddenFile,'---\ntitle: Verification private page\nsubtitle: Private fixture\ndescription: Noindex fixture\nnoindex: true\n---\nNever include in discovery.\n');
  let dest=path.join(work,'fixture-public');build(source,dest);
  const $=await html(path.join(dest,'blog/index.html'));
  const posts=new Set($('main a[href]').toArray().map(e=>$(e).attr('href')).filter(h=>/^\/blog\/[^/]+\/$/.test(h)&&!h.startsWith('/blog/page/')));
  assert.equal(posts.size,10,`Expected ten unique post links on first blog page, got ${[...posts]}`);
  const second=await html(path.join(dest,'blog/page/2/index.html'));assert(second('main a[href^="/blog/"]').length>0,'Empty second blog page');
  assert.equal($('link[rel="canonical"]').attr('href'),'https://herr.test/blog/');
  assert.equal(second('link[rel="canonical"]').attr('href'),'https://herr.test/blog/page/2/');
  assert.equal(second('meta[property="og:url"]').attr('content'),'https://herr.test/blog/page/2/');
  const generic=await html(path.join(dest,'blog/verification-generic/index.html'));
  assert.equal(generic('.detail-lead').text(),'Unique generic post subtitle');
  assert.equal(generic('link[rel="canonical"]').attr('href'),'https://example.com/original-post/');
  assert.equal(generic('meta[property="og:url"]').attr('content'),'https://example.com/original-post/');
  const hidden=await html(path.join(dest,'verification-private/index.html'));
  assert.match(hidden('meta[name="robots"]').attr('content')||'',/noindex/);
  assert(!(await read(path.join(dest,'sitemap.xml'))).includes('/verification-private/'));
  assert(!JSON.parse(await read(path.join(dest,'search-index.json'))).pages.some(p=>p.url==='/verification-private/'));
  for(const mode of ['params','settings']) {
    if(mode==='params') {
      const config=YAML.parse(await read(path.join(source,'hugo.yaml')));config.params={...config.params,noindex:true};await writeFile(path.join(source,'hugo.yaml'),YAML.stringify(config));
    } else {
      const config=YAML.parse(await read(path.join(source,'hugo.yaml')));config.params.noindex=false;await writeFile(path.join(source,'hugo.yaml'),YAML.stringify(config));
      const settingsPath=path.join(source,'data/settings.yml');const settings=YAML.parse(await read(settingsPath));settings.noindex=true;await writeFile(settingsPath,YAML.stringify(settings));
    }
    dest=path.join(work,`global-${mode}`);build(source,dest);
    for(const f of (await files(dest)).filter(f=>f.endsWith('.html')&&!f.includes('/sudo/')))assert.match((await html(f))('meta[name="robots"]').attr('content')||'',/noindex/,`${mode}: ${f} missing robots noindex`);
    const visitorIndex=JSON.parse(await read(path.join(dest,'search-index.json'))).pages;
    assert(visitorIndex.some(p=>p.service),`${mode}: global crawler noindex must not break the visitor terminal`);
    assert(!visitorIndex.some(p=>p.url==='/verification-private/'),`${mode}: per-page exclusion must remain effective`);
    assert(!/<loc>/.test(await read(path.join(dest,'sitemap.xml'))),`${mode}: sitemap must exclude noindex pages`);
    assert.match(await read(path.join(dest,'robots.txt')),/Disallow:\s*\/\s*(?:\n|$)/,`${mode}: robots must disallow entire site`);
  }
});
if(built) {
server=await serve(output);
await check('Chromium launches',async()=>{browser=await chromium.launch({headless:true});});
if(browser) {
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await check('Terminal: help, services, hosting, search, ls/cat, history and real open',async()=>{
  await page.goto(server.url);const input=page.locator('.hero-terminal input');await input.waitFor();
  async function command(value,pattern){await input.fill(value);await input.press('Enter');await page.locator('.terminal-entry').last().filter({hasText:'$ '+value}).waitFor({timeout:5000});if(pattern)await page.locator('.terminal-entry').last().filter({hasText:pattern}).waitFor({timeout:5000});}
  await command('herr -help',/herr -services/);
  await command('herr -services',/Hosting/i);
  const services=JSON.parse(await read(path.join(output,'search-index.json'))).pages.filter(p=>p.service);
  for(const s of services)assert(await page.locator('.terminal-entry').last().locator(`a[href="${s.url}"]`).count(),`${s.title} missing in services response`);
  await command('herr -service hosting',/Hosting/i);
  await command('herr -search hosting',/Hosting/i);
  await command('ls');await page.locator('.terminal-entry').last().locator('a[href="/contact/"]').waitFor();
  await command('cat hosting',/Hosting/i);
  await input.fill('unfinished draft');await input.press('ArrowUp');assert.equal(await input.inputValue(),'cat hosting');await input.press('ArrowDown');assert.equal(await input.inputValue(),'unfinished draft');
  await command('herr -history',/cat hosting/);
  await input.fill('herr -open hosting');await Promise.all([page.waitForURL('**/services/hosting/'),input.press('Enter')]);
  assert.match(await page.locator('main').innerText(),/Hosting/i);
});
await check('Mobile: terminal-first geometry, no overflow, theme and modal navigation',async()=>{
  for(const width of [320,390,720]) {
    await page.setViewportSize({width,height:844});await page.goto(server.url);
    const geometry=await page.evaluate(()=>{
      const t=document.querySelector('.hero-terminal').getBoundingClientRect(),h=document.querySelector('main h1').getBoundingClientRect(),i=document.querySelector('.hero-terminal input').getBoundingClientRect();
      return {width:innerWidth,scroll:document.documentElement.scrollWidth,terminal:{top:t.top,bottom:t.bottom,height:t.height,width:t.width},heading:h.top,inputBottom:i.bottom};
    });
    assert(geometry.scroll<=width+1,`Horizontal overflow at ${width}: ${JSON.stringify(geometry)}`);
    assert(geometry.terminal.top<geometry.heading,`Terminal not above hero copy at ${width}`);
    assert(geometry.terminal.height<=361&&geometry.terminal.height<=geometry.terminal.width*.8+2,`Terminal exceeds compact geometry: ${JSON.stringify(geometry)}`);
    assert(geometry.inputBottom<=geometry.terminal.bottom+1,'Terminal input clipped');
  }
  await page.setViewportSize({width:390,height:844});
  const toggle=page.locator('[data-theme-toggle],#theme-toggle,.theme-toggle').filter({visible:true}).first();
  const before=await page.locator('html').getAttribute('data-theme');await toggle.click();await page.waitForTimeout(150);const after=await page.locator('html').getAttribute('data-theme');assert.notEqual(after,before,'Theme toggle had no effect');
  const more=page.getByRole('button',{name:/more/i});await more.click();await page.locator('dialog[open]').waitFor();await page.keyboard.press('Escape');await page.locator('dialog[open]').waitFor({state:'hidden'});
  await more.click();const link=page.locator('dialog[open]').getByRole('link',{name:'Contact',exact:true});await link.click();await page.waitForURL('**/contact/');
});
await check('Pricing updates totals, hides inactive controls, and forms never fake delivery',async()=>{
  await page.setViewportSize({width:1440,height:1000});await page.goto(server.url+'/pricing/');
  const total=page.locator('#project-total');await total.waitFor();
  const web=page.locator('input[name="service"][value="web"]');
  // Resolve the actual web value rather than imposing a presentation label.
  const webControl=await web.count()?web:page.locator('input[name="service"]').first();
  await webControl.check();const old=await total.innerText();const templates=page.locator('[name="templates"]');
  await templates.fill('9');await templates.dispatchEvent('input');assert.notEqual(await total.innerText(),old,'Changing template quantity did not affect total');
  await webControl.uncheck();assert(await templates.isDisabled(),'Inactive service options remain enabled');
  for(const route of ['/contact/','/pricing/']) {
    await page.goto(server.url+route);const posts=[];const listener=r=>{if(r.method()==='POST')posts.push(r.url());};page.on('request',listener);
    if(route.includes('pricing'))await page.locator('input[name="service"]').first().check();
    const form=page.locator('[data-inquiry-form]');assert.equal(await form.count(),1);
    for(const field of await form.locator('input[required],textarea[required],select[required]').all()) {
      const tag=await field.evaluate(e=>e.tagName), type=await field.getAttribute('type');
      if(tag==='SELECT'){const value=await field.locator('option').evaluateAll(es=>es.find(e=>e.value)?.value);await field.selectOption(value);}
      else if(type==='checkbox')await field.check();else await field.fill(type==='email'?'verification@example.com':'Verification only — do not send');
    }
    await page.locator('[data-submit-button]').click();const status=page.locator('[data-submit-status]').first();await status.filter({hasText:/not (?:been )?sent|nothing (?:was )?sent|not connected/i}).waitFor();
    assert.equal(posts.length,0,`${route}: disconnected form submitted a POST`);assert.notEqual(await status.getAttribute('data-state'),'success');page.off('request',listener);
  }
});
await check('Browser runtime remains free of uncaught errors',async()=>assert.deepEqual(errors,[]));
await context.close();
}
}
} finally {
 if(browser)await browser.close();if(server)await server.close();await cleanup(work);
 await writeFile(path.join(results,'verification.json'),JSON.stringify(report,null,2));
}
console.log(`\n${report.filter(r=>r.status==='PASS').length}/${report.length} checks passed. Report: tests/test-results/verification.json`);
process.exitCode=report.some(r=>r.status==='FAIL')?1:0;
