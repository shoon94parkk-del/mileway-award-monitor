// Parse only the airline's *rendered accessibility tree* from Playwright's
// body.ariaSnapshot(). No API endpoint, intercepted response or private data.
const BONUS_PRESTIGE='프레스티지석 보너스';
const BONUS_FIRST='일등석 보너스';
const LABELS=['일반석 보너스','프레스티지석 보너스','프레스티지석 좌석승급','일등석 보너스','일등석 좌석승급'];
const IATA=/^[A-Z]{3}$/;

export function parsePublicAccessibleAwardMonth(tree,{origin,destination,month,startDate,endDate,sourceUpdatedAt}){
  if(!IATA.test(origin)||!IATA.test(destination)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
    throw Error('Invalid accessible award route/month');
  const header=tree?.indexOf('heading "보너스 좌석 상황"')??-1;
  if(header<0)throw Error('Airline award result screen is not displayed');
  const result=tree.slice(header).split(/\n- contentinfo:/)[0];
  const departure=result.match(/-\s*text:\s*출발지[^\n]*\n\s*-\s*emphasis:\s*([A-Z]{3})/);
  const arrival=result.match(/-\s*text:\s*도착지[^\n]*\n\s*-\s*emphasis:\s*([A-Z]{3})/);
  if(departure?.[1]!==origin||arrival?.[1]!==destination)
    throw Error('Accessible award screen route mismatch: '+(departure?.[1]||'?')+'→'+(arrival?.[1]||'?'));
  const [year,number]=month.split('-').map(Number);
  const trip=result.match(/-\s*navigation "가는 여정":[\s\S]*?-\s*button "(\d{4})년\s*(\d{1,2})월/);
  if(!trip||Number(trip[1])!==year||Number(trip[2])!==number)
    throw Error('Accessible award result month mismatch');
  const maxDay=new Date(Date.UTC(year,number,0)).getUTCDate();
  const days=new Map();
  for(const item of result.matchAll(/-\s*button "(\d{1,2})일,\s*([^"\r\n]*)"/g)){
    const day=Number(item[1]);
    if(!Number.isInteger(day)||day<1||day>maxDay)continue;
    days.set(day,item[2]);
  }
  // A valid zero-seat result needs a real visible calendar, not just the
  // pre-query form or an airline error screen.
  if(days.size<Math.min(20,maxDay))throw Error('Accessible award result lacks dated calendar buttons: '+days.size);
  if(![...days.values()].some(v=>LABELS.some(label=>v.includes(label))))
    throw Error('Award calendar seat-status vocabulary cannot be confirmed');
  const rows=[];
  for(const [day,text] of days){
    const date=month+'-'+String(day).padStart(2,'0');
    if(date<startDate||date>endDate)continue;
    for(const [term,fareClass] of [[BONUS_PRESTIGE,'O'],[BONUS_FIRST,'A']]){
      // Deliberately never count Prestige seat upgrades as O-class awards.
      if(!text.includes(term))continue;
      rows.push({date,origin,destination,flight:null,departureTime:null,aircraft:null,
        cabin:fareClass==='O'?'PRESTIGE':'FIRST',fareClass,available:true,
        availabilityType:fareClass==='O'?'AWARD':'AWARD_OR_UPGRADE',seats:null,
        sourcePath:'PUBLIC_UI_RENDERED',sourceUpdatedAt,checkedAt:new Date().toISOString(),
        source:'KOREAN_AIR_PUBLIC_DAILY',region:'유럽',direction:'RETURN'});
    }
  }
  return {status:'COVERED',rows,days:days.size,engine:'UI_ACCESSIBLE'};
}
