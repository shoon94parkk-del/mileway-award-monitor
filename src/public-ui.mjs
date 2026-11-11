// Shared airport-selection compatibility layer for both outbound and return searches.
// The official public page migrated from departureBtn/destinationBtn to kds-fromto_1
// and accessible region tabs. All operations use the visible airline UI.
export async function hasModernAirportUi(page){
  return (await page.locator('kds-fromto_1 button.ui-fromto__button').count())>=2;
}

export async function openPublicAirportRegion(page,kind,region){
  if(!['departure','destination'].includes(kind))throw Error('Unknown airport selector side');
  if(await hasModernAirportUi(page)){
    await page.locator('kds-fromto_1 button.ui-fromto__button').nth(kind==='departure'?0:1).click();
    await page.getByRole('button',{name:'모든 지역 보기',exact:true}).click();
    const tab=page.getByRole('tab',{name:region,exact:true});
    if(!await tab.isVisible().catch(()=>false)){
      const aria=await page.locator('body').ariaSnapshot().catch(()=> '');
      const i=aria.indexOf('dialog "지역과 도시 선택"');
      console.log('PUBLIC REGION DIAGNOSTIC',kind,region,aria.slice(Math.max(0,i),Math.max(0,i)+1400));
    }
    await tab.click();
    return page.getByRole('tabpanel',{name:region,exact:true}).getByRole('button');
  }
  await page.locator('[id^="'+kind+'Btn"]').click();
  await page.getByRole('button',{name:'모든 지역 보기',exact:true}).click();
  await page.getByRole('button',{name:region,exact:true}).click();
  return page.locator('[id^="acc-panel-mobile-web"]:visible button:visible');
}

export async function closePublicAirportRegion(page){
  if(await hasModernAirportUi(page)){
    await page.getByRole('dialog',{name:'지역과 도시 선택'}).getByRole('button',{name:'닫기',exact:true}).click();
  }else{
    await page.getByRole('button',{name:'닫기',exact:true}).click();
  }
}

export async function choosePublicAirport(page,kind,region,code){
  if(!/^[A-Z]{3}$/.test(code))throw Error('Invalid airport code');
  const buttons=await openPublicAirportRegion(page,kind,region);
  const labels=await buttons.allTextContents();
  const index=labels.findIndex(v=>new RegExp('(?:^|\\s)'+code+'(?:\\s|$)').test(v.trim()));
  if(index<0)throw Error('Public airport selector missing '+code+' in '+region);
  await buttons.nth(index).click();
}

export async function selectPublicOneWay(page){
  if(await hasModernAirportUi(page)){
    await page.getByRole('radio',{name:'편도',exact:true}).click();
  }else{
    await page.locator('label[for="bonusTripType_OW"]').click();
  }
}

export async function dismissPublicCookies(page){
  const cookie=page.getByRole('button',{name:'필수 쿠키만 허용',exact:true});
  if(await page.locator('kc-global-cookie-banner').count()){
    await cookie.waitFor({state:'visible',timeout:6500}).catch(()=>{});
  }
  if(await cookie.isVisible().catch(()=>false)){
    await cookie.click({timeout:10000});
    await page.getByRole('dialog',{name:'쿠키 활용 동의 안내'}).waitFor({state:'hidden',timeout:10000}).catch(()=>{});
    return;
  }
  const banner=page.locator('kc-global-cookie-banner');
  if(!await banner.count())return;
  const reject=banner.getByRole('button',{name:/거부|필수.*허용|Reject|필수 쿠키/i}).first();
  if(await reject.isVisible().catch(()=>false))await reject.click({timeout:10000});
}
