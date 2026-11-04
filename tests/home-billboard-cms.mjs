// Actual Decap save/reopen against a seeded test backend. No production login or Git writes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import {load} from 'cheerio';
import {chromium} from 'playwright';
import {root,workspace,fixture,build,serve,cleanup} from './support.mjs';
const work=await workspace();let browser,server;
const parse=raw=>{const m=raw.match(/^---\n([\s\S]*?)\n---([\s\S]*)$/);return {data:YAML.parse(m[1]),body:m[2]};};
try {
 const source=await fixture(work),out=path.join(work,'public');build(source,out);server=await serve(out);
 const raw=await fs.readFile(path.join(source,'content/_index.md'),'utf8'),original=parse(raw);
 const r=await fetch('https://unpkg.com/decap-cms@3.17.0/dist/decap-cms.js');assert(r.ok);const js=await r.text();
 browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(raw=>{window.repoFiles={content:{'_index.md':{path:'content/_index.md',content:raw}}};},raw);
 await page.route('**/decap-cms.js',r=>r.fulfill({contentType:'text/javascript',body:js}));
 await page.route('**/config.yml',async r=>{const c=YAML.parse(await fs.readFile(path.join(source,'static/sudo/config.yml'),'utf8'));c.backend={name:'test-repo'};c.publish_mode='simple';await r.fulfill({contentType:'text/yaml',body:YAML.stringify(c)});});
 await page.goto(server.url+'/sudo/');await page.getByRole('button',{name:'Login',exact:true}).click();
 const open=async()=>{await page.evaluate(()=>location.hash='#/collections/pages/entries/home');await page.locator('[id^="hero_title-field-"]').waitFor();await page.getByText('Billboard — heading and actions',{exact:true}).last().getByRole('button',{name:'Expand',exact:true}).click();};
 const field=name=>page.locator('[id^="'+name+'-field-"]').filter({visible:true});
 await open();assert.equal(await field('button_1_url').inputValue(),original.data.copy.hero_1.button_1_url);assert.equal(await field('plain_link_1_url').inputValue(),original.data.copy.hero_1.plain_link_1_url);
 const changed={button_1:'Talk about a project',button_1_url:'/contact/?from=billboard#main',plain_link_1:'See an external example',plain_link_1_url:'https://example.com/services?one=1&two=2#plans'};
 for(const [key,value]of Object.entries(changed))await field(key).fill(value);
 await page.getByRole('button',{name:'Publish',exact:true}).click();await page.getByText('Publish now',{exact:true}).click();
 await page.waitForFunction(()=>window.repoFiles.content['_index.md'].content.includes('https://example.com/services?one=1&two=2#plans'));
 const saved=await page.evaluate(()=>window.repoFiles.content['_index.md'].content),record=parse(saved);
 const expected=structuredClone(original.data);Object.assign(expected.copy.hero_1,changed);
 assert.deepEqual(record.data,expected,'All other homepage fields including hidden styles/scripts must survive publishing');assert.equal(record.body.trim(),original.body.trim());
 await page.evaluate(()=>location.hash='#/collections/pages');await page.getByRole('link',{name:'Home',exact:true}).waitFor();await open();for(const [key,value]of Object.entries(changed))assert.equal(await field(key).inputValue(),value);
 await fs.writeFile(path.join(source,'content/_index.md'),saved);build(source,out);const $=load(await fs.readFile(path.join(out,'index.html'),'utf8'));
 assert.equal($('.hero-actions a').first().attr('href'),changed.button_1_url);assert.equal($('.hero-actions a').last().attr('href'),changed.plain_link_1_url);
 assert($('.hero-actions a').first().text().includes(changed.button_1));assert.equal($('.hero-actions a').last().text(),changed.plain_link_1);
 assert.deepEqual(errors,[]);console.log('PASS actual Decap Home billboard edit/publish/reopen: both texts and URLs persist and render; every unrelated field, hidden stylesheet/script and body preserved; zero browser errors');
}finally{await browser?.close();await server?.close();await cleanup(work);}
