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
 const file='content/blog/a-clearer-website/index.md';
 const record=()=>page.evaluate(file=>file.split('/').reduce((o,p)=>o[p],window.repoFiles).content,file);
 const before=parse(await record());
 await open('blog','a-clearer-website');
 await page.getByRole('combobox',{name:'Post as / author (optional)',exact:true}).fill('Jules');
 await page.getByText('Jules',{exact:true}).last().click();
 await page.getByRole('button',{name:'Publish',exact:true}).click();await page.getByText('Publish now',{exact:true}).click();
 await page.waitForFunction(file=>file.split('/').reduce((o,p)=>o[p],window.repoFiles).content.includes('author: sam-rivera'),file);
 const raw=await record(),after=parse(raw),expected=structuredClone(before.data);expected.author='sam-rivera/index';
 assert.deepEqual(after.data,expected);assert.equal(after.body,before.body);
 await open('blog','a-clearer-website');await page.getByText('Jules',{exact:true}).last().waitFor();
 const renderWork=path.join(work,'render');await fs.mkdir(renderWork);const source=await fixture(renderWork);
 await fs.writeFile(path.join(source,file),raw);const out=path.join(renderWork,'public');build(source,out);
 const $=load(await fs.readFile(path.join(out,'blog/a-clearer-website/index.html'),'utf8'));
 const staff=parse(await fs.readFile(path.join(source,'content/about/team/sam-rivera/index.md'),'utf8')).data;
 assert.equal($('.post-byline a').text(),staff.title);assert.equal($('.post-byline a').attr('href'),staff.url||'/about/'+(staff.slug||'sam-rivera')+'/');
 // Verify an unsaved new article also offers the same staff selector.
 await page.evaluate(()=>location.hash='#/collections/blog');
 await page.getByText('＋ Article',{exact:true}).click();
 await page.getByRole('combobox',{name:'Post as / author (optional)',exact:true}).fill('Emily');
 await page.getByText('Emily Herr',{exact:true}).last().click();
 await page.getByText('Emily Herr',{exact:true}).last().waitFor();
 await field('title').fill('Author picker fixture');await field('description').fill('A new authored post.');
 await field('date').fill('2026-01-15T12:00');
 await page.locator('[contenteditable="true"]').first().fill('A new post written with a chosen author.');
 await page.getByRole('button',{name:'Publish',exact:true}).click();await page.getByText('Publish now',{exact:true}).click();
 const newFile='content/blog/author-picker-fixture/index.md';
 await page.waitForFunction(file=>file.split('/').reduce((o,p)=>o?.[p],window.repoFiles)?.content,newFile);
 const newRaw=await page.evaluate(file=>file.split('/').reduce((o,p)=>o[p],window.repoFiles).content,newFile);
 assert.equal(parse(newRaw).data.author,'alex-morgan/index','Custom staff slug must not replace immutable author identity');
 await fs.mkdir(path.join(source,'content/blog/author-picker-fixture'),{recursive:true});
 await fs.writeFile(path.join(source,newFile),newRaw);build(source,out);
 const newHtml=load(await fs.readFile(path.join(out,'blog/author-picker-fixture/index.html'),'utf8'));
 assert.equal(newHtml('.post-byline a').text(),'Emily Herr');assert.equal(newHtml('.post-byline a').attr('href'),'/about/emily-herr/');

 // Render the saved existing post at mobile/desktop in both themes.
 const preview=await serve(out);
 try {
  const visual=await browser.newPage();
  for(const width of [390,1440])for(const theme of ['dark','light']) {
   await visual.setViewportSize({width,height:1000});await visual.goto(preview.url+'/blog/a-clearer-website/');
   await visual.evaluate(theme=>document.documentElement.setAttribute('data-theme',theme),theme);
   await visual.locator('.post-byline a').waitFor();
   const geometry=await visual.evaluate(()=>{const byline=document.querySelector('.post-byline'),lead=byline.previousElementSibling,a=byline.querySelector('a'),b=byline.getBoundingClientRect(),l=lead.getBoundingClientRect();return {top:b.top,leadBottom:l.bottom,font:parseFloat(getComputedStyle(a).fontSize),left:b.left,right:b.right,overflow:document.documentElement.scrollWidth>innerWidth};});
   assert(geometry.top>=geometry.leadBottom);assert(geometry.font>=12);assert(geometry.left>=0);assert(geometry.right<=width);assert.equal(geometry.overflow,false);
  }
  await visual.close();
 }finally{await preview.close();}
 assert.deepEqual(errors,[]);console.log('PASS actual Decap author relation select/publish/reopen; stable source identity, exact other frontmatter/body preservation, linked byline in rebuilt saved output');

}catch(error){if(page){console.error('PAGE AT FAILURE',await page.locator('body').innerText());console.error('INPUTS',await page.locator('input').evaluateAll(nodes=>nodes.map(n=>({id:n.id,value:n.value}))));}throw error;}
finally{await browser?.close();await server?.close();await cleanup(work);}
