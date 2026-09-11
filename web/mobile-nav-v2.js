const $=s=>document.querySelector(s);
const mobile=window.matchMedia('(max-width:850px)');
let scheduled=0;

function modeButton(mode){return $(`#display-mode [data-mode="${mode}"]`);}
function currentMode(){return modeButton('calendar')?.classList.contains('selected')?'calendar':'list';}
function setMode(mode){
 const target=modeButton(mode);if(!target)return;
 target.click();
 syncNav();
 requestAnimationFrame(()=>$('.results-toolbar')?.scrollIntoView({block:'start',behavior:'smooth'}));
}
function makeModeButton(mode,label,icon){
 const button=document.createElement('button');
 button.type='button';button.className='nav mobile-mode-nav';button.dataset.mobileMode=mode;
 button.innerHTML=`<span>${icon}</span>${label}`;
 button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();setMode(mode);});
 return button;
}
function syncNav(){
 const nav=$('.sidebar nav');if(!nav)return;
 nav.querySelector('.nav[data-view="data"]')?.setAttribute('hidden','');
 let list=nav.querySelector('[data-mobile-mode="list"]'),calendar=nav.querySelector('[data-mobile-mode="calendar"]');
 if(!list){list=makeModeButton('list','목록','☷');const explore=nav.querySelector('[data-view="explore"]');explore?.after(list);}
 if(!calendar){calendar=makeModeButton('calendar','달력','▦');list.after(calendar);}
 const alert=nav.querySelector('#cloud-alert-nav');if(alert&&calendar.nextElementSibling!==alert)calendar.after(alert);
 const mode=currentMode();
 for(const button of nav.querySelectorAll('.mobile-mode-nav'))button.classList.toggle('is-selected',button.dataset.mobileMode===mode);
 const explore=nav.querySelector('[data-view="explore"]');if(explore)explore.classList.remove('active');
}
function schedule(){if(scheduled)return;scheduled=requestAnimationFrame(()=>{scheduled=0;syncNav();});}

document.addEventListener('click',e=>{if(e.target.closest('#display-mode [data-mode]'))schedule();},true);
const observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
mobile.addEventListener?.('change',schedule);
schedule();
