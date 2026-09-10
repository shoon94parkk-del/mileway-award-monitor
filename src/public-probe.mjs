import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch {
  playwright = require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
}
const browser = await playwright.chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:false});
try {
  const page = await browser.newPage({locale:'ko-KR'});
  page.on('response', r => { if(r.url().includes('/api/') && /award|bonus/i.test(r.url())) console.log(r.status(), r.url()); });
  await page.goto('https://www.koreanair.com/booking/book-and-manage/award-seat-availability', {waitUntil:'domcontentloaded'});
  await page.locator('[id^="departureBtn"]').waitFor({state:'attached',timeout:60000});
  console.log((await page.locator('body').innerText()).slice(0,2500));
  console.log('COOKIE', await page.locator('kc-global-cookie-banner').evaluate(e=>e.shadowRoot?.innerHTML));
} finally { await browser.close(); }
