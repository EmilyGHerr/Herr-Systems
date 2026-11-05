// Pure in-place migrations; the caller owns persistence and transaction boundaries.
const own = (o,k) => Object.hasOwn(o,k);
const text = (name,label) => ({name,label,widget:'string',required:false});
const rich = (name,label) => ({name,label,widget:'markdown',modes:['rich_text','raw'],required:false});
// These legacy values were plain text, not Markdown or HTML.
const md = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/([\\`*_[\]{}()#+.!|~>-])/g,'\\$1');
const ids=['retro-web-design','mobile-web-design','small-business-web-design','ecommerce-web-design','landing-page-design','website-redesign'];
const list=(name,label,fields)=>({name,label,widget:'list',required:false,collapsed:true,summary:'{{fields.title}}{{fields.question}}',fields});
const rule=(group,name,keys,field,convert)=>({group,name,keys,field,convert});
const rules=[
 rule('detail_overview_4','overview_body',['p_46','p_47','p_48','p_49'],rich('overview_body','Overview'),o=>['p_46','p_47','p_48','p_49'].filter(k=>own(o,k)).map(k=>md(o[k])).join('\n\n')),
 rule('detail_fit_5','fit_items',['li_23','li_24','li_25'],{name:'fit_items',label:'A good fit if',widget:'list',required:false,field:rich('item','Item')},o=>['li_23','li_24','li_25'].filter(k=>own(o,k)).map(k=>md(o[k]))),
 rule('detail_subtypes_6','subtype_items',ids.flatMap((_,i)=>[`summary_${i+3}`,`p_${i+51}`,`a_${i+91}`,`span_${i+61}`]),list('subtype_items','Web design options',[text('id','Anchor ID (keep existing IDs stable)'),text('title','Title'),rich('body','Description'),text('link_label','Link text'),{...text('link_url','Link destination'),default:'#project',hint:'Local path, #anchor, https://, mailto:, or tel: link.'},text('icon','Link icon')]),o=>ids.flatMap((id,i)=>[`summary_${i+3}`,`p_${i+51}`,`a_${i+91}`,`span_${i+61}`].some(k=>own(o,k))?[{id,title:o[`summary_${i+3}`]??'',body:md(o[`p_${i+51}`]),link_label:o[`a_${i+91}`]??'',link_url:'#project',icon:o[`span_${i+61}`]??''}]:[])),
 rule('process_7','process_items',[0,1,2].flatMap(i=>[`detail_step_${i+4}`,`h3_${i+13}`,`p_${i+57}`]),list('process_items','Process steps (automatically numbered)',[text('title','Step title'),rich('body','Description')]),o=>[0,1,2].filter(i=>own(o,`h3_${i+13}`)||own(o,`p_${i+57}`)).map(i=>({title:o[`h3_${i+13}`]??'',body:md(o[`p_${i+57}`])}))),
 rule('detail_faq_8','faq_items',[0,1,2,3].flatMap(i=>[`summary_${i+9}`,`p_${i+61}`]),list('faq_items','Questions and answers',[text('question','Question'),rich('answer','Answer')]),o=>[0,1,2,3].filter(i=>own(o,`summary_${i+9}`)||own(o,`p_${i+61}`)).map(i=>({question:o[`summary_${i+9}`]??'',answer:md(o[`p_${i+61}`])}))),
 ...[['detail_subtypes_6','subtypes_body','p_50','Options introduction'],['detail_faq_8','faq_body','p_60','FAQ introduction'],['project_9','project_body','p_65','Project invitation']].map(([g,n,k,l])=>rule(g,n,[k],rich(n,l),o=>md(o[k])))
];
export function migrateSchema(collection) {
 if(collection?.name!=='services')return collection;
 const copy=collection.fields?.find(f=>f.name==='copy');
 for(const r of rules){
  const group=copy?.fields?.find(f=>f.name===r.group);
  if(!group?.fields)continue;
  const index=group.fields.findIndex(f=>r.keys.includes(f.name));
  if(index!==-1&&!group.fields.some(f=>f.name===r.name))group.fields.splice(index,0,structuredClone(r.field));
  group.fields=group.fields.filter(f=>!r.keys.includes(f.name));
 }
 for(const group of copy?.fields??[])for(const f of group.fields??[])if(f.widget==='text')f.widget='string';
 return collection;
}
export function migrateData(data) {
 if(!data?.copy||typeof data.copy!=='object'||Array.isArray(data.copy))return data;
 for(const r of rules){
  const nested=data.copy[r.group];
  const o=nested&&typeof nested==='object'&&!Array.isArray(nested)?nested:data.copy;
  if(!own(o,r.name)&&r.keys.some(k=>own(o,k)))o[r.name]=r.convert(o);
  if(own(o,r.name))for(const k of r.keys)delete o[k];
 }
 return data;
}
