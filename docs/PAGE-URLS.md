# Editing page URLs in Decap

Refresh `/sudo/` and reopen older editor tabs after this update.

- **Staff, articles, services, case studies, Contact and Pricing:** edit **URL slug (last path segment)** near the title. Use `emily-herr`, not a full URL.
- **Any non-home page, including About, Blog and service/case-study directories:** **Full page path (optional override)** changes the whole public path, such as `/about/emily-herr/` or `/get-in-touch/`. It takes precedence over the slug. Leave it blank to use the normal path. Changing a directory URL does not relocate its child pages.
- **Previous URLs (redirects):** add any previously published *custom* paths when changing them again. The original source-path URL is redirected automatically. Use `/old-name/`, with leading/trailing slashes. Redirects point directly to the latest URL; there are no intentional chains.
- **Home:** Hugo's home node remains at `/`. Additional home URLs can redirect to it; a fake homepage relocation field is not exposed.

These are public URL controls, not CMS file-renaming controls. Existing entries retain their repository paths and identities, so an edited entry can be reopened in the same collection without creating a duplicate. Titles do not silently rename published URLs. All original content fields remain available.

Staff profiles publish directly at `/about/<slug>/`. CMS storage remains under `content/about/team/` intentionally. There is no public Staff or Team listing; use About. Legacy `/about/team/<original-name>/` profiles redirect to their current public URLs. `/staff/` and `/about/team/` redirect to About.

Built-in navigation, cards, breadcrumbs, Markdown links, search, sitemap, and feed links resolve public URLs from stable page identities. Full URL overrides for canonicals under SEO remain separate: they identify a preferred search source and do not move a page.

Paths must be lowercase, hyphen-separated, and end with `/`. System directories (`/api/`, `/sudo/`, `/assets/`, `/uploads/`, `/fonts/`, `/staff/`) are reserved. Do not reuse a page's current or previous path for a different page: build validation rejects conflicting routes rather than silently overwriting content. Original paths remain reserved as redirects. Invalid changes do not replace the last successful production deployment; fix the path and republish.

Cloudflare Pages consumes the Hugo-generated `_redirects` file and returns real HTTP 301 redirects for both trailing-slash and slashless old paths. Source aliases may also generate fallback HTML redirects locally. The private form endpoint remains `/api/inquiries` regardless of the Contact page URL.

Verification:

```
npm test
npm run test:cms-content
node tests/page-urls.mjs
node tests/cms-url-ui.mjs
hugo --gc --minify
```

CMS UI tests use an isolated in-memory backend, not production credentials or live Git saves.
