import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const DEFAULT_TELEGRAM_TARGET_PATH=path.resolve('public-data/telegram-target.json');
const CONTEXT='mileway.telegram.target.v1';
const b64=b=>Buffer.from(b).toString('base64url');
const from64=s=>Buffer.from(String(s||''),'base64url');
const keyFor=token=>crypto.createHash('sha256').update(CONTEXT).update('\0').update(String(token||'')).digest();

export function encryptTelegramTarget(chatId,token,meta={}){
 if(!token)throw new Error('TELEGRAM_BOT_TOKEN이 필요합니다.');
 const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',keyFor(token),iv);
 const ciphertext=Buffer.concat([cipher.update(String(chatId),'utf8'),cipher.final()]);
 return {version:1,iv:b64(iv),tag:b64(cipher.getAuthTag()),ciphertext:b64(ciphertext),bot_username:meta.bot_username||null,registered_at:meta.registered_at||new Date().toISOString()};
}

export function decryptTelegramTarget(record,token){
 if(!record||record.version!==1||!token)return null;
 try{
  const decipher=crypto.createDecipheriv('aes-256-gcm',keyFor(token),from64(record.iv));
  decipher.setAuthTag(from64(record.tag));
  return Buffer.concat([decipher.update(from64(record.ciphertext)),decipher.final()]).toString('utf8');
 }catch{return null;}
}

export function readTelegramTarget(token,file=DEFAULT_TELEGRAM_TARGET_PATH){
 try{const record=JSON.parse(fs.readFileSync(file,'utf8'));const chatId=decryptTelegramTarget(record,token);return chatId?{chatId,record}:null;}catch{return null;}
}

export function writeTelegramTarget(chatId,token,{file=DEFAULT_TELEGRAM_TARGET_PATH,bot_username=null}={}){
 const record=encryptTelegramTarget(chatId,token,{bot_username});
 fs.mkdirSync(path.dirname(file),{recursive:true});
 fs.writeFileSync(file,JSON.stringify(record,null,2)+'\n');
 return record;
}

async function telegramApi(token,method,body=null,fetchImpl=fetch){
 const res=await fetchImpl(`https://api.telegram.org/bot${token}/${method}`,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});
 let data=null;try{data=await res.json();}catch{}
 if(!res.ok||!data?.ok)throw new Error(`Telegram ${method} 요청 실패`);
 return data.result;
}

export async function discoverTelegramTarget(token,{fetchImpl=fetch}={}){
 if(!token)return null;
 const me=await telegramApi(token,'getMe',null,fetchImpl);
 const updates=await telegramApi(token,'getUpdates',{limit:100,timeout:0,allowed_updates:['message']},fetchImpl);
 const candidates=(updates||[]).map(u=>({update_id:u.update_id,message:u.message})).filter(x=>x.message?.chat?.type==='private');
 if(!candidates.length)return {chatId:null,bot_username:me?.username||null};
 const starts=candidates.filter(x=>String(x.message?.text||'').startsWith('/start'));
 const target=(starts.length?starts:candidates).sort((a,b)=>Number(b.update_id)-Number(a.update_id))[0];
 return {chatId:String(target.message.chat.id),bot_username:me?.username||null};
}

export async function resolveTelegramTarget(token,{explicitChatId='',file=DEFAULT_TELEGRAM_TARGET_PATH,allowDiscover=false,fetchImpl=fetch}={}){
 if(!token)return {chatId:null,bot_username:null,source:'none'};
 if(explicitChatId)return {chatId:String(explicitChatId),bot_username:null,source:'secret'};
 const saved=readTelegramTarget(token,file);if(saved)return {chatId:saved.chatId,bot_username:saved.record.bot_username||null,source:'encrypted-file'};
 if(!allowDiscover)return {chatId:null,bot_username:null,source:'none'};
 const found=await discoverTelegramTarget(token,{fetchImpl});
 if(!found?.chatId)return {chatId:null,bot_username:found?.bot_username||null,source:'none'};
 writeTelegramTarget(found.chatId,token,{file,bot_username:found.bot_username});
 return {...found,source:'auto-registered'};
}

export async function sendTelegramText(token,chatId,text,{fetchImpl=fetch}={}){
 if(!token||!chatId)return false;
 await telegramApi(token,'sendMessage',{chat_id:chatId,text,disable_web_page_preview:true},fetchImpl);
 return true;
}
