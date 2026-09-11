import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {normalizeRegion} from '../web/cloud-api.js';

const read=file=>fs.readFileSync(file,'utf8');

test('cloud build exposes an exact seven-day opened-seat summary',()=>{
 const run=spawnSync(process.execPath,['--no-warnings','scripts/build-cloud.mjs'],{encoding:'utf8'});
 assert.equal(run.status,0,run.stderr||run.stdout);
 const snapshot=JSON.parse(read('dist/snapshot.json'));
 const recent=snapshot.bootstrap?.recent_opened;
 assert.equal(recent?.days,7);assert.ok(Number.isInteger(recent?.total));assert.ok(Array.isArray(recent?.items));assert.ok(recent.total>=recent.items.length);assert.ok(recent.items.length<=8);
});

test('recent change history never truncates events from the last seven days',()=>{const source=read('scripts/publish-data.mjs');assert.match(source,/const recent=events\.filter/);assert.match(source,/const older=events\.filter/);assert.match(source,/events=\[\.\.\.recent,\.\.\.older\]/);});

test('mobile UI prioritizes results with compact summaries and bottom-sheet filters',()=>{const js=read('web/ui-v2.js'),css=read('web/ui-v2.css');assert.match(js,/mobile-stats-summary/);assert.match(js,/mobile-filter-summary-bar/);assert.match(js,/mobile-filter-sheet-apply/);assert.match(js,/moveRecentOpenedBelowResults/);assert.match(css,/@media\(max-width:850px\).*?\.stats\{display:none!important\}/s);assert.match(css,/\.mobile-stats-summary\{display:flex/);assert.match(css,/\.filter-card\{display:block!important;position:fixed/);assert.match(css,/\.filter-top \.segments\{display:flex;.*?overflow-x:auto/s);});

test('mobile award results use a compact booking table',()=>{const css=read('web/mobile-booking.css'),js=read('web/ui-v2.js'),build=read('scripts/build-cloud.mjs');assert.match(css,/\.mobile-award-list-head\{display:grid/);assert.match(css,/\.reserve-button\{grid-column:4!important/);assert.match(js,/목적지<\/span><span>날짜<\/span><span>좌석\/시간<\/span><span>예약/);assert.match(build,/mobile-booking\.css/);});

test('reservation link prefills Korean Air mileage one-way route and date',()=>{const js=read('web/ui-v2.js');assert.match(js,/bookingType:'A'/);assert.match(js,/tripType:'OW'/);assert.match(js,/departure:'ICN'/);assert.match(js,/departureDate:String\(row\.date\|\|''\)/);});

test('Android booking forces Korean Air My app with browser fallback',()=>{const js=read('web/android-booking.js'),build=read('scripts/build-cloud.mjs');assert.match(js,/KOREAN_AIR_PACKAGE='com\.koreanair\.passenger'/);assert.match(js,/intent:\/\//);assert.match(js,/koreanair\.com\/booking\/search/);assert.match(build,/android-booking\.js/);});

test('Telegram setup wizard only asks for Bot Token and Start',()=>{const js=read('web/telegram-setup.js'),build=read('scripts/build-cloud.mjs');assert.match(js,/TELEGRAM_BOT_TOKEN/);assert.match(js,/TELEGRAM_CHAT_ID는 이제 필요 없습니다/);assert.match(js,/@BotFather/);assert.match(build,/telegram-setup\.js/);});

test('alert center registers real rules directly without JSON or GitHub secrets',()=>{const js=read('web/alert-center.js'),css=read('web/alert-center.css'),build=read('scripts/build-cloud.mjs'),notify=read('scripts/notify-alerts.mjs');assert.match(js,/mileway-alert-api\.onrender\.com/);assert.match(js,/method:'POST'/);assert.match(js,/Telegram 좌석 알림이 바로 등록됐어요/);assert.match(js,/alert-key/);assert.doesNotMatch(js,/ALERT_RULES_JSON/);assert.match(css,/\.nav\[data-view="saved"\]/);assert.match(css,/\.favorite/);assert.match(build,/alert-center\.js/);assert.match(build,/alert-center\.css/);assert.match(notify,/readApiRules/);assert.match(notify,/mileway-alert-api\.onrender\.com/);});

test('alert API requires a management token for writes',()=>{const api=read('src/alert-api.mjs');assert.match(api,/ALERT_ADMIN_TOKEN/);assert.match(api,/timingSafeEqual/);assert.match(api,/req\.method==='POST'&&url\.pathname==='\/rules'/);assert.match(api,/req\.method==='DELETE'/);assert.match(api,/ALLOWED_ORIGIN/);});

test('calendar API avoids unsupported Map.groupBy on mobile browsers',()=>{const cloudApi=read('web/cloud-api.js');assert.doesNotMatch(cloudApi,/Map\.groupBy/);assert.match(cloudApi,/function groupRowsByDate/);});

test('mobile UI observer does not create a self-triggering mutation loop',()=>{const js=read('web/ui-v2.js');assert.match(js,/apply&&apply\.textContent!==applyLabel/);assert.match(js,/new MutationObserver\(scheduleSync\)/);assert.doesNotMatch(js,/characterData:true/);});

test('region filters hide Guam and use canonical visible region keys',()=>{const cloudApi=read('web/cloud-api.js'),regions=read('web/global-regions.js'),status=read('web/regional-status.js'),build=read('scripts/build-cloud.mjs');assert.match(cloudApi,/EXCLUDED_DESTINATIONS=new Set\(\['GUM'\]\)/);assert.equal(normalizeRegion('대양주/괌','SYD'),'오세아니아');assert.equal(normalizeRegion('동남아시아/서남아시아','DPS'),'발리');assert.match(regions,/REGION_ORDER=\['미주','유럽','오세아니아','발리','러시아·몽골','중동'\]/);assert.match(status,/발리·러시아·몽골·중동/);assert.match(build,/괌과 동북아/);});

test('region labels and copy describe the reduced monitoring scope',()=>{const status=read('web/regional-status.js'),html=read('web/index.html'),build=read('scripts/build-cloud.mjs');assert.match(status,/발리·러시아·몽골·중동/);assert.doesNotMatch(html,/대한항공 미주·유럽 보너스 좌석/);assert.match(html,/선택한 모니터링 노선/);assert.match(build,/동북아, 발리를 제외한 동남아\/서남아는 현재 수집하지 않습니다/);});

test('one-time production refresh workflow is removed',()=>{assert.equal(fs.existsSync('.github/workflows/force-worldwide-refresh.yml'),false);});

test('browser shell cache advances after instant alert registration update',()=>{const sw=read('web/service-worker.js');assert.match(sw,/mileway-shell-v14/);assert.match(sw,/alert-center\.js/);assert.match(sw,/alert-center\.css/);assert.match(sw,/mileway-alert-api\.onrender\.com/);});

test('changed browser and server scripts parse successfully',()=>{for(const file of ['web/cloud-api.js','web/cloud-enhancements.js','web/global-regions.js','web/ui-v2.js','web/android-booking.js','web/telegram-setup.js','web/ux-reference-polish.js','web/alert-center.js','web/regional-status.js','web/service-worker.js','src/alert-api.mjs']){const run=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(run.status,0,`${file}: ${run.stderr||run.stdout}`);}});
