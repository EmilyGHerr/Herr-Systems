// Real Decap UI with isolated in-memory backend: no production login or Git writes.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import YAML from 'yaml';
import {chromium} from 'playwright';
import {root,workspace,build,serve,cleanup} from './support.mjs';
const work=await workspace();let browser,server;
try {
 const output=path.join(work,'public');build(root,output);server=await serve(output);
 const response=await fetch('https://unpkg.com/decap-cms@3.17.0/dist/decap-cms.js');assert(response.ok);const js=await response.text();
 browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const raw=await fs.readFile(path.join(root,'content/pricing/index.md'),'utf8');
 const original=YAML.parse(raw.match(/^---\n([\s\S]*?)\n---/)[1]);
 await page.addInitScript(raw=>{window.repoFiles={content:{pricing:{'index.md':{path:'content/pricing/index.md',content:raw}}}};},raw);
 await page.route('**/decap-cms.js',r=>r.fulfill({contentType:'text/javascript',body:js}));
 await page.route('**/config.yml',async r=>{const c=YAML.parse(await fs.readFile(path.join(root,'static/sudo/config.yml'),'utf8'));c.backend={name:'test-repo'};c.publish_mode='simple';await r.fulfill({contentType:'text/yaml',body:YAML.stringify(c)});});
 await page.goto(server.url+'/sudo/');await page.getByRole('button',{name:'Login',exact:true}).click();
 await page.evaluate(()=>location.hash='#/collections/pages/entries/pricing');
 await page.locator('[id^="hero_title-field-"]').waitFor();
 await page.getByText('Pricing explanation — accordions below the text',{exact:true}).last().getByRole('button',{name:'Expand',exact:true}).click();
 await page.getByText(original.faq.items[0].question,{exact:true}).last().locator('..').locator('button').first().click();
 await page.locator('[id^="question-field-"]').filter({visible:true}).first().fill('Question edited in real Decap');
 await page.locator('[contenteditable="true"]').filter({visible:true}).first().fill('Answer edited in real Decap');
 await page.getByRole('button',{name:'Publish',exact:true}).click();await page.getByText('Publish now',{exact:true}).click();
 await page.waitForFunction(()=>window.repoFiles.content.pricing['index.md'].content.includes('Question edited in real Decap'));
 const saved=await page.evaluate(()=>window.repoFiles.content.pricing['index.md'].content);
 const data=YAML.parse(saved.match(/^---\n([\s\S]*?)\n---/)[1]);
 assert.equal(data.faq.title,original.faq.title);assert.equal(data.faq.intro,original.faq.intro);assert.equal(data.faq.items[0].question,'Question edited in real Decap');assert.equal(data.faq.items[0].answer.trim(),'Answer edited in real Decap');assert.equal(data.faq.items.length,original.faq.items.length);assert.deepEqual(errors,[]);
 console.log('PASS real Decap Pricing editor: inline accordion controls render, question/answer edits publish, old heading/intro preserved but not exposed to isolated backend, zero browser errors');
} finally {await browser?.close();await server?.close();await cleanup(work);}
