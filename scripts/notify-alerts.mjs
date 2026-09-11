import fs from 'node:fs';
import path from 'node:path';
import {resolveTelegramTarget,sendTelegramText} from './telegram-target.mjs';

const ALERT_API_URL=process.env.MILEWAY_ALERT_API_URL||'https://mileway-alert-api.onrender.com';
const arg=name=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:null;};
const has=name=>process.argv.includes(name);
const snapshotPath=path.resolve(arg('--snapshot')||'public-data/snapshot.json');
const readJson=file=>fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{};

async function sendLegacyTest(token){
 const target=await resolveTelegramTarget(token,{explicitChatId:process.env.TELEGRAM_CHAT_ID||'',allowDiscover:true});
 if(!target.chatId)throw new Error('Telegram 대상 채팅이 아직 연결되지 않았습니다.');
 const now=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'medium',timeStyle:'short'}).format(new Date());
 await sendTelegramText(token,target.chatId,`✅ Mileway 좌석 알림 테스트 성공\n${now} (한국시간)\n\n이 메시지가 보이면 알림 채널 설정이 정상입니다.`);
 console.log('알림 테스트 성공: Telegram');
}

async function notifyViaApi(token,snapshot){
 const rows=Array.isArray(snapshot.rows)?snapshot.rows:[],sourceUpdatedAt=snapshot.bootstrap?.report?.source_updated_at||snapshot.report?.source_updated_at||'미확인';
 const res=await fetch(ALERT_API_URL+'/internal/notify',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({source_updated_at:sourceUpdatedAt,rows})});
 const data=await res.json().catch(()=>({}));
 if(!res.ok&&res.status!==207)throw new Error(data?.error||`Alert API ${res.status}`);
 console.log(`Telegram 알림 처리: devices=${data.users||0}, sent_seats=${data.sent_seats||0}, unlinked=${data.skipped_unlinked||0}`);
 if(Array.isArray(data.failures)&&data.failures.length)throw new Error(`일부 Telegram 전송 실패: ${data.failures.join(' | ')}`);
}

async function main(){
 const telegramToken=process.env.TELEGRAM_BOT_TOKEN||'';
 if(has('--test')){if(!telegramToken)throw new Error('TELEGRAM_BOT_TOKEN이 설정되지 않았습니다.');await sendLegacyTest(telegramToken);return;}
 if(!telegramToken){console.log('Telegram Bot Token 미설정: 좌석 알림을 건너뜁니다.');return;}
 const snapshot=readJson(snapshotPath);if(!Array.isArray(snapshot.rows))throw new Error('알림용 snapshot rows가 없습니다.');
 await notifyViaApi(telegramToken,snapshot);
 if(process.env.RESEND_API_KEY)console.log('Email 알림은 공개 사용자 규칙과 분리하기 위해 현재 Telegram 전용 경로에서 비활성화되어 있습니다.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
