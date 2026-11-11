import {chromium} from '/home/syzygy/herr-systems-brutalist-templates/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';
const root='/home/syzygy/herr-systems-brutalist-hugo',reference='/home/syzygy/herr-systems-brutalist-templates';
for(const f of ['brutalist.css','brutalist-pages.css'])assert.equal(await readFile(root+'/static/'+f,'utf8'),await readFile(reference+'/public/'+f,'utf8'),`Unchanged approved stylesheet: ${f}`);
const b=await chromium.launch(),a=await b.newPage(),p=await b.newPage();let checks=0;
const props=['backgroundColor','color','boxShadow','borderTopColor','borderTopWidth','borderTopStyle','fontFamily','fontSize','fontWeight','lineHeight','paddingTop','paddingRight','paddingBottom','paddingLeft','transition','transform','textDecorationLine','outlineColor','outlineStyle','outlineWidth','outlineOffset'];
try{for(const width of [375,1440])for(const theme of ['dark','light'])for(const route of ['/','/services/']){
for(const [page,port]of [[a,8105],[p,8106]]){await page.setViewportSize({width,height:1000});await page.goto(`http://127.0.0.1:${port}${route}`);if(theme==='light')await page.locator('.theme').click();await page.evaluate(()=>document.fonts.ready);}
const selectors=['.brand','.theme','.footer-brand','.footer-links a',...(width>800?['.masthead>nav a']:['.mobile-nav>a']),...(route==='/'?['.service','.hero .button','.contact .button']:['.service-entry','.contact .button'])];
for(const selector of selectors)for(const state of ['default','hover','focus']){
for(const page of [a,p]){await page.mouse.move(0,0);await page.evaluate(()=>document.activeElement?.blur());const e=page.locator(selector).first();await e.scrollIntoViewIfNeeded();if(state==='hover')await e.hover();if(state==='focus')await e.focus();await page.waitForTimeout(200);}
const styles=[];for(const page of [a,p])styles.push(await page.locator(selector).first().evaluate((e,props)=>{const s=getComputedStyle(e);return Object.fromEntries(props.map(k=>[k,s[k]]));},props));
assert.deepEqual(styles[1],styles[0],`${route} ${width} ${theme} ${selector} ${state}`);checks++;
}
}
const result={passed:true,approvedStylesheets:'byte-identical',computedDefaultHoverFocusChecks:checks,coverage:'homepage cards, buttons, service directory, desktop/mobile menu, brand, theme control and footer in both themes'};console.log(JSON.stringify(result,null,2));await writeFile(root+'/tests/test-results/brutalist-template-style-parity.json',JSON.stringify(result,null,2));
}finally{await b.close();}
