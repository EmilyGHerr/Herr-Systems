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
 const file=path.join(source,'content/contact/index.md');const original=await read(file),data=parse(original);
 const config=YAML.parse(await read(path.join(source,'static/sudo/config.yml')));
 const contact=config.collections.flatMap(c=>c.files||[]).find(e=>e.file==='content/contact/index.md');
 const field=contact.fields.find(f=>f.name==='faq');assert.equal(field.widget,'object');
 for(const name of ['enabled','title','intro','items'])assert(field.fields.some(f=>f.name===name));
 const items=field.fields.find(f=>f.name==='items');assert.equal(items.widget,'list');assert.equal(items.fields.find(f=>f.name==='answer').widget,'markdown');
 assert(data.faq.items.length>0);
 const save=async()=>writeFile(file,original.replace(/^---\n[\s\S]*?\n---/,'---\n'+YAML.stringify(data)+'---'));
 build(source,out);server=await serve(out);
 for(const engine of [chromium,firefox]) {
  const browser=await engine.launch();
  try {
   for(const width of [320,390,1440])for(const theme of ['dark','light']) {
    const page=await browser.newPage({viewport:{width,height:1000},javaScriptEnabled:false});
    await page.goto(server.url+'/contact/');await page.locator('html').evaluate((e,t)=>e.dataset.theme=t,theme);
    const geometry=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,faq:document.querySelector('.contact-faq').getBoundingClientRect().top,content:document.querySelector('.desk-layout').getBoundingClientRect().bottom}));
    assert(!geometry.overflow);assert(geometry.faq-geometry.content>=35);
    const details=page.locator('.contact-faq details');assert.equal(await details.count(),data.faq.items.length);
    const first=details.first();assert.equal(await first.getAttribute('open'),null);
    await first.locator('summary').focus();await page.keyboard.press('Enter');assert.notEqual(await first.getAttribute('open'),null);
    await page.keyboard.press('Space');assert.equal(await first.getAttribute('open'),null);
    for(const detail of await details.all()) {await detail.locator('summary').click();assert.notEqual(await detail.getAttribute('open'),null);}
    assert.equal(await page.locator('.contact-faq a[href="/pricing/"]').count(),1);
    console.log(`PASS ${engine.name()} ${width}px ${theme}: FAQ below content, no overflow, native mouse/keyboard/no-JS accordions`);
    await page.close();
   }
  } finally {await browser.close();}
 }
 // Simulate Decap save, including all existing contact content, new questions,
 // deletion/reordering, rich answers, visibility and empty states.
 data.hero_title='Edited contact heading';data.subtitle='Edited contact introduction';
 data.copy.desk_field_6.label_6='Edited name label';data.copy.desk_direct_12.direct_48='Edited sidebar text';
 data.faq.title='Edited FAQ heading';data.faq.intro='Edited FAQ introduction';
 data.faq.items=[{question:'New first question',answer:'A **formatted** answer with [pricing](/pricing/).\n\n- One\n- Two'},...data.faq.items.slice(1).reverse()];
 await save();build(source,out);let $=load(await read(path.join(out,'contact/index.html')));
 assert.equal($('#contact-title').text(),'Edited contact heading');assert.equal($('.desk-lead').text(),'Edited contact introduction');
 assert($('label[for="inquiry-name"]').text().includes('Edited name label'));assert($('.desk-direct').text().includes('Edited sidebar text'));
 assert.equal($('#contact-faq-title').text(),data.faq.title);assert($('.contact-faq').text().includes(data.faq.intro));
 assert.deepEqual($('.contact-faq summary').map((_,e)=>$(e).text()).get(),data.faq.items.map(i=>i.question));
 assert.equal($('.contact-faq .faq-answer').first().find('strong').text(),'formatted');assert.equal($('.contact-faq .faq-answer').first().find('li').length,2);
 data.faq.enabled=false;await save();build(source,out);$=load(await read(path.join(out,'contact/index.html')));assert.equal($('.contact-faq').length,0);assert.equal(parse(await read(file)).faq.items.length,data.faq.items.length);
 data.faq.enabled=true;data.faq.items=[];await save();build(source,out);$=load(await read(path.join(out,'contact/index.html')));assert.equal($('.contact-faq').length,0);
 delete data.faq;await save();build(source,out);$=load(await read(path.join(out,'contact/index.html')));assert.equal($('.contact-faq').length,0);
 console.log('PASS Decap save/rebuild: existing contact copy, FAQ heading/intro, add/delete/reorder, rich answers, hidden/empty/missing sections');
} finally {if(server)await server.close();await cleanup(work);}
