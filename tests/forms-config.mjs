import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { load } from "cheerio";
import { chromium } from "playwright";
import { root, workspace, fixture, build, serve, cleanup } from "./support.mjs";
const work = await workspace();
let server, browser;
const originalKey = process.env.TURNSTILE_SITE_KEY;
const originalSecret = process.env.TURNSTILE_SECRET_KEY;
delete process.env.TURNSTILE_SITE_KEY;
try {
  const source = await fixture(work);
  const config = path.join(source, "data/forms.yml");
  // Test the disabled state explicitly, independent of production activation.
  await writeFile(config, `enabled: false\nturnstile_site_key: ""\n`);
  const output = path.join(work, "site");
  build(source, output);
  for (const name of ["contact", "pricing"]) {
    const $ = load(await readFile(path.join(output, name, "index.html"), "utf8"));
    assert.equal($("[data-inquiry-form]").attr("data-endpoint-enabled"), "false");
    assert.equal($("[data-turnstile]").length, 0);
  }
  await writeFile(config, `enabled: true
turnstile_site_key: "1x00000000000000000000AA"
`);
  build(source, output);
  for (const name of ["contact", "pricing"]) {
    const $ = load(await readFile(path.join(output, name, "index.html"), "utf8"));
    assert.equal($("[data-inquiry-form]").attr("data-endpoint-enabled"), "true");
    assert.equal($("[data-turnstile]").attr("data-sitekey"), "1x00000000000000000000AA");
    assert.equal($("[data-turnstile]").attr("data-action"), name === "contact" ? "contact" : "quote");
  }
  await writeFile(config, `enabled: true
turnstile_site_key: ""
`);
  build(source, path.join(work, "missing"));
  for (const name of ["contact", "pricing"]) {
    const missing = load(await readFile(path.join(work, "missing", name, "index.html"), "utf8"));
    assert.equal(missing("[data-inquiry-form]").attr("data-endpoint-enabled"), "false");
  }
  // Pages build variable works without any site key committed to Git.
  process.env.TURNSTILE_SITE_KEY = "public-env-test-key";
  process.env.TURNSTILE_SECRET_KEY = "private-test-sentinel-not-a-real-key";
  const envOutput = path.join(work, "env-key");
  build(source, envOutput);
  for (const name of ["contact", "pricing"]) {
    const html = await readFile(path.join(envOutput, name, "index.html"), "utf8");
    const $ = load(html);
    assert.equal($("[data-inquiry-form]").attr("data-endpoint-enabled"), "true");
    assert.equal($("[data-turnstile]").attr("data-sitekey"), "public-env-test-key");
    assert.ok(!html.includes(process.env.TURNSTILE_SECRET_KEY));
  }
  // Environment key takes precedence over the optional Git fallback.
  await writeFile(config, `enabled: true
turnstile_site_key: "public-git-fallback"
`);
  build(source, path.join(work, "precedence"));
  const preferred = load(await readFile(path.join(work, "precedence/contact/index.html"), "utf8"));
  assert.equal(preferred("[data-turnstile]").attr("data-sitekey"), "public-env-test-key");
  delete process.env.TURNSTILE_SITE_KEY;
  server = await serve(output);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js*", route => route.fulfill({
    contentType: "text/javascript", body: `window.turnstile = {
      render: (el, opts) => { window.testWidgetOptions = opts; return "widget-1"; },
      getResponse: () => window.testToken || "",
      reset: () => { window.testReset = true; window.testToken = ""; }
    };`,
  }));
  const sent = [];
  let fail = false;
  await page.route("**/api/inquiries", async route => {
    sent.push(route.request().postDataJSON());
    await route.fulfill({ status: fail ? 503 : 200, json: { ok: !fail } });
  });
  for (const name of ["contact", "pricing"]) {
    await page.goto(`${server.url}/${name}/`);
    await page.waitForFunction(() => window.testWidgetOptions);
    const form = page.locator("[data-inquiry-form]");
    if (name === "pricing") await page.check("#service-web");
    await form.locator("[name=name]").fill("Test Visitor");
    await form.locator("[name=email]").fill("visitor@example.com");
    await form.locator("[name=message]").fill("A test inquiry.");
    const before = sent.length;
    await form.locator("[data-submit-button]").click();
    await page.waitForFunction(() => document.querySelector("[data-submit-status]").textContent.includes("verification"));
    assert.equal(sent.length, before, "No POST without a token");
    await page.evaluate(() => { window.testToken = "test-token"; });
    await form.locator("[data-submit-button]").click();
    await page.waitForFunction(() => document.querySelector("[data-submit-status]").dataset.state === "success");
    assert.equal(sent.length, before + 1);
    assert.equal(sent.at(-1).turnstileToken, "test-token");
    assert.equal(sent.at(-1).kind, name === "contact" ? "contact" : "quote");
    assert.equal(await page.evaluate(() => window.testReset), true);
    fail = true;
    await page.evaluate(() => { window.testToken = "another-token"; window.testReset = false; });
    await form.locator("[data-submit-button]").click();
    await page.waitForFunction(() => document.querySelector("[data-submit-status]").dataset.state === "error");
    assert.equal(await form.locator("[name=message]").inputValue(), "A test inquiry.");
    assert.equal(await page.evaluate(() => window.testReset), true);
    fail = false;
  }
  assert.deepEqual(errors, []);
  for (const file of [".env", ".env.production", ".dev.vars", "workers/inquiries/.dev.vars", "workers/inquiries/.env.local", "workers/inquiries/.wrangler/state/db"]) {
    execFileSync("git", ["check-ignore", "--quiet", file], { cwd: root });
  }
  console.log("PASS: Pages public variable/fallback precedence, secret isolation, safe defaults, missing-key gate, both widgets, token gating, success/error resets, preserved inputs, secret ignores. Turnstile/API mocked; no live email.");
} finally {
  if (originalKey === undefined) delete process.env.TURNSTILE_SITE_KEY; else process.env.TURNSTILE_SITE_KEY = originalKey;
  if (originalSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY; else process.env.TURNSTILE_SECRET_KEY = originalSecret;
  await browser?.close(); await server?.close(); await cleanup(work);
}
