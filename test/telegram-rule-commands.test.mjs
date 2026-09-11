import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseTelegramRuleCommand} from '../scripts/telegram-rule-commands.mjs';

const routes=JSON.parse(fs.readFileSync('routes.json','utf8')).routes;

test('Telegram deep link can register a destination and date alert',()=>{
 const command=parseTelegramRuleCommand('/start a-X-DPS-260911-261231-1',routes);
 assert.equal(command.type,'add');
 assert.deepEqual(command.rule.destinations,['DPS']);
 assert.equal(command.rule.start,'2026-09-11');
 assert.equal(command.rule.end,'2026-12-31');
 assert.equal(command.rule.weekend,true);
 assert.match(command.rule.id,/^tg_[0-9a-f]{12}$/);
});

test('Telegram deep link can register a whole region alert',()=>{
 const command=parseTelegramRuleCommand('/start a-O-X-X-X-0',routes);
 assert.equal(command.type,'add');
 assert.equal(command.rule.region,'오세아니아');
 assert.deepEqual(command.rule.destinations,[]);
});

test('Telegram deep link supports deleting an alert',()=>{
 assert.deepEqual(parseTelegramRuleCommand('/start d-tg_123456789abc',routes),{type:'delete',id:'tg_123456789abc'});
});
