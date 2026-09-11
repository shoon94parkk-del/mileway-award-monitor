import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {encryptTelegramTarget,decryptTelegramTarget,discoverTelegramTarget,resolveTelegramTarget} from '../scripts/telegram-target.mjs';

const TOKEN='123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi';

test('Telegram chat id is encrypted and only decrypts with the bot token',()=>{
 const record=encryptTelegramTarget('987654321',TOKEN,{bot_username:'mileway_test_bot'});
 assert.notEqual(record.ciphertext,'987654321');
 assert.equal(decryptTelegramTarget(record,TOKEN),'987654321');
 assert.equal(decryptTelegramTarget(record,TOKEN+'x'),null);
});

test('Telegram target discovery prefers the latest private Start message',async()=>{
 const responses=[{ok:true,result:{username:'mileway_test_bot'}},{ok:true,result:[
  {update_id:10,message:{text:'hello',chat:{id:1,type:'private'}}},
  {update_id:12,message:{text:'/start mileway',chat:{id:2,type:'private'}}},
  {update_id:13,message:{text:'group',chat:{id:-100,type:'group'}}}
 ]}];
 const fetchImpl=async()=>({ok:true,json:async()=>responses.shift()});
 const found=await discoverTelegramTarget(TOKEN,{fetchImpl});
 assert.deepEqual(found,{chatId:'2',bot_username:'mileway_test_bot'});
});

test('token-only setup persists and reuses an encrypted target',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mileway-telegram-')),file=path.join(dir,'target.json');
 const responses=[{ok:true,result:{username:'mileway_test_bot'}},{ok:true,result:[{update_id:20,message:{text:'/start',chat:{id:55,type:'private'}}}]}];
 const fetchImpl=async()=>({ok:true,json:async()=>responses.shift()});
 const first=await resolveTelegramTarget(TOKEN,{file,allowDiscover:true,fetchImpl});
 assert.equal(first.chatId,'55');
 assert.equal(first.source,'auto-registered');
 assert.ok(fs.existsSync(file));
 const second=await resolveTelegramTarget(TOKEN,{file,allowDiscover:false});
 assert.equal(second.chatId,'55');
 assert.equal(second.source,'encrypted-file');
});

test('collector and test workflow support Telegram without TELEGRAM_CHAT_ID',()=>{
 const collect=fs.readFileSync('.github/workflows/collect.yml','utf8');
 const setup=fs.readFileSync('.github/workflows/setup-telegram.yml','utf8');
 const notify=fs.readFileSync('scripts/notify-alerts.mjs','utf8');
 assert.match(collect,/scripts\/register-telegram\.mjs/);
 assert.match(collect,/public-data\/telegram-target\.json/);
 assert.match(setup,/Connect Telegram/);
 assert.match(notify,/allowDiscover:true/);
});
