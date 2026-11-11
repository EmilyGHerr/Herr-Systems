import {chromium} from '/home/syzygy/herr-systems-brutalist-templates/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const b=await chromium.launch(),p=await b.newPage(),bad=[];
for(const route of ['/','/services/','/services/web-design/','/pricing/','/contact/','/about/','/about/emily-herr/','/blog/','/blog/a-clearer-website/','/case-studies/'])for(const width of [375,1440])for(const theme of ['dark','light']){
await p.setViewportSize({width,height:1000});await p.goto('http://127.0.0.1:8106'+route);if(theme==='light')await p.locator('[data-theme-toggle]').click();await p.waitForTimeout(200);
const failures=await p.evaluate(()=>{
function rgb(s){return (s.match(/[\d.]+/g)||[]).map(Number)}
function lum(c){return c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0)}
function bg(e){while(e){let s=getComputedStyle(e),c=rgb(s.backgroundColor);if(s.backgroundImage!=='none')return null;if(c.length===3||c[3]===1)return c;e=e.parentElement;}return [255,255,255]}
let result=[];for(const e of document.querySelectorAll('main *,.masthead a,.mobile-nav>*')){let s=getComputedStyle(e),r=e.getBoundingClientRect();if(!r.width||!r.height||s.visibility==='hidden'||s.opacity==='0'||e.closest('[hidden]'))continue;let text=[...e.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim();if(!text||!/[a-z0-9]/i.test(text)||e.closest('.terminal-welcome'))continue;const back=bg(e);if(!back)continue;let f=lum(rgb(s.color)),v=lum(back),ratio=(Math.max(f,v)+.05)/(Math.min(f,v)+.05);let threshold=parseFloat(s.fontSize)>=24?3:4.5;if(ratio<threshold-.05)result.push({text:text.slice(0,65),cls:e.className,color:s.color,bg:back,ratio:+ratio.toFixed(2)});}return result;});
if(failures.length)bad.push({route,width,theme,failures});}
await b.close();await writeFile("/home/syzygy/herr-systems-brutalist-hugo/tests/test-results/brutalist-contrast.json",JSON.stringify(bad,null,2));console.log(JSON.stringify(bad,null,2));assert.deepEqual(bad,[]);
