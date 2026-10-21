#!/usr/bin/env node
/**
 * Local-only review report; no API calls and no writes to official AST notes.
 *
 * First build ChatGPT output in a private conversation and review/de-identify
 * the packet and JSON before running this on an offline computer.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {makeRevisionProposal,renderRevisionReport,requireUnchangedNote} from './note-revision-core.mjs';
const called=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(called){
 const args=process.argv.slice(2),value=k=>{const i=args.indexOf(k);return i<0?null:args[i+1]};
 try{
  const base=path.resolve('local-intake'),within=v=>typeof v==='string'&&path.resolve(v).startsWith(base+path.sep);
  const packetFile=value('--input'),chatFile=value('--draft'),reportFile=value('--out');
  const existing=value('--existing')||null;
  if(!within(packetFile)||!within(chatFile)||!within(reportFile))throw Error('Private packet, draft and output paths must be under ignored local-intake/');
  if(!packetFile.endsWith('.json')||!chatFile.endsWith('.json')||!reportFile.endsWith('.md'))throw Error('Wrong input/output extension');
  if(existing&&!/^content\/notes\/[a-z0-9][a-z0-9-]*\.md$/.test(existing))throw Error('Only existing public AST Pocket note paths supported');
  const packet=JSON.parse(fs.readFileSync(packetFile,'utf8'));
  const draft=JSON.parse(fs.readFileSync(chatFile,'utf8'));
  const previous=existing?fs.readFileSync(existing,'utf8'):'';
  const proposal=makeRevisionProposal(packet,draft,{existingMarkdown:previous,notePath:existing});
  requireUnchangedNote(proposal,previous);
  fs.mkdirSync(path.dirname(path.resolve(reportFile)),{recursive:true});
  fs.writeFileSync(path.resolve(reportFile),renderRevisionReport(proposal),{flag:'wx',mode:0o600,encoding:'utf8'});
  console.log('Private review report written; '+JSON.stringify(proposal.stats));
  console.log('No clinical note modified, no GitHub publication, no API connection.');
 }catch(e){console.error('Revision review blocked: '+e.message);process.exitCode=1}
}
