// TEST ONLY: never deploy this local harness or expose its inspection routes.
import mailer from '../../workers/inquiry-mailer/index.js';

let networkAttempts = 0;
// A production regression to network email must fail, never send anything.
globalThis.fetch = async () => {
  networkAttempts++;
  throw new Error('Outbound fetch forbidden in inquiry outbox runtime test');
};
const event = (env, kind) => env.INQUIRY_DB.prepare(
  'INSERT INTO runtime_mock_events (kind) VALUES (?)',
).bind(kind).run();
function bindings(env) {
  return {
    ...env,
    INQUIRY_DELIVERY_MODE: 'outbox',
    INQUIRY_TO: 'test@example.net',
    INQUIRY_FROM: 'forms@herrsystems.com',
    INQUIRY_RATE_LIMITER: { async limit() { return { success: true }; } },
    SEND_EMAIL: {
      async send(message) {
        if (message.to !== 'test@example.net' || message.from !== 'forms@herrsystems.com') {
          throw new Error('Unexpected mock email routing');
        }
        await event(env, 'send');
        return { messageId: '<runtime!accepted@example.net>' };
      },
    },
  };
}
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
      return new Response('Local test only', { status: 403 });
    }
    if (url.pathname === '/submit' && request.method === 'POST') {
      const input = await request.json();
      const inquiry = {
        schemaVersion: 1,
        submissionId: input.id ?? crypto.randomUUID(),
        kind: 'contact',
        contact: { name: 'Runtime fixture', email: 'test@example.net' },
        message: 'Synthetic local-only inquiry; no real email.',
        ...(input.invalid ? { unexpected: true } : {}),
        ...(input.conflict ? { message: 'Different synthetic content.' } : {}),
      };
      return mailer.fetch(new Request('https://inquiry-mailer.internal/send', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clientIp: '192.0.2.44', inquiry }),
      }), bindings(env), ctx);
    }
    if (url.pathname === '/state' && request.method === 'GET') {
      const rows = await env.INQUIRY_DB.prepare(
        'SELECT id, status, attempts FROM inquiry_outbox ORDER BY id',
      ).all();
      const events = await env.INQUIRY_DB.prepare(
        "SELECT SUM(kind='send') AS sends, SUM(kind='queue') AS batches FROM runtime_mock_events",
      ).first();
      return Response.json({ count: rows.results.length, rows: rows.results,
        sends: events.sends ?? 0, batches: events.batches ?? 0, networkAttempts });
    }
    return new Response('Not found', { status: 404 });
  },
  async queue(batch, env, ctx) {
    await event(env, 'queue');
    return mailer.queue(batch, bindings(env), ctx);
  },
};
