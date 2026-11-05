import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import {load} from 'cheerio';
import {workspace,fixture,build,cleanup} from './support.mjs';
const work=await workspace();
try {
 const source=await fixture(work),output=path.join(work,'public');
 const file=path.join(source,'content/case-studies/_index.md');
 const raw=await fs.readFile(file,'utf8'),match=raw.match(/^---\n([\s\S]*?)\n---([\s\S]*)$/),original=YAML.parse(match[1]);
 for(const [name,value,present,flat] of [
  ['populated','A clear project disclosure.',true,false],
  ['padded','  Disclosure with padding.  ',true,false],
  ['empty','',false,false],['whitespace',' \n\t ',false,false],
  ['null',null,false,false],['missing',undefined,false,false],
  ['missing group',undefined,false,false],['legacy flat','Legacy disclosure.',true,true],
  ['legacy empty','',false,true],['escaped','<script>not executable</script>',true,false]
 ]) {
  const data=structuredClone(original);
  delete data.copy.case_disclosure_2;delete data.copy.case_disclosure_1;
  if(flat)data.copy.case_disclosure_1=value;
  else if(name!=='missing group')data.copy.case_disclosure_2=value===undefined?{}:{case_disclosure_1:value};
  await fs.writeFile(file,'---\n'+YAML.stringify(data)+'---'+match[2]);build(source,output);
  const $=load(await fs.readFile(path.join(output,'case-studies/index.html'),'utf8'));
  assert.equal($('.case-disclosure').length,present?1:0,name);
  if(present)assert.equal($('.case-disclosure').text(),value.trim(),name);
  else assert.equal($('#main').children().first().is('section'),true,name+': no empty wrapper before collection');
  assert.equal($('.case-disclosure script').length,0);
  assert($('.case-card').length>0);
  console.log('PASS case-study disclaimer: '+name);
 }
} finally {await cleanup(work);}
