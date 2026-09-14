const ANDROID=/Android/i.test(navigator.userAgent);
const KOREAN_AIR_PACKAGE='com.koreanair.passenger';
const BOOKING_SELECTOR='a.reserve-button,a.book-button';
const KOREAN_AIR_SEARCH='https://www.koreanair.com/booking/search';

function toAndroidIntent(webUrl){
  try{
    const u=new URL(webUrl,location.href);
    if(u.hostname!=='www.koreanair.com'&&u.hostname!=='koreanair.com')return webUrl;
    const fallback=encodeURIComponent(u.toString());
    return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(':','')};action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=${KOREAN_AIR_PACKAGE};S.browser_fallback_url=${fallback};end`;
  }catch{return webUrl;}
}

function bookingWebUrl(link){
  const href=String(link?.getAttribute?.('href')||'');
  const fallback=String(link?.dataset?.webFallback||'');
  const candidate=href.startsWith('intent://')?fallback:href;
  try{
    const u=new URL(candidate,location.href);
    if(u.hostname!=='www.koreanair.com'&&u.hostname!=='koreanair.com')return '';
    if(!u.pathname.startsWith('/booking/'))return '';
    return u.toString();
  }catch{return '';}
}

function patchBookingLink(link){
  if(!ANDROID||!link)return false;
  const webUrl=bookingWebUrl(link);
  if(!webUrl)return false;
  const intent=toAndroidIntent(webUrl);
  link.dataset.webFallback=webUrl;
  link.dataset.androidIntent='true';
  if(link.getAttribute('href')!==intent)link.setAttribute('href',intent);
  link.removeAttribute('target');
  link.setAttribute('rel','noreferrer');
  const label=(link.getAttribute('aria-label')||'대한항공 예약').replace(/\s*· 앱에서 열기$/,'');
  link.setAttribute('aria-label',label+' · 앱에서 열기');
  return true;
}

function patchBookingLinks(root=document){
  if(!ANDROID)return;
  for(const link of root.querySelectorAll?.(BOOKING_SELECTOR)||[])patchBookingLink(link);
}

patchBookingLinks();
const observer=new MutationObserver(()=>patchBookingLinks());
observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['href']});

document.addEventListener('click',event=>{
  if(!ANDROID)return;
  const link=event.target.closest?.(BOOKING_SELECTOR);
  if(!link)return;
  const webUrl=bookingWebUrl(link);
  if(!webUrl)return;
  event.preventDefault();
  patchBookingLink(link);
  location.href=toAndroidIntent(webUrl);
},true);

void KOREAN_AIR_SEARCH;
