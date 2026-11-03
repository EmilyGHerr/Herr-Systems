import { prepareTurnstile } from './inquiry-turnstile.js';

// Shared submission boundary: enable only after deploying a real same-origin Worker.
// No personal data is stored, logged, or put in URLs here.
for (const form of document.querySelectorAll('[data-inquiry-form]')) {
  const button = form.querySelector('[data-submit-button]') || document.querySelector(`[data-submit-button][form="${form.id}"]`);
  const status = form.querySelector('[data-submit-status]') || document.querySelector(`[data-submit-status][data-for="${form.id}"]`);
  if (!button || !status) continue;
  let errors = form.querySelector('[data-form-errors]');
  if (!errors) {
    errors = document.createElement('div'); errors.className = 'form-errors'; errors.dataset.formErrors = '';
    errors.setAttribute('role', 'alert'); errors.tabIndex = -1; errors.hidden = true; form.prepend(errors);
  }
  form.noValidate = true; button.disabled = false;
  const idleLabel = button.textContent;
  let pending = false;
  const verification = prepareTurnstile(form);
  function showStatus(message, state) {
    status.textContent = message; status.dataset.state = state; status.focus();
  }
  function clearErrors() {
    errors.hidden = true; errors.replaceChildren();
    for (const field of form.elements) {
      field.removeAttribute('aria-invalid');
      const inline = document.getElementById(`${field.name}-error`);
      if (inline && form.contains(inline)) inline.textContent = '';
    }
  }
  form.addEventListener('input', () => {
    if (!pending) { status.textContent = ''; delete status.dataset.state; }
  });
  form.addEventListener('reset', () => {
    clearErrors();
    void verification.reset();
    if (!pending) { status.textContent = ''; delete status.dataset.state; }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (pending) return; clearErrors();
    const problems = [];
    for (const field of form.elements) {
      if (!field.willValidate) continue;
      let message = '';
      const label = field.labels?.[0]?.textContent.replace(/\s*\*\s*$/, '').trim() || field.name;
      if (field.required && typeof field.value === 'string' && !field.value.trim()) message = `Enter ${label.toLowerCase()}.`;
      else if (!field.validity.valid) message = field.validationMessage;
      else if (field.maxLength >= 0 && field.value.length > field.maxLength) message = `Keep ${label.toLowerCase()} to ${field.maxLength} characters or fewer.`;
      if (message) problems.push({ field, message });
    }
    if (form.dataset.formKind === 'quote' && !new FormData(form).getAll('service').length) {
      problems.push({ field: form.querySelector('[name="service"]'), message: 'Choose at least one service for your quote.' });
    }
    if (problems.length) {
      const heading = document.createElement('p'); heading.textContent = 'A few details need another look.';
      const list = document.createElement('ul');
      for (const { field, message } of problems) {
        if (!field) continue;
        field.setAttribute('aria-invalid', 'true');
        const inline = document.getElementById(`${field.name}-error`);
        if (inline && form.contains(inline)) {
          inline.textContent = message;
          const descriptions = new Set((field.getAttribute('aria-describedby') || '').split(' ').filter(Boolean));
          descriptions.add(inline.id); field.setAttribute('aria-describedby', [...descriptions].join(' '));
        }
        const li = document.createElement('li'); const link = document.createElement('a');
        link.href = `#${field.id}`; link.textContent = message;
        link.addEventListener('click', e => { e.preventDefault(); field.focus(); });
        li.append(link); list.append(li);
      }
      errors.replaceChildren(heading, list); errors.hidden = false; errors.focus(); return;
    }
    if (form.dataset.endpointEnabled !== 'true') {
      showStatus('Online delivery is not connected yet. Your message has not been sent. Please use the direct email link for now.', 'unavailable'); return;
    }
    const endpoint = new URL(form.action, location.href);
    if (endpoint.origin !== location.origin || !['http:', 'https:'].includes(endpoint.protocol)) {
      showStatus('The form endpoint is not configured correctly. Nothing was sent. Please contact us by email.', 'error'); return;
    }
    // Lock while waiting for the widget too, preventing concurrent submissions.
    pending = true; button.disabled = true;
    const turnstileToken = await verification.token();
    if (!turnstileToken) {
      pending = false; button.disabled = false;
      showStatus('Please complete the spam verification. If it does not appear, reload the page or contact us by email.', 'error'); return;
    }
    const data = new FormData(form);
    const text = key => String(data.get(key) || '').trim();
    const payload = {
      schemaVersion: 1, kind: form.dataset.formKind, turnstileToken,
      contact: { name: text('name'), email: text('email'), business: text('business'), website: text('website') },
      topic: text('topic'), message: text('message'),
      ...(typeof form.buildInquiryPayload === 'function' ? form.buildInquiryPayload() : {}),
    };
    pending = true; button.disabled = true; button.textContent = 'Sending…'; form.setAttribute('aria-busy', 'true');
    status.textContent = 'Sending your message…'; status.dataset.state = 'pending';
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(endpoint.href, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'same-origin', redirect: 'error', body: JSON.stringify(payload), signal: controller.signal,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok !== true) {
        showStatus(response.status === 429
          ? 'Too many requests. Please wait before trying again, or contact us by email.'
          : 'Your message could not be confirmed. Your details are still here. Please try again later or contact us by email.', 'error'); return;
      }
      // Preserve inputs: they may have been edited while the snapshot was in flight.
      showStatus('Your submitted message was received. We’ll reply using the email address you supplied.', 'success');
    } catch {
      showStatus('We couldn’t confirm receipt. Your details are still here. Check your connection or contact us by email before resubmitting.', 'error');
    } finally {
      void verification.reset();
      clearTimeout(timer); pending = false; button.disabled = false; button.textContent = idleLabel; form.removeAttribute('aria-busy');
    }
  });
}
