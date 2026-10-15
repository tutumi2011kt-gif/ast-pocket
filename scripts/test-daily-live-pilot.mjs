/**
 * Integration smoke test with dated, de-identified user learning.
 * The date and general learning concepts are grounded in actual study,
 * not an invented daily entry. Medical statements remain unverified drafts.
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {assertPublicWeekly} from './daily-ingest-core.mjs';
const date='2026-10-15';
const path='content/weekly/'+date+'.md';
const original=fs.readFileSync(path,'utf8');
assert.equal(assertPublicWeekly(original),true);
assert.match(original,/^status:\s*learning-log\s*$/m);
assert.match(original,/^source_coverage:\s*accessible_context_only\s*$/m);
assert.ok(original.includes('2026-10-14T03:00:00+09:00〜2026-10-15T03:00:00+09:00'));
assert.ok(original.includes('# 今週の復習\n\n# 正式ノート候補'),'Do not fabricate quizzes');
const index=JSON.parse(fs.readFileSync('content/index.json','utf8'));
assert.equal(index.weekly[0],path);
assert.equal(index.weekly.filter(x=>x===path).length,1);
execFileSync(process.execPath,['scripts/organize-weekly.mjs','--write'],{stdio:'pipe'});
execFileSync(process.execPath,['scripts/propose-integrations.mjs','--write'],{stdio:'pipe'});
const organized=JSON.parse(fs.readFileSync('content/organized.json','utf8'));
const proposals=JSON.parse(fs.readFileSync('content/integration-proposals.json','utf8'));
assert.equal(organized.verified,false);
assert.equal(proposals.verified,false);
assert.ok(organized.weeks.includes(path));
const pneumonia=organized.topics.find(t=>t.id==='infection-pneumonia');
assert.ok(pneumonia,'CAP/HAP must be assigned to infection / pneumonia');
assert.ok(pneumonia.refs.some(r=>r.weekly===path),'New weekly source link must be intact');
const p=proposals.topics.find(t=>t.topic_id==='infection-pneumonia');
assert.ok(p,'Pneumonia chapter integration proposal missing');
assert.ok(p.links.length>=2,'At least CAP and HAP source points must be linked');
assert.ok(p.links.some(l=>l.target_chapter==='treatment'),'Pneumonia drug-selection learning should map to treatment chapter');
assert.ok(p.links.every(l=>['draft_learning','review_required'].includes(proposals.facts.find(f=>f.id===l.fact_id)?.risk)));
assert.equal(proposals.facts.some(f=>f.status==='verified'),false);
assert.ok(!Object.hasOwn(p,'body'),'No patient or original conversation text in generated metadata');
assert.ok(original.includes('喀痰MRSA'));
assert.ok(original.includes('de-escalation'));
console.log('Real dated Weekly pilot passed: source + privacy checks + pneumonia topic/chapter + draft-only integration.');
