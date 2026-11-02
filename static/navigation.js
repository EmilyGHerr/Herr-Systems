// Native details remains usable without JavaScript.
(() => {
  const menus = [...document.querySelectorAll('.nav-dropdown')];
  const close = except => menus.forEach(menu => { if (menu !== except) menu.open = false; });
  menus.forEach(menu => {
    menu.addEventListener('toggle', () => { if (menu.open) close(menu); });
    menu.addEventListener('focusout', event => {
      // Pointer activation may blur summary without focusing the anchor. A null
      // destination is not proof of leaving the menu: closing here removes the
      // link before mouseup/click. Outside clicks are handled below instead.
      if (event.relatedTarget && !menu.contains(event.relatedTarget)) menu.open = false;
    });
    menu.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary').focus(); event.preventDefault(); }
    });
  });
  document.addEventListener('click', event => { if (!event.target.closest('.nav-dropdown')) close(); });

  const drawer = document.querySelector('#site-menu');
  const opener = document.querySelector('[data-menu-open]');
  if (!drawer || !opener) return;
  const root = document.documentElement;
  const compact = matchMedia('(max-width: 720px)');
  function dismiss() { if (drawer.open) drawer.close(); }
  opener.disabled = false;
  opener.addEventListener('click', () => {
    close();
    drawer.showModal();
    opener.setAttribute('aria-expanded', 'true');
    root.classList.add('site-menu-open');
  });
  drawer.querySelector('[data-menu-close]').addEventListener('click', dismiss);
  drawer.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const stops = [...drawer.querySelectorAll('a[href], button:not([disabled])')];
    const first = stops[0], last = stops[stops.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  // Native modal dialog supplies Escape, focus trapping, and background inertness.
  drawer.addEventListener('close', () => {
    root.classList.remove('site-menu-open');
    opener.setAttribute('aria-expanded', 'false');
    (compact.matches ? opener : document.querySelector('.logo'))?.focus({ preventScroll: true });
  });
  drawer.addEventListener('click', event => {
    if (event.target === drawer) {
      const box = drawer.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dismiss();
    }
    // Wait until native anchor activation, including same-page fragments.
    if (event.target.closest('a')) setTimeout(dismiss, 0);
  });
  compact.addEventListener('change', event => { if (!event.matches) dismiss(); });
  window.addEventListener('pageshow', () => {
    if (!drawer.open) { root.classList.remove('site-menu-open'); opener.setAttribute('aria-expanded', 'false'); }
  });
})();
