import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAlertRules,matchesAlertRule,evaluateAlerts} from '../src/alert-rules.mjs';

const rows=[
 {id:'1',destination:'CDG',region:'유럽',date:'2027-04-03',flight:'KE901',time:'11:20',cabin:'PRESTIGE',fare_class:'O',available:1},
 {id:'2',destination:'LHR',region:'유럽',date:'2027-04-04',flight:'KE907',time:'10:50',cabin:'FIRST',fare_class:'A',available:1},
 {id:'3',destination:'JFK',region:'미주',date:'2027-04-05',flight:'KE081',time:'10:00',cabin:'PRESTIGE',fare_class:'O',available:1}
];

test('알림 규칙은 지역·목적지·객실·날짜·주말 조건을 모두 적용한다',()=>{
 const [rule]=normalizeAlertRules([{name:'파리 주말 비즈니스',region:'유럽',destinations:['cdg'],cabins:['prestige'],start:'2027-04-01',end:'2027-04-30',weekend:true}]);
 assert.equal(matchesAlertRule(rows[0],rule),true);
 assert.equal(matchesAlertRule(rows[1],rule),false);
 assert.equal(matchesAlertRule(rows[2],rule),false);
});

test('같은 좌석은 반복 알림하지 않고 사라졌다 다시 생기면 다시 알린다',()=>{
 const rules=normalizeAlertRules([{name:'유럽',region:'유럽'}]);
 const first=evaluateAlerts(rows,rules,{});
 assert.equal(first.opened[0].rows.length,2);
 const previous={rule_hash:first.rule_hash,active:first.active};
 assert.equal(evaluateAlerts(rows,rules,previous).opened.length,0);
 const disappeared=evaluateAlerts([rows[1],rows[2]],rules,previous);
 const reappeared=evaluateAlerts(rows,rules,{rule_hash:disappeared.rule_hash,active:disappeared.active});
 assert.equal(reappeared.opened.length,1);
 assert.equal(reappeared.opened[0].rows[0].destination,'CDG');
});

test('잘못된 객실과 날짜 범위는 거부한다',()=>{
 assert.throws(()=>normalizeAlertRules([{name:'bad',cabins:['Z']}]),/PRESTIGE\/FIRST/);
 assert.throws(()=>normalizeAlertRules([{name:'bad',start:'2027-05-01',end:'2027-04-01'}]),/시작일/);
});
