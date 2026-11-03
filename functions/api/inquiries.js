import { InquiryError, reject, json, failure, readJson, normalizeInquiry, validIp } from '../../server/inquiries.js';

export async function onRequest({ request, env }) {
  let stage = "request_validation";
  const diagnostic = {};
  try {
    if (request.method !== 'POST') reject(405, 'method_not_allowed');
    if (request.headers.get('origin') !== 'https://herrsystems.com') reject(403, 'origin_not_allowed');
    const inquiry = normalizeInquiry(await readJson(request), true);
    stage = "runtime_configuration";
    if (typeof env?.TURNSTILE_SECRET_KEY !== 'string' || !env.TURNSTILE_SECRET_KEY.trim() || typeof env?.INQUIRY_MAILER?.fetch !== 'function') reject(503, 'service_unavailable');
    // Cloudflare supplies/overwrites this header. Do not use X-Forwarded-For.
    stage = "client_identity";
    const clientIp = request.headers.get('CF-Connecting-IP');
    if (!validIp(clientIp)) reject(503, 'service_unavailable');
    let verified;
    try {
      stage = "turnstile_request";
      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: inquiry.turnstileToken, remoteip: clientIp }),
        signal: AbortSignal.timeout(5000), redirect: 'error',
      });
      diagnostic.upstreamStatus = response.status;
      if (!response.ok) reject(502, 'verification_unavailable');
      stage = "turnstile_response";
      verified = await response.json();
    } catch { reject(502, 'verification_unavailable'); }
    stage = "turnstile_validation";
    diagnostic.hostnameMatches = verified?.hostname === "herrsystems.com";
    diagnostic.actionMatches = verified?.action === inquiry.kind;
    const knownErrors = ["missing-input-secret", "invalid-input-secret", "missing-input-response", "invalid-input-response", "bad-request", "timeout-or-duplicate", "internal-error"];
    diagnostic.verificationCodes = Array.isArray(verified?.["error-codes"]) ? verified["error-codes"].filter(code => knownErrors.includes(code)).slice(0, 7) : [];
    if (verified?.success !== true || verified.hostname !== 'herrsystems.com' || verified.action !== inquiry.kind) reject(400, 'verification_failed');
    delete inquiry.turnstileToken;
    let response, result;
    try {
      stage = "mailer_request";
      response = await env.INQUIRY_MAILER.fetch(new Request('https://inquiry-mailer.internal/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inquiry, clientIp }),
      }));
      stage = "mailer_response";
      diagnostic.mailerStatus = response.status;
      result = await response.json();
    } catch { reject(502, 'submission_unconfirmed'); }
    stage = "mailer_confirmation";
    if (response.status === 202 && result?.ok === true && result.status === 'submitted') return json(202, { ok: true, status: 'submitted' });
    if ([400, 413, 415, 429, 503].includes(response.status)) reject(response.status, response.status === 429 ? 'rate_limited' : response.status === 503 ? 'service_unavailable' : 'invalid_request');
    reject(502, 'submission_unconfirmed');
  } catch (error) {
    const response = failure(error);
    const code = error instanceof InquiryError ? error.code : "upstream_unavailable";
    if (response.status >= 500 || code === "verification_failed") {
      // [inquiry-diagnostic] Only fixed stages, status codes and allowlisted codes.
      // Never log exceptions, request bodies, addresses, IPs, secrets or tokens.
      console.error("[inquiry-diagnostic]", JSON.stringify({ stage, status: response.status, code, ...diagnostic }));
    }
    return response;
  }
}
