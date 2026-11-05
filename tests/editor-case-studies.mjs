import assert from 'node:assert/strict';
import { cpSync, readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import YAML from 'yaml';
import { load } from 'cheerio';
import { migrateSchema, migrateData } from '../scripts/editor-case-studies.mjs';
const root=resolve(import.meta.dirname,'..');
const schema=YAML.parse(readFileSync(join(root,'static/sudo/config.yml'),'utf8')).collections.find(c=>c.name==='case_studies');
migrateSchema(schema);const schemaOnce=structuredClone(schema);assert.deepEqual(migrateSchema(schema),schemaOnce);
const groups=schema.fields.find(f=>f.name==='copy').fields;
for(const g of groups)for(const f of g.fields) {
 assert(!/_(?:step|check|deliverable)_\d|_(?:before|after)_\d|_decision_\d|_phase_\d/.test(f.name),`fixed field ${f.name}`);
 if(f.widget==='list'){assert(!('min' in f));assert(!('max' in f));}
 if(f.widget==='markdown')assert.deepEqual(f.modes,['rich_text','raw']);
}
const empty={detail_layout:'structured',copy:{discovery:{discovery_body:'',discovery_text:'obsolete',discovery_journey:[],discovery_step_1:'obsolete',custom:7}}};
migrateData(empty);assert.deepEqual(empty.copy.discovery,{discovery_body:'',discovery_journey:[],custom:7});
const article={detail_layout:'article',body:'**Untouched** [link](/x/)',copy:{cover:{cover_caption:'Caption'},private:{flag:1}}};
assert.deepEqual(migrateData(structuredClone(article)),article);
const flat={copy:{discovery_text:'<unsafe> *literal* [link](/x/)',discovery_direction:'Second',meta:1}};
migrateData(flat);assert(flat.copy.discovery_body.includes('&lt;unsafe&gt;'));assert(flat.copy.discovery_body.includes('\\*literal\\*'));assert.equal(flat.copy.meta,1);
const tmp=mkdtempSync(join(tmpdir(),'herr-case-study-'));
const fixture=join(tmp,'site');
try {
 cpSync(root,fixture,{recursive:true,filter:p=>!['.git','node_modules','public','resources','.hugo_build.lock'].includes(p.split('/').at(-1))});
 const template=join(fixture,'layouts/partials/pages/case-study.html');
 const current=readFileSync(template,'utf8');
 // A fixture-only helper keeps the worker independent of concurrent shared-helper work.
 const helper=join(fixture,'layouts/partials/editor-prose.html');
 if(!existsSync(helper))writeFileSync(helper,'{{ if isset .copy .key }}{{ .page.RenderString (dict "display" "block") (index .copy .key | default "") }}{{ else }}{{ .legacy | safeHTML }}{{ end }}');
 const build=name=>{const out=join(tmp,name);execFileSync('hugo',['--source',fixture,'--destination',out,'--cleanDestinationDir'],{stdio:'pipe'});return out;};
 const archived=join(root,'tests/fixtures/archived-case-studies');
 // Historical migration fixtures remain available after concepts leave the portfolio.
 for(const slug of ['maple-street-workshop','fieldnote-operations']) {
  const file=join(fixture,'content/case-studies',slug,'index.md');
  if(!existsSync(file)){mkdirSync(join(fixture,'content/case-studies',slug),{recursive:true});cpSync(join(archived,slug+'.md'),file);}
 }
 const studies=['northline-community','maple-street-workshop','fieldnote-operations','septagon','burn-blue'];
 // Keep legacy-shaped input independent of the already-migrated production source.
 const legacyCopies=JSON.parse(readFileSync(join(root,'tests/fixtures/editor-case-studies-legacy.json'),'utf8'));
 for(const [slug,copy]of Object.entries(legacyCopies)){const file=join(fixture,'content/case-studies',slug,'index.md'),raw=readFileSync(file,'utf8'),match=raw.match(/^---\n([\s\S]*?)\n---/),data=YAML.parse(match[1]);data.copy=copy;writeFileSync(file,raw.replace(match[0],()=>'---\n'+YAML.stringify(data)+'---'));}
 const text=(out,slug)=>load(readFileSync(join(out,'case-studies',slug,'index.html'),'utf8'))('main').text().replace(/\s+/g,' ').trim();
 // Frozen pre-migration renderer: stays independent after this feature is committed.
 writeFileSync(template,readFileSync(join(root,'tests/fixtures/case-study-legacy.html'),'utf8'));
 const baseline=build('baseline');
 writeFileSync(template,current);const legacy=build('legacy');
 for(const slug of studies)assert.equal(text(legacy,slug),text(baseline,slug),`${slug} legacy parity`);
 for(const slug of studies) {
  const p=join(fixture,'content/case-studies',slug,'index.md');const source=readFileSync(p,'utf8');const match=source.match(/^---\n([\s\S]*?)\n---([\s\S]*)$/);assert(match);
  const data=YAML.parse(match[1]);migrateData(data);const once=structuredClone(data);assert.deepEqual(migrateData(data),once);
  writeFileSync(p,`---\n${YAML.stringify(data)}---${match[2]}`);
 }
 const migrated=build('migrated');for(const slug of studies)assert.equal(text(migrated,slug),text(baseline,slug),`${slug} migrated wording/order`);
 const p=join(fixture,'content/case-studies/maple-street-workshop/index.md');const src=readFileSync(p,'utf8');const m=src.match(/^---\n([\s\S]*?)\n---([\s\S]*)$/);const d=YAML.parse(m[1]);
 d.copy.discovery.discovery_body='';d.copy.discovery.discovery_text='SHOULD NOT FALL BACK';d.copy.discovery.discovery_journey=[];d.copy.discovery.discovery_step_1='SHOULD NOT FALL BACK';
 d.copy.decisions.decisions_items=Array.from({length:7},(_,i)=>({heading:`New decision ${7-i}`,body:`**Rich ${7-i}** [link](/contact/)`}));
 writeFileSync(p,`---\n${YAML.stringify(d)}---${m[2]}`);const changed=build('edited');const $=load(readFileSync(join(changed,'case-studies/maple-street-workshop/index.html'),'utf8'));
 assert(!$('#discovery').text().includes('SHOULD NOT FALL BACK'));assert.equal($('#discovery .case-path span').length,0);assert.equal($('#discovery > p:not(.kicker)').length,0);
 assert.equal($('#decisions .case-decision').length,7);assert.equal($('#decisions .case-decision h3').first().text(),'New decision 7');assert.equal($('#decisions strong').length,7);assert.equal($('#decisions a').length,7);
 console.log('PASS: schema/data idempotence, metadata/article preservation, escaping, legacy/migrated wording parity (5 studies), rich lists and explicit clears.');
} finally {rmSync(tmp,{recursive:true,force:true});}
