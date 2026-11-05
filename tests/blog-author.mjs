import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import {load} from 'cheerio';
import {workspace,fixture,build,cleanup} from './support.mjs';
const work=await workspace();
const parse=raw=>{const m=raw.match(/^---\n([\s\S]*?)\n---([\s\S]*)$/);return {data:YAML.parse(m[1]),body:m[2]};};
try {
 const source=await fixture(work),out=path.join(work,'public');
 const postPath=path.join(source,'content/blog/a-clearer-website/index.md'),original=parse(await fs.readFile(postPath,'utf8'));
 const staffPath=path.join(source,'content/about/team/sam-rivera/index.md'),staff=parse(await fs.readFile(staffPath,'utf8'));
 const write=(file,record)=>fs.writeFile(file,'---\n'+YAML.stringify(record.data)+'---'+record.body);
 const config=YAML.parse(await fs.readFile(path.join(source,'static/sudo/config.yml'),'utf8'));
 const field=config.collections.find(c=>c.name==='blog').fields.find(f=>f.name==='author');
 assert.equal(field.widget,'relation');assert.equal(field.collection,'staff');assert.equal(field.value_field,'{{slug}}');
 const post=structuredClone(original);
 const render=async()=>{await write(postPath,post);build(source,out);return load(await fs.readFile(path.join(out,'blog/a-clearer-website/index.html'),'utf8'));};
 for(const value of [undefined,'',null,'missing-profile','https://example.org/']) {
  if(value===undefined)delete post.data.author;else post.data.author=value;
  const $=await render();assert.equal($('.post-byline').length,0,'Missing/invalid authors cannot create broken or external bylines');
 }
 post.data.author='sam-rivera/index';
 for(const fragment of ['pages/blog-article.html',undefined]) {
  if(fragment)post.data.fragment=fragment;else delete post.data.fragment;
  staff.data.title='Author <Test> '+String.fromCharCode(38)+' Co';staff.data.url='/about/changed-author-route/';await write(staffPath,staff);
  const $=await render(),byline=$('.blog-intro .post-byline');
  assert.equal(byline.length,1);assert.equal(byline.find('a').text(),staff.data.title);assert.equal(byline.find('a').attr('href'),staff.data.url);assert.equal(byline.find('a').attr('rel'),'author');
  assert.equal(byline.prev().attr('class'),'detail-lead');assert.equal(byline.prev().prev().prop('tagName'),'H1');
  assert.equal($('meta[name=author]').attr('content'),staff.data.title);assert.equal(byline.find('test').length,0,'Names must be HTML escaped');
  assert((await fs.readFile(path.join(out,'about/changed-author-route/index.html'),'utf8')).includes('<title>'));
 }
 post.data.fragment='pages/blog-article.html';post.data.author='sam-rivera';staff.data.draft=true;await write(staffPath,staff);assert.equal((await render())('.post-byline').length,0,'Unpublished staff cannot produce broken links');
 assert.equal(parse(await fs.readFile(postPath,'utf8')).body,original.body);
 console.log('PASS blog authors: both templates, stable identity/custom profile route/name changes, byline placement, metadata, escaping, absent/empty/missing/draft authors');
}finally{await cleanup(work);}
