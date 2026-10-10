#!/usr/bin/env node
/**
 * AST Pocket automatic learning integration layer.
 * No claims are promoted to verified; no source Markdown is changed.
 * Input sources must already be public, de-identified Weekly Markdown files.
 * Only source pointers are placed in generated JSON; display fetches originals.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

const readJSON=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const index=readJSON('content/index.json');
const organized=readJSON('content/organized.json');
const taxonomy=readJSON('data/topic-rules.json');
const organisms=readJSON('data/organisms.json');
const drugs=readJSON('data/antibiotics.json');
const noteSet=new Set(index.notes);
const categories=new Set(taxonomy.categories.map(c=>c.id));
const normalize=s=>String(s||'').normalize('NFKC').toLowerCase()
  .replace(/[・･\s._\-\/()（）,:;：、。？！→▶]/g,'')
  .replace(/ー/g,'')
  .replace(/[\u30a1-\u30f6]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));
const isMatch=(text,alias)=>{
 const n=normalize(alias),t=normalize(text);
 if(n.length<2||!t.includes(n))return false;
 if(/^[a-z0-9]+$/.test(n)&&n.length<=3){
   for(let i=t.indexOf(n);i>=0;i=t.indexOf(n,i+1)){
     if(!/[a-z0-9]/.test(t[i-1]||'')&&!/[a-z0-9]/.test(t[i+n.length]||''))return true;
   }
   return false;
 }
 return true;
};
const fileId=(kind,text)=>crypto.createHash('sha256').update(kind+'\n'+normalize(text)).digest('hex').slice(0,20);
function sectionsFrom(md){
 const result={};let section='';
 for(const line of md.replace(/\r\n/g,'\n').split('\n')){
  if(line.startsWith('# ')){section=line.slice(2).trim();result[section]=[];continue;}
  if(section)result[section].push(line);
 }
 return result;
}
function bullets(lines){
 return (lines||[]).filter(s=>/^\s*(?:[-*]\s+|\d+\.\s+)/.test(s))
  .map(s=>s.replace(/^\s*(?:[-*]\s+|\d+\.\s+)/,'').trim());
}
function qa(lines){
 const result=[];
 for(const line of lines||[]){
  const q=line.match(/^\s*[-*]\s*Q:\s*(.+)$/);
  if(q){result.push({question:q[1].trim(),answer:''});continue;}
  const a=line.match(/^\s*A:\s*(.+)$/);
  if(a&&result.length)result[result.length-1].answer=a[1].trim();
 }
 return result.filter(item=>item.question&&item.answer);
}
const topicSpecs=new Map();
for(const t of taxonomy.topics){
 topicSpecs.set(t.id,{id:t.id,title:t.title,category:t.category,aliases:[t.title,...(t.aliases||[])],note:t.note||null});
}
for(const o of organisms)topicSpecs.set('organism:'+o.id,{
 id:'organism:'+o.id,title:o.ja||o.canonical,category:'organism',
 aliases:[o.canonical,o.short,...(o.aliases||[])],note:o.note||null
});
for(const a of drugs)topicSpecs.set('drug:'+a.id,{
 id:'drug:'+a.id,title:a.generic,category:'drug',
 aliases:[a.english,...(a.abbr||[]),...(a.brands||[]),...(a.aliases||[])],note:a.note||null
});
const riskWords=/投与|用量|投薬|治療|期間|禁忌|腎機能|肝機能|透析|耐性|感受性|抗菌薬|抗真菌|デエスカレーション|de.?escalation|血培|培養|感染源|コントロール|再評価|確認|評価|中止|変更|必要|適応|有効|無効|原因|心内膜炎|高k|カリウム|薬剤|推奨|副作用|毒性|48時間|陰性|陽性|フォロー|予後/i;
function targetSection(t,text){
 if(t.note==='content/notes/mssa-bacteremia.md'){
  if(/治療期間|終了|日数|週間|起算/.test(text))return '治療期間とフォロー';
  if(/心内膜炎|心エコー|深部感染/.test(text))return '感染性心内膜炎・深部感染';
  if(/再血培|持続菌血症|血培|陰性化/.test(text))return '再血培と持続菌血症';
  if(/抗菌薬|CEZ|VCM|感受性|投与/.test(text))return '抗菌薬の評価';
  return '初期評価・感染源';
 }
 return '学習メモ';
}
function existingNoteText(t){
 if(!t.note||!noteSet.has(t.note)||!fs.existsSync(t.note))return '';
 return fs.readFileSync(t.note,'utf8');
}
const facts=new Map();
const topicLinks=new Map();
let duplicateRefs=0;
let allTopics=organized.topics.map(t=>{
 const s=topicSpecs.get(t.id);
 if(!s||!categories.has(t.category))throw Error('Invalid topic '+t.id);
 const linked={topic_id:t.id,title:t.title,category:t.category,note_path:noteSet.has(t.note)?t.note:null,links:[],weekly_refs:t.refs||[]};
 topicLinks.set(t.id,linked);
 return linked;
});
function addEntry(kind,text,ref){
 const key=fileId(kind,text);
 if(facts.has(key)){
  const f=facts.get(key);
  if(!f.refs.some(r=>r.weekly===ref.weekly&&r.section===ref.section&&r.index===ref.index)){
   f.refs.push(ref);duplicateRefs++;
  }
  return f;
 }
 const risk=riskWords.test(text)?'review_required':'draft_learning';
 const f={id:key,kind,status:'draft',risk,reason:risk==='review_required'?
 '診療判断に影響し得るため原典確認が必要':'学習記録として追加（医学的に未確認）',refs:[ref]};
 facts.set(key,f);return f;
}
for(const w of index.weekly){
 if(!/^content\/weekly\/\d{4}-\d{2}-\d{2}\.md$/.test(w))throw Error('Bad Weekly path '+w);
 const data=sectionsFrom(fs.readFileSync(w,'utf8'));
 const points=bullets(data['今週の重要ポイント']);
 const questions=qa(data['今週の復習']);
 const entries=[
  ...points.map((text,index)=>({kind:'point',text,ref:{weekly:w,section:'今週の重要ポイント',index}})),
  ...questions.map((item,index)=>({kind:'qa',text:item.question+'\n'+item.answer,ref:{weekly:w,section:'今週の復習',index}}))
 ];
 for(const entry of entries){
  // Only link to topics discovered from the Weekly topic index, never invent a target.
  const targets=allTopics.filter(t=>{
   const spec=topicSpecs.get(t.topic_id);
   return spec.aliases.some(alias=>isMatch(entry.text,alias));
  });
  if(!targets.length)continue;
  const f=addEntry(entry.kind,entry.text,entry.ref);
  for(const t of targets){
   if(t.links.some(x=>x.fact_id===f.id))continue;
   const previous=existingNoteText(t);
   // Conservative overlap flag: exact knowledge sentence already present.
   const alreadyPresent=entry.kind==='point'&&normalize(previous).includes(normalize(entry.text));
   t.links.push({fact_id:f.id,target_section:targetSection(t,entry.text),already_present:alreadyPresent});
  }
 }
}
const retained=new Set(allTopics.flatMap(t=>t.links.map(l=>l.fact_id)));
const knowledge=[...facts.values()].filter(f=>retained.has(f.id)).map(f=>({
 ...f,refs:f.refs.sort((a,b)=>b.weekly.localeCompare(a.weekly))
}));
allTopics=allTopics.filter(t=>t.links.length||t.weekly_refs.length);
const result={
 schema_version:1,
 generator:'rule-based-draft-integration-v1',
 description:'Non-AI, source-linked automatic proposals; no verified content modified',
 verified:false,
 stats:{
  topics:allTopics.length,facts:knowledge.length,
  review_required:knowledge.filter(f=>f.risk==='review_required').length,
  draft_learning:knowledge.filter(f=>f.risk==='draft_learning').length,
  duplicate_source_entries:duplicateRefs,
  with_registered_note:allTopics.filter(t=>t.note_path).length
 },
 facts:knowledge,
 topics:allTopics
};
for(const f of result.facts){
 if(!['review_required','draft_learning'].includes(f.risk)||f.status!=='draft')throw Error('Unsafe fact');
 for(const ref of f.refs)if(!index.weekly.includes(ref.weekly))throw Error('Missing provenance');
}
for(const t of result.topics){
 if(t.note_path&&!noteSet.has(t.note_path))throw Error('Unknown note path');
 for(const link of t.links)if(!retained.has(link.fact_id))throw Error('Missing fact');
}
if(process.argv.includes('--write')){
 fs.writeFileSync('content/integration-proposals.json',JSON.stringify(result,null,2)+'\n');
 console.log('Generated integration proposals: '+knowledge.length+' unique learning facts, '+result.stats.review_required+' review required, '+allTopics.length+' topics');
}else{
 console.log('Integration proposals validated: '+knowledge.length+' facts / '+allTopics.length+' topics');
}
