import {cloudApi} from './cloud-api.js';
const groups=[
 {key:'유럽',label:'유럽'},
 {key:'미주',label:'미주'},
 {key:'오세아니아',label:'오세아니아'},
 {key:'아시아',label:'발리',title:'발리(DPS)'}
];
const shortTime=value=>String(value||'미확인').replace(/^2026년\s*/,'');
let lastVersion=null;
async function render(){
 try{
  const {report}=await cloudApi('/api/bootstrap');
  const version=report.publication_id||report.source_updated_at||null;
  if(lastVersion&&version&&version!==lastVersion){location.reload();return;}
  lastVersion=version||lastVersion;
  const banner=document.querySelector('.source-banner');
  if(!banner)return;
  const badge=banner.querySelector('.daily-badge');
  if(badge)badge.textContent='일일 업데이트 현황';
  const source=document.querySelector('#source-time');
  if(source)source.textContent=report.scope==='REGIONAL_COMPOSITE'?'완료된 지역부터 즉시 반영 · 실시간 자료 아님':`${report.source_updated_at||'미확인'} 기준 · 실시간 자료 아님`;
  document.querySelector('#regional-publication-status')?.remove();
  let summary=document.querySelector('#region-update-summary');
  if(!summary){summary=document.createElement('div');summary.id='region-update-summary';summary.setAttribute('aria-label','지역별 업데이트 현황');banner.appendChild(summary);}
  if(report.scope==='REGIONAL_COMPOSITE'){
   summary.innerHTML=groups.map(group=>{const state=report.region_status?.[group.key],done=state?.status==='success',label=state?(done?'업데이트 완료':'이전 정상 자료'):'수집 대기';return `<div class="region-update-item ${done?'is-done':''}"${group.title?` title="${group.title}"`:''}><strong>${group.label} · ${label}</strong><span>${shortTime(state?.source_updated_at)}</span></div>`;}).join('');
   const note=document.querySelector('#coverage-note');
   if(note)note.textContent='지역별 수집이 끝나는 즉시 새 자료를 반영합니다. 아직 진행 중인 지역은 마지막 정상 자료를 유지합니다.';
  }else{
   summary.innerHTML=groups.map(group=>`<div class="region-update-item is-done"${group.title?` title="${group.title}"`:''}><strong>${group.label} · 업데이트 완료</strong><span>${shortTime(report.source_updated_at)}</span></div>`).join('');
  }
 }catch{/* Keep the last visible regional status when offline. */}
}
render();setInterval(render,15000);
