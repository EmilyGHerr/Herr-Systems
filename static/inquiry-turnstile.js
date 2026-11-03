// Only the PUBLIC site key reaches this module. Verification belongs on the Worker.
let api;
function loadAPI() {
  if (api) return api;
  api = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => window.turnstile ? resolve(window.turnstile) : reject(new Error('Verification unavailable'));
    script.onerror = () => reject(new Error('Verification unavailable'));
    document.head.append(script);
  });
  return api;
}
export function prepareTurnstile(form) {
  const container = form.querySelector('[data-turnstile]');
  let instance;
  const ready = container ? loadAPI().then(turnstile => {
    instance = turnstile.render(container, {
      sitekey: container.dataset.sitekey, action: container.dataset.action,
      theme: 'auto', size: 'flexible',
    });
    return turnstile;
  }).catch(() => null) : Promise.resolve(null);
  return {
    async token() {
      // Bound the wait if the challenge script is blocked or never finishes loading.
      let timer;
      try {
        const turnstile = await Promise.race([ready, new Promise(resolve => { timer = setTimeout(() => resolve(null), 3000); })]);
        return turnstile && instance !== undefined ? turnstile.getResponse(instance) : '';
      } catch { return ''; }
      finally { clearTimeout(timer); }
    },
    async reset() {
      // Do not wait indefinitely for a blocked script on form reset.
      if (instance === undefined) return;
      const turnstile = await ready;
      try { turnstile?.reset(instance); } catch { /* Next submit remains gated. */ }
    },
  };
}
