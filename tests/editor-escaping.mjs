import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import YAML from 'yaml';
import {load} from 'cheerio';
import {workspace,fixture,build,cleanup} from './support.mjs';
import {migrateData} from '../scripts/editor-pages.mjs';
import {migrateData as migrateStaff} from '../scripts/editor-staff.mjs';
const samples=["- A literal dash, not a list","1. A literal numbered sentence","Literal &copy; and &#169; and &amp;","> A literal quote","---","## A literal heading","[literal link](https://example.org/)","Literal <tag> & \"quotes\" and apostrophe's","*not emphasis* and `not code`","https://example.org/a?x=1&y=2","hello@example.org","+ Another literal marker","~~not strikethrough~~"];
const work=await workspace();try{
 const source=await fixture(work),rows=[];
 for(const value of samples){
  const page={copy:{detail_overview_4:{p_26:value,p_27:'',p_28:''}}};migrateData(page,'about');const before=structuredClone(page);migrateData(page,'about');assert.deepEqual(page,before);rows.push({body:page.copy.detail_overview_4.story_body,expected:value});
  const staff={facts:{focus:value},interests:value,approach:[{text:value}],contributions:[{text:value}]};migrateStaff(staff,{});const once=structuredClone(staff);migrateStaff(staff,{});assert.deepEqual(staff,once);for(const body of[staff.facts[0].value,staff.interests,staff.approach[0].text,staff.contributions[0].text])rows.push({body,expected:value});
 }
 await fs.mkdir(path.join(source,'content/migration-check'),{recursive:true});await fs.mkdir(path.join(source,'layouts/migration-check'),{recursive:true});
 await fs.writeFile(path.join(source,'content/migration-check/index.md'),'---\n'+YAML.stringify({title:'Migration preservation',type:'migration-check',samples:rows})+'---\n');
 await fs.writeFile(path.join(source,'layouts/migration-check/single.html'),'{{ range $i,$sample := .Params.samples }}<section data-sample="{{ $i }}">{{ partial "editor-prose.html" (dict "page" $ "copy" $sample "key" "body" "legacy" "") }}</section>{{ end }}');
 const out=path.join(work,'public');build(source,out);const $=load(await fs.readFile(path.join(out,'migration-check/index.html'),'utf8'));
 for(const[i,row]of rows.entries()){const section=$('section[data-sample="'+i+'"]');assert.equal(section.text().trim(),row.expected,'Literal migration text '+i);assert.equal(section.find('ul,ol,li,blockquote,hr,h1,h2,h3,em,strong,del,a,pre,code,tag').length,0,'Accidental Markdown formatting '+i);}
 console.log('PASS actual Hugo page/staff migration preserves literal block markers, entities, headings, formatting punctuation, HTML-like text, quotes, URLs and email; idempotent.');
}finally{await cleanup(work);}
