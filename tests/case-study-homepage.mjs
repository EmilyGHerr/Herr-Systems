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
 const config=YAML.parse(await fs.readFile(path.join(source,'static/sudo/config.yml'),'utf8'));
 const fields=config.collections.find(c=>c.name==='case_studies').fields;
 assert.equal(fields[1].name,'homepage');assert.equal(fields[1].collapsed,false);
 assert.equal(fields[1].fields.find(f=>f.name==='show').default,false,'New studies are opt-in');
 const raw=await fs.readFile(path.join(source,'content/case-studies/burn-blue/index.md'),'utf8'),original=parse(raw);
 const r=await fetch('https://unpkg.com/decap-cms@3.17.0/dist/decap-cms.js');assert(r.ok);const js=await r.text();
 browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(raw=>{const files={'burn-blue':{'index.md':{path:'content/case-studies/burn-blue/index.md',content:raw}}};window.repoFiles={content:{'case-studies':files},'content/case-studies':files};},raw);
 await page.route('**/decap-cms.js',r=>r.fulfill({contentType:'text/javascript',body:js}));
 await page.route('**/config.yml',async r=>{const c=YAML.parse(await fs.readFile(path.join(source,'static/sudo/config.yml'),'utf8'));c.backend={name:'test-repo'};c.publish_mode='simple';await r.fulfill({contentType:'text/yaml',body:YAML.stringify(c)});});
 await page.goto(server.url+'/sudo/');await page.getByRole('button',{name:'Login',exact:true}).click();
 const open=async()=>{await page.evaluate(()=>location.hash='#/collections/case_studies');const link=page.locator('a[href*="/collections/case_studies/entries/burn-blue"]').first();await link.waitFor();await link.click();await page.locator('[id^="show-field-"]').waitFor();assert.equal(await page.locator('[id^="title-field-"]').first().inputValue(),original.data.title);};
 await open();
 const toggle=page.locator('[id^="show-field-"]');
 for(const show of [!original.data.homepage.show,!!original.data.homepage.show]) {
  await toggle.setChecked(show);
  await page.getByRole('button',{name:'Publish',exact:true}).click();await page.getByText('Publish now',{exact:true}).click();
  await page.waitForFunction(show=>window.repoFiles.content['case-studies']['burn-blue']['index.md'].content.includes('show: '+show),show);
  const saved=await page.evaluate(()=>window.repoFiles.content['case-studies']['burn-blue']['index.md'].content),record=parse(saved);
  const expected=structuredClone(original.data);expected.homepage.show=show;
  assert.deepEqual(record.data,expected);assert.equal(record.body,original.body);
  await fs.writeFile(path.join(source,'content/case-studies/burn-blue/index.md'),saved);build(source,out);
  const home=load(await fs.readFile(path.join(out,'index.html'),'utf8')),directory=load(await fs.readFile(path.join(out,'case-studies/index.html'),'utf8'));
  const href=record.data.url||'/case-studies/'+(record.data.slug||'burn-blue')+'/';
  assert.equal(home('#case-studies a[href="'+href+'"]').length>0,show);
  assert(directory('a[href="'+href+'"]').length>0);
  assert((await fs.readFile(path.join(out,href,'index.html'),'utf8')).includes('<title>'));
  await open();assert.equal(await toggle.isChecked(),show);
 }
 assert.deepEqual(errors,[]);console.log('PASS actual Decap homepage visibility off/on, publish/reopen, content preservation, homepage filtering, directory/detail retention');
}finally{await browser?.close();await server?.close();await cleanup(work);}
