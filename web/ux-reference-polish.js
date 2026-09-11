const HEALTH_URL='https://raw.githubusercontent.com/shoon94parkk-del/mileway-award-monitor/main/public-data/health.json';
const $=s=>document.querySelector(s);

function compactSource(text=''){
 const m=String(text).match(/(\d{1,2})월\s*(\d{1,2})일\s*(\d{1,2}:\d{2})/);
 return m?`${Number(m[1])}/${Number(m[2])} ${m[3]}`:String(text).replace(/\s*기준.*$/,'').trim()||'확인 중';
}
function ensureRail(){
 if($('#ux-status-rail'))return $('#ux-status-rail');
 const top=$('.topbar');if(!top)return null;
 const rail=document.createElement('section');
 rail.id='ux-status-rail';rail.className='ux-status-rail';rail.setAttribute('aria-label','Mileway 상태 요약');
 rail.innerHTML=`
  <div class="ux-rail-item ux-health"><i></i><span>수집</span><b id="ux-health-value">확인 중</b></div>
  <div class="ux-rail-item"><span>원자료</span><b id="ux-source-value">확인 중</b></div>
  <div class="ux-rail-item"><span>현재 결과</span><b id="ux-result-value">—</b></div>
  <button class="ux-rail-item ux-rail-button" type="button" data-ux-alert><span>알림</span><b id="ux-alert-value">확인 중</b></button>
  <button class="ux-rail-more" type="button" data-ux-source>수집 범위 ↗</button>`;
 top.after(rail);return rail;
}
function syncVisibleValues(){
 ensureRail();
 const source=$('#source-time')?.textContent||'';$('#ux-source-value')&&( $('#ux-source-value').textContent=compactSource(source) );
 const count=$('#result-count')?.textContent?.trim();if(count&&$('#ux-result-value'))$('#ux-result-value').textContent=count;
}
async function syncHealth(){
 try{
  const r=await fetch(HEALTH_URL+'?t='+Date.now(),{cache:'no-store'});if(!r.ok)return;
  const h=await r.json(),a=h?.alerts||{},health=$('.ux-health'),value=$('#ux-health-value'),alert=$('#ux-alert-value');
  const ok=h?.status==='healthy';
  if(value)value.textContent=ok?'정상':h?.status==='degraded'?'주의':'확인 중';
  health?.classList.toggle('is-ok',ok);health?.classList.toggle('is-warn',h?.status==='degraded');
  if(alert){
   if(a.rules_configured&&a.telegram_configured)alert.textContent='Telegram ON';
   else if(a.telegram_bot_configured||a.telegram_configured)alert.textContent='조건 설정 필요';
   else alert.textContent='미설정';
  }
 }catch{}
}
function bind(){
 if(document.documentElement.dataset.uxReferenceBound)return;
 document.documentElement.dataset.uxReferenceBound='1';
 document.addEventListener('click',e=>{
  if(e.target.closest('[data-ux-source]'))$('#source-detail')?.click();
  if(e.target.closest('[data-ux-alert]'))($('#cloud-alert-nav')||$('#cloud-alert-create'))?.click();
 },true);
 const source=$('#source-time'),count=$('#result-count');
 if(source)new MutationObserver(syncVisibleValues).observe(source,{childList:true,subtree:true});
 if(count)new MutationObserver(syncVisibleValues).observe(count,{childList:true,subtree:true});
}
ensureRail();bind();syncVisibleValues();syncHealth();
setTimeout(syncVisibleValues,500);setTimeout(syncHealth,1200);
