import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import YAML from 'yaml';
import {load} from 'cheerio';
import {fixture,build,workspace,cleanup} from './support.mjs';
import {cmsEntries} from './cms-entries.mjs';
// Expected rendering follows the editable repository records, not frozen sample identities.
export function schemaDefaults(fields=[]) {
 return Object.fromEntries(fields.flatMap(f=>{
  if(f.name==='body')return [];
  if(Object.hasOwn(f,'default'))return [[f.name,structuredClone(f.default)]];
  if(f.widget==='object'){const v=schemaDefaults(f.fields);return Object.keys(v).length?[[f.name,v]]:[];}
  return [];
 }));
}
export function parseRecord(raw){const m=raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);assert(m,'YAML front matter required');return {data:YAML.parse(m[1]),body:raw.slice(m[0].length)};}
export async function saveRecord(file,data,body){await mkdir(path.dirname(file),{recursive:true});await writeFile(file,'---\n'+YAML.stringify(data)+'---\n\n'+body+'\n');}
async function html(dest,route){return load(await readFile(path.join(dest,route,'index.html'),'utf8'));}
async function validImage(source,dest,src){assert(src?.startsWith('/'),'Root-relative portrait required');const image=await readFile(path.join(source,'static',src));assert(image.length>100);if(src.endsWith('.svg'))assert(image.toString().includes('<svg'));assert((await stat(path.join(dest,src))).size>100);}
export async function verifyStaffBlog(work){
 const dir=path.join(work,'staff-blog');await mkdir(dir,{recursive:true});const source=await fixture(dir),dest=path.join(dir,'output');
 const config=YAML.parse(await readFile(path.join(source,'static/sudo/config.yml'),'utf8'));
 const blogs=config.collections.filter(c=>c.folder==='content/blog'||c.name==='original_articles'||c.files?.some(f=>f.file?.startsWith('content/blog/')&&!f.file.endsWith('/_index.md')));
 assert.equal(blogs.length,1,'Existing and new blog posts must use exactly one collection');
 const blog=blogs[0],staff=config.collections.find(c=>c.folder==='content/about/team');
 for(const [c,fragment]of [[blog,'pages/blog-article.html'],[staff,'pages/staff-profile.html']]){assert(c?.create,fragment+': missing creatable collection');assert.equal(c.path,'{{slug}}/index');assert.equal(c.format,'yaml-frontmatter');assert.equal(schemaDefaults(c.fields).fragment,fragment,'Default must select actual template');}
 const entries=cmsEntries(config,source),originals=entries.filter(e=>e.name.startsWith(blog.name+':')),people=entries.filter(e=>e.name.startsWith(staff.name+':')),services=entries.filter(e=>e.name.startsWith('services:'));
 const profiles=await Promise.all(people.map(async e=>({...e,...parseRecord(await readFile(path.join(source,e.file),'utf8'))})));const publishedProfiles=profiles.filter(p=>!p.data.draft);
 assert(originals.length>0,'Published blog records must be discoverable');assert(people.length>0,'Staff records must be discoverable');assert(services.length>0);
 for(const e of services){const {data,body}=parseRecord(await readFile(path.join(source,e.file),'utf8'));assert(data.title&&data.description&&(body.trim().length>100||(data.detailed_layout&&JSON.stringify(data.copy).length>1000)),e.file+': meaningful service content missing');}
 const settingsFile=path.join(source,'data/settings.yml'),settings=YAML.parse(await readFile(settingsFile,'utf8'));settings.noindex=false;await writeFile(settingsFile,YAML.stringify(settings));build(source,dest);
 let about=await html(dest,'about');assert.equal(about('.staff-grid > .staff-card').length,publishedProfiles.length);
 for(const record of publishedProfiles){
  const slug=path.basename(path.dirname(record.file));
  const {data,body}=parseRecord(await readFile(path.join(source,record.file),'utf8'));const name=data.title;
  assert(name&&data.role&&data.description&&body.trim(),slug+': required profile content missing');
  const route='/about/team/'+slug+'/',card=about('.staff-card').filter((_,el)=>about(el).find(`a[href="${route}"]`).length);assert.equal(card.length,1);assert(card.text().includes(name));assert.equal(card.find('img').attr('src')||'',data.image||'');if(data.sample)assert(/demo|sample|fictional/i.test(card.text()),'Sample card disclosure missing');
  const $=await html(dest,'about/team/'+slug);for(const sel of ['.profile-billboard','.profile-story','#profile-about','.profile-skills','#profile-connect-title','.profile-other-people'])assert($(sel).length,slug+': missing '+sel);
  assert.equal($('h1').text(),name);for(const skill of data.skills||[])assert($('.profile-skills').text().includes(skill));if(data.sample)assert($('.sample-content-notice').length);assert.equal($('.profile-other-people a[href^="/about/team/"]').length,Math.min(2,publishedProfiles.length-1));if(data.image)await validImage(source,dest,$('.profile-portrait img').attr('src'));else assert.equal($('.profile-portrait img').length,0);
 }
 const blogData={...schemaDefaults(blog.fields),title:'Fixture unified blog',description:'Fixture blog description',subtitle:'Fixture blog subtitle',date:'2026-01-15T12:00:00Z',category:'Testing',author:'Regression author',draft:false,image:'/uploads/about-headshot-1.svg',image_alt:'Fixture article illustration'};
 const staffData={...schemaDefaults(staff.fields),title:'Fixture staff person',description:'Fixture staff card description',subtitle:'Fixture staff biography introduction',role:'Regression specialist',draft:false,image:'/uploads/about-headshot-2.svg',image_alt:'Fixture staff portrait',skills:['Fixture skill sentinel'],sample:true};
 for(const key of ['approach','contributions']){const field=staff.fields.find(f=>f.name===key);if(field){assert(field.fields?.length,'Structured list item schema required');staffData[key]=[{...schemaDefaults(field.fields),...Object.fromEntries(field.fields.filter(f=>['string','text','markdown'].includes(f.widget)).map((f,i)=>[f.name,'Fixture '+key+(i===0?' heading':' text')]))}];}}
 const blogFile=path.join(source,blog.folder,blog.path.replace('{{slug}}','fixture-unified-blog')+'.md'),staffFile=path.join(source,staff.folder,staff.path.replace('{{slug}}','fixture-staff-person')+'.md');
 await saveRecord(blogFile,blogData,'## Blog body sentinel\n\nNew editable article content.');await saveRecord(staffFile,staffData,'## Staff body sentinel\n\nNew editable biography content.');build(source,dest);
 const article=await html(dest,'blog/fixture-unified-blog');assert(article('body').text().includes('Blog body sentinel'));assert(article('h1').text().includes(blogData.title));
 blogData.hero_title='Fixture <em>formatted</em> heading<br>second line';blogData.subtitle='Fixture <em>formatted</em> introduction<br>second line';await saveRecord(blogFile,blogData,'## Blog body sentinel\n\nNew editable article content.');build(source,dest);const formatted=await html(dest,'blog/fixture-unified-blog');assert.equal(formatted('h1 em').text(),'formatted');assert.equal(formatted('h1 br').length,1);assert.equal(formatted('.detail-lead em').text(),'formatted');assert.equal(formatted('.detail-lead br').length,1);
 const directory=await html(dest,'blog');assert(directory('a[href="/blog/fixture-unified-blog/"]').length,'New article directory link missing');
 const search=JSON.parse(await readFile(path.join(dest,'search-index.json'),'utf8'));assert(search.pages.some(p=>p.url==='/blog/fixture-unified-blog/'),'New article missing from search');assert((await readFile(path.join(dest,'sitemap.xml'),'utf8')).includes('/blog/fixture-unified-blog/'),'New article missing from sitemap');
 async function checkStaff(){const $=await html(dest,'about/team/fixture-staff-person');about=await html(dest,'about');const card=about('.staff-card').filter((_,el)=>about(el).find('a[href="/about/team/fixture-staff-person/"]').length);assert.equal(card.length,1);assert(card.text().includes(staffData.title));assert(card.text().includes(staffData.description));assert.equal($('h1').text(),staffData.title);assert.equal($('meta[name="description"]').attr('content'),staffData.description);assert($('#profile-about').text().includes('Staff body sentinel'));assert($('#profile-about').text().includes(staffData.subtitle));assert($('.profile-skills').text().includes('Fixture skill sentinel'));for(const key of ['approach','contributions'])if(staffData[key])assert($('.profile-story').text().includes('Fixture '+key+' text'));assert.equal($('.profile-portrait img').attr('src'),staffData.image);assert.equal(card.find('img').attr('src'),staffData.image);await validImage(source,dest,staffData.image);return {$,card};}
 await checkStaff();staffData.title='Changed fixture person';staffData.description='Changed fixture card description';await saveRecord(staffFile,staffData,'## Staff body sentinel\n\nUpdated biography.');build(source,dest);await checkStaff();
 staffData.sample=false;await saveRecord(staffFile,staffData,'## Staff body sentinel\n\nUpdated biography.');build(source,dest);const real=await checkStaff();assert.equal(real.$('.sample-content-notice').length,0);assert(!/demo|sample|fictional/i.test(real.card.text()),'Real staff card retains demo claim');assert(!/demo profile|fictional profile|sample content/i.test(real.$('.profile-billboard,.profile-story,.profile-skills').text()),'Real staff profile retains demo boilerplate');
 const samplePeer=publishedProfiles.find(p=>p.data.sample);if(samplePeer){const slug=path.basename(path.dirname(samplePeer.file)),peer=await html(dest,'about/team/'+slug);assert(peer('.sample-content-notice').length,'Peer disclosure incorrectly suppressed');assert(/demo|sample|fictional/i.test(about('.staff-card').filter((_,el)=>about(el).find('a[href="/about/team/'+slug+'/"]').length).text()));}
 staffData.draft=true;await saveRecord(staffFile,staffData,'## Staff body sentinel');for(const [slug,extra]of [['fixture-future-blog',{date:'2999-01-15T12:00:00Z'}],['fixture-draft-blog',{draft:true}]])await saveRecord(path.join(source,blog.folder,slug,'index.md'),{...blogData,...extra},'Excluded article body.');build(source,dest);about=await html(dest,'about');assert.equal(about('a[href="/about/team/fixture-staff-person/"]').length,0,'Draft staff leaked onto About');await assert.rejects(stat(path.join(dest,'about/team/fixture-staff-person/index.html')),{code:'ENOENT'});
 const finalSearch=await readFile(path.join(dest,'search-index.json'),'utf8'),finalSitemap=await readFile(path.join(dest,'sitemap.xml'),'utf8');for(const route of ['/about/team/fixture-staff-person/','/blog/fixture-future-blog/','/blog/fixture-draft-blog/']){assert(!finalSearch.includes(route));assert(!finalSitemap.includes(route));await assert.rejects(stat(path.join(dest,route,'index.html')),{code:'ENOENT'});}for(const person of publishedProfiles){const route='about/team/'+path.basename(path.dirname(person.file)),peer=await html(dest,route);assert.equal(peer('a[href="/about/team/fixture-staff-person/"]').length,0,'Draft staff leaked into peer links');}const finalBlog=await html(dest,'blog');assert.equal(finalBlog('a[href="/blog/fixture-draft-blog/"],a[href="/blog/fixture-future-blog/"]').length,0);
 return {blogPosts:originals.length,staffProfiles:people.length,services:services.length,fixtureCreation:true,staffMutation:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const work=await workspace();try{console.log('PASS staff/blog',await verifyStaffBlog(work));}finally{await cleanup(work);}}
