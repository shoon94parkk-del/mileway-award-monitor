import {PUBLIC_URL} from './public-calendar.mjs';

export async function openPublicPage(page,{attempts=2,delay=ms=>new Promise(r=>setTimeout(r,ms))}={}){
  let last;
  for(let attempt=1;attempt<=attempts;attempt++){
    try{
      const response=await page.goto(PUBLIC_URL,{waitUntil:'commit',timeout:30000});
      if(response&&[403,429].includes(response.status()))throw Error(`ACCESS_LIMIT ${response.status()}: stop public navigation`);
      if(response&&!response.ok())throw Error(`Public page HTTP ${response.status()}`);
      await page.locator('[id^="departureBtn"]').first().waitFor({state:'visible',timeout:60000});
      console.log('PUBLIC UI READY: departureBtn');
      return;
    }catch(error){
      last=error;
      console.error(`Public navigation ${attempt}/${attempts}: ${error.message.split('\n')[0]}`);
      if(/ACCESS_LIMIT/.test(error.message)||attempt===attempts)throw error;
      await delay(10000*attempt);
    }
  }
  throw last;
}
