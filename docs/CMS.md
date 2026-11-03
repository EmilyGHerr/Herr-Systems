# Editing Herr Systems

Open `/sudo/` on the deployed site. Decap edits `EmilyGHerr/Herr-Systems`, branch `main`, using editorial-workflow pull requests.

## Decap Turbo setup

This editor loads Decap CMS 3.17.0, which supports the Turbo backend.

In your Turbo organization:

1. Under Git connection, install the Turbo GitHub App for `EmilyGHerr/Herr-Systems` only.
2. Create or open the site with repository `EmilyGHerr/Herr-Systems`, branch `main`.
3. Set Config path to `static/sudo/config.yml` (a repository path, not the public URL).
4. Set the primary Admin interface URL to your deployed site's `https://herrsystems.com/sudo/`. Use the actual deployment origin; add staging origins separately if needed.
5. Copy the Site ID UUID from the site's Overview tab.
6. Replace the existing `backend` block in `static/sudo/config.yml` with:

```yaml
backend:
  name: turbo-github
  turbo_site_id: a9aed266-1523-4548-b632-3cda0ddf7d55
  branch: main
```

The Site ID is public configuration, not a password. Never add account passwords or API keys. The backend is configured for this site ID. Turbo takes the repository from its dashboard, not a local `repo` setting.

After deploying, open `/sudo/`, choose Login with Turbo, and verify a draft, media upload, and publish. Authentication and publishing remain unverified until that real-account check succeeds. The custom route and noindex directive are not access controls.

## Editing order and field guide

Pages and services are organized to follow the live page, not HTML tag names:

1. Page title / navigation name — plain text used in listings, terminal search and fallback metadata.
2. Billboard display heading and introductory text — the large visible heading and lead. Only these rich-inline fields support intentional `<em>` / `<br>` formatting.
3. Page summary — plain-text listing copy and the default search description. This is independent of the billboard introduction.
4. Page sections, top to bottom — expandable sections for nearby text, buttons, images and accessibility labels. Service cards, case-study cards, form fields, article sidebars and closing calls to action have their own groups.
5. Search engines and social sharing — collapsed by default, with separate Google/search and social link-preview groups. Blank overrides inherit page/site defaults.

Inline markup in ordinary section text is escaped. Link destinations shown in hints describe the existing template links; changing a link's text does not change its destination.

### Homepage announcement

Open **Pages and services → Home → Page sections — top to bottom → Announcement / system message**.

- **Show announcement below the billboard**: off removes the entire strip from HTML and terminal search. The prefix and message stay saved.
- **Announcement prefix**: the short emphasized label, such as “★ ALERT:”.
- **Announcement message**: the text following that label.

The switch is on initially to preserve the current design. A missing switch also keeps the announcement visible for backwards compatibility.

### Metadata

**Google / search results** contains the search title, search description, per-page noindex switch and advanced canonical URL. Leave canonical blank unless another URL is deliberately the preferred source. Pagination keeps distinct canonical URLs.

**Link previews** contains the social image and description (alternative text), followed by optional Facebook/LinkedIn and X/Twitter text overrides. The shared default image and its alternative text live under Site-wide settings. A page-specific image needs its own meaningful description.

Page-level noindex removes that page from the sitemap and terminal index. Global noindex remains a crawler control, not a visitor-interface switch: the terminal continues working on a noindexed site. Neither option protects private data. The current global noindex setting is preserved by this CMS reorganization.

### Blog and article images

**Blog — existing articles** edits the original leaf-bundle articles and their sidebar/author/takeaway copy. **Blog — new articles** creates flat Markdown files in `content/blog/`. New articles use the generic article template.

Blog listing cards inherit the article's title, summary, image, image description, category and reading-time label. Edit those on the article, not the Blog listing page. The listing's unused legacy card slots are preserved as hidden data so they cannot mislead editors. Existing articles now use the same image and image description for the article cover and listing card; captions remain in the article-cover section.

Keep the `article-section` shortcode wrappers and their IDs when editing original article bodies: they preserve spacing and table-of-contents anchors. Future publish dates are omitted by Hugo until their date is reached.

### Shared settings and preserved technical fields

Site-wide settings keep brand/author, default metadata, contact fields and crawlability together, followed by header, desktop/mobile navigation, expanded-menu and footer groups. Optional phone/address remain blank when not supplied. The configured email controls both visible email text and email links.

The site configuration editor exposes production URL, site title and language. Resource fields (`styles`, `scripts`, `body_class`, `fragment`, and legacy `lead`) remain hidden and preserved. Do not move or rename grouped YAML keys manually; they are wired into the templates. A compatibility helper continues to render older flat copy and metadata records.

All original copy values and inline body content were retained during migration. The verification suite exercises a CMS edit in every visible section group, rebuilds, and checks that it reaches HTML. It also checks metadata inheritance, explicit noindex, announcement states and preservation of unrelated page content. `npm run test:cms-ui` additionally runs the actual Decap editor with an isolated test backend; it never changes the production Turbo backend or verifies production login.

Contact and quote forms retain disabled delivery and honest email fallback until a real endpoint is configured and verified. Calculator figures are planning estimates, not binding quotes.

The site configuration editor exposes the production `baseURL`, site title and
language while preserving the remaining build settings. Changing the URL updates
canonical links, sitemap and robots URLs on the next build. Page SEO fields also
allow optional canonical, Open Graph and Twitter title/description overrides and
social-image alt text; blank overrides inherit the page's SEO values. Global
brand is the metadata site identity; stylized header/footer words remain separate
editable display-copy fields so their original typography can be preserved.

Global noindex is a crawler control, not a visitor-interface switch: the terminal
continues working on noindexed/staging sites. Individually noindexed pages are
omitted from terminal discovery as well as the sitemap. Neither option protects
private data; do not publish confidential content in a static site.
