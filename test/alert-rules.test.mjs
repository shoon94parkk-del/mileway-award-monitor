import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAlertRules,matchesAlertRule,evaluateAlerts,alertSeatKey} from '../src/alert-rules.mjs';

const rows=[
 {id:'1',destination:'CDG',region:'유럽',date:'2027-04-03',flight:'KE901',time:'11:20',cabin:'PRESTIGE',fare_class:'O',available:1},
 {id:'2',destination:'LHR',region:'유럽',date:'2027-04-04',flight:'KE907',time:'10:50',cabin:'FIRST',fare_class:'A',available:1},
 {id:'3',destination:'JFK',region:'미주',date:'2027-04-05',flight:'KE081',time:'10:00',cabin:'PRESTIGE',fare_class:'O',available:1},
 {id:'4',destination:'NRT',region:'일본',date:'2027-04-06',flight:'KE703',time:'10:10',cabin:'PRESTIGE',fare_class:'O',available:1}
];
const state=result=>({rule_hash:result.rule_hash,rule_meta:result.rule_meta,active:result.active,active_rows:result.active_rows});

test('알림 규칙은 지역·목적지·객실·날짜·주말 조건을 모두 적용한다',()=>{
 const [rule]=normalizeAlertRules([{id:'rule_paris_01',name:'파리 주말 비즈니스',region:'유럽',destinations:['cdg'],cabins:['prestige'],start:'2027-04-01',end:'2027-04-30',weekend:true}]);
 assert.equal(matchesAlertRule(rows[0],rule),true);
 assert.equal(matchesAlertRule(rows[1],rule),false);
 assert.equal(matchesAlertRule(rows[2],rule),false);
});

test('미주·유럽 외 지역도 알림 규칙에 사용할 수 있다',()=>{
 const [rule]=normalizeAlertRules([{id:'rule_japan_01',name:'일본',region:'일본',destinations:['NRT']}]);
 assert.equal(matchesAlertRule(rows[3],rule),true);
 assert.equal(matchesAlertRule(rows[0],rule),false);
});

test('같은 좌석은 반복 알림하지 않고 사라졌다 다시 생기면 다시 알린다',()=>{
 const rules=normalizeAlertRules([{id:'rule_europe_01',name:'유럽',region:'유럽'}]);
 const first=evaluateAlerts(rows,rules,{});
 assert.equal(first.opened[0].rows.length,2);
 const previous=state(first);
 assert.equal(evaluateAlerts(rows,rules,previous).opened.length,0);
 const disappeared=evaluateAlerts([rows[1],rows[2],rows[3]],rules,previous);
 const reappeared=evaluateAlerts(rows,rules,state(disappeared));
 assert.equal(reappeared.opened.length,1);
 assert.equal(reappeared.opened[0].rows[0].destination,'CDG');
});

test('available → unknown → available은 새 좌석으로 다시 알리지 않는다',()=>{
 const rules=normalizeAlertRules([{id:'rule_europe_01',name:'유럽',region:'유럽',destinations:['CDG']}]);
 const coverage={coverage:[{destination:'CDG',month:'2027-04'}],unqueryable:[]};
 const first=evaluateAlerts([rows[0]],rules,{},coverage);
 const unknown=evaluateAlerts([],rules,state(first),{coverage:[],unqueryable:[{destination:'CDG',month:'2027-04'}]});
 assert.equal(unknown.active.rule_europe_01.length,1);
 assert.equal(unknown.unknown_preserved,1);
 const recovered=evaluateAlerts([rows[0]],rules,state(unknown),coverage);
 assert.equal(recovered.opened.length,0);
});

test('available → confirmed unavailable → available은 재오픈 알림을 만든다',()=>{
 const rules=normalizeAlertRules([{id:'rule_europe_01',name:'유럽',region:'유럽',destinations:['CDG']}]);
 const coverage={coverage:[{destination:'CDG',month:'2027-04'}],unqueryable:[]};
 const first=evaluateAlerts([rows[0]],rules,{},coverage);
 const unavailable=evaluateAlerts([],rules,state(first),coverage);
 assert.equal(unavailable.active.rule_europe_01.length,0);
 const reopened=evaluateAlerts([rows[0]],rules,state(unavailable),coverage);
 assert.equal(reopened.opened.length,1);
 assert.equal(reopened.opened[0].rows[0].destination,'CDG');
});

test('다른 규칙을 추가해도 기존 규칙 좌석을 신규로 다시 알리지 않는다',()=>{
 const firstRules=normalizeAlertRules([{id:'rule_europe_01',name:'유럽',region:'유럽'}]);
 const first=evaluateAlerts(rows,firstRules,{});
 const nextRules=normalizeAlertRules([
  {id:'rule_europe_01',name:'유럽',region:'유럽'},
  {id:'rule_america_01',name:'미주',region:'미주'}
 ]);
 const next=evaluateAlerts(rows,nextRules,state(first));
 assert.equal(next.opened.length,1);
 assert.equal(next.opened[0].rule.id,'rule_america_01');
 assert.equal(next.opened[0].rows[0].destination,'JFK');
});

test('같은 이름의 규칙도 고유 id가 다르면 상태가 충돌하지 않는다',()=>{
 const rules=normalizeAlertRules([
  {id:'rule_same_01',name:'여행',destinations:['CDG']},
  {id:'rule_same_02',name:'여행',destinations:['LHR']}
 ]);
 const result=evaluateAlerts(rows,rules,{});
 assert.equal(result.opened.length,2);
 assert.ok(result.active.rule_same_01);
 assert.ok(result.active.rule_same_02);
});

test('출발시각·예약클래스 메타데이터가 바뀌어도 같은 좌석으로 본다',()=>{
 const changed={...rows[0],time:'11:35',fare_class:'X'};
 assert.equal(alertSeatKey(rows[0]),alertSeatKey(changed));
});

test('잘못된 객실·날짜 범위·중복 id는 거부한다',()=>{
 assert.throws(()=>normalizeAlertRules([{name:'bad',cabins:['Z']}]),/PRESTIGE\/FIRST/);
 assert.throws(()=>normalizeAlertRules([{name:'bad',start:'2027-05-01',end:'2027-04-01'}]),/시작일/);
 assert.throws(()=>normalizeAlertRules([{id:'rule_dup_01',name:'a'},{id:'rule_dup_01',name:'b'}]),/중복/);
});
