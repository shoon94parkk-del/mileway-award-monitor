import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createStore} from '../src/app-store.mjs';

const replaceRequired=(text,needle,replacement,label)=>{if(!text.includes(needle))throw Error(`Cloud build replacement failed: ${label}`);return text.replace(needle,replacement);};
const catalog=JSON.parse(fs.readFileSync('routes.json','utf8')).routes;
const store=createStore(':memory:',catalog);
const readJson=(file,fallback)=>{try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}};
try{
 store.importReport(JSON.parse(gunzipSync(fs.readFileSync('public-data/results.json.gz')).toString('utf8')));
 if(!store.report.source_updated_at||!store.report.attempt_complete)throw Error('Missing completed published snapshot');
 fs.mkdirSync('dist',{recursive:true});
 const baseBootstrap=store.bootstrap();
 const routeMap=new Map((baseBootstrap.routes||[]).map(r=>[r.code,r]));
 const enrich=row=>{const route=routeMap.get(row.destination)||{};return {...row,city:route.city||row.city||row.destination,country:route.country||row.country||route.region||''};};
 const changeHistory=readJson('public-data/changes.json',{events:[]});
 const allChanges=(changeHistory.events||[]).map(c=>enrich(c));
 const sevenDayCutoff=Date.now()-7*864e5;
 const recentOpened=allChanges.filter(c=>c.kind==='OPENED'&&Date.parse(c.detected_at)>=sevenDayCutoff);
 const recentChanges=allChanges.slice(0,100);
 const bootstrap={...baseBootstrap,changes:recentChanges,recent_opened:{days:7,total:recentOpened.length,items:recentOpened.slice(0,8)},cloud:true,scan:{paused:true,running:false,enabled:false,history:[]}};
 const rows=store.list({limit:50000}).rows.map(enrich);
 fs.writeFileSync('dist/snapshot.json',JSON.stringify({bootstrap,rows}));
 for(const file of ['style.css','favicon.svg','cloud-enhancements.css','cloud-enhancements.js','global-regions.js','regional-status.js','ui-v2.css','ui-v2.js','mobile-booking.css','android-booking.js','telegram-setup.css','telegram-setup.js','ux-reference-polish.css','ux-reference-polish.js','manifest.webmanifest','service-worker.js'])fs.copyFileSync('web/'+file,'dist/'+file);
 const cloudApi=replaceRequired(fs.readFileSync('web/cloud-api.js','utf8'),"const SNAPSHOT_URL='./snapshot.json';","const SNAPSHOT_URL='https://raw.githubusercontent.com/shoon94parkk-del/mileway-award-monitor/main/public-data/snapshot.json';",'live cloud snapshot source');
 fs.writeFileSync('dist/cloud-api.js',cloudApi);
 let html=fs.readFileSync('web/index.html','utf8').replaceAll('내 PC 전용','브라우저 저장').replaceAll('내 여행 계획은 이곳에만','찜과 검색 조건은 이 브라우저에만 저장');
 html=replaceRequired(html,'</head>','<meta name="theme-color" content="#2764ef"><link rel="manifest" href="/manifest.webmanifest"><link rel="stylesheet" href="/cloud-enhancements.css"><link rel="stylesheet" href="/ui-v2.css"><link rel="stylesheet" href="/mobile-booking.css"><link rel="stylesheet" href="/telegram-setup.css"><link rel="stylesheet" href="/ux-reference-polish.css"></head>','cloud head assets');
 html=replaceRequired(html,'</body>','<script type="module" src="/cloud-enhancements.js"></script><script type="module" src="/global-regions.js"></script><script type="module" src="/regional-status.js"></script><script type="module" src="/ui-v2.js"></script><script type="module" src="/android-booking.js"></script><script type="module" src="/telegram-setup.js"></script><script type="module" src="/ux-reference-polish.js"></script></body>','cloud enhancement scripts');
 fs.writeFileSync('dist/index.html',html);
 let js=fs.readFileSync('web/app.js','utf8');
 js="import {cloudApi} from './cloud-api.js';\n"+js;
 js=replaceRequired(js,"async function api(url,method='GET',data){","async function api(url,method='GET',data){return cloudApi(url,method,data); /*",'API transport start');
 if(js.includes('return value;}\nfunction toast'))js=replaceRequired(js,'return value;}\nfunction toast','return value;*/}\nfunction toast','API transport end LF');
 else js=replaceRequired(js,'return value;}\r\nfunction toast','return value;*/}\r\nfunction toast','API transport end CRLF');
 js=replaceRequired(js,"location.href='/api/export?'+params","location.href='/snapshot.json';return;void params",'cloud export');
 const cloudPanel=`renderDataBase(); if(boot.cloud){
   $('#scan').hidden=true;
   $('#data-view').insertAdjacentHTML('afterbegin','<section class="data-card"><h2>GitHub 자동 수집 · 선택 노선</h2><p>유럽·미주·오세아니아와 발리(DPS), 러시아·몽골, 중동의 모니터링 대상 노선을 수집합니다. 괌과 동북아, 발리를 제외한 동남아/서남아는 현재 수집하지 않습니다.</p><p>평소 약 1시간 간격, 22:30~00:30 KST에는 약 5분 간격으로 대한항공 원자료 갱신을 확인합니다. 원자료가 갱신되면 지역별로 수집 완료 즉시 반영합니다.</p><p>상단 일일 업데이트 현황에서 최근 수집 상태와 알림 설정 여부를 확인할 수 있습니다.</p><a href="https://github.com/shoon94parkk-del/mileway-award-monitor/actions" target="_blank" rel="noreferrer">수집 실행 이력 확인 ↗</a></section>');return;
 }`;
 js=replaceRequired(js,'renderDataBase();',cloudPanel,'cloud data panel');
 fs.writeFileSync('dist/app.js',js);
 fs.appendFileSync('dist/style.css','\n.sidebar-foot{font-size:12px}\n');
 if(!cloudApi.includes('raw.githubusercontent.com/shoon94parkk-del/mileway-award-monitor/main/public-data/snapshot.json'))throw Error('Cloud build did not wire the live GitHub snapshot');
 console.log(`Cloud build: ${bootstrap.stats.available} available combinations, ${bootstrap.routes.length} monitored routes, ${recentOpened.length} opened in 7 days, ${recentChanges.length} retained changes`);
}finally{store.db.close();}
