import { chromium, request } from 'playwright';

const endpoint = 'https://www.koreanair.com/api/ap/long-running/booking/avail/scheduleAvailability';
const home = 'https://www.koreanair.com/';
const probes = [
  {
    label: 'guest-context-empty-traveler-prestige',
    body: {
      award: true,
      currency: '',
      sta: false,
      segmentList: [{ departureDate: '20270403', departureAirport: 'ICN', arrivalAirport: 'LAX' }],
      travelers: [{ travellerType: 'ADT', lastName: '', firstName: '', discountCode: '' }],
      cabinType: 'PRESTIGE',
    },
  },
  {
    label: 'guest-context-no-travelers-prestige',
    body: {
      award: true,
      currency: '',
      sta: false,
      segmentList: [{ departureDate: '20270403', departureAirport: 'ICN', arrivalAirport: 'LAX' }],
      travelers: [],
      cabinType: 'PRESTIGE',
    },
  },
  {
    label: 'guest-context-empty-traveler-first',
    body: {
      award: true,
      currency: '',
      sta: false,
      segmentList: [{ departureDate: '20270403', departureAirport: 'ICN', arrivalAirport: 'LAX' }],
      travelers: [{ travellerType: 'ADT', lastName: '', firstName: '', discountCode: '' }],
      cabinType: 'FIRST',
    },
  },
];

async function summarize(response) {
  const text = await response.text().catch(() => '');
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return {
    status: response.status(),
    ok: response.ok(),
    contentType: response.headers()['content-type'] || '',
    keys: json && typeof json === 'object' ? Object.keys(json).slice(0, 20) : [],
    boundCount: Array.isArray(json?.boundFlightList) ? json.boundFlightList.length : null,
    resultCode: json?.resultCode ?? json?.code ?? json?.status ?? null,
    bodyPreview: text.replace(/\s+/g, ' ').slice(0, 600),
  };
}

async function runContextProbe(context, labelPrefix = '') {
  for (const probe of probes) {
    try {
      const response = await context.post(endpoint, {
        data: probe.body,
        headers: {
          'content-type': 'application/json',
          'accept': 'application/json, text/plain, */*',
          'origin': 'https://www.koreanair.com',
          'referer': 'https://www.koreanair.com/',
        },
        timeout: 30000,
      });
      console.log(labelPrefix + probe.label, JSON.stringify(await summarize(response)));
    } catch (error) {
      console.log(labelPrefix + probe.label, JSON.stringify({ requestError: String(error.message || error) }));
    }
  }
}

async function main() {
  console.log('=== A. Raw anonymous request context: no prior page visit, no login ===');
  const raw = await request.newContext({
    baseURL: 'https://www.koreanair.com',
    extraHTTPHeaders: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36',
      'accept-language': 'ko-KR,ko;q=0.9,en;q=0.8',
    },
  });
  try { await runContextProbe(raw, 'raw:'); } finally { await raw.dispose(); }

  console.log('=== B. Fresh guest browser session: visit homepage first, still no login ===');
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      locale: 'ko-KR',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36',
    });
    const page = await context.newPage();
    try {
      const nav = await page.goto(home, { waitUntil: 'domcontentloaded', timeout: 60000 });
      console.log('homepage', JSON.stringify({ status: nav?.status(), url: page.url(), title: await page.title() }));
    } catch (error) {
      console.log('homepage', JSON.stringify({ navigationError: String(error.message || error) }));
    }
    await runContextProbe(context.request, 'browser:');

    console.log('=== C. Guest auth-state endpoint, no login ===');
    try {
      const userInfo = await context.request.get('https://www.koreanair.com/api/li/auth/loginUserInfo', { timeout: 30000 });
      console.log('loginUserInfo', JSON.stringify(await summarize(userInfo)));
    } catch (error) {
      console.log('loginUserInfo', JSON.stringify({ requestError: String(error.message || error) }));
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
