import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile, writeFile, mkdir, stat} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import YAML from 'yaml';
import {load} from 'cheerio';
import {root, files, fixture, build, workspace, cleanup} from './support.mjs';
import {parseRecord, saveRecord} from './staff-blog.mjs';
import {cmsEntries} from './cms-entries.mjs';

// Routing mutations and builds belong exclusively to disposable fixtures.
const text = f => readFile(f, 'utf8');
async function snapshot(dir) {
  return Object.fromEntries(await Promise.all((await files(dir)).sort().map(async f => [path.relative(dir,f), await text(f)])));
}
async function html(dest, route) { return load(await text(path.join(dest,route,'index.html'))); }
function link($, selector, route) { assert($(selector).toArray().some(el => $(el).attr('href')===route), `${selector}: missing ${route}`); }
function redirect(rows, from, to) {
  assert.deepEqual(rows.filter(r=>r[0]===from), [[from,to,'301']], `Expected direct 301 ${from} -> ${to}`);
  if(from.endsWith('/') && from!=='/')assert.deepEqual(rows.filter(r=>r[0]===from.slice(0,-1)), [[from.slice(0,-1),to,'301']], `Expected slashless 301 ${from}`);
}
export async function verifyPageUrls(work) {
  const original=await snapshot(path.join(root,'content'));
  const dir=path.join(work,'page-urls'); await mkdir(dir,{recursive:true});
  const source=await fixture(dir), dest=path.join(dir,'output');
  // Historical URL-migration scenarios use isolated archived concepts, not public records.
  for(const slug of ['maple-street-workshop','fieldnote-operations']) {
    const file=path.join(source,'content/case-studies',slug,'index.md');
    try { await stat(file); } catch(error) {
      if(error.code!=='ENOENT')throw error;
      await mkdir(path.dirname(file),{recursive:true});
      await writeFile(file,await text(path.join(root,'tests/fixtures/archived-case-studies',slug+'.md')));
    }
  }

  const settingsFile=path.join(source,'data/settings.yml'), settings=YAML.parse(await text(settingsFile));
  settings.noindex=false; await writeFile(settingsFile,YAML.stringify(settings));
  const config=YAML.parse(await text(path.join(source,'static/sudo/config.yml')));
  for(const e of cmsEntries(config,source).filter(e=>e.file.startsWith('content/'))) {
    const home=e.file==='content/_index.md', fields=e.fields||[];
    for(const name of home?['aliases']:['url','aliases',...(!e.file.endsWith('/_index.md')?['slug']:[])]) {
      const field=fields.find(f=>f.name===name); assert(field, `${e.file}: missing top-level ${name}`);
      assert.equal(field.required,false, `${e.file}: ${name} must be optional`);
    }
    if(home) for(const name of ['url','slug']) assert(!fields.some(f=>f.name===name), `Home must not expose ${name}`);
  }
  const record=async file=>({file,...parseRecord(await text(path.join(source,file)))});
  const staff=await Promise.all((await files(path.join(source,'content/about/team'))).filter(f=>f.endsWith('/index.md')).map(f=>record(path.relative(source,f))));
  const emily=staff.find(r=>r.file==='content/about/team/alex-morgan/index.md');
  assert(emily,'Existing staff source remains discoverable under its stable CMS identity');
  const samples=await Promise.all(['services/web-design','blog/a-clearer-website','case-studies/maple-street-workshop','about/team/alex-morgan','contact','pricing'].map(p=>record(`content/${p}/index.md`)));
  const sections=await Promise.all(['services','blog','case-studies','about'].map(p=>record(`content/${p}/_index.md`)));
  const stable=r=>'/'+r.file.replace(/^content\//,'').replace(/(?:_?index)\.md$/,'');
  const defaults=r=>r.data.url || (r.file.startsWith('content/about/team/') ? '/about/'+(r.data.slug||path.basename(path.dirname(r.file)))+'/' : r.data.slug ? stable(r).replace(/[^/]+\/$/,r.data.slug+'/') : stable(r));
  const write=r=>saveRecord(path.join(source,r.file),r.data,r.body);
  const run=async()=>{
    const before=await snapshot(path.join(source,'content'));
    build(source,dest);
    assert.deepEqual(await snapshot(path.join(source,'content')),before,'Build must not rename or rewrite source files');
  };
  const rows=async()=>(await text(path.join(dest,'_redirects'))).split(/\r?\n/).filter(s=>s.trim()&&!s.startsWith('#')).map(s=>s.trim().split(/\s+/));
  const indexed=async routes=>{
    const search=JSON.parse(await text(path.join(dest,'search-index.json')));
    const sitemap=load(await text(path.join(dest,'sitemap.xml')),{xmlMode:true});
    const locations=sitemap('loc').map((_,el)=>sitemap(el).text()).get();
    for(const route of routes) {
      const $=await html(dest,route);
      assert.equal($('link[rel="canonical"]').attr('href'),`https://herr.test${route}`,`Canonical ${route}`);
      assert(search.pages.some(p=>p.url===route),`Search missing ${route}`);
      assert(locations.includes(`https://herr.test${route}`),`Sitemap missing ${route}`);
    }
    return {search,locations};
  };
  await run(); const about=await html(dest,'/about/');
  const baselineHome=await html(dest,'/');
  const homeLinks=new Set(baselineHome('a').map((_,el)=>baselineHome(el).attr('href')).get());
  for(const r of staff.filter(r=>!r.data.draft)) {
    const route=defaults(r);
    await html(dest,route); link(about,'.staff-card a',route);
  }
  for(const route of ['/staff/','/about/team/']) await assert.rejects(stat(path.join(dest,route,'index.html')),{code:'ENOENT'});
  let redirects=await rows();
  redirect(redirects,'/about/team/alex-morgan/',defaults(emily));
  redirect(redirects,'/about/alex-morgan/',defaults(emily)); redirect(redirects,'/staff/','/about/');
  await indexed(samples.map(defaults));
  console.log('PASS page URLs: default staff, CMS schemas, redirects, canonical/search/sitemap');

  for(const r of [...samples,...sections]) {r.data.url=''; await write(r);}
  await run(); await indexed([...samples.map(defaults),...sections.map(stable)]);
  console.log('PASS page URLs: empty URL preserves defaults');

  const slugs=new Map();
  for(const [i,r] of samples.entries()) {
    r.data.slug=`route-slug-${i}`;
    const section=r.file.split('/')[1];
    slugs.set(r.file,`${['contact','pricing'].includes(section)?'/':section==='about'?'/about/':`/${section}/`}${r.data.slug}/`);
    r.data.aliases=[`/saved-before-${i}/`]; await write(r);
  }
  await run(); await indexed([...slugs.values()]); redirects=await rows();
  for(const [i,r] of samples.entries()) {
    redirect(redirects,stable(r),slugs.get(r.file)); redirect(redirects,`/saved-before-${i}/`,slugs.get(r.file));
  }
  console.log('PASS page URLs: slug edits across services/blog/case/staff/contact/pricing');

  for(const [i,r] of samples.entries()) {r.data.url=`/route-destination-${i}/`;r.data.aliases.push(slugs.get(r.file));await write(r);}
  for(const [i,r] of sections.entries()) {r.data.url=`/route-section-${i}/`;r.data.aliases=[`/saved-section-${i}/`];await write(r);}
  const home=await record('content/_index.md');home.data.aliases=['/previous-home/'];await write(home);
  const blog=samples[1];
  blog.body+='\n\n'+[...samples,...sections].map((r,i)=>`[Route sentinel ${i}](${stable(r)}?route=1#fixture-anchor)`).join('\n\n');
  blog.body+='\n\n[Alias sentinel](/saved-before-0/?route=2#alias-anchor)\n\n[External sentinel](https://example.org/unchanged/?q=1#anchor)\n\n[Local sentinel](#local-anchor)';await write(blog);
  await run();const index=await indexed([...samples,...sections].map(r=>r.data.url).concat('/'));redirects=await rows();
  for(const [i,r] of samples.entries()) {
    for(const old of [stable(r),`/saved-before-${i}/`,slugs.get(r.file)]) redirect(redirects,old,r.data.url);
    assert(!index.search.pages.some(p=>p.url===slugs.get(r.file)));
    assert(!index.locations.includes(`https://herr.test${slugs.get(r.file)}`));
  }
  for(const [i,r] of sections.entries()) {redirect(redirects,stable(r),r.data.url);redirect(redirects,`/saved-section-${i}/`,r.data.url);}
  redirect(redirects,'/previous-home/','/');redirect(redirects,'/staff/',sections[3].data.url);redirect(redirects,'/about/team/',sections[3].data.url);
  const homepage=await html(dest,'/');
  for(const r of [...samples,...sections].filter(r=>homeLinks.has(defaults(r))))link(homepage,'a',r.data.url);
  link(await html(dest,sections[3].data.url),'.staff-card a',samples[3].data.url);
  for(const [r,s] of [[samples[0],sections[0]],[blog,sections[1]],[samples[2],sections[2]],[samples[3],sections[3]]]) {
    link(await html(dest,r.data.url),'.detail-breadcrumb a',s.data.url);
    link(await html(dest,s.data.url),'a',r.data.url);
  }
  const article=await html(dest,blog.data.url);
  const namedHref=label=>article('a').filter((_,el)=>article(el).text()===label).attr('href');
  for(const [i,r] of [...samples,...sections].entries())assert.equal(namedHref(`Route sentinel ${i}`),`${r.data.url}?route=1#fixture-anchor`);
  assert.equal(namedHref('Alias sentinel'),samples[0].data.url+'?route=2#alias-anchor');
  assert.equal(namedHref('External sentinel'),'https://example.org/unchanged/?q=1#anchor');assert.equal(namedHref('Local sentinel'),'#local-anchor');
  const feed=load(await text(path.join(dest,sections[1].data.url,'index.xml')),{xmlMode:true});
  assert(feed('item > link').toArray().some(el=>feed(el).text()===`https://herr.test${blog.data.url}`),'RSS item must follow explicit URL');
  console.log('PASS page URLs: explicit and section URLs, direct alias redirects, cards/nav/breadcrumb/Markdown/feed');

  let rejected=0;
  const change=async(r,fields)=>{const current=await record(r.file);Object.assign(current.data,fields);await write(current);};
  const bad=async(label,mutate,pattern)=>{
    const before=await snapshot(path.join(source,'content'));
    try {
      await mutate();let failure;
      try{build(source,dest);}catch(e){failure=e;}
      assert(failure,`${label}: build unexpectedly succeeded`);
      assert.match(String(failure.stdout||'')+String(failure.stderr||'')+failure.message,pattern,`${label}: route diagnostic required`);
      rejected++;console.log(`PASS page URLs rejected: ${label}`);
    }finally{for(const [file,raw]of Object.entries(before))await writeFile(path.join(source,'content',file),raw);}
  };
  await bad('staff slug computes reserved team URL',()=>change(emily,{slug:'team',url:''}),/public URL "\/about\/team\/".*reserved/i);
  await bad('special directory redirect conflicts with alias',()=>change(samples[0],{aliases:['/about/team/']}),/special redirect.*\/about\/team\/.*conflict/i);
  await bad('duplicate public URLs',()=>change(samples[0],{url:blog.data.url}),/duplicate public URL/i);
  await bad('alias conflicts with live URL',()=>change(samples[0],{aliases:[blog.data.url]}),/conflict/i);
  await bad('two pages claim same alias',async()=>{await change(samples[0],{aliases:['/shared-previous/']});await change(blog,{aliases:['/shared-previous/']});},/conflict/i);
  await bad('URL steals stable source path',()=>change(samples[0],{url:stable(blog)}),/conflict/i);
  for(const reserved of ['/sudo/','/sudo/settings/','/api/','/api/contact/']) {
    await bad(`reserved URL ${reserved}`,()=>change(samples[0],{url:reserved}),/reserved/i);
    await bad(`reserved alias ${reserved}`,()=>change(samples[0],{aliases:[reserved]}),/reserved/i);
  }
  assert.deepEqual(await snapshot(path.join(root,'content')),original,'Repository source content must remain untouched');
  return {slugEdits:samples.length,explicitUrls:samples.length+sections.length,rejectedBuilds:rejected,repositoryContentUnchanged:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const work=await workspace();try{console.log('PASS page URLs',await verifyPageUrls(work));}finally{await cleanup(work);}
}
