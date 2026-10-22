#!/usr/bin/env node
/**
 * Conservative guideline excerpt retrieval gate.
 * Checks whether a locally supplied short excerpt appears in an official HTML
 * page at the specified URL. DOES NOT decide if a clinical claim is medically
 * supported, whether a guideline is current, or whether excerpt is complete.
 * PDF and redirects are never automatically accepted.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateStudyPacket} from './study-pipeline-core.mjs';
const allowed=['idsociety.org','cdc.gov','who.int','pmda.go.jp','mhlw.go.jp',
 'jstage.jst.go.jp','jihs.go.jp','amr.jihs.go.jp','eucast.org','escmid.org',
 'academic.oup.com','pubmed.ncbi.nlm.nih.gov','ncbi.nlm.nih.gov'];
const hostAllowed=host=>allowed.some(domain=>host===domain||host.endsWith('.'+domain));
const normalize=s=>String(s).normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase();
function unescapeHtml(x){
 return x.replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&')
  .replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"')
  .replace(/&#39;|&apos;/gi,"'");
}
export async function checkExcerpt(source,{fetchImpl=fetch}={}){
 const url=new URL(source.url);
 if(!hostAllowed(url.hostname))return {id:source.id,status:'non_official_domain',url:source.url};
 if(url.pathname.toLowerCase().endsWith('.pdf'))return {id:source.id,status:'pdf_manual_review',url:source.url};
 try{
  const r=await fetchImpl(source.url,{redirect:'manual',headers:{Accept:'text/html'},signal:AbortSignal.timeout(12000)});
  if(r.status>=300&&r.status<400)return {id:source.id,status:'redirect_manual_review',url:source.url};
  if(!r.ok)return {id:source.id,status:'http_error',http_status:r.status,url:source.url};
  const type=r.headers?.get?.('content-type')||'';
  if(!/text\/html/i.test(type))return {id:source.id,status:'non_html_manual_review',url:source.url};
  const headerLength=Number(r.headers?.get?.('content-length')||0);
  if(headerLength>1500000)return {id:source.id,status:'too_large',url:source.url};
  const html=await r.text();
  if(html.length>1500000)return {id:source.id,status:'too_large',url:source.url};
  const plain=unescapeHtml(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
   .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
   .replace(/<[^>]+>/g,' '));
  const matched=normalize(plain).includes(normalize(source.excerpt));
  return {id:source.id,status:matched?'excerpt_present_not_medically_verified':'excerpt_not_found',
   url:source.url};
 }catch{
  return {id:source.id,status:'network_error',url:source.url};
 }
}
export async function checkAllSources(packet,{fetchImpl=fetch}={}){
 validateStudyPacket(packet);
 const results=[];
 for(const s of packet.sources)results.push(await checkExcerpt(s,{fetchImpl}));
 return {schema_version:1,topic_id:packet.topic_id,checked_at:new Date().toISOString(),
  medical_approval:false,source_checks:results};
}
const called=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(called){
 const args=process.argv.slice(2),arg=k=>args[args.indexOf(k)+1];
 try{
  if(!args.includes('--input')||!args.includes('--out'))throw Error('Expected --input and --out');
  const root=path.resolve('local-intake'),input=path.resolve(arg('--input')),dest=path.resolve(arg('--out'));
  if(!input.startsWith(root+path.sep)||!dest.startsWith(root+path.sep)||!dest.endsWith('.json'))throw Error('Only ignored local-intake paths allowed');
  const packet=JSON.parse(fs.readFileSync(input,'utf8'));
  const report=await checkAllSources(packet);
  fs.writeFileSync(dest,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log('Guideline URL / excerpt checking finished. Only local audit written. No claim medically verified.');
 }catch(e){console.error('Source checking blocked: '+e.message);process.exitCode=1}
}
