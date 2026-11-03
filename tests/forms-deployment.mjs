import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const routes = JSON.parse(await readFile(new URL("../static/_routes.json", import.meta.url), "utf8"));
assert.deepEqual(routes, { version: 1, include: ["/api/inquiries", "/api/inquiries/"], exclude: [] });
// This .jsonc intentionally uses plain JSON so the deployment safety contract
// can be checked without another parser dependency.
const config = JSON.parse(await readFile(new URL("../workers/inquiry-mailer/wrangler.jsonc", import.meta.url), "utf8"));
assert.equal(config.name, "herr-inquiry-mailer");
assert.equal(config.workers_dev, false);
assert.equal(config.preview_urls, false);
assert.deepEqual(config.routes, []);
assert.deepEqual(config.send_email, [{ name: "SEND_EMAIL", allowed_sender_addresses: [config.vars.INQUIRY_FROM] }]);
assert.equal(config.vars.INQUIRY_FROM, "forms@herrsystems.com");
assert.ok(!Object.hasOwn(config.vars, "INQUIRY_TO"));
assert.ok(!Object.hasOwn(config.vars, "TURNSTILE_SECRET_KEY"));
const limiter = config.ratelimits.find(x => x.name === "INQUIRY_RATE_LIMITER");
assert.match(limiter.namespace_id, /^[1-9][0-9]*$/);
assert.deepEqual(limiter.simple, { limit: 5, period: 60 });
console.log("PASS deployment safety: API-only Pages invocation, private mailer, fixed sender, recipient absent from Git config, native rate limiter");
