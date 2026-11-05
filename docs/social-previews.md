# Social share previews

OpenGraph and Twitter/X large-image cards share the default terminal artwork at
`/assets/social/herr-systems-terminal.png` (1200 × 630 PNG). The image reuses the
homepage terminal ASCII logo and wordmark, with no interactive controls.

Regenerate after terminal artwork/style changes:

```sh
npm ci
npx playwright install chromium
npm run generate:social
npm run test:social
```

Commit the generated image, its flat `/uploads/` gallery copy, and the updated
media catalog. Generation is an authoring step; production Hugo builds do not
require a browser. The default image and alt text remain editable in global CMS
settings; existing page-specific Social previews overrides take precedence.
Local raster images get their real dimensions in OpenGraph tags. External images
and SVG overrides remain supported without raster-dimension probing.

Sharing services cache metadata and images independently. Existing shares may
need a re-scrape or time to refresh after publication.
