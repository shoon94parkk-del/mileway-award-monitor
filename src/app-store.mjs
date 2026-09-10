import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';

export const seatKey=r=>createHash('sha256').update([r.date,r.origin,r.destination,r.flight,r.cabin].join('|')).digest('hex').slice(0,24);
export function createStore(filename,catalog=[]) {
 const db=new DatabaseSync(filename);db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS seats(id TEXT PRIMARY KEY,date TEXT NOT NULL,origin TEXT NOT NULL,destination TEXT NOT NULL,flight TEXT NOT NULL,time TEXT,cabin TEXT,fare_class TEXT,available INTEGER,region TEXT,city TEXT,country TEXT,source_updated_at TEXT,checked_at TEXT,availability_type TEXT);
 CREATE INDEX IF NOT EXISTS seat_filter ON seats(available,date,destination,cabin);
 CREATE TABLE IF NOT EXISTS favorites(seat_id TEXT PRIMARY KEY REFERENCES seats(id),created_at TEXT);
 CREATE TABLE IF NOT EXISTS searches(id INTEGER PRIMARY KEY,name TEXT NOT NULL,filters TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS changes(id INTEGER PRIMARY KEY,seat_id TEXT,kind TEXT,source_updated_at TEXT,detected_at TEXT);
 CREATE TABLE IF NOT EXISTS observations(seat_id TEXT,source_updated_at TEXT,available INTEGER,checked_at TEXT,PRIMARY KEY(seat_id,source_updated_at));
 CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
 let lastMtime=0;let report={coverage:[],routes:[],rows:[],complete:false};
 const getMeta=db.prepare('SELECT value FROM metadata WHERE key=?');
 const existing=getMeta.get('report');if(existing)report=JSON.parse(existing.value);
 const setMeta=db.prepare('INSERT OR REPLACE INTO metadata VALUES (?,?)');
 const lookup=db.prepare('SELECT available,source_updated_at,checked_at FROM seats WHERE id=?');
 // UPSERT instead of REPLACE to preserve favorite foreign keys.
 const upsert=db.prepare(`INSERT INTO seats VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET time=excluded.time,available=excluded.available,source_updated_at=excluded.source_updated_at,checked_at=excluded.checked_at,availability_type=excluded.availability_type`);
 const observation=db.prepare('INSERT OR REPLACE INTO observations VALUES (?,?,?,?)');
 const event=db.prepare('INSERT INTO changes(seat_id,kind,source_updated_at,detected_at) VALUES (?,?,?,?)');
 function importReport(next) {
  if(!Array.isArray(next.rows)||!Array.isArray(next.coverage))throw new Error('Invalid collection report');
  db.exec('BEGIN');
  try {
   for(const r of next.rows) {
    if(!r.flight || typeof r.available!=='boolean')continue;
    const id=seatKey(r),old=lookup.get(id);if(old?.checked_at===r.checkedAt)continue;
    const city=catalog.find(c=>c.code===r.destination)||{};
    upsert.run(id,r.date,r.origin,r.destination,r.flight,r.departureTime||'',r.cabin,r.fareClass,+r.available,r.region||city.region,city.city||r.destination,city.country||'',r.sourceUpdatedAt||next.source_updated_at,r.checkedAt,r.availabilityType);
    observation.run(id,r.sourceUpdatedAt||next.source_updated_at,+r.available,r.checkedAt);
    if(old&&old.available!==+r.available)event.run(id,r.available?'OPENED':'CLOSED',r.sourceUpdatedAt,r.checkedAt);
   }
   const {rows,...meta}=next;setMeta.run('report',JSON.stringify(meta));db.exec('COMMIT');report=meta;
  }catch(e){db.exec('ROLLBACK');throw e;}
 }
 function sync(file) {
  if(!fs.existsSync(file))return;
  const stamp=fs.statSync(file).mtimeMs;if(stamp===lastMtime)return;
  // A collector may currently be writing the file. Keep the last consistent snapshot.
  let next;try{next=JSON.parse(fs.readFileSync(file,'utf8'));}catch{return;}
  importReport(next);lastMtime=stamp;
 }
 function where(filters={},available=true) {
  const saved=filters.saved==='true';
  const clauses=saved?['1=1']:['s.date>=?','s.date<=?',"(s.destination||'|'||substr(s.date,1,7)||'|'||s.source_updated_at) IN (SELECT value FROM json_each(?))"];
  const args=saved?[]:[report.start_date||'0000-00-00',report.end_date||'9999-12-31',JSON.stringify((report.coverage||[]).map(c=>c.destination+'|'+c.month+'|'+(c.source_updated_at||report.source_updated_at||'')))];
  if(available&&!saved)clauses.push('s.available=1');
  if(filters.region){clauses.push('s.region=?');args.push(filters.region);}
  if(filters.destination){clauses.push('s.destination=?');args.push(filters.destination);}
  if(filters.cabin){clauses.push('s.cabin=?');args.push(filters.cabin);}
  if(filters.month){clauses.push('substr(s.date,1,7)=?');args.push(filters.month);}
  if(filters.start){clauses.push('s.date>=?');args.push(filters.start);}
  if(filters.end){clauses.push('s.date<=?');args.push(filters.end);}
  if(filters.date){clauses.push('s.date=?');args.push(filters.date);}
  if(filters.q){clauses.push('(s.city LIKE ? OR s.destination LIKE ? OR s.flight LIKE ? OR s.country LIKE ?)');args.push(...Array(4).fill('%'+filters.q.slice(0,100)+'%'));}
  if(filters.weekend==='true')clauses.push("strftime('%w',s.date) IN ('0','6')");
  if(filters.saved==='true')clauses.push('f.seat_id IS NOT NULL');
  if(filters.new==='true')clauses.push("EXISTS(SELECT 1 FROM changes c WHERE c.seat_id=s.id AND c.kind='OPENED' AND datetime(c.detected_at)>=datetime('now','-1 day'))");
  return {sql:clauses.join(' AND '),args};
 }
 function list(filters={}) {
  const {sql,args}=where(filters);const count=db.prepare(`SELECT count(*) AS n FROM seats s LEFT JOIN favorites f ON f.seat_id=s.id WHERE ${sql}`).get(...args).n;
  const order={date:'s.date ASC,s.time ASC',latest:'s.date DESC,s.time ASC',city:'s.city ASC,s.date ASC',first:"CASE s.cabin WHEN 'FIRST' THEN 0 ELSE 1 END,s.date ASC"}[filters.sort]||'s.date ASC,s.time ASC';
  const bounded=(value,fallback,max)=>Number.isFinite(Number(value))?Math.min(max,Math.max(0,Math.trunc(Number(value)))):fallback;
  const limit=Math.max(1,bounded(filters.limit??30,30,50000)),offset=bounded(filters.offset??0,0,1000000);
  const rows=db.prepare(`SELECT s.*,f.seat_id IS NOT NULL AS saved FROM seats s LEFT JOIN favorites f ON f.seat_id=s.id WHERE ${sql} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...args,limit,offset);
  return {total:count,rows,offset,limit};
 }
 function bootstrap() {
  const {sql,args}=where();
  const stats=db.prepare(`SELECT count(*) AS available,count(DISTINCT s.destination) AS destinations,count(DISTINCT s.date) AS dates,sum(s.cabin='FIRST') AS first FROM seats s LEFT JOIN favorites f ON f.seat_id=s.id WHERE ${sql}`).get(...args);
  const routes=(report.routes||[]).map(r=>({...r,...catalog.find(c=>c.code===r.code),region:r.region}));
  const destinations=db.prepare(`SELECT s.destination,s.city,s.region,count(*) AS count,min(s.date) AS next_date FROM seats s LEFT JOIN favorites f ON f.seat_id=s.id WHERE ${sql} GROUP BY s.destination ORDER BY count DESC`).all(...args);
  return {report,stats,routes,destinations,favorites:db.prepare('SELECT count(*) AS n FROM favorites').get().n,searches:db.prepare('SELECT * FROM searches ORDER BY id DESC').all().map(r=>({...r,filters:JSON.parse(r.filters)})),changes:db.prepare('SELECT c.*,s.city,s.date,s.cabin FROM changes c JOIN seats s ON s.id=c.seat_id ORDER BY c.id DESC LIMIT 30').all()};
 }
 function calendar(filters) {
  const {sql,args}=where(filters);
  return db.prepare(`SELECT s.date,count(*) AS count,sum(s.cabin='FIRST') AS first,count(DISTINCT s.destination) AS destinations FROM seats s LEFT JOIN favorites f ON f.seat_id=s.id WHERE ${sql} GROUP BY s.date ORDER BY s.date`).all(...args);
 }
 function favorite(id,saved){if(!db.prepare('SELECT 1 FROM seats WHERE id=?').get(id))throw new Error('Seat not found');if(saved)db.prepare('INSERT OR IGNORE INTO favorites VALUES (?,?)').run(id,new Date().toISOString());else db.prepare('DELETE FROM favorites WHERE seat_id=?').run(id);}
 function saveSearch(name,filters){
  if(typeof name!=='string'||!name.trim()||name.length>80)throw new Error('검색 이름은 1~80자로 입력해 주세요.');
  if(!filters||typeof filters!=='object'||Array.isArray(filters))throw new Error('검색 조건 형식이 올바르지 않습니다.');
  const allowed=['region','destination','cabin','month','start','end','date','q','weekend','sort'];
  const clean={};for(const [key,value] of Object.entries(filters)){if(!allowed.includes(key)||typeof value!=='string'||value.length>100)throw new Error('지원하지 않는 검색 조건입니다.');clean[key]=value;}
  return db.prepare('INSERT INTO searches(name,filters,created_at) VALUES (?,?,?)').run(name.trim(),JSON.stringify(clean),new Date().toISOString()).lastInsertRowid;
 }
 return {db,sync,importReport,list,bootstrap,calendar,favorite,saveSearch,deleteSearch:id=>db.prepare('DELETE FROM searches WHERE id=?').run(id),getSeat:id=>db.prepare('SELECT s.*,f.seat_id IS NOT NULL AS saved FROM seats s LEFT JOIN favorites f ON f.seat_id=s.id WHERE s.id=?').get(id),get report(){return report;}};
}
