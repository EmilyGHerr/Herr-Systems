import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { root, serve } from './support.mjs';

// The actual form module runs in Chromium; all API/challenge traffic is mocked.
const server = await serve(`${root}/static`);
let browser;
const sent = [], errors = [];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const receipt = '34bb5d8b-7077-4cff-bf19-a337bcaed876';
let reply = { status: 503, json: { ok: false, error: 'service_unavailable' } };
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.storageWrites = [];
    Storage.prototype.setItem = function (...args) { window.storageWrites.push(args); throw Error('Storage forbidden'); };
    // Exercise the existing AbortController timeout without a 15-second wait.
    const timeout = window.setTimeout.bind(window);
    window.setTimeout = (fn, ms, ...args) => timeout(fn, ms === 15000 ? 100 : ms, ...args);
  });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    assert.equal(url.origin, server.url, 'No live network');
    assert.equal(url.search, '', 'No data or IDs in URLs');
    if (url.pathname === '/fixture') return route.fulfill({ contentType: 'text/html', body: `<!doctype html>
      <form id="inquiry" data-inquiry-form data-form-kind="contact" data-endpoint-enabled="true" action="/api/inquiries">
        <label>Name<input name="name" required value="Test Visitor"></label>
        <label>Email<input name="email" type="email" required value="visitor@example.net"></label>
        <input name="business"><input name="website"><input name="topic">
        <label>Message<textarea name="message" required>Browser-only inquiry</textarea></label>
        <button data-submit-button>Submit</button><button type="reset">Reset</button>
        <div data-submit-status tabindex="-1"></div>
      </form><script type="module" src="/inquiry-form.js"></script>` });
    if (url.pathname === '/inquiry-turnstile.js') return route.fulfill({ contentType: 'text/javascript', body: `
      window.testToken = 'test-token'; window.resets = 0;
      export function prepareTurnstile() { return {
        token: async () => window.testToken,
        reset: async () => { window.resets++; window.testToken = ''; }
      }; }` });
    if (url.pathname === '/api/inquiries') {
      sent.push(route.request().postDataJSON());
      if (reply.abort) return route.abort('failed');
      if (reply.timeout) { await new Promise(resolve => setTimeout(resolve, 200)); return route.abort('timedout'); }
      return route.fulfill(reply);
    }
    assert.equal(url.pathname, '/inquiry-form.js');
    return route.continue();
  });
  await page.goto(`${server.url}/fixture`);
  const button = page.locator('[data-submit-button]');
  const status = page.locator('[data-submit-status]');
  await page.waitForFunction(() => typeof window.testToken === 'string');
  async function submit(token = 'fresh-test-token') {
    await page.evaluate(token => { window.testToken = token; }, token);
    const before = sent.length;
    await button.click();
    await page.waitForFunction(() => !document.querySelector('[data-submit-button]').disabled);
    assert.equal(sent.length, before + 1);
    assert.equal(sent.at(-1).turnstileToken, token);
    assert.equal(await page.evaluate(() => window.testToken), '', 'Challenge resets after API attempts');
    return status.textContent();
  }
  await page.locator('[name=name]').fill(' ');
  await button.click();
  assert.equal(sent.length, 0, 'Validation blocks POST');
  await page.locator('[name=name]').fill('Test Visitor');
  await page.evaluate(() => { window.testToken = ''; });
  await button.click();
  await page.waitForFunction(() => document.querySelector('[data-submit-status]').textContent.includes('verification'));
  assert.equal(sent.length, 0, 'Turnstile gates POST');
  assert.match(await submit(), /could not be confirmed/i);
  const first = sent.at(-1).submissionId;
  assert.match(first, uuid);
  await submit('different-token');
  assert.equal(sent.at(-1).submissionId, first, 'Refreshed token reuses ID');
  await page.locator('[name=message]').fill('  Browser-only inquiry  ');
  await submit();
  assert.equal(sent.at(-1).submissionId, first, 'Trim-equivalent values reuse ID');
  await page.locator('[name=message]').fill('Different inquiry');
  await submit();
  const edited = sent.at(-1).submissionId;
  assert.match(edited, uuid);
  assert.notEqual(edited, first);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await submit();
  assert.notEqual(sent.at(-1).submissionId, first, 'Reset invalidates original snapshot');
  assert.notEqual(sent.at(-1).submissionId, edited);
  const resetId = sent.at(-1).submissionId;
  // Reset on an identical snapshot must invalidate the current ID too.
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await submit();
  assert.notEqual(sent.at(-1).submissionId, resetId);
  const retryId = sent.at(-1).submissionId;
  for (const [code, error, expected] of [
    [400, 'verification_failed', /verification failed/i],
    [503, 'verification_unavailable', /verification.*unavailable/i],
    [429, 'rate_limited', /too many requests/i],
    [409, 'submission_conflict', /conflict/i],
    [503, 'save_failed', /could not be confirmed/i],
    [503, 'service_unavailable', /could not be confirmed/i],
  ]) {
    reply = { status: code, json: { ok: false, error } };
    const copy = await submit();
    assert.match(copy, expected);
    assert.doesNotMatch(copy, /not (?:saved|received|sent)|wasn.t saved|delivered/i);
    assert.equal(sent.at(-1).submissionId, retryId);
    assert.equal(await page.locator('[name=message]').inputValue(), 'Browser-only inquiry');
  }
  for (const failure of [{ abort: true }, { timeout: true }]) {
    reply = failure;
    assert.match(await submit(), /couldn.t confirm receipt/i);
    assert.equal(sent.at(-1).submissionId, retryId);
    assert.equal(await page.locator('[name=message]').inputValue(), 'Browser-only inquiry');
  }
  reply = { status: 200, json: { ok: true, status: 'submitted', receiptId: receipt } };
  const success = await submit();
  assert.match(success, /received|saved/i);
  assert.ok(success.includes(receipt));
  assert.doesNotMatch(success, /delivered/i);
  assert.equal(sent.at(-1).submissionId, retryId);
  for (const receiptId of [undefined, '<img src=x onerror=alert(1)>', 'not-a-uuid']) {
    reply = { status: 200, json: { ok: true, status: 'submitted', receiptId } };
    const copy = await submit();
    assert.equal(await status.getAttribute('data-state'), 'success', 'Legacy acknowledgement supported');
    assert.doesNotMatch(copy, /receipt|<img|not-a-uuid/i);
  }
  // Quote-specific builder output participates in the same snapshot identity.
  await page.evaluate(() => {
    const form = document.querySelector('form');
    form.dataset.formKind = 'quote';
    const service = document.createElement('input');
    service.name = 'service'; service.value = 'web'; service.type = 'checkbox'; service.checked = true;
    form.append(service);
    window.quoteAmount = 100;
    form.buildInquiryPayload = () => ({ quote: { amount: window.quoteAmount, services: ['web'] } });
  });
  await submit();
  const quoteId = sent.at(-1).submissionId;
  assert.match(quoteId, uuid);
  assert.notEqual(quoteId, retryId);
  assert.deepEqual(sent.at(-1).quote, { amount: 100, services: ['web'] });
  await submit('new-quote-token');
  assert.equal(sent.at(-1).submissionId, quoteId);
  await page.evaluate(() => { window.quoteAmount = 200; });
  await submit();
  assert.notEqual(sent.at(-1).submissionId, quoteId, 'Builder changes rotate ID');
  await page.reload();
  await page.waitForFunction(() => typeof window.testToken === 'string');
  await submit();
  assert.notEqual(sent.at(-1).submissionId, first, 'Reload does not recover an ID from persistent storage');
  assert.deepEqual(await page.evaluate(() => ({ writes: window.storageWrites, local: localStorage.length, session: sessionStorage.length })), { writes: [], local: 0, session: 0 });
  assert.equal(page.url(), `${server.url}/fixture`);
  assert.deepEqual(errors, []);
  console.log('PASS inquiry receipts browser: validation/Turnstile gates, normalized retry UUIDs, edit/reset IDs, distinct errors, network/timeout input and ID retention, receipt/legacy success, no storage/URL leakage. API and Turnstile mocked; no live email.');
} finally {
  await browser?.close();
  await server.close();
}
