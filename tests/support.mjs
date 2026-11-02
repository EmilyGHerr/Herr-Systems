import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp, rm, readdir, stat, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const results = path.join(root, 'tests/test-results');
export async function files(dir) {
  const out=[];
  for(const e of await readdir(dir,{withFileTypes:true})) {
    const f=path.join(dir,e.name);
    if(e.isDirectory()) out.push(...await files(f)); else out.push(f);
  }
  return out;
}
export async function workspace() {
  await mkdir(results,{recursive:true});
  return mkdtemp(path.join(tmpdir(),'herr-verification-'));
}
export function build(source,destination,extra=[]) {
  return execFileSync(process.env.HUGO_BIN || 'hugo', ['--source',source,'--destination',destination,'--baseURL','https://herr.test/','--cleanDestinationDir',...extra],{encoding:'utf8',timeout:60000});
}
export async function fixture(work) {
  const target=path.join(work,'fixture');
  await cp(root,target,{recursive:true,filter:src=>!['.git','node_modules','public','resources','tests'].includes(path.relative(root,src).split(path.sep)[0])});
  return target;
}
export async function serve(directory) {
  const server=createServer(async(req,res)=>{
    try {
      const url=new URL(req.url,'http://localhost');
      const name=path.resolve(directory,'.'+decodeURIComponent(url.pathname));
      if(!name.startsWith(path.resolve(directory)+path.sep)&&name!==path.resolve(directory)) throw Error('Invalid path');
      const info=await stat(name);
      const f=info.isDirectory()?path.join(name,'index.html'):name;
      const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.xml':'application/xml','.png':'image/png','.ico':'image/x-icon'};
      res.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream');
      res.end(await readFile(f));
    } catch {res.statusCode=404;res.end('Not found');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {url:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(resolve=>server.close(resolve))};
}
export const cleanup=work=>rm(work,{recursive:true,force:true});
