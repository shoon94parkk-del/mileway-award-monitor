import { chromium } from 'playwright';

const HOME='https://www.koreanair.com/';
const BONUS='/api/hmp/bonusSeatView/bonusSeatView';
const LIVE='/api/ap/long-running/booking/avail/scheduleAvailability';

function summarize(label,status,text){
  let parsed=null;
  try{parsed=JSON.parse(text);}catch{}
  const out={label,status,ok:status>=200&&status<300,contentType:parsed?'json':'other'};
  if(parsed&&typeof parsed==='object'){
    out.keys=Object.keys(parsed).slice(0,20);
    if(parsed.errorCode)out.errorCode=String(parsed.errorCode).slice(0,100);
    if(parsed.code)out.code=String(parsed.code).slice(0,100);
    if(parsed.message)out.message=String(parsed.message).slice(0,180);
    if(Array.isArray(parsed.boundFlightList))out.boundFlightList=parsed.boundFlightList.length;
    if(Array.isArray(parsed.flightList))out.flightList=parsed.flightList.length;
  }
  console.log(JSON.stringify(out));
  return out;
}

const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({locale:'ko-KR'});
  const page=await context.newPage();
  await page.goto(HOME,{waitUntil:'domcontentloaded',timeout:60000});
  console.log(JSON.stringify({label:'home',status:'loaded',url:page.url()}));

  const control=await page.evaluate(async ({url,body})=>{
    const r=await fetch(url,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    return {status:r.status,text:await r.text()};
  },{url:BONUS,body:{departureAirport:'ICN',arrivalAirport:'LAX',departureDate:'20260901'}});
  summarize('bonusSeatView_guest_control',control.status,control.text);

  const variants=[
    {label:'schedule_guest_named',body:{award:true,currency:'',sta:false,segmentList:[{departureDate:'20260920',departureAirport:'ICN',arrivalAirport:'LAX'}],travelers:[{travellerType:'ADT',lastName:'TEST',firstName:'USER',discountCode:''}],cabinType:'PRESTIGE'}},
    {label:'schedule_guest_empty_name',body:{award:true,currency:'',sta:false,segmentList:[{departureDate:'20260920',departureAirport:'ICN',arrivalAirport:'LAX'}],travelers:[{travellerType:'ADT',lastName:'',firstName:'',discountCode:''}],cabinType:'PRESTIGE'}}
  ];

  for(const v of variants){
    const res=await page.evaluate(async ({url,body})=>{
      const r=await fetch(url,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      return {status:r.status,text:await r.text()};
    },{url:LIVE,body:v.body});
    const s=summarize(v.label,res.status,res.text);
    if(res.status===403){console.log(JSON.stringify({label:'stop',reason:'403 anti-bot/access-control response; no retry'}));break;}
    if(s.ok&&s.boundFlightList!==undefined)console.log(JSON.stringify({label:'guest_realtime_candidate',success:true}));
  }
} finally {
  await browser.close();
}
