import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import YAML from 'yaml';
import {load} from 'cheerio';
import {cmsEntries} from './cms-entries.mjs';
import {build,fixture,files} from './support.mjs';
const read=f=>readFile(f,'utf8');
const parse=s=>YAML.parse(s.match(/^---\n([\s\S]*?)\n---/)[1]);
const save=async(f,d)=>{const s=await read(f);await writeFile(f,s.replace(/^---\n[\s\S]*?\n---/,'---\n'+YAML.stringify(d)+'---'));};
export async function verifyCms(work,root){
 const dir=path.join(work,'cms-editing');await mkdir(dir);const source=await fixture(dir);const output=path.join(dir,'output');
 const config=YAML.parse(await read(path.join(source,'static/sudo/config.yml')));
 const entries=cmsEntries(config,source);
 let checked=0;const markers=[];
 const markText=(fields,data)=>{
  let count=0;
  for(const field of fields){
   if(['boolean','hidden','number','datetime','image'].includes(field.widget)||/^(url|href|id)$/.test(field.name))continue;
   if(field.widget==='list'){
    if(!Array.isArray(data[field.name]))continue;
    if(field.fields)for(const item of data[field.name])count+=markText(field.fields,item);
    else if(field.field)data[field.name]=data[field.name].map(value=>{const holder={[field.field.name]:value};count+=markText([field.field],holder);return holder[field.field.name];});
   }else if(field.widget==='object'){
    if(data[field.name]&&typeof data[field.name]==='object')count+=markText(field.fields||[],data[field.name]);
   }else{
    const marker='CMS_EDIT_'+markers.length+'_END';
    // Link destinations need valid URLs, not plain-text markers rejected by the renderer.
    data[field.name]=field.name.endsWith('_url')?'https://example.com/'+marker:marker;markers.push(marker);count++;
   }
  }
  return count;
 };

 for(const e of entries.filter(e=>e.file && e.fields.some(f=>f.name==='copy'))){
  const file=path.join(source,e.file);const data=e.file.endsWith('.md')?parse(await read(file)):YAML.parse(await read(file));const copy=e.fields.find(f=>f.name==='copy');if(!data.copy)continue;const keys=new Set();
  // Decap may reorder YAML maps on save; the schema, not storage order, defines editor order.
  assert.deepEqual(Object.keys(data.copy).sort(),copy.fields.map(f=>f.name).sort(),`${e.name}: stored groups`);
  for(const g of copy.fields){
   const fields=new Set(g.fields.map(f=>f.name));
   for(const key of Object.keys(data.copy[g.name])){assert(fields.has(key),`${e.name}/${g.name}/${key}: stored value lacks CMS field`);assert(!keys.has(key),`${e.name}: duplicate flattened key ${key}`);keys.add(key);}
   if(g.widget==='hidden')continue;
   // Enable the announcement only in this isolated field-coverage fixture.
   if(g.fields.some(f=>f.name==='enabled'&&f.widget==='boolean'))data.copy[g.name].enabled=true;
   if(markText(g.fields,data.copy[g.name]))checked++;
  }
  if(e.file.endsWith('.md'))await save(file,data);else await writeFile(file,YAML.stringify(data));
 }
 build(source,output);
 const allHtml=(await Promise.all((await files(output)).filter(f=>f.endsWith('.html')&&!f.includes('/sudo/')).map(read))).join('\n');
 for(const marker of markers)assert(allHtml.includes(marker),`${marker}: CMS edit does not reach rendered HTML`);
 // A fresh fixture prevents marker edits from affecting normal-content assertions.
 const clean=path.join(work,'cms-behavior');await mkdir(clean);const site=await fixture(clean);const dest=path.join(clean,'output');
 const settingsFile=path.join(site,'data/settings.yml');const settings=YAML.parse(await read(settingsFile));settings.noindex=false;settings.seoImage='/assets/case-studies/maple-street-workshop.svg';settings.seoImageAlt='Default accessible preview';await writeFile(settingsFile,YAML.stringify(settings));
 const homeFile=path.join(site,'content/_index.md');const home=parse(await read(homeFile));const group=Object.values(home.copy).find(g=>'notice_1' in g);assert(group,'Missing announcement group');
 group.enabled=true;group.b_4='Test announcement';group.notice_1='Announcement body sentinel';
 home.seo={search:{title:'CMS search title',description:'CMS search description',canonicalURL:'https://example.com/preferred/',noindex:false},social:{image:'/assets/case-studies/northline-community.svg',imageAlt:'CMS social description',ogTitle:'CMS Facebook title',ogDescription:'CMS Facebook description',twitterTitle:'CMS Twitter title',twitterDescription:'CMS Twitter description'}};
 home.noindex=true; // Explicit nested false must override a legacy flat true.
 await save(homeFile,home);build(site,dest);const on=load(await read(path.join(dest,'index.html')));
 assert.equal(on('.notice').length,1);assert(on('.notice').text().includes(group.notice_1));
 assert.equal(on('title').text(),'CMS search title');assert.equal(on('meta[name="description"]').attr('content'),'CMS search description');assert.equal(on('link[rel="canonical"]').attr('href'),'https://example.com/preferred/');
 for(const [attr,key,value]of [['property','og:title','CMS Facebook title'],['property','og:description','CMS Facebook description'],['name','twitter:title','CMS Twitter title'],['name','twitter:description','CMS Twitter description'],['property','og:image:alt','CMS social description'],['name','twitter:image:alt','CMS social description']])assert.equal(on(`meta[${attr}="${key}"]`).attr('content'),value);
 assert(on('meta[property="og:image"]').attr('content').endsWith('/assets/case-studies/northline-community.svg'));
 assert.equal(on('meta[name="robots"]').attr('content'),'index, follow');
 group.enabled=false;await save(homeFile,home);build(site,dest);const off=load(await read(path.join(dest,'index.html')));assert.equal(off('.notice').length,0);assert(!JSON.parse(await read(path.join(dest,'search-index.json'))).pages.find(p=>p.slug==='home').content.includes(group.notice_1));
 on('.notice').remove();assert.equal(off('body').html().replace(/>\s+</g,'><').trim(),on('body').html().replace(/>\s+</g,'><').trim(),'Toggle must not change unrelated page content');
 assert.equal(parse(await read(homeFile)).copy[Object.keys(home.copy).find(k=>'notice_1' in home.copy[k])].notice_1,'Announcement body sentinel');
 delete group.enabled;home.seo.search={noindex:true};home.seo.social={};await save(homeFile,home);build(site,dest);const fallback=load(await read(path.join(dest,'index.html')));
 assert.equal(fallback('.notice').length,1,'Unset toggle preserves announcement');assert.equal(fallback('meta[name="robots"]').attr('content'),'noindex, follow');
 assert(!JSON.parse(await read(path.join(dest,'search-index.json'))).pages.some(p=>p.slug==='home'));assert(!(await read(path.join(dest,'sitemap.xml'))).includes('<loc>https://herr.test/</loc>'));
 assert.equal(fallback('title').text(),home.title+' // '+settings.brand);assert.equal(fallback('meta[name="description"]').attr('content'),home.description);assert.equal(fallback('meta[property="og:image:alt"]').attr('content'),'Default accessible preview');
 // One image edit must update both the original article cover and its live listing card.
 const articleFile=path.join(site,'content/blog/a-clearer-website/index.md');const article=parse(await read(articleFile));
 article.image='/assets/case-studies/northline-community.svg';article.image_alt='Shared edited article image';await save(articleFile,article);build(site,dest);
 const articleHtml=load(await read(path.join(dest,'blog/a-clearer-website/index.html'))),listing=load(await read(path.join(dest,'blog/index.html')));
 assert.equal(articleHtml('.article-cover img').attr('src'),article.image);assert.equal(articleHtml('.article-cover img').attr('alt'),article.image_alt);
 assert(listing('img').toArray().some(el=>listing(el).attr('src')===article.image && listing(el).attr('alt')===article.image_alt));
 // Older flat copy must still render after the grouped-schema deployment.
 home.copy=Object.assign({},...Object.values(home.copy));await save(homeFile,home);build(site,dest);
 const legacy=load(await read(path.join(dest,'index.html')));
 assert.equal(legacy('.notice').length,1);assert(legacy('.notice').text().includes('Announcement body sentinel'));
 assert.equal(legacy('.hero h1').text().trim(),fallback('.hero h1').text().trim());
 return checked;
}
