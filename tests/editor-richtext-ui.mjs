// Real Decap UX; isolated seeded test-repo only. Run: node tests/editor-richtext-ui.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import YAML from 'yaml';
import {load} from 'cheerio';
import {chromium} from 'playwright';
import {root,workspace,fixture,build,serve,cleanup} from './support.mjs';
const parse=raw=>{const m=raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);assert(m);return {data:YAML.parse(m[1]),body:raw.slice(m[0].length)};};
const text=s=>s.replace(/\s+/g,' ').trim();
const work=await workspace();let browser,server,renderServer,page;
try {
 const config=YAML.parse(await fs.readFile(path.join(root,'static/sudo/config.yml'),'utf8'));
 const entry=config.collections.find(c=>c.name==='pages').files.find(f=>f.name==='about');
 const groups=entry.fields.find(f=>f.name==='copy').fields;
 const group=name=>groups.find(f=>f.name===name);
 const child=(parent,name)=>group(parent)?.fields.find(f=>f.name===name);
 const storySchema=child('detail_overview_4','story_body'),principleSchema=child('detail_fit_5','principles_items'),approachSchema=child('approach_8','approach_items');
 assert(storySchema&&principleSchema&&approachSchema,'BLOCKED: About rich-content schema needs story_body, principles_items and approach_items');
 assert.equal(storySchema.widget,'markdown');
 assert.deepEqual([...(storySchema.modes||['rich_text','raw'])].sort(),['raw','rich_text']);
 assert.equal(principleSchema.widget,'list');assert.equal(principleSchema.field?.widget,'markdown');assert(!principleSchema.fields);
 assert.equal(approachSchema.widget,'list');assert.equal(approachSchema.fields.find(f=>f.name==='title')?.widget,'string');assert.equal(approachSchema.fields.find(f=>f.name==='body')?.widget,'markdown');
 for(const key of ['p_26','p_27','p_28'])assert(!child('detail_overview_4',key),'Legacy paragraph control '+key);
 for(const key of ['li_19','li_20','li_21','li_22'])assert(!child('detail_fit_5',key),'Legacy bullet control '+key);
 const originalRaw=await fs.readFile(path.join(root,entry.file),'utf8'),before=parse(originalRaw);
 const originalStory=before.data.copy.detail_overview_4.story_body,originalPrinciples=before.data.copy.detail_fit_5.principles_items,originalApproach=before.data.copy.approach_8.approach_items;
 assert.equal(typeof originalStory,'string');assert(Array.isArray(originalPrinciples)&&originalPrinciples.length>0&&originalPrinciples.every(x=>typeof x==='string'));assert(Array.isArray(originalApproach));
 for(const key of ['p_26','p_27','p_28'])if(before.data.copy.detail_overview_4[key])assert(text(originalStory).includes(text(before.data.copy.detail_overview_4[key])),'Missing original paragraph '+key);
 const output=path.join(work,'public');build(root,output);server=await serve(output);
 const aboutRoute=before.data.url||'/about/';
 const initialDOM=load(await fs.readFile(path.join(output,aboutRoute,'index.html'),'utf8'));
 const originalRendered=initialDOM('.detail-checklist > li').toArray().map(e=>text(initialDOM(e).text()));
 assert.equal(originalRendered.length,originalPrinciples.length);
 const response=await fetch('https://unpkg.com/decap-cms@3.17.0/dist/decap-cms.js');assert(response.ok);const js=await response.text();
 const seed={};async function walk(dir){for(const e of await fs.readdir(path.join(root,dir),{withFileTypes:true})){const file=path.posix.join(dir,e.name);if(e.isDirectory())await walk(file);else{let o=seed;const parts=file.split('/');for(const part of parts.slice(0,-1))o=o[part]??={};o[parts.at(-1)]={path:file,content:await fs.readFile(path.join(root,file),'utf8')};}}}await walk('content');await walk('data');
 browser=await chromium.launch();const context=await browser.newContext({viewport:{width:1440,height:1000}});page=await context.newPage();page.setDefaultTimeout(15000);
 const errors=[],forbidden=[];page.on('pageerror',e=>errors.push(e.message));
 // Fail closed against forms, real Git backends and authentication APIs.
 await context.route('**/*',async r=>{const q=r.request(),u=new URL(q.url());if(!['GET','HEAD'].includes(q.method())||/(?:github|gitlab|bitbucket|identity|netlify|auth)/i.test(u.hostname)||u.pathname.startsWith('/api/')){forbidden.push(q.method()+' '+q.url());return r.abort('blockedbyclient');}return r.continue();});
 await page.addInitScript(seed=>{window.repoFiles=seed;},seed);
 await page.route('**/decap-cms.js',r=>r.fulfill({contentType:'text/javascript',body:js}));
 await page.route('**/config.yml',r=>{const c=structuredClone(config);c.backend={name:'test-repo'};c.publish_mode='simple';delete c.local_backend;return r.fulfill({contentType:'text/yaml',body:YAML.stringify(c)});});
 await page.goto(server.url+'/sudo/');await page.getByRole('button',{name:'Login',exact:true}).click();
 const field=name=>page.locator('[id^="'+name+'-field-"]').first();
 async function open(){await page.evaluate(()=>{location.hash='#/collections/pages';});await page.getByRole('link',{name:entry.label,exact:true}).waitFor();await page.evaluate(()=>{location.hash='#/collections/pages/entries/about';});await field('story_title_1').waitFor();}
 async function expandGroup(name,key){if(await field(key).isVisible())return;await page.getByText(group(name).summary,{exact:true}).last().getByRole('button',{name:'Expand',exact:true}).click();await field(key).waitFor();}
 // Markdown roots omit forID. Both rich AND raw are contenteditables in pinned Decap (Slate, not ProseMirror).
 const markdown=(name,scope=page)=>scope.locator('label[for^="'+name+'-field-"]').first().locator('xpath=ancestor::*[.//*[contains(@class,"cms-editor-")]][1]');
 const editable=scope=>scope.locator('[contenteditable="true"]').filter({visible:true}).first();
 async function mode(scope,raw){const target=scope.locator(raw?'.cms-editor-raw':'.cms-editor-visual');if(!await target.isVisible())await scope.getByRole('switch').click();await target.waitFor();return editable(target);}
 async function replaceRaw(scope,value){const editor=await mode(scope,true);await editor.click();await page.keyboard.press('ControlOrMeta+A');await page.keyboard.press('Backspace');const lines=value.split('\n');for(let i=0;i<lines.length;i++){if(i)await page.keyboard.press('Enter');if(lines[i])await page.keyboard.insertText(lines[i]);}await editor.press('Tab');}
 async function readRaw(scope){return (await(await mode(scope,true)).evaluate(e=>Array.from(e.children).map(line=>line.textContent.replace(/\uFEFF/g,'')).join('\n'))).trim();}
 const parts=entry.file.split('/');
 const saved=()=>page.evaluate(parts=>parts.reduce((o,k)=>o[k],window.repoFiles).content,parts);
 async function publish(){const previous=await saved();await page.getByRole('button',{name:'Publish',exact:true}).click();await page.getByText('Publish now',{exact:true}).click();await page.waitForFunction(({parts,previous})=>parts.reduce((o,k)=>o?.[k],window.repoFiles)?.content!==previous,{parts,previous});return saved();}
 function preserve(raw,changes){const actual=parse(raw),expected=structuredClone(before.data);for(const [section,key,value]of changes)expected.copy[section][key]=value;assert.deepEqual(actual.data,expected,'Unrelated front matter changed');assert.equal(actual.body.trim(),before.body.trim(),'Unrelated Markdown body changed');}
 const dir=path.join(work,'render');await fs.mkdir(dir);const source=await fixture(dir),dest=path.join(dir,'output'),renderPage=await context.newPage();
 async function render(raw){await fs.writeFile(path.join(source,entry.file),raw);build(source,dest);renderServer??=await serve(dest);const html=await fs.readFile(path.join(dest,aboutRoute,'index.html'),'utf8');assert(!/<p\b[^>]*>(?:(?!<\/p>)[\s\S])*<(?:p|div|ul|ol|h[1-6])\b/i.test(html),'Invalid nested paragraph/block HTML in generated source');await renderPage.goto(renderServer.url+aboutRoute);assert.equal(await renderPage.locator('p p, p > ul, p > ol').count(),0);const $=load(await renderPage.content());heading($);return $;}
 function heading($){assert.equal(text($('.detail-overview h2').first().text()),text(before.data.copy.detail_overview_4.story_title_1));assert.equal(text($('#principles-title').text()),text(before.data.copy.detail_fit_5.principles_title_1));assert.equal(text($('#approach-title').text()),text(before.data.copy.approach_8.approach_title_1));}
 await open();const story=markdown('story_body');await story.locator('.cms-editor-visual').waitFor();assert.equal(await story.locator('[contenteditable="true"]').count(),1);
 assert.equal(await readRaw(story),originalStory.trim(),'One field must contain the complete original story');
 const rich=await mode(story,false);
 // Exercise actual WYSIWYG typing and formatting toolbar, never innerHTML/app state.
 await rich.fill('UI story ');await rich.press('End');
 await story.getByTitle('Bold',{exact:true}).click();await page.keyboard.insertText('careful bold');await story.getByTitle('Bold',{exact:true}).click();
 await page.keyboard.insertText(' and ');await story.getByTitle('Italic',{exact:true}).click();await page.keyboard.insertText('human emphasis');await story.getByTitle('Italic',{exact:true}).click();await page.keyboard.insertText('.');await page.keyboard.press('Enter');await page.keyboard.insertText('Another paragraph with ');
 await page.keyboard.insertText('a useful link');for(const character of 'a useful link')await page.keyboard.press('Shift+ArrowLeft');
 page.once('dialog',dialog=>dialog.accept('https://example.org/rich-story'));
 await story.getByTitle('Link',{exact:true}).click();
 await rich.locator('strong, b').waitFor();assert.equal(await rich.locator('em, i').innerText(),'human emphasis');assert.equal(await rich.locator('a').innerText(),'a useful link');
 const richSaved=await publish(),richData=parse(richSaved).data.copy.detail_overview_4.story_body;
 assert.match(richData,/\*\*careful bold\*\*/);assert.match(richData,/(?:\*human emphasis\*|_human emphasis_)/);assert.match(richData,/\[a useful link\]\(https:\/\/example\.org\/rich-story\)/);assert.match(richData,/\.\s*\n\s*\nAnother paragraph/);
 preserve(richSaved,[['detail_overview_4','story_body',richData]]);await open();assert.equal(await readRaw(markdown('story_body')),richData.trim());
 let $=await render(richSaved);heading($);assert.equal($('.detail-overview strong').text(),'careful bold');assert.equal($('.detail-overview em').text(),'human emphasis');assert.equal($('.detail-overview a[href="https://example.org/rich-story"]').text(),'a useful link');assert.equal($('.detail-overview p').filter((_,e)=>/UI story|Another paragraph/.test($(e).text())).length,2);
 const rawStory='Raw story **still bold** with *still emphasis* and [raw link](https://example.org/raw-story).\n\nSecond raw paragraph.\n\nThird raw paragraph.';
 await replaceRaw(markdown('story_body'),rawStory);const rawSaved=await publish();assert.equal(parse(rawSaved).data.copy.detail_overview_4.story_body.trim(),rawStory);
 const changes=[['detail_overview_4','story_body',parse(rawSaved).data.copy.detail_overview_4.story_body]];preserve(rawSaved,changes);await open();assert.equal(await readRaw(markdown('story_body')),rawStory);await mode(markdown('story_body'),false);
 $=await render(rawSaved);heading($);assert.equal($('.detail-overview strong').text(),'still bold');assert.equal($('.detail-overview em').text(),'still emphasis');assert.equal($('.detail-overview a[href="https://example.org/raw-story"]').text(),'raw link');assert.equal($('.detail-overview p').filter((_,e)=>/Raw story|Second raw|Third raw/.test($(e).text())).length,3);
 const topbars=list=>list.locator('[class*="StyledListItemTopBar"]'),row=(list,i)=>topbars(list).nth(i).locator('..');
 async function expandRow(list,i){const item=row(list,i);if(!await item.locator('[contenteditable="true"], input').filter({visible:true}).count())await topbars(list).nth(i).locator('button').first().click();return item;}
 async function add(list,schema){const old=await topbars(list).count(),label=(schema.label_singular||schema.label||schema.name).toLowerCase();await list.getByRole('button',{name:'Add '+label,exact:true}).click();await page.waitForFunction(({id,count})=>document.getElementById(id)?.querySelectorAll('[class*="StyledListItemTopBar"]').length===count,{id:await list.getAttribute('id'),count:old+1});return schema.add_to_top?0:old;}
 async function remove(list,i){const old=await topbars(list).count();await topbars(list).nth(i).locator('button').last().click();assert.equal(await topbars(list).count(),old-1);}
 async function move(list,from,to){
  // Decap supplies icon-only remove/expand buttons and a pointer drag handle, NOT move up/down.
  for(let i=0;i<await topbars(list).count();i++)if(await row(list,i).locator('[contenteditable="true"], input').filter({visible:true}).count())await topbars(list).nth(i).locator('button').first().click();
  const handle=topbars(list).nth(from).locator('[role="button"]'),target=topbars(list).nth(to);await target.scrollIntoViewIfNeeded();await handle.scrollIntoViewIfNeeded();const a=await handle.boundingBox(),b=await target.boundingBox();assert(a&&b,'Missing list drag handle');await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(a.x+a.width/2,a.y+a.height/2-8,{steps:3});await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:25});await page.mouse.up();
 }
 await expandGroup('detail_fit_5','principles_items');const principles=field('principles_items');assert.equal(await topbars(principles).count(),originalPrinciples.length);
 assert((await row(principles,0).innerText()).includes(originalPrinciples[0]),'Collapsed principle must show its content, not a generic Item label');
 const newPrinciple='UI principle **clear choices** with *care* and [details](https://example.org/principle).';let newIndex=await add(principles,principleSchema);await replaceRaw(await expandRow(principles,newIndex),newPrinciple);
 const expectedPrinciples=[...originalPrinciples],expectedTexts=[...originalRendered];expectedPrinciples.splice(newIndex,0,newPrinciple);expectedTexts.splice(newIndex,0,'UI principle clear choices with care and details.');
 const removed=principleSchema.add_to_top?1:0;await remove(principles,removed);expectedPrinciples.splice(removed,1);expectedTexts.splice(removed,1);
 if(expectedPrinciples.length<2){const i=await add(principles,principleSchema);await replaceRaw(await expandRow(principles,i),'UI second sortable principle.');expectedPrinciples.splice(i,0,'UI second sortable principle.');expectedTexts.splice(i,0,'UI second sortable principle.');}
 newIndex=expectedPrinciples.indexOf(newPrinciple);const targetIndex=newIndex===0?1:newIndex-1;await move(principles,newIndex,targetIndex);expectedPrinciples.splice(targetIndex,0,expectedPrinciples.splice(newIndex,1)[0]);expectedTexts.splice(targetIndex,0,expectedTexts.splice(newIndex,1)[0]);
 const listSaved=await publish();assert.deepEqual(parse(listSaved).data.copy.detail_fit_5.principles_items,expectedPrinciples,'UI add/remove/drag saved unexpected list/order');changes.push(['detail_fit_5','principles_items',expectedPrinciples]);preserve(listSaved,changes);await open();await expandGroup('detail_fit_5','principles_items');
 for(let i=0;i<expectedPrinciples.length;i++)assert.equal(await readRaw(await expandRow(field('principles_items'),i)),expectedPrinciples[i].trim(),'Reopened principle order/value');
 $=await render(listSaved);assert.deepEqual($('.detail-checklist > li').toArray().map(e=>text($(e).text())),expectedTexts);assert.equal($('.detail-checklist strong').text(),'clear choices');assert.equal($('.detail-checklist em').text(),'care');assert.equal($('.detail-checklist a[href="https://example.org/principle"]').text(),'details');
 await expandGroup('approach_8','approach_items');const approaches=field('approach_items'),expectedApproach=structuredClone(originalApproach),addedSteps=Math.max(1,4-originalApproach.length);
 for(let i=0;i<addedSteps;i++){const index=await add(approaches,approachSchema),item=await expandRow(approaches,index),step={title:'UI added approach '+(i+1),body:'Approach **thoughtful work** with *clarity* and [next steps](https://example.org/approach).\n\nA second step paragraph.'};await item.locator('input[id^="title-field-"]').fill(step.title);await replaceRaw(markdown('body',item),step.body);expectedApproach.splice(index,0,step);}
 const approachSaved=await publish();assert.deepEqual(parse(approachSaved).data.copy.approach_8.approach_items,expectedApproach);changes.push(['approach_8','approach_items',expectedApproach]);preserve(approachSaved,changes);await open();await expandGroup('approach_8','approach_items');
 for(let i=0;i<expectedApproach.length;i++){const item=await expandRow(field('approach_items'),i);assert.equal(await item.locator('input[id^="title-field-"]').inputValue(),expectedApproach[i].title);assert.equal(await readRaw(markdown('body',item)),expectedApproach[i].body.trim());}
 $=await render(approachSaved);assert.deepEqual($('.detail-process h3').toArray().map(e=>text($(e).text())),expectedApproach.map(x=>text(x.title)));assert.deepEqual($('.detail-process .detail-step').toArray().map(e=>$(e).text().trim()),expectedApproach.map((_,i)=>String(i+1).padStart(2,'0')),'Automatic approach numbering');assert.equal($('.detail-process strong').filter((_,e)=>$(e).text()==='thoughtful work').length,addedSteps);assert.equal($('.detail-process em').filter((_,e)=>$(e).text()==='clarity').length,addedSteps);assert.equal($('.detail-process a[href="https://example.org/approach"]').length,addedSteps);assert.equal($('.detail-process > li').length,expectedApproach.length);assert.equal($('.detail-process p').filter((_,e)=>$(e).text()==='A second step paragraph.').length,addedSteps);
 // Explicit [] must clear content, never resurrect li_19..li_22 fallbacks.
 await expandGroup('detail_fit_5','principles_items');while(await topbars(field('principles_items')).count())await remove(field('principles_items'),0);
 const zeroSaved=await publish();assert.deepEqual(parse(zeroSaved).data.copy.detail_fit_5.principles_items,[],'Empty list must be stored as []');changes.find(x=>x[1]==='principles_items')[2]=[];preserve(zeroSaved,changes);await open();await expandGroup('detail_fit_5','principles_items');assert.equal(await topbars(field('principles_items')).count(),0);
 $=await render(zeroSaved);assert.equal($('.detail-checklist > li').length,0,'Empty list resurrected legacy bullets');heading($);assert.equal($('.detail-process h3').length,expectedApproach.length);assert.equal($('.detail-overview strong').text(),'still bold');
 assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[],'Unexpected form/Git/auth requests');assert.equal(await fs.readFile(path.join(root,entry.file),'utf8'),originalRaw,'Source content mutated');
 console.log('PASS real Decap About: story WYSIWYG/raw save/reopen, Markdown list add/remove/drag/clear, approach add/auto-number; exact saved-record Hugo rebuild/live rendered DOM; unrelated fields/body preserved; isolated backend only.');
} catch(error){if(page)console.error('PAGE AT FAILURE',await page.locator('body').innerText().catch(()=>'<closed>'));throw error;}finally{await browser?.close();await renderServer?.close();await server?.close();await cleanup(work);}
