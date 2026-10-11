import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {validateDailyIntake,appendDailyRecord,prepareDailyFromFile,assertPublicWeekly} from './daily-ingest-core.mjs';

const day='2026-10-11';
const make=(overrides={})=>({
 schema_version:1,date:day,coverage:'accessible_context_only',
 public_release_reviewed:true,
 window_start_jst:'2026-10-10T03:00:00+09:00',window_end_jst:'2026-10-11T03:00:00+09:00',
 learning:[
  {topic:'MSSA菌血症',point:'MSSA菌血症の再血培と感染源の再評価を考える',
   question:'MSSA菌血症で血培持続陽性なら何を確認する？',
   answer:'感染源コントロール、深部感染、感受性と投与設計を再評価する。',
   source_urls:['https://www.idsociety.org/practice-guideline/staphylococcus-aureus-bacteremia/']},
  {topic:'VCM',point:'VCMではAUCによるTDMの考え方を学ぶ'}
 ],...overrides
});
const safe=validateDailyIntake(make());
assert.equal(safe.learning.length,2);
assert.equal(safe.coverage,'accessible_context_only');
assert.throws(()=>validateDailyIntake(make({public_release_reviewed:false})),/public release review required/);
assert.throws(()=>validateDailyIntake(make({date:'2026-02-30'})));
assert.throws(()=>validateDailyIntake(make({coverage:'full_chat_history'})),/coverage is not supported/);
assert.throws(()=>validateDailyIntake(make({window_end_jst:'2026-10-12T03:00:00+09:00'})),/invalid time window|date and end time mismatch/);
assert.throws(()=>validateDailyIntake(make({learning:[{topic:'血液培養',point:'患者ID: 123456 が陽性'}]})),/patient identifier/);
assert.throws(()=>validateDailyIntake(make({learning:[{topic:'血液培養',point:'病棟: A3 の患者を調査'}]})),/personal identifier/);
assert.throws(()=>validateDailyIntake(make({learning:[{topic:'投与',point:'データは test.person@example.org に送る'}]})),/email/);
assert.throws(()=>validateDailyIntake(make({learning:[{topic:'抗菌薬',point:'当院患者の薬剤歴を検討した'}]})),/restricted information/);
assert.throws(()=>validateDailyIntake(make({learning:[{topic:'抗菌薬',point:'学んだ内容',source_urls:['http://localhost:3000']}]})),/public HTTPS/);
assert.throws(()=>validateDailyIntake(make({learning:[{topic:'抗菌薬',point:'学んだ内容',source_urls:['https://chatgpt.com/c/abc']}]})),/private source/);
assert.throws(()=>validateDailyIntake(make({learning:[{topic:'抗菌薬',point:'学んだ内容',source_urls:['https://www.idsociety.org/guide?private=abc']}]})),/no tokens or queries/);
assert.throws(()=>validateDailyIntake(make({learning:[{topic:'抗菌薬',point:'学んだ内容',question:'問題のみ'}]})),/question and answer/);
assert.throws(()=>validateDailyIntake(make({learning:[{topic:'抗菌薬',point:'学んだ内容',answer:'回答のみ'}]})),/question and answer/);
assert.throws(()=>validateDailyIntake({...make(),raw_conversation:'message'}),/unexpected field/);
assert.deepEqual(validateDailyIntake(make({learning:[make().learning[0],make().learning[0]]})).learning.length,1);
const index={notes:['content/notes/mssa-bacteremia.md'],weekly:['content/weekly/2026-10-09.md']};
const first=appendDailyRecord(make(),{index,weeklyByPath:{}});
assert.equal(first.changed,true);
assert.equal(first.added,2);
assert.equal(first.addedQA,1);
assert.ok(first.weekly.includes('status: learning-log'));
assert.ok(first.weekly.includes('source_coverage: accessible_context_only'));
for(const heading of ['今週の学習','今週の重要ポイント','今週の復習','正式ノート候補']){
 assert.ok(first.weekly.includes('# '+heading));
}
assert.ok(first.weekly.includes('Q: MSSA菌血症'));
assert.ok(first.weekly.includes('A: 感染源コントロール'));
assert.ok(first.weekly.includes('https://www.idsociety.org/practice-guideline/'));
assert.ok(first.weekly.includes('原典未確認'));
assert.equal(assertPublicWeekly(first.weekly),true);
assert.throws(()=>assertPublicWeekly('# Weekly\n患者ID: 999999 の検査'),/patient identifier/);
assert.throws(()=>assertPublicWeekly('role: system\nassistant: 危険な生データ'),/Raw conversation transcript/);
assert.deepEqual(first.index.weekly,['content/weekly/2026-10-11.md','content/weekly/2026-10-09.md']);
assert.deepEqual(first.index.notes,index.notes,'must never change published note list');
const second=appendDailyRecord(make(),{index:first.index,weeklyByPath:{[first.weeklyPath]:first.weekly}});
assert.equal(second.changed,false);
assert.equal(second.reason,'no_new_content');
assert.equal(second.weekly,first.weekly);
const empty=appendDailyRecord(make({learning:[]}),{index,weeklyByPath:{}});
assert.equal(empty.changed,false);
assert.equal(empty.reason,'no_learning');
assert.equal(empty.weekly,null);
const one={topic:'Candida血症',point:'Candida血症では血培陰性化の確認が重要'};
const merged=appendDailyRecord(make({learning:[one]}),{index:first.index,weeklyByPath:{[first.weeklyPath]:first.weekly}});
assert.equal(merged.added,1);
assert.equal(merged.addedQA,0);
assert.ok(merged.weekly.includes('Candida血症では'));
assert.ok(merged.weekly.includes('MSSA菌血症の再血培'));
assert.equal(merged.index.weekly.length,2);
const moreSources=appendDailyRecord(make({learning:[{...make().learning[0],
 source_urls:['https://www.idsociety.org/practice-guideline/staphylococcus-aureus-bacteremia/','https://www.idsociety.org/practice-guideline/vancomycin/']}]}),
 {index:first.index,weeklyByPath:{[first.weeklyPath]:first.weekly}});
assert.equal(moreSources.changed,true,'New source candidate for an existing point should be appended');
assert.equal(moreSources.added,0);
assert.ok(moreSources.weekly.includes('https://www.idsociety.org/practice-guideline/vancomycin/'));
const withSafety=first.weekly.replace('# 安全上の注意\n','# 安全上の注意\n- 旧ファイルにあった安全上の注意は保持する\n');
const safetyMerged=appendDailyRecord(make({learning:[one]}),
 {index:first.index,weeklyByPath:{[first.weeklyPath]:withSafety}});
assert.ok(safetyMerged.weekly.includes('旧ファイルにあった安全上の注意は保持する'));

const conflicting=make({learning:[{...make().learning[0],answer:'異なる回答を上書きする'}]});
assert.throws(()=>appendDailyRecord(conflicting,{index:first.index,weeklyByPath:{[first.weeklyPath]:first.weekly}}),/different answer/);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ast-daily-ingest-'));
try{
 fs.mkdirSync(path.join(dir,'content'),{recursive:true});
 fs.writeFileSync(path.join(dir,'content/index.json'),JSON.stringify(index,null,2)+'\n');
 const inputPath=path.join(dir,'input.json');fs.writeFileSync(inputPath,JSON.stringify(make(),null,2));
 const original=fs.readFileSync(path.join(dir,'content/index.json'),'utf8');
 const preview=prepareDailyFromFile(inputPath,{root:dir,write:false});
 assert.equal(preview.changed,true);
 assert.equal(fs.readFileSync(path.join(dir,'content/index.json'),'utf8'),original,'Preview must not change index');
 const applied=prepareDailyFromFile(inputPath,{root:dir,write:true});
 assert.equal(applied.changed,true);
 assert.ok(fs.existsSync(path.join(dir,applied.weeklyPath)));
 assert.equal(prepareDailyFromFile(inputPath,{root:dir,write:true}).changed,false,'Idempotent rerun');
 // No learning => no empty day and no index mutation.
 const noLearning=path.join(dir,'empty.json');
 fs.writeFileSync(noLearning,JSON.stringify(make({date:'2026-10-12',window_start_jst:'2026-10-11T03:00:00+09:00',window_end_jst:'2026-10-12T03:00:00+09:00',learning:[]})));
 assert.equal(prepareDailyFromFile(noLearning,{root:dir,write:true}).changed,false);
 assert.ok(!fs.existsSync(path.join(dir,'content/weekly/2026-10-12.md')));
 const indexNow=JSON.parse(fs.readFileSync(path.join(dir,'content/index.json'),'utf8'));
 assert.equal(indexNow.weekly.length,2);
}finally{fs.rmSync(dir,{recursive:true,force:true});}
execFileSync(process.execPath,['scripts/check-weekly-safety.mjs'],{stdio:'pipe'});
const source=fs.readFileSync('scripts/validate-content.mjs','utf8');
assert.ok(source.includes('Weekly section missing'),'Existing Weekly validator must remain active');
console.log('Daily ChatGPT study intake tests passed: scope, privacy red flags, duplicate, merge, no-empty, dry-run, idempotence.');
