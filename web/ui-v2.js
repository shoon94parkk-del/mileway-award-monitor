const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function moveRecentOpenedBelowResults(){
 const panel=$('#recent-opened');
 const pagination=$('#pagination');
 if(panel&&pagination&&pagination.parentNode&&panel.previousElementSibling!==pagination){pagination.after(panel);}
}

function renderActiveFilters(){
 const card=$('.filter-card');
 if(!card)return;
 let bar=$('#active-filter-summary');
 if(!bar){bar=document.createElement('div');bar.id='active-filter-summary';bar.className='active-filter-summary';card.after(bar);}
 const region=$('#regions button.selected')?.textContent?.trim()||'전체';
 const destination=$('#destination option:checked')?.textContent?.trim()||'모든 목적지';
 const month=$('#month option:checked')?.textContent?.trim()||'전체 기간';
 const start=$('#start')?.value||'';
 const end=$('#end')?.value||'';
 const weekend=$('#weekend')?.checked;
 const range=start||end?`${start||'시작'} ~ ${end||'종료'}`:month;
 const chips=[`지역 ${region}`,destination,range,'프레스티지 + 일등석',...(weekend?['주말 출발']:[])];
 const signature=chips.join('|');
 if(bar.dataset.signature!==signature){bar.dataset.signature=signature;bar.innerHTML=`<strong>현재 검색조건</strong><div>${chips.map(v=>`<span>${esc(v)}</span>`).join('')}</div>`;}
}

function emphasizeResults(){
 const toolbar=$('.results-toolbar');
 if(toolbar&&!toolbar.querySelector('.results-kicker'))toolbar.querySelector('div')?.insertAdjacentHTML('afterbegin','<span class="results-kicker">AVAILABLE AWARD SEATS</span>');
 const count=$('#result-count');
 if(count)count.classList.add('result-count-strong');
}

function renderMobileStatsSummary(){
 const stats=$('#stats');
 if(!stats)return;
 const cards=[...stats.querySelectorAll('.stat')];
 if(!cards.length)return;
 let details=$('#mobile-stats-summary');
 if(!details){details=document.createElement('details');details.id='mobile-stats-summary';details.className='mobile-stats-summary';stats.after(details);}
 const brief=cards.slice(0,3).map(card=>{const label=card.querySelector('.stat-label')?.textContent?.trim()||'';const number=card.querySelector('.stat-number')?.textContent?.replace(/\s+/g,' ')?.trim()||'';return `${label} ${number}`.trim();}).join(' · ');
 const signature=stats.textContent?.replace(/\s+/g,' ')?.trim()||'';
 if(details.dataset.signature!==signature){details.dataset.signature=signature;details.innerHTML=`<summary><strong>수집 요약</strong><span>${esc(brief)}</span></summary><div class="mobile-stats-content">${stats.innerHTML}</div>`;}
}

function sync(){moveRecentOpenedBelowResults();renderActiveFilters();emphasizeResults();renderMobileStatsSummary();}

const observer=new MutationObserver(()=>{clearTimeout(observer.t);observer.t=setTimeout(sync,40);});
observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
document.addEventListener('change',()=>setTimeout(sync,0),true);
document.addEventListener('click',()=>setTimeout(sync,50),true);
for(let i=0;i<30;i++)setTimeout(sync,i*200);
