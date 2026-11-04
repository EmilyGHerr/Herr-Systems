import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import YAML from 'yaml';
import {load} from 'cheerio';
import {workspace,fixture,build,cleanup} from './support.mjs';
const work=await workspace();
try {
 const source=await fixture(work),out=path.join(work,'public'),file=path.join(source,'content/_index.md');
 const raw=await readFile(file,'utf8'),match=raw.match(/^---\n([\s\S]*?)\n---([\s\S]*)$/),original=YAML.parse(match[1]);
 const config=YAML.parse(await readFile(path.join(source,'static/sudo/config.yml'),'utf8'));
 const home=config.collections.flatMap(c=>c.files||[]).find(f=>f.file==='content/_index.md');
 const hero=home.fields.find(f=>f.name==='copy').fields.find(f=>f.name==='hero_1');
 const names=['button_1_url','plain_link_1_url'];
 for(const name of names) {
  const field=hero.fields.find(f=>f.name===name);assert(field,`Missing editable billboard destination ${name}`);assert.equal(field.widget,'string');
  const pattern=new RegExp(field.pattern[0]);
  for(const value of ['','/contact/','#contact','https://example.com/path?q=one&two=three#anchor','mailto:hello@example.com','tel:+15555550123'])assert(pattern.test(value),value);
  for(const value of ['javascript:alert(1)','data:text/html,bad','//example.com','/bad path'])assert(!pattern.test(value),value);
 }
 const render=async data=>{await writeFile(file,'---\n'+YAML.stringify(data)+'---'+match[2]);build(source,out);return load(await readFile(path.join(out,'index.html'),'utf8'));};
 const links=$=>$('.hero-actions a').map((_,e)=>$(e).attr('href')).get();
 const baseline=await render(original),before=baseline('body').html();
 assert.equal(baseline('.hero-actions a').length,2);
 const cases=[['/pricing/?from=home#estimate-title','https://example.com/services?one=1&two=2#plans'],['mailto:hello@example.com','tel:+15555550123'],['#contact','/contact/']];
 for(const values of cases) {
  const data=structuredClone(original);names.forEach((name,i)=>data.copy.hero_1[name]=values[i]);
  const $=await render(data);assert.deepEqual(links($),values);
  const unchanged=load(before);$('.hero-actions').remove();unchanged('.hero-actions').remove();assert.equal($('body').html(),unchanged('body').html(),'Only billboard actions should change');
 }
 const legacy=structuredClone(original);for(const name of names)delete legacy.copy.hero_1[name];
 assert.deepEqual(links(await render(legacy)),['#contact','/services/']);
 for(const value of ['', '   ']){for(const name of names)legacy.copy.hero_1[name]=value;assert.deepEqual(links(await render(legacy)),['#contact','/services/']);}
 for(const value of ['javascript:alert(1)','data:text/html,bad','//example.com','/bad path']){for(const name of names)legacy.copy.hero_1[name]=value;assert.deepEqual(links(await render(legacy)),['#contact','/services/']);}
 const flat=structuredClone(original);flat.copy=Object.assign({},...Object.values(original.copy));flat.copy.button_1_url='/pricing/';flat.copy.plain_link_1_url='#services';assert.deepEqual(links(await render(flat)),['/pricing/','#services']);
 const services=path.join(source,'content/services/_index.md');let text=await readFile(services,'utf8');text=text.replace(/^---\n/,'---\nurl: /new-services/\n');await writeFile(services,text);
 const moved=structuredClone(original);moved.copy.hero_1.plain_link_1_url='/services/?from=billboard#offer';assert.deepEqual(links(await render(moved)),[original.copy.hero_1.button_1_url||'#contact','/new-services/?from=billboard#offer']);
 console.log('PASS homepage billboard destinations: CMS fields/validation, both edited hrefs, original appearance/content, blank/missing fallbacks, legacy flat data, internal URL remapping with query/fragment');
}finally{await cleanup(work);}
