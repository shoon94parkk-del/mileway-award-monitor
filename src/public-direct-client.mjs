import {PUBLIC_API} from './public-calendar.mjs';

export function buildPublicSeatRequest(template,{origin,destination,month}){
  if(!template||typeof template!=='object'||Array.isArray(template))throw new Error('Direct API request template is required');
  if(!/^[A-Z]{3}$/.test(origin||'')||!/^[A-Z]{3}$/.test(destination||''))throw new Error('Direct API origin/destination must be IATA codes');
  if(!/^\d{4}-\d{2}$/.test(month||''))throw new Error('Direct API month must be YYYY-MM');
  return {...template,departureAirport:origin,arrivalAirport:destination,departureDate:month.replace('-','')+'01'};
}

export function validatePublicSeatResponse(data,{origin,destination,month}){
  if(!data||data.departureAirport!==origin||data.arrivalAirport!==destination||!Array.isArray(data.flightList)){
    throw new Error('Unexpected direct public API route or schema');
  }
  for(const day of data.flightList){
    if(!/^\d{8}$/.test(day?.departureDate||'')||!Array.isArray(day.flightDetailList))throw new Error('Invalid direct public API flight day');
    if(day.departureDate.slice(0,6)!==month.replace('-',''))throw new Error('Direct public API response belongs to a different month');
  }
  return data;
}

export async function queryPublicSeatMonth(page,template,{origin,destination,month,timeoutMs=25000}={}){
  const body=buildPublicSeatRequest(template,{origin,destination,month});
  const result=await page.evaluate(async({url,body,timeoutMs})=>{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const response=await fetch(url,{
        method:'POST',
        credentials:'include',
        headers:{'content-type':'application/json','accept':'application/json, text/plain, */*'},
        body:JSON.stringify(body),
        signal:controller.signal,
      });
      return {status:response.status,text:await response.text()};
    }finally{clearTimeout(timer);}
  },{url:PUBLIC_API,body,timeoutMs});

  if([403,429].includes(result.status))throw new Error(`ACCESS_LIMIT Direct public API returned ${result.status}`);
  if(result.status<200||result.status>=300)throw new Error(`Direct public API returned ${result.status}`);
  let data;
  try{data=JSON.parse(result.text);}catch{throw new Error('Direct public API returned non-JSON response');}
  validatePublicSeatResponse(data,{origin,destination,month});
  return {body,data,status:result.status};
}
