/**
 * Dated 2026-10-14...21 study recovery without invented daily activity.
 * The 2026-10-14 pneumonia learning remains in 2026-10-15 Weekly,
 * while 15/17/18/21 study is linked into the 2026-10-21 retrospective.
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {assertPublicWeekly} from './daily-ingest-core.mjs';
const index=JSON.parse(fs.readFileSync('content/index.json','utf8'));
const current='content/weekly/2026-10-21.md',prior='content/weekly/2026-10-15.md';
assert.ok(index.weekly.includes(current) && index.weekly.includes(prior) && index.weekly.includes('content/weekly/2026-10-09.md'));
assert.deepEqual(index.weekly,[...new Set(index.weekly)].sort().reverse());
const text=fs.readFileSync(current,'utf8');
assertPublicWeekly(text);
assert.match(text,/^status: learning-log$/m);
assert.match(text,/^source_coverage: dated_accessible_conversations_only$/m);
assert.ok(text.includes('10月15日'));
assert.ok(text.includes('10月17日'));
assert.ok(text.includes('10月18日'));
assert.ok(text.includes('10月21日'));
const points=text.slice(text.indexOf('# 今週の重要ポイント\n')+ '# 今週の重要ポイント\n'.length).split('\n# ')[0]
 .split('\n').filter(s=>/^\d+\.\s/.test(s));
assert.equal(points.length,12);
assert.ok(points.some(x=>x.includes('Candida')));
assert.ok(points.some(x=>x.includes('Aspergillus')));
assert.ok(points.some(x=>x.includes('Cryptococcus')));
assert.ok(points.some(x=>x.includes('Mucorales')));
assert.ok(points.some(x=>x.includes('Pneumocystis')));
assert.ok(points.some(x=>x.includes('GPC clusters')));
assert.ok(points.some(x=>x.includes('再血培')));
assert.ok(!points.some(x=>x.includes('市中肺炎')));
assert.ok(!points.some(x=>x.includes('院内肺炎')));
assert.ok(text.includes('正答済みという記録ではない'));
assert.ok(!/患者ID|当院症例|院内限定|https:\/\/chatgpt.com\/c\//.test(text));
assert.ok(text.includes('# 今週の復習\n\n# 正式ノート候補'), 'Do not fabricate new quizzes');
const old=fs.readFileSync(prior,'utf8');
assert.ok(old.includes('市中肺炎では肺炎球菌'),'Original dated CAP/HAP study retained');
execFileSync(process.execPath,['scripts/organize-weekly.mjs','--write'],{stdio:'pipe'});
execFileSync(process.execPath,['scripts/propose-integrations.mjs','--write'],{stdio:'pipe'});
const organizer=JSON.parse(fs.readFileSync('content/organized.json','utf8'));
const links=JSON.parse(fs.readFileSync('content/integration-proposals.json','utf8'));
assert.equal(organizer.verified,false);
assert.equal(organizer.stats.weekly_count,index.weekly.length);
const routed=[
 'infection-candidemia','infection-invasive-aspergillosis','infection-cryptococcosis',
 'infection-mucormycosis','infection-pneumocystis','cross-antifungal-spectrum','culture-gpc-clusters'
];
for(const id of routed){
 const t=organizer.topics.find(x=>x.id===id);
 assert.ok(t,'Missing retrospective topic routing '+id);
 assert.ok(t.refs.some(r=>r.weekly===current),'Missing source provenance '+id);
 assert.equal(t.status,'draft');
 const props=links.topics.find(x=>x.topic_id===id);
 assert.ok(props,'Missing integration proposal '+id);
 assert.ok(props.links.some(l=>links.facts.find(f=>f.id===l.fact_id)?.refs.some(r=>r.weekly===current)),
  'Missing source-specific link '+id);
}
assert.ok(organizer.topics.find(x=>x.id==='infection-pneumonia').refs.some(x=>x.weekly===prior));
assert.ok(organizer.topics.find(x=>x.id==='infection-mssa-bacteremia').refs.some(x=>x.weekly===current));
assert.ok(links.facts.every(x=>x.status==='draft'));
assert.ok(!JSON.stringify(organizer).includes('patient_id'));
console.log('Dated study recovery passed: 12 real subjects across Oct 15-21, original CAP/HAP retained, 7 fungal/culture topics routed, draft only.');
