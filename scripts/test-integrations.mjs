import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const read=p=>fs.readFileSync(p,'utf8');
const index=JSON.parse(read('content/index.json'));
const noteBefore=new Map(index.notes.map(p=>[p,createHash('sha256').update(read(p)).digest('hex')]));
const original=read('content/integration-proposals.json');
const data=JSON.parse(original);
assert.equal(data.schema_version,1);
assert.equal(data.verified,false);
assert.match(data.generator,/rule-based/);
assert.equal(new Set(data.facts.map(f=>f.id)).size,data.facts.length);
assert.ok(data.stats.topics>=1);
assert.ok(data.stats.facts>=1);
const topics=new Map(data.topics.map(t=>[t.topic_id,t]));
const facts=new Map(data.facts.map(f=>[f.id,f]));
for(const f of data.facts){
 assert.equal(f.status,'draft');
 assert.ok(['review_required','draft_learning'].includes(f.risk));
 assert.ok(f.refs.length);
 assert.equal(new Set(f.refs.map(r=>[r.weekly,r.section,r.index].join('#'))).size,f.refs.length);
 for(const r of f.refs){
  assert.ok(index.weekly.includes(r.weekly));
  assert.ok(['今週の重要ポイント','今週の復習'].includes(r.section));
  assert.ok(Number.isInteger(r.index)&&r.index>=0);
 }
}
for(const t of data.topics){
 if(t.note_path)assert.ok(index.notes.includes(t.note_path));
 for(const link of t.links){
  assert.ok(facts.has(link.fact_id),'Dangling fact link');
  assert.equal(typeof link.target_section,'string');
 }
}
assert.ok(!('"text"' in JSON.parse(original).facts?.[0]||false));
for(const field of ['"question"','"answer"','"prompt"','"raw"']){
 assert.ok(!original.includes(field+':'),'Do not copy medical source content into output: '+field);
}
if(index.weekly.includes('content/weekly/2026-10-09.md')){
 const mssa=topics.get('infection-mssa-bacteremia');
 const candida=topics.get('infection-candidemia');
 assert.ok(mssa?.links.length>=1,'MSSA note must receive draft learning proposals');
 assert.equal(mssa.note_path,'content/notes/mssa-bacteremia.md');
 assert.ok(candida?.links.length>=1,'Candida topic must receive source-linked drafts');
 assert.ok(data.stats.review_required>=1,'Clinical recommendations must be review-gated');
}
execFileSync(process.execPath,['scripts/propose-integrations.mjs','--write'],{stdio:'inherit'});
assert.equal(read('content/integration-proposals.json'),original,'Generator must be deterministic');
for(const [p,sha] of noteBefore){
 assert.equal(createHash('sha256').update(read(p)).digest('hex'),sha,'Notes must not be modified by automatic integration');
}
console.log('Integration tests passed: '+data.stats.facts+' unique facts / '+data.stats.review_required+' review-required / '+data.topics.length+' topics');
