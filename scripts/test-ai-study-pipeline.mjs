import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
 validateStudyPacket,validateModelDraft,makeDraftMarkdown,publicAIInput
} from './study-pipeline-core.mjs';
import {compileReviewedChatGPTDraft} from './render-chatgpt-draft.mjs';
import {listExport,extractChosenUserQuestions} from './read-private-chat-export.mjs';
import {checkExcerpt,checkAllSources} from './check-guideline-excerpts.mjs';
const study={
 schema_version:1,date:'2026-10-21',origin:'user_reviewed_export',
 public_safe_reviewed:true,topic_id:'culture-gpc-clusters',title:'GPC clusters',
 category:'culture',
 learning:[
  {id:'p1',point:'GPC clustersが血培で確認された場合に菌種同定と感染源評価を確認する。',chapter_id:'interpretation'},
  {id:'p2',point:'菌種が確定するまでの抗菌薬選択は患者背景と重症度を含めて考える。',chapter_id:'ast'}
 ],
 sources:[
  {id:'ref001',title:'AST原典照合用の架空の教材',url:'https://www.idsociety.org/practice-guideline/example/',
   published_date:'2026-01-01',accessed_date:'2026-10-21',excerpt:'This is a fictional test excerpt about microbiology, not a medical recommendation.',check_status:'manually_excerpt_matched'}
 ]
};
const draft={
 schema_version:1,topic_id:'culture-gpc-clusters',chapters:[
  {chapter_id:'interpretation',points:[{
   learning_id:'p1',summary:'GPC clustersの初期評価',explanation:'菌種同定の情報と感染源を確認する観点を整理する。',
   ast_application:'追加検査や感染源確認の必要性を検討する。',
   source_ids:['ref001'],source_alignment:'supported_excerpt'
  }]},
  {chapter_id:'ast',points:[{
   learning_id:'p2',summary:'経験的治療の見直し',explanation:'背景と重症度を加味することが学習上の論点となる。',
   ast_application:'情報不足があれば原典確認待ちとして扱う。',
   source_ids:[],source_alignment:'insufficient_evidence'
  }]}
 ]
};
assert.equal(validateStudyPacket(study),study);
assert.equal(validateModelDraft(study,draft),draft);
let text=makeDraftMarkdown(study,draft);
assert.equal((text.match(/^## (?!改訂履歴)/gm)||[]).length,8);
assert.ok(text.includes('GPC clusters'));
assert.ok(text.includes('原典との整合性未確認'));
assert.ok(text.includes('臨床Knowledgeへの自動反映禁止'));
assert.ok(text.includes('ref001')===false,'Internal source ID not a link');
assert.ok(text.includes('https://www.idsociety.org/practice-guideline/example/'));
assert.ok(!text.includes('This is a fictional test excerpt'),'Copyright/source excerpts not copied into public Markdown');
assert.ok(publicAIInput(study).sources[0].excerpt.includes('fictional'));
assert.throws(()=>validateStudyPacket({...study,public_safe_reviewed:false}),/public-safety/);
assert.throws(()=>validateStudyPacket({...study,date:'2026-02-30'}),/schema\/date/);
assert.throws(()=>validateStudyPacket({...study,category:'fake'}),/category/);
assert.throws(()=>validateStudyPacket({...study,learning:[{id:'p1',point:'院内限定: patient',chapter_id:'interpretation'}]}),/sensitive|private/);
assert.throws(()=>validateStudyPacket({...study,learning:[{id:'p1',point:'未確認の事実が載った本文',chapter_id:'no_such_chapter'}]}),/chapter/);
assert.throws(()=>validateModelDraft(study,{...draft,topic_id:'another-topic'}),/topic/);
assert.throws(()=>validateModelDraft(study,{...draft,chapters:[draft.chapters[0],draft.chapters[0]]}),/repeated chapter/);
assert.throws(()=>validateModelDraft(study,{...draft,chapters:[{chapter_id:'interpretation',points:[{...draft.chapters[0].points[0],source_ids:['fabricated'] }]}]}),/hallucinated source/);
const unchecked={...study,sources:study.sources.map(x=>({...x,check_status:'not_checked'}))};
assert.throws(()=>validateModelDraft(unchecked,draft),/manually matched/);
const disputed={...draft,chapters:[{chapter_id:'interpretation',points:[{...draft.chapters[0].points[0],source_alignment:'contradiction'}]}]};
text=makeDraftMarkdown(study,disputed);
assert.ok(text.includes('矛盾の可能性：追加保留'));
const compiled=compileReviewedChatGPTDraft(study,draft);
assert.ok(compiled.markdown.includes('GPC clusters'));
assert.equal(compiled.medically_approved,false);
assert.equal(compiled.clinical_knowledge_updated,false);
assert.equal(compiled.publishing_approved,false);
assert.equal(compiled.requires_human_review,true);
assert.throws(()=>compileReviewedChatGPTDraft({...study,public_safe_reviewed:false},draft),/public-safety/);
assert.throws(()=>compileReviewedChatGPTDraft(study,{...draft,topic_id:'fake'}),/topic/);
const renderer=fs.readFileSync('scripts/render-chatgpt-draft.mjs','utf8');
assert.ok(renderer.includes("flag:'wx'"),'Never overwrite prior draft');
assert.ok(!renderer.includes('OPENAI_API_KEY'),'OpenAI API usage must be entirely absent');
assert.ok(!renderer.includes('api.openai.com'),'No model HTTP endpoint');
const exportData=[{
 id:'c1',title:'感染症学習',create_time:1792530000,update_time:1792620000,
 mapping:{
  one:{message:{author:{role:'user'},create_time:1792602000,content:{parts:['GPC clustersについて確認したい']}}},
  two:{message:{author:{role:'assistant'},create_time:1792602500,content:{parts:['治療を勝手に決める']}}},
  three:{message:{author:{role:'user'},create_time:1792603000,content:{parts:[{asset_pointer:'secret_image'}]}}}
 }
},{
 id:'c2',title:'雑談',create_time:1792530000,update_time:1792620000,
 mapping:{a:{message:{author:{role:'user'},create_time:1792602000,content:{parts:['プライベートな情報']}}}}
}];
assert.equal(listExport(exportData).length,2);
const privateQuestions=extractChosenUserQuestions(exportData,{
 conversationIds:['c1'],
 from:'2026-10-19T00:00:00+09:00',
 to:'2026-10-25T00:00:00+09:00'
});
assert.equal(privateQuestions.export_scope,'explicit_selected_conversations');
assert.equal(privateQuestions.complete_history_claim,false);
assert.equal(privateQuestions.selected_conversation_count,1);
assert.equal(privateQuestions.user_questions.length,1);
assert.ok(privateQuestions.user_questions[0].question.includes('GPC'));
assert.ok(!JSON.stringify(privateQuestions).includes('治療を勝手に決める'));
assert.ok(!JSON.stringify(privateQuestions).includes('secret_image'));
assert.throws(()=>extractChosenUserQuestions(exportData,{conversationIds:[],from:'2026-10-19',to:'2026-10-22'}),/selection/);
assert.throws(()=>extractChosenUserQuestions(exportData,{conversationIds:['missing'],from:'2026-10-19',to:'2026-10-22'}),/Unknown/);
assert.ok(fs.readFileSync('scripts/render-chatgpt-draft.mjs','utf8').includes("flag:'wx'"),'Do not overwrite existing draft');
assert.ok(fs.readFileSync('.gitignore','utf8').includes('local-intake/'),'Ensure local sensitive inputs remain untracked');

const fakeOfficial=async()=>({
 ok:true,status:200,headers:{get:key=>key==='content-type'?'text/html':'100'},
 text:async()=>'<html><body>This is a fictional test excerpt about microbiology, not a medical recommendation.</body></html>'
});
const matched=await checkExcerpt(study.sources[0],{fetchImpl:fakeOfficial});
assert.equal(matched.status,'excerpt_present_not_medically_verified');
const absent=await checkExcerpt({...study.sources[0],excerpt:'No match expected'}, {fetchImpl:fakeOfficial});
assert.equal(absent.status,'excerpt_not_found');
const outside=await checkExcerpt({...study.sources[0],url:'https://unapproved.example.org/official'}, {fetchImpl:async()=>{throw Error('should not request')}});
assert.equal(outside.status,'non_official_domain');
const pdf=await checkExcerpt({...study.sources[0],url:'https://www.idsociety.org/file.pdf'}, {fetchImpl:fakeOfficial});
assert.equal(pdf.status,'pdf_manual_review');
const redirected=await checkExcerpt(study.sources[0],{fetchImpl:async()=>({status:302,ok:false,headers:{get:()=>''}})});
assert.equal(redirected.status,'redirect_manual_review');
const medical=await checkAllSources(study,{fetchImpl:fakeOfficial});
assert.equal(medical.medical_approval,false);
assert.equal(medical.source_checks.length,1);
assert.equal(medical.source_checks[0].status,'excerpt_present_not_medically_verified');
console.log('Guideline excerpt tests passed: official URL, exact excerpt, missing, redirect, PDF, and no auto-approval.');
console.log('AI learning pipeline tests passed: reviewed inputs, 8 chapters, evidence citations, no self-verification, no-API local compilation, private export selection.');
