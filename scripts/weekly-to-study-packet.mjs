#!/usr/bin/env node
/**
 * Convert ALREADY PUBLIC AST Pocket Weekly references into a PRIVATE,
 * explicitly unapproved AI draft packet. Does not auto-approve safety.
 * Requires organize-weekly and propose-integrations generated locally first.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {getChapters} from '../notebook-templates.mjs';
function pointsFromWeekly(markdown){
 const start=markdown.indexOf('# 今週の重要ポイント\n');
 if(start<0)return [];
 const raw=markdown.slice(start+'# 今週の重要ポイント\n'.length).split('\n# ')[0];
 return raw.split('\n').filter(x=>/^\s*\d+\.\s+/.test(x))
  .map(x=>x.replace(/^\s*\d+\.\s+/,'').trim());
}
export function buildPacketFromWeekly({topicId,date,index,proposals,readWeekly}){
 if(!/^[-:a-z0-9]{3,140}$/.test(topicId))throw Error('Invalid topic ID');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Invalid date');
 const wanted='content/weekly/'+date+'.md';
 if(!index.weekly.includes(wanted))throw Error('Weekly not in approved/public index');
 const topic=proposals.topics.find(x=>x.topic_id===topicId);
 if(!topic)throw Error('Topic has no published source pointers');
 const facts=new Map(proposals.facts.map(x=>[x.id,x]));
 const ids=new Set(getChapters(topic.category).map(x=>x.id));
 const unique=new Set(),learning=[];
 for(const link of topic.links){
  const fact=facts.get(link.fact_id);
  if(!fact)throw Error('Unknown fact pointer');
  const ref=fact.refs.find(r=>r.weekly===wanted&&r.section==='今週の重要ポイント');
  if(!ref)continue;
  const lines=pointsFromWeekly(readWeekly(wanted));
  const point=lines[ref.index];
  if(!point||point.length>280)throw Error('Bad Weekly source point');
  if(unique.has(point))continue;
  if(!ids.has(link.target_chapter))continue; // Remains in original Weekly; manual chapter assignment required.
  unique.add(point);
  learning.push({id:'p'+(learning.length+1),point,chapter_id:link.target_chapter});
 }
 if(!learning.length)throw Error('No new point for topic on this date; never invent input');
 return {schema_version:1,date,origin:'task_accessible_partial',
  public_safe_reviewed:false,topic_id:topicId,title:topic.title,
  category:topic.category,learning,sources:[]};
}
const called=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(called){
 const args=process.argv.slice(2),arg=k=>args[args.indexOf(k)+1];
 try{
  const root=path.resolve('local-intake'),dest=path.resolve(arg('--out')||'');
  if(!dest.startsWith(root+path.sep)||!dest.endsWith('.json'))throw Error('Output must reside under ignored local-intake/');
  const index=JSON.parse(fs.readFileSync('content/index.json','utf8'));
  const proposals=JSON.parse(fs.readFileSync('content/integration-proposals.json','utf8'));
  const packet=buildPacketFromWeekly({topicId:arg('--topic'),date:arg('--date'),index,proposals,
   readWeekly:p=>fs.readFileSync(p,'utf8')});
  fs.writeFileSync(dest,JSON.stringify(packet,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log('Local candidate packet created. public_safe_reviewed remains FALSE until human review; source excerpts must be supplied from originals.');
 }catch(e){console.error('Packet bridge blocked: '+e.message);process.exitCode=1}
}
