import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

execFileSync(process.execPath,['scripts/organize-weekly.mjs','--write'],{stdio:'inherit'});
const data=JSON.parse(fs.readFileSync('content/organized.json','utf8'));
const index=JSON.parse(fs.readFileSync('content/index.json','utf8'));
const categoryIds=new Set(data.categories.map(c=>c.id));
assert.equal(data.schema_version,1);
assert.equal(categoryIds.size,6,'Six categories required');
assert.equal(data.source_status,'learning-log');
assert.equal(data.verified,false);
assert.deepEqual(data.weeks,index.weekly);
assert.equal(new Set(data.topics.map(t=>t.id)).size,data.topics.length);
for(const t of data.topics){
 assert.equal(t.status,'draft','A machine-classified topic must never be verified');
 assert.ok(categoryIds.has(t.category));
 assert.ok(t.refs.length>0);
 for(const r of t.refs){
  assert.ok(index.weekly.includes(r.weekly));
  assert.ok(['今週の学習','今週の重要ポイント','正式ノート候補'].includes(r.section));
  assert.ok(Number.isInteger(r.index)&&r.index>=0);
 }
}
const sample='content/weekly/2026-10-09.md';
if(index.weekly.includes(sample)){
 for(const id of ['infection-mssa-bacteremia','infection-candidemia','culture-gpc-clusters','drug:tmp-smx','organism:stenotrophomonas-maltophilia']){
  assert.ok(data.topics.some(t=>t.id===id),id+' should appear in the first Weekly');
 }
 const m=data.topics.find(t=>t.id==='infection-mssa-bacteremia');
 assert.equal(m.note,'content/notes/mssa-bacteremia.md','Link known integrated note');
}
const raw=fs.readFileSync('content/organized.json','utf8');
assert.ok(!raw.includes('"excerpt"')&&!raw.includes('"answer"'),'Only source pointers may be in the generated index');
console.log('Organizer tests OK: '+data.topics.length+' topics, '+data.weeks.length+' weeks.');
