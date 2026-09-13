import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');

test('public status avoids heartbeat-only commits and hourly runner churn',()=>{
 const workflow=read('.github/workflows/status.yml');
 assert.doesNotMatch(workflow,/cron:\s*['"]7 \* \* \* \*['"]/);
 assert.match(workflow,/delete copy\.generated_at/);
 assert.match(workflow,/delete copy\.heartbeat_at/);
 assert.match(workflow,/Semantic status unchanged; skip heartbeat-only commit and downstream redeploy/);
});

test('generated public data does not launch redundant full CI',()=>{
 const workflow=read('.github/workflows/ci.yml');
 assert.match(workflow,/paths-ignore:/);
 assert.match(workflow,/public-data\/\*\*/);
 assert.match(workflow,/cancel-in-progress:\s*true/);
});

test('free alert API is woken on demand instead of kept alive every five minutes',()=>{
 const workflow=read('.github/workflows/telegram-sync.yml');
 const notify=read('scripts/notify-alerts.mjs');
 assert.doesNotMatch(workflow,/\*\/5 \* \* \* \*/);
 assert.match(workflow,/50 5,17 \* \* \*/);
 assert.match(workflow,/github\.event_name != 'schedule'/);
 assert.match(notify,/ALERT_API_URL\+'\/health'/);
 assert.match(notify,/setTimeout\(\(\)=>controller\.abort\(\),90000\)/);
 assert.match(notify,/setTimeout\(\(\)=>controller\.abort\(\),30000\)/);
});
