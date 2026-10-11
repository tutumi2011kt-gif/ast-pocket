import assert from 'node:assert/strict';
import fs from 'node:fs';

const bank=JSON.parse(fs.readFileSync('content/review/bank-v2.json','utf8'));
const audit=JSON.parse(fs.readFileSync('content/review/evidence-audit-2026-10-11.json','utf8'));
assert.equal(audit.schema_version,1);
assert.equal(audit.status,'source_crosschecked_pending_human_approval');
assert.equal(audit.medical_approval_count,0);
assert.equal(audit.items.length,6);
assert.equal(bank.length,50,'Existing published review bank is unchanged');
assert.equal(new Set(audit.items.map(x=>x.question_id)).size,audit.items.length);
for(const row of audit.items){
 const q=bank.find(x=>x.id===row.question_id);
 assert.ok(q,'Evidence note must link to a real question: '+row.question_id);
 assert.equal(q.status,'draft','No auto-promotion to clinically verified');
 assert.equal(q.evidence_state,'candidate_linked','No auto-promotion of evidence state');
 assert.ok(!q.reviewed_at&&!q.evidence_url,'No false attestation by date/URL');
 assert.ok(q.candidate_evidence_urls.includes(row.source_url),'Audit must cite one of question original sources');
 assert.match(row.source_url,/^https:\/\/(www\.)?idsociety\.org\//);
 assert.ok(row.source_locator.length>25,'Specific section locator needed');
 assert.ok(row.caution.length>25,'Each reviewed question must document a caveat');
 assert.ok(row.pending_clinician_review.length>20,'Clinical reviewer follow-up must be explicit');
 assert.ok(['supported_by_explicit_recommendation','supported_with_conditions','supported_with_important_missing_detail','consistent_with_source_at_general_level'].includes(row.answer_crosscheck));
}
assert.ok(audit.items.some(x=>x.answer_crosscheck==='supported_with_important_missing_detail'),'Potential answer omissions must be surfaced');
console.log('Six-question source audit validated: all references, reviewer follow-up, caveats and draft status preserved.');
