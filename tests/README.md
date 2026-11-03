# Independent conversion checks

From the repository root:

```sh
npm ci
npm run test:install           # Chromium only; Linux CI may need: npx playwright install --with-deps chromium
npm test                       # Hugo, output crawl, CMS, fixtures and browser interactions
npm run test:visual            # 20 source/Hugo screenshot comparisons
npm run test:all               # both (stops if functional checks fail)
```

Requirements: Node 20.19+ (Node 22.12+ or 24 recommended), Hugo (resolved on `PATH`, override with `HUGO_BIN`) and Chromium host dependencies. No credentials or running dev server required. Tests build into an OS temporary directory; their own HTTP servers use random loopback ports and close in `finally`. Nothing modifies repository content, settings or generated `public/`. Pagination/noindex fixtures copy the project excluding Git, dependencies, output and tests, retain original posts, and add enough fixture posts to cross the ten-post boundary.

`npm test` checks:
- Build, all generated local links/assets/fragments, page metadata, and common demo-facing copy patterns.
- Six service records against content files, terminal index and sitemap; robots sitemap declaration.
- Decap YAML parse, required title/subtitle/description/SEO/noindex fields for each editable content entry, plus editable global contacts/noindex.
- Ten unique post destinations on the first blog page and a populated second page; per-page noindex and both global switches (`params.noindex` and `data/settings.yml`), including meta, sitemap exclusion and robots disallow, while global crawler noindex keeps the visitor terminal working.
- Real terminal help/services/service/search/ls/cat, history draft restoration and actual navigation.
- Mobile widths 320/390/720: terminal before copy, compact height, contained input, overflow; theme toggle, dialog Escape and real link navigation.
- Pricing changes, disabled inactive controls, valid contact/quote submission with zero POST requests and honest unavailable state; uncaught browser errors.

## Visual comparisons

`SOURCE_DIST` selects the approved built template; default is sibling `../herr-systems-template-source/dist`. Missing source is an explicit blocker, not silently skipped. Five routes (home, services, web design, contact, blog) × desktop/mobile × dark/light produce **40 full-page screenshots, 20 pixel diffs**, browser geometry/style snapshots and an HTML comparison gallery.

Outputs are ignored under `tests/test-results/`:
- `verification.json` — each functional check, error stack and timing
- `hugo-build.txt` — actual build log
- `visual/index.html` — side-by-side source/Hugo/diff gallery
- `visual/report.json` — sizes, changed-pixel ratios, geometry and status

Pixelmatch ignores antialiasing differences. `MAX_VISUAL_DIFF` is an explicit review threshold (default `0.15`); `REVIEW` or missing routes exit nonzero. Full-page comparisons deliberately do **not** auto-update baselines or claim exact fidelity: intentional demo-copy/sidebar removals can shorten pages substantially. Review the gallery to distinguish requested deletions from layout regressions; raising a threshold is not visual approval. Dynamic content changes may also legitimately affect pixels. Screenshots contain no submitted user data.

Tests are independent from implementation code: selectors target existing semantic components; expected service destinations come from content rather than hard-coded service titles. The demo-copy scan is a regression guard, not proof of all prose quality or factual claims. No mail backend, OAuth login, publishing, or network delivery is simulated as real.

Contact visual comparisons retain untouched `source-raw.png` screenshots, then
normalize only the deliberately removed fictional phone row/note and the preview
delivery notice before comparing layout. No source files or baseline images are
modified; all other comparisons use the unmodified original build.


## Grouped Decap editor

`npm test` includes isolated content-save/rebuild checks for every visible CMS section group, grouped metadata and inheritance, announcement visibility, and article-image bindings. It respects production global noindex and uses isolated fixtures for indexable-page assertions.

Run `npm run test:cms-ui` to fetch the pinned Decap distribution and exercise the actual Home editor in Chromium using an intercepted `test-repo` backend. This validates the schema/UI, not real Turbo login or publishing. It produces `tests/test-results/cms-home-editor.png` and never modifies production backend configuration.

For a CMS-only migration, compare against a clean pre-change Hugo build rather than the older template source: `SOURCE_DIST=/tmp/herr-cms-before MAX_VISUAL_DIFF=0 npm run test:visual`. This exercises desktop/mobile and dark/light variants without accepting incidental design drift.


## Creatable service and case-study collections

`tests/cms-entries.mjs` resolves folder editors against concrete Markdown records and collection filters. `tests/collections.mjs` creates isolated bundle records using the CMS field defaults, then verifies their detail routes, directory cards, homepage opt-in, terminal discovery, sitemap inclusion and draft exclusion. The actual editor UI smoke test also opens both sidebar collections and their new-entry forms.

Directory preview controls are owned by each item, not duplicated in Site pages. Archived directory/homepage card copy remains hidden compatibility data. Existing detailed service/case layouts are preserved; new records start in standard service / article study format.


## Media gallery

`npm run test:cms-media` exercises the actual Decap distribution against an isolated in-memory backend seeded with the repository's real gallery image bytes. It searches all catalog images, checks decoded thumbnails, selects an image in the actual Services editor, saves and reopens the bundle entry, and rebuilds the serialized content with Hugo to verify the public image URL. It never authenticates to Turbo or writes to the real repository. `npm test` also validates catalog coverage, flat discoverability, collection folder overrides and built public assets.
