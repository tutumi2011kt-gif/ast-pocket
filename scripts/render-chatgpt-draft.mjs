#!/usr/bin/env node
/**
 * API-free AST Pocket note compiler.
 *
 * The AI writing takes place in an ordinary ChatGPT conversation, not via an
 * OpenAI API call or GitHub Actions. Only a user-reviewed, de-identified,
 * structured ChatGPT response is accepted here; output is local and unapproved.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateStudyPacket,validateModelDraft,makeDraftMarkdown} from './study-pipeline-core.mjs';

export function compileReviewedChatGPTDraft(packet,chatGPTDraft){
 validateStudyPacket(packet);
 validateModelDraft(packet,chatGPTDraft);
 return {
  markdown:makeDraftMarkdown(packet,chatGPTDraft),
  medically_approved:false,
  clinical_knowledge_updated:false,
  publishing_approved:false,
  requires_human_review:true
 };
}

const called=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(called){
 const args=process.argv.slice(2);
 const get=k=>{const i=args.indexOf(k);return i<0?null:args[i+1]};
 const root=path.resolve('local-intake');
 const inside=s=>typeof s==='string'&&path.resolve(s).startsWith(root+path.sep);
 try{
  const input=get('--input'),draft=get('--draft'),output=get('--out');
  if(!inside(input)||!inside(draft)||!inside(output))throw Error('All paths must be under gitignored local-intake/');
  if(!input.endsWith('.json')||!draft.endsWith('.json')||!output.endsWith('.md'))throw Error('Expected input/draft JSON and Markdown output');
  const packet=JSON.parse(fs.readFileSync(path.resolve(input),'utf8'));
  const proposed=JSON.parse(fs.readFileSync(path.resolve(draft),'utf8'));
  const result=compileReviewedChatGPTDraft(packet,proposed);
  fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});
  fs.writeFileSync(path.resolve(output),result.markdown,{flag:'wx',mode:0o600,encoding:'utf8'});
  console.log('API-free note compiled for HUMAN REVIEW. No model API call and no GitHub/clinical publish.');
 }catch(e){
  console.error('ChatGPT note rejected: '+e.message);
  process.exitCode=1;
 }
}
