import test from 'node:test';
import assert from 'node:assert/strict';
import {candidateRegionLabels,parseDestinationButton,prioritizeRoutes,collectionGroup,KOREAN_AIR_REGION_LABELS} from '../src/route-discovery.mjs';

test('user priority is Europe, Americas, Oceania, then all Asian regions',()=>{
 const routes=[{code:'NRT',region:'일본'},{code:'SYD',region:'대양주'},{code:'JFK',region:'미주'},{code:'CDG',region:'유럽/중동'},{code:'BKK',region:'동남아시아/괌'}];
 assert.deepEqual(prioritizeRoutes(routes).map(r=>r.code),['CDG','JFK','SYD','NRT','BKK']);
 assert.equal(collectionGroup('중국/동북아시아'),'아시아');assert.equal(routes[0].code,'NRT');
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
