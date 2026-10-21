#!/usr/bin/env node
/**
 * Generates a locally held, review-only 8-chapter draft using the OpenAI API.
 * Does NOT read ChatGPT account history, search guidelines, publish to GitHub,
 * or promote source-aligned text to medically approved clinical Knowledge.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateStudyPacket,validateModelDraft,makeDraftMarkdown,publicAIInput} from './study-pipeline-core.mjs';
const schema={
 type:'object',additionalProperties:false,
 required:['schema_version','topic_id','chapters'],
 properties:{
  schema_version:{type:'integer'},topic_id:{type:'string'},
  chapters:{type:'array',items:{
   type:'object',additionalProperties:false,required:['chapter_id','points'],
   properties:{
    chapter_id:{type:'string'},
    points:{type:'array',items:{
     type:'object',additionalProperties:false,
     required:['learning_id','summary','explanation','ast_application','source_ids','source_alignment'],
     properties:{
      learning_id:{type:'string'},summary:{type:'string'},explanation:{type:'string'},
      ast_application:{type:'string'},source_ids:{type:'array',items:{type:'string'}},
      source_alignment:{type:'string',enum:['supported_excerpt','insufficient_evidence','contradiction']}
     }
    }}
   }
  }}
 }
};
export function parseResponse(r){
 const content=(r.output||[]).filter(x=>x.type==='message').flatMap(x=>x.content||[])
  .filter(x=>x.type==='output_text').map(x=>x.text).join('');
 if(!content)throw Error('Empty model response; no draft created');
 return JSON.parse(content);
}
export async function generateDraft(packet,{apiKey,model='gpt-5-mini',fetchImpl=fetch}={}){
 validateStudyPacket(packet);
 if(!apiKey)throw Error('OPENAI_API_KEY is required; no model call was made');
 const payload=publicAIInput(packet);
 const instructions=[
  'あなたはAST Pocketの感染症学習用ドラフト編集者。入力は公開可否を事前確認した一般的医学知識。',
  '出典抜粋と学習ポイント以外から、治療量、期間、推奨レベル、ガイドライン文言を補わない。',
  '根拠不足ならinsufficient_evidence、内容が矛盾すればcontradiction。',
  'supported_excerptは手動で抜粋照合済みのソースIDが付く場合のみにし、それも医学的承認ではない。',
  '指定された学習ID・章ID・ソースID以外を創作しない。医師に対する確定的な治療指示を作らない。',
  '各学習ポイントは指定章に1回だけ置き、理由・ASTでの確認観点を説明する。独立した新事実を追加しない。',
  '患者情報、勤務施設、個人情報を出力しない。出典の改訂年月日や医学的評価は提供された範囲以外では断定しない。'
 ].join('\n');
 const response=await fetchImpl('https://api.openai.com/v1/responses',{
  method:'POST',
  headers:{'Content-Type':'application/json',Authorization:'Bearer '+apiKey},
  body:JSON.stringify({model,store:false,max_output_tokens:5500,instructions,
   input:JSON.stringify(payload),
   text:{format:{type:'json_schema',name:'ast_study_chapter_draft_v1',strict:true,schema}}})
 });
 if(!response.ok)throw Error('Model request failed HTTP '+response.status+'; no raw response logged');
 const r=await response.json(),generated=parseResponse(r);
 validateModelDraft(packet,generated);
 return {generated,markdown:makeDraftMarkdown(packet,generated)};
}
const called=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(called){
 const args=process.argv.slice(2),input=args[args.indexOf('--input')+1],out=args[args.indexOf('--out')+1];
 if(!args.includes('--input')||!args.includes('--out')||!input||!out){
  console.error('Usage: node scripts/ai-study-draft.mjs --input local-intake/packet.json --out local-intake/draft.md');
  process.exitCode=2;
 }else{
  try{
   const root=path.resolve('local-intake'),dest=path.resolve(out),src=path.resolve(input);
   const within=p=>p.startsWith(root+path.sep);
   if(!within(src)||!within(dest))throw Error('Input and output MUST reside under ignored local-intake/');
   if(!dest.endsWith('.md')||!src.endsWith('.json'))throw Error('Expected input JSON and output MD');
   const packet=JSON.parse(fs.readFileSync(src,'utf8'));
   const r=await generateDraft(packet,{apiKey:process.env.OPENAI_API_KEY,model:process.env.OPENAI_MODEL||'gpt-5-mini'});
   fs.mkdirSync(path.dirname(dest),{recursive:true});
   fs.writeFileSync(dest,r.markdown,{encoding:'utf8',flag:'wx'});
   console.log('Review-only Markdown created under local-intake. No public GitHub changes.');
  }catch(e){console.error('Draft blocked: '+e.message);process.exitCode=1}
 }
}
