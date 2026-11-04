---
draft: false
title: Burn.Blue — a website with an AI-assisted publishing workflow
hero_title: Burn.Blue<br /> Agentic Web
subtitle: A Hugo website paired with Jules, running on Hermes Agent, to turn a
  content brief into a researched article, a versioned update, and a verified
  Cloudflare deployment.
description: How Burn.Blue combines a Hugo website, Jules on Hermes Agent,
  GitHub Actions, and Cloudflare Pages to automate the practical work of
  researching, publishing, and checking blog posts.
listing_title: Burn.Blue
category: Web design + AI-assisted publishing
weight: 6
image: /uploads/burn-blue-homepage.jpg
image_alt: Burn.Blue’s live homepage, with its blue flame branding, website and
  workflow headline, and example lead-response workflow.
detail_layout: article
copy:
  breadcrumb:
    breadcrumb_current_label: Burn.Blue
  disclosure:
    disclosure_text: "Live project: Emily Herr’s own web and automation studio,
      developed and maintained with Jules, an AI assistant running on Hermes
      Agent. Not a commissioned client engagement."
  cover:
    cover_caption: Burn.Blue / the live homepage, captured November 2026.
  next:
    next_eyebrow: ANOTHER LIVE PROJECT
    next_heading: Septagon
    next_description: Custom Angular and Laravel community development
    next_button_label: Explore the Septagon study
    next_button_icon: »
    next_url: /case-studies/septagon/
  contact:
    contact_label: Want a website and a publishing workflow that work together? Let’s talk →
    contact_url: /contact/
lead: A Hugo website paired with Jules, running on Hermes Agent, to turn a
  content brief into a researched article, a versioned update, and a verified
  Cloudflare deployment.
styles:
  - /retro3.css
  - /services.css
  - /services-billboard.css
  - /service-detail.css
  - /case-studies.css
  - /interactions.css
  - /navigation.css
scripts:
  - /navigation.js
  - /retro3.js
fragment: pages/case-study.html
body_class: services-billboard-variant service-detail-page case-page
listing:
  title: Burn.Blue
  description: A live services website with a repeatable Jules / Hermes workflow
    for researching, writing, building, publishing, and verifying blog content.
  aria_label: Read the Burn.Blue case study
  link_text: Explore the study →
homepage:
  show: true
  title: Burn.Blue
  description: A live services website with a repeatable Jules / Hermes workflow
    for researching, writing, building, publishing, and verifying blog content.
  aria_label: Read the Burn.Blue case study
  link_text: Explore the study →
seo:
  search:
    title: Burn.Blue Case Study | Jules & Hermes Publishing Automation | Herr Systems
    description: "Inside Burn.Blue’s Hugo website and Jules / Hermes publishing
      workflow: research, Markdown, Git, GitHub Actions, Cloudflare Pages, and
      live verification."
    noindex: false
    canonicalURL: ""
  social:
    image: /uploads/burn-blue-homepage.jpg
    imageAlt: Burn.Blue’s live homepage, with its blue flame branding, website and
      workflow headline, and example lead-response workflow.
    ogTitle: "Burn.Blue: a useful website and a repeatable publishing system"
    ogDescription: How Burn.Blue combines a Hugo website, Jules on Hermes Agent,
      GitHub Actions, and Cloudflare Pages to automate the practical work of
      researching, publishing, and checking blog posts.
    twitterTitle: "Burn.Blue: AI-assisted publishing with Jules and Hermes"
    twitterDescription: How Burn.Blue combines a Hugo website, Jules on Hermes
      Agent, GitHub Actions, and Cloudflare Pages to automate the practical work
      of researching, publishing, and checking blog posts.
---

## The project at a glance

- **Project:** [Burn.Blue](https://burn.blue/), Emily Herr’s web design, AI assistant setup, and business automation studio.
- **Work:** Website design and development, service and location content, and an AI-assisted blog publishing workflow.
- **Website:** Hugo, Markdown content, reusable layouts, and Cloudflare Pages hosting.
- **Automation:** Jules running on Hermes Agent, connected to research, file, terminal, browser, and Git tooling; GitHub Actions handles production builds and deployment.
- **Status:** Live. Content publishing is initiated by a brief or request, not an active unattended daily posting schedule.

## The brief: make the website and the work behind it useful

Burn.Blue needs to explain a broad set of services without turning into a wall of technical jargon. A prospective customer should be able to understand the offer, find a relevant service or location page, and know how to start a conversation.

It also needs useful content over time. Writing a blog post is only one part of publishing: someone still has to research the topic, format the article, add the right links and metadata, build the site, deploy it, and check the live result. The project brings those steps into one repeatable workflow rather than treating every post as a fresh manual procedure.

## The website: clear services, connected content

The public site combines a recognizable blue identity with service pages, a location directory, a blog, and direct contact paths. The homepage leads with the business offer and gives visitors routes into specific services, recent articles, and a project conversation.

Hugo turns source content and reusable templates into static pages. The same article record supplies its detail page and the summaries used in the blog and recent-post listings. Titles, descriptions, publication dates, categories, and links live alongside the writing instead of being re-entered on several screens.

The blog supports dated articles, pagination, feeds, and a sitemap. Service and location pages give those articles somewhere useful to point: content about website maintenance, for example, can connect the reader to a relevant service instead of ending at a generic sales pitch.

## Jules and Hermes: who does what?

**Jules is the AI assistant; Hermes Agent is the software Jules runs on.** Hermes provides access to the tools used to research, edit files, run builds, work with Git, and inspect pages in a browser. Saved skills capture the repeatable publishing procedure, while the current brief supplies the topic, scope, and editorial direction.

That makes this more than a text generator attached to a website. Jules can carry a task through the surrounding production work: read the existing site, prepare an article in the correct format, execute a real build, inspect its output, and check a deployment.

The assistant operates outside the public website. A visitor does not need to interact with Jules to read an article, and loading a page does not start an AI session. The published result is ordinary HTML, CSS, JavaScript, and media served by Cloudflare Pages.

## System overview: from brief to live post

1. **Emily supplies the brief.** A request defines a topic or delegates topic selection within Burn.Blue’s services and audience. The brief gives the assistant a defined task and a clear editorial starting point.
2. **Jules researches through Hermes.** The assistant reviews existing content, checks relevant sources, and develops an article that fits the site. Reusable skills describe source checks, content conventions, and publication verification.
3. **The article becomes a source file.** Jules writes Markdown with Hugo front matter: title, publication date, summary, search metadata, and topic tags. Internal links connect the article to useful services and related content. Media is added when the brief calls for it.
4. **Local checks precede the push.** Jules runs Hugo and inspects the generated page and the listing surfaces that should include it. Git records the intended source changes, providing a reviewable history rather than an invisible edit to production.
5. **GitHub Actions builds and deploys.** A push to the production branch triggers the deployment workflow. It checks out the repository, installs the pinned Hugo version, builds the site, checks essential generated output, and uses Wrangler to publish to Cloudflare Pages.
6. **Jules checks the live result.** The workflow is not considered finished at a successful push. The assistant checks deployment status and verifies the article on the public site, along with relevant listings and assets. If a check fails, the next step is diagnosis and correction before reporting the task complete.

**The short version:** brief → Jules on Hermes → Markdown and Git → GitHub Actions and Hugo → Cloudflare Pages → live checks.

Each component has a distinct job. Jules handles the context-dependent research and editing; Hermes supplies the tool-using environment; Git keeps the source history; GitHub Actions performs the repeatable build and deploy steps; Cloudflare serves the result.

## Automating the routine without surrendering editorial control

The useful automation is the connection between steps. Emily can request a new article and delegate the surrounding file editing, build commands, publishing, and verification instead of copying text between tools herself. Editorial direction remains with Emily, who can narrow the brief, request changes, or change the workflow.

That is not the same as requiring a separate human approval click for every post. Publication can be delegated within an agreed request. It also does not make AI-generated copy automatically correct: source checks and build checks help with different risks, and neither proves every statement is accurate.

Hermes also [supports scheduled tasks](https://hermes-agent.nousresearch.com/docs/user-guide/features/cron), including tasks that load reusable skills. Scheduling is a possible extension of this architecture, not a claim that Burn.Blue currently has an active scheduled blog publisher. This case study covers website articles, not automated social-network posting.

## Small, inspectable pieces instead of a black box

Content lives in source files, presentation lives in templates, and the deployment procedure lives in a versioned workflow. Changes can be inspected in Git, and corrections can move through the same build-and-deploy path as a new article.

Deployment credentials belong in the delivery platform’s secret storage, not in article text or browser-delivered files. The public site does not need access to the assistant’s private conversations, memory, or machine configuration. This separation keeps the publishing system understandable without exposing its private operating details.

## The result: a working publishing path

The evidence is the live website, its published articles, and successful production deployment runs. For a concrete example, the [AI-friendly website checklist](https://burn.blue/blog/ai-friendly-small-business-website-checklist/) connects researched guidance, source links, structured article metadata, and relevant service links in a published page.

The outcome is a repeatable route from an idea to checked, public content—not a promise of search rankings, revenue growth, or maintenance-free autonomous operation. The same system can support a new article, a service-page correction, or a content refresh without rebuilding the process each time.

## The takeaway

AI becomes more useful when it can help finish the work around the draft. Burn.Blue pairs a straightforward website architecture with a tool-using assistant and an automated delivery pipeline, while keeping ownership and editorial decisions clear.

For Herr Systems, it demonstrates how web development and practical AI automation can work together: not a chatbot added for decoration, but a publishing system with clear inputs, visible source changes, and a live result that can be checked.
