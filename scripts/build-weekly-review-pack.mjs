#!/usr/bin/env node
/**
 * API-free, LOCAL review pack from an already indexed, public AST Weekly point.
 * Never infers missing chat messages, treatment recommendation, or medical approval.
 * This does not send private conversations to a public repository.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {getChapters} from '../notebook-templates.mjs';

const hash=x=>createHash('sha256').update(x,'utf8').digest('hex');
const validateDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s+'T00:00:00Z').toISOString().startsWith(s);
const forbidden=/(?:患者ID|患者名|氏名|診療録|当院症例|院内限定|部外秘|パスワード)[：:\s]|https?:\/\/(?:chatgpt|chat\.openai)\.com\/c\/|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i;
const need=(x,why)=>{if(!x)throw Error('Weekly review: '+why)};
const normalized=x=>String(x||'').normalize('NFKC').toLowerCase().replace(/[\s.*、。,:：;；（）()→\-・･]/g,'');
function jaccard(a,b){
 const tokens=x=>{const s=normalized(x),t=new Set();for(let i=0;i<s.length-1;i++)t.add(s.slice(i,i+2));return t};
 const aa=tokens(a),bb=tokens(b);
 if(!aa.size||!bb.size)return 0;
 let both=0;for(const x of aa)if(bb.has(x))both++;
 return both/(aa.size+bb.size-both);
}
export function parseImportantPoints(md){
 need(typeof md==='string','Weekly Markdown missing');
 const h='# 今週の重要ポイント\n';
 const begin=md.indexOf(h);
 if(begin<0)return [];
 const rest=md.slice(begin+h.length),end=rest.search(/\n# /);
 const lines=(end>=0?rest.slice(0,end):rest).split('\n');
 return lines.filter(x=>/^\s*\d+\.\s+/.test(x))
  .map(x=>x.replace(/^\s*\d+\.\s+/,'').trim());
}
export function createWeeklyReviewPack({date,pointNumber,topicId,chapterId,index,topics,readWeekly,readNote}){
 need(validateDate(date),'invalid JST date');
 need(Number.isInteger(pointNumber)&&pointNumber>0,'pointNumber must be 1-based');
 need(typeof topicId==='string','topic required');
 const topic=topics.find(t=>t.id===topicId);
 need(topic,'topic ID not found');
 const chapter=getChapters(topic.category).find(x=>x.id===chapterId);
 need(chapter,'chapter unknown for topic category');
 const weeklyPath='content/weekly/'+date+'.md';
 need(Array.isArray(index.weekly)&&index.weekly.includes(weeklyPath),'dated Weekly not published/indexed');
 need(typeof readWeekly==='function'&&typeof readNote==='function','file reader missing');
 const markdown=readWeekly(weeklyPath),points=parseImportantPoints(markdown);
 need(pointNumber<=points.length,'index outside actual Weekly learning');
 const point=points[pointNumber-1];
 need(point.length>=4&&point.length<=300&&!forbidden.test(point),'unsafe or invalid Weekly content; manual review required');
 const notePath=topic.note||null;
 need(!notePath||(/^content\/notes\/[a-z0-9-]+\.md$/.test(notePath)&&index.notes.includes(notePath)),'target note not public');
 const existing=notePath?readNote(notePath):'';
 if(notePath)need(typeof existing==='string'&&/^status:\s*draft\b/m.test(existing),'only public draft notes are comparable');
 const lines=notePath?existing.split('\n').filter(l=>/^\s*[-*]\s+/.test(l)).map(l=>l.replace(/^\s*[-*]\s+/,'').trim()):[];
 const ranked=lines.map(x=>({excerpt:x,similarity:jaccard(point,x)}))
  .sort((a,b)=>b.similarity-a.similarity).slice(0,3);
 const pack={
  schema_version:1,status:'human_review_required',medically_verified:false,
  public_safety_re_reviewed:false,auto_publish:false,
  provenance:{weekly_path:weeklyPath,weekly_sha256:hash(markdown),
   original_point_number:pointNumber,original_point_exact:point,source_coverage:'published_indexed_weekly_only'},
  destination:{topic_id:topicId,category:topic.category,chapter_id:chapter.id,
   chapter_title:chapter.title,note_path:notePath,existing_note_sha256:notePath?hash(existing):null},
  comparison:{classification:'undetermined_human_review_required',
   similar_note_lines:ranked,copy_to_notebook:false},
  evidence:{guideline_source_assigned:false,source_coverage:'not_checked',
   no_fabricated_source_ids:true}
 };
 return pack;
}
export function renderWeeklyReviewPack(pack){
 const p=pack.provenance,d=pack.destination,c=pack.comparison;
 const out=['# AST Pocket Weekly→統合ノート改訂候補（人による確認待ち）','',
  '> **原典・医学的内容未承認。既存ノート、臨床用Knowledge、復習問題は変更していません。**','',
  '- Weekly原本：'+p.weekly_path+'（SHA-256: '+p.weekly_sha256+'）',
  '- 実際の学習ポイント：'+p.original_point_number+'番',
  '- 元の学習内容：'+p.original_point_exact,
  '- 行き先：'+d.topic_id+' ／ '+d.chapter_title,
  '- 既存ノート：'+(d.note_path||'新しいテーマ・なし'),
  '- 既存ノート SHA-256：'+(d.existing_note_sha256||'なし'),
  '- 判定：**記述が重複するかも含めて人手確認**','',
  '## 既存の類似表現（文言比較だけ）',''];
 for(const x of c.similar_note_lines)out.push('- '+x.excerpt);
 if(!c.similar_note_lines.length)out.push('- 比較対象なし');
 out.push('','## 承認前に必要なこと','','1. 元のWeeklyが公開できる一般論であることを再確認する。',
  '2. 最新のIDSA、国内GL、PMDA、原著等の適用条件・発行日・該当箇所を人が確認する。',
  '3. ChatGPT内で詳しい8章説明案を作成する場合、出典のない新情報を確定扱いしない。',
  '4. 既存ノートとの意味上の重複・矛盾を確認する。',
  '5. ユーザーが承認した変更だけを新しいGitHubドラフトPRにまとめる。','',
  '> ChatGPT履歴の完全取得はしていません。取得元は上記の実在する公開Weeklyだけです。','');
 return out.join('\n');
}
const called=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(called){
 const args=process.argv.slice(2),get=k=>{const i=args.indexOf(k);return i<0?null:args[i+1]};
 try{
  const dir=path.resolve('local-intake'),dest=get('--out');
  need(dest&&path.resolve(dest).startsWith(dir+path.sep)&&dest.endsWith('.md'),'output must be private local-intake/*.md');
  const index=JSON.parse(fs.readFileSync('content/index.json','utf8'));
  const taxonomy=JSON.parse(fs.readFileSync('data/topic-rules.json','utf8'));
  const pack=createWeeklyReviewPack({date:get('--date'),pointNumber:Number(get('--point')),
   topicId:get('--topic'),chapterId:get('--chapter'),index,topics:taxonomy.topics,
   readWeekly:p=>fs.readFileSync(p,'utf8'),readNote:p=>fs.readFileSync(p,'utf8')});
  fs.mkdirSync(path.dirname(path.resolve(dest)),{recursive:true});
  fs.writeFileSync(dest,renderWeeklyReviewPack(pack),{flag:'wx',mode:0o600});
  console.log('PRIVATE review pack generated; no AI API or public GitHub write. Medical review still required.');
 }catch(e){console.error('Weekly review pack blocked: '+e.message);process.exitCode=1;}
}
