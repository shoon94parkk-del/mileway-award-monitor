import test from 'node:test';
import assert from 'node:assert/strict';
import {candidateRegionLabels,parseDestinationButton} from '../src/route-discovery.mjs';

test('전 세계 지역 후보에서 국내와 UI 버튼을 제외한다',()=>{
  const regions=candidateRegionLabels(['대한민국','일본','중국/동북아시아','동남아시아/괌','서남아시아','미주','유럽/중동','대양주','닫기','모든 지역 보기','NRT 도쿄/나리타']);
  assert.deepEqual(regions,['일본','중국/동북아시아','동남아시아/괌','서남아시아','미주','유럽/중동','대양주']);
});

test('목적지 버튼에서 공항 코드와 도시명을 추출한다',()=>{
  assert.deepEqual(parseDestinationButton('NRT 도쿄/나리타','일본'),{code:'NRT',region:'일본',label:'NRT 도쿄/나리타',city:'도쿄/나리타'});
  assert.equal(parseDestinationButton('대양주','대양주'),null);
});
