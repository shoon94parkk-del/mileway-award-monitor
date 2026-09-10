import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function writePublicReport(report, output) {
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const available=report.rows.filter(r=>r.available).sort((a,b)=>(a.date+a.destination+a.flight).localeCompare(b.date+b.destination+b.flight));
  const queryStatus=report.complete?'수집 완료':report.attempt_complete?'전체 요청 완료 · 일부 조회 불가':'부분 수집';
  const unknown=report.unqueryable||[];
  const options=[...new Set(available.map(r=>r.destination))].sort().map(code=>`<option>${esc(code)}</option>`).join('');
  const table=available.map(r=>`<tr data-route="${esc(r.destination)}" data-cabin="${esc(r.cabin)}" data-date="${esc(r.date)}"><td>${esc(r.date)}</td><td>${esc(r.region)}</td><td>ICN → ${esc(r.destination)}</td><td>${esc(r.flight)}</td><td>${esc(r.departureTime)}</td><td>${r.cabin==='PRESTIGE'?'프레스티지 보너스':'일등석 보너스/승급'}</td><td>${esc(r.fareClass)}</td></tr>`).join('');
  const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>대한항공 공개 보너스 좌석</title>
<style>body{font:16px/1.6 system-ui,sans-serif;background:#f4f6f8;color:#17324d;margin:0}main{max-width:1150px;margin:auto;padding:32px}h1{font-size:28px}p{margin:10px 0}.note{padding:18px;background:#e3edf5;border-radius:12px}.filters{display:flex;gap:12px;flex-wrap:wrap;margin:24px 0}select,input{font:inherit;padding:7px;border:1px solid #bbc8d4;border-radius:6px}table{border-collapse:collapse;width:100%;background:white}th,td{padding:10px 14px;text-align:left;border-bottom:1px solid #e1e7ed}th{background:#163e64;color:white;position:sticky;top:0}.table{overflow:auto}small{color:#526478}details{margin-top:24px}tr[hidden]{display:none}</style>
<main><h1>대한항공 공개 보너스 좌석</h1><p>${esc(report.start_date)} ~ ${esc(report.end_date)} · 서울/인천 출발 · 미주·유럽</p>
<div class="note"><strong>${queryStatus} · ${available.length}개 항공편·날짜·객실 조합</strong><p>대한항공 자료 기준: ${esc(report.source_updated_at)} (한국시간). 일 1회 갱신 자료입니다. 잔여 좌석 수는 제공되지 않으며 실시간 예약 가능 여부는 예매 시 확인해야 합니다.</p><small>프레스티지 승급 Z는 제외했습니다. 일등석 A는 공식 화면의 ‘보너스/좌석승급’ 항목입니다.</small>${unknown.length?`<p><strong>항공사 조회 불가 ${unknown.length}개 구간</strong>: ${unknown.map(r=>esc(r.destination+' '+r.month)).join(', ')}. 좌석 없음으로 해석하면 안 됩니다.</p>`:''}</div>
<div class="filters"><label>목적지 <select id="route"><option value="">전체</option>${options}</select></label><label>좌석 <select id="cabin"><option value="">전체</option><option value="PRESTIGE">프레스티지 보너스</option><option value="FIRST">일등석 보너스/승급</option></select></label><label>월 <input id="month" type="month"></label><span id="count">${available.length}개 표시</span></div>
<div class="table"><table><thead><tr><th>탑승일</th><th>지역</th><th>노선</th><th>편명</th><th>출발시각</th><th>좌석</th><th>클래스</th></tr></thead><tbody>${table}</tbody></table></div>
<details><summary>조회 범위와 오류 (${report.coverage.length}개 정상 조회 · ${unknown.length}개 조회 불가)</summary><pre>${esc(JSON.stringify({coverage:report.coverage,unqueryable:unknown,attempt_complete:report.attempt_complete,errors:report.errors,failure:report.failure},null,2))}</pre></details><p><a href="https://www.koreanair.com/booking/book-and-manage/award-seat-availability">대한항공 공개 조회 원문</a> · <a href="available.json">JSON 결과</a></p></main>
<script>const controls=['route','cabin','month'].map(id=>document.getElementById(id));function filter(){let n=0;for(const tr of document.querySelectorAll('tbody tr')){const show=(!controls[0].value||tr.dataset.route===controls[0].value)&&(!controls[1].value||tr.dataset.cabin===controls[1].value)&&(!controls[2].value||tr.dataset.date.startsWith(controls[2].value));tr.hidden=!show;if(show)n++;}document.getElementById('count').textContent=n+'개 표시';}controls.forEach(el=>el.addEventListener('input',filter));</script></html>`;
  fs.writeFileSync(path.join(output,'report.html'),html);
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const output=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../data/public');
  writePublicReport(JSON.parse(fs.readFileSync(path.join(output,'results.json'),'utf8')),output);
}
