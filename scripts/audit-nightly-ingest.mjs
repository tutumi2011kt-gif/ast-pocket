#!/usr/bin/env node
/**
 * AST Pocket nightly ingest watchdog.
 * Verifies only GitHub artifacts (merged Weekly / open review PR).
 * GitHub cannot see ChatGPT conversations. Absence is UNCONFIRMED, never "0 study".
 *
 * Node 20+, no dependencies. This check never writes medical/patient data.
 */
import fs from 'node:fs';
import path from 'node:path';

export const weeklyForDate=date=>'content/weekly/'+date+'.md';
const DATE=/^\d{4}-\d{2}-\d{2}$/;
export function isRealDate(date){
 if(typeof date!=='string'||!DATE.test(date))return false;
 const time=new Date(date+'T00:00:00Z');
 return Number.isFinite(time.valueOf())&&time.toISOString().slice(0,10)===date;
}
export function jstParts(now){
 const parts=new Intl.DateTimeFormat('en-US',{
  timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',
  hour:'2-digit',hourCycle:'h23'
 }).formatToParts(now);
 const get=k=>parts.find(x=>x.type===k)?.value;
 return {date:[get('year'),get('month'),get('day')].join('-'),hour:Number(get('hour'))};
}
export function currentExpectedDate(now){
 const p=jstParts(now);
 if(p.hour>=4)return p.date;
 // Before 04:00 JST, today's 03:00 job may not have completed.
 return new Date(Date.parse(p.date+'T00:00:00Z')-86400000).toISOString().slice(0,10);
}
/**
 * statuses: published, pending_review, unconfirmed, not_due.
 * "unconfirmed" means the public repo gives no proof of an artifact.
 */
export function inspectNightly({date,index,files=[],prs=[],now=new Date()}){
 if(!isRealDate(date))throw Error('Invalid date');
 if(!index||!Array.isArray(index.weekly)||!Array.isArray(index.notes))throw Error('Invalid Weekly index');
 const target=weeklyForDate(date);
 const fileSet=new Set(files);
 const listed=index.weekly.includes(target),present=fileSet.has(target);
 if(listed&&present)return {date,status:'published',weekly:target,pr_numbers:[],reason:'Weekly exists in main and is indexed; does not prove full chat coverage or medical verification'};
 if(listed&&!present)return {date,status:'unconfirmed',weekly:target,pr_numbers:[],reason:'Indexed Weekly file is missing from main (broken publish state)'};
 if(!listed&&present)return {date,status:'unconfirmed',weekly:target,pr_numbers:[],reason:'Weekly exists but is not indexed (not visible in notes)'};
 const matching=prs.filter(p=>p.state==='open'&&Array.isArray(p.files)&&p.files.includes(target))
  .map(p=>p.number).sort((a,b)=>a-b);
 if(matching.length)return {date,status:'pending_review',weekly:target,pr_numbers:matching,
  reason:'Dated learning exists only in an open PR; it is not published'};
 // Date might be queried before the scheduled update.
 const time=jstParts(now);
 if(time.date===date&&time.hour<4)return {date,status:'not_due',weekly:target,pr_numbers:[],
  reason:'Nightly 03:00 JST run may still be in progress'};
 return {date,status:'unconfirmed',weekly:target,pr_numbers:[],
  reason:'No indexed Weekly or open review PR: cannot distinguish no study, inaccessible chat, blocked private data, or GitHub write failure'};
}
const base='https://api.github.com/repos/';
async function json(apiPath,token,fetchImpl=fetch){
 const res=await fetchImpl(base+apiPath,{
  headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,
   'X-GitHub-Api-Version':'2022-11-28'},
  signal:AbortSignal.timeout(15000)
 });
 if(!res.ok)throw Error('GitHub API failed for '+apiPath+' (HTTP '+res.status+')');
 return res.json();
}
export async function getOpenWeeklyPrs({repo,token,fetchImpl=fetch}){
 const pulls=await json(repo+'/pulls?state=open&per_page=100',token,fetchImpl);
 const list=[];
 for(const pr of pulls){
  const files=await json(repo+'/pulls/'+pr.number+'/files?per_page=100',token,fetchImpl);
  list.push({number:pr.number,state:pr.state,
   files:files.map(f=>f.filename).filter(f=>/^content\/weekly\/\d{4}-\d{2}-\d{2}\.md$/.test(f))});
 }
 return list;
}
const calledDirectly=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname);
if(calledDirectly){
 const now=new Date(),repo=process.env.GITHUB_REPOSITORY||'tutumi2011kt-gif/ast-pocket';
 const date=process.argv.includes('--date')?process.argv[process.argv.indexOf('--date')+1]:currentExpectedDate(now);
 const root=process.cwd();
 try{
  const index=JSON.parse(fs.readFileSync(path.join(root,'content/index.json'),'utf8'));
  const files=fs.readdirSync(path.join(root,'content/weekly'))
   .filter(f=>f.endsWith('.md')).map(f=>'content/weekly/'+f);
  const token=process.env.GITHUB_TOKEN;
  if(!token)throw Error('GITHUB_TOKEN required to inspect open PRs; cannot claim no pending work');
  const prs=await getOpenWeeklyPrs({repo,token});
  const result=inspectNightly({date,index,files,prs,now});
  console.log(JSON.stringify(result,null,2));
  if(process.env.GITHUB_STEP_SUMMARY){
   fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    '### AST Pocket 日次更新監査（'+date+' JST）\n\n'+
    '| 項目 | 結果 |\n|---|---|\n'+
    '| 保存状態 | '+result.status+' |\n'+
    '| 対象 | '+result.weekly+' |\n'+
    '| 確認用PR | '+(result.pr_numbers.join(', ')||'なし')+' |\n'+
    '\n'+result.reason+'\n\n**GitHubからはChatGPT会話の取得状況や学習0件を証明できません。**\n');
  }
  if(result.status==='unconfirmed'){
   console.error('::error::AST Pocket ingest not confirmed for '+date+' (NOT proof of no learning). Check ChatGPT task outcome and GitHub permissions.');
   process.exitCode=1;
  }else if(result.status==='pending_review'){
   console.log('::warning::Daily Weekly is awaiting review and is not yet published.');
  }else if(result.status==='not_due'){
   console.log('::notice::03:00 JST job has not completed; run again later.');
  }else console.log('::notice::Dated Weekly indexed in main. Source coverage remains unverified.');
 }catch(e){
  console.error('::error::Ingest watchdog cannot complete: '+e.message);
  process.exitCode=1;
 }
}
