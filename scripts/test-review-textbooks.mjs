import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 REVIEW_TEXTBOOKS,parseReviewTextbook,renderReviewTextbook,renderTextbookMarkdown,markdownInline
} from '../review-textbooks.mjs';
import {getChapters} from '../notebook-templates.mjs';

const index=JSON.parse(fs.readFileSync('content/index.json','utf8'));
const ledger=JSON.parse(fs.readFileSync('docs/evidence/sab-2026-10-21.json','utf8'));
assert.equal(REVIEW_TEXTBOOKS.length,3);
assert.equal(new Set(REVIEW_TEXTBOOKS.map(x=>x.id)).size,3);
assert.equal(new Set(REVIEW_TEXTBOOKS.map(x=>x.path)).size,3);
assert.ok(REVIEW_TEXTBOOKS.every(x=>!index.notes.includes(x.path)));
assert.ok(REVIEW_TEXTBOOKS.every(x=>!index.weekly.includes(x.path)));

for(const entry of REVIEW_TEXTBOOKS){
 assert.match(entry.path,/^docs\/review-drafts\/[a-z0-9-]+\.md$/);
 const raw=fs.readFileSync(entry.path,'utf8');
 const parsed=parseReviewTextbook(entry,raw);
 const chapters=getChapters(entry.category);
 assert.equal(parsed.chapters.length,8);
 assert.deepEqual(parsed.chapters.map(x=>x.id),chapters.map(x=>x.id));
 assert.ok(parsed.chapters.every(x=>x.body.length>75),'Empty detailed chapter');
 assert.equal(parsed.reviewStatus,'medical_review_pending');
 const learning=renderReviewTextbook({entry,textbook:parsed,mode:'study'});
 assert.equal((learning.match(/data-template-chapter=/g)||[]).length,8);
 assert.equal((learning.match(/data-template-jump=/g)||[]).length,8);
 assert.ok(learning.includes('data-template-reader="textbook:'));
 assert.ok(learning.includes('data-template-depth="simple"'));
 assert.ok(learning.includes('data-template-depth="deep"'));
 assert.ok(learning.includes('templateResume'));
 assert.ok(learning.includes('医学的未承認'));
 assert.ok(learning.includes('rel="noopener noreferrer"'));
 assert.ok(learning.includes('https://'));
 assert.ok(learning.includes(chapters[0].title));
 assert.ok(learning.includes(chapters[7].title));
 const ledgerDisplay=renderReviewTextbook({entry,textbook:parsed,mode:'study',evidenceLedger:ledger});
 if(entry.id==='antifungal')assert.ok(ledgerDisplay.includes('根拠台帳はまだ未整備'));
 else{
  assert.ok(ledgerDisplay.includes('重要記述の原典対応'));
  assert.ok(ledgerDisplay.includes('追跡 1件'));
 }
 const clinical=renderReviewTextbook({entry,textbook:parsed,mode:'clinical',evidenceLedger:ledger});
 assert.ok(clinical.includes('臨床モードでは非表示'));
 assert.ok(!clinical.includes('data-template-chapter'));
 assert.ok(!clinical.includes('data-template-reader='));
 assert.ok(!clinical.includes(parsed.chapters[0].body.slice(0,60)));
 assert.ok(!clinical.includes('https://'));
 const absent=renderReviewTextbook({entry,textbook:null,mode:'study'});
 assert.ok(absent.includes('確認できませんでした'));
 assert.ok(!absent.includes('data-template-chapter'));
 const notApproved={...parsed,reviewStatus:'medically_approved'};
 assert.ok(!renderReviewTextbook({entry,textbook:notApproved,mode:'study'}).includes('data-template-chapter'));
 assert.throws(()=>parseReviewTextbook(entry,raw.replace('## 2. '+chapters[1].title,'## 2. 誤ったタイトル')),/heading mismatch/);
 assert.throws(()=>parseReviewTextbook(entry,raw.replace('## 8. '+chapters[7].title,'## 9. 誤ったタイトル')),/eight source chapters/);
 assert.throws(()=>parseReviewTextbook(entry,raw+'\n患者ID: 12345'),/Private material/);
}
const gpc=REVIEW_TEXTBOOKS[0];
assert.throws(()=>parseReviewTextbook({...gpc,path:'docs/private/secret.md'},'x'.repeat(5000)),/Unregistered/);
const unsafe='<img src=x onerror=alert(1)>';
const escaped=renderTextbookMarkdown(['- **CoNS** と '+unsafe,'[click](https://chatgpt.com/c/private)',
 '### 結果と説明','[IDSA](https://www.idsociety.org/practice-guideline/candidiasis/)']);
assert.ok(!escaped.includes('<img'));
assert.ok(escaped.includes('&lt;img'));
assert.ok(escaped.includes('<strong>CoNS</strong>'));
assert.ok(!escaped.includes('href="https://chatgpt.com'));
assert.ok(escaped.includes('href="https://www.idsociety.org/'));
assert.ok(markdownInline('[java](javascript:alert(1))').includes('javascript:alert(1)')===true);
const table=renderTextbookMarkdown([
 '| 菌 | 選択肢 |','| --- | --- |','| Candida | MCFG |','| Aspergillus | VRCZ |'
]);
assert.ok(table.includes('textbook-table-scroll'));
assert.equal((table.match(/<tr>/g)||[]).length,3);
assert.ok(!table.includes('javascript:'));
console.log('Study textbooks: 3 draft readers, 24 chapters, no clinical leak, safe tables/links/XSS and invalid-source rejection.');
