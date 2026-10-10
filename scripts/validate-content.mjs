import fs from 'node:fs';

const failures=[];
const fail=message=>failures.push(message);
function readJSON(path){
  try{return JSON.parse(fs.readFileSync(path,'utf8'));}
  catch(err){fail(path+': '+err.message);return null;}
}
function exists(path){if(!fs.existsSync(path))fail('参照ファイルがありません: '+path);}
function noDuplicates(values,label){
  const seen=new Set();
  for(const value of values){if(seen.has(value))fail(label+' が重複: '+value);seen.add(value);}
}
const organisms=readJSON('data/organisms.json');
const antibiotics=readJSON('data/antibiotics.json');
const index=readJSON('content/index.json');
const review=readJSON('content/review/questions.json');

for(const [label,records,required] of [
  ['organisms',organisms,['id','canonical','ja','aliases','tags','source','last_reviewed','status']],
  ['antibiotics',antibiotics,['id','generic','english','abbr','brands','aliases','tags','source','last_reviewed','status']]
]){
  if(!Array.isArray(records)){fail(label+' must be array');continue;}
  noDuplicates(records.map(x=>x.id),label+' ID');
  for(const [i,item] of records.entries()){
    for(const key of required)if(!Object.hasOwn(item,key))fail(label+'['+i+'] '+key+' がありません');
    if(!['draft','verified'].includes(item.status))fail(label+'['+i+'] 未知のstatus: '+item.status);
    if(!Array.isArray(item.aliases)||!Array.isArray(item.tags))fail(label+'['+i+'] aliases/tags must be arrays');
  }
}
if(!index||!Array.isArray(index.notes)||!Array.isArray(index.weekly))fail('index.notes/weekly must be arrays');
else{
  for(const kind of ['notes','weekly']){
    noDuplicates(index[kind],kind+' path');
    for(const p of index[kind]){
      if(typeof p!=='string'||!p.startsWith('content/'+kind+'/')){fail('index path invalid: '+p);continue;}
      exists(p);
    }
  }
  const weeks=index.weekly;
  if(weeks.some(p=>!/^content\/weekly\/\d{4}-\d{2}-\d{2}\.md$/.test(p)))fail('Weekly filename must be YYYY-MM-DD.md');
  if(weeks.some((p,i)=>i&&p>weeks[i-1]))fail('index.weekly must be newest first');
  for(const p of weeks){
    if(!fs.existsSync(p))continue;
    const md=fs.readFileSync(p,'utf8');
    if(!md.startsWith('---\n')||!/^status:\s*learning-log\s*$/m.test(md))fail('Weekly must be learning-log: '+p);
    for(const heading of ['今週の学習','今週の重要ポイント','今週の復習','正式ノート候補'])
      if(!md.includes('# '+heading))fail('Weekly section missing: '+p+' '+heading);
  }
}
if(!Array.isArray(review))fail('review must be array');
else{
  noDuplicates(review.map(x=>x.q),'Review Q');
  review.forEach((x,i)=>{if(typeof x.q!=='string'||typeof x.a!=='string'||!x.q||!x.a)fail('Invalid review Q/A #'+i);});
}
if(failures.length){console.error(failures.join('\n'));process.exit(1);}
console.log('AST Pocket data and Weekly index OK: '+organisms.length+' organisms, '+antibiotics.length+' drugs, '+index.weekly.length+' weekly');
