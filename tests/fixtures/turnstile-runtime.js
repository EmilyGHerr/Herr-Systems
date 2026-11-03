import { onRequest } from "../../functions/api/inquiries.js";
// Runtime-only fixture: construct the real Workerd Request before mocking the
// Siteverify response. No external network, real credentials or email sends.
globalThis.fetch = async (url, init) => {
  const request = new Request(url, init);
  if (request.url !== "https://challenges.cloudflare.com/turnstile/v0/siteverify") throw new Error("Unexpected network request");
  return Response.json({ success: false, "error-codes": ["invalid-input-response"] });
};
export default {
  fetch(request) {
    return onRequest({ request, env: {
      TURNSTILE_SECRET_KEY: "fake-runtime-secret",
      INQUIRY_MAILER: { fetch() { throw new Error("Mailer must never be reached"); } },
    } });
  },
};
