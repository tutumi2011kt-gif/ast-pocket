import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
 validateStudyPacket,validateModelDraft,makeDraftMarkdown,publicAIInput
} from './study-pipeline-core.mjs';
import {parseResponse,generateDraft} from './ai-study-draft.mjs';
import {listExport,extractChosenUserQuestions} from './read-private-chat-export.mjs';
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
assert.equal((text.match(/^## /gm)||[]).length,8);
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
assert.throws(()=>parseResponse({output:[]}),/Empty model response/);
assert.deepEqual(parseResponse({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(draft)}]}]}),draft);
const fakeFetch=async(url,req)=>{
 assert.equal(url,'https://api.openai.com/v1/responses');
 assert.equal(req.method,'POST');
 assert.ok(req.headers.Authorization.endsWith('fake-key'));
 const body=JSON.parse(req.body);
 assert.equal(body.store,false);
 assert.equal(body.text.format.type,'json_schema');
 assert.equal(body.text.format.strict,true);
 assert.ok(!req.body.includes('PATIENT_PRIVATE'));
 return {ok:true,json:async()=>({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(draft)}]}]})};
};
const generated=await generateDraft(study,{apiKey:'fake-key',fetchImpl:fakeFetch});
assert.ok(generated.markdown.includes('GPC clusters'));
await assert.rejects(()=>generateDraft(study,{}),/OPENAI_API_KEY/);
await assert.rejects(()=>generateDraft(study,{apiKey:'fake-key',fetchImpl:async()=>({ok:false,status:403})}),/HTTP 403/);
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
assert.ok(fs.readFileSync('scripts/ai-study-draft.mjs','utf8').includes("flag:'wx'"),'Do not overwrite existing draft');
assert.ok(fs.readFileSync('.gitignore','utf8').includes('local-intake/'),'Ensure local sensitive inputs remain untracked');
console.log('AI learning pipeline tests passed: reviewed inputs, 8 chapters, evidence citations, no self-verification, mock AI call, private export selection.');
