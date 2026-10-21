/**
 * API-free review-only proposal for an AST Pocket learning notebook revision.
 *
 * Inputs:
 *   1. a human-reviewed general-knowledge study packet
 *   2. ChatGPT-in-chat JSON output conforming to the guarded draft schema
 *   3. an existing PUBLIC note Markdown, or '' for a new topic
 *
 * This module NEVER edits existing notes, declares facts verified, or publishes.
 * "possible_overlap" is a textual hint, not semantic/clinical evaluation.
 */
import {createHash} from 'node:crypto';
import {getChapters} from '../notebook-templates.mjs';
import {validateModelDraft,makeDraftMarkdown} from './study-pipeline-core.mjs';
const hash=s=>createHash('sha256').update(s,'utf8').digest('hex');
const norm=s=>String(s||'').normalize('NFKC').toLowerCase()
 .replace(/[\s。、．.,，：:;；（）()\[\]【】「」『』・･\-—―_/]/g,'');
const lines=s=>s.replace(/\r\n/g,'\n').split('\n').map(x=>x.trim())
 .filter(x=>x&&!x.startsWith('---')&&!x.startsWith('#')&&!x.startsWith('>'));
const uniq=a=>[...new Set(a)];
const gramSet=s=>{
 const t=norm(s),g=new Set();
 for(let i=0;i+2<=t.length;i++)g.add(t.slice(i,i+2));
 return g;
};
const jaccard=(a,b)=>{
 const a0=gramSet(a),b0=gramSet(b);
 if(!a0.size||!b0.size)return 0;
 let n=0;for(const v of a0)if(b0.has(v))n++;
 return n/(a0.size+b0.size-n);
};
const safePath=p=>p===null||p===undefined||p===''||/^content\/notes\/[a-z0-9][a-z0-9-]*\.md$/.test(p);
export function makeRevisionProposal(packet,draft,{existingMarkdown='',notePath=null}={}){
 validateModelDraft(packet,draft);
 if(!safePath(notePath))throw Error('Revision proposal: unsafe existing note path');
 if(typeof existingMarkdown!=='string'||existingMarkdown.length>100000)throw Error('Revision proposal: invalid existing Markdown');
 if(notePath&&(!existingMarkdown.startsWith('---\n')||!/status:\s*draft\b/m.test(existingMarkdown))) {
  // Refuse to revise other note states, even in a preview, until separately supported.
  throw Error('Revision proposal: only existing draft notes can be compared');
 }
 if(!notePath&&existingMarkdown)throw Error('Revision proposal: anonymous existing content forbidden');
 const existingLines=lines(existingMarkdown).map(x=>x.replace(/^[-*]\s+|^\d+\.\s+/,''));
 const normalizedExisting=new Set(existingLines.map(norm));
 const all= draft.chapters.flatMap(ch=>ch.points.map(p=>({...p,chapter_id:ch.chapter_id})));
 const proposed=[];
 for(const p of all){
  const original=packet.learning.find(x=>x.id===p.learning_id);
  const srcs=packet.sources.filter(s=>p.source_ids.includes(s.id))
   .map(s=>({id:s.id,url:s.url,published_date:s.published_date,
    check_status:s.check_status}));
  const candidateSegments=uniq([p.summary,p.explanation,p.ast_application,original.point]);
  // Do not drop richer generated explanations merely because the title is already in the note.
  const isExact=candidateSegments.every(x=>normalizedExisting.has(norm(x)));
  const scores=existingLines.map(x=>Math.max(...candidateSegments.map(t=>jaccard(t,x))));
  const similarity=scores.length?Math.max(...scores):0;
  let status;
  if(p.source_alignment==='contradiction')status='blocked_possible_contradiction';
  else if(isExact)status='exact_duplicate';
  else if(similarity>=0.55)status='possible_overlap';
  else status='new_review_candidate';
  proposed.push({
   learning_id:p.learning_id,chapter_id:p.chapter_id,summary:p.summary,
   status,source_alignment:p.source_alignment,source_refs:srcs,
   reason:status==='blocked_possible_contradiction'?'ChatGPT flagged a possible conflict; no automatic revision':
    status==='exact_duplicate'?'All generated segments already appear in the note':
    status==='possible_overlap'?'Text appears similar to an existing line; a human must compare meaning':
    'New wording; medical and source review remain necessary'
  });
 }
 const stats={
  total:proposed.length,
  exact_duplicate:proposed.filter(x=>x.status==='exact_duplicate').length,
  possible_overlap:proposed.filter(x=>x.status==='possible_overlap').length,
  blocked_possible_contradiction:proposed.filter(x=>x.status==='blocked_possible_contradiction').length,
  new_review_candidate:proposed.filter(x=>x.status==='new_review_candidate').length
 };
 return {
  schema_version:1,topic_id:packet.topic_id,topic_title:packet.title,
  date:packet.date,source_origin:packet.origin,
  existing_note_path:notePath||null,existing_note_sha256:notePath?hash(existingMarkdown):null,
  status:'human_review_required',medically_verified:false,auto_merge_allowed:false,
  clinical_knowledge_unchanged:true,
  stats,items:proposed,
  draft_notebook_markdown:makeDraftMarkdown(packet,draft)
 };
}
export function renderRevisionReport(report){
 if(report?.schema_version!==1||report.status!=='human_review_required')throw Error('Invalid review report');
 const chapters=getChapters(report.items.some(x=>x.chapter_id==='renal')?'drug':'infection');
 // This report uses explicit IDs; chapter ordering is not inferred as medical validation.
 const groups=new Map();
 for(const item of report.items){if(!groups.has(item.chapter_id))groups.set(item.chapter_id,[]);groups.get(item.chapter_id).push(item);}
 const output=[
  '# AST Pocket 既存ノートとの改訂比較（確認用）','',
  '> **医学的未承認の確認用差分です。既存ノートと臨床Knowledgeは一切変更していません。**','',
  '- テーマ：'+report.topic_title,
  '- 元ノート：'+(report.existing_note_path||'新規テーマ（既存ノートなし）'),
  '- 比較元 SHA-256：'+(report.existing_note_sha256||'なし'),
  '- 判定：human_review_required（自動マージ禁止）','',
  '## 判定集計','',
  '- 新規候補：'+report.stats.new_review_candidate,
  '- 既存と類似：'+report.stats.possible_overlap,
  '- 完全重複：'+report.stats.exact_duplicate,
  '- 矛盾候補・保留：'+report.stats.blocked_possible_contradiction,''
 ];
 for(const [id,entries] of groups){
  output.push('## 章：'+id,'');
  for(const e of entries){
   output.push('### '+e.summary,'',
    '- 判定：'+e.status,
    '- 根拠の照合状況：'+e.source_alignment,
    '- 理由：'+e.reason,
    '- 出典ID・URL：'+(e.source_refs.length?e.source_refs.map(s=>s.id+' '+s.url+' ('+s.published_date+', '+s.check_status+')').join(' ／ '):'なし'),
    '');
  }
 }
 output.push('## 審査時に確認','',
  '- 記述内容の臨床的な正確性、適用条件、推奨と例外を原典で確認する。',
  '- 原典の発行日・改訂版・本文該当箇所と国内の扱いを確認する。',
  '- 類似候補は統合するか残すかを人が決め、矛盾候補は保留する。',
  '- 比較元SHAが変わったら差分を再生成する。',
  '- 人による公開安全確認前に、草案や生会話を公開GitHubのブランチ/PRへ送らない。','');
 return output.join('\n');
}
export function requireUnchangedNote(report,currentMarkdown){
 if(!report?.existing_note_path)return true;
 if(hash(currentMarkdown)!==report.existing_note_sha256)throw Error('Existing notebook changed after the review; regenerate the proposal');
 return true;
}
