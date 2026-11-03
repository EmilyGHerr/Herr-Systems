import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/inquiries.js';
import worker from '../workers/inquiry-mailer/index.js';
const contact = () => ({schemaVersion:1,kind:'contact',turnstileToken:'test-token',contact:{name:'Ada',email:'ada@example.net',business:'Example',website:'https://example.net'},topic:'web',message:'Hello!\nNew project.'});
const quote = () => ({...contact(),kind:'quote',topic:'',quote:{services:['web','consulting'],options:{templates:3,design:'custom',features:['cms'],consultingHours:2,consultingFocus:'review'},estimate:{total:1,monthly:999}}});
function setup() {
 const sent=[],checks=[],limits=[]; let kind='contact';
 const we={INQUIRY_TO:'private@example.net',INQUIRY_FROM:'forms@herrsystems.com',INQUIRY_RATE_LIMITER:{async limit(v){limits.push(v);return {success:true};}},SEND_EMAIL:{async send(mail){sent.push(mail);return {messageId:'message-123'};}}};
 const env={TURNSTILE_SECRET_KEY:'test-secret',INQUIRY_MAILER:{fetch:r=>worker.fetch(r,we)}};
 const original=globalThis.fetch;
 globalThis.fetch=async (url,init)=>{checks.push({url,init});return Response.json({success:true,hostname:'herrsystems.com',action:kind});};
 const req=(p=contact(),headers={},body)=>new Request('https://herrsystems.com/api/inquiries',{method:'POST',headers:{origin:'https://herrsystems.com','content-type':'application/json','CF-Connecting-IP':'192.0.2.44',...headers},body:body??JSON.stringify(p),...(body instanceof ReadableStream?{duplex:'half'}:{})});
 return {sent,checks,limits,we,env,req,setKind:v=>{kind=v;},restore:()=>{globalThis.fetch=original;}};
}
test('Pages → Worker → structured send: contact and server-recalculated quote',async()=>{
 const h=setup();try{
  for(const p of [contact(),quote()]){h.setKind(p.kind);const r=await onRequest({request:h.req(p),env:h.env});assert.equal(r.status,202);assert.deepEqual(await r.json(),{ok:true,status:'submitted'});}
  assert.equal(h.sent.length,2);assert.deepEqual(Object.keys(h.sent[0]).sort(),['from','replyTo','subject','text','to']);
  assert.equal(h.sent[0].to,'private@example.net');assert.equal(h.sent[0].from,'forms@herrsystems.com');assert.equal(h.sent[0].replyTo,'ada@example.net');
  assert.match(h.sent[1].text,/1120/);assert.doesNotMatch(h.sent[1].text,/999/);assert.equal(h.limits[0].key,'192.0.2.44');
  assert.equal(h.checks[0].url,'https://challenges.cloudflare.com/turnstile/v0/siteverify');assert.equal(new URLSearchParams(h.checks[0].init.body).get('remoteip'),'192.0.2.44');assert.ok(h.checks[0].init.signal instanceof AbortSignal);
 }finally{h.restore();}
});
test('invalid public input never verifies or sends',async t=>{
 const cases=[
 ['origin',p=>p,{origin:'https://evil.example'},403],['missing origin',p=>p,{origin:''},403],['content type',p=>p,{'content-type':'text/plain'},415],
 ['schema',p=>({...p,schemaVersion:2})],['kind',p=>({...p,kind:'spam'})],['topic',p=>({...p,topic:'bad'})],
 ['header injection',p=>({...p,contact:{...p.contact,name:'Ada\r\nBcc:x@y.z'}})],['email',p=>({...p,contact:{...p.contact,email:'a@b.net,x@y.net'}})],
 ['website',p=>({...p,contact:{...p.contact,website:'javascript:alert(1)'}})],['long message',p=>({...p,message:'x'.repeat(3001)})],['control message',p=>({...p,message:'hi\u0000'})],['empty message',p=>({...p,message:' '})],
 ['recipient override',p=>({...p,to:'evil@example.net'})],['missing token',p=>({...p,turnstileToken:''})],
 ['service',()=>({...quote(),quote:{services:['bad'],options:{}}})],['option',()=>({...quote(),quote:{services:['web'],options:{to:'evil'}}})],
 ['number',()=>({...quote(),quote:{services:['web'],options:{templates:1.5}}})],['feature',()=>({...quote(),quote:{services:['hosting'],options:{features:['cms']}}})],
 ['duplicate',()=>({...quote(),quote:{services:['web','web'],options:{}}})],['unexpected quote',p=>({...p,quote:{services:['web'],options:{}}})]
 ];
 for(const [name,change,headers,status=400]of cases)await t.test(name,async()=>{const h=setup();try{assert.equal((await onRequest({request:h.req(change(contact()),headers),env:h.env})).status,status);assert.equal(h.sent.length,0);assert.equal(h.checks.length,0);}finally{h.restore();}});
});
test('stream bounds resist absent/false Content-Length; malformed JSON and methods',async()=>{
 const h=setup();try{
  for(const headers of [{},{'content-length':'1'}]){const body=new ReadableStream({start(c){for(let i=0;i<2;i++)c.enqueue(new TextEncoder().encode(' '.repeat(9000)));c.close();}});assert.equal((await onRequest({request:h.req(contact(),headers,body),env:h.env})).status,413);}
  assert.equal((await onRequest({request:h.req(contact(),{},'{'),env:h.env})).status,400);
  for(const method of ['GET','OPTIONS','PUT']){const r=await onRequest({request:new Request('https://herrsystems.com/api/inquiries',{method}),env:h.env});assert.equal(r.status,405);assert.equal(r.headers.get('allow'),'POST');}assert.equal(h.sent.length,0);
 }finally{h.restore();}
});
test('Turnstile fail-closed responses and network errors',async t=>{
 for(const [name,result,status]of [['failure',{success:false},400],['hostname',{success:true,hostname:'evil.example',action:'contact'},400],['action',{success:true,hostname:'herrsystems.com',action:'quote'},400],['nonboolean',{success:'true',hostname:'herrsystems.com',action:'contact'},400],['network',null,502],['HTTP','http',502],['JSON','json',502]])await t.test(name,async()=>{
  const h=setup();try{globalThis.fetch=async()=>{if(result===null)throw Error('private');if(result==='http')return new Response('',{status:500});if(result==='json')return new Response('{');return Response.json(result);};const r=await onRequest({request:h.req(),env:h.env});assert.equal(r.status,status);assert.equal(h.sent.length,0);assert.doesNotMatch(await r.text(),/private/);}finally{h.restore();}
 });
});
test('config, limiter and provider failures are closed and never retried',async t=>{
 const cases=[['secret',h=>{delete h.env.TURNSTILE_SECRET_KEY;},503,0],['service',h=>{delete h.env.INQUIRY_MAILER;},503,0],['destination',h=>{delete h.we.INQUIRY_TO;},503,0],['from',h=>{h.we.INQUIRY_FROM='other@example.net';},503,0],['send binding',h=>{delete h.we.SEND_EMAIL;},503,0],['limiter missing',h=>{delete h.we.INQUIRY_RATE_LIMITER;},503,0],['limited',h=>{h.we.INQUIRY_RATE_LIMITER.limit=async()=>({success:false});},429,0],['limiter error',h=>{h.we.INQUIRY_RATE_LIMITER.limit=async()=>{throw Error('private');};},503,0],['limiter malformed',h=>{h.we.INQUIRY_RATE_LIMITER.limit=async()=>({});},503,0],['provider error',h=>{h.we.SEND_EMAIL.send=async m=>{h.sent.push(m);throw Error('private');};},502,1],['missing ID',h=>{h.we.SEND_EMAIL.send=async m=>{h.sent.push(m);return {};};},502,1],['bad ID',h=>{h.we.SEND_EMAIL.send=async m=>{h.sent.push(m);return {messageId:'\r\n'};};},502,1],['service error',h=>{h.env.INQUIRY_MAILER.fetch=async()=>{throw Error('private');};},502,0]];
 for(const [name,change,status,count]of cases)await t.test(name,async()=>{const h=setup();try{change(h);const r=await onRequest({request:h.req(),env:h.env});assert.equal(r.status,status);assert.equal(h.sent.length,count);assert.doesNotMatch(await r.text(),/private|delivered/i);}finally{h.restore();}});
});
test('Worker independently validates internal envelope and routes',async()=>{
 const h=setup(),p=contact();delete p.turnstileToken;const envelope={inquiry:p,clientIp:'192.0.2.44'};
 const req=(v,url='https://inquiry-mailer.internal/send',headers={'content-type':'application/json'})=>new Request(url,{method:'POST',headers,body:JSON.stringify(v)});
 try{for(const v of [{...envelope,to:'evil@example.net'},{...envelope,clientIp:'forged'},{...envelope,inquiry:{...p,topic:'bad'}}])assert.equal((await worker.fetch(req(v),h.we)).status,400);
 assert.equal((await worker.fetch(req(envelope,'https://public.example/send'),h.we)).status,404);assert.equal((await worker.fetch(req(envelope,undefined,{'content-type':'text/plain'}),h.we)).status,415);assert.equal((await worker.fetch(req({...envelope,padding:'x'.repeat(17000)}),h.we)).status,413);assert.equal(h.sent.length,0);
 }finally{h.restore();}
});

test('actual frontend flat quote payload, normalization and untrusted forwarding headers',async()=>{
 const h=setup();try{
  const nested=quote(),p={...nested,...nested.quote};delete p.quote;
  p.contact.name='  Ada  ';p.estimate={total:-999999,lines:[{label:'UNTRUSTED ESTIMATE'}]};
  h.setKind('quote');
  const r=await onRequest({request:h.req(p,{'x-forwarded-for':'203.0.113.5','x-real-ip':'203.0.113.6'}),env:h.env});
  assert.equal(r.status,202);assert.equal(h.limits[0].key,'192.0.2.44');
  assert.equal(h.sent[0].subject,'Herr Systems quote inquiry');assert.match(h.sent[0].text,/Name: Ada\n/);assert.match(h.sent[0].text,/1120/);assert.doesNotMatch(h.sent[0].text,/UNTRUSTED ESTIMATE|-999999|test-token|192\.0\.2/);
  assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('access-control-allow-origin'),null);
  const mixed={...p,quote:nested.quote};assert.equal((await onRequest({request:h.req(mixed),env:h.env})).status,400);assert.equal(h.sent.length,1);
 }finally{h.restore();}
});
test('missing trusted IP and hostile addresses fail closed',async()=>{
 const h=setup();try{
  for(const ip of ['', 'not-an-ip','192.0.2.256','192.0.2.44,203.0.113.5','::1::2'])assert.equal((await onRequest({request:h.req(contact(),{'CF-Connecting-IP':ip}),env:h.env})).status,503);
  for(const email of ['ada@example.net\r\nBcc:x@y.net','Ada <ada@example.net>','a..b@example.net'])assert.equal((await onRequest({request:h.req({...contact(),contact:{...contact().contact,email}}),env:h.env})).status,400);
  assert.equal(h.sent.length,0);assert.equal(h.checks.length,0);
  assert.equal((await onRequest({request:h.req(contact(),{'CF-Connecting-IP':'2001:db8::1'}),env:h.env})).status,202);
  assert.equal(h.limits[0].key,'2001:db8::1');
 }finally{h.restore();}
});
test('Worker byte counts multibyte streaming bodies regardless of misleading length',async()=>{
 const h=setup();try{
  const body=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('é'.repeat(8193)));c.close();}});
  const r=await worker.fetch(new Request('https://inquiry-mailer.internal/send',{method:'POST',headers:{'content-type':'application/json','content-length':'2'},body,duplex:'half'}),h.we);
  assert.equal(r.status,413);assert.equal(h.sent.length,0);assert.equal(h.limits.length,0);
  const get=await worker.fetch(new Request('https://inquiry-mailer.internal/send'),h.we);assert.equal(get.status,405);
 }finally{h.restore();}
});
test('Turnstile timeout is bounded to 5 seconds and fails closed',async()=>{
 const h=setup(),original=AbortSignal.timeout;let ms;
 try{
  AbortSignal.timeout=value=>{ms=value;return AbortSignal.abort();};
  globalThis.fetch=async(_url,init)=>{init.signal.throwIfAborted();throw Error('unexpected');};
  assert.equal((await onRequest({request:h.req(),env:h.env})).status,502);assert.ok(ms>0&&ms<=5000);assert.equal(h.sent.length,0);
 }finally{AbortSignal.timeout=original;h.restore();}
});
test('Pages never treats an ambiguous/malformed service acknowledgement as success',async()=>{
 const h=setup();try{
  for(const response of [()=>Response.json({ok:true,status:'delivered'},{status:202}),()=>Response.json({ok:true,status:'submitted'},{status:200}),()=>new Response('{',{status:202})]){
   h.env.INQUIRY_MAILER.fetch=async()=>response();const r=await onRequest({request:h.req(),env:h.env});assert.equal(r.status,502);
  }
  assert.equal(h.sent.length,0);
 }finally{h.restore();}
});
