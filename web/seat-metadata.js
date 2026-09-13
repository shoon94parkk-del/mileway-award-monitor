export const SEAT_METADATA_VERSION=1;

const IMG={
 suite2:'https://www.koreanair.com/content/dam/koreanair/plan-your-travel/in-flight-experience/fleet/seat/economy/787-10-economy/fl-prestigesuite-img-main-787-10-pc.png',
 suite:'https://www.koreanair.com/content/dam/koreanair/plan-your-travel/in-flight-experience/fleet/seat/prestige/prestige-suites-new/fl-prestigesuite-img-01-b787-9-pc.jpg',
 sleeper:'https://www.koreanair.com/content/dam/koreanair/plan-your-travel/in-flight-experience/fleet/seat/prestige/prestige-sleeper/fl-prestige-img-01-a321neo-pc.png'
};

const CATALOG={
 'B787-10':{aircraft:'B787-10',seat_name:'프레스티지 스위트 2.0',bed:'180° 풀플랫',direct_aisle:'전 좌석 통로 직접 접근',layout:'1-2-1',privacy:'매우 높음',summary:'높은 좌석벽과 독립 공간, 무선 충전·USB-C를 갖춘 대한항공 최신 프레스티지 좌석입니다.',image_url:IMG.suite2,image_note:'대한항공 공식 B787-10 프레스티지 스위트 2.0 이미지',official_url:'https://www.koreanair.com/contents/plan-your-travel/in-flight-experience/fleet/b787/10-325/prestige',confidence:'exact'},
 'B787-9':{aircraft:'B787-9',seat_name:'프레스티지 스위트',bed:'침대형 좌석',direct_aisle:'전 좌석 통로 직접 접근',layout:'지그재그 배열',privacy:'높음',summary:'창가석에서도 옆 승객을 넘지 않고 통로로 나갈 수 있는 독립형 프레스티지 좌석입니다.',image_url:IMG.suite,image_note:'대한항공 공식 B787-9 프레스티지 스위트 이미지',official_url:'https://www.koreanair.com/contents/plan-your-travel/in-flight-experience/fleet/b787/9-278/prestige',confidence:'exact'},
 'A350-900':{aircraft:'A350-900',seat_name:'프레스티지 스위트',bed:'180° 풀플랫 · 195.5cm',direct_aisle:'전 좌석 통로 직접 접근',layout:'1-2-1 지그재그',privacy:'높음',summary:'1-2-1 지그재그 배열의 독립형 좌석으로 어느 좌석에서도 통로로 바로 나갈 수 있습니다.',image_url:IMG.suite,image_note:'프레스티지 스위트 대표 이미지 · 실제 A350 좌석은 공식 상세 페이지에서 확인',official_url:'https://www.koreanair.com/contents/plan-your-travel/in-flight-experience/fleet/a350/900-311/prestige',confidence:'exact'},
 'B747-8I':{aircraft:'B747-8I',seat_name:'프레스티지 스위트',bed:'침대형 좌석',direct_aisle:'전 좌석 통로 직접 접근',layout:'독립형 배열',privacy:'높음',summary:'독립 공간과 통로 직접 접근이 가능한 프레스티지 스위트가 적용됩니다.',image_url:IMG.suite,image_note:'프레스티지 스위트 대표 이미지',official_url:'https://www.koreanair.com/contents/plan-your-travel/in-flight-experience/fleet/b747/8i-368/prestige',confidence:'exact'},
 'A380-800':{aircraft:'A380-800',seat_name:'프레스티지 슬리퍼',bed:'180° 풀플랫',direct_aisle:'좌석 위치에 따라 옆 좌석 통과 필요',layout:'2-2-2',privacy:'보통',summary:'180°로 완전히 눕는 침대형 좌석입니다. 다만 스위트 계열처럼 모든 좌석이 통로와 직접 연결되지는 않습니다.',image_url:IMG.sleeper,image_note:'프레스티지 슬리퍼 형태 대표 이미지 · 실제 A380 좌석은 공식 상세 페이지에서 확인',official_url:'https://www.koreanair.com/contents/plan-your-travel/in-flight-experience/fleet/a380/800-407/prestige',confidence:'exact'},
 'A321NEO':{aircraft:'A321neo',seat_name:'프레스티지 슬리퍼',bed:'180° 풀플랫',direct_aisle:'창가석은 옆 좌석 통과 필요',layout:'2-2',privacy:'보통',summary:'대한항공 소형기 최초의 180° 침대형 프레스티지 좌석으로 무선 충전과 USB-C를 지원합니다.',image_url:IMG.sleeper,image_note:'대한항공 공식 A321neo 프레스티지 슬리퍼 이미지',official_url:'https://www.koreanair.com/contents/plan-your-travel/in-flight-experience/fleet/a321/neo-182/prestige',confidence:'exact'},
 'B777-300':{aircraft:'B777-300',seat_name:'프레스티지 슬리퍼',bed:'180° 풀플랫',direct_aisle:'좌석 위치에 따라 옆 좌석 통과 필요',layout:'2-2-2',privacy:'보통',summary:'180° 침대형 프레스티지 슬리퍼 좌석입니다.',image_url:IMG.sleeper,image_note:'프레스티지 슬리퍼 형태 대표 이미지',official_url:'https://www.koreanair.com/contents/plan-your-travel/in-flight-experience/fleet/b777/300-338/prestige',confidence:'exact'},
 'B777-300ER':{aircraft:'B777-300ER',seat_name:'기재 구성에 따라 상이',bed:'모든 현행 구성 침대형',direct_aisle:'구성별 상이',layout:'1-2-1 또는 2-2-2',privacy:'구성별 상이',summary:'B777-300ER은 328석·277석·291석 등 여러 구성이 있어 기종명만으로 좌석을 단정하면 안 됩니다.',image_url:IMG.suite2,image_note:'대표 이미지 · 328석 개조형은 프레스티지 스위트 2.0',official_url:'https://www.koreanair.com/contents/plan-your-travel/in-flight-experience/fleet/b777',confidence:'variant',variants:[
  {name:'328석',seat_name:'프레스티지 스위트 2.0',bed:'180° 풀플랫',direct_aisle:'전 좌석 통로 직접 접근',layout:'1-2-1',official_url:'https://www.koreanair.com/contents/plan-your-travel/in-flight-experience/fleet/b777/300er-328/prestige'},
  {name:'277석',seat_name:'프레스티지 스위트',bed:'침대형 좌석',direct_aisle:'전 좌석 통로 직접 접근',layout:'독립형 배열',official_url:'https://www.koreanair.com/contents/plan-your-travel/in-flight-experience/fleet/b777/300er-277/prestige'},
  {name:'291석',seat_name:'프레스티지 슬리퍼',bed:'180° 풀플랫',direct_aisle:'좌석 위치에 따라 옆 좌석 통과 필요',layout:'2-2-2',official_url:'https://www.koreanair.com/contents/plan-your-travel/in-flight-experience/fleet/b777/300er-291/prestige'}
 ]},
 'A330-300':{aircraft:'A330-300',seat_name:'기재 구성에 따라 상이',bed:'침대형 좌석',direct_aisle:'구성별 상이',layout:'구성별 상이',privacy:'구성별 상이',summary:'A330-300은 272석·284석·276석 구성이 있어 프레스티지 스위트 또는 슬리퍼가 배치됩니다.',image_url:IMG.suite,image_note:'대표 이미지 · 실제 좌석은 기재 구성에 따라 다름',official_url:'https://www.koreanair.com/contents/plan-your-travel/in-flight-experience/fleet/a330',confidence:'variant',variants:[
  {name:'272석',seat_name:'프레스티지 스위트',bed:'침대형 좌석',direct_aisle:'전 좌석 통로 직접 접근',layout:'독립형 배열',official_url:'https://www.koreanair.com/contents/plan-your-travel/in-flight-experience/fleet/a330/300-272/prestige'},
  {name:'284석',seat_name:'프레스티지 슬리퍼',bed:'180° 풀플랫',direct_aisle:'좌석 위치에 따라 옆 좌석 통과 필요',layout:'2-2-2',official_url:'https://www.koreanair.com/contents/plan-your-travel/in-flight-experience/fleet/a330/300-284/prestige'},
  {name:'276석',seat_name:'프레스티지 슬리퍼',bed:'180° 풀플랫',direct_aisle:'좌석 위치에 따라 옆 좌석 통과 필요',layout:'2-2-2',official_url:'https://www.koreanair.com/contents/plan-your-travel/in-flight-experience/fleet/a330/300-276/prestige'}
 ]}
};

export function normalizeAircraft(value){
 const raw=String(value||'').toUpperCase().replace(/BOEING|AIRBUS/g,'').replace(/[\s_]/g,'').replace(/[^A-Z0-9-]/g,'');
 if(!raw)return '';
 if(/787-?10|B?78X|B?781/.test(raw))return 'B787-10';
 if(/787-?9|B?789/.test(raw))return 'B787-9';
 if(/350-?900|A?359/.test(raw))return 'A350-900';
 if(/747-?8I?|B?748/.test(raw))return 'B747-8I';
 if(/A?380-?800|A?388/.test(raw))return 'A380-800';
 if(/A?321-?NEO|A?21N|32Q|321N/.test(raw))return 'A321NEO';
 if(/777-?300ER|B?77W/.test(raw))return 'B777-300ER';
 if(/777-?300|B?773/.test(raw))return 'B777-300';
 if(/330-?300|A?333/.test(raw))return 'A330-300';
 return raw;
}

export function prestigeSeatInfo(aircraft){
 const key=normalizeAircraft(aircraft);
 if(CATALOG[key])return {...CATALOG[key],key,metadata_version:SEAT_METADATA_VERSION};
 return {key,aircraft:String(aircraft||'기종 미확인'),seat_name:'좌석 정보 확인 필요',bed:'미확인',direct_aisle:'미확인',layout:'미확인',privacy:'미확인',summary:'대한항공 공개 좌석 자료에서 기종 또는 좌석 구성을 확인하지 못했습니다. 실제 운항 기재는 변경될 수 있으므로 예약 전 대한항공에서 확인해 주세요.',image_url:'',image_note:'',official_url:'https://www.koreanair.com/contents/plan-your-travel/in-flight-experience/fleet',confidence:'unknown',metadata_version:SEAT_METADATA_VERSION};
}

export function prestigeSeatCatalog(){return JSON.parse(JSON.stringify(CATALOG));}
