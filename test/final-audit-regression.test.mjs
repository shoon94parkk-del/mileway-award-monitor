import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');

test('public UI describes the real 23 KST watcher instead of a fake hourly cadence',()=>{
 const cloud=read('web/cloud-enhancements.js'),build=read('scripts/build-cloud.mjs');
 assert.match(cloud,/30초 집중 확인/);
 assert.match(cloud,/23시 집중 감시/);
 assert.doesNotMatch(cloud,/약 1시간/);
 assert.match(build,/22:47 KST/);
 assert.match(build,/22:57~23:20/);
 assert.match(build,/23:33~02:03/);
 assert.doesNotMatch(build,/평소 약 1시간/);
});

test('legacy secret-based alert manager is no longer shipped in cloud enhancements',()=>{
 const cloud=read('web/cloud-enhancements.js');
 assert.doesNotMatch(cloud,/ALERT_RULES_JSON/);
 assert.doesNotMatch(cloud,/openAlertManager/);
 assert.doesNotMatch(cloud,/cloud-alert-status/);
});

test('recent-opened panel only shows seats that are still current and bookable',()=>{
 const cloud=read('web/cloud-enhancements.js');
 assert.match(cloud,/current=new Set/);
 assert.match(cloud,/current\.has\(seatIdentity\(e\)\)/);
 assert.match(cloud,/지금 예약 가능한 좌석/);
});

test('public notification status means checked, not falsely sent',()=>{
 const status=read('scripts/build-public-status.mjs'),health=read('scripts/write-health.mjs');
 assert.match(status,/notification_status:notificationFailure\?'failed':health\.last_notification_check_at\?'checked':'unknown'/);
 assert.doesNotMatch(status,/last_notification_check_at\?'sent'/);
 assert.match(health,/rules_scope:'private_api'/);
 assert.match(health,/if\(notify==='success'\)next\.last_notification_check_at=now/);
 assert.doesNotMatch(health,/priorRuleCount/);
});

test('notification sender refuses silent success when direct Telegram config is gone',()=>{
 const notify=read('scripts/notify-alerts.mjs');
 assert.match(notify,/telegram_direct_configured/);
 assert.match(notify,/Alert API direct Telegram config is missing/);
});

test('saved count ignores orphaned favorites while keeping their local ids for a future reopen',()=>{
 const api=read('web/cloud-api.js');
 assert.match(api,/visibleFavorites=snapshot\.rows\.reduce/);
 assert.match(api,/favorites:visibleFavorites/);
});

test('shared dialog state is reset after the seat guide closes',()=>{
 const seat=read('web/seat-info.js');
 assert.match(seat,/content\.className=''/);
 assert.match(seat,/addEventListener\('close'/);
 assert.match(seat,/classList\.remove\('seat-info-dialog'\)/);
});

test('mobile first paint keeps the filter sheet closed before enhancement modules run',()=>{
 const html=read('web/index.html');
 assert.match(html,/filter-card cloud-collapsed/);
 assert.match(html,/max-width:850px/);
 assert.match(html,/MutationObserver/);
 assert.match(html,/setTimeout\(\(\)=>\{const batch=pending\.splice\(0\);timer=0;callback\(batch,self\|\|observer\)\},80\)/);
});

test('cloud startup uses bundled snapshot immediately and refreshes live data with a timeout',()=>{
 const api=read('web/cloud-api.js'),build=read('scripts/build-cloud.mjs');
 assert.match(api,/FALLBACK_SNAPSHOT_URL='\.\/snapshot\.json'/);
 assert.match(api,/fetchSnapshot\(FALLBACK_SNAPSHOT_URL,2500\)/);
 assert.match(api,/void refreshLiveSnapshot\(\)/);
 assert.match(api,/new AbortController\(\)/);
 assert.match(api,/fetchSnapshot\(SNAPSHOT_URL,5000\)/);
 assert.match(build,/live cloud snapshot source/);
});

test('mobile seat cards keep date-time, seat-aircraft, and actions in two compact rows',()=>{
 const mobile=read('web/mobile-booking.css'),seat=read('web/seat-info.css'),seatJs=read('web/seat-info.js');
 assert.match(mobile,/grid-template-columns:minmax\(0,1fr\) 74px 92px 46px/);
 assert.match(mobile,/grid-template-rows:25px 25px/);
 assert.match(mobile,/날짜\/시간/);
 assert.match(mobile,/좌석\/기종/);
 assert.match(seat,/\.flight-row>\.seat-actions\{grid-column:4!important;grid-row:1\/3!important/);
 assert.match(seat,/\.aircraft-meta\{grid-column:3!important;grid-row:2!important/);
 assert.match(seatJs,/compactQuery\.matches\?'좌석':'좌석 정보'/);
 assert.match(seatJs,/className=`aircraft-meta/);
});

test('service worker cache includes aircraft inference module and is advanced for compact mobile UI',()=>{
 const sw=read('web/service-worker.js');
 const match=sw.match(/mileway-shell-v(\d+)/);assert.ok(match);assert.ok(Number(match[1])>=25);
 assert.match(sw,/flight-aircraft\.js/);
});
