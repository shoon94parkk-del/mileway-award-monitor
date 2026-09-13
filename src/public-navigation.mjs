import {PUBLIC_URL} from './public-calendar.mjs';

// Korean Air's public award-seat page chooses the daily 23:00 snapshot from the
// browser's local timezone. GitHub-hosted Windows runners use UTC by default,
// which makes a 23:00 KST refresh look like the previous day until 08:00 KST.
// Apply a Chromium timezone override before the first navigation so both the
// watcher and the full collector see the same Korea-time snapshot as users.
const timezoneSessions=new WeakMap();
async function enforceSeoulTimezone(page){
  if(timezoneSessions.has(page))return;
  const context=typeof page.context==='function'?page.context():null;
  if(!context||typeof context.newCDPSession!=='function')return;
  const session=await context.newCDPSession(page);
  await session.send('Emulation.setTimezoneOverride',{timezoneId:'Asia/Seoul'});
  await session.send('Network.enable').catch(()=>{});
  await session.send('Network.setCacheDisabled',{cacheDisabled:true}).catch(()=>{});
  timezoneSessions.set(page,session);
  console.log('PUBLIC TIMEZONE: Asia/Seoul');
}

async function stopHungNavigation(page){
  const session=timezoneSessions.get(page);
  if(session)await session.send('Page.stopLoading').catch(()=>{});
  if(typeof page.waitForTimeout==='function')await page.waitForTimeout(500).catch(()=>{});
}

export async function openPublicPage(page,{attempts=2,delay=ms=>new Promise(r=>setTimeout(r,ms)),cacheBust=true}={}){
  let last;
  for(let attempt=1;attempt<=attempts;attempt++){
    try{
      await enforceSeoulTimezone(page);
      if(typeof page.setExtraHTTPHeaders==='function'){
        await page.setExtraHTTPHeaders({
          'Cache-Control':'no-cache, no-store, max-age=0',
          'Pragma':'no-cache',
          'Accept-Language':'ko-KR,ko;q=0.9,en;q=0.7',
        });
      }
      const target=new URL(PUBLIC_URL);
      if(cacheBust)target.searchParams.set('_mileway_cb',`${Date.now()}-${attempt}`);
      const response=await page.goto(target.toString(),{waitUntil:'commit',timeout:30000});
      if(response&&[403,429].includes(response.status()))throw Error(`ACCESS_LIMIT ${response.status()}: stop public navigation`);
      if(response&&!response.ok())throw Error(`Public page HTTP ${response.status()}`);
      await page.locator('[id^="departureBtn"]').first().waitFor({state:'visible',timeout:60000});
      console.log('PUBLIC UI READY: departureBtn');
      return;
    }catch(error){
      last=error;
      console.error(`Public navigation ${attempt}/${attempts}: ${error.message.split('\n')[0]}`);
      await stopHungNavigation(page);
      if(/ACCESS_LIMIT/.test(error.message)||attempt===attempts)throw error;
      await delay(10000*attempt);
    }
  }
  throw last;
}
