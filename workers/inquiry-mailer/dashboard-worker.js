// Paste-ready Cloudflare module Worker. Generated from reviewed index.js.
// Required: SEND_EMAIL, INQUIRY_RATE_LIMITER, INQUIRY_TO, INQUIRY_FROM.
// Service-binding access only: disable workers.dev, preview URLs, custom routes.
// No secrets belong in this file. Regenerate with npm run build:mailer-dashboard.

var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../../static/pricing-calculator.js
var HOURLY_RATE = 70;
var SERVICES = Object.freeze({ web: "Web Design / Web Development", hosting: "Hosting", agentic: "Agentic Setups", consulting: "Consulting", contract: "Contract Work" });
var FEATURES = Object.freeze({
  ecommerce: { service: "web", label: "Ecommerce", price: 700 },
  cms: { service: "web", label: "Editable content / blog", price: 210 },
  booking: { service: "web", label: "Online booking", price: 210 },
  integration: { service: "web", label: "Business integration", price: 140 },
  agentReview: { service: "agentic", label: "Additional evaluation and handoff", price: 210 },
  agentIntegration: { service: "agentic", label: "Additional tool connection", price: 140 }
});
var HOSTING = Object.freeze({
  static: { label: "Static Site Hosting", price: 5 },
  basic: { label: "Basic Hosting", price: 10 },
  ecommerce: { label: "E-Commerce Hosting", price: 25 }
});
var list = /* @__PURE__ */ __name((value) => Array.isArray(value) ? value : [], "list");
var own = /* @__PURE__ */ __name((object2, key) => typeof key === "string" && Object.hasOwn(object2, key), "own");
function bounded(value, fallback, max) {
  if (!["number", "string"].includes(typeof value) || value === "" || typeof value === "string" && !value.trim()) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(1, Math.round(number))) : fallback;
}
__name(bounded, "bounded");
function calculateEstimate(input = {}) {
  if (!input || typeof input !== "object") input = {};
  const services = Object.keys(SERVICES).filter((key) => list(input.services).includes(key));
  const selected = new Set(services);
  const options = {};
  const lines = [];
  if (selected.has("web")) {
    options.templates = bounded(input.templates, 5, 20);
    options.design = input.design === "custom" ? "custom" : "standard";
    lines.push({ service: "web", label: `Website \xB7 ${options.templates} ${options.templates === 1 ? "page template" : "page templates"}`, price: 280 + (options.templates - 1) * 70 });
    if (options.design === "custom") lines.push({ service: "web", label: "Custom visual direction", price: 350 });
  }
  if (selected.has("agentic")) lines.push({ service: "agentic", label: "One focused assistant / workflow", price: 420 });
  const features = [...new Set(list(input.features))].filter((key) => own(FEATURES, key) && selected.has(FEATURES[key].service));
  if (selected.has("web") || selected.has("agentic")) options.features = features;
  for (const key of features) lines.push({ ...FEATURES[key] });
  for (const service of ["consulting", "contract"]) if (selected.has(service)) {
    const hours = bounded(input[`${service}Hours`], service === "consulting" ? 2 : 4, 160);
    const topics = service === "consulting" ? ["planning", "review", "architecture"] : ["development", "maintenance", "team"];
    options[`${service}Hours`] = hours;
    options[`${service}Focus`] = topics.includes(input[`${service}Focus`]) ? input[`${service}Focus`] : topics[0];
    lines.push({ service, label: `${SERVICES[service]} \xB7 ${hours} ${hours === 1 ? "hour" : "hours"} at $70/hr`, price: hours * HOURLY_RATE });
  }
  let monthly = 0;
  let support = "No hosting selected";
  if (selected.has("hosting")) {
    options.hosting = own(HOSTING, input.hosting) ? input.hosting : "static";
    ({ price: monthly, label: support } = HOSTING[options.hosting]);
  }
  return { services, options, lines, total: lines.reduce((sum, line) => sum + line.price, 0), monthly, support };
}
__name(calculateEstimate, "calculateEstimate");

// ../../server/inquiries.js
var MAX_BODY_BYTES = 16384;
var InquiryError = class extends Error {
  static {
    __name(this, "InquiryError");
  }
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
};
function reject(status = 400, code = "invalid_request") {
  throw new InquiryError(status, code);
}
__name(reject, "reject");
function json(status, data) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...status === 405 ? { Allow: "POST" } : {}, ...status === 429 ? { "Retry-After": "60" } : {} } });
}
__name(json, "json");
function failure(error) {
  return json(error instanceof InquiryError ? error.status : 502, { ok: false, error: error instanceof InquiryError ? error.code : "upstream_unavailable" });
}
__name(failure, "failure");
async function readJson(request) {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?\s*$/i.test(request.headers.get("content-type") || "")) reject(415, "unsupported_media_type");
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) reject(413, "body_too_large");
  if (!request.body) reject();
  const reader = request.body.getReader();
  let size = 0;
  const chunks = [];
  try {
    for (; ; ) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        void reader.cancel().catch(() => {
        });
        reject(413, "body_too_large");
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof InquiryError) throw error;
    reject();
  } finally {
    reader.releaseLock();
  }
  try {
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    reject();
  }
}
__name(readJson, "readJson");
function object(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) reject();
  return value;
}
__name(object, "object");
function keys(value, allowed) {
  object(value);
  if (Object.keys(value).some((key) => !allowed.includes(key))) reject();
}
__name(keys, "keys");
var controls = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;
function text(value, max, required = false, multiline = false) {
  if (value === void 0 && !required) return "";
  if (typeof value !== "string" || value.length > max || (multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/ : controls).test(value)) reject();
  const normalized = value.trim();
  if (required && !normalized) reject();
  return normalized;
}
__name(text, "text");
function email(value) {
  const normalized = text(value, 254, true);
  if (!/^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(normalized) || normalized.split("@")[0].length > 64 || normalized.split("@")[1].split(".").some((x) => x.length > 63)) reject();
  return normalized;
}
__name(email, "email");
function selection(value, allowed, max, required = false) {
  if (!Array.isArray(value) || value.length > max || required && !value.length || new Set(value).size !== value.length || value.some((v) => typeof v !== "string" || !allowed.includes(v))) reject();
  return value;
}
__name(selection, "selection");
function quote(value) {
  keys(value, ["services", "options", "estimate"]);
  const services = selection(value.services, Object.keys(SERVICES), 5, true);
  const options = value.options ?? {};
  const allowed = [];
  if (services.includes("web")) allowed.push("templates", "design");
  if (services.includes("web") || services.includes("agentic")) allowed.push("features");
  if (services.includes("hosting")) allowed.push("hosting");
  for (const service of ["consulting", "contract"]) if (services.includes(service)) allowed.push(`${service}Hours`, `${service}Focus`);
  keys(options, allowed);
  for (const [key, max] of [["templates", 20], ["consultingHours", 160], ["contractHours", 160]]) if (Object.hasOwn(options, key) && (!Number.isInteger(options[key]) || options[key] < 1 || options[key] > max)) reject();
  for (const [key, values] of [["design", ["standard", "custom"]], ["hosting", Object.keys(HOSTING)], ["consultingFocus", ["planning", "review", "architecture"]], ["contractFocus", ["development", "maintenance", "team"]]]) if (Object.hasOwn(options, key) && !values.includes(options[key])) reject();
  if (Object.hasOwn(options, "features")) {
    selection(options.features, Object.keys(FEATURES), Object.keys(FEATURES).length);
    if (options.features.some((key) => !services.includes(FEATURES[key].service))) reject();
  }
  const estimate = calculateEstimate({ services, ...options });
  return { services: estimate.services, options: estimate.options, estimate };
}
__name(quote, "quote");
function normalizeInquiry(value, publicInput = false) {
  keys(value, ["schemaVersion", "kind", "contact", "topic", "message", "quote", "services", "options", "estimate", ...publicInput ? ["turnstileToken"] : []]);
  if (value.schemaVersion !== 1 || !["contact", "quote"].includes(value.kind)) reject();
  keys(value.contact, ["name", "email", "business", "website"]);
  const contact = { name: text(value.contact.name, 100, true), email: email(value.contact.email), business: text(value.contact.business, 150), website: text(value.contact.website, 300) };
  if (contact.website) {
    try {
      const candidate = /^[a-z][a-z0-9+.-]*:/i.test(contact.website) ? contact.website : `https://${contact.website}`;
      const url = new URL(candidate);
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || !url.hostname) reject();
      contact.website = url.href;
    } catch {
      reject();
    }
  }
  const topic = text(value.topic, 80);
  if (!["", ...Object.keys(SERVICES), "Something else"].includes(topic)) reject();
  const result = { schemaVersion: 1, kind: value.kind, contact, topic, message: text(value.message, 3e3, true, true) };
  const flat = ["services", "options", "estimate"].some((key) => Object.hasOwn(value, key));
  if (value.kind === "quote") {
    if (flat && Object.hasOwn(value, "quote")) reject();
    result.quote = quote(flat ? Object.fromEntries(["services", "options", "estimate"].filter((k) => Object.hasOwn(value, k)).map((k) => [k, value[k]])) : value.quote);
  } else if (flat || Object.hasOwn(value, "quote")) reject();
  if (publicInput) result.turnstileToken = text(value.turnstileToken, 2048, true);
  return result;
}
__name(normalizeInquiry, "normalizeInquiry");
function validIp(value) {
  if (typeof value !== "string" || value.length > 45) return false;
  const v4 = /* @__PURE__ */ __name((s) => /^(?:\d{1,3}\.){3}\d{1,3}$/.test(s) && s.split(".").every((p) => Number(p) <= 255 && String(Number(p)) === p), "v4");
  if (v4(value)) return true;
  if (!value.includes(":") || !/^[0-9a-f:.]+$/i.test(value)) return false;
  let v6 = value;
  if (v6.includes(".")) {
    const i = v6.lastIndexOf(":");
    if (!v4(v6.slice(i + 1))) return false;
    v6 = v6.slice(0, i) + ":0:0";
  }
  const halves = v6.split("::");
  if (halves.length > 2) return false;
  const groups = halves.flatMap((h) => h ? h.split(":") : []);
  return groups.every((g) => /^[0-9a-f]{1,4}$/i.test(g)) && (halves.length === 2 ? groups.length < 8 : groups.length === 8);
}
__name(validIp, "validIp");
function formatInquiry(inquiry) {
  const { contact, kind, topic, message } = inquiry;
  const lines = [`Herr Systems ${kind} inquiry`, "", `Name: ${contact.name}`, `Email: ${contact.email}`, `Business: ${contact.business || "(not supplied)"}`, `Website: ${contact.website || "(not supplied)"}`, `Topic: ${topic || "(not supplied)"}`, "", "Message:", message];
  if (kind === "quote") {
    const { estimate } = inquiry.quote;
    lines.push("", "Server-calculated planning estimate (USD; not a binding quote):", `Services: ${estimate.services.map((key) => SERVICES[key]).join(", ")}`, `Options: ${JSON.stringify(estimate.options)}`);
    for (const line of estimate.lines) lines.push(`${line.label}: $${line.price}`);
    lines.push(`One-time total: $${estimate.total}`, `Monthly: $${estimate.monthly}`, `Support: ${estimate.support}`);
  }
  return lines.join("\n");
}
__name(formatInquiry, "formatInquiry");

// index.js
var providerCodes = /* @__PURE__ */ new Set([
  "E_SENDER_NOT_VERIFIED",
  "E_SENDER_DOMAIN_NOT_AVAILABLE",
  "E_RECIPIENT_NOT_ALLOWED",
  "E_VALIDATION_ERROR",
  "E_RATE_LIMIT_EXCEEDED",
  "E_DAILY_LIMIT_EXCEEDED",
  "E_DELIVERY_FAILED",
  "E_INTERNAL_SERVER_ERROR"
]);
function diagnose(stage, error) {
  let providerCode = "unrecognized";
  try {
    if (providerCodes.has(error?.code)) providerCode = error.code;
  } catch {
  }
  console.error(JSON.stringify({ event: "mailer_diagnostic", stage, status: 502, providerCode }));
}
__name(diagnose, "diagnose");
var index_default = {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (url.origin !== "https://inquiry-mailer.internal" || url.pathname !== "/send" || url.search) reject(404, "not_found");
      if (request.method !== "POST") reject(405, "method_not_allowed");
      const envelope = await readJson(request);
      keys(envelope, ["inquiry", "clientIp"]);
      if (!validIp(envelope.clientIp)) reject();
      const inquiry = normalizeInquiry(envelope.inquiry);
      if (typeof env?.SEND_EMAIL?.send !== "function" || typeof env?.INQUIRY_RATE_LIMITER?.limit !== "function" || env?.INQUIRY_FROM !== "forms@herrsystems.com") reject(503, "service_unavailable");
      let to;
      try {
        to = email(env.INQUIRY_TO);
      } catch {
        reject(503, "service_unavailable");
      }
      let limit;
      try {
        limit = await env.INQUIRY_RATE_LIMITER.limit({ key: envelope.clientIp });
      } catch {
        reject(503, "service_unavailable");
      }
      if (limit?.success === false) reject(429, "rate_limited");
      if (limit?.success !== true) reject(503, "service_unavailable");
      let result;
      try {
        result = await env.SEND_EMAIL.send({
          to,
          from: env.INQUIRY_FROM,
          replyTo: inquiry.contact.email,
          subject: inquiry.kind === "quote" ? "Herr Systems quote inquiry" : "Herr Systems contact inquiry",
          text: formatInquiry(inquiry)
        });
      } catch (error) {
        diagnose("email_send", error);
        reject(502, "submission_unconfirmed");
      }
      const rawMessageId = result?.messageId;
      const messageId = typeof rawMessageId === "string" && rawMessageId.startsWith("<") && rawMessageId.endsWith(">") ? rawMessageId.slice(1, -1) : rawMessageId;
      if (typeof messageId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:@/+=-]{0,255}$/.test(messageId) || /[\r\n]/.test(messageId)) {
        console.error(JSON.stringify({
          event: "email_acknowledgement_shape",
          resultType: typeof result,
          messageIdType: typeof result?.messageId,
          messageIdLength: typeof result?.messageId === "string" ? result.messageId.length : null,
          messageIdHasAngleBrackets: typeof result?.messageId === "string" ? /[<>]/.test(result.messageId) : false
        }));
        diagnose("email_acknowledgement");
        reject(502, "submission_unconfirmed");
      }
      return json(202, { ok: true, status: "submitted" });
    } catch (error) {
      return failure(error);
    }
  }
};
export {
  index_default as default
};
