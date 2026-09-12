import test from 'node:test';
import assert from 'node:assert/strict';
import {candidateRegionLabels,parseDestinationButton,prioritizeRoutes,collectionGroup,monitoredRoute,monitoredRegion,MONITORED_REGION_LABELS} from '../src/route-discovery.mjs';

test('user priority is Europe, Americas, Oceania, then Bali only in Asian scope',()=>{
 const routes=[
  {code:'NRT',region:'동북아시아'},
  {code:'GUM',region:'대양주/괌'},
  {code:'SYD',region:'대양주/괌'},
  {code:'JFK',region:'미주'},
  {code:'CDG',region:'유럽'},
  {code:'BKK',region:'동남아시아/서남아시아'},
  {code:'DPS',region:'동남아시아/서남아시아'},
  {code:'UBN',region:'러시아/몽골/중앙아시아'},
  {code:'DXB',region:'중동/아프리카'}
 ];
 assert.deepEqual(prioritizeRoutes(routes).map(r=>r.code),['CDG','JFK','SYD','DPS']);
 assert.equal(collectionGroup('동북아시아'),'아시아');
});

test('monitoring policy skips Northeast Asia, Guam, Russia Mongolia Central Asia and Middle East Africa, and keeps only Bali in combined Southeast South Asia',()=>{
 assert.equal(monitoredRoute({code:'NRT',region:'동북아시아'}),false);
 assert.equal(monitoredRoute({code:'PVG',region:'중국/동북아시아'}),false);
 assert.equal(monitoredRoute({code:'HND',region:'일본'}),false);
 assert.equal(monitoredRoute({code:'GUM',region:'대양주/괌'}),false);
 assert.equal(monitoredRoute({code:'SYD',region:'대양주/괌'}),true);
 assert.equal(monitoredRoute({code:'BKK',region:'동남아시아/서남아시아'}),false);
 assert.equal(monitoredRoute({code:'DEL',region:'서남아시아'}),false);
 assert.equal(monitoredRoute({code:'SIN',region:'동남아시아/괌'}),false);
 assert.equal(monitoredRoute({code:'DPS',region:'동남아시아/서남아시아'}),true);
 assert.equal(monitoredRoute({code:'UBN',region:'러시아/몽골/중앙아시아'}),false);
 assert.equal(monitoredRoute({code:'TAS',region:'러시아/몽골/중앙아시아'}),false);
 assert.equal(monitoredRoute({code:'DXB',region:'중동/아프리카'}),false);
 assert.equal(monitoredRoute({code:'NBO',region:'중동/아프리카'}),false);
});

test('discovery opens only source regions that can contain monitored routes',()=>{
  const regions=candidateRegionLabels(['대한민국','동북아시아','동남아시아/서남아시아','미주','유럽','대양주/괌','러시아/몽골/중앙아시아','중동/아프리카','닫기','모든 지역 보기']);
  assert.deepEqual(regions,['동남아시아/서남아시아','미주','유럽','대양주/괌']);
  assert.equal(monitoredRegion('동북아시아'),false);
  assert.equal(monitoredRegion('러시아/몽골/중앙아시아'),false);
  assert.equal(monitoredRegion('중동/아프리카'),false);
});

test('collapsed-panel DOM fallback keeps only monitored current Korean Air regions',()=>{
  assert.deepEqual(candidateRegionLabels([]),MONITORED_REGION_LABELS);
  assert.deepEqual(MONITORED_REGION_LABELS,['미주','동남아시아/서남아시아','유럽','대양주/괌']);
});

test('destination parser discards excluded airports before they reach discovery logs or collection queue',()=>{
  assert.equal(parseDestinationButton('NRT 도쿄/나리타','동북아시아'),null);
  assert.equal(parseDestinationButton('GUM 괌','대양주/괌'),null);
  assert.equal(parseDestinationButton('BKK 방콕','동남아시아/서남아시아'),null);
  assert.deepEqual(parseDestinationButton('DPS 발리','동남아시아/서남아시아'),{code:'DPS',region:'동남아시아/서남아시아',label:'DPS 발리',city:'발리'});
  assert.deepEqual(parseDestinationButton('CDG 파리','유럽'),{code:'CDG',region:'유럽',label:'CDG 파리',city:'파리'});
  assert.equal(parseDestinationButton('대양주','대양주'),null);
});
