import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 MSSA_PATH,MSSA_CHAPTERS,renderMssaNotebook,readMssaPrefs,saveMssaPrefs,bindMssaReader,stopMssaReader
} from '../mssa-notebook.mjs';

const storage=new Map();
const testStorage={
 getItem(k){return storage.has(k)?storage.get(k):null},
 setItem(k,v){storage.set(k,v)}
};
assert.equal(MSSA_PATH,'content/notes/mssa-bacteremia.md');
assert.equal(MSSA_CHAPTERS.length,8);
assert.equal(new Set(MSSA_CHAPTERS.map(c=>c.id)).size,8);
const id='infection-s-aureus-bacteremia';
const n={path:MSSA_PATH,fm:{id,title:'MSSA菌血症',ja:'黄色ブドウ球菌菌血症',status:'draft',
 tags:'MSSA, CEZ, 血液培養',source:'原典照合待ち',last_reviewed:'',last_structural_update:'2026-10-11'},sections:{}};
const md=fs.readFileSync(MSSA_PATH,'utf8');
let current='';
for(const line of md.split('\n')){
 if(line.startsWith('# ')){current=line.slice(2);n.sections[current]='';}
 else if(current)n.sections[current]+=line+'\n';
}
assert.equal(readMssaPrefs(id,testStorage).depth,'deep');
assert.deepEqual(readMssaPrefs(id,testStorage).open,['culture']);
assert.ok(saveMssaPrefs(id,{depth:'simple',open:['culture','antibiotics','INVALID'],lastChapter:'antibiotics',scrollY:444},testStorage));
const restored=readMssaPrefs(id,testStorage);
assert.deepEqual(restored.open,['culture','antibiotics']);
assert.equal(restored.depth,'simple');
assert.equal(restored.lastChapter,'antibiotics');
assert.equal(restored.scrollY,444);
assert.ok(!JSON.stringify([...storage.entries()]).includes('患者名'));
assert.equal(readMssaPrefs('separate-note',testStorage).lastChapter,null,'Preference keys must be per note');
const fakeStorageObject=globalThis.localStorage;
Object.defineProperty(globalThis,'localStorage',{value:testStorage,configurable:true});
try{
 const config={mode:'study',modeHtml:'<div class="mode-toggle"></div>',
  weeklyHtml:'<div class="proposal-snippet">テストWeekly候補</div>',
  classifiedHtml:'<button id="openOrganizerFromNote">分野別一覧へ</button>',
  relatedHtml:'<button class="related-link" data-related="CEZ">CEZ</button>'};
 let html=renderMssaNotebook(n,config);
 assert.ok(html.includes('8章の学習ノート'));
 assert.equal((html.match(/data-mssa-chapter=/g)||[]).length,8);
 assert.equal((html.match(/data-mssa-jump=/g)||[]).length,8);
 assert.ok(html.includes('data-mssa-depth="simple" aria-pressed="true"'));
 assert.ok(html.includes('id="mssaResume"'));
 assert.ok(html.includes('前回の続きから再開'));
 assert.ok(html.includes('id="mssa-antibiotics"'));
 assert.ok(!html.includes('mssa-compare'),'Simple mode should hide deep comparison table');
 assert.ok(html.includes('Weeklyからの学習メモ'),'Existing Weekly drafts must remain visible');
 assert.ok(html.includes('分野別一覧へ'));
 assert.ok(html.includes('テストWeekly候補'));
 assert.ok(html.includes('原典確認待ち'));
 assert.ok(!html.includes('確認済みの臨床用要約'),'Study mode can show clearly labelled draft overview');
 assert.equal((html.match(/class="mssa-simple"/g)||[]).length,0,'Simple mode may use no redundant card wrapper');
 assert.ok(saveMssaPrefs(id,{depth:'deep',open:['INVALID'],lastChapter:'INVALID',scrollY:150},testStorage));
 html=renderMssaNotebook(n,config);
 assert.ok(html.includes('mssa-flow'),'Learning flow must render in deep mode');
 assert.ok(html.includes('mssa-compare'),'Comparison table visible in deep mode');
 assert.ok(html.includes('架空症例'),'Fictional case visible in deep mode');
 assert.ok(html.includes('mssa-evidence'),'Source status visible in deep mode');
 assert.ok(html.includes('医学的な承認日ではありません'));
 const clinical=renderMssaNotebook(n,{mode:'clinical',modeHtml:'<div class="mode-toggle"></div>',weeklyHtml:'SENSITIVE_DRAFT_WEEKLY'});
 assert.ok(clinical.includes('正式版準備中'));
 assert.ok(clinical.includes('原典未確認'));
 assert.ok(!clinical.includes('SENSITIVE_DRAFT_WEEKLY'),'Unverified Weekly integration must not appear in clinical');
 assert.ok(!clinical.includes('mssa-compare'),'Draft drug comparison must not appear in clinical');
 assert.ok(!clinical.includes('mssa-case'),'Fictional draft case must not appear in clinical');
 assert.ok(!clinical.includes('持続菌血症では'),'Unverified note should not become clinical recommendation');
 assert.equal(readMssaPrefs(id,testStorage).lastChapter,null,'Invalid chapter ID must be sanitized');
 const failStore={getItem(){throw Error('denied')},setItem(){throw Error('denied')}};
 assert.equal(readMssaPrefs(id,failStore).depth,'deep','Storage-disabled browser must render');
 assert.equal(saveMssaPrefs(id,{depth:'deep',open:['culture'],lastChapter:'culture',scrollY:99},failStore),false);
 }finally{
  if(fakeStorageObject===undefined)delete globalThis.localStorage;
  else Object.defineProperty(globalThis,'localStorage',{value:fakeStorageObject,configurable:true});
 }
stopMssaReader();
console.log('Detailed MSSA notebook tests passed: 8 chapters, resume preference, clinical gating, prior Weekly and safe storage.');
