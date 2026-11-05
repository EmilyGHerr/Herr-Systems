# Structured data

Every rendered content page receives one JSON-LD graph from `layouts/partials/structured-data.html`, called by the shared head. It uses the existing Hugo content and Decap settings, not separately maintained schema copy.

## Content sources

- Business name/description, public email, phone, location, and optional address: `data/settings.yml`. Phone uses the same normalization helper as the visible contact link. A blank address is omitted; a locality is not a fabricated street address.
- Logo: the same public logo asset used by the header. Business preview image follows the existing global SEO image.
- Page title: visible `hero_title`, falling back to the entry title. Intro: `subtitle`, then `lead`, description and global description. HTML is stripped, entities decoded, line breaks spaced and whitespace normalized.
- Page URL: the same canonical URL already emitted by the head. All entity references and breadcrumb destinations use Hugo-resolved public routes, so CMS URL changes carry through.
- Images: page artwork or existing social/site fallback. The detailed web-design layout uses its actual visible billboard `copy.image_path`, including its existing template fallback.
- Service entries: `Service` with title, visible intro, artwork, public URL and the shared business provider.
- Blog articles: `BlogPosting` with visible headline/intro, image, publication/modification dates and business publisher. A linked human owner can be `Person` author. AI, pet and sample profiles are never inferred to be people.
- Portfolio entries: `CreativeWork`, not invented customer/review entities or performance claims.
- Sections: `CollectionPage` (or `AboutPage`), plus `ItemList` from published entries; About lists its published profile records. Drafts stay excluded by Hugo.
- Breadcrumbs: `BreadcrumbList`, using existing public ancestors and editor-owned labels. The staff storage-only directory is excluded.
- FAQ schema: exactly the visible contact/pricing FAQ data and detailed service FAQ data, including legacy service fallbacks. Hiding or clearing FAQs removes the FAQ markup. Markdown answers use the same rendering chain as their visible accordion answers.
- The human owner's profile gets `ProfilePage` and `Person`; other profiles remain ordinary pages, preserving their honest AI/pet/sample descriptions.

## Search limitations

Schema helps crawlers understand content; it does not promise indexing, rankings, stars, or special search presentation. The site's existing robots/indexing policy is unchanged.

The graph identifies Herr Systems as `LocalBusiness` (the old generic `ProfessionalService` business type is deprecated; individual offerings use `Service`), but there is currently no published street address. Google requires a physical address for its LocalBusiness rich-result eligibility; we intentionally do not invent one or publish a private address. If an appropriate public business address is later entered in the existing settings and displayed on Contact, it will also appear in the schema.

Google FAQ rich results are generally restricted to authoritative government and health sites. FAQ markup here describes the real page content; it is not a promise of expanded FAQ results for this business.

No ratings, reviews, guaranteed prices, opening hours, social profiles, geographic coordinates, or customer relationships are fabricated. Interactive planning estimates are not Product offers.

## Verification

Run `node tests/structured-data.mjs` for generated JSON, entity links, page-type checks and isolated content-mutation coverage. It is also included in the regular test command. `node tests/verify.mjs` retains full HTML/link/CMS verification.

Validate representative live URLs in Google's Rich Results Test and Schema.org Validator after publication. A JSON parser test is not an official rich-result eligibility certification.
