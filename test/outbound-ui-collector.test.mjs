import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {outwardFromAccessibleTree,DISPLAY_ONLY_FLIGHT} from '../src/outbound-ui-collector.mjs';
const opts={route:{code:'CDG',region:'유럽'},month:'2027-04',start:'2027-04-01',end:'2027-04-30',
  sourceUpdatedAt:'2026년 11월 12일 01:30'};
const date=(d,terms='')=>'    - button "'+d+'일, 목요일 '+terms+'":';
const tree=[
 '- main:','  - heading "보너스 좌석 상황" [level=1]',
 '  - text: 출발지 서울/인천','  - emphasis: ICN',
 '  - text: 도착지 파리/샤를 드 골','  - emphasis: CDG',
 '  - navigation "가는 여정":','    - button "2027년 4월 2027년 4월"',
 '  - application:',...Array.from({length:30},(_,i)=>date(i+1,i===5?'프레스티지석 보너스':'일반석 보너스')),'- contentinfo:'
 ].join('\n');
test('outbound screen scraper emits date/cabin with truthful missing flight label',()=>{
 const result=outwardFromAccessibleTree(tree,opts);
 assert.equal(result.status,'COVERED');
 assert.equal(result.days,30);
 assert.equal(result.rows.length,1);
 assert.equal(result.rows[0].origin,'ICN');
 assert.equal(result.rows[0].destination,'CDG');
 assert.equal(result.rows[0].date,'2027-04-06');
 assert.equal(result.rows[0].fareClass,'O');
 assert.equal(result.rows[0].flight,DISPLAY_ONLY_FLIGHT);
 assert.equal(result.rows[0].direction,'OUTBOUND');
});
test('wrong direction and missing calendar cannot be published',()=>{
 assert.throws(()=>outwardFromAccessibleTree(tree.replace('emphasis: ICN','emphasis: LHR'),opts),/route mismatch/);
 assert.throws(()=>outwardFromAccessibleTree(tree.replace('2027년 4월','2027년 5월'),opts),/month mismatch/);
 assert.throws(()=>outwardFromAccessibleTree('- heading "보너스 좌석 조회"',opts),/result screen/);
});
test('modern outbound path uses rendered screen and preserves API-free branch',()=>{
 const source=fs.readFileSync(new URL('../src/public-extract.mjs',import.meta.url),'utf8');
 assert.match(source,/OUTBOUND SCREEN-ONLY COLLECTION/);
 assert.match(source,/readOutboundScreen/);
 assert.match(source,/UI_ACCESSIBLE_ONLY/);
});
