import assert from 'node:assert/strict';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
import {jstDayKey,jstTargetCount,validateQuestionBank,selectDailyQuestions,getQuestionProgress,assessAnswer,eventFromAnswer,isMedicallyVerified} from '../review-engine.mjs';
import {validateImport,backupIsDue} from '../review-store.mjs';

if(!globalThis.crypto)globalThis.crypto=webcrypto;
const bank=JSON.parse(fs.readFileSync('content/review/bank-v2.json','utf8'));
assert.ok(validateQuestionBank(bank));
assert.equal(bank.length,50);
const byDomain=Object.fromEntries(['blood','antibiotic','infection','ast','tdm'].map(d=>[d,bank.filter(q=>q.domain===d).length]));
assert.deepEqual(byDomain,{blood:11,antibiotic:12,infection:11,ast:10,tdm:6});
const existingIds=['saur-source','mssa-persistent','mssa-target','st-potassium','steno-infection','candida-repeat','mssa-followup-self','mssa-focus-self','mssa-ie-self','mssa-duration-self','mssa-antibiotic-self','steno-risk-self'];
for(const id of existingIds){
 const original=bank.find(x=>x.id===id);
 assert.ok(original&&original.version===1,'Keep original question ID/version so local progress persists: '+id);
}
assert.ok(bank.every(q=>q.evidence_state==='candidate_linked'&&q.candidate_evidence_urls?.length>0));
assert.ok(bank.some(q=>q.candidate_evidence_urls.includes('https://www.idsociety.org/practice-guideline/staphylococcus-aureus-bacteremia/')),'2026 SAB reference');
assert.ok(bank.some(q=>q.candidate_evidence_urls.includes('https://www.idsociety.org/practice-guideline/amr-guidance/')),'2026 AMR reference');
assert.ok(bank.every(q=>q.status==='draft'&&!q.reviewed_at&&!q.evidence_url),'No clinical verification claims in test bank');
for(const q of bank){
 assert.ok(fs.existsSync(q.source_path),'Missing reference: '+q.id);
 const md=fs.readFileSync(q.source_path,'utf8');
 assert.ok(md.includes('# '+q.source_section),'Missing source section: '+q.id);
}
const saturday=new Date('2026-10-10T12:00:00Z');
const monday=new Date('2026-10-12T12:00:00Z');
assert.equal(jstDayKey(saturday),'2026-10-10');
assert.equal(jstTargetCount(saturday),10);
assert.equal(jstTargetCount(monday),5);
assert.equal(jstDayKey(new Date('2026-10-10T14:59:59Z')),'2026-10-10');
assert.equal(jstDayKey(new Date('2026-10-10T15:00:00Z')),'2026-10-11');
for(const [date,target] of [[saturday,10],[monday,5]]){
 const plan=selectDailyQuestions(bank,[],date);
 assert.equal(plan.questions.length,target);
 assert.equal(new Set(plan.questions.map(q=>q.id)).size,target);
 assert.equal(plan.practice_only,true);
 assert.deepEqual(plan.questions.map(q=>q.id),selectDailyQuestions(bank,[],date).questions.map(q=>q.id));
}
const mcq=bank.find(q=>q.type==='mcq');
const self=bank.find(q=>q.type==='self');
assert.equal(assessAnswer(mcq,mcq.correct_index).correct,true);
assert.equal(assessAnswer(mcq,99).correct,false);
assert.equal(assessAnswer(mcq,mcq.correct_index).graded_as,'practice_only');
assert.equal(assessAnswer(self).correct,null);
const t=new Date('2026-10-10T12:00:00Z');
const e=eventFromAnswer({question:mcq,rating:'good',selectedIndex:mcq.correct_index,deviceId:'local-test-device',now:t});
assert.equal(e.answer_text,null);
assert.equal(e.clinical_verified,false);
assert.equal(e.correct,true);
const progress=getQuestionProgress(mcq,[e],'2026-10-11');
assert.equal(progress.next_due_jst,'2026-10-11','first good => 1 day');
assert.equal(progress.clinical_verified,false);
assert.equal(progress.proficiency,'練習中・原典未確認');
assert.equal(progress.practice_status,'練習済み');
assert.equal(getQuestionProgress(mcq,[]).practice_status,'未学習');
const after=selectDailyQuestions(bank,[e],saturday);
assert.ok(!after.questions.some(q=>q.id===mcq.id),'Do not re-ask a question answered today');
const again=eventFromAnswer({question:self,rating:'again',deviceId:'local-test-device',now:t});
assert.equal(again.correct,null);
assert.equal(getQuestionProgress(self,[again],'2026-10-11').weak,true);
const data={format:'ast-pocket-review-backup',schema_version:1,events:[e,again]};
assert.equal(validateImport(JSON.stringify(data)).events.length,2);
assert.throws(()=>validateImport(JSON.stringify({...data,events:[e,e]})),/Invalid event/);
assert.throws(()=>validateImport(JSON.stringify({...data,events:[{...e,answer_text:'患者名'}]})),/Invalid event/);
assert.equal(backupIsDue([],null),false);
assert.equal(backupIsDue([e],null),true);
assert.equal(backupIsDue([e],'2026-10-08T00:00:00.000Z',t),false);
assert.equal(backupIsDue([e],'2026-10-01T00:00:00.000Z',t),true);
const bad=[...bank,{...mcq,id:'fake-verified',status:'verified'}];
assert.throws(()=>validateQuestionBank(bad),/Verified question requires human original-source review/);
assert.equal(isMedicallyVerified(mcq),false);
const unsafeUpgrade={...mcq,status:'verified',evidence_state:'human_reviewed',
 reviewed_at:'2026-10-11',evidence_url:'https://www.idsociety.org/practice-guideline/vancomycin/'};
assert.equal(isMedicallyVerified(unsafeUpgrade),false,'A bare URL and date must not count as human verified');
assert.throws(()=>validateQuestionBank([...bank.filter(x=>x.id!==mcq.id),unsafeUpgrade]),/Verified question requires human original-source review/);
const approvedExample={...unsafeUpgrade,verification:{
 method:'human_original_review',reviewer:'確認担当薬剤師',evidence_locator:'Recommendations section 1',
 review_note:'Original guideline and Japanese practice applicability individually checked.'
}};
assert.equal(isMedicallyVerified(approvedExample),true,'Future manual approval can be represented with provenance');
assert.ok(validateQuestionBank([...bank.filter(x=>x.id!==mcq.id),approvedExample]));
console.log('Review bank 50 tests passed: 5 domains, original IDs, JST scheduler, evidence gating, provenance and backup.');
