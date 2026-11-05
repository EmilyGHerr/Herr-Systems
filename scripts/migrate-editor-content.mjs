// Content-preserving, repeatable source migration. Run with node scripts/migrate-editor-content.mjs.
import fs from 'node:fs';
import YAML from 'yaml';
import {cmsEntries} from '../tests/cms-entries.mjs';
import * as pages from './editor-pages.mjs';
import * as services from './editor-services.mjs';
import * as studies from './editor-case-studies.mjs';
import * as staff from './editor-staff.mjs';
const configPath='static/sudo/config.yml',config=YAML.parse(fs.readFileSync(configPath,'utf8'));
for(const collection of config.collections){for(const entry of collection.files||[collection]){pages.migrateSchema(entry);if((entry.file||entry.folder||'').startsWith('content')&&!entry.fields.some(f=>f.name==='editor_content_version'))entry.fields.push({name:'editor_content_version',widget:'hidden',default:1});}if(collection.name==='services')services.migrateSchema(collection);if(collection.name==='case_studies')studies.migrateSchema(collection);if(collection.name==='staff')staff.migrateSchema(collection);}
for(const collection of config.collections)for(const entry of collection.files||[collection])pages.polishSchema(entry);
const settings=config.collections.find(c=>c.name==='settings').files.find(f=>f.name==='settings');staff.migrateSettingsSchema(settings);const shared=Object.assign({},...Object.values(YAML.parse(fs.readFileSync(settings.file,'utf8')).copy));
let count=0;for(const entry of cmsEntries(config,process.cwd()).filter(e=>e.file?.endsWith('.md'))){const raw=fs.readFileSync(entry.file,'utf8'),match=raw.match(/^---\n([\s\S]*?)\n---/);if(!match)throw Error('Missing front matter: '+entry.file);const data=YAML.parse(match[1]),before=JSON.stringify(data),name=entry.name.split(':')[0];if(name==='services'&&entry.name.includes(':'))services.migrateData(data);if(name==='case_studies')studies.migrateData(data);if(name==='staff')staff.migrateData(data,shared);pages.migrateData(data,name);if(JSON.stringify(data)!==before){fs.writeFileSync(entry.file,raw.replace(match[0],()=>'---\n'+YAML.stringify(data)+'---'));count++;}}
fs.writeFileSync(configPath,YAML.stringify(config,{lineWidth:100}));console.log('Migrated '+count+' content records; existing rich content and unrelated data preserved.');
