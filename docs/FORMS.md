# Secure form configuration

Edit `data/forms.yml` in Git:

```yaml
turnstile_site_key: "YOUR_PUBLIC_SITE_KEY"
enabled: false
```

The site key is PUBLIC and safe to commit. Both contact and quote forms use
this file. Keep enabled false until a real /api/inquiries Worker validates
tokens and delivers email. A blank site key also keeps delivery disabled.
When disabled, neither the widget nor its third-party script is loaded.

## Cloudflare Pages variables (recommended)

Set TURNSTILE_SITE_KEY as a Text variable in the Pages project. Hugo reads it
during the build; it takes precedence over the optional data/forms.yml key.
Leave the Git key blank when using this approach. The public key is intentionally
included in the browser output when enabled. Redeploy/rebuild after changing it.
Configure Production and Preview separately; do not expose production secrets
to untrusted preview branches.

TURNSTILE_SECRET_KEY stays a Secret in Pages. The Pages Function reads
it from context.env.TURNSTILE_SECRET_KEY at runtime. Hugo only allowlists the
public key name, not the secret name. The secret is never needed for the build.
See FORMS-DEPLOYMENT.md for the server handler and bound email Worker.

## Secret: Cloudflare only

Never commit the Turnstile SECRET key or put it in Hugo data, browser JS,
CMS fields, screenshots, or chat. For a Pages Function use the existing Pages project; for a separate Worker
use that Worker. Open Settings > Variables and Secrets > Add > Secret:

Name: TURNSTILE_SECRET_KEY
Value: your private Turnstile secret

Save/deploy as prompted. No Cloudflare credentials need to be shared.
For local Worker development, use workers/inquiry-mailer/.dev.vars for the email Worker. .env variants, .dev.vars variants and .wrangler/ directories
are ignored throughout the repo. Never force-add secrets. Ignore rules do
not protect already-tracked files. Rotate any accidentally committed secret;
deleting it from the latest revision is not sufficient.

## Backend security contract

POST /api/inquiries receives JSON with turnstileToken, schemaVersion: 1,
kind: contact or quote, contact fields and message. Quotes also include
services/options/estimate. Before ANY email send the Worker must:

- Validate origin, content type, bounded body/fields, and enforce rate limits.
- Reject missing secret/token; never rely on browser validation.
- POST secret and response (the token) to
  https://challenges.cloudflare.com/turnstile/v0/siteverify.
- Require success=true, an allowed production hostname and action matching
  kind (contact or quote). Fail closed on errors/expiry/reuse/mismatch.
- Deliver only to a configured fixed recipient. Treat quote totals as
  untrusted; recalculate or label as visitor supplied.
- Return HTTP success with JSON {"ok":true} only after the email provider
  accepts the send; otherwise a non-success status with {"ok":false}.
- Never log secrets, tokens or message contents.

Tokens are single use and expire after five minutes. The frontend resets
Turnstile after each attempted delivery, including failures, and preserves
inputs. Missing/blocked verification prevents submission.

## Activation checklist

1. Use a Managed Turnstile widget allowing herrsystems.com (www only if used).
   Use separate development/test keys rather than broadly allowing previews.
2. Set TURNSTILE_SITE_KEY in Pages (or the public Git fallback), leaving enabled false.
3. Deploy a real Worker and configure its secret privately in Cloudflare.
4. Test verification, failures and actual email receipt on both forms.
5. Set enabled true and update unavailable-delivery copy in
   content/contact/index.md and content/pricing/index.md as appropriate.

No separate repository or Cloudflare account token is needed for this config.
Code in Git is not a deployed handler: follow FORMS-DEPLOYMENT.md. There is no
live delivery claim until an actual send and inbox check succeed.

## Tests

npm run test:forms
npm test
hugo --gc --minify

The form tests build default/configured/missing-key variants and exercise both
forms in Chromium using mocked Turnstile and inquiry APIs, not live email.
