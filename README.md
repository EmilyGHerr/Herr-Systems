# Local-only brutalist Hugo preview

Isolated workspace: /home/syzygy/herr-systems-brutalist-hugo
Content and metadata source: EmilyGHerr/Herr-Systems at 0607ced3c665ca2d4830c0660ca369192909555c.
Design reference: jules-the-ai/herr-systems-brutalist-templates.

The dev branch contains a build-only verification workflow. No deployment step, Functions/Workers, or Decap admin is installed.
All content/data YAML and Markdown are copied unchanged from the production snapshot.
Production canonical/social metadata is retained. Preview robots are intentionally noindex/nofollow.
Contact and pricing forms are disconnected; both JS and no-JS prevent submission.
Terminal is the production browser-only content navigator, not a system shell or live AI.

Build: hugo --baseURL https://herrsystems.com/
Serve: python3 -m http.server 8106 --bind 0.0.0.0 --directory /home/syzygy/herr-systems-brutalist-hugo/public

Content remains editable in Hugo frontmatter, Markdown, and data YAML. No CMS is connected.

## Verification

- 22 public pages and two route aliases retain production content and metadata.
- All 25 files under content/ and data/ are byte-identical to the production snapshot.
- The local preview intentionally overrides robots and form delivery and omits /sudo/.
- Homepage terminal uses equal columns to the right of copy above 1000px, stacks at tablet widths, and appears first at phone widths.
- Chromium: 308 page/viewport/theme checks, no overflow, JavaScript errors, external requests, or POSTs; commands/history/completion/navigation and no-JS form safety exercised.
- Focused computed-text contrast scan covers representative page types in both themes at phone/desktop widths.

QA reports: tests/test-results/brutalist-browser.json, brutalist-contrast.json, brutalist-local-verification.json.
Content/metadata verifier: tests/brutalist-local-verification.py (uses the separately built production baseline at /tmp/herr-brutalist-baseline).
Browser tools currently reuse the installed Playwright dependency from the brutalist-template workspace; no Node dependencies are needed to build or serve Hugo.

The preview server is temporary. To restart, run the Serve command above. Do not change the baseURL to the LAN URL: preserving the production baseURL keeps canonical/social/schema metadata matching production while links and alias navigation remain local-relative.

## Approved-template presentation restoration

The active shared and internal stylesheets, static/brutalist.css and static/brutalist-pages.css, are byte-identical to the approved brutalist template repository. Production legacy CSS and navigation scripts are not loaded. Header, footer and text-only mobile menu use the approved template markup; homepage services use its original glyphs, native card links and hover effects. Only the homepage billboard/terminal receives visual adaptations; minimal structural/content-image rules support Hugo data without a second theme.

Style regression: tests/brutalist-template-style-parity.mjs compares 180 computed default, hover and focus states against port 8105, in both themes. Browser matrix and content/metadata parity remain applicable. The original content/data files are unchanged.

## Dev branch publication

This redesign is published only on EmilyGHerr/Herr-Systems branch dev. Main is not changed or merged. The workflow builds and uploads a static artifact; it does not deploy. Existing hosting-provider Git integrations are managed outside this repository. Local-preview safety restrictions (noindex, no CMS, disconnected forms) remain intentional.
