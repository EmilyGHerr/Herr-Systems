import assert from 'node:assert/strict';import path from 'node:path';import {readFile,readdir,stat} from 'node:fs/promises';import YAML from 'yaml';import {root} from './support.mjs';
export async function verifyMedia(output){
 const c=YAML.parse(await readFile(path.join(root,'static/sudo/config.yml'),'utf8'));assert.equal(c.media_folder,'static/uploads');assert.equal(c.public_folder,'/uploads');
 for(const collection of c.collections){if(collection.path){assert.equal(collection.media_folder.replace(/^\//,''),c.media_folder);assert.equal(collection.public_folder,c.public_folder);}}
 const catalog=JSON.parse(await readFile(path.join(root,'docs/media-catalog.json'),'utf8'));assert(catalog.length>0);const names=new Set();
 const walk=async dir=>(await Promise.all((await readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?walk(path.join(dir,e.name)):path.join(dir,e.name)))).flat();
 const sources=await walk(path.join(root,'static/assets'));const images=sources.filter(f=>/\.(svg|png|jpe?g|gif|webp|avif)$/i.test(f));assert.deepEqual(catalog.map(r=>r.source).sort(),images.map(f=>'/'+path.relative(path.join(root,'static'),f)).sort());
 for(const record of catalog){assert(record.library.startsWith(c.public_folder+'/'));const name=record.library.slice(c.public_folder.length+1);assert(!name.includes('/'),'Gallery images must be directly inside the configured media folder');assert(!names.has(name),'Duplicate media filename');names.add(name);assert((await stat(path.join(root,c.media_folder,name))).size>0);assert((await stat(path.join(output,record.library))).size>0);}
}
