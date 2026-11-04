import assert from 'node:assert/strict';import path from 'node:path';import {readFile,writeFile,mkdir} from 'node:fs/promises';import YAML from 'yaml';import {load} from 'cheerio';import {fixture,build,files} from './support.mjs';import {cmsEntries} from './cms-entries.mjs';
export async function verifyCollections(work){
 const dir=path.join(work,'collections');await mkdir(dir);const source=await fixture(dir),dest=path.join(dir,'output');const config=YAML.parse(await readFile(path.join(source,'static/sudo/config.yml'),'utf8'));
 const defaults=fields=>Object.fromEntries(fields.flatMap(f=>{
  if(f.name==='body')return [];
  if('default' in f)return [[f.name,f.default]];
  if(f.widget==='object'){const v=defaults(f.fields||[]);return Object.keys(v).length?[[f.name,v]]:[];}
  return [];
 }));
 for(const name of ['services','case_studies']){
  const c=config.collections.find(c=>c.name===name);assert(c?.create,`${name} lacks a creatable collection`);assert.equal(c.path,'{{slug}}/index');assert.equal(c.format,'yaml-frontmatter');
  const originals=cmsEntries(config,source).filter(e=>e.name.startsWith(name+':'));const expected=(await files(path.join(source,c.folder))).filter(f=>f.endsWith('/index.md')).length;assert.equal(originals.length,expected,`${name}: existing entry discovery`);assert(expected>0,`${name}: no existing entries discovered`);
  const data={...defaults(c.fields),title:name==='services'?'Fixture new service':'Fixture new case study',description:'A real creation-fixture summary.',hero_title:'New detail fixture',subtitle:'New introduction fixture',draft:false,weight:99,image:'/assets/services/hosting-transparent.svg',image_alt:'Fixture image',listing_title:'Fixture organization',category:'Fixture category',homepage:{show:false},listing:{title:'Fixture card '+name,description:'Fixture card summary',includes:['Fixture included item']}};
  data.body=undefined;delete data.body;
  const slug='fixture-'+name.replaceAll('_','-'),relative=path.join(c.folder,c.path.replace('{{slug}}',slug)+'.md'),file=path.join(source,relative);await mkdir(path.dirname(file),{recursive:true});await writeFile(file,'---\n'+YAML.stringify(data)+'---\n\n## Fixture detail content\n\nNew editable Markdown content.\n');
 }
 const settingsFile=path.join(source,'data/settings.yml'),settings=YAML.parse(await readFile(settingsFile,'utf8'));settings.noindex=false;await writeFile(settingsFile,YAML.stringify(settings));build(source,dest);
 const initiallyHidden=load(await readFile(path.join(dest,'index.html'),'utf8'));
 for(const [section,slug]of [['services','fixture-services'],['case-studies','fixture-case-studies']]){
  assert.equal(initiallyHidden(`a[href="/${section}/${slug}/"]`).length,0,'New records must stay off homepage by default');
  const file=path.join(source,'content',section,slug,'index.md');let text=await readFile(file,'utf8');const match=text.match(/^---\n([\s\S]*?)\n---/),data=YAML.parse(match[1]);data.homepage={show:true,title:'Homepage-only '+section,description:'Homepage-only summary '+section};text=text.replace(/^---\n[\s\S]*?\n---/,'---\n'+YAML.stringify(data)+'---');await writeFile(file,text);
 }
 build(source,dest);
 for(const [section,slug]of [['services','fixture-services'],['case-studies','fixture-case-studies']]){
  const relative=`/${section}/${slug}/`,detail=load(await readFile(path.join(dest,section,slug,'index.html'),'utf8'));assert(detail('h1').text().includes('New detail fixture'));assert(detail('body').text().includes('New editable Markdown content.'));
  const directory=load(await readFile(path.join(dest,section,'index.html'),'utf8'));assert(directory(`a[href="${relative}"]`).length,`${relative}: missing from directory`);assert(directory('body').text().includes('Fixture card summary'));assert(!directory('body').text().includes('Homepage-only summary'));
  const home=load(await readFile(path.join(dest,'index.html'),'utf8'));assert(home(`a[href="${relative}"]`).length,`${relative}: missing from homepage opt-in`);assert(home('body').text().includes('Homepage-only summary '+section));assert(home('body').text().includes('Homepage-only '+section));
  const search=JSON.parse(await readFile(path.join(dest,'search-index.json'),'utf8'));assert(search.pages.some(p=>p.url===relative),`${relative}: missing from terminal search`);assert((await readFile(path.join(dest,'sitemap.xml'),'utf8')).includes(relative));
 }
 // Drafts are excluded from the public directory as well as their detail route.
 const file=path.join(source,'content/services/fixture-services/index.md');let text=await readFile(file,'utf8');text=text.replace('draft: false','draft: true');await writeFile(file,text);build(source,dest);assert(!(await readFile(path.join(dest,'services/index.html'),'utf8')).includes('/services/fixture-services/'));
}
