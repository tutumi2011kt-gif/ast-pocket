/**
 * AST Pocket draft gate. Expects already safety-reviewed, general study summaries.
 * AI alignment with a source excerpt is NOT clinical evidence approval.
 */
import {getChapters} from '../notebook-templates.mjs';
const ok=(value,message)=>{if(!value)throw Error('Draft gate: '+message)};
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().startsWith(s);
const SENSITIVE=/(?:患者名|氏名|生年月日|患者ID|診療録|病棟|病室|院内限定|部外秘|当院患者|当院症例|パスワード|アクセストークン|API[_\s-]?KEY)[：:\s]|(?:chatgpt\.com\/c\/|chat\.openai\.com\/c\/)|[\w.+-]+@[\w.-]+\.[a-z]{2,}|[<>\x60]/i;
const safe=(s,name,max=1000)=>{
 ok(typeof s==='string'&&s.trim()===s&&s.length>=2&&s.length<=max,name+' invalid length');
 ok(!SENSITIVE.test(s)&&!/[\r\n]/.test(s),name+' may contain private data/markup/newlines');
 return s;
};
const keys=(x,allowed,name)=>{
 ok(x&&typeof x==='object'&&!Array.isArray(x),name+' is not an object');
 for(const k of Object.keys(x))ok(allowed.includes(k),name+' unexpected field '+k);
};
const categories=['organism','drug','infection','culture','ast','cross'];
const alignment=['supported_excerpt','insufficient_evidence','contradiction'];
export function validateStudyPacket(x){
 keys(x,['schema_version','date','origin','public_safe_reviewed','topic_id','title','category','learning','sources'],'packet');
 ok(x.schema_version===1&&validDate(x.date),'invalid schema/date');
 ok(['user_reviewed_export','task_accessible_partial'].includes(x.origin),'invalid coverage');
 ok(x.public_safe_reviewed===true,'explicit human public-safety review required');
 ok(/^[a-z0-9][a-z0-9:-]{2,119}$/.test(x.topic_id),'invalid topic ID');
 safe(x.title,'title',100);
 ok(categories.includes(x.category),'invalid category');
 ok(Array.isArray(x.learning)&&x.learning.length>0&&x.learning.length<=25,'invalid learning count');
 const chapters=new Set(getChapters(x.category).map(c=>c.id));
 const ids=new Set();
 for(const p of x.learning){
  keys(p,['id','point','chapter_id'],'learning');
  ok(/^p[0-9]{1,4}$/.test(p.id)&&!ids.has(p.id),'duplicate or invalid point id');ids.add(p.id);
  safe(p.point,'point',280);
  ok(chapters.has(p.chapter_id)||p.chapter_id==='unclassified','invalid chapter');
 }
 ok(Array.isArray(x.sources)&&x.sources.length<=25,'invalid sources');
 const sources=new Set();
 for(const s of x.sources){
  keys(s,['id','title','url','published_date','accessed_date','excerpt','check_status'],'source');
  ok(/^[a-z][a-z0-9_-]{2,39}$/.test(s.id)&&!sources.has(s.id),'invalid source ID');sources.add(s.id);
  safe(s.title,'source title',150);safe(s.excerpt,'source excerpt',1000);
  ok(validDate(s.published_date)&&validDate(s.accessed_date),'source dates required');
  ok(['not_checked','manually_excerpt_matched'].includes(s.check_status),'invalid source status');
  ok(typeof s.url==='string'&&s.url.length<=290,'invalid source URL');
  const url=new URL(s.url);
  ok(url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash,'public source HTTPS without credentials/query required');
  ok(!/(?:localhost|127\.0\.0\.1|intranet|internal|private|chatgpt|openai|github)/i.test(url.hostname),'private URL');
 }
 return x;
}
export function validateModelDraft(packet,draft){
 validateStudyPacket(packet);
 keys(draft,['schema_version','topic_id','chapters'],'model draft');
 ok(draft.schema_version===1&&draft.topic_id===packet.topic_id,'invalid output topic');
 ok(Array.isArray(draft.chapters)&&draft.chapters.length>=1&&draft.chapters.length<=8,'invalid output chapters');
 const allChapters=new Set(getChapters(packet.category).map(c=>c.id));
 const sourceMap=new Map(packet.sources.map(s=>[s.id,s]));
 const pointMap=new Map(packet.learning.map(x=>[x.id,x]));
 const seenChapters=new Set(),seenPoints=new Set();
 for(const ch of draft.chapters){
  keys(ch,['chapter_id','points'],'chapter');
  ok(allChapters.has(ch.chapter_id)&&!seenChapters.has(ch.chapter_id),'invalid or repeated chapter');seenChapters.add(ch.chapter_id);
  ok(Array.isArray(ch.points)&&ch.points.length<=10,'invalid chapter points');
  for(const p of ch.points){
   keys(p,['learning_id','summary','explanation','ast_application','source_ids','source_alignment'],'draft point');
   ok(pointMap.has(p.learning_id)&&!seenPoints.has(p.learning_id),'unknown or duplicate learning ID');
   ok(pointMap.get(p.learning_id).chapter_id===ch.chapter_id,'chapter differs from manually reviewed assignment');
   seenPoints.add(p.learning_id);
   safe(p.summary,'summary',300);safe(p.explanation,'explanation',1000);safe(p.ast_application,'AST application',350);
   ok(Array.isArray(p.source_ids)&&p.source_ids.length<=4,'invalid sources');
   ok(p.source_ids.every(id=>sourceMap.has(id)),'hallucinated source');
   ok(alignment.includes(p.source_alignment),'invalid AI alignment');
   if(p.source_alignment==='supported_excerpt'){
    ok(p.source_ids.some(id=>sourceMap.get(id).check_status==='manually_excerpt_matched'),
     'source-supported label without manually matched excerpt');
   }
  }
 }
 ok(seenPoints.size>0&&seenPoints.size<=25,'invalid output points');
 return draft;
}
const plain=x=>String(x).replace(/[\r\n]/g,' ').replace(/([*_#[\]])/g,'\\$1');
export function makeDraftMarkdown(packet,draft){
 validateModelDraft(packet,draft);
 const all=getChapters(packet.category),sources=new Map(packet.sources.map(x=>[x.id,x])),lookup=new Map(packet.learning.map(x=>[x.id,x]));
 const grouped=new Map(draft.chapters.map(x=>[x.chapter_id,x.points]));
 const lines=['# '+plain(packet.title)+' — 学習教科書草案','',
  '> **医学的未承認／学習用ドラフト。臨床Knowledgeへの自動反映禁止。**',
  '> AIの原典照合判定は、専門家による医学的妥当性の承認ではありません。','',
  '- 日付：'+packet.date,'- 取得範囲：'+packet.origin,'- ステータス：draft / needs_human_review',''];
 for(const chapter of all){
  lines.push('## '+plain(chapter.title),'');
  const items=grouped.get(chapter.id)||[];
  if(!items.length){lines.push('今回、追加する学習項目なし。','');continue;}
  for(const p of items){
   const label=p.source_alignment==='contradiction'?'**矛盾の可能性：追加保留**':
    p.source_alignment==='insufficient_evidence'?'**原典との整合性未確認**':
    '**照合候補：手動確認が必要**';
   lines.push('### '+plain(p.summary),'',label,'','- 背景：'+plain(p.explanation),
    '- ASTの考え方：'+plain(p.ast_application),
    '- 元の学習事項：'+plain(lookup.get(p.learning_id).point));
   if(p.source_ids.length){
    lines.push('- 根拠候補：');
    for(const id of p.source_ids){
     const s=sources.get(id);
     lines.push('  - '+plain(s.title)+'（'+s.published_date+'） '+s.url+'（抜粋照合：'+s.check_status+'）');
    }
   }else lines.push('- 原典：未指定');
   lines.push('');
  }
 }
 lines.push('## 改訂履歴','','- 自動生成による確認用草案。正式ノートは変更していません。','');
 const out=lines.join('\n');
 ok(out.length<=45000,'draft too large');
 return out;
}
export function publicAIInput(packet){
 validateStudyPacket(packet);
 return {topic_id:packet.topic_id,title:packet.title,
  chapters:getChapters(packet.category).map(({id,title})=>({chapter_id:id,title})),
  learning:packet.learning,
  sources:packet.sources.map(s=>({id:s.id,title:s.title,url:s.url,excerpt:s.excerpt,
   check_status:s.check_status,published_date:s.published_date}))};
}
