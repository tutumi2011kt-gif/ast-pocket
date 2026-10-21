#!/usr/bin/env node
/**
 * ChatGPT data export adapter (PRIVATE LOCAL ONLY).
 * This does not connect to the user's account or automatically download chats.
 * Requires user-selected conversation IDs from an official conversations JSON
 * and writes only to the ignored local-intake/ directory.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const KEYWORDS=/感染|抗菌|抗真菌|血培|血液培養|AST|GPC|GNR|MSSA|MRSA|CoNS|Candida|ESBL|AmpC|CRE|VCM|CEZ|MEPM|TDM|薬剤耐性|肺炎|尿路感染|菌血症|微生物/i;
function toISO(time){
 if(typeof time!=='number'||!Number.isFinite(time))return null;
 const ms=time>1e11?time:time*1000;
 const d=new Date(ms);
 return Number.isFinite(d.valueOf())?d.toISOString():null;
}
export function listExport(raw){
 const list=Array.isArray(raw)?raw:Array.isArray(raw?.conversations)?raw.conversations:null;
 if(!list)throw Error('Expected official ChatGPT conversations JSON array');
 return list.filter(c=>c&&typeof c==='object'&&typeof c.id==='string')
  .map(c=>({id:c.id,title:String(c.title||'').slice(0,100),
    created:toISO(c.create_time),updated:toISO(c.update_time)}))
  .sort((a,b)=>String(b.updated||'').localeCompare(a.updated||''));
}
export function extractChosenUserQuestions(raw,{conversationIds,from,to}={}){
 if(!Array.isArray(conversationIds)||!conversationIds.length)throw Error('Explicit conversation ID selection is mandatory');
 const allowed=new Set(conversationIds),meta=listExport(raw);
 if(allowed.size!==conversationIds.length)throw Error('Duplicate conversation IDs');
 const known=new Set(meta.map(c=>c.id));
 for(const id of allowed)if(!known.has(id))throw Error('Unknown conversation ID; abort');
 const start=Date.parse(from),end=Date.parse(to);
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>31*86400000)throw Error('Invalid UTC/JST date window (maximum 31 days)');
 const records=Array.isArray(raw)?raw:raw.conversations;
 const output=[];
 for(const c of records.filter(c=>allowed.has(c.id))){
  const nodes=Object.values(c.mapping||{});
  for(const node of nodes){
   const m=node?.message;
   if(!m||m.author?.role!=='user')continue;
   const date=toISO(m.create_time);
   if(!date||Date.parse(date)<start||Date.parse(date)>=end)continue;
   const parts=m.content?.parts||[];
   if(!Array.isArray(parts))continue;
   // Ignore images, voice data, objects, attachments and assistant messages.
   const question=parts.filter(p=>typeof p==='string').join('\n').trim();
   if(!question||question.length>2500||!KEYWORDS.test(question))continue;
   output.push({conversation_id:c.id,created_at:date,question});
  }
 }
 return {export_scope:'explicit_selected_conversations',complete_history_claim:false,
  selected_conversation_count:allowed.size,from,to,
  user_questions:output.sort((a,b)=>a.created_at.localeCompare(b.created_at))};
}
const called=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(called){
 const a=process.argv.slice(2);
 const item=n=>{const i=a.indexOf(n);return i>=0?a[i+1]:null};
 try{
  const root=path.resolve('local-intake');
  const src=path.resolve(item('--input')||'');
  if(!src.startsWith(root+path.sep))throw Error('Input must be in ignored local-intake/');
  const raw=JSON.parse(fs.readFileSync(src,'utf8'));
  if(a.includes('--list')){
   for(const m of listExport(raw))console.log([m.id,m.updated||'date unknown',m.title].join('\t'));
   console.log('Titles and IDs remain local; NEVER upload the export or this list to GitHub.');
  }else{
   const ids=a.filter((v,i)=>a[i-1]==='--id'),dest=path.resolve(item('--out')||'');
   if(!dest.startsWith(root+path.sep)||!dest.endsWith('.json'))throw Error('Output must be JSON under ignored local-intake/');
   const result=extractChosenUserQuestions(raw,{conversationIds:ids,from:item('--from'),to:item('--to')});
   fs.writeFileSync(dest,JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
   console.log('Private candidate questions saved locally ('+result.user_questions.length+'). Review and GENERALIZE before any further processing.');
  }
 }catch(e){console.error('Local chat export blocked: '+e.message);process.exitCode=1}
}
