import {chromium} from '/home/syzygy/herr-systems-brutalist-templates/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import {readdir,mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
const root='/home/syzygy/herr-systems-brutalist-hugo',origin='http://127.0.0.1:8106';
const routes=[];
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())await walk(f);else if(e.name==='index.html'&&!(await readFile(f,'utf8')).includes('http-equiv="refresh"'))routes.push('/'+path.relative(root+'/public',f).replace(/index\.html$/,''));}}
await walk(root+'/public');
const browser=await chromium.launch(),page=await browser.newPage(),errors=[],posts=[],external=[],failures=[];let checks=0;
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST')posts.push(r.url());if(!r.url().startsWith(origin)&&!r.url().startsWith('data:'))external.push(r.url());});
await mkdir(root+'/tests/test-results',{recursive:true});
try{
for(const route of routes.filter(r=>!r.includes('/page/'))){
 await page.goto(origin+route);if(!await page.locator('main').count())continue;
 for(const width of [320,375,720,801,1024,1440,1920])for(const theme of ['dark','light']){
  await page.setViewportSize({width,height:1000});await page.goto(origin+route);
  if(theme==='light')await page.locator('[data-theme-toggle]').click();
  await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(30);
  const state=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,theme:document.documentElement.dataset.theme,main:document.querySelectorAll('main').length,broken:[...document.images].filter(i=>i.getBoundingClientRect().width&&!i.complete||i.complete&&i.naturalWidth===0).map(i=>i.src)}));
  if(state.overflow)failures.push(`Overflow ${route} ${width} ${theme}`);
  assert.equal(state.theme,theme);assert.equal(state.main,1);assert.deepEqual(state.broken,[]);
  if(route==='/'){
   const g=await page.evaluate(()=>{const c=document.querySelector('.hero-copy').getBoundingClientRect(),t=document.querySelector('.hero-terminal').getBoundingClientRect(),h=document.querySelector('.hero-band').getBoundingClientRect(),b=document.querySelector('.masthead-band').getBoundingClientRect(),input=document.querySelector('#terminal-command').getBoundingClientRect(),out=document.querySelector('.terminal-output');return {copy:{x:c.x,y:c.y,right:c.right,bottom:c.bottom,w:c.width},term:{x:t.x,y:t.y,right:t.right,bottom:t.bottom,w:t.width,h:t.height},inputBottom:input.bottom,bandTop:h.top,headerBottom:b.bottom,initialOverflow:out.scrollHeight>out.clientHeight+1,nav:document.querySelector('.masthead>nav').getBoundingClientRect().right,headerInner:document.querySelector('.masthead').getBoundingClientRect().right};});
   if(width>1000){assert.ok(g.term.x>=g.copy.right-1,JSON.stringify(g));assert.ok(Math.abs(g.copy.w-g.term.w)<1);}
   if(width<=720){assert.ok(g.term.bottom<=g.copy.y+1);assert.ok(g.term.h<=360.5);assert.ok(g.term.h<=g.term.w*.8+1);}
   assert.ok(g.inputBottom<=g.term.bottom);assert.ok(!g.initialOverflow,`Initial art clipped ${width}/${theme}`);assert.ok(Math.abs(g.bandTop-g.headerBottom)<1);
   if(width>800)assert.ok(Math.abs(g.nav-g.headerInner)<1);
   if([375,1440].includes(width))await page.screenshot({path:root+`/tests/test-results/home-${width}-${theme}.png`,fullPage:true});
  }
  checks++;
 }
}
await page.setViewportSize({width:1440,height:1000});await page.goto(origin+'/');
const input=page.locator('#terminal-command');await input.fill('herr -services');await input.press('Enter');await page.waitForFunction(()=>document.querySelectorAll('.terminal-result-list a').length===6);assert.equal(await page.locator('.terminal-result-list a').count(),6);
await input.fill('unfinished');await input.press('ArrowUp');assert.equal(await input.inputValue(),'herr -services');await input.press('ArrowDown');assert.equal(await input.inputValue(),'unfinished');await input.fill('herr -hel');await input.press('Tab');assert.equal((await input.inputValue()).trim(),'herr -help');await input.press('Tab');assert.notEqual(await page.evaluate(()=>document.activeElement.id),'terminal-command');
await input.fill('<img src=x onerror=alert(1)>');await input.press('Enter');assert.equal(await page.locator('.terminal-output img').count(),0);
await input.fill('herr -help');await input.press('Enter');assert.ok((await page.locator('.terminal-output').innerText()).includes('not a system shell'));
await input.fill('clear');await input.press('Enter');assert.equal(await page.locator('.terminal-output>*').count(),0);
await page.setViewportSize({width:375,height:900});await page.goto(origin+'/');await page.locator('[data-menu-open]').click();await page.waitForFunction(()=>document.querySelector('#site-menu').matches(':modal'));await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#site-menu').open);
for(const route of ['/contact/','/pricing/']){await page.goto(origin+route);assert.equal(await page.locator('[data-inquiry-form]').getAttribute('data-endpoint-enabled'),'false');assert.equal(await page.locator('[data-inquiry-form]').getAttribute('method'),'dialog');}
const nojs=await browser.newContext({javaScriptEnabled:false});const n=await nojs.newPage();n.on('request',r=>{if(r.method()==='POST')posts.push(r.url());});for(const route of ['/contact/','/pricing/']){await n.goto(origin+route);const before=n.url();await n.locator('[data-inquiry-form]').evaluate(f=>HTMLFormElement.prototype.submit.call(f));await n.waitForTimeout(100);assert.equal(n.url(),before);}await nojs.close();
for(const route of ['/sudo/','/sudo/config.yml','/api/inquiries'])assert.equal((await page.request.get(origin+route)).status(),404);
assert.deepEqual(errors,[]);assert.deepEqual(posts,[]);assert.deepEqual(external,[]);assert.deepEqual(failures,[]);
const result={routes:routes.length,checks,errors,posts,external,failures,terminal:'commands, history, draft restoration, completion, literal input, help, clear passed',safety:'CMS/backend absent; JS and no-JS submission disabled'};await writeFile(root+'/tests/test-results/brutalist-browser.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
