import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateEstimate, HOSTING } from '../static/pricing-calculator.js';
import { onRequest } from '../functions/api/inquiries.js';
import source from '../workers/inquiry-mailer/index.js';
import bundle from '../workers/inquiry-mailer/dashboard-worker.js';
const plans = [['static', 'Static Site Hosting', 5], ['basic', 'Basic Hosting', 10], ['ecommerce', 'E-Commerce Hosting', 25]];
test('hosting catalogue and calculator use the three published monthly plans', () => {
  assert.deepEqual(Object.keys(HOSTING), plans.map(([key]) => key));
  for (const [hosting, label, price] of plans) {
    const estimate = calculateEstimate({services:['hosting'], hosting});
    assert.equal(estimate.total, 0);
    assert.equal(estimate.monthly, price);
    assert.equal(estimate.support, label);
    assert.equal(estimate.options.hosting, hosting);
  }
  assert.equal(calculateEstimate({services:['hosting']}).options.hosting, 'static');
  assert.equal(calculateEstimate({services:[]}).monthly, 0);
});
for (const [name, worker] of [['source', source], ['dashboard bundle', bundle]]) {
  test(`Pages → ${name} recalculates every hosting plan before sending`, async () => {
    const original = globalThis.fetch;
    const sent = [];
    const workerEnv = {INQUIRY_TO:'private@example.net', INQUIRY_FROM:'forms@herrsystems.com', INQUIRY_RATE_LIMITER:{limit:async()=>({success:true})}, SEND_EMAIL:{send:async mail=>{sent.push(mail); return {messageId:'test-only-id'};}}};
    const env = {TURNSTILE_SECRET_KEY:'test-only-secret', INQUIRY_MAILER:{fetch:request=>worker.fetch(request,workerEnv)}};
    globalThis.fetch = async()=>Response.json({success:true,hostname:'herrsystems.com',action:'quote'});
    const request = hosting => new Request('https://herrsystems.com/api/inquiries', {method:'POST',headers:{origin:'https://herrsystems.com','content-type':'application/json','CF-Connecting-IP':'192.0.2.44'},body:JSON.stringify({schemaVersion:1,kind:'quote',contact:{name:'Test',email:'test@example.net'},message:'Automated local test',turnstileToken:'test-token',services:['hosting'],options:{hosting},estimate:{monthly:999,support:'UNTRUSTED'}})});
    try {
      for (const [hosting, label, price] of plans) {
        const response = await onRequest({request:request(hosting),env});
        assert.equal(response.status,202);
        assert.ok(sent.at(-1).text.includes(`Monthly: $${price}\nSupport: ${label}`));
        assert.doesNotMatch(sent.at(-1).text,/999|UNTRUSTED/);
      }
      for (const hosting of ['hosting','managed','unknown']) assert.equal((await onRequest({request:request(hosting),env})).status,400);
      assert.equal(sent.length,3);
    } finally { globalThis.fetch = original; }
  });
}
