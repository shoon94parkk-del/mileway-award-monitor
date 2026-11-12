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
    // The official site explicitly marks some routes/months as unqueryable.
    // This is not evidence of zero award seats and must stay distinct.
    if(tree.includes('dialog "확인"')&&tree.includes('검색하신 여정은 조회가 불가합니다.')){
      await page.getByRole('dialog',{name:'확인'}).getByRole('button',{name:'확인'}).click();
      return {status:'UNQUERYABLE',reason:'대한항공 공개 화면에서 해당 여정 조회 불가',rows:[],days:0,engine:'UI_ACCESSIBLE'};
    }
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
