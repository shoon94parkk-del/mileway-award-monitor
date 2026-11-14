// Link-only fallback. These are independently published posts, NOT Mileway
// verified inventory. Never ingest external article bodies or present them as
// the official Korean Air live award calendar.
const DATA_URL='https://raw.githubusercontent.com/shoon94parkk-del/mileway-award-monitor/main/public-data/external-links.json';
const categoryUrl='https://milengo.kr/마일리지-잔여좌석';
const labels={'Europe':'유럽 · 귀국편 포함','North America':'미주','Oceania':'오세아니아','Asia':'아시아','Japan':'일본'};
function safeUrl(value){
 try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='milengo.kr'?u.href:null}catch{return null}
}
function addText(tag,content,className){
 const el=document.createElement(tag);
 if(className)el.className=className;
 el.textContent=content;
 return el;
}
async function showExternalLinks(){
 const where=document.querySelector('.direction-switch-wrap');
 if(!where)return;
 const section=document.createElement('section');section.className='external-reference';section.setAttribute('aria-label','독립 공개 좌석 자료 참고');
 const heading=document.createElement('div');heading.className='external-reference-head';
 heading.append(addText('strong','외부 공개 보너스 좌석 자료'));
 heading.append(addText('span','우리 수집기와 별도 · 출처 이동'));
 section.append(heading);
 section.append(addText('p','대한항공 조회 제한으로 자료가 오래된 경우, zoommytrip 운영자가 다른 사이트에 공개한 지역별 게시물을 확인할 수 있습니다. 좌석 수와 예약 가능 여부는 대한항공에서 재확인하세요.'));
 const links=document.createElement('div');links.className='external-reference-links';
 try{
  const response=await fetch(DATA_URL,{cache:'no-store',signal:AbortSignal.timeout(7000)});
  if(!response.ok())throw Error('External link index unavailable');
  const json=await response.json();
  if(json.source_type!=='EXTERNAL_LINKS_ONLY'||!Array.isArray(json.articles))throw Error('Invalid external source data');
  const europeFirst=[...json.articles].sort((a,b)=>(a.region==='Europe'?-1:0)-(b.region==='Europe'?-1:0));
  for(const item of europeFirst){
   const href=safeUrl(item.url);
   if(!href||!labels[item.region]||!/^\d{4}-\d{2}-\d{2}$/.test(item.date))continue;
   const link=document.createElement('a');link.href=href;link.target='_blank';link.rel='noopener noreferrer';
   link.append(addText('b',labels[item.region]));
   link.append(addText('span',item.date+' 기준 · 원문 보기'));
   links.append(link);
  }
 }catch(error){
  const link=document.createElement('a');link.href=categoryUrl;link.target='_blank';link.rel='noopener noreferrer';
  link.textContent='zoommytrip 공개 자료 모아보기';
  links.append(link);
 }
 if(!links.children.length){
  const a=document.createElement('a');a.href=categoryUrl;a.target='_blank';a.rel='noopener noreferrer';a.textContent='최신 공개 자료 모아보기';links.append(a);
 }
 section.append(links);
 where.insertAdjacentElement('afterend',section);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',showExternalLinks,{once:true});
else showExternalLinks();
