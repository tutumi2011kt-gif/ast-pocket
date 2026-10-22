#!/usr/bin/env node
/**
 * Public guideline revision watcher. NO OpenAI API or private chat data.
 * A date change is ONLY a request for human review, never a clinical update.
 */
import fs from 'node:fs';
import {auditLedger} from './check-evidence-ledger.mjs';

const MONTHS={january:'01',february:'02',march:'03',april:'04',may:'05',june:'06',
 july:'07',august:'08',september:'09',october:'10',november:'11',december:'12'};
export function extractSourceUpdateDate(html){
 if(typeof html!=='string'||html.length>2500000||html.length<30)return null;
 // Recognize authoritative display labels, not random article dates or menu links.
 const plain=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
  .replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ')
  .replace(/\s+/g,' ');
 const english=plain.match(/Last Updated(?: Date)?\s*:?\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/i);
 if(!english)return null;
 const [,month,day,year]=english;
 const val=year+'-'+MONTHS[month.toLowerCase()]+'-'+day.padStart(2,'0');
 const d=new Date(val+'T00:00:00Z');
 return Number.isFinite(d.valueOf())&&d.toISOString().slice(0,10)===val?val:null;
}
export async function observeIDSAEdition(ledger,{fetchImpl=fetch}={}){
 const src=ledger.sources.find(s=>s.id==='idsa_sab2026');
 if(!src)throw Error('IDSA SAB 2026 baseline source not registered');
 const u=new URL(src.url);
 if(u.hostname!=='www.idsociety.org'||u.pathname!=='/practice-guideline/staphylococcus-aureus-bacteremia/')throw Error('Unsafe IDSA target');
 try{
  const response=await fetchImpl(src.url,{
   redirect:'manual',headers:{Accept:'text/html'},signal:AbortSignal.timeout(12000)
  });
  if(!response.ok||response.status>=300)return {status:'unconfirmed',detail:'HTTP '+response.status};
  if(!/text\/html/i.test(response.headers?.get?.('content-type')||''))return {status:'unconfirmed',detail:'Non-HTML'};
  const contentLength=Number(response.headers?.get?.('content-length')||0);
  if(contentLength>2500000)return {status:'unconfirmed',detail:'Response too large'};
  const html=await response.text();
  const updateDate=extractSourceUpdateDate(html);
  if(!updateDate)return {status:'unconfirmed',detail:'No authoritative update date found'};
  const report=auditLedger(ledger,{observedUpdates:{idsa_sab2026:updateDate}});
  if(report.alerts.some(x=>x.type==='source_edition_changed')){
   return {status:'recheck_required',observed_updated_date:updateDate,baseline_date:src.observed_updated_date,
    affected_claim_ids:report.claims.filter(x=>x.status==='edition_recheck_required').map(x=>x.id)};
  }
  if(report.alerts.some(x=>x.type==='older_observation'))return {
   status:'unconfirmed',detail:'Observed date older than baseline',observed_updated_date:updateDate
  };
  return {status:'no_new_version_observed',observed_updated_date:updateDate,
   baseline_date:src.observed_updated_date,medical_approval:false};
 }catch{return {status:'unconfirmed',detail:'Network failure / rate limit / blocked fetch'};}
}
if(process.argv[1]?.endsWith('/watch-official-sab-guideline.mjs')){
 const ledger=JSON.parse(fs.readFileSync('docs/evidence/sab-2026-10-21.json','utf8'));
 const result=await observeIDSAEdition(ledger);
 console.log(JSON.stringify(result,null,2));
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
  '## IDSA/ESCMID 2026 SAB：原典更新監査\n\n'+
  '- 判定：'+result.status+'\n'+
  '- 公式確認日：'+(result.observed_updated_date||'取得不可')+'\n'+
  '- 要再確認記述：'+(result.affected_claim_ids?.join(', ')||'確認なし')+
  '\n\n**医学的承認・自動改訂は行いません。**\n');
 if(result.status==='recheck_required'){
  console.error('::error::Official SAB source appears to have changed; human re-review required.');
  process.exitCode=1;
 }else if(result.status==='unconfirmed'){
  console.error('::warning::Could not establish official publication version; do not infer unchanged.');
  process.exitCode=1;
 }
}
