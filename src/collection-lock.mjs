import fs from 'node:fs';
export function activeCollection(file){
 try{const lock=JSON.parse(fs.readFileSync(file,'utf8'));if(!Number.isInteger(lock.pid)||lock.pid<1)return null;process.kill(lock.pid,0);return lock;}catch{return null;}
}
export function claimCollection(file){
 if(activeCollection(file))throw Error('이미 공개 자료를 수집하고 있습니다. 기존 수집이 끝난 뒤 다시 시도하세요.');
 // A dead process may leave its lock. Only this exact application lock is replaced.
 if(fs.existsSync(file))fs.unlinkSync(file);
 const value={pid:process.pid,started_at:new Date().toISOString()};
 fs.writeFileSync(file,JSON.stringify(value),{flag:'wx'});
 const release=()=>{try{if(JSON.parse(fs.readFileSync(file,'utf8')).pid===process.pid)fs.unlinkSync(file);}catch{}};
 process.once('exit',release);return release;
}
