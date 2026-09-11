import fs from 'node:fs';
import path from 'node:path';
import {normalizeAlertRules,evaluateAlerts,alertSeatKey} from '../src/alert-rules.mjs';
import {resolveTelegramTarget,sendTelegramText} from './telegram-target.mjs';
import {readTelegramRules} from './telegram-rule-commands.mjs';

const arg=name=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:null;};
const has=name=>process.argv.includes(name);
const snapshotPath=path.resolve(arg('--snapshot')||'public-data/snapshot.json');
const statePath=path.resolve(arg('--state')||'public-data/alert-state.json');
const escHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const readJson=file=>fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{};
const cabin=row=>row.cabin==='FIRST'?'일등석':'프레스티지';
const rowText=row=>`${row.date} · ${row.destination} · ${row.flight}${row.time?' '+row.time:''} · ${cabin(row)}`;

function buildMessages(opened,sourceUpdatedAt){
 return opened.map(({rule,rows})=>{const visible=rows.slice(0,12),more=rows.length-visible.length;const lines=visible.map(row=>`• ${rowText(row)}`);if(more)lines.push(`• 외 ${more}건`);const ids=rows.map(alertSeatKey).sort().join(',');return {subject:`[Mileway] ${rule.name} 좌석 ${rows.length}건`,text:`🔔 ${rule.name}\n${lines.join('\n')}\n\n대한항공 공개 일일 자료 기준: ${sourceUpdatedAt}\n예약 전 대한항공에서 최종 확인해 주세요.`,idempotency:`${sourceUpdatedAt}|${rule.id}|${ids}`};});
}
async function sendTelegram(messages,token,chatId){if(!token||!chatId)return false;for(const message of messages)await sendTelegramText(token,chatId,message.text);return true;}
async function sendEmail(messages){const key=process.env.RESEND_API_KEY,to=process.env.ALERT_EMAIL_TO,from=process.env.ALERT_EMAIL_FROM;if(!key||!to||!from)return false;for(const message of messages){const html=`<div style="font-family:Arial,sans-serif;line-height:1.6;white-space:pre-line">${escHtml(message.text)}</div>`;const idem=Buffer.from(message.idempotency).toString('base64url').slice(0,100);const res=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':`mileway-${idem}`},body:JSON.stringify({from,to:[to],subject:message.subject,html})});if(!res.ok)throw new Error(`Email 알림 전송 실패 (${res.status})`);}return true;}
function channelState(result,sourceUpdatedAt){return {version:2,rule_hash:result.rule_hash,rule_meta:result.rule_meta,active:result.active,source_updated_at:sourceUpdatedAt,updated_at:new Date().toISOString()};}

async function main(){
 const telegramToken=process.env.TELEGRAM_BOT_TOKEN||'';let telegramTarget={chatId:null,bot_username:null,source:'none'};
 if(telegramToken){try{telegramTarget=await resolveTelegramTarget(telegramToken,{explicitChatId:process.env.TELEGRAM_CHAT_ID||'',allowDiscover:true});}catch(error){console.error(`Telegram 연결 확인 실패: ${error.message}`);}}
 const telegramReady=!!(telegramToken&&telegramTarget.chatId),emailReady=!!(process.env.RESEND_API_KEY&&process.env.ALERT_EMAIL_TO&&process.env.ALERT_EMAIL_FROM);
 if(telegramToken&&!telegramReady)console.log('Telegram Bot Token은 있지만 대상 채팅이 아직 없습니다. 봇을 열고 Start를 누르면 다음 실행에서 자동 연결됩니다.');
 if(has('--test')){if(!telegramReady&&!emailReady)throw new Error('알림 채널이 설정되지 않았습니다.');const now=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'medium',timeStyle:'short'}).format(new Date());const messages=[{subject:'[Mileway] 알림 테스트',text:`✅ Mileway 좌석 알림 테스트 성공\n${now} (한국시간)\n\n이 메시지가 보이면 알림 채널 설정이 정상입니다.`,idempotency:`test-${Date.now()}`}];const sent=[];if(telegramReady&&await sendTelegram(messages,telegramToken,telegramTarget.chatId))sent.push('Telegram');if(emailReady&&await sendEmail(messages))sent.push('Email');console.log(`알림 테스트 성공: ${sent.join(' + ')}`);return;}
 let rules=[];try{const fromSecret=process.env.ALERT_RULES_JSON?normalizeAlertRules(process.env.ALERT_RULES_JSON):[];const fromTelegram=readTelegramRules();const map=new Map([...fromSecret,...fromTelegram].map(r=>[r.id,r]));rules=[...map.values()];}catch(error){throw new Error(`알림 규칙 읽기 실패: ${error.message}`);}
 if(!rules.length){console.log('활성 알림 규칙 없음: 좌석 알림을 건너뜁니다.');return;}
 if(!telegramReady&&!emailReady){console.log('알림 채널 미설정: 상태를 변경하지 않고 건너뜁니다.');return;}
 const snapshot=readJson(snapshotPath),rows=Array.isArray(snapshot.rows)?snapshot.rows:[],sourceUpdatedAt=snapshot.bootstrap?.report?.source_updated_at||snapshot.report?.source_updated_at||'미확인';
 const previous=readJson(statePath),channels={...(previous.channels||{})},legacyPrevious=previous.channels?null:previous,failures=[],sentSummary=[];
 const channelDefs=[['telegram',telegramReady,msgs=>sendTelegram(msgs,telegramToken,telegramTarget.chatId)],['email',emailReady,sendEmail]];
 for(const [name,ready,sender] of channelDefs){if(!ready)continue;const prior=channels[name]||legacyPrevious||{};const result=evaluateAlerts(rows,rules,prior);const messages=buildMessages(result.opened,sourceUpdatedAt);try{if(messages.length)await sender(messages);channels[name]=channelState(result,sourceUpdatedAt);sentSummary.push(`${name}:${result.opened.reduce((n,x)=>n+x.rows.length,0)}`);}catch(error){failures.push(`${name}: ${error.message}`);}}
 fs.mkdirSync(path.dirname(statePath),{recursive:true});fs.writeFileSync(statePath,JSON.stringify({version:2,source_updated_at:sourceUpdatedAt,channels,updated_at:new Date().toISOString()},null,2)+'\n');console.log(sentSummary.length?`알림 처리: ${sentSummary.join(', ')}`:'새롭게 조건에 맞는 좌석 없음');if(failures.length)throw new Error(failures.join(' | '));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
