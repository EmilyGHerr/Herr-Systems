import assert from 'node:assert/strict';import path from 'node:path';import {readFile,writeFile,mkdir} from 'node:fs/promises';import YAML from 'yaml';import {load} from 'cheerio';import {fixture,build} from './support.mjs';
export async function verifyPhone(work){
 const dir=path.join(work,'phone');await mkdir(dir);const source=await fixture(dir),dest=path.join(dir,'public'),file=path.join(source,'data/settings.yml');const settings=YAML.parse(await readFile(file,'utf8'));
 for(const [raw,display,href]of [['7177442552','(717) 744-2552','tel:+17177442552'],['(717) 744-2552','(717) 744-2552','tel:+17177442552'],['1-717-744-2552','(717) 744-2552','tel:+17177442552'],['+1 (717) 744-2552','(717) 744-2552','tel:+17177442552'],['17177442552','(717) 744-2552','tel:+17177442552'],['+4412345678','+4412345678','tel:+4412345678'],['+44 20 7946 0958','+44 20 7946 0958','tel:+442079460958'],['','',''],['   ','','']]){
  settings.phone=raw;await writeFile(file,YAML.stringify(settings));build(source,dest);const $=load(await readFile(path.join(dest,'contact/index.html'),'utf8'));const link=$('a[href^="tel:"]');
  assert.equal(link.length,display?1:0,`Unexpected phone visibility for ${JSON.stringify(raw)}`);if(display){assert.equal(link.find('strong').text(),display);assert.equal(link.attr('href'),href);}
 }
}
