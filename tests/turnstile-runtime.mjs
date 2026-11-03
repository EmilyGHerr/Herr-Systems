import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const reserve = createServer();
reserve.listen(0, "127.0.0.1"); await once(reserve, "listening");
const port = reserve.address().port;
await new Promise(resolve => reserve.close(resolve));
const child = spawn(process.execPath, ["node_modules/wrangler/bin/wrangler.js", "dev", "tests/fixtures/turnstile-runtime.js", "--port", String(port), "--ip", "127.0.0.1", "--compatibility-date", "2026-11-03"], { cwd: root, env: { ...process.env, WRANGLER_SEND_METRICS: "false" }, stdio: ["ignore", "pipe", "pipe"] });
let logs = "";
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Runtime startup timed out: " + logs)), 30000);
    const read = data => { logs += data.toString(); if (logs.includes("Ready on")) { clearTimeout(timer); resolve(); } };
    child.stdout.on("data", read); child.stderr.on("data", read);
    child.once("error", error => { clearTimeout(timer); reject(error); });
    child.once("exit", code => { clearTimeout(timer); reject(new Error("Runtime exited " + code + ": " + logs)); });
  });
  const response = await fetch(`http://127.0.0.1:${port}/api/inquiries`, { method: "POST", headers: { origin: "https://herrsystems.com", "content-type": "application/json", "CF-Connecting-IP": "192.0.2.44" }, body: JSON.stringify({ schemaVersion: 1, kind: "contact", contact: { name: "Runtime test", email: "test@example.net" }, message: "No live send", turnstileToken: "fake-runtime-token" }), signal: AbortSignal.timeout(10000) });
  const body = await response.json();
  assert.equal(response.status, 400, "Workerd should reach token validation instead of throwing during request construction: " + JSON.stringify(body) + "\n" + logs);
  assert.equal(body.error, "verification_failed");
  console.log("PASS actual Workerd handler: Siteverify Request options accepted; invalid token rejected; no network or email send");
} finally {
  child.kill("SIGTERM");
  if (child.exitCode === null && child.signalCode === null) await Promise.race([once(child, "exit"), new Promise(resolve => setTimeout(() => { child.kill("SIGKILL"); resolve(); }, 5000).unref())]);
}
