import assert from 'node:assert/strict';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { root, results, workspace, build, serve, cleanup } from './support.mjs';
// Source dist is an explicit external reference, never silently downloaded or updated.
const source=process.env.SOURCE_DIST || path.resolve(root,'../herr-systems-template-source/dist');
assert(existsSync(path.join(source,'index.html')),`Set SOURCE_DIST to the approved built source (not found: ${source})`);
const work=await workspace(), output=path.join(work,'public'), target=path.join(results,'visual');
await mkdir(target,{recursive:true});
let browser;const servers=[],report=[];
const threshold=Number(process.env.MAX_VISUAL_DIFF || '.15');
assert(Number.isFinite(threshold)&&threshold>=0&&threshold<=1,'MAX_VISUAL_DIFF must be 0..1');
function padded(img,width,height){const p=new PNG({width,height});p.data.fill(255);PNG.bitblt(img,p,0,0,img.width,img.height,0,0);return p;}
try {
 build(root,output);servers.push(await serve(source),await serve(output));browser=await chromium.launch();
 for(const [device,viewport] of Object.entries({desktop:{width:1440,height:1000},mobile:{width:390,height:844}})) {
  const context=await browser.newContext({viewport,reducedMotion:'reduce'});
  for(const theme of ['dark','light'])for(const [name,route] of [['home','/'],['services','/services/'],['web-design','/services/web-design/'],['contact','/contact/'],['blog','/blog/']]) {
   const images=[],snapshots=[];let error;
   for(const [i,label] of ['source','hugo'].entries()) {
    const page=await context.newPage();
    try {
     const response=await page.goto(servers[i].url+route,{waitUntil:'networkidle'});assert(response.ok(),`${label} ${route}: HTTP ${response.status()}`);
     await page.evaluate(()=>document.fonts.ready);
     if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('[data-theme-toggle]').click();
     await page.addStyleTag({content:'*,*::before,*::after { animation: none !important; transition: none !important; caret-color:transparent !important; }'});
     await page.waitForTimeout(80);
     // Compare layout after ONLY the explicitly requested contact-content cleanup.
     // Preserve the untouched screenshot as separate review evidence, not a new baseline.
     if(i === 0 && name === 'contact') {
      await page.screenshot({path:path.join(target,`${name}-${device}-${theme}-source-raw.png`),fullPage:true,animations:'disabled'});
      await page.evaluate(()=>{
       document.querySelector('a[aria-describedby="phone-demo-note"]')?.remove();
       document.getElementById('phone-demo-note')?.remove();
       const note=document.getElementById('form-delivery-note'), link=note?.querySelector('a');
       if(note && link) note.replaceChildren(document.createTextNode('Online form delivery is unavailable. Please '),link,document.createTextNode('.'));
      });
     }
     snapshots.push(await page.evaluate(()=>{
       const bounds=e=>{if(!e)return null;const b=e.getBoundingClientRect(),s=getComputedStyle(e);return {x:b.x,y:b.y,width:b.width,height:b.height,font:s.fontFamily,color:s.color,background:s.backgroundColor};};
       return {header:bounds(document.querySelector('header')),main:bounds(document.querySelector('main')),heading:bounds(document.querySelector('main h1')),overflow:document.documentElement.scrollWidth>innerWidth+1};
     }));
     const file=path.join(target,`${name}-${device}-${theme}-${label}.png`);
     await page.screenshot({path:file,fullPage:true,animations:'disabled'});images.push(PNG.sync.read(await readFile(file)));
    }catch(e){error=e.message;}finally{await page.close();}
   }
   const record={name,route,device,theme,threshold,snapshots};
   if(images.length===2) {
    const width=Math.max(...images.map(p=>p.width)),height=Math.max(...images.map(p=>p.height));
    const [a,b]=images.map(p=>padded(p,width,height)),diff=new PNG({width,height});
    const mismatch=pixelmatch(a.data,b.data,diff.data,width,height,{threshold:.15,includeAA:false});
    record.sourceSize=[images[0].width,images[0].height];record.hugoSize=[images[1].width,images[1].height];record.diffRatio=mismatch/(width*height);
    await writeFile(path.join(target,`${name}-${device}-${theme}-diff.png`),PNG.sync.write(diff));
    record.status=!error&&!snapshots.some(s=>s.overflow)&&record.diffRatio<=threshold?'PASS':'REVIEW';
   }else record.status='FAIL';
   if(error)record.error=error;report.push(record);console.log(`${record.status} ${name} ${device} ${theme}: ${record.diffRatio===undefined?error:(record.diffRatio*100).toFixed(2)+'% changed'}`);
  }
  await context.close();
 }
}finally{
 if(browser)await browser.close();for(const s of servers)await s.close();await cleanup(work);
 await writeFile(path.join(target,'report.json'),JSON.stringify({reference:source,note:'Contact source comparison intentionally removes only the known fictional-phone block and normalizes the preview-delivery notice; untouched contact source screenshots are retained as source-raw.png. Full-page pixel comparison is a review aid: intentional removal of demo/fictional copy and dynamic CMS content may change page height. Source is never auto-approved or overwritten. Review paired source/hugo/diff images; threshold is explicit, not an assertion of exact visual equivalence.',comparisons:report},null,2));
 const rows=report.map(r=>`<section><h2>${r.name} / ${r.device} / ${r.theme}: ${r.status} (${r.diffRatio===undefined?'error':(100*r.diffRatio).toFixed(2)+'%'})</h2><div>${['source','hugo','diff'].map(label=>`<figure><figcaption>${label}</figcaption><a href="${r.name}-${r.device}-${r.theme}-${label}.png"><img loading="lazy" src="${r.name}-${r.device}-${r.theme}-${label}.png"></a></figure>`).join('')}</div></section>`).join('');
 await writeFile(path.join(target,'index.html'),`<!doctype html><meta charset="utf-8"><title>Herr Systems visual comparison</title><style>body{font:16px system-ui;margin:24px}section div{display:flex;gap:12px}figure{margin:0;width:32%}img{width:100%;border:1px solid #999}</style><h1>Approved source ↔ Hugo</h1><p>Full-page comparisons. Intentional removal of demo-facing copy is expected; review changed regions rather than approving new baselines automatically. Pink diff highlights differ. No images are committed.</p>${rows}`);
}
process.exitCode=report.length!==20||report.some(r=>r.status!=='PASS')?1:0;
