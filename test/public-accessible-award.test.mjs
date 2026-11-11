import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parsePublicAccessibleAwardMonth} from '../src/public-accessible-award.mjs';
const options={origin:'CDG',destination:'ICN',month:'2027-04',startDate:'2027-04-01',
  endDate:'2027-04-30',sourceUpdatedAt:'2026년 11월 12일 01:30'};
function tree({departure='CDG',arrival='ICN',month='2027년 4월',count=30}={}){
 const days=Array.from({length:count},(_,i)=>{
  const contents=i===0?'일반석 보너스 프레스티지석 좌석승급':
    i===7?'프레스티지석 보너스 일등석 보너스/좌석승급':
    i===8?'일반석 보너스':'';
  return '    - button "'+(i+1)+'일, 목요일 '+contents+'":';
 }).join('\n');
 return [
  '- banner:','- main:','  - heading "보너스 좌석 상황" [level=1]',
  '  - text: 출발지 파리/샤를 드 골','  - emphasis: '+departure,
  '  - text: 도착지 서울/인천','  - emphasis: '+arrival,
  '  - navigation "가는 여정":','    - button "지난 달"',
  '    - button "다음 달"','    - button "'+month+' '+month+'"',
  '  - application:',days,'- contentinfo:'
 ].join('\n');
}
test('real public accessibility calendar captures awards, never seat-upgrade-only',()=>{
 const result=parsePublicAccessibleAwardMonth(tree(),options);
 assert.equal(result.status,'COVERED');
 assert.equal(result.days,30);
 assert.deepEqual(result.rows.map(r=>r.fareClass),['O','A']);
 assert.ok(result.rows.every(r=>r.date==='2027-04-08'&&r.origin==='CDG'&&r.destination==='ICN'));
 assert.ok(result.rows.every(r=>r.flight===null&&r.sourcePath==='PUBLIC_UI_RENDERED'));
});
test('wrong route or month must not generate a published seat snapshot',()=>{
 assert.throws(()=>parsePublicAccessibleAwardMonth(tree({departure:'ICN'}),options),/route mismatch/);
 assert.throws(()=>parsePublicAccessibleAwardMonth(tree({arrival:'LHR'}),options),/route mismatch/);
 assert.throws(()=>parsePublicAccessibleAwardMonth(tree({month:'2027년 5월'}),options),/month mismatch/);
});
test('missing result and partial calendars fail closed',()=>{
 assert.throws(()=>parsePublicAccessibleAwardMonth('- main:\n- heading "보너스 좌석 조회"',options),/result screen/);
 assert.throws(()=>parsePublicAccessibleAwardMonth(tree({count:12}),options),/dated calendar buttons/);
});
test('scanner contains no direct API query or intercepted response source',()=>{
 const script=fs.readFileSync(new URL('../scripts/collect-europe-returns.mjs',import.meta.url),'utf8');
 assert.match(script,/parsePublicAccessibleAwardMonth/);
 assert.doesNotMatch(script,/PUBLIC_API|queryPublicSeatMonth|waitForResponse|response\.json\(\)/);
});
