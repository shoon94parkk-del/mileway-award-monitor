const $=s=>document.querySelector(s);
const SNAPSHOT_URL='https://raw.githubusercontent.com/shoon94parkk-del/mileway-award-monitor/main/public-data/snapshot.json';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const EXCLUDED_DESTINATIONS=new Set(['GUM']);
const regionLabel=(region,routes)=>{
  const codes=new Set(routes.filter(r=>r.region===region).map(r=>r.code));
  if(region==='대양주/괌')return '오세아니아';
  if(region==='동남아시아/서남아시아'&&codes.size===1&&codes.has('DPS'))return '발리';
  if(region==='러시아/몽골/중앙아시아'&&[...codes].every(code=>['SVO','VVO','LED','UBN','IKT'].includes(code)))return '러시아·몽골';
  if(region==='중동/아프리카'&&[...codes].every(code=>['DXB','TLV'].includes(code)))return '중동';
  return region;
};
const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');

async function init(){
  for(let i=0;i<80;i++){if($('#regions')&&$('#destination')?.options.length>1)break;await sleep(100);}
  try{
    const r=await fetch(SNAPSHOT_URL+'?t='+Date.now(),{cache:'no-store'});if(!r.ok)return;
    const data=await r.json(),routes=(data?.bootstrap?.routes||[]).filter(route=>!EXCLUDED_DESTINATIONS.has(route.code));
    const regions=[...new Set(routes.map(x=>x.region).filter(Boolean))].filter(region=>routes.some(r=>r.region===region));
    const box=$('#regions');if(!box||!regions.length)return;
    const selected=box.querySelector('.selected')?.dataset.region||'';
    box.innerHTML='<button data-region="">전체</button>'+regions.map(region=>`<button data-region="${esc(region)}">${esc(regionLabel(region,routes))}</button>`).join('');
    const target=[...box.querySelectorAll('button')].find(b=>b.dataset.region===selected)||box.querySelector('button');
    target?.classList.add('selected');
  }catch{}
}
init();
