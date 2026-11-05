---
title: An inquiry workflow with fewer handoffs and clearer ownership.
description: "A human-reviewed intake concept for a small service business:
  collect the right context, prepare a useful draft, and keep the final decision
  with a person."
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
hero_title: An inquiry workflow with fewer handoffs and clearer ownership.
lead: "A human-reviewed intake concept for a small service business: collect the
  right context, prepare a useful draft, and keep the final decision with a
  person."
copy:
  breadcrumb:
    breadcrumb_aria_label: Breadcrumb
    breadcrumb_home_label: Home
    breadcrumb_separator_before: /
    breadcrumb_directory_label: Case studies
    breadcrumb_separator_after: /
    breadcrumb_current_label: Fieldnote Operations
  disclosure:
    disclosure_text: "Concept portfolio: fictional organizations and illustrative
      work, not commissioned client projects or measured business results."
  cover:
    cover_caption: Fieldnote Operations / original interface concept, shown for illustration.
  facts:
    facts_items:
      - label: Organization
        text: Fieldnote Operations
      - label: Type
        text: Small service team
      - label: Our proposed role
        text: Workflow mapping, intake design, human-reviewed automation
      - label: Project status
        text: Self-directed concept / not a live client engagement
  brief:
    brief_eyebrow: 01 // THE STARTING POINT
    brief_heading: A real-world problem, not a feature wishlist.
    brief_objective_heading: The guiding objective
    brief_body: "In this fictional scenario, requests arrive through several
      channels and the team copies information between an inbox, notes, and a
      task board\\. The pain is not simply typing\\. It is unclear ownership:
      nobody knows whether a request has been checked, assigned, or answered\\.
      Automating that confusion would only make it move faster\\."
    brief_objective_body: >-
      Turn an incoming request into an organized, reviewable next step\.


      **The boundary:** No autonomous sending, quoting, or changes to customer
      records\.
  discovery:
    discovery_eyebrow: 02 // DISCOVERY & DIRECTION
    discovery_heading: Understand the journey before drawing the screens.
    discovery_journey_label: Proposed visitor or workflow journey
    discovery_body: >-
      The proposed discovery follows a request from arrival to response\. It
      identifies the minimum information needed, the person responsible for each
      decision, and the places where the team currently has to interpret missing
      context\. Routine routing is separated from decisions that affect pricing,
      promises, or customer relationships\.


      The proposed workflow has four explicit states: Received, Needs Context,
      Ready for Review, and Approved\. Each request has a source reference and
      an owner\. Automation can prepare a summary and suggested response, but a
      reviewer decides whether it is accurate and appropriate before anything
      leaves the system\.
    discovery_journey:
      - text: Receive a request
      - text: Check context
      - text: Review the draft
      - text: Approve the next step
  decisions:
    decisions_eyebrow: 03 // DECISIONS THAT MATTER
    decisions_heading: Every detail has a job.
    decisions_items:
      - heading: Use a bounded first workflow
        body: The first version handles only a defined request type\. Unknown requests
          go to manual triage rather than being forced into the nearest
          category\.
      - heading: Make review meaningful
        body: The review screen shows the source message beside the summary and draft\.
          A person can edit, reject, or request more context instead of
          approving a black box\.
      - heading: Build a stop button into the process
        body: The automation can be paused without losing the incoming request\. Manual
          handling remains a supported path, not a failure state\.
  examples:
    examples_eyebrow: 04 // THE WORK, UP CLOSE
    examples_heading: From a vague starting point to a clearer experience.
    examples_before_label: STARTING SCENARIO
    examples_after_label: PROPOSED DIRECTION
    examples_detail_heading: A reviewable draft, not an autonomous promise
    examples_mobile_heading: What changes on a smaller screen?
    examples_body: This comparison describes the fictional starting scenario and the
      proposed design direction\. It is not a claim about an existing client
      website\.
    examples_detail_body: "An example request says: “We need help updating the
      booking page before an event\\.” The draft summary records the affected
      page, desired change, and event date if supplied\\. If the date is
      missing, it is flagged—not guessed\\. A suggested response asks for the
      missing context and avoids inventing a price, delivery date, or confirmed
      scope\\."
    examples_mobile_body: Queue columns become a single ordered list\. Status and
      ownership stay next to the request title\. The reviewer opens one record
      at a time, keeping the original message and draft together rather than
      squeezing two unreadable panels onto a phone\.
    examples_before_items:
      - text: Requests copied into different personal notes\.
      - text: A draft can be mistaken for a sent response\.
      - text: Missing context is discovered late\.
    examples_after_items:
      - text: One request record with an owner and source link\.
      - text: Draft, approved, and sent are distinct states\.
      - text: Missing information routes to a visible review queue\.
  detail_image:
    detail_image_alt: Illustrative Fieldnote Operations interface concept, not a
      live client screenshot
    detail_image_caption: "Layout study: a visible review queue with distinct
      states. The controls shown are illustration, not an interactive
      application."
    detail_image_path: /assets/case-studies/fieldnote-operations.svg
  implementation:
    implementation_eyebrow: 05 // UNDER THE HOOD
    implementation_heading: Practical technology. Explicit boundaries.
    implementation_edge_cases_heading: The awkward cases belong in the plan.
    implementation_verification_heading: Verification plan
    implementation_body: The design specifies a durable queue, idempotency keys for
      duplicate events, structured output validation, and a separate approval
      record\. Access is limited to the minimum required source data\. Any
      eventual send action must check that the current draft version was
      approved, so editing a previously approved draft invalidates its
      approval\. This page documents a concept; no live mailbox or third\-party
      automation is connected\.
    implementation_edge_cases_body: Duplicate events should resolve to the existing
      request\. Unrecognized attachments are held for review rather than
      automatically executed or interpreted as trusted instructions\. Provider
      timeouts move work into a retryable state with a visible error\. Customer
      text is treated as untrusted input, not permission to change the workflow
      or access other records\.
    implementation_verification_body: This is the proposed acceptance checklist for
      the concept, not a report of a commissioned production release\.
    implementation_checks:
      - text: Review the critical journey on a small phone, tablet, and desktop\.
      - text: Check keyboard order, visible focus, contrast, and meaningful image
          descriptions\.
      - text: Exercise long content, missing optional fields, and invalid input states\.
      - text: Verify every route, external destination, and recovery or escalation
          path\.
  handoff:
    handoff_eyebrow: 06 // DELIVERY & OWNERSHIP
    handoff_heading: Make the next update as considered as the first.
    handoff_sequence_heading: A sensible sequence
    handoff_body: A polished launch is only part of the job\. The proposed handoff
      explains what can be changed safely, what needs specialist help, and who
      owns the important accounts\. Documentation should let a new maintainer
      understand the system without reconstructing the project from messages\.
    handoff_deliverables:
      - text: Workflow and ownership map with approved boundaries\.
      - text: Request schema, review states, and example drafts\.
      - text: Test fixtures for missing, duplicated, and unexpected inputs\.
      - text: Pause, retry, escalation, and access\-revocation procedures\.
    handoff_phases:
      - label: "Define:"
        text: agree on the audience, scope, responsibilities, and acceptance criteria\.
      - label: "Prototype:"
        text: review structure, realistic content, and the critical interaction states\.
      - label: "Build:"
        text: implement the agreed patterns and record any decisions that affect
          maintenance\.
      - label: "Validate:"
        text: work through the checklist, resolve issues, and rehearse handoff\.
  outcomes:
    outcomes_eyebrow: 07 // OUTCOMES WITHOUT THE GUESSWORK
    outcomes_heading: Measure what matters. Don’t invent the numbers.
    outcomes_evidence_heading: What this example demonstrates
    outcomes_body: A real pilot would compare time spent reviewing drafts against
      manual handling, track correction rates, and check whether requests are
      consistently assigned\. The evaluation should count rework and supervision
      time rather than reporting only how many drafts were generated\.
    outcomes_evidence_body: The proposed structure, original interface illustration,
      content patterns, and implementation reasoning show how this project could
      be approached\. No conversion uplift, revenue increase, saved hours, or
      client testimonial is claimed\.
  lessons:
    lessons_eyebrow: 08 // THE TAKEAWAY
    lessons_heading: A good system keeps people in control.
    lessons_body: Useful automation makes responsibility clearer\. A shorter
      workflow is not an improvement if nobody can tell what happened or who
      approved it\.
  contents:
    contents_eyebrow: INSIDE THIS STUDY
    contents_return_label: ← All case studies
  navigation:
    navigation_aria_label: Case study contents
    navigation_items:
      - id: brief
        label: The brief
      - id: discovery
        label: Understanding the problem
      - id: decisions
        label: The design decisions
      - id: examples
        label: The work, up close
      - id: implementation
        label: Under the hood
      - id: handoff
        label: From build to handoff
      - id: outcomes
        label: What success would look like
      - id: lessons
        label: What this study teaches
  next:
    next_eyebrow: NEXT STUDY
    next_heading: Northline Community
    next_button_label: Explore the next study
    next_button_icon: »
    next_url: /case-studies/northline-community/
    next_body: Web development \+ hosting
  contact:
    contact_label: Have a similar challenge? Let’s talk →
    contact_url: /contact/
body_class: services-billboard-variant service-detail-page case-page
subtitle: "A human-reviewed intake concept for a small service business: collect
  the right context, prepare a useful draft, and keep the final decision with a
  person."
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
image: /assets/case-studies/fieldnote-operations.svg
image_alt: Illustrative Fieldnote Operations interface concept, not a live
  client screenshot
listing_title: Fieldnote Operations
category: Automation + systems
weight: 20
listing:
  title: Fieldnote Operations
  description: "A human-reviewed intake concept for a small service business:
    collect the right context, prepare a useful draft, and keep the final
    decision with a person."
  aria_label: Read the Fieldnote Operations case study
  link_text: Explore the study →
homepage:
  show: true
  title: Fieldnote Operations
  description: "A human-reviewed intake concept for a small service business:
    collect the right context, prepare a useful draft, and keep the final
    decision with a person."
  aria_label: Read the Fieldnote Operations case study
  link_text: Explore the study →
editor_content_version: 1
---
