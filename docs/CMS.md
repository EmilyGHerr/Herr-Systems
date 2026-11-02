# Editing Herr Systems

Open `/admin/` on the deployed site. Decap edits `EmilyGHerr/Herr-Systems`, branch `main`, using editorial-workflow pull requests.

## Authentication requires external setup

A static site cannot securely exchange a GitHub OAuth code by itself. Deploy or select a trusted Decap-compatible OAuth proxy, register a GitHub OAuth App with its exact callback URL, store its client secret only server-side, and set `backend.base_url` and optionally `backend.auth_endpoint` in `static/admin/config.yml` to that real service. Restrict allowed origins and repository access. Test login, draft PR, media upload and publishing. No proxy URL or fake authentication is supplied. Local development can use Decap local backend with its proxy; do not expose that proxy publicly.

## Content schema

Pages have plain `title` and `description`, rich-inline `hero_title` and `subtitle` (retain `<br>`/`<em>` where desired), and a `copy` map of labeled visible text, alternative text, placeholders and labels. Every extracted copy slot has a CMS field. Source classes/IDs and DOM wrappers remain in the layout fragments.

`data/settings.yml` contains contact email, optional phone/address, brand/owner, global `noindex`, and shared navigation/footer/accessibility copy. Phone and address are blank because no verified values were provided. Optional contact values only appear when populated.

Original blog posts are Markdown at `content/blog/<slug>/index.md`; newly created CMS posts use `content/blog/<slug>.md`. Create posts in Blog posts; original articles also have dedicated file editors for sidebar, author and takeaway copy. Existing articles retain original fragments; new articles use a reusable layout. Original Markdown articles wrap sections in `article-section` shortcodes to preserve source section spacing and contents-link IDs. Edit the Markdown inside these wrappers and keep IDs stable. Hugo pagination limits listing pages to ten posts total, including the featured card on page one.

Six services have native Hugo records; original directory anchor IDs remain unchanged. Web design retains the full detail layout. Other services reuse billboard/detail visual language with original directory facts. No fictional team profiles are published. The about page identifies Emily Herr without inventing a biography. Concept studies retain explicit fictional/concept disclosures and no fabricated clients/results.

`styles`, `scripts`, `body_class` and `fragment` are preserved hidden template-resource fields. Template-driven pages expose their actual copy fields rather than an ignored body editor. Blog articles and generic service pages have working Markdown bodies. The terminal index renders the current page fragments, so copy edits are reflected automatically without maintaining duplicate search prose. SEO title, description, social image and noindex controls are available on every page. New-blog and original-article collections are separated to preserve the original article layouts when editing.

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
