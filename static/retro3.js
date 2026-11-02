(() => {
  const root = document.documentElement;
  const toggle = document.querySelector('[data-theme-toggle]');
  function paint(theme) {
    root.dataset.theme = theme;
    const dark = theme === 'dark';
    toggle.setAttribute('aria-pressed', String(dark));
    toggle.setAttribute('aria-label', dark ? 'Dark mode active — switch to light mode' : 'Light mode active — switch to dark mode');
    toggle.setAttribute('title', dark ? 'Switch to light mode' : 'Switch to dark mode');
    toggle.innerHTML = `<span aria-hidden="true">${dark ? '☀' : '☾'}</span>`;
  }
  // Every page starts dark; the switch applies to the current page only.
  paint('dark');
  toggle.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    paint(next);
  });
})();
