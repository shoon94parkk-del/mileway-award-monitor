import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {writePublicReport} from '../src/public-report.mjs';

test('report distinguishes fully attempted coverage from unqueryable inventory',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'mileway-report-'));
 try{
  writePublicReport({rows:[],start_date:'2026-09-09',end_date:'2027-09-04',source_updated_at:'test',coverage:[],errors:[],complete:false,attempt_complete:true,unqueryable:[{destination:'ZRH',month:'2026-11',reason:'<not inventory>'}]},directory);
  const html=fs.readFileSync(path.join(directory,'report.html'),'utf8');
  assert.ok(html.includes('전체 요청 완료 · 일부 조회 불가'));
  assert.ok(html.includes('항공사 조회 불가 1개 구간'));
  assert.ok(html.includes('ZRH 2026-11'));
  assert.ok(html.includes('좌석 없음으로 해석하면 안 됩니다.'));
  assert.ok(!html.includes('<not inventory>'));
 }finally{
  const target=path.resolve(directory);
  assert.equal(path.dirname(target),path.resolve(os.tmpdir()));
  assert.ok(path.basename(target).startsWith('mileway-report-'));
  fs.rmSync(target,{recursive:true});
 }
});
