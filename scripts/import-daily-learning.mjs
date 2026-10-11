#!/usr/bin/env node
/**
 * Usage: node scripts/import-daily-learning.mjs --input /local/path/2026-10-11.json [--write]
 * --write modifies local worktree files, never pushes to GitHub.
 * No input or no new learning: do not invent an empty Weekly.
 */
import {prepareDailyFromFile} from './daily-ingest-core.mjs';
const args=process.argv.slice(2);
const i=args.indexOf('--input');
if(i<0||!args[i+1]||args.some(x=>!['--input','--write','--check',args[i+1]].includes(x))){
 console.error('Usage: node scripts/import-daily-learning.mjs --input <private local JSON> [--write]');
 process.exit(2);
}
try{
 const r=prepareDailyFromFile(args[i+1],{write:args.includes('--write')});
 console.log(JSON.stringify({
  changed:r.changed,reason:r.reason,added:r.added,added_qa:r.addedQA,
  weekly_path:r.changed||r.weekly?r.weeklyPath:null,
  index_updated:args.includes('--write')&&r.changed,
  note_medically_verified:false,
  git_committed:false,public_safety_manual_review_required:true
 },null,2));
}catch(error){
 console.error('Daily intake blocked: '+error.message);
 process.exitCode=1;
}
