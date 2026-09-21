const $=s=>document.querySelector(s);
const mobile=window.matchMedia('(max-width:850px)');
let scheduled=0,homeMode=true;

function modeButton(mode){return $(`#display-mode [data-mode="${mode}"]`);}
function currentMode(){return modeButton('calendar')?.classList.contains('selected')?'calendar':'list';}
function setMode(mode){
 const target=modeButton(mode);if(!target)return;
 homeMode=false;
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
function makeHomeButton(){
 const button=document.createElement('button');
 button.type='button';button.className='nav home-nav';button.id='home-nav';
 button.innerHTML='<span>⌂</span>홈';
 button.setAttribute('aria-label','홈으로 이동하고 검색 조건 초기화');
 button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();goHome();});
 return button;
}
function goHome(){
 homeMode=true;
 const explore=$('.nav[data-view="explore"]');
 if(explore)explore.click();
 $('#reset')?.click();
 const list=modeButton('list');
 if(list&&!list.classList.contains('selected'))list.click();
 const dialog=$('#dialog');if(dialog?.open)dialog.close();
 history.replaceState(null,'',location.pathname);
 syncNav();
 requestAnimationFrame(()=>window.scrollTo({top:0,behavior:'smooth'}));
}
function syncNav(){
 const nav=$('.sidebar nav');if(!nav)return;
 nav.querySelector('.nav[data-view="data"]')?.setAttribute('hidden','');
 let home=nav.querySelector('#home-nav'),list=nav.querySelector('[data-mobile-mode="list"]'),calendar=nav.querySelector('[data-mobile-mode="calendar"]');
 const explore=nav.querySelector('[data-view="explore"]');
 if(!home){home=makeHomeButton();nav.insertBefore(home,explore);}
 if(!list){list=makeModeButton('list','목록','☷');explore?.after(list);}
 if(!calendar){calendar=makeModeButton('calendar','달력','▦');list.after(calendar);}
 const alert=nav.querySelector('#cloud-alert-nav');if(alert&&calendar.nextElementSibling!==alert)calendar.after(alert);
 const mode=currentMode();
 for(const button of nav.querySelectorAll('.mobile-mode-nav'))button.classList.toggle('is-selected',button.dataset.mobileMode===mode&&!homeMode);
 home.classList.toggle('active',homeMode);
 if(homeMode)explore?.classList.remove('active');
 else if(explore&&!mobile.matches)explore.classList.toggle('active',!$('#explorer')?.hidden);
}
function schedule(){if(scheduled)return;scheduled=requestAnimationFrame(()=>{scheduled=0;syncNav();});}

document.addEventListener('click',e=>{
 if(e.target.closest('#display-mode [data-mode]')){homeMode=false;schedule();return;}
 if(e.target.closest('.sidebar .nav[data-view]')){homeMode=false;schedule();return;}
 if(e.target.closest('.filter-card button,.filter-card summary')){if(!e.target.closest('#reset'))homeMode=false;schedule();}
},true);
document.addEventListener('change',e=>{if(e.target.closest('.filter-card')){homeMode=false;schedule();}},true);
document.addEventListener('input',e=>{if(e.target.closest('.filter-card')){homeMode=false;schedule();}},true);
$('.brand')?.addEventListener('click',e=>{e.preventDefault();goHome();});
const observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true});
mobile.addEventListener?.('change',schedule);
schedule();
