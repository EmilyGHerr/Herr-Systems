import assert from "node:assert/strict";
import { chromium } from "playwright";
import { workspace, fixture, build, serve, cleanup } from "./support.mjs";
const work=await workspace();let server,browser;
try {
 const source=await fixture(work);build(source,work+"/public");server=await serve(work+"/public");browser=await chromium.launch();
 for(const width of [360,1440]) {
  const page=await browser.newPage({viewport:{width,height:1000}});
  for(const route of ["/services/development/","/services/hosting/","/services/consulting/","/services/agentic-setups/"]) {
   await page.goto(server.url+route);await page.evaluate(()=>document.fonts.ready);
   for(const theme of ["dark","light"]) {
    await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
    const headings=await page.locator(".service-detail :is(p,ul,ol,blockquote,pre,table):not(.kicker) + :is(h2,h3,h4,h5,h6)").evaluateAll(hs=>hs.map(h=>({text:h.textContent,margin:parseFloat(getComputedStyle(h).marginTop),gap:h.getBoundingClientRect().top-h.previousElementSibling.getBoundingClientRect().bottom})));
    assert(headings.length>0,route+": expected headings");
    for(const h of headings)assert(h.margin>=28&&h.gap>=27.9,`${route} ${width}px ${theme}: ${h.text} margin=${h.margin} gap=${h.gap}`);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route+": overflow");
    console.log(`PASS ${route} ${width}px ${theme}: ${headings.length} headings have >=28px separation`);
   }
  }
  for(const route of ["/","/case-studies/"]) {
   await page.goto(server.url+route);await page.evaluate(()=>document.fonts.ready);
   for(const theme of ["dark","light"]) {
    await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
    const cards=await page.locator('.case-card-copy').evaluateAll(cs=>cs.map(c=>{const label=c.querySelector('.case-label'),title=c.querySelector('h3');return {text:title.textContent,gap:title.getBoundingClientRect().top-label.getBoundingClientRect().bottom,margin:parseFloat(getComputedStyle(title).marginTop)};}));
    assert(cards.length>0);
    for(const c of cards)assert(Math.abs(c.gap-8)<0.2&&c.margin===0,`${route} ${width}px ${theme}: ${c.text} eyebrow gap=${c.gap}, title margin=${c.margin}`);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route+': overflow');
    console.log(`PASS ${route} ${width}px ${theme}: all card eyebrows have 8px title gap`);
   }
  }
  await page.close();
 }
} finally {await browser?.close();await server?.close();await cleanup(work);}
