import {markdown,escapeMarkdown} from './editor-pages.mjs';
export function migrateSchema(collection){
 const facts=collection.fields.find(f=>f.name==='facts');Object.assign(facts,{widget:'list',collapsed:true,summary:'{{fields.label}}',hint:'Add, remove or reorder facts. Blank values are omitted.',fields:[{name:'label',label:'Label',widget:'string',required:false},markdown('value','Value')]});
 for(const name of ['approach','contributions'])Object.assign(collection.fields.find(f=>f.name===name).fields.find(f=>f.name==='text'),markdown('text','Description'));
 Object.assign(collection.fields.find(f=>f.name==='interests'),markdown('interests','Beyond the brief'));
 if(!collection.fields.some(f=>f.name==='editor_staff_version'))collection.fields.push({name:'editor_staff_version',widget:'hidden',default:1});
 return collection;
}
export function migrateSettingsSchema(entry){const group=entry.fields.find(f=>f.name==='copy')?.fields.find(g=>g.name==='staff_profiles_11');for(const f of group?.fields||[])if(['profile_focus_label','profile_collaboration_label','profile_handoff_label'].includes(f.name))f.widget='hidden';}
export function migrateData(data,copy){if(data.editor_staff_version===1)return data;if(data.facts&&!Array.isArray(data.facts)){const old=data.facts;data.facts=[['focus','profile_focus_label','Focus'],['collaboration','profile_collaboration_label','Works with'],['handoff','profile_handoff_label','A useful handoff']].filter(([key])=>String(old[key]??'').trim()).map(([key,label,fallback])=>({label:copy[label]??fallback,value:escapeMarkdown(String(old[key]).trim())}));}for(const name of ['approach','contributions'])for(const item of data[name]||[])if(item.text!=null)item.text=escapeMarkdown(item.text);if(data.interests!=null)data.interests=escapeMarkdown(data.interests);data.editor_staff_version=1;return data;}
