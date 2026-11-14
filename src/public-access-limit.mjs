import {PUBLIC_API} from './public-calendar.mjs';

const observedPages=new WeakMap();
const target=new URL(PUBLIC_API);
const contentTypes=new Map([
 ['text/html','HTML'],['application/xhtml+xml','HTML'],
 ['application/json','JSON'],['application/problem+json','JSON']
]);
const errorKeys=['error','code','errorCode','error_code','message','errorMessage','error_message','reason','type','title','detail'];

function errorText(data){
 if(!data||typeof data!=='object'||Array.isArray(data))return '';
 // Inspect only the error envelope, never flight/calendar/inventory branches.
 const envelopes=[data,data.error,...(Array.isArray(data.errors)?data.errors.slice(0,3):[])];
 return envelopes.filter(value=>value&&typeof value==='object'&&!Array.isArray(value))
  .flatMap(value=>errorKeys.map(key=>typeof value[key]==='string'?value[key].slice(0,256):''))
  .join(' ');
}

function denialKind(text,{application=false}={}){
 text=text.replace(/[_-]+/g,' ');
 if(application){
  if(/\b(?:csrf|xsrf)\b|\bsession\s+(?:expired|invalid|required|missing|timeout)\b|\b(?:expired|invalid|missing)\s+session\b/i.test(text))return 'APPLICATION_SESSION_OR_CSRF';
  if(/\bvalidation\b|\binvalid\s+(?:request|parameter|field|input)\b|\b(?:required|missing)\s+(?:required\s+)?(?:field|parameter)\b|\b(?:bad|malformed)\s+request\b/i.test(text))return 'APPLICATION_VALIDATION';
 }
 if(/\baccess\s+denied\b|\brequest\s+(?:was\s+)?(?:blocked|rejected)\b|\bweb\s+application\s+firewall\b|\b403\s+forbidden\b/i.test(text))return 'ACCESS_DENIED';
 return 'UNKNOWN';
}

async function inspectDenial(response,diagnostic){
 try{
  const value=await response.headerValue('content-type');
  const type=typeof value==='string'&&value.length<=128?value.split(';',1)[0].trim().toLowerCase():null;
  if(!contentTypes.has(type))return;
  diagnostic.content_type=type;diagnostic.response_kind=contentTypes.get(type);
  // Read only this already received refusal. Oversized/error bodies never enter
  // a parser, report or log; successful responses are never inspected here.
  const body=await response.body();
  if(body.byteLength>16384)return;
  const text=body.toString('utf8');
  const message=diagnostic.response_kind==='JSON'?errorText(JSON.parse(text)):
   text.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ').replace(/<!--[\s\S]*?-->/g,' ').replace(/<[^>]*>/g,' ');
  diagnostic.denial_kind=denialKind(message,{application:diagnostic.response_kind==='JSON'});
 }catch{}
}

// Status latches synchronously. Optional refusal diagnostics retain only fixed
// enums and an allowlisted media type. Seat data still comes from rendered UI.
export function watchPublicAccess(page){
 if(observedPages.has(page))return observedPages.get(page);
 let blocked=null,diagnostic=null,pendingDiagnostic=null;
 page.on('response',response=>{
  const status=response.status();
  if(blocked||![403,429].includes(status))return;
  const url=new URL(response.url());
  if(url.origin!==target.origin||url.pathname!==target.pathname)return;
  blocked=Object.assign(Error('ACCESS_LIMIT HTTP '+status+': Korean Air public award query refused; stop collection'),
   {code:'ACCESS_LIMIT',httpStatus:status});
  diagnostic={http_status:status,content_type:null,response_kind:'UNKNOWN',denial_kind:'UNKNOWN'};
  pendingDiagnostic=inspectDenial(response,diagnostic);
 });
 const access={
  throwIfBlocked(){if(blocked)throw blocked;},
  async denialDiagnostic(){
   if(!diagnostic)return null;
   let timer;
   try{
    await Promise.race([pendingDiagnostic,new Promise(resolve=>{timer=setTimeout(resolve,1000);})]);
    return {...diagnostic};
   }finally{clearTimeout(timer);}
  }
 };
 observedPages.set(page,access);
 return access;
}
