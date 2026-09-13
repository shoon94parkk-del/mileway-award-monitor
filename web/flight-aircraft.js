// Curated Korean Air schedule hints for Mileway seat guidance.
// These are scheduled/typical aircraft, not a guarantee of the actual aircraft flown.
// "confirmed" is reserved for an aircraft value present in the collected Korean Air row itself.

export const FLIGHT_AIRCRAFT_VERSION=1;
const REVIEWED_AT='2026-09-13';
const sourceUrl=flight=>`https://www.flight.info/${flight}`;
const days=date=>new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 Sun ... 6 Sat
const inRange=(date,from,to)=>date>=from&&date<=to;
const rule=(from,to,aircraft,weekdays=null)=>({from,to,aircraft,weekdays});

const CATALOG={
 KE5:{typical:'B777-300ER',rules:[rule('2026-09-01','2027-08-03','B777-300ER')]},
 KE11:{rules:[
  rule('2026-09-01','2026-09-21','A380-800',[1,2,4,6]),rule('2026-09-02','2026-09-20','B747-8I',[0,3,5]),
  rule('2026-09-22','2026-09-30','B747-8I'),rule('2026-10-01','2026-10-24','A380-800',[1,2,4,6]),rule('2026-10-02','2026-10-23','B747-8I',[0,3,5]),
  rule('2026-10-25','2027-08-03','B777-300ER')
 ]},
 KE17:{rules:[rule('2026-09-01','2026-10-24','B747-8I')],candidates:['B747-8I','B777-300ER']},
 KE23:{typical:'B787-10',rules:[rule('2026-09-01','2026-10-24','B787-10')]},
 KE31:{typical:'B787-9',rules:[rule('2026-09-01','2027-08-03','B787-9')]},
 KE33:{typical:'B777-300ER',rules:[rule('2026-09-01','2027-01-03','B777-300ER')]},
 KE35:{typical:'B777-300ER',rules:[rule('2026-09-01','2026-10-24','B777-300ER')]},
 KE37:{typical:'B777-300ER',rules:[rule('2026-09-01','2026-10-31','B777-300ER')]},
 KE41:{typical:'B787-10',rules:[rule('2026-09-01','2027-08-24','B787-10')]},
 KE53:{typical:'B787-10',rules:[rule('2026-08-28','2026-09-27','B787-10'),rule('2026-09-28','2026-10-02','B777-300ER'),rule('2026-10-03','2027-08-10','B787-10')]},
 KE71:{typical:'B787-10',rules:[rule('2026-09-01','2027-07-13','B787-10')]},
 KE75:{rules:[rule('2026-09-01','2026-09-21','B787-10'),rule('2026-09-22','2026-09-22','B787-9'),rule('2027-03-28','2027-08-03','B787-9')],candidates:['B787-10','B787-9']},
 KE77:{typical:'A350-900',rules:[rule('2026-09-01','2026-10-31','A350-900')]},
 KE81:{rules:[rule('2026-09-01','2027-03-27','A380-800'),rule('2027-03-28','2027-08-31','B777-300ER')],candidates:['A380-800','B777-300ER']},
 KE85:{typical:'B777-300ER',rules:[rule('2026-09-01','2026-10-07','B777-300ER')]},
 KE91:{typical:'B777-300ER',rules:[rule('2026-09-01','2027-08-31','B777-300ER')]},
 KE93:{typical:'B777-300ER',rules:[rule('2026-09-01','2027-08-03','B777-300ER')]},
 KE401:{typical:'B787-10',rules:[rule('2026-09-01','2026-10-02','B787-10')]},
 KE407:{typical:'B787-9',rules:[rule('2026-09-14','2026-10-02','B787-10',[1,5]),rule('2027-03-29','2027-08-03','B787-9',[1,3,5,6])]},
 KE411:{typical:'B787-9',rules:[rule('2026-09-13','2026-09-20','B787-10',[0]),rule('2026-09-14','2026-09-25','B787-9',[1,3,5]),rule('2026-09-27','2026-10-04','B787-10',[0]),rule('2027-07-04','2027-08-03','B787-9',[0,1,3,5])]},
 KE431:{typical:'B787-9',rules:[rule('2026-09-01','2026-09-21','B787-9'),rule('2026-09-22','2026-09-22','B787-10')]},
 KE433:{typical:'B787-9',rules:[rule('2026-09-01','2026-10-24','B787-10'),rule('2026-10-25','2027-08-24','B787-9')]},
 KE901:{typical:'B777-300ER',rules:[rule('2026-09-01','2027-03-27','B777-300ER')]},
 KE907:{typical:'B777-300ER',rules:[rule('2026-09-01','2026-10-24','B777-300ER')]},
 KE921:{typical:'B787-9',rules:[rule('2026-09-02','2026-10-23','B787-9')]},
 KE925:{rules:[rule('2026-09-01','2027-03-27','B777-300ER'),rule('2027-03-28','2027-07-20','B787-9')],candidates:['B777-300ER','B787-9']},
 KE927:{typical:'B787-9',rules:[rule('2026-09-01','2026-10-23','B787-10'),rule('2026-10-25','2027-03-26','B787-9')]},
 KE931:{typical:'A350-900',rules:[rule('2026-10-26','2027-08-31','A350-900')]},
 KE937:{typical:'B787-9',rules:[rule('2026-09-13','2026-09-27','B787-9',[0]),rule('2026-09-14','2026-10-02','B787-10',[1,3,5]),rule('2026-10-04','2026-10-23','B787-10',[0,1,3,5]),rule('2026-10-25','2027-08-31','B787-9')]},
 KE945:{typical:'B777-300ER',rules:[rule('2026-09-01','2027-03-27','B777-300ER')]},
 KE955:{typical:'B787-9',rules:[rule('2026-09-01','2027-08-31','B787-9')]},
 KE969:{rules:[rule('2026-09-01','2026-12-16','B787-10'),rule('2026-12-18','2027-03-27','B787-9'),rule('2027-03-29','2027-09-07','A350-900')],candidates:['B787-10','B787-9','A350-900']}
};

export function normalizeFlight(value){
 const m=String(value||'').toUpperCase().replace(/\s+/g,'').match(/^KE0*(\d+)$/);
 return m?`KE${Number(m[1])}`:String(value||'').toUpperCase().replace(/\s+/g,'');
}

export function estimateAircraft(row={}){
 if(row.aircraft){
  return {aircraft:String(row.aircraft),confidence:'confirmed',label:'확정',reason:'대한항공 공개 좌석 원자료에 기종값이 포함됨',source:'Korean Air public award data',source_url:'https://www.koreanair.com/booking/book-and-manage/award-seat-availability',reviewed_at:REVIEWED_AT};
 }
 const flight=normalizeFlight(row.flight),date=String(row.date||'');
 const item=CATALOG[flight];
 if(!item||!/^\d{4}-\d{2}-\d{2}$/.test(date))return {aircraft:'',confidence:'unknown',label:'미확인',reason:'편명·운항일에 맞는 검증된 기종 스케줄이 없음',source_url:''};
 const weekday=days(date);
 const matched=(item.rules||[]).find(r=>inRange(date,r.from,r.to)&&(!r.weekdays||r.weekdays.includes(weekday)));
 if(matched)return {aircraft:matched.aircraft,confidence:'high',label:'높음',reason:'편명과 해당 운항일의 공개 운항 스케줄이 일치',source:'Flight.info schedule',source_url:sourceUrl(flight),reviewed_at:REVIEWED_AT};
 if(item.typical)return {aircraft:item.typical,confidence:'medium',label:'중간',reason:'이 편명에서 반복적으로 확인되는 대표 기종이지만 해당 날짜의 확정 스케줄 범위 밖',source:'Flight.info schedule pattern',source_url:sourceUrl(flight),reviewed_at:REVIEWED_AT};
 if(item.candidates?.length)return {aircraft:'',candidates:[...item.candidates],confidence:'low',label:'낮음',reason:'시기·요일에 따라 여러 기종이 투입되는 편명',source:'Flight.info schedule pattern',source_url:sourceUrl(flight),reviewed_at:REVIEWED_AT};
 return {aircraft:'',confidence:'unknown',label:'미확인',reason:'기종을 안전하게 추정할 근거가 부족함',source_url:sourceUrl(flight)};
}

export function aircraftScheduleCatalog(){return JSON.parse(JSON.stringify(CATALOG));}
