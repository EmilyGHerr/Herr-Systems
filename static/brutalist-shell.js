const toggle = document.querySelector(".theme");
toggle?.addEventListener("click", () => {
  const light = document.documentElement.dataset.theme !== "light";
  document.documentElement.dataset.theme = light ? "light" : "dark";
  toggle.setAttribute(
    "aria-label",
    `Switch to ${light ? "dark" : "light"} theme`,
  );
});
for (const nav of document.querySelectorAll(".masthead nav,.footer-links,.mobile-nav,.site-menu nav"))
  for (const link of nav.querySelectorAll("a"))
    if (new URL(link.href).pathname === location.pathname)
      link.setAttribute("aria-current", "page");

// Native modal dialog matches the live site: right-side drawer, inert backdrop,
// Escape/backdrop dismissal, wrapped keyboard focus, and restored opener focus.
const drawer = document.querySelector("#site-menu");
const opener = document.querySelector("[data-menu-open]");
const compact = matchMedia("(max-width: 800px)");
if (drawer && opener && typeof drawer.showModal === "function") {
  const root = document.documentElement;
  const dismiss = () => { if (drawer.open) drawer.close(); };
  opener.disabled = false;
  opener.addEventListener("click", () => {
    if (!compact.matches || drawer.open) return;
    drawer.showModal();
    opener.setAttribute("aria-expanded", "true");
    root.classList.add("site-menu-open");
  });
  drawer.querySelector("[data-menu-close]").addEventListener("click", dismiss);
  drawer.addEventListener("keydown", event => {
    if (event.key !== "Tab") return;
    const stops = [...drawer.querySelectorAll("a[href],button:not([disabled])")];
    const first = stops[0], last = stops.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  drawer.addEventListener("close", () => {
    root.classList.remove("site-menu-open");
    opener.setAttribute("aria-expanded", "false");
    (compact.matches ? opener : document.querySelector(".brand"))?.focus({preventScroll:true});
  });
  drawer.addEventListener("click", event => {
    if (event.target === drawer) {
      const r = drawer.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dismiss();
    }
    // Defer until the native anchor action, including same-page fragments.
    if (event.target.closest("a")) setTimeout(dismiss, 0);
  });
  compact.addEventListener("change", event => { if (!event.matches) dismiss(); });
  window.addEventListener("pageshow", () => {
    if (!drawer.open) { root.classList.remove("site-menu-open"); opener.setAttribute("aria-expanded", "false"); }
  });
}
