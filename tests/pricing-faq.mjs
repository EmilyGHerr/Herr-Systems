import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import YAML from 'yaml';
import {load} from 'cheerio';
import {chromium,firefox} from 'playwright';
import {root,workspace,fixture,build,serve,cleanup} from './support.mjs';
const read=f=>readFile(f,'utf8');
const parse=s=>YAML.parse(s.match(/^---\n([\s\S]*?)\n---/)[1]);
const work=await workspace();let server;
try {
 const source=await fixture(work),out=path.join(work,'output');
 const file=path.join(source,'content/pricing/index.md');const original=await read(file),data=parse(original);
 const config=YAML.parse(await read(path.join(source,'static/sudo/config.yml')));
 const pricing=config.collections.flatMap(c=>c.files||[]).find(e=>e.file==='content/pricing/index.md');
 const field=pricing.fields.find(f=>f.name==='faq');assert.equal(field.widget,'object');
 for(const name of ['enabled','title','intro','items'])assert(field.fields.some(f=>f.name===name));
 assert.equal(field.fields.find(f=>f.name==='title').widget,'hidden');assert.equal(field.fields.find(f=>f.name==='intro').widget,'hidden');
 const items=field.fields.find(f=>f.name==='items');assert.equal(items.widget,'list');assert.equal(items.fields.find(f=>f.name==='answer').widget,'markdown');
 assert(data.faq.items.length>0);
 const save=async()=>writeFile(file,original.replace(/^---\n[\s\S]*?\n---/,'---\n'+YAML.stringify(data)+'---'));
 build(source,out);server=await serve(out);
 for(const engine of [chromium,firefox]) {
  const browser=await engine.launch();
  try {
   for(const width of [320,390,1440])for(const theme of ['dark','light']) {
    const page=await browser.newPage({viewport:{width,height:1000},javaScriptEnabled:false});
    await page.goto(server.url+'/pricing/');await page.locator('html').evaluate((e,t)=>e.dataset.theme=t,theme);
    const geometry=await page.evaluate(()=>{const faq=document.querySelector('.pricing-faq'),content=document.querySelector('.pricing-explainer-content');return {overflow:document.documentElement.scrollWidth>innerWidth+1,faq:faq.getBoundingClientRect().top,content:content.querySelector(':scope > p:last-of-type').getBoundingClientRect().bottom,inside:content.contains(faq)&&!!faq.closest('.pricing-explainer'),separateSections:faq.querySelectorAll('section,h2').length};});
    assert(!geometry.overflow);assert(geometry.inside);assert.equal(geometry.separateSections,0);assert(geometry.faq-geometry.content>=15&&geometry.faq-geometry.content<=40);
    const details=page.locator('.pricing-faq details');assert.equal(await details.count(),data.faq.items.length);
    const first=details.first();assert.equal(await first.getAttribute('open'),null);
    await first.locator('summary').focus();await page.keyboard.press('Enter');assert.notEqual(await first.getAttribute('open'),null);
    await page.keyboard.press('Space');assert.equal(await first.getAttribute('open'),null);
    for(const detail of await details.all()) {await detail.locator('summary').click();assert.notEqual(await detail.getAttribute('open'),null);}
    assert.equal(await page.locator('.pricing-faq a[href="/contact/"]').count(),1);
    console.log(`PASS ${engine.name()} ${width}px ${theme}: FAQ inside the same explanation block below its text, no overflow, native mouse/keyboard/no-JS accordions`);
    await page.close();
   }
  } finally {await browser.close();}
 }
 // Simulate Decap save, including all existing pricing content, new questions,
 // deletion/reordering, rich answers, visibility and empty states.
 data.hero_title='Edited pricing heading';data.subtitle='Edited pricing introduction';
 data.faq.items=[{question:'New first question',answer:'A **formatted** answer with [pricing](/pricing/).\n\n- One\n- Two'},...data.faq.items.slice(1).reverse()];
 await save();build(source,out);let $=load(await read(path.join(out,'pricing/index.html')));
 assert.equal($('#pricing-title').text(),'Edited pricing heading');assert($('.pricing-intro').text().includes('Edited pricing introduction'));
 assert.equal($('#pricing-faq-title').length,0);assert.equal($('.pricing-explainer .pricing-faq').length,1);
 assert.deepEqual($('.pricing-faq summary').map((_,e)=>$(e).text()).get(),data.faq.items.map(i=>i.question));
 assert.equal($('.pricing-faq .faq-answer').first().find('strong').text(),'formatted');assert.equal($('.pricing-faq .faq-answer').first().find('li').length,2);
 data.faq.enabled=false;await save();build(source,out);$=load(await read(path.join(out,'pricing/index.html')));assert.equal($('.pricing-faq').length,0);assert.equal(parse(await read(file)).faq.items.length,data.faq.items.length);
 data.faq.enabled=true;data.faq.items=[];await save();build(source,out);$=load(await read(path.join(out,'pricing/index.html')));assert.equal($('.pricing-faq').length,0);
 delete data.faq;await save();build(source,out);$=load(await read(path.join(out,'pricing/index.html')));assert.equal($('.pricing-faq').length,0);
 console.log('PASS Decap save/rebuild: existing pricing copy, inline accordions, add/delete/reorder, rich answers, hidden/empty/missing sections');
} finally {if(server)await server.close();await cleanup(work);}
