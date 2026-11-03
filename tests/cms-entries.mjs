import fs from 'node:fs';import path from 'node:path';import YAML from 'yaml';
// Resolve file editors and folder collections against the same concrete Markdown records.
export function cmsEntries(config,root){
 const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
 return config.collections.flatMap(c=>{
  if(c.files)return c.files;
  if(!c.folder)return [];
  return walk(path.join(root,c.folder)).filter(f=>f.endsWith('.md')).flatMap(f=>{
   const raw=fs.readFileSync(f,'utf8'),m=raw.match(/^---\n([\s\S]*?)\n---/);if(!m)return [];
   const data=YAML.parse(m[1]);if(c.filter && data[c.filter.field]!==c.filter.value)return [];
   if(path.basename(f)==='_index.md')return [];
   return [{...c,name:c.name+':'+path.relative(path.join(root,c.folder),f),file:path.relative(root,f)}];
  });
 });
}
