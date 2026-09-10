import {cloudApi} from './cloud-api.js';
const groups=['유럽','미주','오세아니아','아시아'];
async function render(){
 try{
  const {report}=await cloudApi('/api/bootstrap');
  if(report.scope!=='REGIONAL_COMPOSITE')return;
  const source=document.querySelector('#source-time');
  if(source)source.textContent='지역별 완료 즉시 반영 · 아래 지역별 기준 시각 확인 · 실시간 자료 아님';
  const note=document.querySelector('#coverage-note');
  if(note)note.textContent='완료한 지역만 새 자료로 반영했습니다. 다른 지역은 마지막 정상 자료를 유지하며, 조회 불가는 좌석 없음이 아닙니다.';
  let panel=document.querySelector('#regional-publication-status');
  if(!panel){panel=document.createElement('section');panel.id='regional-publication-status';panel.className='data-card';panel.setAttribute('aria-label','지역별 자료 기준');document.querySelector('#stats')?.after(panel);}
  panel.replaceChildren();
  const title=document.createElement('h2');title.textContent='지역별 업데이트';panel.append(title);
  const list=document.createElement('dl');list.className='timestamps';
  for(const group of groups){const state=report.region_status?.[group],item=document.createElement('div'),name=document.createElement('dt'),value=document.createElement('dd');name.textContent=group;value.textContent=state?`${state.status==='success'?'수집 완료':'이전 정상 자료'} · ${state.source_updated_at}`:'첫 수집 대기';item.append(name,value);list.append(item);}
  panel.append(list);
 }catch{/* Keep the last visible regional status when offline. */}
}
render();setInterval(render,15000);
