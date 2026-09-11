import http from 'node:http';
import net from 'node:net';
import crypto from 'node:crypto';
import {normalizeAlertRules} from './alert-rules.mjs';

const PORT=Number(process.env.PORT||10000);
const ADMIN_TOKEN=String(process.env.ALERT_ADMIN_TOKEN||'');
const REDIS_HOST=process.env.REDIS_HOST||'red-dahr62ss728c73d89jbg';
const REDIS_PORT=Number(process.env.REDIS_PORT||6379);
const STORE_KEY='mileway:alert-rules:v1';
const ALLOWED_ORIGIN=process.env.ALLOWED_ORIGIN||'https://mileway-award-monitor.onrender.com';

function encodeCommand(parts){return `*${parts.length}\r\n`+parts.map(part=>{const s=String(part);return `$${Buffer.byteLength(s)}\r\n${s}\r\n`;}).join('');}
function redis(parts){return new Promise((resolve,reject)=>{
 const socket=net.createConnection({host:REDIS_HOST,port:REDIS_PORT});
 let buf=Buffer.alloc(0),done=false;
 const finish=(err,value)=>{if(done)return;done=true;socket.destroy();err?reject(err):resolve(value);};
 socket.setTimeout(5000,()=>finish(new Error('Redis timeout')));
 socket.on('error',err=>finish(err));
 socket.on('connect',()=>socket.write(encodeCommand(parts)));
 socket.on('data',chunk=>{
  buf=Buffer.concat([buf,chunk]);
  const text=buf.toString('utf8');
  if(!text.length)return;
  const type=text[0];
  if(type==='+'||type==='-'||type===':'){
   const end=text.indexOf('\r\n');if(end<0)return;
   const value=text.slice(1,end);if(type==='-')finish(new Error(value));else finish(null,type===':'?Number(value):value);return;
  }
  if(type==='$'){
   const end=text.indexOf('\r\n');if(end<0)return;const len=Number(text.slice(1,end));if(len===-1){finish(null,null);return;}
   const start=end+2;if(buf.length<start+len+2)return;finish(null,buf.subarray(start,start+len).toString('utf8'));
  }
 });
 });}

async function readRules(){const raw=await redis(['GET',STORE_KEY]);if(!raw)return [];try{return normalizeAlertRules(JSON.parse(raw));}catch{return [];}}
async function writeRules(rules){const normalized=normalizeAlertRules(rules).slice(0,50);await redis(['SET',STORE_KEY,JSON.stringify(normalized)]);return normalized;}
function json(res,status,value,origin){if(origin)res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.writeHead(status);res.end(JSON.stringify(value));}
function allowedOrigin(req){const origin=req.headers.origin||'';return !origin||origin===ALLOWED_ORIGIN?origin:'';}
function authorized(req){if(!ADMIN_TOKEN)return false;const auth=String(req.headers.authorization||'');const supplied=auth.startsWith('Bearer ')?auth.slice(7):'';const a=Buffer.from(supplied),b=Buffer.from(ADMIN_TOKEN);return a.length===b.length&&a.length>0&&crypto.timingSafeEqual(a,b);}
async function body(req){return new Promise((resolve,reject)=>{let data='';req.on('data',chunk=>{data+=chunk;if(data.length>65536){reject(new Error('Payload too large'));req.destroy();}});req.on('end',()=>{try{resolve(data?JSON.parse(data):{});}catch{reject(new Error('Invalid JSON'));}});req.on('error',reject);});}

const server=http.createServer(async(req,res)=>{
 const origin=allowedOrigin(req);
 if(req.headers.origin&&!origin)return json(res,403,{error:'Origin not allowed'},'');
 if(req.method==='OPTIONS'){if(origin)res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');res.setHeader('Access-Control-Allow-Methods','GET, POST, DELETE, OPTIONS');res.writeHead(204);return res.end();}
 try{
  const url=new URL(req.url||'/','http://localhost');
  if(req.method==='GET'&&url.pathname==='/health'){await redis(['PING']);return json(res,200,{ok:true},origin);}
  if(req.method==='GET'&&url.pathname==='/rules'){const rules=await readRules();return json(res,200,{version:1,rules,updated_at:new Date().toISOString()},origin);}
  if(req.method==='POST'&&url.pathname==='/rules'){
   if(!authorized(req))return json(res,401,{error:'Unauthorized'},origin);
   const input=await body(req),current=await readRules();
   const proposed={id:String(input.id||crypto.randomUUID()),name:input.name,region:input.region,destinations:input.destinations,cabins:input.cabins,start:input.start,end:input.end,weekend:input.weekend,flights:input.flights};
   const rule=normalizeAlertRules([proposed])[0],rules=await writeRules([...current.filter(r=>r.id!==rule.id),rule]);
   return json(res,201,{ok:true,rule,rules},origin);
  }
  if(req.method==='DELETE'&&url.pathname.startsWith('/rules/')){
   if(!authorized(req))return json(res,401,{error:'Unauthorized'},origin);
   const id=decodeURIComponent(url.pathname.slice('/rules/'.length)),current=await readRules(),rules=await writeRules(current.filter(r=>r.id!==id));
   return json(res,200,{ok:true,rules},origin);
  }
  return json(res,404,{error:'Not found'},origin);
 }catch(error){console.error(error);return json(res,500,{error:'Server error'},origin);}
});
redis(['PING']).then(()=>console.log('Mileway alert store ready')).catch(error=>console.error(`Alert store unavailable: ${error.message}`));
server.listen(PORT,'0.0.0.0',()=>console.log(`Mileway alert API listening on ${PORT}`));
