import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const root = fileURLToPath(new URL('../', import.meta.url));
const wrangler = join(root, 'node_modules/wrangler/bin/wrangler.js');
const config = 'tests/fixtures/inquiry-outbox-runtime.jsonc';
const persistence = await mkdtemp(join(tmpdir(), 'inquiry-outbox-runtime-'));
const env = { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: 'true' };
const run = promisify(execFile);
let child;
let logs = '';
async function poll(check, description, timeout = 30000) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    if (child && (child.exitCode !== null || child.signalCode !== null)) {
      throw new Error(`Workerd exited during ${description}: ${logs}`);
    }
    try { last = await check(); if (last) return last; } catch (error) { last = error.message; }
    await delay(100);
  }
  throw new Error(`Timed out: ${description}; last=${JSON.stringify(last)}\n${logs}`);
}
try {
  for (const sqlArgs of [
    ['--file', 'workers/inquiry-mailer/migrations/0001_inquiry_outbox.sql'],
    ['--command', 'CREATE TABLE runtime_mock_events (kind TEXT NOT NULL)'],
  ]) {
    const { stdout, stderr } = await run(process.execPath, [wrangler, 'd1', 'execute',
      'inquiry-outbox-runtime-test', '--config', config, '--local', '--persist-to', persistence,
      ...sqlArgs], { cwd: root, env, timeout: 30000 });
    logs += stdout + stderr;
  }
  const reserve = createServer();
  reserve.listen(0, '127.0.0.1');
  await once(reserve, 'listening');
  const port = reserve.address().port;
  await new Promise(resolve => reserve.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, [wrangler, 'dev', '--config', config,
    '--local', '--persist-to', persistence, '--port', String(port), '--ip', '127.0.0.1'],
  { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', data => { logs += data; });
  child.stderr.on('data', data => { logs += data; });
  child.on('error', error => { logs += error.stack; });
  const state = async () => {
    const response = await fetch(`${base}/state`, { signal: AbortSignal.timeout(3000) });
    assert.equal(response.status, 200);
    return response.json();
  };
  await poll(async () => (await state()).count === 0, 'local D1 readiness');
  const submit = async input => {
    const response = await fetch(`${base}/submit`, { method: 'POST',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(input),
      signal: AbortSignal.timeout(10000) });
    return { status: response.status, body: await response.json() };
  };
  const id = randomUUID();
  const accepted = await submit({ id });
  assert.equal(accepted.status, 202, JSON.stringify(accepted));
  assert.equal(accepted.body.ok, true);
  assert.equal(accepted.body.receiptId, id);
  assert.equal(accepted.body.status, 'submitted');
  assert.equal((await state()).count, 1, '202 receipt must correspond to a durable D1 row');
  await poll(async () => {
    const current = await state();
    return current.rows[0]?.status === 'submitted' && current.sends === 1 && current;
  }, 'real local queue consumer and D1 UPDATE RETURNING claim');
  const duplicate = await submit({ id });
  assert.deepEqual(duplicate, accepted, 'same ID and content returns the same receipt');
  await poll(async () => (await state()).batches >= 2, 'duplicate queue message consumption');
  const invalid = await submit({ id: randomUUID(), invalid: true });
  assert.equal(invalid.status, 400, JSON.stringify(invalid));
  const invalidId = await submit({ id: 'not-a-uuid' });
  assert.equal(invalidId.status, 400, JSON.stringify(invalidId));
  const conflict = await submit({ id, conflict: true });
  assert.equal(conflict.status, 409, JSON.stringify(conflict));
  const final = await state();
  assert.equal(final.count, 1, 'duplicates and rejected inputs create no additional rows');
  assert.deepEqual(final.rows, [{ id, status: 'submitted', attempts: 1 }]);
  assert.equal(final.sends, 1, 'duplicate consumed message must not send again');
  assert.equal(final.networkAttempts, 0, 'email must use only the in-process mock');
  console.log('PASS local Workerd + D1: durable HTTP202 receipt; real queue consumer; UPDATE RETURNING claim; opaque mock acknowledgement; duplicate deduplication; invalid/conflicting inputs rejected; 1 row, 1 attempt, 1 mock send, 0 network email');
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  if (child && child.exitCode === null && child.signalCode === null) {
    const exited = once(child, 'exit');
    child.kill('SIGTERM');
    let timer;
    await Promise.race([exited, new Promise(resolve => {
      timer = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 5000);
    })]);
    clearTimeout(timer);
  }
  await rm(persistence, { recursive: true, force: true });
}
