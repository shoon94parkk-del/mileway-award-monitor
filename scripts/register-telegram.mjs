import {resolveTelegramTarget,sendTelegramText} from './telegram-target.mjs';

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
 if(target.source==='auto-registered'){
  await sendTelegramText(token,target.chatId,'✅ Mileway 텔레그램 연결 완료\n이제 저장한 좌석 알림 조건에 맞는 새 좌석이 확인되면 이 채팅으로 알려드릴게요.');
  console.log(`Telegram target auto-registered${target.bot_username?` (@${target.bot_username})`:''}.`);
 }else{
  console.log(`Telegram target ready (${target.source}).`);
 }
}

main().catch(error=>{console.error(error.message);process.exitCode=1;});
