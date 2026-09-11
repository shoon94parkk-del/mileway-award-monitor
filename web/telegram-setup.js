const HEALTH_URL='https://raw.githubusercontent.com/shoon94parkk-del/mileway-award-monitor/main/public-data/health.json';
const REPO='https://github.com/shoon94parkk-del/mileway-award-monitor';
let health=null,loading=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function loadHealth(){if(health)return health;if(!loading)loading=fetch(HEALTH_URL+'?t='+Date.now(),{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);health=await loading;return health;}
function statusMarkup(a={}){
 if(a.telegram_configured)return `<div class="telegram-status ok"><b>✅ Telegram 연결 완료</b><span>${a.telegram_bot_username?'@'+esc(a.telegram_bot_username)+' · ':''}Bot Token + 개인 채팅 등록 완료</span></div>`;
 if(a.telegram_bot_configured)return `<div class="telegram-status wait"><b>🟡 Bot Token 등록됨</b><span>Telegram에서 내 봇을 열고 <b>Start</b>만 누르면 연결됩니다.</span></div>`;
 return '<div class="telegram-status"><b>Telegram 미연결</b><span>BotFather에서 받은 API Token 하나만 GitHub Secret에 넣으면 됩니다.</span></div>';
}
async function enhance(){
 const help=document.querySelector('#dialog-content .alert-help');if(!help||help.dataset.telegramSimple==='1')return;
 help.dataset.telegramSimple='1';
 const h=await loadHealth(),a=h?.alerts||{};
 const botLink=a.telegram_bot_username?`https://t.me/${encodeURIComponent(a.telegram_bot_username)}?start=mileway`:'https://t.me/BotFather';
 help.classList.add('telegram-setup-card');
 help.innerHTML=`${statusMarkup(a)}<div class="telegram-steps"><b>Telegram 연결 · 3단계</b><ol><li><a href="https://t.me/BotFather" target="_blank" rel="noreferrer">@BotFather 열기</a> → <code>/newbot</code> → API Token 복사</li><li><a href="${REPO}/settings/secrets/actions" target="_blank" rel="noreferrer">GitHub Secrets 열기</a> → <code>TELEGRAM_BOT_TOKEN</code> 하나만 추가</li><li><a href="${botLink}" target="_blank" rel="noreferrer">${a.telegram_bot_username?'내 봇 열기':'생성한 봇 열기'}</a> → <b>Start</b> 누르기</li></ol><p><b>TELEGRAM_CHAT_ID는 이제 필요 없습니다.</b> Mileway가 Start 메시지를 보고 채팅을 자동 등록하며, 채팅 ID는 Bot Token으로 암호화해 저장합니다.</p></div><div class="telegram-setup-actions"><a class="secondary" href="${REPO}/actions/workflows/setup-telegram.yml" target="_blank" rel="noreferrer">연결 확인 실행 ↗</a>${a.telegram_bot_username?`<a class="secondary" href="${botLink}" target="_blank" rel="noreferrer">@${esc(a.telegram_bot_username)} 열기 ↗</a>`:''}</div><p class="small muted">연결 확인을 직접 실행하지 않아도 다음 자동 수집 때 연결을 다시 확인합니다. 좌석 조건 자체는 아래 <code>ALERT_RULES_JSON</code>을 별도로 저장해야 합니다.</p>`;
}
const observer=new MutationObserver(()=>queueMicrotask(enhance));
observer.observe(document.body,{childList:true,subtree:true});
document.addEventListener('click',e=>{if(e.target.closest('#cloud-alert-create,#cloud-alert-nav'))setTimeout(enhance,0);},true);
enhance();
