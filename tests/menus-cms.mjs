// Actual pinned Decap UI; isolated test-repo only, never production auth or Git writes.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import YAML from 'yaml';
import {load} from 'cheerio';
import {chromium} from 'playwright';
import {root,workspace,fixture,build,serve,cleanup} from './support.mjs';
const work=await workspace();let browser,server,page;
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

 const menuSchema=config.collections.flatMap(c=>c.files||[]).find(f=>f.file==='data/menus.yml');assert(menuSchema);
 async function open(){await page.evaluate(()=>location.hash='#/collections/settings');const link=page.locator('a[href*="/collections/settings/entries/'+menuSchema.name+'"]').first();await link.waitFor();await link.click();await page.locator('[id^=\"desktop-field-\"]').first().waitFor();}
 const record=()=>page.evaluate(()=>window.repoFiles.data['menus.yml'].content);
 const before=YAML.parse(await record());
 await open();

 const field=name=>page.locator('[id^="'+name+'-field-"]').filter({visible:true}).first();
 // Exercise the flat expanded list; desktop child rendering is covered in menus.mjs.
 const tops=list=>list.locator('[class*="StyledListItemTopBar"]').filter({has:page.locator('[role="button"]')});
 const row=(list,i)=>tops(list).nth(i).locator('..');
 async function expand(list,i){
  const item=row(list,i),input=item.locator('input').filter({visible:true}).first();
  // The drag library can consume the next click after drop. Retry only opening
  // the row; retain the actual field-edit, publish and exact persistence checks.
  for(let attempt=0;attempt<3;attempt++){
   if(await input.isVisible())return item;
   await tops(list).nth(i).locator('button').first().click();
   try{await input.waitFor({state:'visible',timeout:1000});return item;}catch(e){if(attempt===2)throw e;}
  }
 }

 async function publish(previous){
  for(let attempt=0;attempt<3;attempt++){
   await page.getByRole('button',{name:'Publish',exact:true}).click();
   try{await page.getByText('Publish now',{exact:true}).waitFor({timeout:1500});break;}catch(e){if(attempt===2)throw e;}
  }
  await page.getByText('Publish now',{exact:true}).click();
  await page.waitForFunction(previous=>window.repoFiles.data['menus.yml'].content!==previous,previous);
  return record();
 }
 const expected=structuredClone(before);
 // Every menu surface uses the actual editor controls, not injected app state.
 for(const key of ['desktop','mobile','services','fallback','footer']){
  const list=field(key),top=list.locator('[class*="StyledListItemTopBar"]').first();
  await top.locator('button').first().click();
  await list.locator('input[id^="label-field-"]').filter({visible:true}).first().fill('Edited '+key);
  await list.locator('input[id^="url-field-"]').filter({visible:true}).first().fill('/blog/?menu='+key);
  expected[key][0].label='Edited '+key;expected[key][0].url='/blog/?menu='+key;
 }
 const children=field('desktop').locator('[id^="children-field-"]').first();
 await children.locator('[class*="StyledListItemTopBar"]').first().locator('button').first().click();
 await children.locator('input[id^="label-field-"]').filter({visible:true}).first().fill('Edited dropdown child');
 await children.locator('input[id^="url-field-"]').filter({visible:true}).first().fill('/services/consulting/?menu=child');
 expected.desktop[0].children[0].label='Edited dropdown child';expected.desktop[0].children[0].url='/services/consulting/?menu=child';
 // Exercise the nested list's actual add/remove/drag controls too.
 {
  const childSchema=menuSchema.fields.find(f=>f.name==='desktop').fields.find(f=>f.name==='children');
  const count=await tops(children).count();
  await children.getByRole('button',{name:'Add '+(childSchema.label_singular||childSchema.label||childSchema.name).toLowerCase(),exact:true}).click();
  const index=childSchema.add_to_top?0:count,newRow=await expand(children,index);
  await newRow.locator('input[id^="label-field-"]').fill('Added dropdown child');
  await newRow.locator('input[id^="url-field-"]').fill('/pricing/?menu=new-child');
  expected.desktop[0].children.splice(index,0,{label:'Added dropdown child',url:'/pricing/?menu=new-child'});
  await tops(children).nth(1).locator('button').last().click();expected.desktop[0].children.splice(1,1);
  for(let i=0;i<await tops(children).count();i++)if(await row(children,i).locator('input').filter({visible:true}).count())await tops(children).nth(i).locator('button').first().click();
  const from=expected.desktop[0].children.findIndex(x=>x.label==='Added dropdown child'),to=0;
  const handle=tops(children).nth(from).locator('[role="button"]'),target=tops(children).nth(to);
  await target.scrollIntoViewIfNeeded();await handle.scrollIntoViewIfNeeded();const a=await handle.boundingBox(),b=await target.boundingBox();assert(a&&b);
  await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(a.x+a.width/2,a.y+a.height/2-8,{steps:3});await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:25});await page.mouse.up();
  expected.desktop[0].children.splice(to,0,expected.desktop[0].children.splice(from,1)[0]);
 }
 // Use a flat list for real add/remove/drag without nested list ambiguity.
 const key='expanded',schema=menuSchema.fields.find(f=>f.name===key),list=field(key);
 const count=await tops(list).count();assert.equal(count,before[key].length);
 const first=await expand(list,0);
 await first.locator('input[id^="label-field-"]').fill('Edited menu label');
 await first.locator('input[id^="url-field-"]').fill('/contact/?menu=edited#main');
 expected[key][0].label='Edited menu label';expected[key][0].url='/contact/?menu=edited#main';
 await list.getByRole('button',{name:'Add '+(schema.label_singular||schema.label||schema.name).toLowerCase(),exact:true}).click();
 const index=schema.add_to_top?0:count,newRow=await expand(list,index);
 await newRow.locator('input[id^="label-field-"]').fill('Added external link');
 await newRow.locator('input[id^="url-field-"]').fill('https://example.org/from-menu');
 expected[key].splice(index,0,{label:'Added external link',url:'https://example.org/from-menu'});
 const removeIndex=1;await tops(list).nth(removeIndex).locator('button').last().click();expected[key].splice(removeIndex,1);
 // Collapse before dragging; make the added item the first entry.
 for(let i=0;i<await tops(list).count();i++)if(await row(list,i).locator('input').filter({visible:true}).count())await tops(list).nth(i).locator('button').first().click();
 const from=expected[key].findIndex(x=>x.label==='Added external link'),to=from===0?1:0;
 const handle=tops(list).nth(from).locator('[role="button"]'),target=tops(list).nth(to);
 await target.scrollIntoViewIfNeeded();await handle.scrollIntoViewIfNeeded();
 const a=await handle.boundingBox(),b=await target.boundingBox();assert(a&&b);
 await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(a.x+a.width/2,a.y+a.height/2-8,{steps:3});await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:25});await page.mouse.up();
 expected[key].splice(to,0,expected[key].splice(from,1)[0]);
 const previous=await record(),raw=await publish(previous),after=YAML.parse(raw);
 assert.deepEqual(after,expected,'Exact saved add/remove/drag order and all other menus preserved');
 await open();const reopened=field(key);for(let i=0;i<expected[key].length;i++)assert((await row(reopened,i).innerText()).includes(expected[key][i].label));
 const renderWork=path.join(work,'render');await fs.mkdir(renderWork);const source=await fixture(renderWork),out=path.join(renderWork,'public');
 await fs.writeFile(path.join(source,'data/menus.yml'),raw);build(source,out);
 const $=load(await fs.readFile(path.join(out,'index.html'),'utf8'));
 for(const [key,selector]of Object.entries({desktop:'.global-nav',mobile:'.mobile-nav',expanded:'.site-menu-links',services:'.site-menu-services',fallback:'.menu-fallback',footer:'.footer-info'})){
  const expectedLinks=expected[key].flatMap(x=>x.children?.length?x.children:[x]).map(x=>({label:x.label,url:x.url}));
  const dom=key==='fallback'?load(await fs.readFile(path.join(out,'index.html'),'utf8'),{scriptingEnabled:false}):$;
  assert.deepEqual(dom(selector+' a').map((i,e)=>({label:dom(e).text().trim(),url:dom(e).attr('href')})).get(),expectedLinks,key+' saved-output links');
 }

 // Clearing all dropdown children converts the parent to a direct link.
 await open();await field('desktop').locator('[class*="StyledListItemTopBar"]').first().locator('button').first().click();
 const clear=field('desktop').locator('[id^="children-field-"]').first();
 while(await tops(clear).count())await tops(clear).first().locator('button').last().click();
 expected.desktop[0].children=[];
 const cleared=await publish(await record());assert.deepEqual(YAML.parse(cleared),expected);
 await open();await field('desktop').locator('[class*="StyledListItemTopBar"]').first().locator('button').first().click();
 assert.equal(await tops(field('desktop').locator('[id^="children-field-"]').first()).count(),0);
 await fs.writeFile(path.join(source,'data/menus.yml'),cleared);build(source,out);
 const direct=load(await fs.readFile(path.join(out,'index.html'),'utf8'));
 assert.equal(direct('.global-nav > a').first().text().trim(),expected.desktop[0].label);
 assert.equal(direct('.global-nav > a').first().attr('href'),expected.desktop[0].url);
 assert.equal(direct('.global-nav details summary').filter((i,e)=>direct(e).text().includes(expected.desktop[0].label)).length,0);
 assert.deepEqual(errors,[]);
 console.log('PASS actual Decap menus: label + URL edit, add/remove, pointer drag reorder, publish/reopen, all six menu surfaces, unchanged unrelated fields, exact saved-record rebuild');
}catch(e){if(page)console.log('FAILURE UI',await page.locator('body').innerText());throw e;}finally{await browser?.close();await server?.close();await cleanup(work);}
