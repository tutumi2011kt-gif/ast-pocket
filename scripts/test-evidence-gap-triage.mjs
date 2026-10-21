import assert from 'node:assert/strict';
import fs from 'node:fs';
import {triageEvidenceGaps,renderEvidenceGapReport} from './triage-evidence-gaps.mjs';
const ledger=JSON.parse(fs.readFileSync('docs/evidence/sab-2026-10-21.json','utf8'));
const readDocument=p=>fs.readFileSync(p,'utf8');
const result=triageEvidenceGaps(ledger,{readDocument});
assert.equal(result.medical_approval,false);
assert.equal(result.auto_publishing,false);
assert.ok(result.inventory.scanned_high_priority_lines>25);
assert.ok(result.inventory.without_anchor>10,'Find actual untracked teaching lines');
assert.ok(result.inventory.with_some_anchor>=5,'Recognize existing claim anchors');
assert.equal(result.inventory.with_some_anchor+result.inventory.without_anchor,
 result.inventory.scanned_high_priority_lines);
assert.ok(result.ranked_candidates.every(x=>x.status==='medical_human_review_required'));
assert.ok(result.ranked_candidates.some(x=>x.risk_group==='blood_cultures'));
assert.ok(result.ranked_candidates.some(x=>x.document.includes('mssa-bacteremia')));
assert.ok(result.ranked_candidates.some(x=>x.document.includes('gpc-clusters')));
assert.ok(result.ranked_candidates.some(x=>x.tracking==='no_claim_anchor'));
assert.ok(result.ranked_candidates.some(x=>x.tracking==='some_claim_anchor_linked'));
assert.equal(new Set(result.ranked_candidates.map(x=>x.id)).size,result.ranked_candidates.length);
assert.ok(result.ranked_candidates.every(x=>x.priority<=7&&x.priority>=3));
assert.ok(result.ranked_candidates.every(x=>!x.excerpt.includes('https://chatgpt.com/c/')));
const rendered=renderEvidenceGapReport(result,{limit:8});
assert.ok(rendered.includes('医学的承認'));
assert.ok(rendered.includes('根拠アンカー未登録'));
assert.equal((rendered.match(/^### line_/gm)||[]).length,8);
assert.throws(()=>renderEvidenceGapReport(result,{limit:200}),/limit/);
const original=readDocument('docs/review-drafts/mssa-bacteremia-2026-10-21.md');
const extended=original.replace('## 7. 症例で考える',
 '- 再血培の採取タイミングと抗菌薬治療期間についての補足：要原典確認である。\n\n## 7. 症例で考える');
const modified=triageEvidenceGaps(ledger,{readDocument:p=>
 p==='docs/review-drafts/mssa-bacteremia-2026-10-21.md'?extended:readDocument(p)});
assert.equal(modified.inventory.scanned_high_priority_lines,result.inventory.scanned_high_priority_lines+1);
assert.equal(modified.inventory.without_anchor,result.inventory.without_anchor+1);
const missing=original.replace('TTE（経胸壁心エコー）のルーチン実施','心エコーの実施');
assert.throws(()=>triageEvidenceGaps(ledger,{readDocument:p=>
 p==='docs/review-drafts/mssa-bacteremia-2026-10-21.md'?missing:readDocument(p)}),/anchor missing/);
console.log('Evidence gap triage passed: '+result.inventory.scanned_high_priority_lines+
 ' candidate lines, '+result.inventory.without_anchor+' unlinked, '+result.inventory.with_some_anchor+' partly anchored. No medical approval.');
