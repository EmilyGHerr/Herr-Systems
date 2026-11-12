import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import YAML from 'yaml';
import {load} from 'cheerio';
import {chromium,firefox} from 'playwright';
import {root,workspace,fixture,build,serve,cleanup} from './support.mjs';
const work=await workspace();let server;
const selectors={desktop:'.global-nav',mobile:'.mobile-nav',expanded:'.site-menu-links',services:'.site-menu-services',fallback:'.menu-fallback',footer:'.footer-info'};
try{
 const source=await fixture(work),out=path.join(work,'public'),file=path.join(source,'data/menus.yml');
 const original=YAML.parse(await fs.readFile(file,'utf8'));
 const config=YAML.parse(await fs.readFile(path.join(source,'static/sudo/config.yml'),'utf8'));
 const schema=config.collections.flatMap(c=>c.files||[]).find(f=>f.file==='data/menus.yml');assert(schema,'Dedicated menu editor');
 for(const key of Object.keys(selectors)){const f=schema.fields.find(f=>f.name===key);assert.equal(f.widget,'list');assert(f.summary.includes('label'));assert.deepEqual(f.default,[]);for(const name of ['label','url'])assert(f.fields.some(f=>f.name===name));}
 const read=async route=>load(await fs.readFile(path.join(out,route,'index.html'),'utf8'),{scriptingEnabled:false});
 const save=async data=>{await fs.writeFile(file,YAML.stringify(data));build(source,out);return read('');};
 let $=await save(original);
 for(const [key,selector]of Object.entries(selectors))assert.equal($(selector+' a').length,original[key].reduce((n,v)=>n+(v.children?.length||1),0),key+' current link count');
 // Legacy-only content must remain usable without restoring explicitly cleared lists.
 await fs.rm(file);build(source,out);$=await read('');
 for(const [key,selector]of Object.entries(selectors))assert.deepEqual($(selector+' a').map((i,e)=>({label:$(e).text().trim(),url:$(e).attr('href')})).get(),original[key].flatMap(v=>v.children?.length?v.children:[v]).map(v=>({label:v.label,url:v.url})),key+' legacy fallback');
 const edited=Object.fromEntries(Object.keys(selectors).map(key=>[key,[{label:key+' first',url:'/contact/?from='+key+'#main'},{label:key+' second',url:'https://example.com/'+key}]]));
 edited.desktop.splice(1,0,{label:'Custom dropdown',url:'',children:[{label:'Child B',url:'/blog/'},{label:'Child A',url:'/services/consulting/'}]});
 edited.mobile.push({label:'Extra link',url:'/pricing/'});
 $=await save(edited);
 for(const [key,selector]of Object.entries(selectors)){
  const expected=edited[key].flatMap(item=>item.children||[item]);
  assert.deepEqual($(selector+' a').map((i,e)=>$(e).text().trim()).get(),expected.map(x=>x.label));
  assert.deepEqual($(selector+' a').map((i,e)=>$(e).attr('href')).get(),expected.map(x=>x.url));
 }
 assert.equal($('.global-nav details summary').text().replace('▾','').trim(),'Custom dropdown');
 // Route overrides still resolve from stable site paths, preserving query/hash.
 const content=path.join(source,'content/contact/index.md');let raw=await fs.readFile(content,'utf8');raw=raw.replace(/^---\n/,'---\nurl: /talk-to-us/\n');await fs.writeFile(content,raw);build(source,out);$=await read('');
 assert.equal($('.global-nav a').first().attr('href'),'/talk-to-us/?from=desktop#main');
 // Active states belong to the actual destination, including moved pages.
 $=await read('talk-to-us');assert.equal($('.global-nav a').first().attr('aria-current'),'page');
 // Every menu accepts all safe link kinds; arbitrary markup is text, never HTML.
 const safe=['/blog/','https://example.com/','http://example.com/','mailto:hello@example.com','tel:+17177442552','#main'];
 const safeMenus=Object.fromEntries(Object.keys(selectors).map(key=>[key,safe.map((url,i)=>({label:'<img onerror=alert(1)> '+i,url}))]));
 $=await save(safeMenus);
 for(const selector of Object.values(selectors)){assert.equal($(selector+' a').length,safe.length);assert.equal($(selector+' img[onerror]').length,0);assert(!$(selector).html().includes('ZgotmplZ'));}
 const unsafe=['javascript:alert(1)','data:text/html,bad','//evil.example','/\\evil.example','https://example.com/\nbad'];
 const bad=Object.fromEntries(Object.keys(selectors).map(key=>[key,unsafe.map(url=>({label:'Unsafe',url}))]));
 try{$=await save(bad);for(const selector of Object.values(selectors))assert.equal($(selector+' a').length,0,'Invalid destinations cannot render');}catch(e){if(e.code==='ERR_ASSERTION')throw e;assert(String(e).includes('menu')||String(e).includes('URL'),'Invalid URL build failure is explicit');}
 const empty=Object.fromEntries(Object.keys(selectors).map(key=>[key,[]]));$=await save(empty);
 for(const selector of Object.values(selectors))assert.equal($(selector+' a').length,0,'Explicitly empty menu must stay empty');
 // More remains visible, and overflowing links retain usable target widths.
 safeMenus.mobile=Array.from({length:9},(_,i)=>({label:'Consulting Services '+i,url:'/blog/'}));
 await save(safeMenus);server=await serve(out);
 for(const engine of [chromium,firefox]){
  const browser=await engine.launch();try{const page=await browser.newPage();
   for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});await page.goto(server.url);await page.evaluate(()=>document.fonts.ready);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),engine.name()+' overflow at '+width);
    if(width===320){const geometry=await page.locator('.mobile-nav').evaluate(e=>({client:e.clientWidth,scroll:e.scrollWidth,widths:[...e.querySelectorAll('a')].map(a=>a.getBoundingClientRect().width),more:e.querySelector('[data-menu-open]').getBoundingClientRect().toJSON()}));assert(geometry.widths.every(w=>w>=72));assert(geometry.scroll>geometry.client);assert(geometry.more.x>=0&&geometry.more.right<=width+1);await page.locator('.mobile-nav').evaluate(e=>e.scrollLeft=e.scrollWidth);assert(await page.locator('.mobile-nav a').last().evaluate(e=>e.getBoundingClientRect().right<=innerWidth+1));}
    if(width===390){await page.locator('[data-menu-open]').click();assert(await page.locator('#site-menu').evaluate(e=>e.open));await page.keyboard.press('Escape');assert.equal(await page.locator('#site-menu').evaluate(e=>e.open),false);}
   }
  }finally{await browser.close();}
 }
 console.log('PASS menus: all six ordered lists, custom dropdowns/destinations, safe URLs/escaping, moved routes/active states, clearing, responsive Chromium/Firefox and mobile modal');
}finally{await server?.close();await cleanup(work);}
