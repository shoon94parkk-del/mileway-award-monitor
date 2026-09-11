import fs from 'node:fs';
import {resolveTelegramTarget,sendTelegramText} from './telegram-target.mjs';
import {parseTelegramRuleCommand,applyTelegramRuleCommand,readCommandState,writeCommandState} from './telegram-rule-commands.mjs';

const ALERT_API_URL=process.env.MILEWAY_ALERT_API_URL||'https://mileway-alert-api.onrender.com';
const routes=()=>{try{return JSON.parse(fs.readFileSync('routes.json','utf8')).routes||[];}catch{return [];}};
async function fetchUpdates(token,offset){
 const url=`https://api.telegram.org/bot${token}/getUpdates?timeout=0&limit=100&offset=${Math.max(0,Number(offset)||0)}`;
 const res=await fetch(url),data=await res.json();if(!res.ok||!data?.ok)throw new Error('Telegram 업데이트 확인 실패');return data.result||[];
}
async function fetchTestRequest(){
 const res=await fetch(ALERT_API_URL+'/telegram-test',{headers:{Accept:'application/json'}});if(!res.ok)return null;
 const data=await res.json();return data?.request||null;
}
async function bootstrapDirectDelivery(token,target){
 if(!token||!target?.chatId)return false;
 try{
  const res=await fetch(ALERT_API_URL+'/telegram/bootstrap',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,chat_id:String(target.chatId),bot_username:target.bot_username||''})});
  const data=await res.json().catch(()=>({}));if(!res.ok||!data?.ok)throw new Error(data?.error||`HTTP ${res.status}`);
  console.log(`Render direct Telegram ready (@${data.bot_username||target.bot_username||'bot'}).`);return true;
 }catch(error){console.log(`Render direct Telegram bootstrap skipped: ${error.message}`);return false;}
}

async function main(){
 const token=process.env.TELEGRAM_BOT_TOKEN||'';
 const explicit=process.env.TELEGRAM_CHAT_ID||'';
 if(!token){console.log('Telegram bot token 미설정: 자동 연결을 건너뜁니다.');return;}
 const target=await resolveTelegramTarget(token,{explicitChatId:explicit,allowDiscover:true});
 if(!target.chatId){
  const bot=target.bot_username?`@${target.bot_username}`:'생성한 Telegram 봇';
  console.log(`Telegram 봇은 확인됐지만 개인 채팅을 찾지 못했습니다. ${bot}을 열고 Start를 누르면 다음 실행에서 자동 연결됩니다.`);
  return;
 }
 await bootstrapDirectDelivery(token,target);
 if(target.source==='auto-registered')await sendTelegramText(token,target.chatId,'✅ Mileway 텔레그램 연결 완료\n사이트에서 원하는 좌석 조건을 고른 뒤 “Telegram 알림 등록”만 누르면 됩니다.');
 const state=readCommandState(),updates=await fetchUpdates(token,(state.last_update_id||0)+1);let last=state.last_update_id||0,changed=0;
 for(const update of updates){last=Math.max(last,Number(update.update_id)||0);const msg=update.message;if(String(msg?.chat?.id)!==String(target.chatId))continue;const command=parseTelegramRuleCommand(msg?.text,routes());if(!command)continue;const rules=applyTelegramRuleCommand(command);changed++;
  if(command.type==='add')await sendTelegramText(token,target.chatId,`✅ 알림 등록 완료\n${command.rule.name}\n${command.rule.start||'오늘'} ~ ${command.rule.end||'전체 기간'}${command.rule.weekend?' · 주말만':''}\n\n현재 활성 알림 ${rules.length}개`);
  if(command.type==='delete')await sendTelegramText(token,target.chatId,`🗑️ 알림 삭제 완료\n현재 활성 알림 ${rules.length}개`);
  if(command.type==='clear')await sendTelegramText(token,target.chatId,'🗑️ 모든 좌석 알림을 삭제했습니다.');
 }
 let lastTest=state.last_test_request_id||null;
 const request=await fetchTestRequest().catch(()=>null);
 if(request?.id&&request.id!==lastTest){
  const now=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'medium',timeStyle:'short'}).format(new Date());
  await sendTelegramText(token,target.chatId,`✅ Mileway 실제 알림 테스트 성공\n${now} (한국시간)\n\n이 메시지가 보이면 Telegram 좌석 알림이 정상입니다.`);
  lastTest=request.id;
 }
 if(last!==state.last_update_id||lastTest!==state.last_test_request_id)writeCommandState(last,{last_test_request_id:lastTest});
 console.log(`Telegram target ready (${target.source}); alert commands=${changed}; fallback-test=${lastTest&&lastTest!==state.last_test_request_id?'sent':'none'}.`);
}

main().catch(error=>{console.error(error.message);process.exitCode=1;});
