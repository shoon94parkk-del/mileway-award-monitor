import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseSourceUpdatedAt,readPublishedSourceUpdatedAt} from '../src/public-source-check.mjs';

test('parses Korean Air public source timestamp',()=>{
  assert.equal(parseSourceUpdatedAt('일일 자료 · 대한민국 시간(2026년 9월 10일 23:00) 기준'),'2026년 9월 10일 23:00');
  assert.equal(parseSourceUpdatedAt('timestamp missing'),null);
});

test('reads published source timestamp from cloud snapshot',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mileway-source-'));
  const file=path.join(dir,'snapshot.json');
  fs.writeFileSync(file,JSON.stringify({bootstrap:{report:{source_updated_at:'2026년 9월 10일 23:00'}}}));
  assert.equal(readPublishedSourceUpdatedAt(file),'2026년 9월 10일 23:00');
  assert.equal(readPublishedSourceUpdatedAt(path.join(dir,'missing.json')),null);
});
