import { reject, json, failure, readJson, normalizeInquiry, validIp } from '../../server/inquiries.js';

export async function onRequest({ request, env }) {
  try {
    if (request.method !== 'POST') reject(405, 'method_not_allowed');
    if (request.headers.get('origin') !== 'https://herrsystems.com') reject(403, 'origin_not_allowed');
    const inquiry = normalizeInquiry(await readJson(request), true);
    if (typeof env?.TURNSTILE_SECRET_KEY !== 'string' || !env.TURNSTILE_SECRET_KEY.trim() || typeof env?.INQUIRY_MAILER?.fetch !== 'function') reject(503, 'service_unavailable');
    // Cloudflare supplies/overwrites this header. Do not use X-Forwarded-For.
    const clientIp = request.headers.get('CF-Connecting-IP');
    if (!validIp(clientIp)) reject(503, 'service_unavailable');
    let verified;
    try {
      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: inquiry.turnstileToken, remoteip: clientIp }),
        signal: AbortSignal.timeout(5000), redirect: 'error',
      });
      if (!response.ok) reject(502, 'verification_unavailable');
      verified = await response.json();
    } catch { reject(502, 'verification_unavailable'); }
    if (verified?.success !== true || verified.hostname !== 'herrsystems.com' || verified.action !== inquiry.kind) reject(400, 'verification_failed');
    delete inquiry.turnstileToken;
    let response, result;
    try {
      response = await env.INQUIRY_MAILER.fetch(new Request('https://inquiry-mailer.internal/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inquiry, clientIp }),
      }));
      result = await response.json();
    } catch { reject(502, 'submission_unconfirmed'); }
    if (response.status === 202 && result?.ok === true && result.status === 'submitted') return json(202, { ok: true, status: 'submitted' });
    if ([400, 413, 415, 429, 503].includes(response.status)) reject(response.status, response.status === 429 ? 'rate_limited' : response.status === 503 ? 'service_unavailable' : 'invalid_request');
    reject(502, 'submission_unconfirmed');
  } catch (error) { return failure(error); }
}
