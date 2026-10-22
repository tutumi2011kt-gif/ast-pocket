import assert from 'node:assert/strict';
import fs from 'node:fs';
import {getChapters} from '../notebook-templates.mjs';
const file='docs/review-drafts/antifungal-week-study-2026-10-21.md';
const text=fs.readFileSync(file,'utf8');
const heads=text.split('\n').filter(s=>/^## [1-8]\. /.test(s));
assert.deepEqual(heads,getChapters('cross').map((x,i)=>'## '+(i+1)+'. '+x.title));
for(const topic of ['Candida','Aspergillus','Cryptococcus','Mucorales','Pneumocystis','5-FC','L-AMB','MCFG','FLCZ','VRCZ'])
 assert.ok(text.includes(topic),'Topic absent: '+topic);
for(const u of [
 'https://www.idsociety.org/practice-guideline/candidiasis/',
 'https://www.idsociety.org/practice-guideline/aspergillosis/',
 'https://pubmed.ncbi.nlm.nih.gov/38346436/',
 'https://www.ecmm.info/guidelines/mucormycoses-2019/'])
 assert.ok(text.includes(u),'Missing primary reference: '+u);
const index=JSON.parse(fs.readFileSync('content/index.json','utf8'));
assert.ok(!index.notes.includes(file),'Not a published clinical note');
assert.ok(!index.weekly.includes(file),'Do not fake a dated Weekly record');
assert.ok(text.includes('医学的最終承認待ち'));
assert.ok(text.includes('本人の当日の会話で学習済みだったとは主張しない'),'Do not fabricate personal learning');
assert.ok(text.includes('実患者情報は含めていない'));
assert.ok(!/(?:患者ID|院内限定|chatgpt.com\/c\/|api.openai.com|OPENAI_API_KEY)/i.test(text));
console.log('Eight-chapter antifungal textbook draft passed: original dated topics, source distinction, no clinical auto-publish.');
