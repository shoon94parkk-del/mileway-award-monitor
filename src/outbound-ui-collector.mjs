import {parsePublicAccessibleAwardMonth} from './public-accessible-award.mjs';

// The Korean Air public UI displays day/cabin inventory without a flight number.
// Give the cloud store a truthful stable label rather than pretending it is KExxx.
export const DISPLAY_ONLY_FLIGHT='편명 미제공';

export function outwardFromAccessibleTree(tree,{route,month,start,end,sourceUpdatedAt}){
  const result=parsePublicAccessibleAwardMonth(tree,{
    origin:'ICN',destination:route.code,month,startDate:start,endDate:end,sourceUpdatedAt
  });
  return {...result,rows:result.rows.map(row=>({...row,
    region:route.region,direction:'OUTBOUND',flight:DISPLAY_ONLY_FLIGHT}))};
}

export async function readOutboundScreen(page,{route,month,start,end,sourceUpdatedAt,timeoutMs=18000}){
  const deadline=Date.now()+timeoutMs;
  let lastError;
  while(Date.now()<deadline){
    const tree=await page.locator('body').ariaSnapshot();
    try{
      return outwardFromAccessibleTree(tree,{route,month,start,end,sourceUpdatedAt});
    }catch(error){
      lastError=error;
      await page.waitForTimeout(850);
    }
  }
  const currentTree=await page.locator('body').ariaSnapshot().catch(()=> '');
  const resultAnchor=currentTree.indexOf('heading "보너스 좌석');
  const outline=currentTree.slice(Math.max(0,resultAnchor),Math.max(0,resultAnchor)+3500);
  console.error('OUTBOUND SCREEN DIAGNOSTIC',JSON.stringify({route:route.code,month,reason:lastError?.message,outline}));
  throw Error('Outbound screen '+route.code+' '+month+' did not show a verified award calendar: '+(lastError?.message||'unknown'));
}
