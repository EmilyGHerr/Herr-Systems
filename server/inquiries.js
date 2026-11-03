import { calculateEstimate, SERVICES, FEATURES } from '../static/pricing-calculator.js';

export const MAX_BODY_BYTES = 16384;
export class InquiryError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
export function reject(status = 400, code = 'invalid_request') { throw new InquiryError(status, code); }
export function json(status, data) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...(status === 405 ? { Allow: 'POST' } : {}), ...(status === 429 ? { 'Retry-After': '60' } : {}) } });
}
export function failure(error) {
  return json(error instanceof InquiryError ? error.status : 502, { ok: false, error: error instanceof InquiryError ? error.code : 'upstream_unavailable' });
}
export async function readJson(request) {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?\s*$/i.test(request.headers.get('content-type') || '')) reject(415, 'unsupported_media_type');
  // Content-Length is only an early rejection, never a substitute for counting bytes.
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) reject(413, 'body_too_large');
  if (!request.body) reject();
  const reader = request.body.getReader();
  let size = 0; const chunks = [];
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) { void reader.cancel().catch(() => {}); reject(413, 'body_too_large'); }
      chunks.push(value);
    }
  } catch (error) { if (error instanceof InquiryError) throw error; reject(); }
  finally { reader.releaseLock(); }
  try {
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch { reject(); }
}
function object(value) { if (!value || typeof value !== 'object' || Array.isArray(value)) reject(); return value; }
export function keys(value, allowed) { object(value); if (Object.keys(value).some(key => !allowed.includes(key))) reject(); }
const controls = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;
function text(value, max, required = false, multiline = false) {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string' || value.length > max || (multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/ : controls).test(value)) reject();
  const normalized = value.trim(); if (required && !normalized) reject(); return normalized;
}
export function email(value) {
  const normalized = text(value, 254, true);
  // Deliberately support a conservative bare addr-spec only: no display names or lists.
  if (!/^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(normalized) || normalized.split('@')[0].length > 64 || normalized.split('@')[1].split('.').some(x => x.length > 63)) reject();
  return normalized;
}
function selection(value, allowed, max, required = false) {
  if (!Array.isArray(value) || value.length > max || (required && !value.length) || new Set(value).size !== value.length || value.some(v => typeof v !== 'string' || !allowed.includes(v))) reject();
  return value;
}
function quote(value) {
  keys(value, ['services', 'options', 'estimate']);
  const services = selection(value.services, Object.keys(SERVICES), 5, true);
  const options = value.options ?? {};
  const allowed = [];
  if (services.includes('web')) allowed.push('templates', 'design');
  if (services.includes('web') || services.includes('agentic')) allowed.push('features');
  if (services.includes('hosting')) allowed.push('hosting');
  for (const service of ['consulting', 'contract']) if (services.includes(service)) allowed.push(`${service}Hours`, `${service}Focus`);
  keys(options, allowed);
  for (const [key, max] of [['templates', 20], ['consultingHours', 160], ['contractHours', 160]]) if (Object.hasOwn(options, key) && (!Number.isInteger(options[key]) || options[key] < 1 || options[key] > max)) reject();
  for (const [key, values] of [['design', ['standard', 'custom']], ['hosting', ['hosting', 'managed']], ['consultingFocus', ['planning', 'review', 'architecture']], ['contractFocus', ['development', 'maintenance', 'team']]]) if (Object.hasOwn(options, key) && !values.includes(options[key])) reject();
  if (Object.hasOwn(options, 'features')) {
    selection(options.features, Object.keys(FEATURES), Object.keys(FEATURES).length);
    if (options.features.some(key => !services.includes(FEATURES[key].service))) reject();
  }
  // Client estimate (including line labels and totals) is NEVER used or forwarded.
  const estimate = calculateEstimate({ services, ...options });
  return { services: estimate.services, options: estimate.options, estimate };
}
export function normalizeInquiry(value, publicInput = false) {
  // The deployed frontend uses flat services/options/estimate; nested quote is also
  // accepted for schema-v1 callers, but mixing representations is rejected.
  keys(value, ['schemaVersion', 'kind', 'contact', 'topic', 'message', 'quote', 'services', 'options', 'estimate', ...(publicInput ? ['turnstileToken'] : [])]);
  if (value.schemaVersion !== 1 || !['contact', 'quote'].includes(value.kind)) reject();
  keys(value.contact, ['name', 'email', 'business', 'website']);
  const contact = { name: text(value.contact.name, 100, true), email: email(value.contact.email), business: text(value.contact.business, 150), website: text(value.contact.website, 300) };
  if (contact.website) {
    try {
      // The existing UI explicitly accepts bare domains such as example.com.
      const candidate = /^[a-z][a-z0-9+.-]*:/i.test(contact.website) ? contact.website : `https://${contact.website}`;
      const url = new URL(candidate);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || !url.hostname) reject();
      contact.website = url.href;
    }
    catch { reject(); }
  }
  const topic = text(value.topic, 80);
  if (!['', ...Object.keys(SERVICES), 'Something else'].includes(topic)) reject();
  const result = { schemaVersion: 1, kind: value.kind, contact, topic, message: text(value.message, 3000, true, true) };
  const flat = ['services', 'options', 'estimate'].some(key => Object.hasOwn(value, key));
  if (value.kind === 'quote') {
    if (flat && Object.hasOwn(value, 'quote')) reject();
    result.quote = quote(flat ? Object.fromEntries(['services', 'options', 'estimate'].filter(k => Object.hasOwn(value, k)).map(k => [k, value[k]])) : value.quote);
  } else if (flat || Object.hasOwn(value, 'quote')) reject();
  if (publicInput) result.turnstileToken = text(value.turnstileToken, 2048, true);
  return result;
}
export function validIp(value) {
  if (typeof value !== 'string' || value.length > 45) return false;
  const v4 = s => /^(?:\d{1,3}\.){3}\d{1,3}$/.test(s) && s.split('.').every(p => Number(p) <= 255 && String(Number(p)) === p);
  if (v4(value)) return true;
  if (!value.includes(':') || !/^[0-9a-f:.]+$/i.test(value)) return false;
  let v6 = value;
  if (v6.includes('.')) { const i = v6.lastIndexOf(':'); if (!v4(v6.slice(i + 1))) return false; v6 = v6.slice(0, i) + ':0:0'; }
  const halves = v6.split('::'); if (halves.length > 2) return false;
  const groups = halves.flatMap(h => h ? h.split(':') : []);
  return groups.every(g => /^[0-9a-f]{1,4}$/i.test(g)) && (halves.length === 2 ? groups.length < 8 : groups.length === 8);
}
export function formatInquiry(inquiry) {
  const { contact, kind, topic, message } = inquiry;
  const lines = [`Herr Systems ${kind} inquiry`, '', `Name: ${contact.name}`, `Email: ${contact.email}`, `Business: ${contact.business || '(not supplied)'}`, `Website: ${contact.website || '(not supplied)'}`, `Topic: ${topic || '(not supplied)'}`, '', 'Message:', message];
  if (kind === 'quote') {
    const { estimate } = inquiry.quote;
    lines.push('', 'Server-calculated planning estimate (USD; not a binding quote):', `Services: ${estimate.services.map(key => SERVICES[key]).join(', ')}`, `Options: ${JSON.stringify(estimate.options)}`);
    for (const line of estimate.lines) lines.push(`${line.label}: $${line.price}`);
    lines.push(`One-time total: $${estimate.total}`, `Monthly: $${estimate.monthly}`, `Support: ${estimate.support}`);
  }
  return lines.join('\n');
}
