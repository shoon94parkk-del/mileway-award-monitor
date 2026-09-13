import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAlertRules,matchesAlertRule,regionIdFor} from '../src/alert-rules.mjs';

const bali={destination:'DPS',region:'동남아시아/서남아시아',date:'2027-04-07',flight:'KE629',cabin:'PRESTIGE',available:1};
const sydney={destination:'SYD',region:'대양주/괌',date:'2027-04-08',flight:'KE401',cabin:'PRESTIGE',available:1};

test('발리 표시 규칙은 DPS 원본 지역과 일치한다',()=>{
 const [rule]=normalizeAlertRules([{id:'rule_bali_01',name:'발리',region:'발리'}]);
 assert.equal(rule.region_id,'bali');
 assert.equal(regionIdFor(bali.region,bali.destination),'bali');
 assert.equal(matchesAlertRule(bali,rule),true);
});

test('오세아니아 표시 규칙은 대양주/괌 원본 지역과 일치한다',()=>{
 const [rule]=normalizeAlertRules([{id:'rule_oceania_01',name:'오세아니아',region:'오세아니아'}]);
 assert.equal(rule.region_id,'oceania');
 assert.equal(regionIdFor(sydney.region,sydney.destination),'oceania');
 assert.equal(matchesAlertRule(sydney,rule),true);
});

test('기존 대양주/괌 규칙도 canonical id로 migration된다',()=>{
 const [rule]=normalizeAlertRules([{id:'rule_ocean_legacy',name:'대양주',region:'대양주/괌'}]);
 assert.equal(rule.region_id,'oceania');
 assert.equal(matchesAlertRule(sydney,rule),true);
});
