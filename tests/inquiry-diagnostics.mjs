import assert from "node:assert/strict";
import test from "node:test";
import { onRequest } from "../functions/api/inquiries.js";
test("failure diagnostics identify stage without logging personal data, secret, token or raw exception", async () => {
  const originalFetch = globalThis.fetch, originalLog = console.error;
  const logs = [];
  console.error = (...args) => logs.push(args.join(" "));
  const sensitive = ["private-secret-marker", "private-token-marker", "person@example.net", "private-message-marker", "private-exception-marker"];
  const env = { TURNSTILE_SECRET_KEY: sensitive[0], INQUIRY_MAILER: { fetch() { throw new Error(sensitive[4]); } } };
  const request = () => new Request("https://herrsystems.com/api/inquiries", { method: "POST", headers: { origin: "https://herrsystems.com", "content-type": "application/json", "CF-Connecting-IP": "192.0.2.44" }, body: JSON.stringify({ schemaVersion: 1, kind: "contact", contact: { name: "Private Name", email: sensitive[2] }, message: sensitive[3], turnstileToken: sensitive[1] }) });
  try {
    globalThis.fetch = async () => new Response("upstream unavailable", { status: 502 });
    assert.equal((await onRequest({ request: request(), env })).status, 502);
    assert.match(logs.at(-1) || "", /turnstile_request/);
    assert.match(logs.at(-1), /verification_unavailable/);
    assert.match(logs.at(-1), /upstreamStatus/);
    globalThis.fetch = async () => Response.json({ success: true, hostname: "herrsystems.com", action: "contact" });
    assert.equal((await onRequest({ request: request(), env })).status, 502);
    assert.match(logs.at(-1), /mailer_request/);
    globalThis.fetch = async () => Response.json({ success: false, "error-codes": ["invalid-input-secret", sensitive[0]] });
    assert.equal((await onRequest({ request: request(), env })).status, 400);
    assert.match(logs.at(-1), /invalid-input-secret/);
    const all = logs.join(" ");
    for (const value of [...sensitive, "Private Name", "192.0.2.44"]) assert.ok(!all.includes(value), "Sensitive value leaked");
  } finally { globalThis.fetch = originalFetch; console.error = originalLog; }
});
