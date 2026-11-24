import { reject, normalizeInquiry, validSubmissionId, email, formatInquiry } from './inquiries.js';

const MAX_ATTEMPTS = 8;
const LEASE_SECONDS = 120;
const RETENTION_SECONDS = 90 * 24 * 60 * 60;
const transientCodes = new Set([
  'E_RATE_LIMIT_EXCEEDED', 'E_DAILY_LIMIT_EXCEEDED',
  'E_INTERNAL_SERVER_ERROR', 'E_EMAIL_SENDING_NOT_READY',
]);
// E_DELIVERY_FAILED includes permanent SMTP rejection; the code alone is not
// evidence of transience. Retain it for operator review instead of resending.
const permanentCodes = new Set([
  'E_DELIVERY_FAILED',
  'E_SENDER_NOT_VERIFIED', 'E_SENDER_DOMAIN_NOT_AVAILABLE',
  'E_SENDER_DOMAIN_NOT_CONFIGURED', 'E_RECIPIENT_NOT_ALLOWED',
  'E_RECIPIENT_PLAN_RESTRICTED', 'E_RECIPIENT_SUPPRESSED', 'E_ACCOUNT_SUSPENDED',
  'E_VALIDATION_ERROR', 'E_FIELD_MISSING', 'E_TOO_MANY_RECIPIENTS',
  'E_TOO_MANY_ATTACHMENTS', 'E_CONTENT_TOO_LARGE', 'E_HEADER_NOT_ALLOWED',
  'E_HEADER_USE_API_FIELD', 'E_HEADER_VALUE_INVALID', 'E_HEADER_VALUE_TOO_LONG',
  'E_HEADER_NAME_INVALID', 'E_HEADERS_TOO_LARGE', 'E_HEADERS_TOO_MANY',
]);
const now = () => Math.floor(Date.now() / 1000);
const statement = (env, sql, ...args) => env.INQUIRY_DB.prepare(sql).bind(...args);
function diagnostic(stage, id, code) {
  // IDs are random receipt references, never provider IDs or visitor data.
  console.error(JSON.stringify({event:'inquiry_outbox',stage,
    ...(validSubmissionId(id) ? {receiptId:id} : {}), ...(code ? {code} : {})}));
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
  return value;
}
function requireStorage(env) {
  if (typeof env?.INQUIRY_DB?.prepare !== 'function' || typeof env?.INQUIRY_QUEUE?.send !== 'function') reject(503,'service_unavailable');
}
async function dispatch(env, id) {
  try {
    await env.INQUIRY_QUEUE.send({id});
    await statement(env, "UPDATE inquiry_outbox SET enqueue_after=? WHERE id=? AND status='pending'", now()+300,id).run();
  } catch {
    // D1 already owns the message; scheduled recovery covers this publication gap.
    diagnostic('dispatch_pending',id);
  }
}
export async function acceptInquiry(env, input, ctx) {
  requireStorage(env);
  const inquiry=normalizeInquiry(input);
  const id=inquiry.submissionId ?? crypto.randomUUID();
  delete inquiry.submissionId;
  const payload=JSON.stringify(canonical(inquiry));
  const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(payload))),b=>b.toString(16).padStart(2,'0')).join('');
  const time=now();
  await statement(env, `INSERT INTO inquiry_outbox
    (id,fingerprint,payload,created_at,updated_at,next_attempt_at,enqueue_after)
    VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`,id,fingerprint,payload,time,time,time,time).run();
  const saved=await statement(env,'SELECT fingerprint FROM inquiry_outbox WHERE id=?',id).first();
  if (!saved) reject(503,'save_unconfirmed');
  if (saved.fingerprint !== fingerprint) reject(409,'submission_conflict');
  // Receipt is based on the successful durable write, NOT email or queue latency.
  const publication=dispatch(env,id);
  if (ctx?.waitUntil) ctx.waitUntil(publication); else await publication;
  return {ok:true,status:'submitted',receiptId:id};
}
async function transition(env,row,status,code,nextAttempt=0) {
  await statement(env, `UPDATE inquiry_outbox SET status=?,last_error=?,updated_at=?,
    next_attempt_at=?,enqueue_after=?,lease_token=NULL,lease_expires_at=NULL
    WHERE id=? AND status='sending' AND lease_token=?`,status,code,now(),nextAttempt,nextAttempt,row.id,row.lease_token).run();
}
async function processMessage(message,env) {
  const id=message.body?.id;
  if (!message.body || Object.keys(message.body).length!==1 || !validSubmissionId(id)) {
    diagnostic('invalid_queue_message'); message.retry({delaySeconds:60}); return;
  }
  const time=now();
  const existing=await statement(env,'SELECT * FROM inquiry_outbox WHERE id=?',id).first();
  if (!existing || ['submitted','failed','ambiguous'].includes(existing.status)) {message.ack();return;}
  if (existing.status==='sending') {
    // Never take over an abandoned send: provider acceptance may already have happened.
    if (existing.lease_expires_at<=time) {
      await statement(env, `UPDATE inquiry_outbox SET status='ambiguous',last_error='send_interrupted',updated_at=?
        WHERE id=? AND status='sending' AND lease_expires_at<=?`,time,id,time).run();
      diagnostic('needs_attention',id,'send_interrupted');
      message.ack();
    } else message.retry({delaySeconds:LEASE_SECONDS});
    return;
  }
  if (existing.next_attempt_at>time) {message.retry({delaySeconds:Math.min(86400,existing.next_attempt_at-time)});return;}
  if (existing.attempts>=MAX_ATTEMPTS) {
    await statement(env,"UPDATE inquiry_outbox SET status='failed',last_error='attempts_exhausted',updated_at=? WHERE id=? AND status='pending'",time,id).run();
    diagnostic('needs_attention',id,'attempts_exhausted');message.ack();return;
  }
  const token=crypto.randomUUID();
  const row=await statement(env, `UPDATE inquiry_outbox SET status='sending',attempts=attempts+1,
    lease_token=?,lease_expires_at=?,updated_at=?
    WHERE id=? AND status='pending' AND next_attempt_at<=? AND attempts<? RETURNING *`,
    token,time+LEASE_SECONDS,time,id,time,MAX_ATTEMPTS).first();
  if (!row) {message.retry({delaySeconds:LEASE_SECONDS});return;}
  let inquiry,to;
  try {
    inquiry=normalizeInquiry(JSON.parse(row.payload));
    if (env.INQUIRY_FROM!=='forms@herrsystems.com' || typeof env.SEND_EMAIL?.send!=='function') throw Error();
    to=email(env.INQUIRY_TO);
  } catch {
    await transition(env,row,'failed','notification_configuration');
    diagnostic('needs_attention',id,'notification_configuration');message.ack();return;
  }
  let result;
  let timer;
  try {
    // Bound a hung provider while retaining ambiguity: timeout is NOT a safe resend.
    result=await Promise.race([
      env.SEND_EMAIL.send({to,from:env.INQUIRY_FROM,replyTo:inquiry.contact.email,
        subject:inquiry.kind==='quote'?'Herr Systems quote inquiry':'Herr Systems contact inquiry',
        text:`Receipt: ${id}\n\n${formatInquiry(inquiry)}`}),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('send_timeout')),25000);}),
    ]);
  } catch (error) {
    const code=typeof error?.code==='string' && (transientCodes.has(error.code)||permanentCodes.has(error.code)) ? error.code : 'send_unconfirmed';
    const retry=transientCodes.has(code) && row.attempts<MAX_ATTEMPTS;
    const state=retry?'pending':permanentCodes.has(code)||transientCodes.has(code)?'failed':'ambiguous';
    const delay=Math.min(3600,60*2**(row.attempts-1));
    await transition(env,row,state,code,retry?now()+delay:0);
    diagnostic(retry?'retry_scheduled':'needs_attention',id,code);
    if (retry) message.retry({delaySeconds:delay});else message.ack();
    return;
  } finally {clearTimeout(timer);}
  // The provider ID is opaque. Do not impose a custom alphabet or log its value.
  if (typeof result?.messageId!=='string' || !result.messageId.trim() || /[\r\n\u0000]/.test(result.messageId)) {
    await transition(env,row,'ambiguous','acknowledgement_unconfirmed');
    diagnostic('needs_attention',id,'acknowledgement_unconfirmed');message.ack();return;
  }
  // If this write throws after acceptance, leave the claim for manual reconciliation.
  // There is no exactly-once email promise without provider-side idempotency.
  await transition(env,row,'submitted',null);
  message.ack();
}
export async function consumeInquiries(batch,env) {
  requireStorage(env);
  if (batch.queue!=='herr-inquiry-delivery') throw Error('Unexpected queue');
  for (const message of batch.messages) {
    try {await processMessage(message,env);}
    catch {diagnostic('consumer_unavailable',message.body?.id);message.retry({delaySeconds:60});}
  }
}
export async function recoverInquiries(env) {
  requireStorage(env);
  const time=now();
  const expired=await statement(env,"SELECT id FROM inquiry_outbox WHERE status='sending' AND lease_expires_at<=? LIMIT 100",time).all();
  for (const row of expired.results) {
    await statement(env,"UPDATE inquiry_outbox SET status='ambiguous',last_error='send_interrupted',updated_at=? WHERE id=? AND status='sending' AND lease_expires_at<=?",time,row.id,time).run();
    diagnostic('needs_attention',row.id,'send_interrupted');
  }
  const due=await statement(env,"SELECT id FROM inquiry_outbox WHERE status='pending' AND enqueue_after<=? AND next_attempt_at<=? ORDER BY enqueue_after LIMIT 100",time,time).all();
  for (const row of due.results) await dispatch(env,row.id);
  // Explicit privacy policy: every saved inquiry expires after 90 days, including failures.
  await statement(env,'DELETE FROM inquiry_outbox WHERE created_at<?',time-RETENTION_SECONDS).run();
}
