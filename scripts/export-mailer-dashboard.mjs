import { readFile, writeFile } from "node:fs/promises";
const source = new URL("../workers/inquiry-mailer/.wrangler/mailer-build/index.js", import.meta.url);
const target = new URL("../workers/inquiry-mailer/dashboard-worker.js", import.meta.url);
const code = (await readFile(source, "utf8")).split("\n").filter(line => !line.startsWith("//# sourceMappingURL=")).join("\n");
const header = `// Paste-ready Cloudflare module Worker. Generated from reviewed index.js.
// Required: SEND_EMAIL, INQUIRY_RATE_LIMITER, INQUIRY_TO, INQUIRY_FROM.
// Service-binding access only: disable workers.dev, preview URLs, custom routes.
// No secrets belong in this file. Regenerate with npm run build:mailer-dashboard.

`;
await writeFile(target, header + code);
console.log("Exported self-contained dashboard-worker.js (no local imports or secrets)");
