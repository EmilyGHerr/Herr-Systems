---
title: An inquiry workflow with fewer handoffs and clearer ownership.
description: 'A human-reviewed intake concept for a small service business: collect the right context, prepare a
  useful draft, and keep the final decision with a person.'
noindex: false
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
fragment: pages/case-studies-fieldnote-operations.html
hero_title: An inquiry workflow with fewer handoffs and clearer ownership.
lead: 'A human-reviewed intake concept for a small service business: collect the right context, prepare a useful
  draft, and keep the final decision with a person.'
copy:
  a_120: Home
  span_81: /
  a_121: Case studies
  span_82: /
  span_83: Fieldnote Operations
  case_disclosure_4: 'Concept portfolio: fictional organizations and illustrative work, not commissioned client
    projects or measured business results.'
  figcaption_16: Fieldnote Operations / original interface concept, shown for illustration.
  dt_9: Organization
  dd_9: Fieldnote Operations
  dt_10: Type
  dd_10: Small service team
  dt_11: Our proposed role
  dd_11: Workflow mapping, intake design, human-reviewed automation
  dt_12: Project status
  dd_12: Self-directed concept / not a live client engagement
  kicker_45: 01 // THE STARTING POINT
  h2_24: A real-world problem, not a feature wishlist.
  p_104: 'In this fictional scenario, requests arrive through several channels and the team copies information between
    an inbox, notes, and a task board. The pain is not simply typing. It is unclear ownership: nobody knows whether
    a request has been checked, assigned, or answered. Automating that confusion would only make it move faster.'
  h3_36: The guiding objective
  p_105: Turn an incoming request into an organized, reviewable next step.
  b_46: 'The boundary:'
  p_106: No autonomous sending, quoting, or changes to customer records.
  kicker_46: 02 // DISCOVERY & DIRECTION
  h2_25: Understand the journey before drawing the screens.
  p_107: The proposed discovery follows a request from arrival to response. It identifies the minimum information
    needed, the person responsible for each decision, and the places where the team currently has to interpret missing
    context. Routine routing is separated from decisions that affect pricing, promises, or customer relationships.
  p_108: 'The proposed workflow has four explicit states: Received, Needs Context, Ready for Review, and Approved.
    Each request has a source reference and an owner. Automation can prepare a summary and suggested response, but
    a reviewer decides whether it is accurate and appropriate before anything leaves the system.'
  span_84: Receive a request
  span_85: Check context
  span_86: Review the draft
  span_87: Approve the next step
  kicker_47: 03 // DECISIONS THAT MATTER
  h2_26: Every detail has a job.
  h3_37: Use a bounded first workflow
  p_109: The first version handles only a defined request type. Unknown requests go to manual triage rather than
    being forced into the nearest category.
  h3_38: Make review meaningful
  p_110: The review screen shows the source message beside the summary and draft. A person can edit, reject, or
    request more context instead of approving a black box.
  h3_39: Build a stop button into the process
  p_111: The automation can be paused without losing the incoming request. Manual handling remains a supported path,
    not a failure state.
  kicker_48: 04 // THE WORK, UP CLOSE
  h2_27: From a vague starting point to a clearer experience.
  p_112: This comparison describes the fictional starting scenario and the proposed design direction. It is not
    a claim about an existing client website.
  case_label_11: STARTING SCENARIO
  li_62: Requests copied into different personal notes.
  li_63: A draft can be mistaken for a sent response.
  li_64: Missing context is discovered late.
  case_label_12: PROPOSED DIRECTION
  li_65: One request record with an owner and source link.
  li_66: Draft, approved, and sent are distinct states.
  li_67: Missing information routes to a visible review queue.
  h3_40: A reviewable draft, not an autonomous promise
  p_113: 'An example request says: “We need help updating the booking page before an event.” The draft summary records
    the affected page, desired change, and event date if supplied. If the date is missing, it is flagged—not guessed.
    A suggested response asks for the missing context and avoids inventing a price, delivery date, or confirmed
    scope.'
  figcaption_17: 'Layout study: a visible review queue with distinct states. The controls shown are illustration,
    not an interactive application.'
  h3_41: What changes on a smaller screen?
  p_114: Queue columns become a single ordered list. Status and ownership stay next to the request title. The reviewer
    opens one record at a time, keeping the original message and draft together rather than squeezing two unreadable
    panels onto a phone.
  kicker_49: 05 // UNDER THE HOOD
  h2_28: Practical technology. Explicit boundaries.
  p_115: The design specifies a durable queue, idempotency keys for duplicate events, structured output validation,
    and a separate approval record. Access is limited to the minimum required source data. Any eventual send action
    must check that the current draft version was approved, so editing a previously approved draft invalidates its
    approval. This page documents a concept; no live mailbox or third-party automation is connected.
  h3_42: The awkward cases belong in the plan.
  p_116: Duplicate events should resolve to the existing request. Unrecognized attachments are held for review rather
    than automatically executed or interpreted as trusted instructions. Provider timeouts move work into a retryable
    state with a visible error. Customer text is treated as untrusted input, not permission to change the workflow
    or access other records.
  h3_43: Verification plan
  li_68: Review the critical journey on a small phone, tablet, and desktop.
  li_69: Check keyboard order, visible focus, contrast, and meaningful image descriptions.
  li_70: Exercise long content, missing optional fields, and invalid input states.
  li_71: Verify every route, external destination, and recovery or escalation path.
  p_117: This is the proposed acceptance checklist for the concept, not a report of a commissioned production release.
  kicker_50: 06 // DELIVERY & OWNERSHIP
  h2_29: Make the next update as considered as the first.
  p_118: A polished launch is only part of the job. The proposed handoff explains what can be changed safely, what
    needs specialist help, and who owns the important accounts. Documentation should let a new maintainer understand
    the system without reconstructing the project from messages.
  li_72: Workflow and ownership map with approved boundaries.
  li_73: Request schema, review states, and example drafts.
  li_74: Test fixtures for missing, duplicated, and unexpected inputs.
  li_75: Pause, retry, escalation, and access-revocation procedures.
  h3_44: A sensible sequence
  b_47: 'Define:'
  li_76: agree on the audience, scope, responsibilities, and acceptance criteria.
  b_48: 'Prototype:'
  li_77: review structure, realistic content, and the critical interaction states.
  b_49: 'Build:'
  li_78: implement the agreed patterns and record any decisions that affect maintenance.
  b_50: 'Validate:'
  li_79: work through the checklist, resolve issues, and rehearse handoff.
  kicker_51: 07 // OUTCOMES WITHOUT THE GUESSWORK
  h2_30: Measure what matters. Don’t invent the numbers.
  p_119: A real pilot would compare time spent reviewing drafts against manual handling, track correction rates,
    and check whether requests are consistently assigned. The evaluation should count rework and supervision time
    rather than reporting only how many drafts were generated.
  h3_45: What this example demonstrates
  p_120: The proposed structure, original interface illustration, content patterns, and implementation reasoning
    show how this project could be approached. No conversion uplift, revenue increase, saved hours, or client testimonial
    is claimed.
  kicker_52: 08 // THE TAKEAWAY
  h2_31: A good system keeps people in control.
  p_121: Useful automation makes responsibility clearer. A shorter workflow is not an improvement if nobody can
    tell what happened or who approved it.
  kicker_53: INSIDE THIS STUDY
  a_122: The brief
  a_123: Understanding the problem
  a_124: The design decisions
  a_125: The work, up close
  a_126: Under the hood
  a_127: From build to handoff
  a_128: What success would look like
  a_129: What this study teaches
  case_link_10: ← All case studies
  kicker_54: NEXT STUDY
  h2_32: Northline Community
  p_122: Web development + hosting
  button_15: Explore the next study
  b_51: »
  a_130: Have a similar challenge? Let’s talk →
  aria_label_nav_23: Breadcrumb
  alt_img_25: Illustrative Fieldnote Operations interface concept, not a live client screenshot
  aria_label_div_4: Proposed visitor or workflow journey
  alt_img_26: Illustrative Fieldnote Operations interface concept, not a live client screenshot
  aria_label_nav_24: Case study contents
body_class: services-billboard-variant service-detail-page case-page
subtitle: 'A human-reviewed intake concept for a small service business: collect the right context, prepare a useful
  draft, and keep the final decision with a person.'
seoTitle: ''
seoDescription: ''
seoImage: ''
---
