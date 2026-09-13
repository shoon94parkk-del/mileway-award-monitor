import fs from 'node:fs';
import {chromium} from 'playwright';
import {PUBLIC_API} from '../src/public-calendar.mjs';
import {openPublicPage} from '../src/public-navigation.mjs';
import {readLatestSourceUpdatedAt} from '../src/source-observer.mjs';

const edge=[
  process.env.KE_BROWSER_EXECUTABLE,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find(p=>p&&fs.existsSync(p));

const isPublicApi=url=>url===PUBLIC_API||url.startsWith(PUBLIC_API+'?');
const kstMonth=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit'}).format(new Date());

function nextMonth(monthKey){
  const [year,month]=monthKey.split('-').map(Number);
  const d=new Date(Date.UTC(year,month,1));
  return d.toISOString().slice(0,7);
}

function summarize(data){
  const days=Array.isArray(data?.flightList)?data.flightList:[];
  const flights=days.flatMap(day=>Array.isArray(day.flightDetailList)?day.flightDetailList:[]);
  return {
    departureAirport:data?.departureAirport??null,
    arrivalAirport:data?.arrivalAirport??null,
    days:days.length,
    flights:flights.length,
    awardRows:flights.filter(f=>['O','A'].includes(f.bookingClass)).length,
    availableAwards:flights.filter(f=>['O','A'].includes(f.bookingClass)&&f.availableSeat===true).length,
  };
}

async function dismissCookie(page){
  const cookie=page.locator('kc-global-cookie-banner');
  if(!await cookie.count())return;
  const reject=cookie.getByRole('button',{name:/거부|필수.*허용|Reject|필수 쿠키/i}).first();
  if(await reject.count()){await reject.click();return;}
  const close=cookie.getByRole('button',{name:/닫기|Close/i}).first();
  if(await close.count())await close.click();
}

async function chooseRegion(page,kind,region){
  await page.locator(`[id^="${kind}Btn"]`).click();
  await page.getByRole('button',{name:'모든 지역 보기',exact:true}).click();
  await page.getByRole('button',{name:region,exact:true}).click();
}

async function directFetch(page,body){
  const result=await page.evaluate(async({url,body})=>{
    const response=await fetch(url,{
      method:'POST',
      credentials:'include',
      headers:{'content-type':'application/json','accept':'application/json, text/plain, */*'},
      body:JSON.stringify(body),
    });
    return {status:response.status,text:await response.text()};
  },{url:PUBLIC_API,body});
  let data=null;
  try{data=JSON.parse(result.text);}catch{}
  return {...result,data};
}

const browser=await chromium.launch({...(edge?{executablePath:edge}:{}),headless:true,args:['--disable-http2','--disable-quic']});
try{
  const context=await browser.newContext({locale:'ko-KR',timezoneId:'Asia/Seoul',viewport:{width:480,height:900}});
  const page=await context.newPage();
  page.setDefaultTimeout(25000);
  await openPublicPage(page);
  await dismissCookie(page);

  const sourceUpdatedAt=await readLatestSourceUpdatedAt(page,{sampleMs:5000,intervalMs:500});
  console.log('SOURCE',sourceUpdatedAt);

  await chooseRegion(page,'departure','대한민국');
  await page.getByRole('button',{name:/^ICN 서울\/인천/}).click();
  await page.locator('label[for="bonusTripType_OW"]').click();
  await chooseRegion(page,'destination','미주');
  await page.getByRole('button',{name:/^LAX /}).click();

  await page.locator('#seatCalendarBtn').click();
  const baseYear=Number((await page.locator('#monthCalendarPopup').innerText()).match(/20\d{2}/)?.[0]);
  const [year,month]=kstMonth.split('-').map(Number);
  await page.locator(`#monthCalendarPopup [id="${(year-baseYear)*12+month-1}"]`).click();
  await page.getByRole('button',{name:'선택',exact:true}).click();

  const requestPromise=page.waitForRequest(r=>isPublicApi(r.url()),{timeout:30000});
  const responsePromise=page.waitForResponse(r=>isPublicApi(r.url()),{timeout:30000});
  await page.getByRole('button',{name:'조회',exact:true}).click();
  const [request,response]=await Promise.all([requestPromise,responsePromise]);
  if(!response.ok())throw new Error(`UI control API returned ${response.status()}`);

  const controlBody=JSON.parse(request.postData()||'{}');
  const controlData=await response.json();
  console.log('CONTROL_BODY',JSON.stringify(controlBody));
  console.log('CONTROL',JSON.stringify(summarize(controlData)));

  const same=await directFetch(page,controlBody);
  console.log('DIRECT_SAME',JSON.stringify({status:same.status,...summarize(same.data)}));
  if(same.status!==200||same.data?.departureAirport!==controlData.departureAirport||same.data?.arrivalAirport!==controlData.arrivalAirport){
    throw new Error('Direct same-request replay failed');
  }

  const secondMonth=nextMonth(kstMonth);
  const nextBody={...controlBody,departureDate:secondMonth.replace('-','')+'01'};
  const next=await directFetch(page,nextBody);
  console.log('DIRECT_NEXT_MONTH',JSON.stringify({month:secondMonth,status:next.status,...summarize(next.data)}));
  if(next.status!==200||next.data?.departureAirport!=='ICN'||next.data?.arrivalAirport!=='LAX'){
    throw new Error('Direct next-month query failed');
  }

  const reverseBody={...controlBody,departureAirport:'LAX',arrivalAirport:'ICN'};
  const reverse=await directFetch(page,reverseBody);
  const reverseOk=reverse.status===200&&reverse.data?.departureAirport==='LAX'&&reverse.data?.arrivalAirport==='ICN';
  console.log('DIRECT_REVERSE',JSON.stringify({supported:reverseOk,status:reverse.status,...summarize(reverse.data)}));

  console.log('DIRECT_API_PROBE_RESULT',JSON.stringify({sameRequest:true,nextMonth:true,reverse:reverseOk,sourceUpdatedAt}));
}finally{
  await browser.close();
}
