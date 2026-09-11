import {resolveTelegramTarget,sendTelegramText} from './telegram-target.mjs';

const ALERT_API_URL=process.env.MILEWAY_ALERT_API_URL||'https://mileway-alert-api.onrender.com';
async function bootstrapDirectDelivery(token,target){
 if(!token)return false;
 try{
  const res=await fetch(ALERT_API_URL+'/telegram/bootstrap',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,chat_id:String(target?.chatId||''),bot_username:target?.bot_username||''})});
  const data=await res.json().catch(()=>({}));if(!res.ok||!data?.ok)throw new Error(data?.error||`HTTP ${res.status}`);
  console.log(`Render direct Telegram webhook ready (@${data.bot_username||target?.bot_username||'bot'}).`);return true;
 }catch(error){console.log(`Render direct Telegram bootstrap skipped: ${error.message}`);return false;}
}

async function main(){
 const token=process.env.TELEGRAM_BOT_TOKEN||'',explicit=process.env.TELEGRAM_CHAT_ID||'';
 if(!token){console.log('Telegram bot token 미설정: 자동 연결을 건너뜁니다.');return;}
 let target={chatId:null,bot_username:null,source:'none'};
 try{target=await resolveTelegramTarget(token,{explicitChatId:explicit,allowDiscover:true});}
 catch(error){console.log(`기존 Telegram 대상 확인은 건너뜁니다: ${error.message}`);}
 const ready=await bootstrapDirectDelivery(token,target);if(!ready)return;
 if(target?.source==='auto-registered'&&target.chatId)await sendTelegramText(token,target.chatId,'✅ Mileway 텔레그램 연결 완료\n이제 사이트의 알림 화면에서 조건을 등록하면 좌석 알림이 즉시 활성화됩니다.');
 console.log(`Telegram direct delivery ready (${target?.source||'webhook'}). New devices connect through one-tap Telegram deep links.`);
}

main().catch(error=>{console.error(error.message);process.exitCode=1;});
