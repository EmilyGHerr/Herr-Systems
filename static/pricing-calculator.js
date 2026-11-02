// USD planning samples, not binding quotes. Only the hourly rate is confirmed.
export const HOURLY_RATE = 70;
export const SERVICES = Object.freeze({ web: 'Web Design / Web Development', hosting: 'Hosting', agentic: 'Agentic Setups', consulting: 'Consulting', contract: 'Contract Work' });
export const FEATURES = Object.freeze({
  ecommerce: { service: 'web', label: 'Ecommerce', price: 700 },
  cms: { service: 'web', label: 'Editable content / blog', price: 210 },
  booking: { service: 'web', label: 'Online booking', price: 210 },
  integration: { service: 'web', label: 'Business integration', price: 140 },
  agentReview: { service: 'agentic', label: 'Additional evaluation and handoff', price: 210 },
  agentIntegration: { service: 'agentic', label: 'Additional tool connection', price: 140 },
});
export const HOSTING = Object.freeze({ hosting: { label: 'Hosting and backups', price: 35 }, managed: { label: 'Hosting and routine maintenance', price: 70 } });
const list = value => Array.isArray(value) ? value : [];
const own = (object, key) => typeof key === 'string' && Object.hasOwn(object, key);
function bounded(value, fallback, max) {
  if (!['number', 'string'].includes(typeof value) || value === '' || (typeof value === 'string' && !value.trim())) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(1, Math.round(number))) : fallback;
}
export function calculateEstimate(input = {}) {
  if (!input || typeof input !== 'object') input = {};
  const services = Object.keys(SERVICES).filter(key => list(input.services).includes(key));
  const selected = new Set(services);
  const options = {};
  const lines = [];
  if (selected.has('web')) {
    options.templates = bounded(input.templates, 5, 20);
    options.design = input.design === 'custom' ? 'custom' : 'standard';
    lines.push({ service: 'web', label: `Website · ${options.templates} ${options.templates === 1 ? 'page template' : 'page templates'}`, price: 280 + (options.templates - 1) * 70 });
    if (options.design === 'custom') lines.push({ service: 'web', label: 'Custom visual direction', price: 350 });
  }
  if (selected.has('agentic')) lines.push({ service: 'agentic', label: 'One focused assistant / workflow', price: 420 });
  const features = [...new Set(list(input.features))].filter(key => own(FEATURES, key) && selected.has(FEATURES[key].service));
  if (selected.has('web') || selected.has('agentic')) options.features = features;
  for (const key of features) lines.push({ ...FEATURES[key] });
  for (const service of ['consulting', 'contract']) if (selected.has(service)) {
    const hours = bounded(input[`${service}Hours`], service === 'consulting' ? 2 : 4, 160);
    const topics = service === 'consulting' ? ['planning', 'review', 'architecture'] : ['development', 'maintenance', 'team'];
    options[`${service}Hours`] = hours;
    options[`${service}Focus`] = topics.includes(input[`${service}Focus`]) ? input[`${service}Focus`] : topics[0];
    lines.push({ service, label: `${SERVICES[service]} · ${hours} ${hours === 1 ? 'hour' : 'hours'} at $70/hr`, price: hours * HOURLY_RATE });
  }
  let monthly = 0;
  let support = 'No hosting selected';
  if (selected.has('hosting')) {
    options.hosting = own(HOSTING, input.hosting) ? input.hosting : 'hosting';
    ({ price: monthly, label: support } = HOSTING[options.hosting]);
  }
  return { services, options, lines, total: lines.reduce((sum, line) => sum + line.price, 0), monthly, support };
}
