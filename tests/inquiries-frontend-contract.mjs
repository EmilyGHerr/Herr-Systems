import assert from "node:assert/strict";
import test from "node:test";
import { normalizeInquiry } from "../server/inquiries.js";
const base = { schemaVersion: 1, kind: "contact", contact: { name: "Test Visitor", email: "visitor@example.com", business: "", website: "example.com" }, topic: "", message: "Contract test", turnstileToken: "test-only-token" };
test("Contact website accepts the bare domain promised by the existing UI", () => {
  assert.equal(normalizeInquiry(base, true).contact.website, "https://example.com/");
});
test("Contact website rejects executable schemes and embedded credentials", () => {
  for (const website of ["javascript:alert(1)", "data:text/plain,test", "https://user:pass@example.com/"]) {
    assert.throws(() => normalizeInquiry({ ...base, contact: { ...base.contact, website } }, true));
  }
});
