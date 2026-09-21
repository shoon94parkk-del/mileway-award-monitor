import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root=new URL('../',import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root),'utf8');

test('durable Mileway project memory preserves critical contracts',()=>{
  for(const p of ['AGENTS.md','docs/project-memory.md','docs/regression-guardrails.md','docs/decision-log.md']){
    assert.equal(fs.existsSync(new URL(p,root)),true,p);
  }
  const memory=read('docs/project-memory.md');
  const guard=read('docs/regression-guardrails.md');
  assert.equal(memory.includes('https://mileway-hoon.onrender.com'),true);
  assert.equal(memory.includes('https://mileway-alert-api-hoon.onrender.com'),true);
  assert.equal(memory.includes('source freshness'),true);
  assert.equal(memory.includes('OPENED'),true);
  assert.equal(memory.includes('CLOSED'),true);
  assert.equal(guard.includes('UNQUERYABLE'),true);
  assert.equal(guard.includes('23:05'),true);
  assert.equal(guard.includes('Home reset must not delete saved favorites/alerts'),true);
});
