import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../workers/inquiry-mailer/index.js';
import bundled from '../workers/inquiry-mailer/dashboard-worker.js';
for (const [label, handler] of [['source',worker],['bundle',bundled]]) test(`${label}: mailer diagnostics separate send errors from invalid acknowledgements without leaking data`, async () => {
 const logs=[], original=console.error;
 console.error=(...args)=>logs.push(args.join(' '));
 const privateValues=['secret-marker','visitor@example.net','recipient@example.net','private-message','192.0.2.44'];
 let calls=0;
 const env={INQUIRY_FROM:'forms@herrsystems.com',INQUIRY_TO:privateValues[2],INQUIRY_RATE_LIMITER:{limit:async()=>({success:true})},SEND_EMAIL:{send:async()=>{calls++;throw Object.assign(new Error(privateValues.join(' ')),{code:'E_SENDER_NOT_VERIFIED'});}}};
 const req=()=>new Request('https://inquiry-mailer.internal/send',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientIp:privateValues[4],inquiry:{schemaVersion:1,kind:'contact',contact:{name:'Private Name',email:privateValues[1]},message:privateValues[3]}})});
 try {
  assert.equal((await handler.fetch(req(),env)).status,502);
  assert.match(logs.at(-1)||'',/email_send/);
  assert.match(logs.at(-1),/E_SENDER_NOT_VERIFIED/);
  env.SEND_EMAIL.send=async()=>{calls++;throw {code:privateValues[0]};};
  assert.equal((await handler.fetch(req(),env)).status,502);
  assert.match(logs.at(-1),/unrecognized/);
  env.SEND_EMAIL.send=async()=>{calls++;return {messageId:privateValues[0]+'\r\n'};};
  assert.equal((await handler.fetch(req(),env)).status,502);
  assert.match(logs.at(-1),/email_acknowledgement/);
  assert.equal(calls,3);
  for(const value of [...privateValues,'Private Name']) assert.ok(!logs.join(' ').includes(value));
  const count=logs.length;
  env.SEND_EMAIL.send=async()=>({messageId:'accepted-123'});
  assert.equal((await handler.fetch(req(),env)).status,202);
  assert.equal(logs.length,count);
 } finally {console.error=original;}
});
