import {PUBLIC_API} from './public-calendar.mjs';

const target=new URL(PUBLIC_API);
const phaseNames=['init','discovery','query'];
const errorNames=new Set(['Error','TypeError','ReferenceError','SyntaxError','RangeError','URIError','EvalError','AggregateError']);
const methods=new Set(['GET','POST','OPTIONS','HEAD','PUT','PATCH','DELETE']);
const resourceTypes=new Set(['document','stylesheet','script','image','font','xhr','fetch','eventsource','websocket','manifest','other']);
const contentTypes=new Set(['application/json','application/x-www-form-urlencoded','text/plain']);
const MAX_EVENTS=10000,MAX_QUERIES=4,MAX_REQUEST_SAMPLES=2;
const attempt=(fn,fallback=null)=>{try{return fn();}catch{return fallback;}};
const increment=(counts,key)=>{counts[key]=(counts[key]||0)+1;};
const queryCounts=()=>({requests:0,failed:0,status_counts:{}});
const phaseCounts=()=>({page_errors:{},console:{error:0,warning:0},resources:{same_origin:{},other_origin:{},unknown_origin:{}},public_query:queryCounts()});

function location(request){
 const url=attempt(()=>new URL(request.url()));
 return {scope:!url?'unknown_origin':url.origin===target.origin?'same_origin':'other_origin',
  isQuery:!!url&&url.origin===target.origin&&url.pathname===target.pathname};
}

function requestSample(request,expected){
 const method=attempt(()=>request.method());
 const sample={method:methods.has(method)?method:'UNKNOWN',content_type:'UNKNOWN',body_schema:'UNREADABLE',
  departure_airport_matches:null,arrival_airport_matches:null,departure_date_matches:null};
 try{
  const body=request.postData();
  if(body==null||body==='')sample.body_schema='NO_BODY';
  else if(typeof body!=='string')sample.body_schema='UNKNOWN';
  else if(Buffer.byteLength(body,'utf8')>16384)sample.body_schema='OVERSIZED';
  else{
   let data;
   try{data=JSON.parse(body);}catch{sample.body_schema='MALFORMED_JSON';}
   if(sample.body_schema!=='MALFORMED_JSON'){
    if(!data||typeof data!=='object'||Array.isArray(data))sample.body_schema='UNKNOWN';
    else if(!['departureAirport','arrivalAirport','departureDate'].every(key=>typeof data[key]==='string'))sample.body_schema='MISSING_FIELDS';
    else{
     sample.body_schema='KNOWN_FIELDS';
     if(expected){
      sample.departure_airport_matches=data.departureAirport===expected.origin;
      sample.arrival_airport_matches=data.arrivalAirport===expected.destination;
      sample.departure_date_matches=data.departureDate===expected.date;
     }
    }
   }
  }
 }catch{}
 // Read only this allowlisted header. Never obtain the all-headers object,
 // which can contain cookies. This local metadata promise cannot delay output.
 try{
  Promise.resolve(request.headerValue('content-type')).then(value=>{
   if(typeof value!=='string'||value.length>128)return;
   const type=value.split(';',1)[0].trim().toLowerCase();
   if(contentTypes.has(type))sample.content_type=type;
  }).catch(()=>{});
 }catch{}
 return sample;
}

// Passive observation only: no interception, page evaluation, navigation,
// response bodies, raw errors, URLs, header dumps, storage or session capture.
export function watchPublicQueryDiagnostics(page){
 let phase='init',activeQuery=null,expected=null,eventCount=0,disposed=false;
 const requestContexts=new WeakMap(),listeners=[];
 const state={version:1,phase,phases:Object.fromEntries(phaseNames.map(name=>[name,phaseCounts()])),
  queries:[],query_limit_reached:false,event_limit_reached:false};
 function observe(event,handler){
  const listener=value=>{
   if(disposed)return;
   if(eventCount>=MAX_EVENTS){state.event_limit_reached=true;return;}
   eventCount++;
   // Diagnostics must never turn metadata getter failures into collector failures.
   try{handler(value);}catch{}
  };
  page.on(event,listener);listeners.push([event,listener]);
 }
 function context(request){
  return requestContexts.get(request)||{phase,query:null,...location(request)};
 }
 function resource(request,ctx){
  const raw=attempt(()=>request.resourceType()),type=resourceTypes.has(raw)?raw:'other';
  const bucket=state.phases[ctx.phase].resources[ctx.scope];
  return bucket[type]??=( {requested:0,failed:0,http_errors:0} );
 }
 observe('pageerror',error=>{
  const name=attempt(()=>error.name);
  increment(state.phases[phase].page_errors,errorNames.has(name)?name:'UNKNOWN');
 });
 observe('console',message=>{
  const type=message.type();
  if(type==='error'||type==='warning')state.phases[phase].console[type]++;
 });
 observe('request',request=>{
  const ctx={phase,query:activeQuery,...location(request)};
  requestContexts.set(request,ctx);
  resource(request,ctx).requested++;
  if(!ctx.isQuery)return;
  state.phases[ctx.phase].public_query.requests++;
  if(!ctx.query)return;
  ctx.query.request_count++;
  if(ctx.query.requests.length<MAX_REQUEST_SAMPLES)ctx.query.requests.push(requestSample(request,expected));
  else ctx.query.request_limit_reached=true;
 });
 observe('requestfailed',request=>{
  const ctx=context(request);
  resource(request,ctx).failed++;
  if(!ctx.isQuery)return;
  state.phases[ctx.phase].public_query.failed++;
  if(ctx.query)ctx.query.failed++;
 });
 observe('response',response=>{
  const request=response.request(),ctx=context(request),raw=response.status();
  const status=Number.isInteger(raw)&&raw>=100&&raw<=599?String(raw):'UNKNOWN';
  if(status!=='UNKNOWN'&&raw>=400)resource(request,ctx).http_errors++;
  if(!ctx.isQuery)return;
  increment(state.phases[ctx.phase].public_query.status_counts,status);
  if(ctx.query)increment(ctx.query.status_counts,status);
 });
 return {
  setPhase(value){if(phaseNames.includes(value)){phase=value;state.phase=phase;if(value!=='query'){activeQuery=null;expected=null;}}},
  beginQuery(value){
   phase='query';state.phase=phase;
   expected=attempt(()=>typeof value.origin==='string'&&typeof value.destination==='string'&&/^\d{4}-\d{2}$/.test(value.month)?
    {origin:value.origin,destination:value.destination,date:value.month.replace('-','')+'01'}:null);
   if(state.queries.length>=MAX_QUERIES){state.query_limit_reached=true;activeQuery=null;return;}
   activeQuery={request_count:0,requests:[],failed:0,status_counts:{},request_limit_reached:false};
   state.queries.push(activeQuery);
  },
  snapshot(){return JSON.parse(JSON.stringify(state));},
  dispose(){disposed=true;for(const [event,listener] of listeners)attempt(()=>page.off(event,listener));}
 };
}
