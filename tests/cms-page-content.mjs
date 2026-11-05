// Real Decap edit/save/reopen for page content. Never authenticates or writes to production.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import YAML from 'yaml';
import {load} from 'cheerio';
import {chromium} from 'playwright';
import {root,workspace,fixture,build,serve,cleanup,results} from './support.mjs';
const work=await workspace();let browser,server,page;
const parse=raw=>{const m=raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);assert(m);return {data:YAML.parse(m[1]),body:raw.slice(m[0].length)};};
try {
 const config=YAML.parse(await fs.readFile(path.join(root,'static/sudo/config.yml'),'utf8'));
 const pages=config.collections.find(c=>c.name==='pages').files;
 const output=path.join(work,'public');build(root,output);server=await serve(output);
 const response=await fetch('https://unpkg.com/decap-cms@3.17.0/dist/decap-cms.js');assert(response.ok);const js=await response.text();
 const seed={};async function walk(dir){for(const e of await fs.readdir(path.join(root,dir),{withFileTypes:true})){const file=path.posix.join(dir,e.name);if(e.isDirectory())await walk(file);else{let o=seed;const parts=file.split('/');for(const part of parts.slice(0,-1))o=o[part]??={};o[parts.at(-1)]={path:file,content:await fs.readFile(path.join(root,file),'utf8')};}}}await walk('content');await walk('data');
 browser=await chromium.launch();page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(seed=>{window.repoFiles=seed;},seed);
 await page.route('**/decap-cms.js',r=>r.fulfill({contentType:'text/javascript',body:js}));
 await page.route('**/config.yml',async r=>{const c=structuredClone(config);c.backend={name:'test-repo'};c.publish_mode='simple';await r.fulfill({contentType:'text/yaml',body:YAML.stringify(c)});});
 await page.goto(server.url+'/sudo/');await page.getByRole('button',{name:'Login',exact:true}).click();
 const field=name=>page.locator('[id^="'+name+'-field-"]').filter({visible:true}).first();
 async function open(collection,name){await page.evaluate(hash=>location.hash=hash,'#/collections/'+collection);await page.getByRole('link',{name:collection==='pages'?'About':'Brand, contact and shared interface copy',exact:true}).waitFor();await page.evaluate(hash=>location.hash=hash,'#/collections/'+collection+'/entries/'+name);await page.locator('[id^="'+(collection==='pages'?'title':'brand')+'-field-"]').first().waitFor();}
 async function publish(file,marker){await page.getByRole('button',{name:'Publish',exact:true}).click();await page.getByText('Publish now',{exact:true}).click();await page.waitForFunction(({parts,marker})=>{const e=parts.reduce((o,k)=>o?.[k],window.repoFiles);return e?.content?.includes(marker);},{parts:file.split('/'),marker});return page.evaluate(parts=>parts.reduce((o,k)=>o[k],window.repoFiles).content,file.split('/'));}
 function preserve(before,after,edits){const expected=structuredClone(before.data);for(const[group,key,value]of edits)expected.copy[group][key]=value;for(const key of Object.keys(before.data))assert.deepEqual(after.data[key],expected[key],'Unrelated stored field changed: '+key);assert.equal(after.body.trim(),before.body.trim(),'Unrelated Markdown body changed');}
 const specs=[['home','hero_1',['kicker_1']],['case-studies','section_3',['collection_title_1']],['services','services_2',['services_title_1']],['pricing','pricing_workbench_2',['estimate_title_1']],['contact','desk_direct_12',['direct_46']],['about','detail_overview_4',['story_title_1']],['blog','detail_section_4',['more_title_1']]];
 assert.deepEqual(pages.map(p=>p.name).sort(),specs.map(s=>s[0]).sort(),'Every Site pages editor needs an explicit content save/reopen scenario');
 const written=[],markers=[];
 for(const[name,groupName,keys]of specs){const entry=pages.find(p=>p.name===name),before=parse(await fs.readFile(path.join(root,entry.file),'utf8'));await open('pages',name);const group=entry.fields.find(f=>f.name==='copy').fields.find(g=>g.name===groupName);
  if(name==='about'){assert(await field('story_title_1').isVisible(),'The reported story heading is not immediately editable');assert(await page.locator('[contenteditable="true"]').filter({visible:true}).count()>0,'The consolidated rich-text story is not immediately editable');}
  else if(!await field(keys[0]).isVisible())await page.getByText(group.summary,{exact:true}).last().getByRole('button',{name:'Expand',exact:true}).click();
  const edits=[];for(const key of keys){const marker='PAGE_EDIT_'+name.replaceAll('-','_')+'_'+key+'_END';await field(key).fill(marker);edits.push([groupName,key,marker]);markers.push([entry.file,marker]);}
  const raw=await publish(entry.file,edits[0][2]);preserve(before,parse(raw),edits);written.push([entry.file,raw]);await open('pages',name);if(name!=='about')await page.getByText(group.summary,{exact:true}).last().getByRole('button',{name:'Expand',exact:true}).click();for(const[,key,value]of edits)assert.equal(await field(key).inputValue(),value);
  if(name==='about')await page.screenshot({path:path.join(results,'cms-about-story-editable.png')});console.log('PASS real editor '+name+': content edit/publish/reopen; unrelated stored fields and body preserved');
 }
 const settingsEntry=config.collections.find(c=>c.name==='settings').files.find(f=>f.name==='settings');const oldSettings=YAML.parse(await fs.readFile(path.join(root,settingsEntry.file),'utf8'));await open('settings','settings');const shared=settingsEntry.fields.find(f=>f.name==='copy').fields.find(g=>g.name==='staff_profiles_11');await page.getByText(shared.summary,{exact:true}).last().getByRole('button',{name:'Expand',exact:true}).click();await field('profile_approach_heading').fill('SHARED_STAFF_HEADING_END');const settingsRaw=await publish(settingsEntry.file,'SHARED_STAFF_HEADING_END');const expectedSettings=structuredClone(oldSettings);expectedSettings.copy.staff_profiles_11.profile_approach_heading='SHARED_STAFF_HEADING_END';const savedSettings=YAML.parse(settingsRaw);for(const key of Object.keys(oldSettings))assert.deepEqual(savedSettings[key],expectedSettings[key],'Unrelated settings changed: '+key);written.push([settingsEntry.file,settingsRaw]);await open('settings','settings');await page.getByText(shared.summary,{exact:true}).last().getByRole('button',{name:'Expand',exact:true}).click();assert.equal(await field('profile_approach_heading').inputValue(),'SHARED_STAFF_HEADING_END');
 const dir=path.join(work,'render');await fs.mkdir(dir);const source=await fixture(dir);for(const[file,raw]of written)await fs.writeFile(path.join(source,file),raw);const dest=path.join(dir,'output');build(source,dest);
 for(const[file,marker]of markers){const relative=file==='content/_index.md'?'index.html':file.replace(/^content\//,'').replace(/(?:_index|index)\.md$/,'index.html');assert((await fs.readFile(path.join(dest,relative),'utf8')).includes(marker),file+': editor change not rendered');}
 for(const folder of await fs.readdir(path.join(source,'content/about/team'),{withFileTypes:true})){if(!folder.isDirectory())continue;const person=parse(await fs.readFile(path.join(source,'content/about/team',folder.name,'index.md'),'utf8')).data;if(person.draft)continue;const route=person.url||'/about/'+(person.slug||folder.name)+'/';const $=load(await fs.readFile(path.join(dest,route,'index.html'),'utf8'));assert.equal($('#profile-approach-title').text(),'SHARED_STAFF_HEADING_END');}
 assert.deepEqual(errors,[]);console.log('PASS all seven Site pages and shared staff labels: actual UI save/reopen and exact saved-output Hugo rebuild; isolated backend only');
} catch(error){if(page)console.log('PAGE AT FAILURE',await page.locator('body').innerText());throw error;}finally {await browser?.close();await server?.close();await cleanup(work);}
