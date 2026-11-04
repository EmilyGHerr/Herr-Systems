# Editing public page content

Open /sudo/ and select a collection. Refresh the editor and reopen the entry after a CMS schema update; an already-open tab may still have the old controls.

## Site pages

Home, Services, Case studies, Pricing, Contact, About and Blog each have their own entry. The billboard display heading and introduction are separate from the page title and search/listing summary. The Page sections group is open, and each inner summary says it edits a section. Use its expand arrow to reveal that section's controls. URL overrides, old-URL redirects and search/social options follow the main content.

On About, **Our story — Useful work. Real relationships.** opens automatically. Edit **Story heading**, **Opening paragraph**, **Design and development paragraph**, and **How we start paragraph**. The sidebar principles, team introduction, working approach, service links and closing contact section have their own groups. Billboard artwork is under **Billboard — illustration and caption**.

## Content shown in cards

- Service details and service cards: **Services**. The detailed layout has its own grouped content and illustration; the standard layout uses its Markdown body and standard illustration.
- Case-study articles and cards: **Case studies**. Article format uses the Markdown study body; Detailed format uses its story groups.
- Blog articles and listing cards: **Blog**. Edit the article's title, summary, image, and main body there.
- Names, biographies, roles, portraits, skills, approach and facts: **Staff**. Those records also populate About's team directory. A blank fact is omitted rather than showing an empty label.

## Shared interface wording

Under **Site-wide settings → Brand, contact and shared interface copy**, the **Staff pages — headings, invitations and profile links** group controls common profile headings, invitation text/buttons and About's profile-link label. The biography heading supports {name} as a first-name placeholder. Other settings groups control navigation, footer and shared site labels.

Legacy hidden example-card fields are retained only for compatibility; use the corresponding real collection instead. System-generated numbering, UI icons and conditional demo-status disclosures are not ordinary editorial copy.

## Verification

npm run test:cms-pages audits source-page ownership, checks image bindings and fallbacks, opens the real pinned Decap editor with an isolated in-memory backend, edits content on every Site pages entry, saves/reopens it, and rebuilds the exact saved records. It also checks shared staff labels. It never logs into production or publishes test wording to GitHub. npm test includes this regression gate plus the complete existing suite.
