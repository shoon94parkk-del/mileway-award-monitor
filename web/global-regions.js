const $=s=>document.querySelector(s);
const SNAPSHOT_URL='https://raw.githubusercontent.com/shoon94parkk-del/mileway-award-monitor/main/public-data/snapshot.json';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const EXCLUDED_DESTINATIONS=new Set(['GUM']);
const OCEANIA_DESTINATIONS=new Set(['MEL','BNE','SYD','AKL']);
const RUSSIA_MONGOLIA_DESTINATIONS=new Set(['SVO','VVO','LED','UBN','IKT']);
const MIDDLE_EAST_DESTINATIONS=new Set(['DXB','TLV']);
const REGION_ORDER=['미주','유럽','오세아니아','발리','러시아·몽골','중동'];
const regionKey=(region,code)=>{
  if(code==='DPS')return '발리';
  if(OCEANIA_DESTINATIONS.has(code)||(region==='대양주/괌'&&code!=='GUM'))return '오세아니아';
  if(RUSSIA_MONGOLIA_DESTINATIONS.has(code))return '러시아·몽골';
  if(MIDDLE_EAST_DESTINATIONS.has(code))return '중동';
  return region;
};
const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');

async function init(){
  for(let i=0;i<80;i++){if($('#regions')&&$('#destination')?.options.length>1)break;await sleep(100);}
  try{
    const r=await fetch(SNAPSHOT_URL+'?t='+Date.now(),{cache:'no-store'});if(!r.ok)return;
    const data=await r.json();
    const routes=(data?.bootstrap?.routes||[])
      .filter(route=>!EXCLUDED_DESTINATIONS.has(route.code))
      .map(route=>({...route,region:regionKey(route.region,route.code)}));
    const present=[...new Set(routes.map(x=>x.region).filter(Boolean))];
    const regions=[...REGION_ORDER.filter(region=>present.includes(region)),...present.filter(region=>!REGION_ORDER.includes(region))];
    const box=$('#regions');if(!box||!regions.length)return;
    const selected=box.querySelector('.selected')?.dataset.region||'';
    box.innerHTML='<button data-region="">전체</button>'+regions.map(region=>`<button data-region="${esc(region)}">${esc(region)}</button>`).join('');
    const target=[...box.querySelectorAll('button')].find(b=>b.dataset.region===selected)||box.querySelector('button');
    target?.classList.add('selected');
  }catch{}
}
init();
