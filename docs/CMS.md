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

## Media gallery

The repository-backed media gallery uses `static/uploads` → `/uploads`. It now contains reusable copies of all existing site illustrations and brand images, with searchable category-prefixed names such as `services-web-design-transparent.svg`, `case-studies-maple-street-workshop.svg`, and `about-team-station.svg`. The source-to-gallery catalog is `docs/media-catalog.json`.

In an image field, choose **Choose an image**, search by filename, select a thumbnail, and click **Choose selected**. Saving the entry stores a public `/uploads/...` URL. You can also open **Media** to browse or upload. SVG and PNG images are supported; new uploads continue to use the same gallery.

The GitHub-backed built-in media library lists only the immediate media folder, so the reusable catalog is deliberately flat. Existing nested `/assets/...` URLs and images were not moved or changed. Gallery copies are independent editable media, not live mirrors: replacing a gallery file affects entries using its `/uploads/...` URL, not original hardcoded `/assets/...` artwork. Changing a source artwork later does not automatically overwrite an editor-modified gallery copy. Avoid deleting a gallery file referenced by published entries.

These images become visible in the production dashboard after the files are committed to its configured branch. Refresh Decap after deployment. The isolated browser tests verify thumbnails, searching every catalog image, selection, save/reopen and Hugo rendering, but do not authenticate to the production Turbo account or verify account-specific media permissions. The separate optional Turbo S3 media-library service is not required for these repository assets.

## Services and case studies

The sidebar has separate **Services** and **Case studies** collections. Each lists existing records and has a **＋ Service** / **＋ Case study** creation action. **Site pages** now holds only the main page editors, including the Services and Case studies directory introductions.

New entries are saved as `content/services/<slug>/index.md` or `content/case-studies/<slug>/index.md`. Keep their hidden template fields intact. Shared uploads go to `static/uploads` and use `/uploads` URLs.

- **Services:** use the standard Markdown layout for ordinary new services. Web design keeps its expanded layout; the **Use detailed service layout** switch selects which content controls are used. The detailed page-section controls are only used when that switch is on. Service directory cards have their own expandable preview group. Included items in that group are directory bullets; the standard page body is edited independently.
- **Case studies:** new studies start in **Article** format with a Markdown body. The three existing studies retain **Detailed** format and their structured project facts/story sections. The disclosure, cover caption, related-study and contact-link controls work in either format. Detailed project-fact/story controls are only used in Detailed format. Use a short **Card / project name** when the page's full headline is too long for a directory card. Identify concept work honestly; don't invent client results.
- **Ordering:** lower order numbers appear first in the directories and homepage cards.
- **Homepage cards:** use **Homepage — service card** or **Homepage — case study card**, then enable **Show on the homepage**. New entries default off; existing cards remain on. Preview title/summary overrides are optional.
- **Automatic discovery:** published records appear in the corresponding directory and terminal search without editing the directory template. Directory links open the actual detail pages. Global/per-page noindex still controls sitemap inclusion; per-page noindex also removes terminal discovery, but it does not hide a page from a public directory. A noindex switch is not access control.

Refresh the editor and reopen entries after this migration. Turbo collection-level permissions, if configured for collaborators, may need to grant the `services`, `case_studies`, `blog`, and `staff` collections.

## Editing order and field guide

Site pages are organized to follow the live page, not HTML tag names:

1. Page title / navigation name — plain text used in listings, terminal search and fallback metadata.
2. Billboard display heading and introductory text — the large visible heading and lead. Only these rich-inline fields support intentional `<em>` / `<br>` formatting.
3. Page summary — plain-text listing copy and the default search description. This is independent of the billboard introduction.
4. Page sections, top to bottom — expandable sections for nearby text, buttons, images and accessibility labels. Service cards, case-study cards, form fields, article sidebars and closing calls to action have their own groups.
5. Search engines and social sharing — collapsed by default, with separate Google/search and social link-preview groups. Blank overrides inherit page/site defaults.

Inline markup in ordinary section text is escaped. Link destinations shown in hints describe the existing template links; changing a link's text does not change its destination.

### Homepage announcement

Open **Site pages → Home → Page sections — top to bottom → Announcement / system message**.

- **Show announcement below the billboard**: off removes the entire strip from HTML and terminal search. The prefix and message stay saved.
- **Announcement prefix**: the short emphasized label, such as “★ ALERT:”.
- **Announcement message**: the text following that label.

Your saved switch is respected. A missing switch keeps the announcement visible for backwards compatibility.

### Metadata

**Google / search results** contains the search title, search description, per-page noindex switch and advanced canonical URL. Leave canonical blank unless another URL is deliberately the preferred source. Pagination keeps distinct canonical URLs.

**Link previews** contains the social image and description (alternative text), followed by optional Facebook/LinkedIn and X/Twitter text overrides. The shared default image and its alternative text live under Site-wide settings. A page-specific image needs its own meaningful description.

Page-level noindex removes that page from the sitemap and terminal index. Global noindex remains a crawler control, not a visitor-interface switch: the terminal continues working on a noindexed site. Neither option protects private data. The current global noindex setting is preserved by this CMS reorganization.

### Blog and article images

**Blog** is one creatable collection for existing and new articles. Use **＋ Article** to create a post; all posts use `content/blog/<slug>/index.md` and the same article layout. The original three articles retain their text, section shortcodes, artwork, captions, sidebar links, author and takeaway. New articles have the same optional page-section controls; their contents sidebar follows Markdown headings unless custom section links are supplied. Do not change a section heading ID without updating custom contents links.

Blog listing cards inherit the article's title, summary, image, image description, category and reading-time label. Edit those on the article, not the Blog listing page. The listing's unused legacy card slots are preserved as hidden data so they cannot mislead editors. Existing articles now use the same image and image description for the article cover and listing card; captions remain in the article-cover section.

Keep the `article-section` shortcode wrappers and their IDs when editing original article bodies: they preserve spacing and table-of-contents anchors. Future publish dates are omitted by Hugo until their date is reached.

### Staff and the About page

**Staff** lists the restored Alex Morgan, Sam Rivera, and Jordan Ellis sample profiles and supports **＋ Staff profile**. Their names, illustrated portraits, roles, biographies, skills, work approaches and example contributions come from the original static About/profile templates, not actual employee records.

Profiles keep stable CMS source paths at `content/about/team/<original-name>/index.md` but publish directly at `/about/<slug>/`. Change the optional URL slug or full page path near the Name field without moving or duplicating the source entry. Old source paths redirect to the current public URL; there is no public Staff/Team directory. See [Page URLs](PAGE-URLS.md) for page-type coverage, previous-URL redirects and homepage limitations. About now uses a branch bundle (`content/about/_index.md`) so those nested pages can be published. Its Staff cards are generated from profile records; edits to a person's name, role, portrait, summary or order flow through automatically. Legacy single-card data is retained but hidden in the editor.

- **Fictional demo profile** defaults on. Keep it on for samples; visible disclosures distinguish them from real employees. Turn it off only after replacing the record with approved details for a real person.
- The About sample disclosure is edited in **Site pages → About → Page sections — top to bottom → Team** and appears when at least one published profile is marked as a sample.
- **Biography**, **Skills**, **At a glance**, **How I work**, **What I bring to a project**, **Beyond the brief**, and a related-service link populate the shared profile design.
- **Display order** sorts cards; draft profiles have no public card or built page. Deleting/drafting a sample does not require editing the About template.
- The three original portraits are available in the image library as `about-headshot-1.svg` through `about-headshot-3.svg`. All original images remain at their existing paths as well.

The existing six service records and three case studies remain seeded. The five standard service pages have fuller illustrative scope, process and handoff copy; Web design retains its complete detailed layout. Example scopes do not claim completed client work, guarantees or current availability. Contact delivery remains gated until a real endpoint is configured and verified.

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
