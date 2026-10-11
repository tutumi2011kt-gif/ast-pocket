#!/usr/bin/env node
/** Public GitHub Actions preflight for any existing or newly proposed Weekly. */
import fs from 'node:fs';
import {assertPublicWeekly} from './daily-ingest-core.mjs';
const index=JSON.parse(fs.readFileSync('content/index.json','utf8'));
if(!Array.isArray(index.weekly))throw Error('Missing Weekly index');
const listed=new Set(index.weekly);
const files=fs.readdirSync('content/weekly').filter(p=>/^\d{4}-\d{2}-\d{2}\.md$/.test(p)).map(p=>'content/weekly/'+p);
for(const file of files){
 if(!listed.has(file))throw Error('Unindexed Weekly file would be public via Pages: '+file);
}
for(const file of index.weekly){
 if(!/^content\/weekly\/\d{4}-\d{2}-\d{2}\.md$/.test(file))throw Error('Unexpected Weekly path');
 const content=fs.readFileSync(file,'utf8');
 assertPublicWeekly(content);
}
console.log('Weekly privacy red-flag scan passed for '+index.weekly.length+' indexed logs (human review still required).');
