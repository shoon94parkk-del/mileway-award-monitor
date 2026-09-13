const KST_OFFSET_MS=9*60*60*1000;

function kstParts(now){
 const kst=new Date(now.getTime()+KST_OFFSET_MS);
 return {year:kst.getUTCFullYear(),month:kst.getUTCMonth()+1,day:kst.getUTCDate()};
}

export function collectionCycle(now=new Date(),{prewarmMinutes=15}={}){
 const {year,month,day}=kstParts(now);
 const todayStartMs=Date.UTC(year,month-1,day,14,0,0,0); // 23:00 KST
 const prewarmMs=Math.max(0,Number(prewarmMinutes)||0)*60*1000;
 const startMs=now.getTime()>=todayStartMs-prewarmMs?todayStartMs:todayStartMs-86400000;
 const start=new Date(startMs);
 const kstDate=new Date(startMs+KST_OFFSET_MS);
 const y=kstDate.getUTCFullYear(),m=String(kstDate.getUTCMonth()+1).padStart(2,'0'),d=String(kstDate.getUTCDate()).padStart(2,'0');
 return {
  cycle_id:`${y}-${m}-${d}T23:00:00+09:00`,
  cycle_start_utc:start.toISOString(),
  expected_source_at:`${y}년 ${Number(m)}월 ${Number(d)}일 23:00`
 };
}
