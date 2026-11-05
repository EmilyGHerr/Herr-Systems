---
title: A clearer path from curious visitor to confident inquiry.
description: A service-led website concept for an independent furniture workshop, built around
  useful project details, thoughtful photography, and a better first conversation.
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
hero_title: A clearer path from curious visitor to confident inquiry.
lead: A service-led website concept for an independent furniture workshop, built around useful
  project details, thoughtful photography, and a better first conversation.
copy:
  breadcrumb:
    breadcrumb_aria_label: Breadcrumb
    breadcrumb_home_label: Home
    breadcrumb_separator_before: /
    breadcrumb_directory_label: Case studies
    breadcrumb_separator_after: /
    breadcrumb_current_label: Maple Street Workshop
  disclosure:
    disclosure_text: "Concept portfolio: fictional organizations and illustrative work, not commissioned
      client projects or measured business results."
  cover:
    cover_caption: Maple Street Workshop / original interface concept, shown for illustration.
  facts:
    facts_organization_label: Organization
    facts_organization: Maple Street Workshop
    facts_type_label: Type
    facts_type: Independent furniture studio
    facts_role_label: Our proposed role
    facts_role: Content strategy, website design, front-end development
    facts_status_label: Project status
    facts_status: Self-directed concept / not a live client engagement
  brief:
    brief_eyebrow: 01 // THE STARTING POINT
    brief_heading: A real-world problem, not a feature wishlist.
    brief_text: "The starting scenario is a workshop whose best work lives on social media. Prospective
      customers see beautiful furniture, but cannot easily answer practical questions: what
      commissions are accepted, how a project begins, or what information to send. The owner ends up
      answering those same questions individually."
    brief_objective_heading: The guiding objective
    brief_objective: Help a prospective customer understand the work and send a useful project inquiry.
    brief_boundary: A small team needs to update projects without maintaining a complicated application.
    brief_boundary_label: "The boundary:"
  discovery:
    discovery_eyebrow: 02 // DISCOVERY & DIRECTION
    discovery_heading: Understand the journey before drawing the screens.
    discovery_text: "The concept starts with three customer journeys: a homeowner exploring a custom
      dining table, a designer looking for a fabrication partner, and a previous customer returning
      for care advice. Each needs different details, but all should be able to find a service
      explanation and a clear next step without knowing the workshop’s internal terminology."
    discovery_direction: The proposed site separates Work, Services, Our Workshop, and Start a Project.
      Project pages explain the brief, material choices, constraints, and finished details. Service
      pages explain the commission process before asking for an inquiry. Care information sits
      outside the sales journey so returning customers do not have to start over.
    discovery_journey_label: Proposed visitor or workflow journey
    discovery_step_1: Discover the work
    discovery_step_2: Understand the service
    discovery_step_3: Prepare a brief
    discovery_step_4: Start a conversation
  decisions:
    decisions_eyebrow: 03 // DECISIONS THAT MATTER
    decisions_heading: Every detail has a job.
    decisions_decision_1_heading: Make the work the evidence
    decisions_decision_1_text: Large project images sit beside concise explanations of the problem each
      piece solves. Instead of a gallery with no context, each project tells a short story about
      use, material, and craft.
    decisions_decision_2_heading: Ask better questions, not more questions
    decisions_decision_2_text: The proposed inquiry flow asks for project type, approximate dimensions,
      timing, and contact details. Budget guidance is optional. Every field has a reason, and a
      successful submission would explain what happens next.
    decisions_decision_3_heading: Keep editing predictable
    decisions_decision_3_text: A small set of page patterns gives the owner a repeatable way to add
      projects. Titles, cover images, captions, and project facts use consistent positions rather
      than requiring a new layout for every update.
  examples:
    examples_eyebrow: 04 // THE WORK, UP CLOSE
    examples_heading: From a vague starting point to a clearer experience.
    examples_intro: This comparison describes the fictional starting scenario and the proposed design
      direction. It is not a claim about an existing client website.
    examples_before_label: STARTING SCENARIO
    examples_before_1: A gallery with little explanation of the service.
    examples_before_2: A generic “Contact us” link after a long scroll.
    examples_before_3: Key project information scattered across captions.
    examples_after_label: PROPOSED DIRECTION
    examples_after_1: Project stories connect visual detail to customer needs.
    examples_after_2: A visible “Start a project” path from each service.
    examples_after_3: A consistent brief, materials, and process summary.
    examples_detail_heading: An inquiry that starts a useful conversation
    examples_detail_text: "Instead of “Tell us more,” the example brief asks: What would you like made?
      Where will it be used? Do you have approximate dimensions? Is there a date you are working
      toward? A short note explains that a rough idea is enough for a first conversation. This
      lowers the pressure without hiding the information the workshop needs."
    examples_mobile_heading: What changes on a smaller screen?
    examples_mobile_text: Project photography moves above its supporting copy, while service details
      keep their natural reading order. The inquiry path stays easy to reach without covering the
      work. Captions and material notes remain text, not tiny labels baked into images.
  detail_image:
    detail_image_alt: Illustrative Maple Street Workshop interface concept, not a live client screenshot
    detail_image_caption: "Layout study: a project-led homepage with a specific next step. The controls
      shown are illustration, not an interactive application."
    detail_image_path: /assets/case-studies/maple-street-workshop.svg
  implementation:
    implementation_eyebrow: 05 // UNDER THE HOOD
    implementation_heading: Practical technology. Explicit boundaries.
    implementation_text: The implementation approach uses a static-first page structure and reusable
      project records. Images have explicit dimensions, responsive sources, meaningful alternative
      text, and lazy loading below the first screen. Essential navigation and project content remain
      available without JavaScript. A real inquiry form would require a separately configured
      server-side endpoint with validation, spam controls, and clear delivery monitoring; this
      concept does not pretend to submit requests.
    implementation_edge_cases_heading: The awkward cases belong in the plan.
    implementation_edge_cases_text: Long project names wrap naturally. Missing secondary photography
      does not leave an empty gallery. The inquiry confirmation and error states are part of the
      specification rather than last-minute additions. A honeypot alone would not be treated as
      sufficient protection for a live contact endpoint.
    implementation_verification_heading: Verification plan
    implementation_check_1: Review the critical journey on a small phone, tablet, and desktop.
    implementation_check_2: Check keyboard order, visible focus, contrast, and meaningful image descriptions.
    implementation_check_3: Exercise long content, missing optional fields, and invalid input states.
    implementation_check_4: Verify every route, external destination, and recovery or escalation path.
    implementation_verification_note: This is the proposed acceptance checklist for the concept, not a
      report of a commissioned production release.
  handoff:
    handoff_eyebrow: 06 // DELIVERY & OWNERSHIP
    handoff_heading: Make the next update as considered as the first.
    handoff_text: A polished launch is only part of the job. The proposed handoff explains what can be
      changed safely, what needs specialist help, and who owns the important accounts. Documentation
      should let a new maintainer understand the system without reconstructing the project from
      messages.
    handoff_deliverable_1: A page inventory and agreed content hierarchy.
    handoff_deliverable_2: Homepage, service, project, and inquiry layout specifications.
    handoff_deliverable_3: A reusable project-content checklist and image guidance.
    handoff_deliverable_4: A launch checklist covering links, metadata, form delivery, and ownership.
    handoff_sequence_heading: A sensible sequence
    handoff_phase_1_text: agree on the audience, scope, responsibilities, and acceptance criteria.
    handoff_phase_1_label: "Define:"
    handoff_phase_2_text: review structure, realistic content, and the critical interaction states.
    handoff_phase_2_label: "Prototype:"
    handoff_phase_3_text: implement the agreed patterns and record any decisions that affect maintenance.
    handoff_phase_3_label: "Build:"
    handoff_phase_4_text: work through the checklist, resolve issues, and rehearse handoff.
    handoff_phase_4_label: "Validate:"
  outcomes:
    outcomes_eyebrow: 07 // OUTCOMES WITHOUT THE GUESSWORK
    outcomes_heading: Measure what matters. Don’t invent the numbers.
    outcomes_text: For a real launch, establish a baseline for inquiry quality, service-to-contact
      journeys, and avoidable clarification emails. Review anonymized patterns rather than
      collecting unnecessary personal data. A rise in raw submissions would not, by itself, prove
      that the design helped.
    outcomes_evidence_heading: What this example demonstrates
    outcomes_evidence_text: The proposed structure, original interface illustration, content patterns,
      and implementation reasoning show how this project could be approached. No conversion uplift,
      revenue increase, saved hours, or client testimonial is claimed.
  lessons:
    lessons_eyebrow: 08 // THE TAKEAWAY
    lessons_heading: Clarity is a design feature.
    lessons_text: A portfolio should do more than show that something looks good. Give the work enough
      context that a customer can recognize their own needs in it.
  contents:
    contents_eyebrow: INSIDE THIS STUDY
    contents_return_label: ← All case studies
  navigation:
    navigation_aria_label: Case study contents
    navigation_brief: The brief
    navigation_discovery: Understanding the problem
    navigation_decisions: The design decisions
    navigation_examples: The work, up close
    navigation_implementation: Under the hood
    navigation_handoff: From build to handoff
    navigation_outcomes: What success would look like
    navigation_lessons: What this study teaches
  next:
    next_eyebrow: NEXT STUDY
    next_heading: Fieldnote Operations
    next_description: Automation + systems
    next_button_label: Explore the next study
    next_button_icon: »
    next_url: /case-studies/fieldnote-operations/
  contact:
    contact_label: Have a similar challenge? Let’s talk →
    contact_url: /contact/
body_class: services-billboard-variant service-detail-page case-page
subtitle: A service-led website concept for an independent furniture workshop, built around useful
  project details, thoughtful photography, and a better first conversation.
seo:
  search:
    title: ""
    description: ""
    noindex: false
    canonicalURL: ""
  social:
    image: ""
    imageAlt: ""
    ogTitle: ""
    ogDescription: ""
    twitterTitle: ""
    twitterDescription: ""
detail_layout: structured
image: /assets/case-studies/maple-street-workshop.svg
image_alt: Illustrative Maple Street Workshop interface concept, not a live client screenshot
listing_title: Maple Street Workshop
category: Web design + development
weight: 10
listing:
  title: Maple Street Workshop
  description: A service-led website concept for an independent furniture workshop, built around
    useful project details, thoughtful photography, and a better first conversation.
  aria_label: Read the Maple Street Workshop case study
  link_text: Explore the study →
homepage:
  show: true
  title: Maple Street Workshop
  description: A service-led website concept for an independent furniture workshop, built around
    useful project details, thoughtful photography, and a better first conversation.
  aria_label: Read the Maple Street Workshop case study
  link_text: Explore the study →
---
