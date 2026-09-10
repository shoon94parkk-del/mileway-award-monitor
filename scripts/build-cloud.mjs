import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createStore} from '../src/app-store.mjs';
const store=createStore(':memory:',JSON.parse(fs.readFileSync('routes.json','utf8')).routes);
try{
 store.importReport(JSON.parse(gunzipSync(fs.readFileSync('public-data/results.json.gz')).toString('utf8')));
 if(!store.report.source_updated_at)throw Error('Missing published snapshot');
 fs.mkdirSync('dist',{recursive:true});
 const bootstrap={...store.bootstrap(),cloud:true,scan:{paused:true,running:false,enabled:false,history:[]}};
 fs.writeFileSync('dist/snapshot.json',JSON.stringify({bootstrap,rows:store.list({limit:50000}).rows}));
 for(const file of ['style.css','favicon.svg'])fs.copyFileSync('web/'+file,'dist/'+file);
 fs.writeFileSync('dist/cloud-api.js',fs.readFileSync('web/cloud-api.js','utf8').replace("'./snapshot.json'","'https://raw.githubusercontent.com/shoon94parkk-del/mileway-award-monitor/main/public-data/snapshot.json'"));
 let html=fs.readFileSync('web/index.html','utf8').replaceAll('내 PC 전용','공개 조회 전용').replaceAll('내 여행 계획은 이곳에만','GitHub 자동 수집 · 일일 자료');
 fs.writeFileSync('dist/index.html',html);
 let js=fs.readFileSync('web/app.js','utf8');
 js="import {cloudApi} from './cloud-api.js';\n"+js.replace("async function api(url,method='GET',data){","async function api(url,method='GET',data){return cloudApi(url,method,data); /*").replace("return value;}\nfunction toast", "return value;*/}\nfunction toast");
 // Handle CRLF source checkouts as well as LF.
 if(!js.includes('return value;*/}'))js=js.replace('return value;}\r\nfunction toast','return value;*/}\r\nfunction toast');
 if(!js.includes('return value;*/}'))throw Error('API replacement failed');
 js=js.replace("location.href='/api/export?'+params", "location.href='/snapshot.json';return;void params");
 js=js.replace("renderDataBase();",`renderDataBase(); if(boot.cloud){$('#scan').hidden=true;$('#data-view').insertAdjacentHTML('afterbegin','<section class="data-card"><h2>GitHub 자동 수집</h2><p>공개 일일 자료를 월별로 수집합니다. 최신 성공 자료를 표시하며, 실패한 조회를 좌석 없음으로 처리하지 않습니다.</p><a href="https://github.com/shoon94parkk-del/mileway-award-monitor/actions" target="_blank" rel="noreferrer">수집 실행 이력 확인 ↗</a></section>');return;}`);
 js=js.replace('init();',`document.querySelector('[data-view="saved"]').hidden=true;document.querySelector('#save-search').hidden=true;document.querySelector('.saved-label').hidden=true;document.querySelector('#searches').hidden=true;init();`);
 fs.writeFileSync('dist/app.js',js);
 fs.appendFileSync('dist/style.css','\n.favorite{display:none}.sidebar-foot{font-size:12px}\n');
 console.log(`Cloud build: ${bootstrap.stats.available} available combinations`);
}finally{store.db.close();}
