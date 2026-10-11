/**
 * AST Pocket daily intake: process only explicitly public-safe study summaries.
 * Does not fetch ChatGPT history, check medical truth, or publish by itself.
 */
import fs from 'node:fs';
import path from 'node:path';
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&new Date(s+'T00:00:00Z').toISOString().startsWith(s);
const norm=s=>String(s).normalize('NFKC').toLowerCase().replace(/[\s。、.,:：()（）「」・･\-_\/]/g,'');
const badPatterns=[
 [/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i,'email'],
 [/(?:患者|診療|カルテ|病院)(?:ID|番号|No)[：:\s]*[A-Za-z0-9-]{3,}/i,'patient identifier'],
 [/(?:患者名|氏名|生年月日|住所|電話番号|病棟|病室)[：:]/,'personal identifier'],
 [/(?:院内限定|部外秘|機密資料|非公開資料|当院患者|当院症例)/,'restricted information'],
 [/(?:API[_\s-]?KEY|SECRET|TOKEN|PASSWORD|パスワード)[\s:=]{1,10}[A-Za-z0-9_./+-]{8,}/i,'secret'],
 [/\b(?:\d{3}-\d{3,4}-\d{4}|\d{11})\b/,'phone-like number'],
 [/(?:chatgpt\.com\/c\/|chat\.openai\.com\/c\/)/i,'private chat URL'],
 [/[<>\x60]|\r|\n/,'HTML, code or newline']
];
const insist=(test,msg)=>{if(!test)throw Error('AST daily intake: '+msg)};
/** Heuristic public safety check, not a guarantee: human review is still required. */
export function assertPublicWeekly(markdown){
 insist(typeof markdown==='string'&&markdown.length<=30000,'Weekly missing or too long');
 const lines=markdown.split('\n');
 for(const [i,line] of lines.entries()){
  insist(line.length<=1200,'Weekly line too long: '+(i+1));
  for(const [re,reason] of badPatterns){
   if(re.source.includes('\\r|\\n'))continue; // multiline check in the input field only
   insist(!re.test(line),'Weekly line '+(i+1)+' may contain '+reason);
  }
  insist(!/^\s*(?:user|assistant|system|ユーザー|アシスタント)[：:]\s*/i.test(line),'Raw conversation transcript is not publishable');
 }
 return true;
}

function textField(s,max,label){
 insist(typeof s==='string'&&s.length>=2&&s.length<=max&&s.trim()===s,label+' invalid length/whitespace');
 insist(!/^(?:[-*]|\d+\.|#)/.test(s),label+' contains Markdown structure');
 for(const [re,reason] of badPatterns)insist(!re.test(s),label+' possible '+reason);
 return s;
}
function allowKeys(o,allowed,label){
 insist(o&&typeof o==='object'&&!Array.isArray(o),label+' must be object');
 for(const k of Object.keys(o))insist(allowed.includes(k),label+' unexpected field: '+k);
}
function publicSource(s){
 insist(typeof s==='string'&&s.length<250&&/^https:\/\/[a-z0-9.-]+(?:\/[^\s<>"']*)?$/i.test(s),'public HTTPS URL required');
 const u=new URL(s);
 insist(!u.username&&!u.password&&!u.search&&!u.hash,'no tokens or queries in source URLs');
 insist(!/(?:localhost|127\.0\.0\.1|intranet|internal|private|chatgpt\.com|chat\.openai\.com|github\.com)$/i.test(u.hostname),'private source URL forbidden');
 return u.href;
}
export function validateDailyIntake(raw){
 allowKeys(raw,['schema_version','date','coverage','public_release_reviewed','window_start_jst','window_end_jst','learning'],'input');
 insist(raw.schema_version===1&&validDate(raw.date),'bad schema/date');
 insist(['accessible_context_only','user_reviewed_export'].includes(raw.coverage),'coverage is not supported');
 insist(raw.public_release_reviewed===true,'public release review required before any GitHub upload');
 const stamp=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/;
 insist(stamp.test(raw.window_start_jst)&&stamp.test(raw.window_end_jst),'JST window required');
 const t0=new Date(raw.window_start_jst),t1=new Date(raw.window_end_jst);
 insist(Number.isFinite(t0.valueOf())&&Number.isFinite(t1.valueOf())&&t1>t0&&t1-t0<=26*3600000,'invalid time window');
 insist(raw.window_end_jst.slice(0,10)===raw.date,'date and end time mismatch');
 insist(Array.isArray(raw.learning)&&raw.learning.length<=25,'learning must be at most 25 items');
 const seen=new Set(),learning=[];
 for(const [i,e] of raw.learning.entries()){
  allowKeys(e,['topic','point','question','answer','source_urls'],'learning item '+i);
  const topic=textField(e.topic,70,'topic'),point=textField(e.point,280,'point');
  const hasQ=Object.hasOwn(e,'question'),hasA=Object.hasOwn(e,'answer');
  insist(hasQ===hasA,'question and answer must both be present or absent');
  const question=hasQ?textField(e.question,180,'question'):null,answer=hasA?textField(e.answer,280,'answer'):null;
  insist(e.source_urls===undefined||Array.isArray(e.source_urls),'source_urls must be array');
  const source_urls=[...new Set((e.source_urls||[]).map(publicSource))];
  insist(source_urls.length<=3,'too many source URLs');
  const key=norm(point)+'|'+norm(question||'');
  if(!seen.has(key)){learning.push({topic,point,...(hasQ?{question,answer}:{}),source_urls});seen.add(key)}
 }
 return {schema_version:1,date:raw.date,coverage:raw.coverage,public_release_reviewed:true,
  window_start_jst:raw.window_start_jst,window_end_jst:raw.window_end_jst,learning};
}
function extract(md,heading){
 const token='# '+heading+'\n',start=md.indexOf(token);
 if(start<0)return [];
 const after=start+token.length,end=md.indexOf('\n# ',after);
 return md.slice(after,end<0?md.length:end).split('\n').map(x=>x.trimEnd()).filter(x=>x.trim());
}
function bullets(lines){return lines.map(s=>s.replace(/^(?:[-*]\s*|\d+\.\s*)/,''))}
function uniqPush(rows,item){if(rows.some(s=>norm(s)===norm(item)))return false;rows.push(item);return true}
export function appendDailyRecord(raw,{index,weeklyByPath={}}={}){
 const input=validateDailyIntake(raw),weeklyPath='content/weekly/'+input.date+'.md',previous=weeklyByPath[weeklyPath]||'';
 insist(index&&Array.isArray(index.notes)&&Array.isArray(index.weekly),'invalid index');
 if(previous){
  insist(previous.startsWith('---\n')&&/^status:\s*learning-log\s*$/m.test(previous),'incompatible existing Weekly');
  for(const name of ['今週の学習','今週の重要ポイント','今週の復習','正式ノート候補'])insist(previous.includes('# '+name+'\n'),'missing Weekly heading '+name);
 }
 const topics=bullets(extract(previous,'今週の学習'));
 const points=bullets(extract(previous,'今週の重要ポイント'));
 const candidates=bullets(extract(previous,'正式ノート候補'));
 const qlines=extract(previous,'今週の復習');
 const sources=extract(previous,'原典候補（未確認）');
 let added=0,addedQA=0;
 for(const e of input.learning){
  uniqPush(topics,e.topic);uniqPush(candidates,e.topic);
  if(uniqPush(points,e.point)){
   added++;
   for(const url of e.source_urls){
    const line='- 重要ポイント'+points.length+'の出典候補: '+url;
    uniqPush(sources,line);
   }
  }
  if(e.question&&e.answer){
   const qi=qlines.findIndex(s=>norm(s.replace(/^[-*]\s*Q:\s*/,''))===norm(e.question));
   if(qi>=0){
    insist(norm((qlines[qi+1]||'').replace(/^\s*A:\s*/,''))===norm(e.answer),
      'different answer for existing question; needs human review');
   }else{
    qlines.push('- Q: '+e.question,'  A: '+e.answer);addedQA++;
   }
  }
 }
 if(!added&&!addedQA)return {changed:false,reason:previous?'no_new_content':'no_learning',weeklyPath,weekly:previous||null,index,added,addedQA};
 const front=previous?previous.slice(0,previous.indexOf('\n---\n',4)+5):
  '---\ntitle: AST Weekly '+input.date+'\nweek: '+input.window_start_jst+'〜'+input.window_end_jst+
  '\nstatus: learning-log\nlast_reviewed:\nsource_coverage: '+input.coverage+'\ntags: 学習記録, 原典未確認\n---';
 const known=new Set(['今週の学習','今週の重要ポイント','今週の復習','正式ノート候補','原典候補（未確認）','安全上の注意']);
 const other=previous.split('\n# ').slice(1).filter(x=>!known.has(x.split('\n')[0].trim())).map(s=>'# '+s.trim()).join('\n\n');
 const weekly=front+'\n# 今週の学習\n'+topics.map(x=>'- '+x).join('\n')+
 '\n\n# 今週の重要ポイント\n'+points.map((x,i)=>(i+1)+'. '+x).join('\n')+
 '\n\n# 今週の復習\n'+qlines.join('\n')+
 '\n\n# 正式ノート候補\n'+candidates.map(x=>'- '+x).join('\n')+
 '\n\n# 原典候補（未確認）\n'+sources.join('\n')+
 '\n\n# 安全上の注意\n- 取得できた学習内容のみを記録した原典未確認の学習メモです。臨床推奨ではありません。\n'+
 (other?'\n'+other+'\n':'');
 const next={...index,weekly:[...new Set([...index.weekly,weeklyPath])].sort().reverse()};
 return {changed:true,reason:'added',weeklyPath,weekly,index:next,added,addedQA};
}
export function prepareDailyFromFile(inputFile,{root=process.cwd(),write=false}={}){
 insist(typeof inputFile==='string'&&inputFile.length>0,'input file required');
 const input=validateDailyIntake(JSON.parse(fs.readFileSync(inputFile,'utf8')));
 const indexFile=path.join(root,'content/index.json'),index=JSON.parse(fs.readFileSync(indexFile,'utf8'));
 const weeklyPath='content/weekly/'+input.date+'.md',dest=path.join(root,weeklyPath);
 const existing=fs.existsSync(dest)?fs.readFileSync(dest,'utf8'):null;
 const result=appendDailyRecord(input,{index,weeklyByPath:existing?{[weeklyPath]:existing}:{}});
 if(write&&result.changed){
  assertPublicWeekly(result.weekly);
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.writeFileSync(dest,result.weekly,'utf8');
  fs.writeFileSync(indexFile,JSON.stringify(result.index,null,2)+'\n','utf8');
 }
 return {...result,write};
}
