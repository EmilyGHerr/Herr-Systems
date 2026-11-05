// Pure, idempotent migrations. Callers own persistence; unrelated metadata is retained.
const own = (o,k) => Object.hasOwn(o,k);
const str = (name,label) => ({name,label,widget:'string',required:false});
const rich = (name,label) => ({name,label,widget:'markdown',modes:['rich_text','raw'],required:false});
// Old copy fields were plain text, not HTML/Markdown: preserve their literal wording.
const md = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/([\\`*_[\]{}()#+.!|~>-])/g,'\\$1');
const body = (group,name,keys,convert) => ({group,name,keys,field:rich(name,name===`${group}_body`?'Story':name.replace(`${group}_`,'').replace(/_/g,' ')),convert:convert ?? (o=>keys.filter(k=>own(o,k)).map(k=>md(o[k])).join('\n\n'))});
const bodies = [
 body('brief','brief_body',['brief_text']),
 body('brief','brief_objective_body',['brief_objective','brief_boundary_label','brief_boundary'],o=>[own(o,'brief_objective')?md(o.brief_objective):'', [own(o,'brief_boundary_label')?`**${md(o.brief_boundary_label)}**`:'',own(o,'brief_boundary')?md(o.brief_boundary):''].filter(Boolean).join(' ')].filter(Boolean).join('\n\n')),
 body('discovery','discovery_body',['discovery_text','discovery_direction']),
 ...[['examples','examples_body','examples_intro'],['examples','examples_detail_body','examples_detail_text'],['examples','examples_mobile_body','examples_mobile_text'],['implementation','implementation_body','implementation_text'],['implementation','implementation_edge_cases_body','implementation_edge_cases_text'],['implementation','implementation_verification_body','implementation_verification_note'],['handoff','handoff_body','handoff_text'],['outcomes','outcomes_body','outcomes_text'],['outcomes','outcomes_evidence_body','outcomes_evidence_text'],['lessons','lessons_body','lessons_text'],['next','next_body','next_description']].map(([g,n,k])=>body(g,n,[k]))
];
const list = (group,name,label,keys,fields,convert) => ({group,name,keys,convert,field:{name,label,widget:'list',required:false,collapsed:true,summary:'{{fields.heading}}{{fields.label}}{{fields.text}}',fields}});
const simple = (g,n,label,p,count) => {const keys=Array.from({length:count},(_,i)=>`${p}${i+1}`);return list(g,n,label,keys,[rich('text','Text')],o=>keys.filter(k=>own(o,k)).map(k=>({text:md(o[k])})));};
const sections=['brief','discovery','decisions','examples','implementation','handoff','outcomes','lessons'];
const facts=['organization','type','role','status'];
const lists = [
 list('facts','facts_items','Project facts',facts.flatMap(k=>[`facts_${k}_label`,`facts_${k}`]),[str('label','Label'),str('text','Value')],o=>facts.filter(k=>own(o,`facts_${k}`)||own(o,`facts_${k}_label`)).map(k=>({label:o[`facts_${k}_label`]??'',text:o[`facts_${k}`]??''}))),
 simple('discovery','discovery_journey','Visitor journey','discovery_step_',4),
 list('decisions','decisions_items','Design decisions',[1,2,3].flatMap(i=>[`decisions_decision_${i}_heading`,`decisions_decision_${i}_text`]),[str('heading','Heading'),rich('body','Decision')],o=>[1,2,3].filter(i=>own(o,`decisions_decision_${i}_heading`)||own(o,`decisions_decision_${i}_text`)).map(i=>({heading:o[`decisions_decision_${i}_heading`]??'',body:md(o[`decisions_decision_${i}_text`])}))),
 simple('examples','examples_before_items','Before','examples_before_',3),
 simple('examples','examples_after_items','After','examples_after_',3),
 simple('implementation','implementation_checks','Verification checks','implementation_check_',4),
 simple('handoff','handoff_deliverables','Deliverables','handoff_deliverable_',4),
 list('handoff','handoff_phases','Delivery phases',[1,2,3,4].flatMap(i=>[`handoff_phase_${i}_label`,`handoff_phase_${i}_text`]),[str('label','Phase label'),rich('text','Description')],o=>[1,2,3,4].filter(i=>own(o,`handoff_phase_${i}_label`)||own(o,`handoff_phase_${i}_text`)).map(i=>({label:o[`handoff_phase_${i}_label`]??'',text:md(o[`handoff_phase_${i}_text`])}))),
 list('navigation','navigation_items','Contents links',sections.map(k=>`navigation_${k}`),[{...str('id','Section anchor (stable)'),widget:'select',options:sections},str('label','Link label')],o=>sections.filter(k=>own(o,`navigation_${k}`)).map(id=>({id,label:o[`navigation_${id}`]})))
];
export function migrateSchema(collection) {
 if(collection?.name!=='case_studies') return collection;
 for(const group of collection.fields?.find(f=>f.name==='copy')?.fields??[]) {
  for(const r of [...bodies,...lists].filter(r=>r.group===group.name)) {
   const index=group.fields.findIndex(f=>r.keys.includes(f.name));
   if(index!==-1&&!group.fields.some(f=>f.name===r.name))group.fields.splice(index,0,structuredClone(r.field));
   group.fields=group.fields.filter(f=>!r.keys.includes(f.name));
  }
  for(const f of group.fields)if(f.widget==='text'&&/(?:heading|label|eyebrow|separator|icon|navigation_)/.test(f.name))f.widget='string';
 }
 return collection;
}
export function migrateData(data) {
 if(!data?.copy||typeof data.copy!=='object')return data;
 for(const r of [...bodies,...lists]) {
  const group=data.copy[r.group];
  const o=group&&typeof group==='object'&&!Array.isArray(group)?group:data.copy;
  if(!own(o,r.name)&&r.keys.some(k=>own(o,k)))o[r.name]=r.convert(o);
  if(own(o,r.name))for(const k of r.keys)delete o[k];
 }
 return data;
}
