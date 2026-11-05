# Editing public page content

Open /sudo/ and select a collection. Refresh the editor and reopen the entry after a CMS schema update; an already-open tab may still have the old controls.

## Site pages

Home, Services, Case studies, Pricing, Contact, About and Blog each have their own entry. The billboard display heading and introduction are separate from the page title and search/listing summary. The Page sections group is open, and each inner summary says it edits a section. Use its expand arrow to reveal that section's controls. URL overrides, old-URL redirects and search/social options follow the main content.

On About, **Our story — Useful work. Real relationships.** opens automatically. Edit **Story heading** and the single **Story** rich-text block. Write as many paragraphs as you need; use the toolbar for emphasis, links and lists, or switch to Markdown. Under **Less noise. More care.**, **Principles** is an add/remove/reorder list—there are no fixed bullet slots to fill. **Working approach steps** works the same way, with a heading and rich description for each step and automatic numbering. The team introduction, service links and closing contact section have their own groups. Billboard artwork is under **Billboard — illustration and caption**.

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

## Natural content blocks and flexible lists

Use one rich-text editor for a continuous passage, not separate fields for each paragraph. The About story, Home pricing explanation, pricing notes and detailed service overview follow this pattern. Other standalone explanatory copy supports rich text too. Short headings, buttons, image descriptions and form labels remain compact controls because they belong to distinct visible elements.

Repeated editorial content uses lists: principles, working/project steps, service fit bullets, design-option accordions, detailed-service FAQs, contact next steps, and structured case-study sequences/cards/bullets. Use Add, remove, and drag-to-reorder controls; empty lists stay empty. Numbered steps number themselves. Keep existing service-option IDs when other pages link to those anchors.

Rich Text is the normal writing mode; Markdown remains available. Clearing an intentional block/list does not restore old migration content. Older saved records still have renderer fallbacks, but do not save a stale editor tab after a schema change: refresh and reopen the entry first.

## Case studies on the homepage

Open **Case studies**, choose a study, and use **Homepage display → Show on homepage** directly below its page title. Turn it off to remove only its homepage card; the Case Studies directory and published detail page remain available. Publish the entry to apply the change. New studies start with homepage display off.

## Blog author attribution

In **Blog**, choose **Post as / author** below the title, for either a new or existing article. Search staff by name or role, select a profile, then publish. The article displays “By [name]” beneath its heading and introduction, with the name linking to the staff profile. Profile name and public URL edits are reflected automatically; no article edits are needed.

The choice is editorial attribution, not a change to the signed-in account or its permissions. Clear the selection for no personal byline. Existing posts are not assigned a person automatically. The older **Publisher / footer credit** group remains separate from the selected personal author.
