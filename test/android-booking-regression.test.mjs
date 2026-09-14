import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');

test('Android booking re-patches links when seat hydration changes href',()=>{
 const js=read('web/android-booking.js');
 assert.match(js,/attributes:true/);
 assert.match(js,/attributeFilter:\['href'\]/);
 assert.doesNotMatch(js,/if\(link\.dataset\.androidIntent==='true'\)continue/);
 assert.match(js,/dataset\.webFallback/);
 assert.match(js,/pathname\.startsWith\('\/booking\/'\)/);
});

test('Android booking click is forced through the Korean Air package intent',()=>{
 const js=read('web/android-booking.js');
 assert.match(js,/addEventListener\('click'/);
 assert.match(js,/event\.preventDefault\(\)/);
 assert.match(js,/location\.href=toAndroidIntent\(webUrl\)/);
 assert.match(js,/package=\$\{KOREAN_AIR_PACKAGE\}/);
 assert.match(js,/com\.koreanair\.passenger/);
});
