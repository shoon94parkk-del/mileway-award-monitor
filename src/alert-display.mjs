const AIRPORT_KO={
 LHR:'런던',FCO:'로마',LIS:'리스본',MAD:'마드리드',MXP:'밀라노',BUD:'부다페스트',VIE:'빈',AMS:'암스테르담',IST:'이스탄불',ZRH:'취리히',CDG:'파리',PRG:'프라하',FRA:'프랑크푸르트',
 JFK:'뉴욕',DFW:'댈러스',LAS:'라스베이거스',LAX:'로스앤젤레스',YVR:'밴쿠버',BOS:'보스턴',SFO:'샌프란시스코',SEA:'시애틀',ORD:'시카고',ATL:'애틀랜타',IAD:'워싱턴 D.C.',YYZ:'토론토',HNL:'호놀룰루',
 MEL:'멜버른',BNE:'브리즈번',SYD:'시드니',AKL:'오클랜드',DPS:'발리(덴파사르)'
};

const AIRCRAFT_ALIASES={
 '781':'B787-10','B781':'B787-10','78710':'B787-10','787-10':'B787-10','BOEING787-10':'B787-10',
 '789':'B787-9','B789':'B787-9','7879':'B787-9','787-9':'B787-9','BOEING787-9':'B787-9',
 '359':'A350-900','A359':'A350-900','350900':'A350-900','A350-900':'A350-900','AIRBUSA350-900':'A350-900',
 '388':'A380-800','A388':'A380-800','380800':'A380-800','A380-800':'A380-800','AIRBUSA380-800':'A380-800',
 '748':'B747-8I','B748':'B747-8I','7478I':'B747-8I','747-8I':'B747-8I','BOEING747-8I':'B747-8I',
 '77W':'B777-300ER','B77W':'B777-300ER','777300ER':'B777-300ER','777-300ER':'B777-300ER','BOEING777-300ER':'B777-300ER',
 '773':'B777-300','B773':'B777-300','777300':'B777-300','777-300':'B777-300','BOEING777-300':'B777-300',
 '772':'B777-200ER','B772':'B777-200ER','777200ER':'B777-200ER','777-200ER':'B777-200ER','BOEING777-200ER':'B777-200ER',
 '333':'A330-300','A333':'A330-300','330300':'A330-300','A330-300':'A330-300','AIRBUSA330-300':'A330-300',
 '332':'A330-200','A332':'A330-200','330200':'A330-200','A330-200':'A330-200','AIRBUSA330-200':'A330-200',
 '32Q':'A321neo','A32Q':'A321neo','A321NEO':'A321neo','A321-NEO':'A321neo','AIRBUSA321NEO':'A321neo'
};

const PRESTIGE_HINTS={
 'B787-10':'스위트 2.0 · 180° · 전좌석 통로',
 'B787-9':'스위트 · 전좌석 통로',
 'A350-900':'스위트 · 180° · 전좌석 통로',
 'B747-8I':'스위트 · 전좌석 통로',
 'A380-800':'슬리퍼 · 180°',
 'A321neo':'슬리퍼 · 180°',
 'B777-300':'슬리퍼 · 180°',
 'B777-300ER':'기재 구성별 스위트 2.0/스위트/슬리퍼',
 'B777-200ER':'기재 구성별 좌석형 상이',
 'A330-300':'기재 구성별 스위트/슬리퍼',
 'A330-200':'기재 구성별 좌석형 상이'
};

export function airportLabel(code){
 const iata=String(code||'').toUpperCase();
 return AIRPORT_KO[iata]?`${AIRPORT_KO[iata]}(${iata})`:iata;
}

export function normalizeAircraft(value){
 const raw=String(value||'').trim();if(!raw)return '';
 const compact=raw.toUpperCase().replace(/[\s_/]/g,'').replace(/^BOEING/,'BOEING').replace(/^AIRBUS/,'AIRBUS');
 return AIRCRAFT_ALIASES[compact]||AIRCRAFT_ALIASES[raw.toUpperCase()]||raw;
}

export function prestigeSeatHint(aircraft){
 const normalized=normalizeAircraft(aircraft);
 return PRESTIGE_HINTS[normalized]||'';
}

export function formatAlertRow(row){
 const cabin=row?.cabin==='FIRST'?'일등석':'프레스티지';
 const time=row?.time||row?.departureTime||'';
 const aircraft=normalizeAircraft(row?.aircraft||row?.aircraftType||row?.equipment||'');
 const seat=row?.cabin==='PRESTIGE'?prestigeSeatHint(aircraft):'';
 const parts=[String(row?.date||''),airportLabel(row?.destination),`${row?.flight||''}${time?' '+time:''}`.trim(),cabin];
 if(aircraft)parts.push(aircraft);
 if(seat)parts.push(seat);
 return parts.filter(Boolean).join(' · ');
}
