// Character count only; validation and submission are shared with the quote form.
(() => {
  const field = document.querySelector('#inquiry-message');
  const count = document.querySelector('#message-count');
  if (!field || !count) return;
  const update = () => { count.textContent = `${field.value.length.toLocaleString('en-US')} / 3,000`; };
  field.addEventListener('input', update);
  field.form.addEventListener('reset', () => setTimeout(update, 0));
  update();
})();
