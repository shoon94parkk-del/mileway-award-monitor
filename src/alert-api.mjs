import http from 'node:http';
import net from 'node:net';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {normalizeAlertRules,evaluateAlerts,alertSeatKey} from './alert-rules.mjs';
import {formatAlertRow} from './alert-display.mjs';

const PORT=Number(process.env.PORT||10000);
const ADMIN_TOKEN=String(process.env.ALERT_ADMIN_TOKEN||'');
const PAIR_CODE=String(process.env.ALERT_PAIR_CODE||'');
const REDIS_HOST=process.env.REDIS_HOST||'red-dahr62ss728c73d89jbg';
const REDIS_PORT=Number(process.env.REDIS_PORT||6379);
const LEGACY_STORE_KEY='mileway:alert-rules:v1';
const LEGACY_STATE_KEY='mileway:alert-state:legacy:v2';
const OWNERS_KEY='mileway:alert-owners:v2';
const RULE_PREFIX='mileway:alert-rules:v2:';
const STATE_PREFIX='mileway:alert-state:v2:';
const DEVICE_PREFIX='mileway:device-token:';
const LINK_PREFIX='mileway:telegram-link:';
const PAIR_USED_PREFIX='mileway:pair-used:';
const TELEGRAM_CONFIG_KEY='mileway:telegram-direct-config:v2';
const OUTBOX_PREFIX='mileway:alert-outbox:v1:';
const NOTIFY_LOCK_PREFIX='mileway:notify-lock:v1:';
const WEBHOOK_UPDATE_PREFIX='mileway:telegram-update:v1:';
const ALLOWED_ORIGIN=process.env.ALLOWED_ORIGIN||'https://mileway-award-monitor.onrender.com';
const PUBLIC_API_URL=process.env.PUBLIC_API_URL||'https://mileway-alert-api.onrender.com';
const BACKUP_URL=process.env.ALERT_BACKUP_URL||'https://raw.githubusercontent.com/shoon94parkk-del/mileway-award-monitor/ops-state/ops/alerts.enc.json';
const APP_COMMIT=process.env.RENDER_GIT_COMMIT||process.env.GIT_COMMIT||'unknown';
const CONFIG_SECRET=ADMIN_TOKEN||PAIR_CODE;
const CONFIG_CONTEXT='mileway.telegram.direct-config.v2';

function encodeCommand(parts){return `*${parts.length}\r\n`+parts.map(part=>{const s=String(part);return `$${Buffer.byteLength(s)}\r\n${s}\r\n`;}).join('');}
function redis(parts){return new Promise((resolve,reject)=>{
 const socket=net.createConnection({host:REDIS_HOST,port:REDIS_PORT});
 let buf=Buffer.alloc(0),done=false;
 const finish=(err,value)=>{if(done)return;done=true;socket.destroy();err?reject(err):resolve(value);};
 socket.setTimeout(5000,()=>finish(new Error('Redis timeout')));
 socket.on('error',err=>finish(err));
 socket.on('connect',()=>socket.write(encodeCommand(parts)));
 socket.on('data',chunk=>{
  buf=Buffer.concat([buf,chunk]);const text=buf.toString('utf8');if(!text.length)return;const type=text[0];
  if(type==='+'||type==='-'||type===':'){const end=text.indexOf('\r\n');if(end<0)return;const value=text.slice(1,end);if(type==='-')finish(new Error(value));else finish(null,type===':'?Number(value):value);return;}
  if(type==='$'){const end=text.indexOf('\r\n');if(end<0)return;const len=Number(text.slice(1,end));if(len===-1){finish(null,null);return;}const start=end+2;if(buf.length<start+len+2)return;finish(null,buf.subarray(start,start+len).toString('utf8'));}
 });
 });}
const digest=value=>crypto.createHash('sha256').update(String(value)).digest('hex');
const safeEqual=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&x.length>0&&crypto.timingSafeEqual(x,y);};
const parseJson=(raw,fallback=null)=>{try{return raw?JSON.parse(raw):fallback;}catch{return fallback;}};
async function fetchWithTimeout(url,options={},timeoutMs=10000){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);try{return await fetch(url,{...options,signal:controller.signal});}finally{clearTimeout(timer);}}

function configKey(){if(!CONFIG_SECRET)return null;return crypto.createHash('sha256').update(CONFIG_CONTEXT).update('\0').update(CONFIG_SECRET).digest();}
function sealConfig(value){const key=configKey();if(!key)throw new Error('Alert encryption secret unavailable');const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv),plain=Buffer.from(JSON.stringify(value),'utf8'),ciphertext=Buffer.concat([cipher.update(plain),cipher.final()]);return {version:2,iv:iv.toString('base64url'),tag:cipher.getAuthTag().toString('base64url'),ciphertext:ciphertext.toString('base64url')};}
function openConfig(record){const key=configKey();if(!key||!record||record.version!==2)return null;try{const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(record.iv,'base64url'));decipher.setAuthTag(Buffer.from(record.tag,'base64url'));return JSON.parse(Buffer.concat([decipher.update(Buffer.from(record.ciphertext,'base64url')),decipher.final()]).toString('utf8'));}catch{return null;}}

async function readOwners(){const value=parseJson(await redis(['GET',OWNERS_KEY]),[]);return Array.isArray(value)?value.filter(x=>/^[a-f0-9]{64}$/.test(String(x))):[];}
async function addOwner(owner){const owners=await readOwners();if(!owners.includes(owner)){owners.push(owner);await redis(['SET',OWNERS_KEY,JSON.stringify(owners.slice(-5000))]);}return owners;}
async function readDevice(owner){const raw=await redis(['GET',DEVICE_PREFIX+owner]);if(!raw)return null;if(raw==='1')return {version:1,legacy:true};return openConfig(parseJson(raw))||null;}
async function writeDevice(owner,record){await redis(['SET',DEVICE_PREFIX+owner,JSON.stringify(sealConfig({...record,version:2}))]);await addOwner(owner);}
async function readRules(owner,{migrateLegacy=false}={}){
 const raw=await redis(['GET',RULE_PREFIX+owner]);if(raw)return normalizeAlertRules(parseJson(raw,[]));
 if(migrateLegacy){const legacy=await redis(['GET',LEGACY_STORE_KEY]);if(legacy){const rules=normalizeAlertRules(parseJson(legacy,[]));await writeRules(owner,rules);await redis(['DEL',LEGACY_STORE_KEY]);await redis(['DEL',LEGACY_STATE_KEY]);return rules;}}
 return [];
}
async function writeRules(owner,rules){const normalized=normalizeAlertRules(rules).slice(0,50);await redis(['SET',RULE_PREFIX+owner,JSON.stringify(normalized)]);await addOwner(owner);return normalized;}
async function readState(owner){return parseJson(await redis(['GET',STATE_PREFIX+owner]),{});}
async function writeState(owner,state){await redis(['SET',STATE_PREFIX+owner,JSON.stringify(state)]);}

async function telegramApi(token,method,payload=null){const res=await fetchWithTimeout(`https://api.telegram.org/bot${token}/${method}`,payload?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}:{},10000);let data=null;try{data=await res.json();}catch{}if(!res.ok||!data?.ok)throw new Error(`Telegram ${method} 요청 실패`);return data.result;}
function expectedBotUsername(){try{return String(JSON.parse(fs.readFileSync('public-data/telegram-target.json','utf8'))?.bot_username||'');}catch{return '';}}
async function writeTelegramConfig(config){await redis(['SET',TELEGRAM_CONFIG_KEY,JSON.stringify(sealConfig(config))]);}
async function readTelegramConfig(){const raw=await redis(['GET',TELEGRAM_CONFIG_KEY]);if(!raw)return null;return openConfig(parseJson(raw));}
async function bootstrapTelegram(input){
 const token=String(input?.token||''),defaultChatId=String(input?.chat_id||''),claimed=String(input?.bot_username||'');if(!token)throw new Error('Telegram bootstrap data missing');
 const me=await telegramApi(token,'getMe'),username=String(me?.username||''),expected=expectedBotUsername();
 if(!username||(expected&&username!==expected)||(claimed&&username!==claimed))throw new Error('Telegram bot identity mismatch');
 const prior=await readTelegramConfig(),webhookSecret=prior?.webhook_secret||crypto.randomBytes(24).toString('base64url');
 const config={token,default_chat_id:defaultChatId||prior?.default_chat_id||'',bot_username:username,webhook_secret:webhookSecret,updated_at:new Date().toISOString()};
 await writeTelegramConfig(config);
 await telegramApi(token,'setWebhook',{url:`${PUBLIC_API_URL}/telegram/webhook`,secret_token:webhookSecret,allowed_updates:['message'],drop_pending_updates:false});
 return {bot_username:username,chat_registered:!!config.default_chat_id,webhook:true};
}
async function chatForOwner(owner){const device=await readDevice(owner),config=await readTelegramConfig();if(device?.chat_id)return {chatId:String(device.chat_id),token:config?.token||'',bot_username:config?.bot_username||''};if(device?.legacy&&config?.default_chat_id)return {chatId:String(config.default_chat_id),token:config.token||'',bot_username:config.bot_username||''};return {chatId:'',token:config?.token||'',bot_username:config?.bot_username||''};}
async function sendDirectTelegram(owner,text){const target=await chatForOwner(owner);if(!target.token||!target.chatId)return {sent:false,reason:'telegram_not_linked'};await telegramApi(target.token,'sendMessage',{chat_id:target.chatId,text,disable_web_page_preview:true});return {sent:true,bot_username:target.bot_username||null};}

async function createDevice(){const token=crypto.randomBytes(32).toString('base64url'),owner=digest(token);await writeDevice(owner,{created_at:new Date().toISOString(),legacy:false});return {token,owner};}
async function pairDevice(code){
 if(!PAIR_CODE||!safeEqual(code,PAIR_CODE))return {status:401,error:'연결 코드가 올바르지 않습니다.'};
 const usedKey=PAIR_USED_PREFIX+digest(PAIR_CODE),first=await redis(['SETNX',usedKey,'1']);if(first!==1)return {status:410,error:'이 연결 링크는 이미 사용됐습니다.'};
 const token=crypto.randomBytes(32).toString('base64url'),owner=digest(token);await writeDevice(owner,{created_at:new Date().toISOString(),legacy:true});return {status:200,token};
}
async function authContext(req){
 const auth=String(req.headers.authorization||''),supplied=auth.startsWith('Bearer ')?auth.slice(7):'';if(!supplied)return null;
 const owner=digest(supplied);
 if(ADMIN_TOKEN&&safeEqual(supplied,ADMIN_TOKEN)){if(!(await readDevice(owner)))await writeDevice(owner,{created_at:new Date().toISOString(),legacy:true});return {owner,admin:true,legacy:true};}
 const device=await readDevice(owner);if(!device)return null;await addOwner(owner);return {owner,admin:false,legacy:!!device.legacy};
}
async function internalAuthorized(req){
 const auth=String(req.headers.authorization||''),supplied=auth.startsWith('Bearer ')?auth.slice(7):'';if(!supplied)return false;
 if(ADMIN_TOKEN&&safeEqual(supplied,ADMIN_TOKEN))return true;
 const config=await readTelegramConfig();if(config?.token&&safeEqual(supplied,config.token))return true;
 try{const me=await telegramApi(supplied,'getMe'),expected=expectedBotUsername();return !!(me?.username&&expected&&me.username===expected);}catch{return false;}
}
async function createTelegramLink(owner){const config=await readTelegramConfig();if(!config?.bot_username)throw new Error('Telegram bot is not ready');const code=crypto.randomBytes(9).toString('base64url');await redis(['SETEX',LINK_PREFIX+code,'900',JSON.stringify({owner,created_at:new Date().toISOString()})]);return {code,bot_username:config.bot_username,url:`https://t.me/${config.bot_username}?start=mw_${code}`};}
async function bindTelegramLink(code,chatId){const key=LINK_PREFIX+String(code||'').replace(/^mw_/,'');const link=parseJson(await redis(['GET',key]));if(!link?.owner||!chatId)return false;const current=await readDevice(link.owner)||{};await writeDevice(link.owner,{...current,legacy:false,chat_id:String(chatId),telegram_linked_at:new Date().toISOString()});await redis(['DEL',key]);return true;}
async function handleTelegramWebhook(req,input){
 const config=await readTelegramConfig(),secret=String(req.headers['x-telegram-bot-api-secret-token']||'');if(!config?.webhook_secret||!safeEqual(secret,config.webhook_secret))return false;
 const updateId=String(input?.update_id??'');
 if(updateId){const claimed=await redis(['SET',WEBHOOK_UPDATE_PREFIX+updateId,'1','NX','EX','86400']);if(claimed!=='OK')return true;}
 const msg=input?.message,text=String(msg?.text||''),chatId=String(msg?.chat?.id||'');const match=text.match(/^\/start(?:@\w+)?\s+mw_([A-Za-z0-9_-]+)$/);
 if(match&&chatId){const linked=await bindTelegramLink(match[1],chatId);if(linked)await telegramApi(config.token,'sendMessage',{chat_id:chatId,text:'✅ Mileway Telegram 연결 완료\n이제 사이트에서 등록한 좌석 알림이 이 채팅으로 즉시 도착합니다.'});return true;}
 if(/^\/start(?:@\w+)?$/.test(text)&&chatId){await telegramApi(config.token,'sendMessage',{chat_id:chatId,text:'Mileway 사이트의 알림 화면에서 “Telegram 연결”을 누르면 이 채팅을 안전하게 연결할 수 있습니다.'});return true;}
 return true;
}

const rowText=row=>formatAlertRow(row);
function buildMessages(opened,sourceUpdatedAt,publicationId){return opened.map(({rule,rows})=>{const visible=rows.slice(0,12),more=rows.length-visible.length,lines=visible.map(row=>`• ${rowText(row)}`);if(more)lines.push(`• 외 ${more}건`);const ids=rows.map(alertSeatKey).sort().join(','),version=publicationId||sourceUpdatedAt;return {text:`🔔 ${rule.name}\n${lines.join('\n')}\n\n대한항공 공개 일일 자료 기준: ${sourceUpdatedAt}\n예약 전 대한항공에서 최종 확인해 주세요.`,idempotency:`${version}|${rule.id}|${ids}`};});}
async function deliverOutbox(owner,target,message){
 const key=OUTBOX_PREFIX+owner+':'+digest(message.idempotency),existing=await redis(['GET',key]);
 if(existing==='sent')return 'already_sent';
 if(existing==='processing')throw new Error('동일 알림 메시지가 아직 처리 중입니다.');
 const claimed=await redis(['SET',key,'processing','NX','EX','300']);if(claimed!=='OK')throw new Error('동일 알림 메시지 claim 충돌');
 try{await telegramApi(target.token,'sendMessage',{chat_id:target.chatId,text:message.text,disable_web_page_preview:true});await redis(['SETEX',key,String(14*86400),'sent']);return 'sent';}
 catch(error){await redis(['DEL',key]);throw error;}
}
async function acquireNotifyLock(owner){const key=NOTIFY_LOCK_PREFIX+owner,token=crypto.randomBytes(16).toString('hex'),claimed=await redis(['SET',key,token,'NX','EX','180']);return claimed==='OK'?{key,token}:null;}
async function releaseNotifyLock(lock){if(!lock)return;await redis(['EVAL','if redis.call("get",KEYS[1]) == ARGV[1] then return redis.call("del",KEYS[1]) else return 0 end','1',lock.key,lock.token]);}
async function sendEvaluatedRules(owner,rows,rules,prior,sourceUpdatedAt,publicationId,target,context){
 const result=evaluateAlerts(rows,rules,prior,context),messages=buildMessages(result.opened,sourceUpdatedAt,publicationId);
 let sentMessages=0;
 for(const message of messages){const delivery=await deliverOutbox(owner,target,message);if(delivery==='sent')sentMessages++;}
 return {result,sentSeats:result.opened.reduce((n,x)=>n+x.rows.length,0),sentMessages};
}
function persistedAlertState(result,sourceUpdatedAt,publicationId){return {version:4,rule_hash:result.rule_hash,rule_meta:result.rule_meta,active:result.active,active_rows:result.active_rows,source_updated_at:sourceUpdatedAt,publication_id:publicationId||null,updated_at:new Date().toISOString()};}
async function notifyAll(input){
 const rows=Array.isArray(input?.rows)?input.rows:[],sourceUpdatedAt=String(input?.source_updated_at||'미확인'),publicationId=String(input?.publication_id||''),context={coverage:Array.isArray(input?.coverage)?input.coverage:[],unqueryable:Array.isArray(input?.unqueryable)?input.unqueryable:[]},owners=await readOwners();
 let users=0,sentSeats=0,unknownPreserved=0,skippedUnlinked=0,skippedLocked=0,failures=[];
 const legacyRules=normalizeAlertRules(parseJson(await redis(['GET',LEGACY_STORE_KEY]),[]));
 if(legacyRules.length){const config=await readTelegramConfig();if(config?.token&&config?.default_chat_id){const lock=await acquireNotifyLock('legacy');if(!lock)skippedLocked++;else try{const prior=parseJson(await redis(['GET',LEGACY_STATE_KEY]),{}),sent=await sendEvaluatedRules('legacy',rows,legacyRules,prior,sourceUpdatedAt,publicationId,{token:config.token,chatId:String(config.default_chat_id)},context);await redis(['SET',LEGACY_STATE_KEY,JSON.stringify(persistedAlertState(sent.result,sourceUpdatedAt,publicationId))]);users++;sentSeats+=sent.sentSeats;unknownPreserved+=sent.result.unknown_preserved||0;}catch(error){failures.push(`legacy: ${error.message}`);}finally{await releaseNotifyLock(lock);}}else skippedUnlinked++;}
 for(const owner of owners){
  const rules=await readRules(owner);if(!rules.length)continue;
  const target=await chatForOwner(owner);if(!target.chatId||!target.token){skippedUnlinked++;continue;}
  const lock=await acquireNotifyLock(owner);if(!lock){skippedLocked++;continue;}
  try{const prior=await readState(owner),sent=await sendEvaluatedRules(owner,rows,rules,prior,sourceUpdatedAt,publicationId,target,context);await writeState(owner,persistedAlertState(sent.result,sourceUpdatedAt,publicationId));users++;sentSeats+=sent.sentSeats;unknownPreserved+=sent.result.unknown_preserved||0;}
  catch(error){failures.push(error.message);}finally{await releaseNotifyLock(lock);}
 }
 return {users,sent_seats:sentSeats,unknown_preserved:unknownPreserved,skipped_unlinked:skippedUnlinked,skipped_locked:skippedLocked,failures};
}

async function buildEncryptedBackup(){const owners=await readOwners(),devices={},rules={},states={};for(const owner of owners){devices[owner]=await redis(['GET',DEVICE_PREFIX+owner]);rules[owner]=await redis(['GET',RULE_PREFIX+owner]);states[owner]=await redis(['GET',STATE_PREFIX+owner]);}const payload={version:2,created_at:new Date().toISOString(),owners,devices,rules,states,legacy_store:await redis(['GET',LEGACY_STORE_KEY]),legacy_state:await redis(['GET',LEGACY_STATE_KEY]),telegram_config:await redis(['GET',TELEGRAM_CONFIG_KEY])};return sealConfig(payload);}
async function restoreBackupIfEmpty(){
 try{await redis(['PING']);const owners=await redis(['GET',OWNERS_KEY]);if(owners)return false;const res=await fetchWithTimeout(BACKUP_URL+'?t='+Date.now(),{cache:'no-store'},10000);if(!res.ok)return false;const record=await res.json(),payload=openConfig(record);if(!payload||payload.version!==2||!Array.isArray(payload.owners))return false;await redis(['SET',OWNERS_KEY,JSON.stringify(payload.owners)]);for(const owner of payload.owners){if(payload.devices?.[owner])await redis(['SET',DEVICE_PREFIX+owner,payload.devices[owner]]);if(payload.rules?.[owner])await redis(['SET',RULE_PREFIX+owner,payload.rules[owner]]);if(payload.states?.[owner])await redis(['SET',STATE_PREFIX+owner,payload.states[owner]]);}if(payload.legacy_store)await redis(['SET',LEGACY_STORE_KEY,payload.legacy_store]);if(payload.legacy_state)await redis(['SET',LEGACY_STATE_KEY,payload.legacy_state]);if(payload.telegram_config)await redis(['SET',TELEGRAM_CONFIG_KEY,payload.telegram_config]);console.log(`Restored encrypted alert backup for ${payload.owners.length} device(s).`);return true;}catch(error){console.log(`Alert backup restore skipped: ${error.message}`);return false;}
}

function json(res,status,value,origin){if(origin)res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.writeHead(status);res.end(JSON.stringify(value));}
function allowedOrigin(req){const origin=req.headers.origin||'';return !origin||origin===ALLOWED_ORIGIN?origin:'';}
async function body(req){return new Promise((resolve,reject)=>{let data='';req.on('data',chunk=>{data+=chunk;if(data.length>2_000_000){reject(new Error('Payload too large'));req.destroy();}});req.on('end',()=>{try{resolve(data?JSON.parse(data):{});}catch{reject(new Error('Invalid JSON'));}});req.on('error',reject);});}

const restorePromise=restoreBackupIfEmpty();
const server=http.createServer(async(req,res)=>{
 const origin=allowedOrigin(req);if(req.headers.origin&&!origin)return json(res,403,{error:'Origin not allowed'},'');
 if(req.method==='OPTIONS'){if(origin)res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');res.setHeader('Access-Control-Allow-Methods','GET, POST, DELETE, OPTIONS');res.writeHead(204);return res.end();}
 try{
  await restorePromise;const url=new URL(req.url||'/','http://localhost');
  if(req.method==='GET'&&url.pathname==='/health'){await redis(['PING']);const telegram=await readTelegramConfig();return json(res,200,{ok:true,commit:APP_COMMIT,storage_ready:true,telegram_direct_configured:!!telegram?.token,webhook_configured:!!telegram?.webhook_secret,storage_backup:'encrypted-ops-branch'},origin);}
  if(req.method==='GET'&&url.pathname==='/version'){return json(res,200,{service:'mileway-alert-api',commit:APP_COMMIT,schema_version:4},origin);}
  if(req.method==='POST'&&url.pathname==='/device'){const device=await createDevice();return json(res,201,{ok:true,token:device.token},origin);}
  if(req.method==='POST'&&url.pathname==='/pair'){const input=await body(req),result=await pairDevice(String(input.code||''));if(result.error)return json(res,result.status,{error:result.error},origin);return json(res,200,{ok:true,token:result.token},origin);}
  if(req.method==='POST'&&url.pathname==='/telegram/bootstrap'){const result=await bootstrapTelegram(await body(req));return json(res,200,{ok:true,...result},origin);}
  if(req.method==='POST'&&url.pathname==='/telegram/webhook'){const input=await body(req),ok=await handleTelegramWebhook(req,input);return json(res,ok?200:401,{ok},'');}
  if(req.method==='GET'&&url.pathname==='/me'){const ctx=await authContext(req);if(!ctx)return json(res,401,{error:'Unauthorized'},origin);const target=await chatForOwner(ctx.owner),rules=await readRules(ctx.owner,{migrateLegacy:ctx.legacy});return json(res,200,{ok:true,telegram_linked:!!target.chatId,bot_username:target.bot_username||null,rule_count:rules.length},origin);}
  if(req.method==='POST'&&url.pathname==='/telegram/link'){const ctx=await authContext(req);if(!ctx)return json(res,401,{error:'Unauthorized'},origin);return json(res,200,{ok:true,...await createTelegramLink(ctx.owner)},origin);}
  if(req.method==='POST'&&url.pathname==='/telegram-test'){const ctx=await authContext(req);if(!ctx)return json(res,401,{error:'Unauthorized'},origin);const now=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'medium',timeStyle:'short'}).format(new Date()),direct=await sendDirectTelegram(ctx.owner,`✅ Mileway 실제 알림 테스트 성공\n${now} (한국시간)\n\n이 메시지가 보이면 Telegram 좌석 알림이 정상입니다.`);if(!direct.sent)return json(res,409,{error:'Telegram 연결이 필요합니다.'},origin);return json(res,200,{ok:true,sent:true,mode:'direct',bot_username:direct.bot_username},origin);}
  if(req.method==='GET'&&url.pathname==='/rules'){const ctx=await authContext(req);if(!ctx)return json(res,401,{error:'Unauthorized'},origin);const rules=await readRules(ctx.owner,{migrateLegacy:ctx.legacy});return json(res,200,{version:3,rules,updated_at:new Date().toISOString()},origin);}
  if(req.method==='POST'&&url.pathname==='/rules'){const ctx=await authContext(req);if(!ctx)return json(res,401,{error:'Unauthorized'},origin);const input=await body(req),current=await readRules(ctx.owner,{migrateLegacy:ctx.legacy}),proposed={id:String(input.id||crypto.randomUUID()),name:input.name,region:input.region,region_id:input.region_id,destinations:input.destinations,cabins:input.cabins,start:input.start,end:input.end,weekend:input.weekend,flights:input.flights},rule=normalizeAlertRules([proposed])[0],rules=await writeRules(ctx.owner,[...current.filter(r=>r.id!==rule.id),rule]);return json(res,201,{ok:true,rule,rules},origin);}
  if(req.method==='DELETE'&&url.pathname.startsWith('/rules/')){const ctx=await authContext(req);if(!ctx)return json(res,401,{error:'Unauthorized'},origin);const id=decodeURIComponent(url.pathname.slice('/rules/'.length)),current=await readRules(ctx.owner,{migrateLegacy:ctx.legacy}),rules=await writeRules(ctx.owner,current.filter(r=>r.id!==id));return json(res,200,{ok:true,rules},origin);}
  if(req.method==='POST'&&url.pathname==='/internal/notify'){if(!(await internalAuthorized(req)))return json(res,401,{error:'Unauthorized'},origin);const result=await notifyAll(await body(req));return json(res,result.failures.length?207:200,{ok:!result.failures.length,...result},origin);}
  if(req.method==='GET'&&url.pathname==='/internal/backup'){if(!(await internalAuthorized(req)))return json(res,401,{error:'Unauthorized'},origin);return json(res,200,await buildEncryptedBackup(),origin);}
  return json(res,404,{error:'Not found'},origin);
 }catch(error){console.error(error);return json(res,500,{error:error?.message==='Payload too large'?'Payload too large':'Server error'},origin);}
});
restorePromise.then(()=>redis(['PING'])).then(()=>console.log('Mileway alert store ready')).catch(error=>console.error(`Alert store unavailable: ${error.message}`));
server.listen(PORT,'0.0.0.0',()=>console.log(`Mileway alert API listening on ${PORT}`));