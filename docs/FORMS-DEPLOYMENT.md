# Deploy the inquiry backend

## Architecture

Browser contact/quote form -> Pages Function `/api/inquiries` -> private
`INQUIRY_MAILER` service binding -> `herr-inquiry-mailer` Worker -> `SEND_EMAIL`.
All source stays in Herr-Systems. The Worker is a separate deployment, not a
separate repository. No Cloudflare credentials or private inbox go in Git.
Existing MX, catch-all, and hello@herrsystems.com forwarding stay unchanged.

## 1. Worker configuration

The standalone Worker must be named `herr-inquiry-mailer`, matching the Pages
service binding. Deploy its source and `workers/inquiry-mailer/wrangler.jsonc`
together; simply adding bindings to a placeholder Worker does not install code.

In the Worker settings set:

- `INQUIRY_TO`: Secret. Your real, VERIFIED personal destination inbox from
  Cloudflare Email Routing. Not the catch-all alias hello@herrsystems.com.
- `INQUIRY_FROM`: Text variable, default `forms@herrsystems.com` in the config.
  This must belong to your existing Cloudflare routing/sending domain. If
  Cloudflare rejects the sender, check sender authorization; do not change MX
  or upgrade without first understanding the account requirement.

The checked-in config declares:

- `SEND_EMAIL` Email Service binding; sender restricted to forms@herrsystems.com.
  The handler intentionally enforces this sender; changing it requires updating
  the handler, its tests, and the binding sender allowlist together.
- `INQUIRY_RATE_LIMITER`: native Workers rate limiter, five attempts per
  60 seconds per visitor IP per Cloudflare location. Shared IP users share
  that allowance. Limits are approximate, not a strict global quota.
- No public workers.dev URL, version preview URL, or custom-domain routes.
  This Worker is accessible through service bindings only. Keep it that way:
  an internal URL/hostname is a routing convention, NOT authentication.

The rate-limit namespace in the config is account-scoped. Change it to a
unique positive integer string if already used by another application.
Do not omit the limiter: the mailer fails closed if it is unavailable.

Do not manually add any public custom domain or route to the mailer. If it had
a public route before this setup, remove it in the Worker settings as well.

The email recipient is fixed by the secret, never browser input. Visitor email
is Reply-To only. There are no auto-replies to arbitrary visitor addresses.
The Git config keeps SEND_EMAIL in sync; do not replace it with an incoming
email trigger or route the catch-all through this Worker.

## 2. Deploy Worker from Git through Cloudflare

In the Worker, connect this same GitHub repository via its Builds settings
(or use the Cloudflare import-existing-Git workflow targeting this Worker).

- Repository: EmilyGHerr/Herr-Systems
- Production branch: main, after the backend PR is merged
- Repository root: leave blank (shared server code lives outside workers/)
- Install/build: `npm ci` (use Cloudflare automatic install OR this command)
- Deploy: `npx wrangler deploy --config workers/inquiry-mailer/wrangler.jsonc`

Use only trusted branches. Do not enable non-production version deployments
for this service. This is the Worker deployment, not the Pages Hugo build.
If the UI does not offer connecting the existing Worker, create a Git-connected
Worker with the configured name and repoint the Pages service binding; do not
deploy blindly to a different Worker and assume the binding follows it.

No need to give Jules an account token. Keep your account access private.

## 3. Pages settings (already partially configured)

Production environment:

- `TURNSTILE_SITE_KEY`: Text variable (public, available during Hugo build).
- `TURNSTILE_SECRET_KEY`: Secret (runtime for the Pages Function only).
- Service binding `INQUIRY_MAILER` -> `herr-inquiry-mailer` production service.

Keep the existing Pages repository root blank, build `hugo --gc --minify`,
output `public`. Cloudflare Pages detects root `functions/` from the Git repo;
do not move Functions into public/ or change the project to a static upload.
`static/_routes.json` becomes `public/_routes.json` and limits function
invocations to the inquiry endpoint. Other pages and assets stay static.
Redeploy Pages after binding/secret changes. Keep production secrets/service
bindings out of untrusted Preview deployments.

Allowed production origin and Turnstile hostname are deliberately restricted
to https://herrsystems.com and herrsystems.com. Arbitrary pages.dev previews
will be rejected. Use isolated dev configuration/keys for development.

## 4. Test and enable deliberately

1. Merge/deploy the backend while `data/forms.yml` still says `enabled: false`.
2. Confirm the Worker has INQUIRY_TO, SEND_EMAIL, and the configured limiter,
   and that Pages was redeployed with its secret and service binding.
3. GET /api/inquiries should now return a JSON method error (405), not HTML.
   POST with a missing/invalid token must fail without sending email.
4. To run the live positive test, set enabled true in a controlled deployment
   (this is the explicit point where the public forms start accepting sends).
   Replace stale unavailable-delivery copy in the contact and pricing content
   at the same time. The widget loads only when enabled with a public key.
5. Submit one labelled test from contact and one from pricing using the real
   production Turnstile widget. Confirm actual inbox arrival and that Reply
   targets the visitor address. Check the quote contains recalculated scope.
6. If any live step fails, restore enabled false while diagnosing. Do not
   repeatedly click send after an ambiguous timeout: an email may have been
   accepted even though the browser never received confirmation.

Success means the Email Service returned an acceptance ID, NOT guaranteed
inbox placement. There are no automatic retries or exactly-once persistence.
Turnstile prevents token reuse but new tokens can produce duplicate messages.
We have not verified free sending or deliverability in your account merely by
creating a binding. If actual native sends are blocked by account restrictions,
report that blocker rather than claiming they worked or upgrading silently.

## Local verification (no real emails)

```
npm ci
npm run test:backend
npm run test:forms
npm test
hugo --gc --minify
npm run build:functions
npm run build:mailer
```

Tests mock Siteverify, the native limiter and email provider. They exercise the
actual Pages -> service-binding -> Worker code path without using real keys.
Wrangler build/dry-run validates bundles but is not a Cloudflare deployment.
Never paste private values into test fixtures. Local .dev.vars/.env files and
Wrangler state are Git-ignored. Revoke/rotate any accidentally committed secret.

## Dashboard editor alternative

`workers/inquiry-mailer/dashboard-worker.js` is a self-contained module bundle.
Copy its entire contents into the existing Worker code editor, replacing Hello
World. Do NOT paste index.js by itself: that source imports local helper files.
Regenerate the bundle with `npm run build:mailer-dashboard` after source changes.

Before using the pasted code, the Worker requires SEND_EMAIL, INQUIRY_TO (Secret),
INQUIRY_FROM=forms@herrsystems.com (Text), and INQUIRY_RATE_LIMITER (native rate
binding). Disable workers.dev, version preview URLs and all public routes in
Worker settings. Keep it accessible only through the Pages service binding.

Pasting JavaScript does NOT apply wrangler.jsonc or create bindings. In particular,
the native rate limiter is not exposed in the dashboard binding picker according
to current Cloudflare docs. It still needs a configuration deployment using the
checked-in Wrangler config (through Workers Builds or your own authenticated CLI).
The handler intentionally returns 503 without it; do not remove that protection
or mistake successful editor deployment for a fully configured mail service.
