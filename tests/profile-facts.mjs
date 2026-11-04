import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import YAML from 'yaml';
import {load} from 'cheerio';
import {workspace,fixture,build,cleanup} from './support.mjs';
const work=await workspace();
try {
  const source=await fixture(work),out=path.join(work,'output');
  const file=path.join(source,'content/about/team/sam-rivera/index.md');
  const original=await readFile(file,'utf8');
  const data=YAML.parse(original.match(/^---\n([\s\S]*?)\n---/)[1]);
  data.url='/test-profile-facts/';
  const cases=[
    ['filled',{focus:'Focus value',collaboration:'Team value',handoff:'Handoff value'},['Focus','Works with','A useful handoff'],['Focus value','Team value','Handoff value']],
    ['blank handoff',{focus:'Focus value',collaboration:'Team value',handoff:''},['Focus','Works with'],['Focus value','Team value']],
    ['missing fields',{focus:'Focus value'},['Focus'],['Focus value']],
    ['whitespace and null',{focus:' \t\n ',collaboration:null,handoff:'  Real handoff  '},['A useful handoff'],['Real handoff']],
    ['all blank',{focus:'',collaboration:' \n\t ',handoff:null},[],[]],
    ['empty object',{},[],[]],
    ['null object',null,[],[]],
    ['absent object',undefined,[],[]],
  ];
  for(const [name,facts,labels,values] of cases) {
    if(facts===undefined)delete data.facts;else data.facts=facts;
    await writeFile(file,original.replace(/^---\n[\s\S]*?\n---/,'---\n'+YAML.stringify(data)+'---'));
    build(source,out);
    const $=load(await readFile(path.join(out,'test-profile-facts/index.html'),'utf8'));
    assert.equal($('.profile-facts').length,labels.length?1:0,name);
    assert.deepEqual($('.profile-facts dt').map((_,e)=>$(e).text()).get(),labels,name);
    assert.deepEqual($('.profile-facts dd').map((_,e)=>$(e).text()).get(),values,name);
    assert(!$('.profile-sidebar').text().includes('Not specified'),name);
    console.log('PASS profile facts: '+name);
  }
} finally {await cleanup(work);}
