import fs from 'node:fs';
const proseFields=JSON.parse(fs.readFileSync(new URL('./editor-prose-fields.json',import.meta.url),'utf8'));
export const markdown=(name,label='Content')=>({name,label,widget:'markdown',modes:['rich_text','raw'],required:false,hint:'Write naturally: paragraphs, emphasis, links and lists. Switch to Markdown only if you prefer.'});
// Plain legacy text is not Markdown: protect every ASCII punctuation character.
// Entities avoid typography/HTML interpretation without re-escaping generated entities.
const literalEntities={'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'};
export const escapeMarkdown=value=>Array.from(String(value??''),character=>{
 const code=character.codePointAt(0);
 if(code<33||code>126||/[A-Za-z0-9]/.test(character))return character;
 return literalEntities[character]??'\\'+character;
}).join('');
const strings=keys=>keys.map(name=>({name,label:name==='title'?'Heading':'Optional number label',widget:'string',required:false}));
const mdList=(name,label)=>({name,label,widget:'list',required:false,collapsed:true,allow_add:true,field:markdown('item','Item'),hint:'Add, remove or drag items to reorder. There is no fixed number of items.'});
const objectList=(name,label)=>({name,label,widget:'list',required:false,collapsed:true,allow_add:true,summary:'{{fields.title}}',fields:[...strings(['title']),markdown('body','Description'),{name:'label',label:'Custom step label (optional)',widget:'string',required:false,hint:'Leave blank for automatic numbering.'}],hint:'Add, remove or reorder steps; numbers update automatically.'});
function replaceFields(entry,groupName,oldNames,next){const group=entry.fields.find(f=>f.name==='copy')?.fields.find(f=>f.name===groupName);if(!group)return;const old=new Set(oldNames);let inserted=false;group.fields=group.fields.flatMap(f=>{if(!old.has(f.name))return[f];if(inserted)return[];inserted=true;return[next];});}
const aboutStory=['p_26','p_27','p_28'],principles=['li_19','li_20','li_21','li_22'],approach=['detail_step_1','h3_10','p_31','detail_step_2','h3_11','p_32','detail_step_3','h3_12','p_33'];
export function migrateSchema(entry){
 if(entry.name==='about'){
  replaceFields(entry,'detail_overview_4',aboutStory,markdown('story_body','Story'));
  replaceFields(entry,'detail_fit_5',principles,mdList('principles_items','Principles'));
  replaceFields(entry,'approach_8',approach,objectList('approach_items','Working approach steps'));
 }
 if(entry.name==='home')replaceFields(entry,'why_10',['strong_1','p_8','p_9'],markdown('pricing_body','Pricing explanation'));
 if(entry.name==='pricing')replaceFields(entry,'estimate_disclaimer_13',['strong_14','p_20','strong_15','p_21','strong_16','p_22','p_23','a_53','p_24','a_54','p_25'],markdown('estimate_notes_body','Estimate explanation and notes'));
 if(entry.name==='contact'){const next=objectList('next_steps','What happens next');next.summary='{{fields.body}}';next.fields=next.fields.filter(f=>f.name!=='title');replaceFields(entry,'desk_direct_12',['direct_54','direct_55','direct_56','direct_57','direct_58','direct_59'],next);}
 for(const group of entry.fields.find(f=>f.name==='copy')?.fields||[]){if(group.widget==='hidden')continue;for(const field of group.fields||[]){if((proseFields[entry.name]||[]).includes(field.name)&&field.widget!=='hidden')Object.assign(field,markdown(field.name,field.label?.replace(/^Paragraph(?: \d+)?$/,'Content')||'Content'));else if(field.widget==='text'&&/(?:title|heading|kicker|label|button|icon|separator|^aria|^alt_|^a_|^span_|^b_|^em_|^h[234]_|^strong_|^legend_|^summary_)/.test(field.name))field.widget='string';}}
 return entry;
}
function migrateGroup(group,key,oldNames,value){if(!group||Object.hasOwn(group,key)||!oldNames.some(k=>Object.hasOwn(group,k)))return;group[key]=value(group);for(const k of oldNames)delete group[k];}
export function migrateData(data,name){
 if(data.editor_content_version===1)return data;
 const before=JSON.stringify(data);
 const groups=data.copy||{};
 if(name==='about'){
  migrateGroup(groups.detail_overview_4,'story_body',aboutStory,g=>aboutStory.map(k=>escapeMarkdown(g[k])).join('\n\n'));
  migrateGroup(groups.detail_fit_5,'principles_items',principles,g=>principles.filter(k=>g[k]!=null&&String(g[k]).trim()).map(k=>escapeMarkdown(g[k])));
  migrateGroup(groups.approach_8,'approach_items',approach,g=>[0,1,2].filter(i=>g['h3_'+(10+i)]||g['p_'+(31+i)]).map(i=>{const item={title:g['h3_'+(10+i)]||'',body:escapeMarkdown(g['p_'+(31+i)])},old=g['detail_step_'+(1+i)];if(old&&old!==String(i+1).padStart(2,'0'))item.label=old;return item;}));
 }
 if(name==='home')migrateGroup(groups.why_10,'pricing_body',['strong_1','p_8','p_9'],g=>'**'+escapeMarkdown(g.strong_1)+'**\n\n'+escapeMarkdown(g.p_8)+'\n\n'+escapeMarkdown(g.p_9));
 if(name==='pricing')migrateGroup(groups.estimate_disclaimer_13,'estimate_notes_body',['strong_14','p_20','strong_15','p_21','strong_16','p_22','p_23','a_53','p_24','a_54','p_25'],g=>[14,15,16].map((n,i)=>'**'+escapeMarkdown(g['strong_'+n])+'** '+escapeMarkdown(g['p_'+(20+i)])).concat(escapeMarkdown(g.p_23)+' ['+escapeMarkdown(g.a_53)+'](/services/consulting/) '+escapeMarkdown(g.p_24)+' ['+escapeMarkdown(g.a_54)+'](/services/contract-work/)'+escapeMarkdown(g.p_25)).join('\n\n'));
 if(name==='contact')migrateGroup(groups.desk_direct_12,'next_steps',['direct_54','direct_55','direct_56','direct_57','direct_58','direct_59'],g=>[0,1,2].map(i=>{const item={body:escapeMarkdown(g['direct_'+(55+i*2)])},label=g['direct_'+(54+i*2)];if(label&&label!==String(i+1).padStart(2,'0'))item.label=label;return item;}));
 for(const group of Object.values(groups))if(group&&typeof group==='object'&&!Array.isArray(group))for(const key of proseFields[name]||[])if(Object.hasOwn(group,key))group[key]=escapeMarkdown(group[key]);
 if(JSON.stringify(data)!==before)data.editor_content_version=1;
 return data;
}

// Collapsed rows should identify their content, and new optional lists start empty.
export function polishSchema(entry){
 const names=new Set(['principles_items','approach_items','next_steps','fit_items','subtype_items','process_items','faq_items','facts_items','discovery_journey','decisions_items','examples_before_items','examples_after_items','implementation_checks','handoff_deliverables','handoff_phases','navigation_items']);
 for(const group of entry.fields.find(f=>f.name==='copy')?.fields||[])for(const field of group.fields||[])if(names.has(field.name)&&field.widget==='list'){field.default=[];field.collapsed=true;if(field.field)field.summary='{{fields.'+field.field.name+'}}';}
 if(entry.name==='staff')for(const field of entry.fields)if(['facts','approach','contributions'].includes(field.name)){field.default=[];field.collapsed=true;}
}
