import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { acceptInquiry, consumeInquiries, recoverInquiries } from '../server/inquiry-outbox.js';
import worker from '../workers/inquiry-mailer/index.js';
import bundled from '../workers/inquiry-mailer/dashboard-worker.js';
import { onRequest } from '../functions/api/inquiries.js';
const ID='00000000-0000-4000-8000-000000000001';
const inquiry=()=>({schemaVersion:1,kind:'contact',submissionId:ID,contact:{name:'Ada',email:'visitor@example.net',business:'',website:''},topic:'',message:'Private inquiry marker'});
function harness(){
 const db=new DatabaseSync(':memory:');
 db.exec(readFileSync(new URL('../workers/inquiry-mailer/migrations/0001_inquiry_outbox.sql',import.meta.url),'utf8'));
 const binding = {
  prepare(sql) {
   const stmt = db.prepare(sql);
   return {
    bind(...args) {
     return {
      async first() { return stmt.get(...args) ?? null; },
      async run() { const r=stmt.run(...args); return {success:true,meta:{changes:Number(r.changes)}}; },
      async all() { return {results:stmt.all(...args)}; },
     };
    },
   };
  },
 };
 const published=[],sent=[];
 const env={INQUIRY_DELIVERY_MODE:'outbox',INQUIRY_DB:binding,INQUIRY_QUEUE:{async send(body){published.push(body);}},INQUIRY_FROM:'forms@herrsystems.com',INQUIRY_TO:'recipient@example.net',SEND_EMAIL:{async send(mail){sent.push(mail);return {messageId:'<opaque!id@example.net>'};}},INQUIRY_RATE_LIMITER:{limit:async()=>({success:true})}};
 return {db,env,published,sent,row:()=>db.prepare('SELECT * FROM inquiry_outbox WHERE id=?').get(ID)};
}
function message(id=ID){const calls=[];return {body:{id},calls,ack(){calls.push(['ack']);},retry(o){calls.push(['retry',o]);}};}
const batch=(...messages)=>({queue:'herr-inquiry-delivery',messages});
test('save returns durable receipt, consumer sends and records provider acceptance',async()=>{
 const h=harness();const result=await acceptInquiry(h.env,inquiry());assert.equal(result.receiptId,ID);assert.equal(h.row().status,'pending');assert.equal(h.sent.length,0);assert.deepEqual(h.published,[{id:ID}]);
 const m=message();await consumeInquiries(batch(m),h.env);assert.equal(h.sent.length,1);assert.equal(h.row().status,'submitted');assert.deepEqual(m.calls,[['ack']]);assert.equal(h.sent[0].to,'recipient@example.net');assert.equal(h.sent[0].replyTo,'visitor@example.net');assert.ok(h.sent[0].text.includes(ID));
 await consumeInquiries(batch(message()),h.env);assert.equal(h.sent.length,1);
});
test('ID is idempotent independent of property ordering; conflicting payload rejected',async()=>{
 const h=harness();await acceptInquiry(h.env,inquiry());await acceptInquiry(h.env,{...inquiry(),contact:{website:'',business:'',email:'visitor@example.net',name:'Ada'}});assert.equal(h.db.prepare('SELECT count(*) AS n FROM inquiry_outbox').get().n,1);
 await assert.rejects(acceptInquiry(h.env,{...inquiry(),message:'Changed'}),e=>e.status===409);
});
test('DB failure never confirms; queue outage after save returns receipt and recovers',async()=>{
 const h=harness();await assert.rejects(acceptInquiry({...h.env,INQUIRY_DB:{prepare(){throw Error('db unavailable');}}},inquiry()));
 h.env.INQUIRY_QUEUE.send=async()=>{throw Error('private queue detail');};assert.equal((await acceptInquiry(h.env,inquiry())).receiptId,ID);
 h.env.INQUIRY_QUEUE.send=async body=>h.published.push(body);await recoverInquiries(h.env);assert.deepEqual(h.published,[{id:ID}]);
});
// Worker API rejection codes: only explicit temporary availability/capacity failures retry.
// https://developers.cloudflare.com/email-service/api/send-emails/workers-api/
for(const code of ['E_RATE_LIMIT_EXCEEDED','E_DAILY_LIMIT_EXCEEDED','E_INTERNAL_SERVER_ERROR','E_EMAIL_SENDING_NOT_READY']) test(`${code}: temporary rejection retries and can succeed`,async()=>{
 const h=harness();await acceptInquiry(h.env,inquiry());
 h.env.SEND_EMAIL.send=async mail=>{h.sent.push(mail);throw Object.assign(Error('private detail'),{code});};
 const m=message();await consumeInquiries(batch(m),h.env);
 assert.equal(h.sent.length,1);assert.equal(h.row().status,'pending');assert.equal(h.row().attempts,1);assert.equal(h.row().last_error,code);
 assert.deepEqual(m.calls,[['retry',{delaySeconds:60}]]);
 h.db.prepare('UPDATE inquiry_outbox SET next_attempt_at=0').run();
 h.env.SEND_EMAIL.send=async mail=>{h.sent.push(mail);return {messageId:'opaque!id'};};
 await consumeInquiries(batch(message()),h.env);assert.equal(h.row().status,'submitted');assert.equal(h.sent.length,2);
});
for(const code of [
 'E_DELIVERY_FAILED','E_SENDER_NOT_VERIFIED','E_SENDER_DOMAIN_NOT_AVAILABLE',
 'E_SENDER_DOMAIN_NOT_CONFIGURED','E_RECIPIENT_NOT_ALLOWED','E_RECIPIENT_PLAN_RESTRICTED',
 'E_RECIPIENT_SUPPRESSED','E_ACCOUNT_SUSPENDED','E_VALIDATION_ERROR','E_FIELD_MISSING',
 'E_TOO_MANY_RECIPIENTS','E_TOO_MANY_ATTACHMENTS','E_CONTENT_TOO_LARGE','E_HEADER_NOT_ALLOWED',
 'E_HEADER_USE_API_FIELD','E_HEADER_VALUE_INVALID','E_HEADER_VALUE_TOO_LONG',
 'E_HEADER_NAME_INVALID','E_HEADERS_TOO_LARGE','E_HEADERS_TOO_MANY',
]) test(`${code}: rejection stays saved for operator without retry`,async()=>{
 const h=harness();await acceptInquiry(h.env,inquiry());const payload=h.row().payload;
 h.env.SEND_EMAIL.send=async mail=>{h.sent.push(mail);throw Object.assign(Error('private detail'),{code});};
 const m=message();await consumeInquiries(batch(m),h.env);
 assert.equal(h.row().status,'failed');assert.equal(h.row().attempts,1);assert.equal(h.row().last_error,code);assert.equal(h.row().payload,payload);
 assert.deepEqual(m.calls,[['ack']]);h.published.length=0;
 await recoverInquiries(h.env);assert.equal(h.published.length,0);
 const duplicate=message();await consumeInquiries(batch(duplicate),h.env);
 assert.deepEqual(duplicate.calls,[['ack']]);assert.equal(h.sent.length,1);assert.equal(h.row().payload,payload);assert.equal(h.row().status,'failed');
});
test('unknown provider exception remains ambiguous without retry',async()=>{
 const h=harness();await acceptInquiry(h.env,inquiry());
 h.env.SEND_EMAIL.send=async()=>{throw Error('private detail');};const m=message();await consumeInquiries(batch(m),h.env);
 assert.equal(h.row().status,'ambiguous');assert.equal(h.row().attempts,1);assert.deepEqual(m.calls,[['ack']]);
});
test('eight actual rate-limit rejections exhaust attempts; ninth invocation never sends',async()=>{
 const h=harness();await acceptInquiry(h.env,inquiry());const payload=h.row().payload;
 h.env.SEND_EMAIL.send=async mail=>{h.sent.push(mail);throw Object.assign(Error('private detail'),{code:'E_RATE_LIMIT_EXCEEDED'});};
 for(let attempt=1;attempt<=8;attempt++){
  h.db.prepare('UPDATE inquiry_outbox SET next_attempt_at=0').run();
  const m=message();await consumeInquiries(batch(m),h.env);
  assert.equal(h.sent.length,attempt);assert.equal(h.row().attempts,attempt);
  assert.equal(h.row().status,attempt<8?'pending':'failed');
  assert.deepEqual(m.calls,attempt<8?[['retry',{delaySeconds:Math.min(3600,60*2**(attempt-1))}]]:[['ack']]);
 }
 const ninth=message();await consumeInquiries(batch(ninth),h.env);
 assert.deepEqual(ninth.calls,[['ack']]);assert.equal(h.sent.length,8);assert.equal(h.row().attempts,8);
 assert.equal(h.row().status,'failed');assert.equal(h.row().payload,payload);assert.equal(h.row().last_error,'E_RATE_LIMIT_EXCEEDED');
});
test('missing acknowledgement and expired send claim preserve ambiguity without resend',async()=>{
 const h=harness();await acceptInquiry(h.env,inquiry());h.env.SEND_EMAIL.send=async mail=>{h.sent.push(mail);return {};};await consumeInquiries(batch(message()),h.env);assert.equal(h.row().status,'ambiguous');await consumeInquiries(batch(message()),h.env);assert.equal(h.sent.length,1);
 const j=harness();await acceptInquiry(j.env,inquiry());j.db.prepare("UPDATE inquiry_outbox SET status='sending', lease_expires_at=1, attempts=1").run();await recoverInquiries(j.env);assert.equal(j.row().status,'ambiguous');await consumeInquiries(batch(message()),j.env);assert.equal(j.sent.length,0);
});
test('concurrent claims send once, future attempt deferred, exhaustion retained',async()=>{
 const h=harness();await acceptInquiry(h.env,inquiry());let release;h.env.SEND_EMAIL.send=async mail=>{h.sent.push(mail);await new Promise(r=>{release=r;});return {messageId:'ok'};};
 const first=consumeInquiries(batch(message()),h.env);while(!release)await new Promise(r=>setImmediate(r));await consumeInquiries(batch(message()),h.env);assert.equal(h.sent.length,1);release();await first;
 const j=harness();await acceptInquiry(j.env,inquiry());j.db.prepare('UPDATE inquiry_outbox SET next_attempt_at=?').run(Math.floor(Date.now()/1000)+300);const future=message();await consumeInquiries(batch(future),j.env);assert.equal(j.sent.length,0);assert.equal(future.calls[0][0],'retry');
 j.db.prepare('UPDATE inquiry_outbox SET attempts=8,next_attempt_at=0').run();await consumeInquiries(batch(message()),j.env);assert.equal(j.row().status,'failed');assert.equal(j.sent.length,0);
});
test('recovery skips terminal records; retention deletes old PII',async()=>{
 const h=harness();await acceptInquiry(h.env,inquiry());h.db.prepare("UPDATE inquiry_outbox SET status='failed'").run();h.published.length=0;await recoverInquiries(h.env);assert.equal(h.published.length,0);
 h.db.prepare('UPDATE inquiry_outbox SET created_at=0').run();await recoverInquiries(h.env);assert.equal(h.row(),undefined);
});
test('private ingress validates and rate limits before saving',async()=>{
 const h=harness();const req=(p=inquiry(),url='https://inquiry-mailer.internal/send')=>new Request(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({inquiry:p,clientIp:'192.0.2.44'})});
 h.env.INQUIRY_RATE_LIMITER.limit=async()=>({success:false});assert.equal((await worker.fetch(req(),h.env)).status,429);assert.equal(h.row(),undefined);
 h.env.INQUIRY_RATE_LIMITER.limit=async()=>({success:true});assert.equal((await worker.fetch(req({...inquiry(),to:'evil@example.net'}),h.env)).status,400);assert.equal((await worker.fetch(req(inquiry(),'https://public.example/send'),h.env)).status,404);
 const r=await worker.fetch(req(),h.env);assert.equal(r.status,202);assert.equal((await r.json()).receiptId,ID);assert.equal(h.sent.length,0);
});
test('Pages returns receipt during email outage; invalid challenge never saves',async()=>{
 const h=harness(),original=globalThis.fetch;const env={TURNSTILE_SECRET_KEY:'mock-secret',INQUIRY_MAILER:{fetch:r=>worker.fetch(r,h.env)}};
 const req=()=>new Request('https://herrsystems.com/api/inquiries',{method:'POST',headers:{origin:'https://herrsystems.com','content-type':'application/json','CF-Connecting-IP':'192.0.2.44'},body:JSON.stringify({...inquiry(),turnstileToken:'mock-token'})});
 try{globalThis.fetch=async()=>Response.json({success:false});assert.equal((await onRequest({request:req(),env})).status,400);assert.equal(h.row(),undefined);
 globalThis.fetch=async()=>Response.json({success:true,hostname:'herrsystems.com',action:'contact'});delete h.env.SEND_EMAIL;const r=await onRequest({request:req(),env});assert.equal(r.status,202);assert.equal((await r.json()).receiptId,ID);assert.equal(h.row().status,'pending');}finally{globalThis.fetch=original;}
});
test('foreign/poison queue messages fail safely; diagnostics omit visitor PII',async()=>{
 const h=harness(),logs=[],original=console.error;console.error=(...args)=>logs.push(args.join(' '));try{
 await acceptInquiry(h.env,inquiry());h.env.SEND_EMAIL.send=async()=>{throw Error('visitor@example.net Private inquiry marker secret-token');};await consumeInquiries(batch(message()),h.env);
 const poison=message('visitor@example.net');await consumeInquiries(batch(poison),h.env);assert.equal(poison.calls[0][0],'retry');
 await assert.rejects(consumeInquiries({queue:'unexpected',messages:[message()]},h.env));assert.ok(!logs.join(' ').includes('visitor@example.net'));assert.ok(!logs.join(' ').includes('Private inquiry marker'));assert.ok(!logs.join(' ').includes('secret-token'));
 }finally{console.error=original;}
});

test('receipt does not wait for queue; waitUntil publishes saved row without blocking',async()=>{
 const h=harness();let release;const jobs=[];
 h.env.INQUIRY_QUEUE.send=()=>new Promise(resolve=>{release=resolve;});
 const receipt=await acceptInquiry(h.env,inquiry(),{waitUntil:p=>jobs.push(p)});
 assert.equal(receipt.receiptId,ID);assert.equal(h.row().status,'pending');assert.equal(jobs.length,1);
 release();await Promise.all(jobs);
});
test('send-accepted/state-write-failed leaves claim and never resends automatically',async()=>{
 const h=harness();await acceptInquiry(h.env,inquiry());const prepare=h.env.INQUIRY_DB.prepare;
 h.env.INQUIRY_DB.prepare=sql=>{
  const statement=prepare(sql);
  if(sql.includes('lease_token=NULL')) return {bind(){return {run:async()=>{throw Error('state unavailable');}};}};
  return statement;
 };
 const m=message();await consumeInquiries(batch(m),h.env);assert.equal(h.sent.length,1);assert.equal(h.row().status,'sending');assert.equal(m.calls[0][0],'retry');
 h.env.INQUIRY_DB.prepare=prepare;await consumeInquiries(batch(message()),h.env);assert.equal(h.sent.length,1);
 h.db.prepare('UPDATE inquiry_outbox SET lease_expires_at=0').run();await recoverInquiries(h.env);assert.equal(h.row().status,'ambiguous');
});
test('queue batch isolates an unavailable DB row and still processes remaining messages',async()=>{
 const h=harness();await acceptInquiry(h.env,inquiry());const bad=message('00000000-0000-4000-8000-000000000002'),good=message();const prepare=h.env.INQUIRY_DB.prepare;
 h.env.INQUIRY_DB.prepare=sql=>{const stmt=prepare(sql);return {bind(...args){if(args.includes(bad.body.id))throw Error('isolated failure');return stmt.bind(...args);}};};
 await consumeInquiries(batch(bad,good),h.env);assert.equal(bad.calls[0][0],'retry');assert.deepEqual(good.calls,[['ack']]);assert.equal(h.sent.length,1);
});
for(const [label,handler]of [['source',worker],['bundle',bundled]]) test(`${label}: queued contact and quote receipt reaches Pages and consumer`,async()=>{
 const h=harness(),original=globalThis.fetch;
 const env={TURNSTILE_SECRET_KEY:'mock-only',INQUIRY_MAILER:{fetch:r=>handler.fetch(r,h.env)}};
 try {
  for(const kind of ['contact','quote']) {
   const id=kind==='quote'?'00000000-0000-4000-8000-000000000002':ID;
   const payload={...inquiry(),submissionId:id,kind,turnstileToken:'mock-only',...(kind==='quote'?{quote:{services:['hosting'],options:{hosting:'basic'},estimate:{monthly:999}}}: {})};
   globalThis.fetch=async()=>Response.json({success:true,hostname:'herrsystems.com',action:kind});
   const request=new Request('https://herrsystems.com/api/inquiries',{method:'POST',headers:{origin:'https://herrsystems.com','content-type':'application/json','CF-Connecting-IP':'192.0.2.44'},body:JSON.stringify(payload)});
   const r=await onRequest({request,env});assert.equal(r.status,202);assert.equal((await r.json()).receiptId,id);
   assert.equal(h.sent.length,kind==='quote'?1:0);await handler.queue(batch(message(id)),h.env);
  }
  assert.equal(h.sent.length,2);assert.ok(h.sent[1].text.includes('Monthly: $10'));assert.ok(!h.sent[1].text.includes('999'));assert.ok(!h.row().payload.includes('mock-only'));
 }finally{globalThis.fetch=original;}
});
test('invalid submission IDs and missing storage fail closed through Pages without sending',async()=>{
 const h=harness(),original=globalThis.fetch;
 const env={TURNSTILE_SECRET_KEY:'mock-only',INQUIRY_MAILER:{fetch:r=>worker.fetch(r,h.env)}};
 const request=id=>new Request('https://herrsystems.com/api/inquiries',{method:'POST',headers:{origin:'https://herrsystems.com','content-type':'application/json','CF-Connecting-IP':'192.0.2.44'},body:JSON.stringify({...inquiry(),submissionId:id,turnstileToken:'mock-only'})});
 try{
  globalThis.fetch=async()=>Response.json({success:true,hostname:'herrsystems.com',action:'contact'});
  for(const id of ['invalid',null,'00000000-0000-1000-8000-000000000001',ID+'x'])assert.equal((await onRequest({request:request(id),env})).status,400);
  delete h.env.INQUIRY_DB;assert.equal((await onRequest({request:request(ID),env})).status,503);assert.equal(h.sent.length,0);assert.equal(h.row(),undefined);
 }finally{globalThis.fetch=original;}
});
