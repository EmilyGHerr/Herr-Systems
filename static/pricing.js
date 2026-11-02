import { calculateEstimate } from './pricing-calculator.js?v=services-3';
const form = document.querySelector('#estimate-form');
const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
const groups = [...form.querySelectorAll('[data-service-options]')];
function readEstimate() {
  const fields = new FormData(form);
  return calculateEstimate({ services: fields.getAll('service'), templates: fields.get('templates'), design: fields.get('design'), features: fields.getAll('feature'), hosting: fields.get('hosting'), consultingHours: fields.get('consultingHours'), consultingFocus: fields.get('consultingFocus'), contractHours: fields.get('contractHours'), contractFocus: fields.get('contractFocus') });
}
function clearGroup(group) {
  for (const input of group.querySelectorAll('input, select')) {
    if (input.type === 'checkbox' || input.type === 'radio') input.checked = input.defaultChecked;
    else if (input.tagName === 'SELECT') input.selectedIndex = 0;
    else input.value = input.defaultValue;
  }
}
function update() {
  const services = new FormData(form).getAll('service');
  for (const group of groups) {
    const active = services.includes(group.dataset.serviceOptions);
    if (!active && !group.disabled) clearGroup(group);
    group.disabled = !active;
    group.hidden = !active;
  }
  const estimate = readEstimate();
  document.querySelector('#template-count-output').textContent = `${estimate.options.templates || 5} ${(estimate.options.templates || 5) === 1 ? 'page template' : 'page templates'}`;
  document.querySelector('#estimate-lines').replaceChildren(...estimate.lines.map(line => {
    const item = document.createElement('li');
    const label = document.createElement('span'); label.textContent = line.label;
    const price = document.createElement('b'); price.textContent = money(line.price);
    item.append(label, price); return item;
  }));
  document.querySelector('#scope-summary').textContent = estimate.services.length ? `Selected scope: ${estimate.services.map(key => form.querySelector(`[name="service"][value="${key}"]`).dataset.label).join(', ')}.` : 'Choose a service to start your planning estimate.';
  document.querySelector('#project-total').textContent = money(estimate.total);
  document.querySelector('#mobile-project-total').textContent = money(estimate.total);
  document.querySelector('#mobile-monthly-total').textContent = estimate.services.includes('hosting') ? `+ ${money(estimate.monthly)}/month hosting` : 'No monthly hosting selected';
  document.querySelector('#monthly-total').textContent = `${money(estimate.monthly)} / month`;
  document.querySelector('#hosting-summary').textContent = estimate.support;
}
// Shared inquiry handler combines these options with contact fields for eventual delivery.
form.buildInquiryPayload = () => {
  const estimate = readEstimate();
  return { services: estimate.services, options: estimate.options, estimate };
};
document.querySelector('#estimate-controls').disabled = false;
form.addEventListener('input', event => {
  if (event.target.closest('#estimate-controls')) update();
});
form.addEventListener('change', event => {
  if (event.target.matches('input[type=number]')) {
    const estimate = readEstimate();
    event.target.value = estimate.options[event.target.name];
  }
  update();
});
form.addEventListener('reset', () => setTimeout(update, 0));
update();
