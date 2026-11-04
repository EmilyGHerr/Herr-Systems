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
 const record=file=>page.evaluate(file=>file.split('/').reduce((o,p)=>o?.[p],window.repoFiles)?.content,file);
 const inventory=()=>page.evaluate(()=>{
  const found=[];function walk(node){for(const [key,value]of Object.entries(node||{})){
   if(key.includes('/'))continue; // test-repo folder aliases are not extra source records
   if(value&&typeof value==='object'){if(typeof value.content==='string'&&value.path)found.push(value.path);else walk(value);}
  }}walk(window.repoFiles);return found.sort();
 });
 const identities=await inventory(),written=[];
 async function publish(){await page.getByRole('button',{name:'Publish',exact:true}).click();await page.getByText('Publish now',{exact:true}).click();}
 async function edit({collection,identity,file,key,value,route}){
  const before=parse(await record(file));await open(collection,identity);await field(key).fill(value);await publish();
  await page.waitForFunction(({file,value})=>file.split('/').reduce((o,p)=>o?.[p],window.repoFiles)?.content?.includes(value),{file,value});
  const raw=await record(file),after=parse(raw);assert.equal(after.data[key],value);
  assert.equal(after.body.trim(),before.body.trim(),file+' biography/article body');
  for(const k of ['title','copy','image','image_alt','role','fragment','skills','facts','approach','contributions'])if(k in before.data)assert.deepEqual(after.data[k],before.data[k],file+' preserves '+k);
  assert.deepEqual(await inventory(),identities,'URL edit must not move, duplicate or delete source records');
  await open(collection,identity);assert.equal(await field(key).inputValue(),value,'Reopen original source identity');
  written.push({file,raw,route,title:before.data.title,image:before.data.image});console.log('PASS Decap publish/reopen/source identity:',file,key+'='+value);
 }
 for(const [collection,identity,value,route]of [
  ['staff','alex-morgan','fixture-person-url','/about/fixture-person-url/'],
  ['blog','a-clearer-website','fixture-article-url','/blog/fixture-article-url/'],
  ['services','web-design','fixture-service-url','/services/fixture-service-url/'],
  ['case_studies','maple-street-workshop','fixture-case-url','/case-studies/fixture-case-url/'],
 ])await edit({collection,identity,file:config.collections.find(c=>c.name===collection).folder+'/'+identity+'/index.md',key:'slug',value,route});
 for(const identity of ['contact','pricing','about','blog','services','case-studies']){
  const file=config.collections.find(c=>c.name==='pages').files.find(f=>f.name===identity).file,route='/fixture-'+identity+'-url/';
  await edit({collection:'pages',identity,file,key:'url',value:route,route});
 }
 // Real primitive-list interaction; the expansion button has no accessible label.
 await open('staff','alex-morgan');
 await page.getByRole('button',{name:'Add previous urls (redirects)',exact:true}).click();
 const alias='/fixture-previous-person/';
 await page.locator('[id^="path-field-"]').filter({visible:true}).last().fill(alias);await publish();
 await page.waitForFunction(alias=>window.repoFiles.content.about.team['alex-morgan']['index.md'].content.includes(alias),alias);
 const staff=written.find(r=>r.file.includes('alex-morgan'));staff.raw=await record(staff.file);staff.alias=alias;assert(parse(staff.raw).data.aliases.includes(alias));
 await open('staff','alex-morgan');await page.waitForFunction(alias=>Array.from(document.querySelectorAll('[id^="path-field-"]')).some(n=>n.value===alias),alias);assert.deepEqual(await inventory(),identities);
 const render=path.join(work,'render');await fs.mkdir(render);const source=await fixture(render);
 for(const {file,raw}of written)await fs.writeFile(path.join(source,file),raw);
 const dest=path.join(render,'output');build(source,dest);
 const html=async route=>load(await fs.readFile(path.join(dest,route,'index.html'),'utf8'));
 for(const entry of written){const $=await html(entry.route);assert($('html').text().replace(/\s/g,'').includes(entry.title.replace(/\s/g,'')),entry.route+' saved source renders');
  assert.equal($('link[rel="canonical"]').attr('href'),'https://herr.test'+entry.route);
  if(entry.image)assert($('img').toArray().some(img=>$(img).attr('src')===entry.image),entry.route+' image preserved');
  if(entry.alias){const redirect=await html(entry.alias);assert(redirect('meta[http-equiv="refresh"]').attr('content').includes(entry.route));}
 }
 const home=await html('/');for(const route of ['/fixture-contact-url/','/fixture-about-url/','/fixture-blog-url/','/fixture-services-url/','/fixture-case-studies-url/'])assert(home('a[href="'+route+'"]').length,'Navigation follows '+route);
 for(const [directory,target]of [['/fixture-about-url/','/about/fixture-person-url/'],['/fixture-blog-url/','/blog/fixture-article-url/'],['/fixture-services-url/','/services/fixture-service-url/'],['/fixture-case-studies-url/','/case-studies/fixture-case-url/']]){const $=await html(directory);assert($('a[href="'+target+'"]').length,directory+' listing follows '+target);}
 assert.deepEqual(errors,[]);
 console.log('PASS real Decap 3.17.0: four folder records and six file/directory pages publish/reopen without source moves or duplicates; biography/copy/images preserved; aliases persist; isolated Hugo build verifies canonical routes, redirect and updated navigation/listings. No production writes.');
}catch(error){if(page){console.error('PAGE AT FAILURE',await page.locator('body').innerText());console.error('INPUTS',await page.locator('input').evaluateAll(nodes=>nodes.map(n=>({id:n.id,value:n.value}))));}throw error;}
finally{await browser?.close();await server?.close();await cleanup(work);}
