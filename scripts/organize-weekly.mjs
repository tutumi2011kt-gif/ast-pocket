#!/usr/bin/env node
/**
 * Deterministic AST Pocket Weekly organizer.
 * Source: ONLY public Markdown paths in content/index.json.
 * Output: topic IDs and source pointers; NO excerpts, medical advice, or personal data.
 * Run: node scripts/organize-weekly.mjs --write (for Pages artifact)
 *      node scripts/organize-weekly.mjs --check (validation only)
 */
import fs from 'node:fs';
import path from 'node:path';

const base=process.cwd();
const file=p=>path.join(base,p);
const readJSON=p=>JSON.parse(fs.readFileSync(file(p),'utf8'));
const fail=message=>{throw new Error(message)};
const index=readJSON('content/index.json');
const dictionary=readJSON('data/topic-rules.json');
const organisms=readJSON('data/organisms.json');
const antibiotics=readJSON('data/antibiotics.json');
const categories=dictionary.categories;
const categorySet=new Set(categories.map(c=>c.id));
if(categorySet.size!==6||dictionary.version!==1)fail('Six categories are required');
if(!Array.isArray(index.weekly)||!Array.isArray(index.notes))fail('Bad index');
const notePaths=new Set(index.notes);
const clean=s=>String(s||'').normalize('NFKC').toLowerCase()
 .replace(/[・･\s._\-\/()（）]+/g,'')
 .replace(/ー/g,'')
 .replace(/[\u30a1-\u30f6]/g,ch=>String.fromCharCode(ch.charCodeAt(0)-0x60));
function matches(text,alias){
 const word=clean(alias),hay=clean(text);
 if(!word||!hay||word.length<2)return false;
 if(/^[a-z0-9]+$/.test(word)&&word.length<=3){
   // Protect short medical abbreviations from substring false-positives.
   const pos=hay.indexOf(word);
   if(pos<0)return false;
   for(let start=pos;start>=0;start=hay.indexOf(word,start+1)){
     const before=hay[start-1]||'',after=hay[start+word.length]||'';
     if(!/[a-z0-9]/.test(before)&&!/[a-z0-9]/.test(after))return true;
   }
   return false;
 }
 return hay.includes(word);
}
function extractSections(src){
 const out={};let section=null;
 for(const line of src.replace(/\r\n/g,'\n').split('\n')){
  if(line.startsWith('# ')){section=line.slice(2).trim();out[section]=[];continue;}
  if(!section)continue;
  const match=line.match(/^(?:\s*[-*]\s+|\s*\d+\.\s+)(.+)$/);
  if(match)out[section].push(match[1].trim());
 }
 return out;
}
const mapped=new Map();
function makeTopic({id,title,category,aliases=[],note=null},kind){
 if(!categorySet.has(category)||!id||!title)fail('Invalid topic '+id);
 if(mapped.has(id))fail('Duplicate topic '+id);
 const keys=[title,...aliases].filter(Boolean);
 mapped.set(id,{id,title,category,kind,note:notePaths.has(note)?note:null,keys,refs:[]});
}
for(const t of dictionary.topics)makeTopic(t,'curated');
for(const o of organisms)makeTopic({
 id:'organism:'+o.id,title:o.ja||o.canonical,category:'organism',
 aliases:[o.canonical,o.short,...(o.aliases||[])],note:o.note||null
},'dictionary');
for(const a of antibiotics)makeTopic({
 id:'drug:'+a.id,title:a.generic,category:'drug',
 aliases:[a.english,...(a.abbr||[]),...(a.brands||[]),...(a.aliases||[])],
 note:a.note||null
},'dictionary');
const selectedSections=['今週の学習','今週の重要ポイント','正式ノート候補'];
let totalItems=0,unclassified=0;
const weeks=[];
const topicList=[...mapped.values()];
for(const w of index.weekly){
 if(!/^content\/weekly\/\d{4}-\d{2}-\d{2}\.md$/.test(w))fail('Invalid Weekly path '+w);
 if(!fs.existsSync(file(w)))fail('Missing Weekly '+w);
 const text=fs.readFileSync(file(w),'utf8');
 if(!/^status:\s*learning-log\s*$/m.test(text))fail('Weekly must be learning-log: '+w);
 const sections=extractSections(text);
 weeks.push(w);
 for(const section of selectedSections){
   const entries=sections[section]||[];
   for(let i=0;i<entries.length;i++){
     const entry=entries[i];
     totalItems++;
     const relevant=topicList.filter(t=>t.keys.some(k=>matches(entry,k)));
     if(!relevant.length){unclassified++;continue;}
     for(const t of relevant){
       // References are pointers to already-public learning logs.
       // Do not duplicate free-text or upgrade status to verified.
       t.refs.push({weekly:w,section,index:i});
     }
   }
 }
}
const topics=topicList.filter(t=>t.refs.length).map(({keys,...t})=>({
  ...t,
  status:'draft',
  refs:t.refs.sort((a,b)=>b.weekly.localeCompare(a.weekly)||selectedSections.indexOf(a.section)-selectedSections.indexOf(b.section)||a.index-b.index)
})).sort((a,b)=>b.refs.length-a.refs.length||a.id.localeCompare(b.id));
const output={
 schema_version:1,
 generator:'deterministic-alias-classifier-v1',
 source_status:'learning-log',
 verified:false,
 categories,
 weeks,
 stats:{weekly_count:weeks.length,learning_items:totalItems,unclassified_items:unclassified,classified_topics:topics.length},
 topics
};
const ids=new Set();
for(const t of topics){
 if(ids.has(t.id))fail('Duplicate result '+t.id);ids.add(t.id);
 if(t.note&&!notePaths.has(t.note))fail('Broken note link '+t.note);
 for(const r of t.refs)if(!weeks.includes(r.weekly)||!selectedSections.includes(r.section)||!Number.isInteger(r.index)||r.index<0)fail('Bad ref '+t.id);
}
if(process.argv.includes('--write')){
 fs.writeFileSync(file('content/organized.json'),JSON.stringify(output,null,2)+'\n');
 console.log('Generated content/organized.json with '+topics.length+' matched topics across '+weeks.length+' Weekly files.');
}else{
 console.log('Weekly organizer check OK: '+topics.length+' topics / '+totalItems+' items / '+unclassified+' unclassified.');
}
