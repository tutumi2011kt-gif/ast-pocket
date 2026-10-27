#!/usr/bin/env node
/**
 * GitHub Pages build step. Run AFTER validation, BEFORE artifact upload.
 * Stamps deployment version into published files only (not git commits).
 * Every release gets a new HTML URL, CSS URL and browser module import URL.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const shaRx=/^[a-f0-9]{40}$/;
export function preparePagesVersion({root,sha,builtAt=new Date().toISOString()}){
 if(typeof root!=='string'||!shaRx.test(sha))throw Error('GITHUB_SHA must be a real 40-char commit hash');
 const indexPath=path.join(root,'index.html');
 let index=fs.readFileSync(indexPath,'utf8');
 for(const [key,pattern] of [
  ['stylesheet',/(href="styles\.css)(?:\?v=[a-f0-9]{40})?(")/],
  ['app',/(src="app\.js)(?:\?v=[a-f0-9]{40})?(")/]
 ]){
  if(!pattern.test(index))throw Error('Expected '+key+' asset link in index.html');
  index=index.replace(pattern,(_full,a,b)=>a+'?v='+sha+b);
 }
 const meta='<meta name="ast-pocket-build" content="'+sha+'" />';
 if(/<meta name="ast-pocket-build" content="[a-f0-9]{40}"\s*\/?>/.test(index))
  index=index.replace(/<meta name="ast-pocket-build" content="[a-f0-9]{40}"\s*\/?>/,meta);
 else{
  if(!index.includes('</head>'))throw Error('HTML head missing');
  index=index.replace('</head>','  '+meta+'\n</head>');
 }
 fs.writeFileSync(indexPath,index,'utf8');
 // Root browser modules are import-chained, e.g. app.js -> review-feature.mjs
 // -> review-engine.mjs. Bust the complete browser module graph.
 const touched=[];
 for(const file of fs.readdirSync(root).filter(x=>x==='app.js'||/^[a-z0-9-]+\.mjs$/.test(x))){
  const target=path.join(root,file);
  if(!fs.statSync(target).isFile())continue;
  let src=fs.readFileSync(target,'utf8');
  const next=src.replace(/((?:\bfrom\s*|\bimport\s*)['"])(\.\/[a-z0-9-]+\.mjs)(?:\?v=[a-f0-9]{40})?(['"])/g,
    (_full,start,rel,end)=>start+rel+'?v='+sha+end);
  if(src!==next){fs.writeFileSync(target,next,'utf8');touched.push(file);}
 }
 fs.writeFileSync(path.join(root,'version.json'),JSON.stringify({
  schema_version:1,commit:sha,built_at:builtAt
 },null,2)+'\n','utf8');
 return {sha,updatedBrowserModules:touched};
}
const main=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(main){
 try{
  const report=preparePagesVersion({root:process.cwd(),sha:process.env.GITHUB_SHA});
  console.log('Pages versioned assets: '+report.sha+'; modules updated: '+report.updatedBrowserModules.join(', '));
 }catch(error){console.error(error.message);process.exitCode=1;}
}
