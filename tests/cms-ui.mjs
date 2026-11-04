// Real Decap UI smoke test. Test backend exists only in intercepted browser responses.
// This validates editor rendering, not production Turbo authentication.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import YAML from 'yaml';
import {chromium} from 'playwright';
import {root,workspace,build,serve,cleanup,results} from './support.mjs';
const work=await workspace();let browser,server;
try {
 const output=path.join(work,'public');build(root,output);server=await serve(output);
 const response=await fetch('https://unpkg.com/decap-cms@3.17.0/dist/decap-cms.js');assert(response.ok,'Decap distribution unavailable');const js=await response.text();
 browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/decap-cms.js',r=>r.fulfill({contentType:'text/javascript',body:js}));
 await page.route('**/config.yml',async r=>{const c=YAML.parse(await fs.readFile(path.join(root,'static/sudo/config.yml'),'utf8'));c.backend={name:'test-repo'};c.publish_mode='simple';await r.fulfill({contentType:'text/yaml',body:YAML.stringify(c)});});
 await page.goto(server.url+'/sudo/');await page.getByRole('button',{name:'Login',exact:true}).click();await page.getByRole('link',{name:'Home',exact:true}).click();await page.getByText('Announcement / system message',{exact:true}).last().waitFor();
 const text=await page.locator('body').innerText();const groups=['BILLBOARD — HEADING AND ACTIONS','ANNOUNCEMENT / SYSTEM MESSAGE','SERVICES — SECTION HEADING','PRICING OVERVIEW','CASE STUDIES — SECTION HEADING','CONTACT — NEXT STEP','SEARCH ENGINES AND SOCIAL SHARING'];
 let previous=-1;for(const label of groups){const index=text.indexOf(label);assert(index>previous,`Missing / out-of-order section ${label}`);previous=index;}
 await page.getByText('Edit this section — Announcement / system message',{exact:true}).last().getByRole('button',{name:'Expand',exact:true}).click();await page.getByText('Show announcement below the billboard',{exact:false}).first().waitFor();
 assert((await page.locator('body').innerText()).includes('ANNOUNCEMENT MESSAGE'));
 await page.getByText('Search engines and social sharing',{exact:true}).last().getByRole('button',{name:'Expand',exact:true}).click();await page.getByText('Google / search results',{exact:true}).last().waitFor();
 await page.getByText('Google / search results',{exact:true}).last().getByRole('button',{name:'Expand',exact:true}).click();await page.getByText('Search result title',{exact:false}).first().waitFor();
 for(const [collection,label]of [['services','Service'],['case_studies','Case study']]){
  await page.evaluate(hash=>{location.hash=hash;},'#/collections/'+collection);
  const add=page.getByText('＋ '+label,{exact:true});await add.waitFor();await add.click();
  await page.getByText(collection==='services'?'Page title / navigation name':'Page title',{exact:false}).first().waitFor();
  assert((await page.locator('body').innerText()).includes(collection==='services'?'STANDARD LAYOUT — MAIN CONTENT':'STUDY ARTICLE'));
 }
 assert.deepEqual(errors,[]);await page.screenshot({path:path.join(results,'cms-home-editor.png'),fullPage:true});
 console.log('PASS real Decap UI: grouped home fields, working announcement controls, grouped SEO fields, Services/Case studies creation screens, zero runtime errors (isolated test backend).');
} finally {await browser?.close();await server?.close();await cleanup(work);}
