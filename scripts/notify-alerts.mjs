import fs from 'node:fs';
import path from 'node:path';
import {normalizeAlertRules,evaluateAlerts} from '../src/alert-rules.mjs';

const arg=name=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:null;};
const snapshotPath=path.resolve(arg('--snapshot')||'public-data/snapshot.json');
const statePath=path.resolve(arg('--state')||'public-data/alert-state.json');
const escHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const readJson=file=>fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{};
const cabin=row=>row.cabin==='FIRST'?'일등석':'프레스티지';
const rowText=row=>`${row.date} · ${row.destination} · ${row.flight}${row.time?' '+row.time:''} · ${cabin(row)}`;

function buildMessages(opened,sourceUpdatedAt){
 return opened.map(({rule,rows})=>{
  const visible=rows.slice(0,12),more=rows.length-visible.length;
  const lines=visible.map(row=>`• ${rowText(row)}`);
  if(more)lines.push(`• 외 ${more}건`);
  return {subject:`[Mileway] ${rule.name} 좌석 ${rows.length}건`,text:`🔔 ${rule.name}\n${lines.join('\n')}\n\n대한항공 공개 일일 자료 기준: ${sourceUpdatedAt}\n예약 전 대한항공에서 최종 확인해 주세요.`};
 });
}

async function sendTelegram(messages){
 const token=process.env.TELEGRAM_BOT_TOKEN,chatId=process.env.TELEGRAM_CHAT_ID;
 if(!token||!chatId)return false;
 for(const message of messages){
  const res=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chatId,text:message.text,disable_web_page_preview:true})});
  if(!res.ok)throw new Error(`Telegram 알림 전송 실패 (${res.status})`);
 }
 return true;
}

async function sendEmail(messages){
 const key=process.env.RESEND_API_KEY,to=process.env.ALERT_EMAIL_TO,from=process.env.ALERT_EMAIL_FROM;
 if(!key||!to||!from)return false;
 for(const message of messages){
  const html=`<div style="font-family:Arial,sans-serif;line-height:1.6;white-space:pre-line">${escHtml(message.text)}</div>`;
  const res=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':`mileway-${Buffer.from(message.subject).toString('base64url').slice(0,80)}`},body:JSON.stringify({from,to:[to],subject:message.subject,html})});
  if(!res.ok)throw new Error(`Email 알림 전송 실패 (${res.status})`);
 }
 return true;
}

async function main(){
 const rawRules=process.env.ALERT_RULES_JSON;
 if(!rawRules){console.log('ALERT_RULES_JSON 미설정: 좌석 알림을 건너뜁니다.');return;}
 const telegramReady=!!(process.env.TELEGRAM_BOT_TOKEN&&process.env.TELEGRAM_CHAT_ID);
 const emailReady=!!(process.env.RESEND_API_KEY&&process.env.ALERT_EMAIL_TO&&process.env.ALERT_EMAIL_FROM);
 if(!telegramReady&&!emailReady){console.log('알림 채널 미설정: 상태를 변경하지 않고 건너뜁니다.');return;}
 const snapshot=readJson(snapshotPath),rows=Array.isArray(snapshot.rows)?snapshot.rows:[];
 const sourceUpdatedAt=snapshot.bootstrap?.report?.source_updated_at||snapshot.report?.source_updated_at||'미확인';
 const rules=normalizeAlertRules(rawRules),previous=readJson(statePath),result=evaluateAlerts(rows,rules,previous);
 const messages=buildMessages(result.opened,sourceUpdatedAt);
 if(messages.length){
  const sent=[];
  if(await sendTelegram(messages))sent.push('Telegram');
  if(await sendEmail(messages))sent.push('Email');
  console.log(`${sent.join(' + ')}: ${result.opened.reduce((n,x)=>n+x.rows.length,0)}개 신규 조건 일치 좌석 알림 전송`);
 }else console.log('새롭게 조건에 맞는 좌석 없음');
 fs.mkdirSync(path.dirname(statePath),{recursive:true});
 fs.writeFileSync(statePath,JSON.stringify({version:1,rule_hash:result.rule_hash,source_updated_at:sourceUpdatedAt,active:result.active,updated_at:new Date().toISOString()},null,2)+'\n');
}

main().catch(error=>{console.error(error.message);process.exitCode=1;});
