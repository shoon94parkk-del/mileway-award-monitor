import fs from 'node:fs';
import crypto from 'node:crypto';
import {normalizeAlertRules} from '../src/alert-rules.mjs';

export const RULES_FILE='public-data/telegram-rules.json';
export const COMMAND_STATE_FILE='public-data/telegram-command-state.json';
const REGION_MAP={A:'',E:'유럽',U:'미주',O:'오세아니아',B:'발리',R:'러시아·몽골',M:'중동',X:''};
const readJson=(file,fallback)=>{try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}};
const writeJson=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');
const ymd=s=>s==='X'?'':`20${s.slice(0,2)}-${s.slice(2,4)}-${s.slice(4,6)}`;
const ruleId=payload=>'tg_'+crypto.createHash('sha256').update(payload).digest('hex').slice(0,12);

export function readTelegramRules(){return normalizeAlertRules(readJson(RULES_FILE,{rules:[]}).rules||[]);}
export function parseTelegramRuleCommand(text,routes=[]){
 const match=String(text||'').trim().match(/^\/start(?:@\w+)?\s+(.+)$/i);if(!match)return null;
 const payload=match[1];
 if(payload==='clear')return {type:'clear'};
 if(payload.startsWith('d-'))return {type:'delete',id:payload.slice(2)};
 if(!payload.startsWith('a-'))return null;
 const [,regionCode,destsRaw,startRaw,endRaw,weekendRaw]=payload.split('-');
 if(!(regionCode in REGION_MAP)||!destsRaw)return null;
 const destinations=destsRaw==='X'?[]:destsRaw.split('_').filter(v=>/^[A-Z]{3}$/.test(v)).slice(0,6);
 const routeMap=new Map(routes.map(r=>[r.code,r]));
 const label=destinations.length===1?(routeMap.get(destinations[0])?.city||destinations[0]):destinations.length?destinations.join(', '):(REGION_MAP[regionCode]||'전체');
 const rule={id:ruleId(payload),name:`${label} 좌석 알림`,region:REGION_MAP[regionCode],destinations,cabins:[],start:ymd(startRaw),end:ymd(endRaw),weekend:weekendRaw==='1',flights:[]};
 return {type:'add',rule:normalizeAlertRules([rule])[0]};
}
export function applyTelegramRuleCommand(command){
 const current=readTelegramRules();let rules=current;
 if(command?.type==='add')rules=[...current.filter(r=>r.id!==command.rule.id),command.rule].slice(0,50);
 if(command?.type==='delete')rules=current.filter(r=>r.id!==command.id);
 if(command?.type==='clear')rules=[];
 if(command){writeJson(RULES_FILE,{version:1,rules,updated_at:new Date().toISOString()});}
 return rules;
}
export function readCommandState(){return readJson(COMMAND_STATE_FILE,{version:2,last_update_id:0,last_test_request_id:null,updated_at:null});}
export function writeCommandState(lastUpdateId,extra={}){const prev=readCommandState();writeJson(COMMAND_STATE_FILE,{...prev,...extra,version:2,last_update_id:Number(lastUpdateId)||0,updated_at:new Date().toISOString()});}
