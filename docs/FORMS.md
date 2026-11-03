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

## Secret: Cloudflare only

Never commit the Turnstile SECRET key or put it in Hugo data, browser JS,
CMS fields, screenshots, or chat. In the inquiry Worker (not Pages build
settings), open Settings > Variables and Secrets > Add > Secret:

Name: TURNSTILE_SECRET_KEY
Value: your private Turnstile secret

Save/deploy as prompted. No Cloudflare credentials need to be shared.
For local Worker development, use workers/inquiries/.dev.vars once that
Worker exists. .env variants, .dev.vars variants and .wrangler/ directories
are ignored throughout the repo. Never force-add secrets. Ignore rules do
not protect already-tracked files. Rotate any accidentally committed secret;
deleting it from the latest revision is not sufficient.

## Required backend (not implemented by this frontend configuration change)

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
2. Commit the PUBLIC site key in data/forms.yml, leaving enabled false.
3. Deploy a real Worker and configure its secret privately in Cloudflare.
4. Test verification, failures and actual email receipt on both forms.
5. Set enabled true and update unavailable-delivery copy in
   content/contact/index.md and content/pricing/index.md as appropriate.

No separate repository or Cloudflare account token is needed for this config.
There is no email handler deployed by this change and no live delivery claim.

## Tests

npm run test:forms
npm test
hugo --gc --minify

The form tests build default/configured/missing-key variants and exercise both
forms in Chromium using mocked Turnstile and inquiry APIs, not live email.
