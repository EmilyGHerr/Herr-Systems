import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import YAML from 'yaml';
import {load} from 'cheerio';
import {files, fixture, build, workspace, cleanup} from './support.mjs';
import {parseRecord, saveRecord} from './staff-blog.mjs';

const base='https://herr.test/', bid=base+'#business', wid=base+'#website';
const text=f=>readFile(f,'utf8'), abs=v=>new URL(v,base).href;
const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
// A rendered line break is a word boundary, unlike Cheerio's raw textContent.
const plain=v=>norm(load(String(v??'').replace(/<br\s*\/?\s*>/gi,' '),{},false).text());
const is=(n,t)=>[n?.['@type']||[]].flat().includes(t);
const image=v=>typeof v==='string'?v:v?.url||v?.contentUrl||v?.['@id'];
const ref=(v,id)=>assert.equal(v?.['@id'],id);
function route(r){
 if(r.data.url)return r.data.url;
 if(r.file.includes('/about/team/'))return `/about/${r.data.slug||path.basename(path.dirname(r.file))}/`;
 const url='/'+r.file.replace(/^content\//,'').replace(/(?:_?index)\.md$/,'');
 return r.data.slug?url.replace(/[^/]+\/$/,r.data.slug+'/'):url;
}
async function page(dest,url){
 const $=load(await text(path.join(dest,new URL(url,base).pathname,'index.html'))),canonical=$('link[rel="canonical"]').attr('href');assert(canonical);
 const scripts=$('script[type="application/ld+json"]');assert.equal(scripts.length,1,`${url}: exactly one JSON-LD script required`);
 let doc;try{doc=JSON.parse(scripts.text());}catch(e){assert.fail(`${url}: invalid JSON: ${e.message}`);}
 assert.equal(doc['@context'],'https://schema.org');const graph=doc['@graph'];assert(Array.isArray(graph));assert(graph.length>=3);
 assert.equal(new Set(graph.map(n=>n['@id'])).size,graph.length,'Unique graph IDs');
 for(const n of graph){assert(n['@type']);assert.match(n['@id'],/^https:\/\//);}
 const get=id=>{const n=graph.find(n=>n['@id']===id);assert(n,`${url}: missing ${id}`);return n;};
 return {$,canonical,graph,get,webpage:get(canonical+'#webpage')};
}
function business(p,s){
 const b=p.get(bid),w=p.get(wid);assert(is(b,'LocalBusiness'));assert(!is(b,'ProfessionalService'),'Deprecated business type excluded');
 assert.equal(b.name,plain(s.brand));assert.equal(b.description,plain(s.description));assert.equal(b.url,base);
 for(const [field,key]of [['email','email'],['telephone','phone']]){if(s[key]){if(field==='telephone'){const digits=String(s[key]).replace(/[^0-9]/g,'');const expected=digits.length===10?'1'+digits:digits;assert.equal(String(b[field]).replace(/[^0-9]/g,''),expected,'Phone formatting may normalize, not change the public number');}else assert.equal(b[field],s[key]);}else assert(!Object.hasOwn(b,field),`Empty ${field} omitted`);}
 assert.equal(image(b.logo),abs('/assets/davy-hexagon-mark.png'),'Logo follows actual header asset, not mutable social preview');if(s.seoImage)assert.equal(image(b.image),abs(s.seoImage));else assert(!Object.hasOwn(b,'image'));assert(is(b.location,'Place'));assert.equal(b.location.name,s.location);
 if(s.address)assert.equal(b.address,s.address,'Public address Text only');else assert(!Object.hasOwn(b,'address'),'No invented physical address');
 assert(is(w,'WebSite'));assert.equal(w.url,base);assert.equal(w.name,plain(s.brand));ref(w.publisher,bid);
 assert(is(p.webpage,'WebPage'));assert.equal(p.webpage.url,p.canonical);ref(p.webpage.isPartOf,wid);
 const visit=v=>{if(!v||typeof v!=='object')return;for(const t of ['Review','AggregateRating','Product','Offer','PostalAddress'])assert(!is(v,t),`Unexpected ${t}`);for(const k of ['review','reviews','aggregateRating','price','priceRange','customer'])assert(!Object.hasOwn(v,k),`Unexpected ${k}`);Object.values(v).forEach(visit);};visit(p.graph);
}
function visible(p,d,s){assert.equal(p.webpage.name,plain(d.hero_title||d.title),'Visible heading not SEO');assert.equal(p.webpage.description,plain(d.subtitle||d.lead||d.description||s.description));assert.equal(image(p.webpage.image),abs(d.detailed_layout?(p.$('.detail-billboard-art img').attr('src')):(d.image||d.seo?.social?.image||s.seoImage||'/assets/davy-hexagon-mark.png')));}
function faq(p,enabled){
 const details=p.$('.contact-faq details, .pricing-faq details');assert.equal(is(p.webpage,'FAQPage'),enabled,'FAQ type follows rendered FAQ');
 if(!enabled){assert(!Object.hasOwn(p.webpage,'mainEntity'),'Hidden answers omitted');return;}
 assert(details.length);assert.equal(p.webpage.mainEntity.length,details.length);const html=v=>load(String(v),{},false).html().trim();
 details.each((i,e)=>{const q=p.webpage.mainEntity[i];assert(is(q,'Question'));assert(is(q.acceptedAnswer,'Answer'));assert.equal(q.name,norm(p.$(e).find('summary').text()));assert.equal(html(q.acceptedAnswer.text),html(p.$(e).find('.faq-answer').html()),'Answer HTML matches renderer');});
}
function crumbs(p,urls){const n=p.graph.find(n=>is(n,'BreadcrumbList'));assert(n);const e=n.itemListElement;assert.deepEqual(e.map(e=>typeof e.item==='string'?e.item:e.item?.['@id']||e.item?.url),urls.map(abs));assert.deepEqual(e.map(e=>e.position),e.map((_,i)=>i+1));for(const x of e)assert(plain(x.name||x.item?.name));assert(!JSON.stringify(e).includes('/about/team/'));}
function article(p,d,author){const a=p.get(p.canonical+'#article');assert(is(a,'BlogPosting'));assert.equal(a.headline,plain(d.hero_title||d.title));assert.equal(a.description,p.webpage.description);assert.equal(image(a.image),image(p.webpage.image));for(const k of ['datePublished','dateModified']){assert.match(a[k],/^\d{4}-\d{2}-\d{2}(?:T.*)?$/);assert(Number.isFinite(Date.parse(a[k])));}assert.equal(Date.parse(a.datePublished),Date.parse(d.date));assert(Date.parse(a.dateModified)>=Date.parse(a.datePublished));ref(a.publisher,bid);ref(a.mainEntityOfPage,p.canonical+'#webpage');if(author){ref(a.author,author);assert(is(p.get(author),'Person'));}else assert(!Object.hasOwn(a,'author'),'AI author omitted');}
function list(p,records){const n=p.get(p.canonical+'#list');assert(is(n,'ItemList'));const e=n.itemListElement;const actual=e.map(e=>({url:typeof e.item==='string'?e.item:e.item?.url||e.item?.['@id']||e.url,name:e.name||e.item?.name}));const expected=records.map(r=>({url:abs(route(r)),name:plain(r.data.listing?.title||r.data.listing_title||r.data.title)}));const sort=r=>r.sort((a,b)=>a.url.localeCompare(b.url));assert.deepEqual(sort(actual),sort(expected),'Published children and current URLs');assert.deepEqual(e.map(e=>e.position),e.map((_,i)=>i+1));}

// Only disposable fixtures are mutated. Nine builds cover baseline and combined independent edits.
export async function verifyStructuredData(work){
 const dir=path.join(work,'structured-data');await mkdir(dir,{recursive:true});const source=await fixture(dir),dest=path.join(dir,'output');
 const records=await Promise.all((await files(path.join(source,'content'))).filter(f=>f.endsWith('.md')).map(async f=>({file:path.relative(source,f).split(path.sep).join('/'),...parseRecord(await text(f))})));
 const find=f=>{const r=records.find(r=>r.file==='content/'+f);assert(r,f);return r;};
 const sf=path.join(source,'data/settings.yml'),s=YAML.parse(await text(sf)),save=r=>saveRecord(path.join(source,r.file),r.data,r.body),saveSettings=()=>writeFile(sf,YAML.stringify(s));
 const service=find('services/development/index.md'),post=find('blog/a-clearer-website/index.md'),contact=find('contact/index.md'),pricing=find('pricing/index.md');
 const owner=records.find(r=>r.data.title===s.owner);assert(owner);
 const children=section=>records.filter(r=>path.dirname(path.dirname(r.file))===path.dirname(section.file)).filter(r=>path.basename(r.file)==='index.md').filter(r=>!r.data.draft).filter(r=>!r.data.date||Date.parse(r.data.date)<=Date.now());
 const failures=[];let builds=0,pages=0;const run=()=>{build(source,dest);builds++;assert(builds<=10);};
 const check=async(label,fn)=>{try{await fn();console.log('PASS structured data: '+label);}catch(e){failures.push(label+': '+e.message);console.error('FAIL structured data: '+label+': '+e.message);}};
 run();const xml=load(await text(path.join(dest,'sitemap.xml')),{xmlMode:true}),urls=xml('loc').map((_,e)=>xml(e).text()).get();assert(urls.length>=20,'Whole published site');
 for(const url of urls)await check('baseline '+url,async()=>{
  const p=await page(dest,url);pages++;await check('business '+url,()=>business(p,s));const r=records.find(r=>abs(route(r))===url);assert(r);await check('visible '+url,()=>visible(p,r.data,s));const f=r.data.fragment||'';
  if(url!==base){const a=[base],section=r.file.split('/')[1];if(!r.file.endsWith('/_index.md'))if(['services','blog','case-studies','about'].includes(section))a.push(abs(route(find(section+'/_index.md'))));crumbs(p,[...a,url]);}
  if(f==='pages/service.html'){const n=p.get(url+'#service');assert(is(n,'Service'));assert.equal(n.name,plain(r.data.title));assert.equal(n.description,p.webpage.description);ref(n.provider,bid);ref(n.mainEntityOfPage,url+'#webpage');}
  if(f==='pages/blog-article.html')article(p,r.data,r.data.author==='alex-morgan/index'?abs(route(owner))+'#person':undefined);
  if(f.includes('case-study')){const n=p.get(url+'#project');assert(is(n,'CreativeWork'));assert.equal(n.name,plain(r.data.hero_title||r.data.title));assert.equal(n.description,p.webpage.description);assert.equal(image(n.image),image(p.webpage.image));}
  if(r.file.endsWith('/_index.md'))if(url!==base){assert(is(p.webpage,r.file==='content/about/_index.md'?'AboutPage':'CollectionPage'));list(p,r.data.fragment==='pages/about.html'?records.filter(r=>r.data.fragment==='pages/staff-profile.html'&&!r.data.draft):children(r));}
  if(r===contact||r===pricing){if(r===contact)assert(is(p.webpage,'ContactPage'));faq(p,r.data.faq?.enabled===false?false:!!r.data.faq?.items?.length);}
  if(f==='pages/staff-profile.html'){if(r===owner){assert(is(p.webpage,'ProfilePage'));const n=p.get(url+'#person');assert(is(n,'Person'));assert.equal(n.name,s.owner);}else{assert(!is(p.webpage,'ProfilePage'));assert(!p.graph.some(n=>is(n,'Person')),'AI/cat/sample not Person');}}
 });
 Object.assign(s,{brand:'Fixture "Brand"',description:'Fixture public description.',email:'public-schema@example.test',phone:'+1-202-555-0147',location:'Fixture region',address:'Public mailing address sentinel',seoImage:'/uploads/brand-davy-hexagon-mark.png'});
 Object.assign(service.data,{title:'Changed service title',hero_title:'Changed <em>visible</em> service',subtitle:'Changed <strong>visible</strong> introduction.',image:'/uploads/services-development.svg'});service.data.seo.search.title='SEO not visible title';service.data.seo.search.description='SEO not visible introduction';
 Object.assign(post.data,{author:'alex-morgan/index',hero_title:'Changed <em>article</em> headline',subtitle:'Changed article introduction.',date:'2026-01-15T12:00:00Z',lastmod:'2026-02-16T12:00:00Z'});
 for(const r of [contact,pricing])r.data.faq={items:[{question:'Changed "question"?',answer:'A **formatted** answer with [contact](/contact/).\n\n- First item\n- Second item'},{question:'Second question?',answer:'Updated second answer.'}]};
 await saveSettings();for(const r of [service,post,contact,pricing])await save(r);run();
 await check('content/settings, human author and rich FAQ mutations',async()=>{const p=await page(dest,route(service));await check('changed business settings',()=>business(p,s));await check('changed service visible content',()=>visible(p,service.data,s));assert.equal(p.get(p.canonical+'#service').name,service.data.title);assert.equal(p.get(p.canonical+'#service').description,p.webpage.description);const a=await page(dest,route(post));article(a,post.data,abs(route(owner))+'#person');assert.equal(Date.parse(a.get(a.canonical+'#article').dateModified),Date.parse(post.data.lastmod));for(const r of [contact,pricing])faq(await page(dest,route(r)),true);});
 Object.assign(s,{email:'',phone:'',address:'',seoImage:''});service.data.image='';service.data.seo.social.image='/uploads/services-hosting.svg';for(const r of [contact,pricing])r.data.faq.enabled=false;await saveSettings();for(const r of [service,contact,pricing])await save(r);run();
 await check('optional fields, real default logo, social image, hidden FAQ',async()=>{const p=await page(dest,route(service));await check('omitted optional settings',()=>business(p,s));await check('social image fallback',()=>visible(p,service.data,s));for(const r of [contact,pricing])faq(await page(dest,route(r)),false);});
 s.seoImage='/uploads/brand-davy-hexagon-mark.png';service.data.seo.social.image='';for(const r of [contact,pricing])r.data.faq={enabled:true,items:[]};await saveSettings();for(const r of [service,contact,pricing])await save(r);run();
 await check('site image fallback and empty FAQ',async()=>{await check('site fallback image',async()=>visible(await page(dest,route(service)),service.data,s));for(const r of [contact,pricing])faq(await page(dest,route(r)),false);});
 for(const r of [contact,pricing]){delete r.data.faq;await save(r);}run();await check('missing FAQ',async()=>{for(const r of [contact,pricing])faq(await page(dest,route(r)),false);});
 const sections=[find('services/_index.md'),find('blog/_index.md'),find('about/_index.md')];
 for(const [r,url]of [[service,'/new-service/'],[post,'/new-article/'],[owner,'/new-owner/'],[sections[0],'/new-services/'],[sections[1],'/new-blog/'],[sections[2],'/new-about/']]){r.data.url=url;await save(r);}run();
 await check('routes update IDs, author, breadcrumbs, lists',async()=>{const p=await page(dest,route(service));crumbs(p,['/','/new-services/','/new-service/']);ref(p.get(p.canonical+'#service').mainEntityOfPage,base+'new-service/#webpage');article(await page(dest,route(post)),post.data,base+'new-owner/#person');crumbs(await page(dest,route(owner)),['/','/new-about/','/new-owner/']);for(const section of sections.slice(0,2))list(await page(dest,route(section)),children(section));});
 post.data.author='sam-rivera/index';await save(post);for(const [original,file,extra]of [[service,'services/schema-draft/index.md',{draft:true}],[post,'blog/schema-future/index.md',{date:'2999-01-01'}]]){const r=structuredClone(original);r.file='content/'+file;Object.assign(r.data,{title:'Unpublished schema sentinel',url:'',slug:''},extra);await save(r);}service.data.draft=true;await save(service);run();
 await check('AI author omitted, unpublished children excluded',async()=>{article(await page(dest,route(post)),post.data);for(const section of sections.slice(0,2))list(await page(dest,route(section)),children(section));});
 const detailed=find('services/web-design/index.md');
 const setCopy=(record,key,value)=>{for(const group of Object.values(record.data.copy||{}))if(group&&typeof group==='object'&&Object.hasOwn(group,key)){group[key]=value;return;}record.data.copy[key]=value;};
 setCopy(detailed,'image_path','/uploads/detailed-schema-art.svg');setCopy(detailed,'span_60','Updated visible breadcrumb');setCopy(detailed,'a_87','Updated service ancestor');
 setCopy(detailed,'faq_items',[{question:'Updated detailed question?',answer:'A **detailed** answer with [contact](/contact/).'}]);
 const hostileEmail='schema@example.test</script><script id="schema-injected">not executable</script>';
 s.email=hostileEmail;await saveSettings();await save(detailed);run();
 await check('detailed visible media/FAQ/breadcrumb sync and JSON script safety',async()=>{
  const p=await page(dest,route(detailed));visible(p,detailed.data,s);assert.equal(p.webpage.image,abs('/uploads/detailed-schema-art.svg'));
  const bc=p.graph.find(n=>is(n,'BreadcrumbList'));assert.equal(bc.itemListElement.at(-1).name,'Updated visible breadcrumb');assert.equal(bc.itemListElement.at(-2).name,'Updated service ancestor');
  const qs=p.webpage.mainEntity;assert(is(p.webpage,'FAQPage'));assert.equal(qs.length,1);assert.equal(qs[0].name,p.$('.detail-questions summary').text());assert.equal(plain(qs[0].acceptedAnswer.text),plain(p.$('.detail-questions .faq-answer').html()));
  assert.equal(p.get(bid).email,hostileEmail);assert.equal(p.$('#schema-injected').length,0,'JSON cannot terminate its script tag');
 });
 setCopy(detailed,'faq_items',[]);for(const k of ['email','phone','location','address','seoImage'])delete s[k];await saveSettings();await save(detailed);run();
 await check('cleared detailed FAQs and absent optional business settings',async()=>{
  const p=await page(dest,route(detailed));assert(!is(p.webpage,'FAQPage'));assert.equal(p.$('.detail-questions details').length,0);ref(p.webpage.mainEntity,p.canonical+'#service');
  for(const k of ['email','telephone','location','address','image'])assert(!Object.hasOwn(p.get(bid),k));
 });
 console.log(`Structured-data execution: ${pages} published pages, ${builds} fixture builds, ${failures.length} mismatches`);
 assert.equal(failures.length,0,`Structured-data mismatches (${failures.length}):\n${failures.join('\n')}`);return {pages,builds,fixtureOnly:true};
}
if(process.argv[1])if(import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const work=await workspace();
 try{console.log('PASS structured data',await verifyStructuredData(work));}finally{await cleanup(work);}
}
