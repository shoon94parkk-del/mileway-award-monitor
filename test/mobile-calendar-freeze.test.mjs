import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');

test('calendar enhancement is idempotent and does not retrigger its own observer forever',()=>{
 const source=read('web/cloud-enhancements.js');
 assert.match(source,/if\(text!==['"]미확인['"]\)b\.textContent=['"]미확인['"]/);
 assert.match(source,/observer\.disconnect\(\);improveCalendar\(\);observer\.observe\(calendar,\{childList:true,subtree:true\}\)/);
});

test('service worker cache remains newer than the calendar freeze fix',()=>{
 const match=read('web/service-worker.js').match(/mileway-shell-v(\d+)/);
 assert.ok(match);
 assert.ok(Number(match[1])>=19);
});
