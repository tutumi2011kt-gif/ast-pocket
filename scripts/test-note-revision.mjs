import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makeRevisionProposal,renderRevisionReport,requireUnchangedNote} from './note-revision-core.mjs';

const existing=fs.readFileSync('content/notes/mssa-bacteremia.md','utf8');
const old='再血液培養で菌血症の陰性化を確認する。';
const packet={
 schema_version:1,date:'2026-10-21',origin:'user_reviewed_export',public_safe_reviewed:true,
 topic_id:'infection-mssa-bacteremia',title:'MSSA菌血症',category:'infection',
 learning:[
  {id:'p1',point:old,chapter_id:'diagnosis'},
  {id:'p2',point:'持続菌血症では感染源を再評価する。',chapter_id:'diagnosis'},
  {id:'p3',point:'MSSA菌血症では学習記録と確認待ちの原典を紐付ける。',chapter_id:'diagnosis'},
  {id:'p4',point:'血培結果の解釈には原典確認が必要である。',chapter_id:'treatment'}
 ],sources:[]
};
const draft={schema_version:1,topic_id:packet.topic_id,chapters:[
 {chapter_id:'diagnosis',points:[
  {learning_id:'p1',summary:old,explanation:old,ast_application:old,
   source_ids:[],source_alignment:'insufficient_evidence'},
  {learning_id:'p2',summary:old,explanation:'培養結果の推移も考慮しつつ、追加の情報で治療評価を検討する。',
   ast_application:'患者を想定した一般知識として感染巣を慎重に確認する。',
   source_ids:[],source_alignment:'insufficient_evidence'},
  {learning_id:'p3',summary:'新規の資料リンク整理',explanation:'学習日ごとの出典確認状況を識別して復習しやすくする。',
   ast_application:'原典が更新されていないか確認する。',
   source_ids:[],source_alignment:'insufficient_evidence'}
 ]},
 {chapter_id:'treatment',points:[
  {learning_id:'p4',summary:'推奨の矛盾に対する注意',explanation:'異なる資料で条件が違う場合は医学的な確認を優先する。',
   ast_application:'推奨の適用範囲と根拠を調べる。',
   source_ids:[],source_alignment:'contradiction'}
 ]}
]};
const report=makeRevisionProposal(packet,draft,{
 existingMarkdown:existing,notePath:'content/notes/mssa-bacteremia.md'});
assert.equal(report.medically_verified,false);
assert.equal(report.auto_merge_allowed,false);
assert.equal(report.clinical_knowledge_unchanged,true);
assert.equal(report.status,'human_review_required');
assert.equal(report.stats.total,4);
assert.equal(report.stats.exact_duplicate,1);
assert.equal(report.stats.possible_overlap,1);
assert.equal(report.stats.new_review_candidate,1);
assert.equal(report.stats.blocked_possible_contradiction,1);
assert.deepEqual(report.items.map(x=>x.status),[
 'exact_duplicate','possible_overlap','new_review_candidate','blocked_possible_contradiction'
]);
assert.equal(report.items.some(x=>x.source_alignment==='supported_excerpt'),false);
assert.equal(report.existing_note_path,'content/notes/mssa-bacteremia.md');
assert.match(report.existing_note_sha256,/^[a-f0-9]{64}$/);
const formatted=renderRevisionReport(report);
for(const phrase of ['新規候補：1','既存と類似：1','完全重複：1','矛盾候補・保留：1','自動マージ禁止','改訂比較','比較元 SHA-256']){
 assert.ok(formatted.includes(phrase),'Missing '+phrase);
}
assert.equal(requireUnchangedNote(report,existing),true);
assert.throws(()=>requireUnchangedNote(report,existing+'\n# changed\n'),/changed/);
assert.throws(()=>makeRevisionProposal(packet,draft,{
 existingMarkdown:existing.replace('status: draft','status: verified'),notePath:'content/notes/mssa-bacteremia.md'}),/draft notes/);
assert.throws(()=>makeRevisionProposal(packet,draft,{
 existingMarkdown:existing,notePath:'../../secrets'}),/unsafe existing note path/);
assert.throws(()=>makeRevisionProposal(packet,draft,{existingMarkdown:existing,notePath:null}),/anonymous existing content/);
assert.throws(()=>makeRevisionProposal({...packet,public_safe_reviewed:false},draft,{
 existingMarkdown:existing,notePath:'content/notes/mssa-bacteremia.md'}),/public-safety/);
assert.throws(()=>makeRevisionProposal(packet,{...draft,topic_id:'wrong'},{
 existingMarkdown:existing,notePath:'content/notes/mssa-bacteremia.md'}),/invalid output topic/);
const fresh=makeRevisionProposal(packet,draft,{existingMarkdown:'',notePath:null});
assert.equal(fresh.stats.exact_duplicate,0);
assert.equal(fresh.stats.possible_overlap,0);
assert.equal(fresh.stats.new_review_candidate,3);
assert.equal(fresh.stats.blocked_possible_contradiction,1);
assert.equal(fresh.existing_note_sha256,null);
assert.equal(requireUnchangedNote(fresh,''),true);
const cli=fs.readFileSync('scripts/review-note-revision.mjs','utf8');
assert.ok(cli.includes("flag:'wx'"));
assert.ok(cli.includes("local-intake"));
assert.ok(!cli.includes('api.openai.com'));
assert.equal(fs.readFileSync('content/notes/mssa-bacteremia.md','utf8'),existing,'Review must not overwrite official notes');
console.log('API-free note revision tests passed: true duplicate, similar, new, contradictory, draft-only and stale SHA prevention.');
