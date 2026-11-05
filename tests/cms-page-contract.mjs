import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import {load} from 'cheerio';
import {cmsEntries} from './cms-entries.mjs';
import {root,files,workspace,fixture,build,cleanup} from './support.mjs';
const config=YAML.parse(await fs.readFile(path.join(root,'static/sudo/config.yml'),'utf8'));
const entries=cmsEntries(config,root),owned=new Set(entries.map(e=>e.file));
const sourceFiles=(await files(path.join(root,'content'))).filter(f=>f.endsWith('.md'));
for(const file of sourceFiles){const relative=path.relative(root,file);const raw=await fs.readFile(file,'utf8');const data=YAML.parse(raw.match(/^---\n([\s\S]*?)\n---/)[1]);if(data.build?.render==='never')continue;assert(owned.has(relative),relative+': no CMS editor owns this page');}
const about=entries.find(e=>e.name==='about'),story=about.fields.find(f=>f.name==='copy').fields.find(g=>g.name==='detail_overview_4');assert.equal(story.widget,'object');assert.equal(story.collapsed,false);assert(story.fields.some(f=>f.name==='story_title_1'&&f.widget==='string'));assert(story.fields.some(f=>f.name==='story_body'&&f.widget==='markdown'));assert(!story.fields.some(f=>/^p_2[678]$/.test(f.name)));const principles=about.fields.find(f=>f.name==='copy').fields.find(f=>f.name==='detail_fit_5');assert(principles.fields.some(f=>f.name==='principles_items'&&f.widget==='list'&&!f.min&&!f.max));assert(!principles.fields.some(f=>/^li_/.test(f.name)));
for(const entry of entries.filter(e=>e.file?.startsWith('content/'))){assert(entry.fields.some(f=>f.name==='title'&&f.widget!=='hidden'),entry.name+': hidden page title');const copy=entry.fields.find(f=>f.name==='copy');if(copy)assert.equal(copy.collapsed,false,entry.name+': visible copy hidden behind an outer collapsed group');}
const work=await workspace();try{const source=await fixture(work),dest=path.join(work,'output');for(const [relative,fallback]of [['about/_index.md','/assets/about/pixel-hexagon-embers.svg'],['services/web-design/index.md','/assets/services/web-design-billboard.svg']]){const file=path.join(source,'content',relative),raw=await fs.readFile(file,'utf8'),match=raw.match(/^---\n([\s\S]*?)\n---/),data=YAML.parse(match[1]);const render=async()=>{await fs.writeFile(file,raw.replace(match[0],'---\n'+YAML.stringify(data)+'---'));build(source,dest);return load(await fs.readFile(path.join(dest,relative.replace(/(?:_index|index)\.md$/,'index.html')),'utf8'));};assert.equal((await render())('.detail-billboard-art img').attr('src'),fallback);data.copy.detail_billboard_art_3.image_path='/uploads/about-headshot-3.svg';assert.equal((await render())('.detail-billboard-art img').attr('src'),'/uploads/about-headshot-3.svg');delete data.copy.detail_billboard_art_3.image_path;assert.equal((await render())('.detail-billboard-art img').attr('src'),fallback);}}
finally{await cleanup(work);}
console.log(`PASS CMS page ownership for ${sourceFiles.length} source files, discoverable About fields, open content groups, editable billboard images and legacy fallbacks`);
