import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import YAML from 'yaml';
import {chromium,firefox} from 'playwright';
import {workspace,fixture,build,serve,cleanup} from './support.mjs';
const work=await workspace();let server;
const fixtureCopy=`
<div class="list-typography-fixture">

Paragraph for comparison, with enough words to demonstrate the normal content typography.

- A normal unordered item with a longer line of content that wraps on smaller screens.
- Another unordered item.
  - A nested unordered item.

1. An ordered item with enough words to wrap naturally on a small screen.
2. Another ordered item.
   1. A nested ordered item.

- A loose item with an introductory paragraph.

  A second paragraph inside the list item.

- Another loose item.

</div>
`;
try{
 const source=await fixture(work),out=path.join(work,'public');
 const routes=[['/services/contract-work/','content/services/contract-work/index.md'],['/blog/what-good-hosting-should-cover/','content/blog/what-good-hosting-should-cover/index.md']];
 const profile='content/about/team/alex-morgan/index.md',raw=await readFile(path.join(source,profile),'utf8'),record=YAML.parse(raw.match(/^---\n([\s\S]*?)\n---/)[1]);
 routes.push([record.url||'/about/'+(record.slug||'alex-morgan')+'/',profile]);
 for(const [,file]of routes)await writeFile(path.join(source,file),(await readFile(path.join(source,file),'utf8'))+fixtureCopy);
 build(source,out);server=await serve(out);
 for(const engine of [chromium,firefox]){
  const browser=await engine.launch();try{
   for(const width of [360,768,1440]){
    const page=await browser.newPage({viewport:{width,height:1000}});
    for(const [route]of routes){
     await page.goto(server.url+route);await page.evaluate(()=>document.fonts.ready);
     for(const theme of ['dark','light']){
      await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
      const computed=await page.evaluate(()=>{
       const style=e=>{const s=getComputedStyle(e);return {font:s.fontSize,line:s.lineHeight,family:s.fontFamily,color:s.color};};
       const box=document.querySelector('.list-typography-fixture');return {paragraph:style(box.querySelector(':scope > p')),items:[...box.querySelectorAll('li,li p')].map(style),unordered:[...box.querySelectorAll('ul')].map(e=>getComputedStyle(e).listStyleType),overflow:document.documentElement.scrollWidth>innerWidth+1};
      });
      assert(computed.items.length>=8);for(const item of computed.items)assert.deepEqual(item,computed.paragraph,`${engine.name()} ${width} ${theme} ${route}: list and paragraph typography differ`);
      assert(computed.unordered.every(type=>type!=='none'),'Native bullets preserved');assert(!computed.overflow);
      // Real Contract Work content, not only the appended regression fixture.
      if(route.includes('/contract-work/')){
       const actual=await page.locator('.detail-overview > div').evaluate(e=>{const style=e=>{const s=getComputedStyle(e);return [s.fontSize,s.lineHeight];};return {p:style(e.querySelector(':scope > p')),items:[...e.querySelectorAll(':scope > ul > li,:scope > ol > li')].map(style)};});
       assert(actual.items.length>0);for(const item of actual.items)assert.deepEqual(item,actual.p);
      }
      console.log(`PASS ${engine.name()} ${width}px ${theme} ${route}: content unordered/ordered/nested/loose lists match paragraphs; bullets and mobile gutters preserved`);
     }
    }
    await page.close();
   }
  }finally{await browser.close();}
 }
}finally{await server?.close();await cleanup(work);}
