import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {
 NOTE_CATEGORIES,getChapters,routeLearningChapter,readNotebookPrefs,writeNotebookPrefs,renderTemplateNotebook
} from '../notebook-templates.mjs';

assert.deepEqual(NOTE_CATEGORIES,['organism','drug','infection','culture','ast','cross']);
for(const cat of NOTE_CATEGORIES){
 const ch=getChapters(cat);assert.equal(ch.length,8,cat+' must have 8 chapters');
 assert.equal(new Set(ch.map(c=>c.id)).size,ch.length,cat+' duplicated chapter IDs');
 assert.ok(ch.every(c=>c.title&&c.id));
 assert.ok(ch.some(c=>c.id==='evidence'));
}
const checks=[
 ['organism','CoNSのcolonizationと培養汚染','colonization'],
 ['organism','ESBLの耐性機序を復習','resistance'],
 ['drug','ST合剤の高Kの注意','safety'],
 ['drug','腎機能と透析患者での調整','renal'],
 ['drug','VCMのAUC値でTDM','pkpd'],
 ['infection','MSSAの感染性心内膜炎','source'],
 ['infection','菌血症の治療期間','duration'],
 ['culture','再血液培養の重要性','followup'],
 ['culture','CoNSを血液培養から検出した','interpretation'],
 ['ast','感染源コントロール','source'],
 ['ast','医師へAST介入を提案','proposal'],
 ['cross','高カリウム血症に注意','safety']
];
for(const [cat,src,expected] of checks){
 const result=routeLearningChapter(cat,src);
 assert.equal(result.chapter_id,expected,cat+' / '+src);
 assert.equal(result.routing,'keyword_rule_v1');
}
assert.equal(routeLearningChapter('drug','まったく関係のない文章').chapter_id,'unclassified');
assert.equal(routeLearningChapter('drug','まったく関係のない文章').routing,'needs_classification');
const mssa=routeLearningChapter('infection','MSSAで心内膜炎を考える',{
 notePath:'content/notes/mssa-bacteremia.md',targetSection:'再血培と持続菌血症'
});
assert.equal(mssa.chapter_id,'diagnosis');
assert.equal(mssa.routing,'section_rule_v1');

const fakeMap=new Map();const storage={getItem:k=>fakeMap.get(k)||null,setItem:(k,v)=>fakeMap.set(k,v)};
assert.equal(readNotebookPrefs('topic-a','drug',storage).depth,'deep');
assert.ok(writeNotebookPrefs('topic-a','drug',{depth:'simple',open:['safety','NOT_KNOWN'],lastChapter:'safety',scrollY:245},storage));
let prefs=readNotebookPrefs('topic-a','drug',storage);
assert.deepEqual(prefs.open,['safety']);
assert.equal(prefs.lastChapter,'safety');
assert.equal(prefs.scrollY,245);
assert.equal(readNotebookPrefs('topic-b','drug',storage).lastChapter,null);
assert.equal(readNotebookPrefs('topic-a','infection',storage).lastChapter,null,'Category change must invalidate unrelated chapter');
const denied={getItem(){throw Error('denied')},setItem(){throw Error('denied')}};
assert.equal(readNotebookPrefs('x','drug',denied).depth,'deep');
assert.equal(writeNotebookPrefs('x','drug',{depth:'deep',open:[],scrollY:0},denied),false);

const old=globalThis.localStorage;
Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true});
try{
 const note={id:'topic-a',title:'ST合剤',category:'drug',sections:{
  'まず覚える':'- 既存のノート見出しに記載した内容（原典未確認）',
  '自分メモ':'- 未分類でも消してはいけないノート本文'
 }};
 const links=[
  {fact_id:'f0',chapter_id:'safety',routing:'keyword_rule_v1'},
  {fact_id:'f1',chapter_id:'unclassified',routing:'needs_classification'},
  {fact_id:'f2',chapter_id:'safety',routing:'keyword_rule_v1'}
 ];
 const conf={...note,mode:'study',links,fragmentForLink:l=>'<a class="open-weekly-ref">'+l.fact_id+'</a>',
  historyHtml:'<span>元のWeeklyへ</span>',notesMeta:{status:'draft'}};
 let html=renderTemplateNotebook(conf);
 assert.equal((html.match(/data-template-chapter=/g)||[]).length,8);
 assert.equal((html.match(/data-template-jump=/g)||[]).length,8);
 assert.ok(html.includes('data-template-depth="simple" aria-pressed="true"'));
 assert.ok(html.includes('前回の続きから再開'));
 assert.ok(html.includes('未分類・確認待ち 2件'));
 assert.ok(html.includes('未分類でも消してはいけない'));
 assert.ok(html.includes('f1'));
 assert.ok(html.includes('open-weekly-ref'));
 assert.ok(html.includes('元のWeeklyへ'));
 assert.ok(html.includes('原典確認待ち'));
 assert.ok(!html.includes('医学的に確認済み'));
 assert.ok(writeNotebookPrefs('topic-a','drug',{depth:'deep',open:['safety'],lastChapter:'safety',scrollY:38},storage));
 html=renderTemplateNotebook(conf);
 assert.ok(html.includes('f0')&&html.includes('f2'),'Detailed mode shows all proposals');
 const clinical=renderTemplateNotebook({...conf,mode:'clinical',historyHtml:'PATIENT_SECRET_SHOULD_NOT_SHOW'});
 assert.ok(clinical.includes('臨床用の要約は原典確認待ち'));
 assert.ok(!clinical.includes('PATIENT_SECRET_SHOULD_NOT_SHOW'));
 assert.ok(!clinical.includes('f0'));
 assert.ok(!clinical.includes('未分類でも消してはいけない'));
}finally{
 if(old===undefined)delete globalThis.localStorage;
 else Object.defineProperty(globalThis,'localStorage',{value:old,configurable:true});
}
// Integration proposals must contain only pointers, stable IDs, and chapter metadata.
execFileSync(process.execPath,['scripts/organize-weekly.mjs','--write'],{stdio:'pipe'});
execFileSync(process.execPath,['scripts/propose-integrations.mjs','--write'],{stdio:'pipe'});
const idx=JSON.parse(fs.readFileSync('content/index.json','utf8'));
const data=JSON.parse(fs.readFileSync('content/integration-proposals.json','utf8'));
assert.equal(data.verified,false);
assert.equal(data.chapter_schema_version,1);
const ids=new Set(data.facts.map(f=>f.id));
for(const topic of data.topics){
 const chapters=new Set(getChapters(topic.category).map(x=>x.id));
 for(const link of topic.links){
  assert.ok(ids.has(link.fact_id));
  assert.ok(chapters.has(link.target_chapter)||link.target_chapter==='unclassified');
  assert.ok(['section_rule_v1','keyword_rule_v1','needs_classification'].includes(link.routing));
  assert.ok(!('text' in link)&&!('answer' in link),'No clinical prose in chapter pointer');
 }
}
for(const fact of data.facts){assert.equal(fact.status,'draft');}
assert.ok(idx.weekly.length>0);
assert.ok(data.topics.some(t=>t.category==='infection'&&t.links.some(l=>l.target_chapter!=='unclassified')));
// Steno organism registered notes and new topic schemas stay isolated.
const organism=fs.readFileSync('content/notes/stenotrophomonas-maltophilia.md','utf8');
assert.ok(organism.includes('# ASTで確認'));
console.log('Notebook template tests passed: 6 templates / 8 chapters, conservative classification, source pointers, safe reader and clinical gating.');
