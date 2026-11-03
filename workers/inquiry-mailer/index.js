import { reject, json, failure, readJson, normalizeInquiry, keys, email, validIp, formatInquiry } from '../../server/inquiries.js';

// SECURITY BOUNDARY: deploy ONLY as a service-binding-accessible Worker:
// workers_dev=false, preview_urls=false, routes=[]. The internal hostname below
// is defense in depth, NOT authentication. Any exposed route would break this
// trusted Pages → Worker envelope boundary. No public fetch routes are intended.
export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (url.origin !== 'https://inquiry-mailer.internal' || url.pathname !== '/send' || url.search) reject(404, 'not_found');
      if (request.method !== 'POST') reject(405, 'method_not_allowed');
      const envelope = await readJson(request);
      keys(envelope, ['inquiry', 'clientIp']);
      if (!validIp(envelope.clientIp)) reject();
      // Revalidate and recalculate; no token, recipient, sender or subject accepted.
      const inquiry = normalizeInquiry(envelope.inquiry);
      if (typeof env?.SEND_EMAIL?.send !== 'function' || typeof env?.INQUIRY_RATE_LIMITER?.limit !== 'function' || env?.INQUIRY_FROM !== 'forms@herrsystems.com') reject(503, 'service_unavailable');
      let to;
      try { to = email(env.INQUIRY_TO); } catch { reject(503, 'service_unavailable'); }
      let limit;
      try { limit = await env.INQUIRY_RATE_LIMITER.limit({ key: envelope.clientIp }); }
      catch { reject(503, 'service_unavailable'); }
      if (limit?.success === false) reject(429, 'rate_limited');
      if (limit?.success !== true) reject(503, 'service_unavailable');
      let result;
      try {
        // One attempt only. An exception may mean the send was accepted but its
        // acknowledgement was lost. No retry, persistence or visitor auto-reply.
        result = await env.SEND_EMAIL.send({
          to, from: env.INQUIRY_FROM, replyTo: inquiry.contact.email,
          subject: inquiry.kind === 'quote' ? 'Herr Systems quote inquiry' : 'Herr Systems contact inquiry',
          text: formatInquiry(inquiry),
        });
      } catch { reject(502, 'submission_unconfirmed'); }
      if (typeof result?.messageId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:@/+=-]{0,255}$/.test(result.messageId)) reject(502, 'submission_unconfirmed');
      // Provider acceptance is submission, never proof of inbox delivery.
      return json(202, { ok: true, status: 'submitted' });
    } catch (error) { return failure(error); }
  },
};
