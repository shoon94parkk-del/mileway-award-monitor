let snapshot,loadedAt=0;
export function filterRows(rows,f={}){
 return rows.filter(r=>(!f.region||r.region===f.region)&&(!f.destination||r.destination===f.destination)&&(!f.cabin||r.cabin===f.cabin)&&(!f.month||r.date.startsWith(f.month))&&(!f.start||r.date>=f.start)&&(!f.end||r.date<=f.end)&&(!f.date||r.date===f.date)&&(f.weekend!=='true'||[0,6].includes(new Date(r.date+'T00:00:00Z').getUTCDay()))&&(!f.q||[r.city,r.destination,r.flight,r.country].some(v=>String(v).toLowerCase().includes(f.q.toLowerCase())))&&f.saved!=='true');
}
export async function cloudApi(url,method='GET'){
 if(method!=='GET')throw Error('공개 사이트는 조회 전용입니다.');
 if(!snapshot||Date.now()-loadedAt>300000){try{const r=await fetch('./snapshot.json',{cache:'no-cache'});if(!r.ok)throw Error('수집 자료를 불러오지 못했습니다.');snapshot=await r.json();loadedAt=Date.now();}catch(e){if(!snapshot)throw e;loadedAt=Date.now();}}
 const u=new URL(url,'https://mileway.invalid'),f=Object.fromEntries(u.searchParams);
 if(u.pathname==='/api/bootstrap')return snapshot.bootstrap;
 if(u.pathname.startsWith('/api/seats/')){const row=snapshot.rows.find(r=>r.id===u.pathname.split('/').pop());if(!row)throw Error('항공편을 찾지 못했습니다.');return row;}
 const rows=filterRows(snapshot.rows,f);
 if(u.pathname==='/api/calendar')return [...Map.groupBy(rows,r=>r.date)].map(([date,rs])=>({date,count:rs.length,first:rs.filter(r=>r.cabin==='FIRST').length,destinations:new Set(rs.map(r=>r.destination)).size})).sort((a,b)=>a.date.localeCompare(b.date));
 if(u.pathname==='/api/seats'){
  rows.sort((a,b)=>f.sort==='latest'?b.date.localeCompare(a.date)||a.time.localeCompare(b.time):f.sort==='city'?a.city.localeCompare(b.city)||a.date.localeCompare(b.date):f.sort==='first'?(b.cabin==='FIRST')-(a.cabin==='FIRST')||a.date.localeCompare(b.date):a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
  const offset=Math.max(0,Number(f.offset)||0),limit=Math.max(1,Math.min(50000,Number(f.limit)||30));return {total:rows.length,rows:rows.slice(offset,offset+limit),offset,limit};
 }
 throw Error('지원하지 않는 요청입니다.');
}
