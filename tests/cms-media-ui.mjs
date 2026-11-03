// Real Decap browser test using actual repository images and an isolated in-memory backend.
// No production authentication, repository writes or Turbo permissions are exercised.
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import YAML from 'yaml';import {load} from 'cheerio';import {chromium} from 'playwright';import {root,workspace,fixture,build,serve,cleanup,results} from './support.mjs';
const work=await workspace();let browser,server,page;
try{
 const output=path.join(work,'public');build(root,output);server=await serve(output);
 const catalog=JSON.parse(await fs.readFile(path.join(root,'docs/media-catalog.json'),'utf8'));
 const files=await Promise.all(catalog.map(async r=>({name:path.basename(r.library),url:r.library,base64:(await fs.readFile(path.join(root,'static',r.library))).toString('base64'),type:r.library.endsWith('.svg')?'image/svg+xml':'image/png'})));
 const jsResponse=await fetch('https://unpkg.com/decap-cms@3.17.0/dist/decap-cms.js');assert(jsResponse.ok);const js=await jsResponse.text();
 browser=await chromium.launch();page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(files=>{window.repoFiles={static:{uploads:{}}};for(const item of files){const bytes=Uint8Array.from(atob(item.base64),c=>c.charCodeAt(0)),fileObj=new File([bytes],item.name,{type:item.type}),filePath='static/uploads/'+item.name;window.repoFiles.static.uploads[item.name]={path:filePath,content:{path:filePath,fileObj,toString:()=>item.url}};}},files);
 await page.route('**/decap-cms.js',r=>r.fulfill({contentType:'text/javascript',body:js}));
 await page.route('**/config.yml',async r=>{const c=YAML.parse(await fs.readFile(path.join(root,'static/sudo/config.yml'),'utf8'));c.backend={name:'test-repo'};c.publish_mode='simple';await r.fulfill({contentType:'text/yaml',body:YAML.stringify(c)});});
 await page.goto(server.url+'/sudo/');await page.getByRole('button',{name:'Login',exact:true}).click();await page.evaluate(()=>{location.hash='#/collections/services/new';});
 await page.getByText('Page title / navigation name',{exact:false}).first().waitFor();
 await page.locator('input[id^="title-field-"]').first().fill('Media gallery check');
 await page.locator('[id^="description-field-"]').first().fill('A real reusable gallery image selected through Decap.');
 await page.getByRole('button',{name:'Choose an image',exact:true}).first().click();
 await page.getByText('services-web-design-transparent.svg',{exact:true}).waitFor();
 for(const file of files){
  await page.getByPlaceholder('Search...', {exact:true}).fill(file.name);await page.getByText(file.name,{exact:true}).waitFor();
  await page.waitForFunction(()=>[...document.querySelectorAll('img[src^="blob:"]')].length>0&&[...document.querySelectorAll('img[src^="blob:"]')].every(e=>e.complete&&e.naturalWidth>0));
 }
 await page.getByPlaceholder('Search...', {exact:true}).fill('');await page.getByText('services-web-design-transparent.svg',{exact:true}).waitFor();
 await page.waitForFunction(()=>[...document.querySelectorAll('img[src^="blob:"]')].length>0&&[...document.querySelectorAll('img[src^="blob:"]')].every(e=>e.complete&&e.naturalWidth>0));
 await page.screenshot({path:path.join(results,'cms-media-library.png'),fullPage:true});
 await page.getByText('services-web-design-transparent.svg',{exact:true}).click();
 await page.getByRole('button',{name:'Choose selected',exact:true}).click();
 await page.locator('input[id^="image_alt-field-"]').first().fill('Reusable web design artwork');
 await page.getByRole('button',{name:'Publish',exact:true}).click();
 await page.getByText('Publish now',{exact:true}).click();
 await page.waitForFunction(()=>Boolean(window.repoFiles.content?.services?.['media-gallery-check']?.['index.md']?.content),null,{timeout:15000});
 const saved=await page.evaluate(()=>window.repoFiles.content.services['media-gallery-check']['index.md'].content);
 const data=YAML.parse(saved.match(/^---\n([\s\S]*?)\n---/)[1]);assert.equal(data.image,'/uploads/services-web-design-transparent.svg');assert.equal(data.fragment,'pages/service.html');
 await page.evaluate(()=>{location.hash='#/collections/services';});await page.getByText('Media gallery check',{exact:true}).waitFor();await page.getByText('Media gallery check',{exact:true}).click();
 await page.getByRole('button',{name:'Choose different image',exact:true}).first().waitFor();assert.equal(await page.locator('input[id^="title-field-"]').first().inputValue(),'Media gallery check');
 const dir=path.join(work,'render');await fs.mkdir(dir);const source=await fixture(dir),file=path.join(source,'content/services/media-gallery-check/index.md');await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,saved);const rendered=path.join(dir,'public');build(source,rendered);
 const $=load(await fs.readFile(path.join(rendered,'services/media-gallery-check/index.html'),'utf8'));assert.equal($('.detail-billboard-art img').attr('src'),data.image);assert.equal($('.detail-billboard-art img').attr('alt'),'Reusable web design artwork');
 const asset=await fetch(server.url+data.image);assert(asset.ok);assert((await asset.text()).includes('<svg'));
 assert.deepEqual(errors,[]);console.log(`PASS Decap media gallery: ${files.length} real images searchable with working thumbnails; selection saved, folder entry reopened, Hugo image rendered and public asset served (isolated backend).`);
} catch(error){if(page)console.log('PAGE AT FAILURE',await page.locator('body').innerText());throw error;}finally{await browser?.close();await server?.close();await cleanup(work);}
