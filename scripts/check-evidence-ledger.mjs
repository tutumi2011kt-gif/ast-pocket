/**
 * AST Pocket evidence ledger validator: medical facts are NOT self-verified.
 * Only safe public citations, dates, claim anchors and review flags.
 */
import fs from 'node:fs';
import {getChapters} from '../notebook-templates.mjs';
const fail=msg=>{throw Error('Evidence ledger: '+msg)};
const ensure=(cond,msg)=>{if(!cond)fail(msg)};
const dateOk=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s+'T00:00:00Z').toISOString().startsWith(s);
const idOk=s=>typeof s==='string'&&/^[a-z][a-z0-9_-]{2,59}$/.test(s);
const allowedStatuses=['section_located_review_pending','abstract_located_review_pending','fulltext_not_checked','unreviewed'];
const sourceTypes=['official_consensus','official_guideline','review','systematic_review'];
function validUrl(s){
 try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&!/(?:private|intranet|chatgpt|localhost)/i.test(u.hostname)}
 catch{return false}
}
export function checkLedger(data,readDocument){
 ensure(data?.schema_version===1&&data.editor_status==='needs_human_review'&&dateOk(data.created_date),'schema/status/date invalid');
 ensure(Array.isArray(data.sources)&&data.sources.length>0&&data.sources.length<=30,'source count invalid');
 ensure(Array.isArray(data.claims)&&data.claims.length>0&&data.claims.length<=100,'claim count invalid');
 const src=new Map();
 for(const s of data.sources){
  ensure(idOk(s.id)&&!src.has(s.id),'source ID missing/duplicate');
  ensure(typeof s.title==='string'&&s.title.length>3&&s.title.length<=150,'source title invalid');
  ensure(validUrl(s.url),'source must be public HTTPS without query or secrets');
  ensure(sourceTypes.includes(s.type),'source type invalid');
  ensure(dateOk(s.published_date)&&dateOk(s.observed_updated_date)&&dateOk(s.checked_date),'source date invalid');
  ensure(s.published_date<=s.observed_updated_date&&s.observed_updated_date<=s.checked_date,'chronological source dates invalid');
  ensure(s.medical_approval===false,'source cannot claim medical approval');
  src.set(s.id,s);
 }
 const ids=new Set();
 for(const c of data.claims){
  ensure(idOk(c.id)&&!ids.has(c.id),'claim ID missing/duplicate');ids.add(c.id);
  ensure(/^docs\/review-drafts\/[a-z0-9-]+\.md$/.test(c.document),'only review documents allowed');
  ensure(['culture','infection'].includes(c.category),'invalid category');
  const chapters=getChapters(c.category);
  const ch=chapters.find(x=>x.id===c.chapter_id);
  ensure(ch,'unrecognized chapter');
  ensure(typeof c.anchor==='string'&&c.anchor.length>=8&&c.anchor.length<=240&&!/[\r\n<>]/.test(c.anchor),'invalid anchor');
  ensure(['high','medium','low'].includes(c.risk),'invalid risk');
  ensure(c.medical_review==='needs_specialist_review','medical approval forbidden');
  ensure(Array.isArray(c.citations)&&c.citations.length>=1&&c.citations.length<=4,'citations required');
  for(const ref of c.citations){
   ensure(src.has(ref.source_id),'invented evidence source');
   ensure(typeof ref.locator==='string'&&ref.locator.length>3&&ref.locator.length<140,'source locator missing');
   ensure(allowedStatuses.includes(ref.status),'unauthorized evidence status');
   if(ref.status==='section_located_review_pending')
    ensure(src.get(ref.source_id).type.startsWith('official_'),'nonofficial citation cannot claim official section');
  }
  if(readDocument){
   const doc=readDocument(c.document);
   const heading='## '+(ch.index+1)+'. '+ch.title;
   const start=doc.indexOf(heading+'\n');
   ensure(start>=0,'chapter missing '+c.id);
   const next=doc.indexOf('\n## '+(ch.index+2)+'. ',start+heading.length);
   ensure(doc.slice(start,next<0?doc.length:next).includes(c.anchor),'exact anchor missing in chapter '+c.id);
  }
 }
 return {sourceMap:src,claimCount:ids.size};
}
export function auditLedger(data,{readDocument,observedUpdates={}}={}){
 const {sourceMap}=checkLedger(data,readDocument);
 const alerts=[];
 for(const [id,value] of Object.entries(observedUpdates)){
  const src=sourceMap.get(id);
  if(!src){alerts.push({type:'unregistered_source',source_id:id});continue}
  if(!dateOk(value)){alerts.push({type:'invalid_updated_date',source_id:id});continue}
  if(value>src.observed_updated_date)alerts.push({type:'source_edition_changed',source_id:id,previous:src.observed_updated_date,current:value});
  else if(value<src.observed_updated_date)alerts.push({type:'older_observation',source_id:id,previous:src.observed_updated_date,current:value});
 }
 const claims=data.claims.map(c=>({
  id:c.id,document:c.document,chapter_id:c.chapter_id,risk:c.risk,
  status:alerts.some(a=>a.type==='source_edition_changed'&&c.citations.some(ref=>ref.source_id===a.source_id))?'edition_recheck_required':
   c.citations.some(ref=>ref.status==='section_located_review_pending'||ref.status==='abstract_located_review_pending')?'citation_located_medical_review_pending':'source_not_checked',
  source_ids:c.citations.map(ref=>ref.source_id)
 }));
 const documents=[...new Set(claims.map(x=>x.document))];
 const coverage=documents.map(document=>{
  const kind=data.claims.find(c=>c.document===document).category;
  const chapterIds=getChapters(kind).map(x=>x.id);
  return {document,tracked_chapters:chapterIds.filter(id=>claims.some(c=>c.document===document&&c.chapter_id===id)),
   untracked_chapters:chapterIds.filter(id=>!claims.some(c=>c.document===document&&c.chapter_id===id))};
 });
 return {schema_version:1,medically_verified:false,auto_publish_allowed:false,
  stats:{sources:sourceMap.size,claims:claims.length,tracked_chapters:coverage.reduce((n,x)=>n+x.tracked_chapters.length,0),total_chapters:coverage.length*8},
  alerts,claims,coverage};
}
export function formatAudit(result){
 const out=['# AST Pocket 根拠照合レポート（学習用・医学的未承認）','',
  '検査した記述 '+result.stats.claims+' 件／出典 '+result.stats.sources+' 件。自動的に医学的承認へ昇格させません。','',
  '章別の根拠台帳の網羅 '+result.stats.tracked_chapters+' / '+result.stats.total_chapters+' 章。',''];
 for(const x of result.coverage)out.push('## '+x.document,'',
  '根拠記録のない章：'+(x.untracked_chapters.join(', ')||'なし'),'');
 for(const x of result.claims)out.push('- '+x.id+'：'+x.status+'（'+x.source_ids.join(', ')+'）');
 if(result.alerts.length)for(const a of result.alerts)out.push('- 更新警戒 '+a.source_id+'：'+a.type);
 out.push('','**URLと改訂日の存在は、推奨の医学的妥当性を保証しません。**','','');
 return out.join('\n');
}
if(process.argv[1]?.endsWith('/check-evidence-ledger.mjs')){
 const data=JSON.parse(fs.readFileSync('docs/evidence/sab-2026-10-21.json','utf8'));
 const result=auditLedger(data,{readDocument:path=>fs.readFileSync(path,'utf8')});
 console.log(formatAudit(result));
}
