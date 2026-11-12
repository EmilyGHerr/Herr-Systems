# Herr Systems

Hugo site for `EmilyGHerr/Herr-Systems`, converted from the approved
`jules-the-ai/herr-systems-templates` layouts. The original CSS, artwork,
header, footer, responsive layouts, terminal artwork and native navigation
are reused, not redesigned.

## Build and preview

Requires Hugo Extended 0.154.5 (the CI-pinned version). The compiled styles
are committed, so deployment does not require Node or a CSS build.

```sh
hugo --gc --minify
hugo server --bind 0.0.0.0 --disableFastRender
```

For tests: `npm ci`, `npx playwright install chromium`, then `npm test`.
The verification workflow builds and uploads `public/` as an artifact; it does
not change hosting or publish to an unconfigured production destination.

## Content and CMS

Visit `/sudo/` for Decap CMS. Its GitHub backend writes to this repository's
`main` branch. Production authentication uses Decap Turbo
(see `docs/CMS.md`); its Site ID is configured in `static/sudo/config.yml`. Never put client secrets or access tokens in this repository.

Page titles, subtitles, descriptions, SEO titles/descriptions, social images
and indexability are editable. Page-specific copy and global contact details
are stored as content/data, not duplicated through HTML pages. See the CMS
documentation for the content model and collection editing.

## Homepage terminal

Hugo generates `/search-index.json` on each build from actual published pages
and service records. Individually noindexed pages and drafts are omitted. This is an
independent browser navigation index, not permission to index the site in a
search engine. Global crawler noindex does not disable this visitor-facing navigator.

Examples:

```text
herr -help
herr -services
herr -service hosting
herr -show web-design
herr -search backups
herr -open hosting
ls
cat pricing
find automation
clear
```

Native links, arrow-key history, bounded scrollback and Tab completion are
retained. The terminal runs no shell commands, calls no AI service, sends no
inquiries and persists no visitor input. Unavailable indexes show an error
instead of fabricated responses.

## Search engines

Set `noindex: true` in global settings (or `params.noindex` in `hugo.yaml`) to
emit `noindex, follow` on every page and `Disallow: /` in `robots.txt`. Set a
page's `noindex` to exclude only that page. The automatic sitemap and terminal
index omit noindex pages. `/sudo/` is always noindex and disallowed.

Robots directives are crawler hints, not access controls. A previously indexed
site may need to remain crawlable temporarily for crawlers to observe its
noindex metadata; blocking crawling alone does not remove existing results.

The production domain is `https://herrsystems.com/`, configured as `baseURL`
in `hugo.yaml`. The content editor is at `https://herrsystems.com/sudo/`.
Canonical URLs, Open Graph URLs, robots and sitemap use the configured baseURL.

## Hosting

For Cloudflare Pages Git integration: select this repository and `main`,
leave Root directory blank, build command `hugo --gc --minify`, output `public`,
and environment variable `HUGO_VERSION=0.154.5`. Use the Pages flow, not Workers
`wrangler deploy`. Add the intended custom domain through your own Cloudflare
account. No Cloudflare credentials are needed in the repository.

Contact/quote forms retain the original same-origin submission adapter. Do
not enable delivery until a real endpoint exists. The configured
contact email controls the direct-email handoff; a static site alone cannot send email. Blank
phone/address settings are intentionally omitted rather than filled with
fictional contact details. Concept studies remain labelled as concepts, not
presented as client engagements. Fictional staff profiles are not published.

## Secure form configuration

See [docs/FORMS.md](docs/FORMS.md). Set `TURNSTILE_SITE_KEY` as a public Pages
variable (or use `data/forms.yml` as a fallback). Keep `TURNSTILE_SECRET_KEY`
in Pages/Worker secrets, never in Git.
Delivery remains disabled until a real validating Worker is deployed.

The inquiry backend uses Pages Functions plus the private `herr-inquiry-mailer`
Worker through the `INQUIRY_MAILER` service binding. See
[docs/FORMS-DEPLOYMENT.md](docs/FORMS-DEPLOYMENT.md) for deployment and recipient
configuration. Website builds remain `hugo --gc --minify` with output `public`.


## Editing site menus

In `/sudo/`, open **Site-wide settings → Menus & navigation**. Each menu is an
ordered list: add a link, edit its label and destination, remove it, or drag its
handle to change its position. The collapsed row shows the label and destination.

- **Desktop header links & dropdowns:** add dropdown links inside any header item.
  A populated dropdown uses the parent label as its toggle; include a child link
  for the parent page if visitors should be able to navigate there. Clearing its
  dropdown links turns it back into a normal link with the parent's destination.
- **Mobile bottom-bar links:** optional icons; the More button remains available
  and opens the expanded menu. Large selections scroll horizontally with usable
  minimum-width links and a pinned More button. Short labels work best here.
- **Expanded menu — page links** and **Expanded menu — service links:** independently
  ordered lists in the More dialog.
- **No-JavaScript fallback links:** navigation shown when scripting is unavailable.
- **Footer links:** includes the existing return-to-top link and can contain others.

Destinations support root-relative site paths, `https://`, `http://`, `mailto:`,
`tel:`, and `#fragment` links. Internal paths follow the site's saved page URL
changes, including query strings and fragments. Unsupported schemes,
protocol-relative URLs, controls and backslashes are rejected. Clearing a list
really removes its links; old fixed links are not silently restored. Changes are
saved in `data/menus.yml`; old copy fields remain preserved but hidden, while
shared accessibility labels, dialog headings and More button text remain under
Brand, contact and shared interface copy.

Run `node tests/menus.mjs` and `node tests/menus-cms.mjs` for rendering and actual
isolated Decap add/remove/drag/edit/publish/reopen coverage. These tests never
write to the production CMS or use production authentication.
