import test from 'node:test';
import assert from 'node:assert/strict';
import {candidateRegionLabels,parseDestinationButton,prioritizeRoutes,collectionGroup,monitoredRoute,KOREAN_AIR_REGION_LABELS} from '../src/route-discovery.mjs';

test('user priority is Europe, Americas, Oceania, then reduced Asian scope',()=>{
 const routes=[
  {code:'NRT',region:'동북아시아'},
  {code:'GUM',region:'대양주/괌'},
  {code:'SYD',region:'대양주/괌'},
  {code:'JFK',region:'미주'},
  {code:'CDG',region:'유럽'},
  {code:'BKK',region:'동남아시아/서남아시아'},
  {code:'DPS',region:'동남아시아/서남아시아'},
  {code:'DXB',region:'중동/아프리카'}
 ];
 assert.deepEqual(prioritizeRoutes(routes).map(r=>r.code),['CDG','JFK','SYD','DPS','DXB']);
 assert.equal(collectionGroup('동북아시아'),'아시아');
});

test('monitoring policy skips Northeast Asia, Guam, and keeps only Bali in combined Southeast/South Asia',()=>{
 assert.equal(monitoredRoute({code:'NRT',region:'동북아시아'}),false);
 assert.equal(monitoredRoute({code:'PVG',region:'중국/동북아시아'}),false);
 assert.equal(monitoredRoute({code:'HND',region:'일본'}),false);
 assert.equal(monitoredRoute({code:'GUM',region:'대양주/괌'}),false);
 assert.equal(monitoredRoute({code:'SYD',region:'대양주/괌'}),true);
 assert.equal(monitoredRoute({code:'BKK',region:'동남아시아/서남아시아'}),false);
 assert.equal(monitoredRoute({code:'SIN',region:'동남아시아/괌'}),false);
 assert.equal(monitoredRoute({code:'DPS',region:'동남아시아/서남아시아'}),true);
 assert.equal(monitoredRoute({code:'DEL',region:'서남아시아'}),true);
 assert.equal(monitoredRoute({code:'DXB',region:'중동/아프리카'}),true);
});

test('전 세계 지역 후보에서 국내와 UI 버튼을 제외한다',()=>{
  const regions=candidateRegionLabels(['대한민국','일본','중국/동북아시아','동남아시아/괌','서남아시아','미주','유럽/중동','대양주','닫기','모든 지역 보기','NRT 도쿄/나리타']);
  assert.deepEqual(regions,['일본','중국/동북아시아','동남아시아/괌','서남아시아','미주','유럽/중동','대양주']);
});

test('collapsed-panel DOM fallback keeps all current Korean Air regions',()=>{
  assert.deepEqual(candidateRegionLabels([]),KOREAN_AIR_REGION_LABELS);
  assert.deepEqual(KOREAN_AIR_REGION_LABELS,['미주','동북아시아','동남아시아/서남아시아','유럽','대양주/괌','러시아/몽골/중앙아시아','중동/아프리카']);
});

test('목적지 버튼에서 공항 코드와 도시명을 추출한다',()=>{
  assert.deepEqual(parseDestinationButton('NRT 도쿄/나리타','일본'),{code:'NRT',region:'일본',label:'NRT 도쿄/나리타',city:'도쿄/나리타'});
  assert.equal(parseDestinationButton('대양주','대양주'),null);
});
