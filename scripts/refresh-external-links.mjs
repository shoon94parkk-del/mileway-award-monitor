// Refresh only externally published article titles + links. No seat data is
// copied: the provider retains its own inventory, calendar and publication.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

export const CATEGORIES=['Europe','North America','Oceania','Asia','Japan'];
const FEED='https://milengo.kr/rss.xml';
const CATEGORY='https://milengo.kr/마일리지-잔여좌석';
const LIMIT=2_000_000;
const decode=txt=>String(txt||'').replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi,s=>{
 const map={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"};
 const v=s.toLowerCase();if(map[v])return map[v];
 if(v.startsWith('&#')){const hex=v.startsWith('&#x');const n=Number.parseInt(v.slice(hex?3:2,-1),hex?16:10);return Number.isInteger(n)&&n<=0x10ffff?String.fromCodePoint(n):s}
 return s;
});
const plain=s=>decode(String(s||'').replace(/<[^>]*>/g,'').trim()).replace(/\s+/g,' ');
const rssTag=(block,tag)=>{const m=block.match(new RegExp('<'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+tag+'>','i'));return m?plain(m[1].replace(/^<!\[CDATA\[|\]\]>$/g,'')):''};
export function extractLinkMetadata(title,href){
 const clean=plain(title);
 const match=clean.match(/^대한항공\s+보너스\s+좌석\((Europe|North America|Oceania|Asia|Japan)\)\s*:\s*(\d{4}-\d{2}-\d{2})\s*기준/);
 if(!match)return null;
 let url;try{url=new URL(decode(href),CATEGORY)}catch{return null}
 if(url.hostname!=='milengo.kr'||url.protocol!=='https:')return null;
 if(!/\d{4}-\d{2}-\d{2}/.test(match[2])||Number.isNaN(Date.parse(match[2]+'T00:00:00Z')))return null;
 return {region:match[1],label:({'Europe':'유럽·귀국편','North America':'미주','Oceania':'오세아니아','Asia':'아시아','Japan':'일본'})[match[1]],
  date:match[2],title:clean,url:url.toString()};
}
export function parsePublicRss(xml){
 const entries=[];
 for(const m of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)){
  const article=extractLinkMetadata(rssTag(m[1],'title'),rssTag(m[1],'link'));
  if(article)entries.push(article);
 }
 return entries;
}
export function parsePublicListing(html){
 const entries=[];
 for(const m of html.matchAll(/<a\b[^>]*href\s*=\s*(['"])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)){
  const article=extractLinkMetadata(m[3],m[2]);
  if(article)entries.push(article);
 }
 return entries;
}
export function selectExternalLinks(found,previous=[]){
 const selected=new Map();
 for(const item of [...previous,...found]){
  const clean=extractLinkMetadata(item?.title,item?.url);
  if(!clean||item.region!==clean.region||item.date!==clean.date)continue;
  const old=selected.get(clean.region);
  if(!old||clean.date>old.date)selected.set(clean.region,clean);
 }
 return CATEGORIES.map(region=>selected.get(region)).filter(Boolean);
}
async function readPublic(url){
 const signal=AbortSignal.timeout(16000);
 const response=await fetch(url,{signal,headers:{'Accept':'application/rss+xml, application/xml, text/html;q=0.8'}});
 const resolved=new URL(response.url);
 if(resolved.hostname!=='milengo.kr'||resolved.protocol!=='https:'||!response.ok())throw Error('External public listing unavailable');
 const content=await response.text();
 if(content.length>LIMIT)throw Error('External public listing too large');
 return content;
}
export async function refreshLinks(file='public-data/external-links.json'){
 const previous=JSON.parse(fs.readFileSync(file,'utf8'));
 let discovered=[],error=null;
 try{discovered=parsePublicRss(await readPublic(FEED))}catch(e){error=e.message}
 if(discovered.length<CATEGORIES.length){
  try{discovered.push(...parsePublicListing(await readPublic(CATEGORY)))}catch(e){error=(error?error+'; ':'')+e.message}
 }
 const articles=selectExternalLinks(discovered,previous.articles);
 if(!articles.length||!discovered.length)throw Error('Could not verify a current provider index; leave prior links unchanged. '+(error||''));
 const current={...previous,last_checked_at:new Date().toISOString(),articles};
 fs.writeFileSync(file,JSON.stringify(current,null,2)+'\n');
 console.log('PUBLIC EXTERNAL LINKS:',articles.map(a=>a.region+':'+a.date).join(', '));
 return current;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 await refreshLinks(process.argv[2]||'public-data/external-links.json');
}
