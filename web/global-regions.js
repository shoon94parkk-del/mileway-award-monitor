const $=s=>document.querySelector(s);
const SNAPSHOT_URL='https://raw.githubusercontent.com/shoon94parkk-del/mileway-award-monitor/main/public-data/snapshot.json';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function init(){
  for(let i=0;i<80;i++){if($('#regions')&&$('#destination')?.options.length>1)break;await sleep(100);}
  try{
    const r=await fetch(SNAPSHOT_URL+'?t='+Date.now(),{cache:'no-store'});if(!r.ok)return;
    const data=await r.json(),routes=data?.bootstrap?.routes||[];
    const regions=[...new Set(routes.map(x=>x.region).filter(Boolean))];
    const box=$('#regions');if(!box||!regions.length)return;
    const selected=box.querySelector('.selected')?.dataset.region||'';
    box.innerHTML='<button data-region="">전체</button>'+regions.map(region=>`<button data-region="${region.replace(/&/g,'&amp;').replace(/"/g,'&quot;')}">${region.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</button>`).join('');
    const target=[...box.querySelectorAll('button')].find(b=>b.dataset.region===selected)||box.querySelector('button');
    target?.classList.add('selected');
  }catch{}
}
init();
