export const PUBLIC_URL = 'https://www.koreanair.com/booking/book-and-manage/award-seat-availability';
export const PUBLIC_API = 'https://www.koreanair.com/api/hmp/bonusSeatView/bonusSeatView';

export function parsePublicApi(data, {origin, destination, month, startDate, endDate, sourceUpdatedAt}) {
  if(data.departureAirport!==origin || data.arrivalAirport!==destination || !Array.isArray(data.flightList)) throw new Error('Unexpected public API route or schema');
  const rows=[];
  for(const day of data.flightList) {
    if(!/^\d{8}$/.test(day.departureDate) || !Array.isArray(day.flightDetailList)) throw new Error('Invalid public flight day');
    const date=day.departureDate.replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3');
    if(date.slice(0,7)!==month) throw new Error('Public response belongs to a different month');
    if(date<startDate||date>endDate) continue;
    for(const flight of day.flightDetailList) {
      if(!['O','A'].includes(flight.bookingClass)) continue;
      if(typeof flight.availableSeat!=='boolean'||!flight.flightNumber) throw new Error('Missing flight availability');
      rows.push({date,origin,destination,flight:flight.flightNumber,departureTime:flight.departureTime,
        cabin:flight.bookingClass==='O'?'PRESTIGE':'FIRST',fareClass:flight.bookingClass,
        available:flight.availableSeat,availabilityType:flight.bookingClass==='O'?'AWARD':'AWARD_OR_UPGRADE',
        seats:null,sourcePath:PUBLIC_API,sourceUpdatedAt,checkedAt:new Date().toISOString(),source:'KOREAN_AIR_PUBLIC_DAILY'});
    }
  }
  return rows;
}

// Runs read-only in the page. Preserve exact labels; upgrade space is not an O award.
export function readPublicCalendar() {
  const popup = document.querySelector('#travelCalendarPopup');
  const month = document.querySelector('#travelCalendarListBtn')?.textContent?.trim();
  const heading = document.querySelector('#modals-travelCalendar-title')?.textContent?.trim();
  const days = Array.from(popup?.querySelectorAll('[id^="day_"]') || []).map(e => ({
    day: Number(e.id.replace('day_', '')),
    text: e.textContent.trim(),
    disabled: e.getAttribute('aria-disabled') === 'true' || e.classList.contains('-disabled'),
    labels: Array.from(e.querySelectorAll('li')).map(li => li.textContent.trim()),
  }));
  return {month, heading, days};
}

export function parsePublicCalendar(snapshot, {origin, destination, startDate, endDate, sourceUpdatedAt}) {
  const match = snapshot.month?.match(/(\d{4})년\s*(\d{1,2})월/);
  if (!match || !snapshot.days?.length) throw new Error('Public calendar did not contain a dated result');
  if (!snapshot.heading?.includes(origin) || !snapshot.heading?.includes(destination)) {
    throw new Error('Calendar route does not match the requested route');
  }
  const year = Number(match[1]), month = Number(match[2]);
  const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const rows = [];
  for (const day of snapshot.days) {
    if (day.day < 1 || day.day > maxDay) continue;
    const date = `${year}-${String(month).padStart(2,'0')}-${String(day.day).padStart(2,'0')}`;
    if (date < startDate || date > endDate) continue;
    for (const [cabin, label, fareClass, availabilityType] of [
      ['PRESTIGE','프레스티지석 보너스','O','AWARD'],
      ['FIRST','일등석 보너스/좌석승급','A','AWARD_OR_UPGRADE'],
    ]) {
      rows.push({date, origin, destination, cabin, fareClass,
        available: day.disabled ? null : day.labels.includes(label), availabilityType,
        status: day.disabled ? 'NOT_SELECTABLE' : day.labels.includes(label) ? 'AVAILABLE' : 'NOT_DISPLAYED',
        flight:null, seats:null, sourcePath:PUBLIC_URL, sourceUpdatedAt,
        checkedAt:new Date().toISOString(), source:'KOREAN_AIR_PUBLIC_DAILY'});
    }
  }
  return rows;
}

export function monthRange(start, end) {
  const valid=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
  if(!valid(start)||!valid(end)||start>end)throw new Error('날짜는 YYYY-MM-DD 형식이어야 하며 시작일은 종료일보다 늦을 수 없습니다.');
  const result = [];
  let d = new Date(`${start.slice(0,7)}-01T00:00:00Z`);
  while (d.toISOString().slice(0,7) <= end.slice(0,7)) {
    result.push(d.toISOString().slice(0,7));
    d.setUTCMonth(d.getUTCMonth()+1);
  }
  return result;
}
