const ANDROID=/Android/i.test(navigator.userAgent);
const KOREAN_AIR_PACKAGE='com.koreanair.passenger';

function toAndroidIntent(webUrl){
  try{
    const u=new URL(webUrl,location.href);
    if(u.hostname!=='www.koreanair.com'&&u.hostname!=='koreanair.com')return webUrl;
    const fallback=encodeURIComponent(u.toString());
    return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(':','')};action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=${KOREAN_AIR_PACKAGE};S.browser_fallback_url=${fallback};end`;
  }catch{return webUrl;}
}

function patchBookingLinks(root=document){
  if(!ANDROID)return;
  for(const link of root.querySelectorAll?.('a.reserve-button')||[]){
    if(link.dataset.androidIntent==='true')continue;
    const webUrl=link.href;
    if(!webUrl.includes('koreanair.com/booking/search'))continue;
    link.dataset.webFallback=webUrl;
    link.dataset.androidIntent='true';
    link.href=toAndroidIntent(webUrl);
    link.removeAttribute('target');
    link.setAttribute('rel','noreferrer');
    link.setAttribute('aria-label',(link.getAttribute('aria-label')||'대한항공 예약')+' · 앱에서 열기');
  }
}

patchBookingLinks();
const observer=new MutationObserver(()=>patchBookingLinks());
observer.observe(document.body,{childList:true,subtree:true});
