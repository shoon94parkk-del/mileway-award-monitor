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
 const changeHistory=readJson('public-data/changes.json',{events:[]});
 const recentChanges=(changeHistory.events||[]).slice(0,100).map(c=>({...c,city:catalog.find(r=>r.code===c.destination)?.city||c.destination}));
 const bootstrap={...store.bootstrap(),changes:recentChanges,cloud:true,scan:{paused:true,running:false,enabled:false,history:[]}};
 fs.writeFileSync('dist/snapshot.json',JSON.stringify({bootstrap,rows:store.list({limit:50000}).rows}));
 for(const file of ['style.css','favicon.svg','cloud-enhancements.css','cloud-enhancements.js','manifest.webmanifest','service-worker.js'])fs.copyFileSync('web/'+file,'dist/'+file);
 fs.writeFileSync('dist/cloud-api.js',fs.readFileSync('web/cloud-api.js','utf8').replace("'./snapshot.json'","'https://raw.githubusercontent.com/shoon94parkk-del/mileway-award-monitor/main/public-data/snapshot.json'"));
 let html=fs.readFileSync('web/index.html','utf8').replaceAll('내 PC 전용','브라우저 저장').replaceAll('내 여행 계획은 이곳에만','찜과 검색 조건은 이 브라우저에만 저장');
 html=replaceRequired(html,'</head>','<meta name="theme-color" content="#2764ef"><link rel="manifest" href="/manifest.webmanifest"><link rel="stylesheet" href="/cloud-enhancements.css"></head>','cloud head assets');
 html=replaceRequired(html,'</body>','<script type="module" src="/cloud-enhancements.js"></script></body>','cloud enhancement script');
 fs.writeFileSync('dist/index.html',html);
 let js=fs.readFileSync('web/app.js','utf8');
 js="import {cloudApi} from './cloud-api.js';\n"+js;
 js=replaceRequired(js,"async function api(url,method='GET',data){","async function api(url,method='GET',data){return cloudApi(url,method,data); /*",'API transport start');
 if(js.includes('return value;}\nfunction toast'))js=replaceRequired(js,'return value;}\nfunction toast','return value;*/}\nfunction toast','API transport end LF');
 else js=replaceRequired(js,'return value;}\r\nfunction toast','return value;*/}\r\nfunction toast','API transport end CRLF');
 js=replaceRequired(js,"location.href='/api/export?'+params","location.href='/snapshot.json';return;void params",'cloud export');
 const cloudPanel=`renderDataBase(); if(boot.cloud){
   $('#scan').hidden=true;
   $('#data-view').insertAdjacentHTML('afterbegin','<section class="data-card"><h2>GitHub 자동 수집</h2><p>평소 약 1시간 간격, 22:30~00:30 KST에는 약 5분 간격으로 대한항공 원자료 갱신을 확인합니다. 23:31 KST 안전망 전체 수집은 원자료 시각 확인과 독립적으로 실행됩니다.</p><p>상단 상태 표시에서 최근 수집 실패와 알림 설정 여부를 확인할 수 있습니다.</p><a href="https://github.com/shoon94parkk-del/mileway-award-monitor/actions" target="_blank" rel="noreferrer">수집 실행 이력 확인 ↗</a></section>');return;
 }`;
 js=replaceRequired(js,'renderDataBase();',cloudPanel,'cloud data panel');
 fs.writeFileSync('dist/app.js',js);
 fs.appendFileSync('dist/style.css','\n.sidebar-foot{font-size:12px}\n');
 console.log(`Cloud build: ${bootstrap.stats.available} available combinations, ${recentChanges.length} retained changes`);
}finally{store.db.close();}
