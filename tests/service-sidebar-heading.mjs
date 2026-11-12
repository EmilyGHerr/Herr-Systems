// Actual pinned Decap UI; isolated test-repo only, never production auth or Git writes.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import YAML from 'yaml';
import {load} from 'cheerio';
import {chromium} from 'playwright';
import {root,workspace,fixture,build,serve,cleanup} from './support.mjs';
const work=await workspace();let browser,server,page;
function parse(raw){const m=raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);assert(m);return {data:YAML.parse(m[1]),body:raw.slice(m[0].length)};}
try{
 const config=YAML.parse(await fs.readFile(path.join(root,'static/sudo/config.yml'),'utf8')),seed={};
 async function walk(relative){for(const e of await fs.readdir(path.join(root,relative),{withFileTypes:true})){
  const file=relative+'/'+e.name;if(e.isDirectory())await walk(file);else{
   let node=seed;const parts=file.split('/');for(const p of parts.slice(0,-1))node=node[p]??={};
   node[parts.at(-1)]={path:file,content:await fs.readFile(path.join(root,file),'utf8')};
  }
 }}await walk('content');await walk('data');
 const output=path.join(work,'public');build(root,output);server=await serve(output);
 const response=await fetch('https://unpkg.com/decap-cms@3.17.0/dist/decap-cms.js');assert(response.ok);const js=await response.text();assert(js.length>1000000);
 browser=await chromium.launch();page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({seed,folders})=>{window.repoFiles=seed;for(const folder of folders)window.repoFiles[folder]=folder.split('/').reduce((o,p)=>o[p],seed);},{seed,folders:config.collections.filter(c=>c.folder).map(c=>c.folder)});
 await page.route('**/decap-cms.js',r=>r.fulfill({contentType:'text/javascript',body:js}));
 config.backend={name:'test-repo'};config.publish_mode='simple';
 await page.route('**/config.yml',r=>r.fulfill({contentType:'text/yaml',body:YAML.stringify(config)}));
 await page.route(/https:\/\/.*(?:github|gitgateway|netlify|turbocms|turbo-cms).*\//,r=>r.abort());
 await page.goto(server.url+'/sudo/');await page.getByRole('button',{name:'Login',exact:true}).click();
 const field=name=>page.locator('[id^="'+name+'-field-"]').filter({visible:true}).first();
 async function open(collection,identity){
  await page.evaluate(hash=>location.hash=hash,'#/collections/'+collection);
  const link=page.locator('a[href*="/collections/'+collection+'/entries/'+identity+'"]').first();
  await link.waitFor();await link.click();await field('title').waitFor();
 }
 const file='content/services/consulting/index.md';
 const record=()=>page.evaluate(file=>file.split('/').reduce((o,p)=>o[p],window.repoFiles).content,file);
 const before=parse(await record());
 const heading='Advice & planning <not markup>';
 await open('services','consulting');
 await field('fit_heading').fill(heading);
 await page.getByRole('button',{name:'Publish',exact:true}).click();
 await page.getByText('Publish now',{exact:true}).click();
 await page.waitForFunction(({file,heading})=>file.split('/').reduce((o,p)=>o[p],window.repoFiles).content.includes(heading),{file,heading});
 const raw=await record(),after=parse(raw),expected=structuredClone(before.data);expected.fit_heading=heading;
 assert.deepEqual(after.data,expected);assert.equal(after.body,before.body);
 await open('services','consulting');assert.equal(await field('fit_heading').inputValue(),heading);
 const renderWork=path.join(work,'render');await fs.mkdir(renderWork);const source=await fixture(renderWork);
 const out=path.join(renderWork,'public');
 await fs.writeFile(path.join(source,file),raw);build(source,out);
 const sidebar=async slug=>load(await fs.readFile(path.join(out,'services/'+slug+'/index.html'),'utf8'));
 let $=await sidebar('consulting');assert.equal($('.detail-fit h3').text(),heading);assert.equal($('.detail-fit h3 not').length,0);
 const settings=YAML.parse(await fs.readFile(path.join(source,'data/settings.yml'),'utf8'));
 $=await sidebar('hosting');assert.equal($('.detail-fit h3').text(),settings.service_fit_label);
 // Missing, empty, and null overrides retain the shared heading.
 for(const value of [undefined,'',null]){
  const data=structuredClone(before.data);delete data.fit_heading;if(value!==undefined)data.fit_heading=value;
  await fs.writeFile(path.join(source,file),['---',YAML.stringify(data).trimEnd(),'---',before.body].join('\n'));
  build(source,out);$=await sidebar('consulting');assert.equal($('.detail-fit h3').text(),settings.service_fit_label);
 }
 assert.deepEqual(errors,[]);
 console.log('PASS sidebar heading: actual Decap edit/publish/reopen, exact unrelated data/body preservation, saved-output rendering and escaping, other services unchanged, missing/empty/null fallback');
}finally{await browser?.close();await server?.close();await cleanup(work);}
