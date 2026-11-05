import assert from 'node:assert/strict';
import {migrateSchema,migrateData} from '../scripts/editor-services.mjs';
const original={faq:{keep:'top level'},unknown:42,copy:{detail_overview_4:{p_46:'A *literal* <word>.',p_47:'Second paragraph',unknown:'keep'},detail_fit_5:{li_23:'A [literal] item'},detail_subtypes_6:{summary_3:'Retro',p_51:'Description',a_91:'Discuss',span_61:'→'},process_7:{h3_13:'Plan',p_57:'Talk',detail_step_4:'01'},detail_faq_8:{summary_9:'Why?',p_61:'Because.'}}};
const d=migrateData(structuredClone(original));
assert.equal(d.copy.detail_subtypes_6.subtype_items[0].id,'retro-web-design');
assert.equal(d.copy.detail_subtypes_6.subtype_items[0].link_url,'#project');
assert.equal(d.copy.detail_overview_4.unknown,'keep');
assert.match(d.copy.detail_overview_4.overview_body,/\\\*literal\\\*/);
assert.deepEqual(d.faq,original.faq);
assert.deepEqual(migrateData(structuredClone(d)),d);
assert.deepEqual(migrateData({copy:{other:{unknown:true}},detailed_layout:false}),{copy:{other:{unknown:true}},detailed_layout:false});
for(const [group,key,legacy,value] of [['detail_overview_4','overview_body','p_46',''],['detail_fit_5','fit_items','li_23',[]],['detail_subtypes_6','subtype_items','summary_3',[]],['process_7','process_items','h3_13',[]],['detail_faq_8','faq_items','summary_9',[]]]){
 const record={copy:{[group]:{[key]:value,[legacy]:'obsolete'}}};
 migrateData(record);assert.deepEqual(record.copy[group][key],value);assert.ok(!Object.hasOwn(record.copy[group],legacy));
}
const flat=migrateData({copy:{p_46:'Literal',li_23:'One',custom:'metadata'}});
assert.equal(flat.copy.overview_body,'Literal');assert.deepEqual(flat.copy.fit_items,['One']);assert.equal(flat.copy.custom,'metadata');
const schema={name:'services',metadata:true,fields:[{name:'copy',fields:[{name:'detail_subtypes_6',fields:[{name:'summary_3',widget:'text'},{name:'p_51',widget:'text'},{name:'custom',widget:'hidden'}]}]}]};
migrateSchema(schema);assert.deepEqual(migrateSchema(structuredClone(schema)),schema);
const list=schema.fields[0].fields[0].fields.find(f=>f.name==='subtype_items');assert.equal(list.widget,'list');assert.ok(!Object.hasOwn(list,'max'));assert.deepEqual(list.fields.map(f=>f.name),['id','title','body','link_label','link_url','icon']);assert.equal(schema.metadata,true);
console.log('Service editor migrations: idempotence, legacy/flat/nested data, empty values, metadata, stable anchors, and unbounded schema passed.');
