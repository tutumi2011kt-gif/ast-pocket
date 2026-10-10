import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src=fs.readFileSync('app.js','utf8');
const start=src.indexOf('const navigationStack=[];');
const end=src.indexOf('function bindCommon(){',start);
assert.ok(start>=0&&end>start,'All-screen navigation functions must exist');
assert.ok(src.includes("if(main && navigationStack.length)"),'Every navigated view must render the common back button');
assert.ok(src.includes("if(state.view==='weekly')main.insertAdjacentHTML('beforeend',backMarkup())"),'Weekly has a lower back button');

const state={
 view:'home',mode:'study',query:'',filter:'all',noteOrigin:'search',
 selectedNote:null,selectedWeeklyPath:null,selectedTopicId:null,libraryCategory:'all',
 notes:[{path:'content/notes/mssa-bacteremia.md',fm:{title:'MSSA菌血症'}}],
 integrations:{topics:[{topic_id:'infection-candidemia',title:'Candida血症'}]}
};
let scroll=0;
let details=[],questions=[];
const goToScroll=y=>{scroll=y};
function fakeRender(){
 details=details.map(()=>({open:false}));
 questions=questions.map(()=>({classList:{contains(){return false},toggle(){}}}));
 scroll=0;
}
const ctx={
 state,console,
 window:{get scrollY(){return scroll},scrollTo:({top})=>goToScroll(top)},
 document:{querySelectorAll(selector){
  if(selector==='main.screen details')return details;
  if(selector==='main.screen .q-row')return questions;
  throw Error('Unexpected selector '+selector);
 }},
 requestAnimationFrame(cb){cb()},
 localStorage:{setItem(){}},
 render:fakeRender,esc:x=>String(x)
};
vm.createContext(ctx);
vm.runInContext(src.slice(start,end),ctx);

// Home -> Category list -> Candidate notebook -> source Weekly.
vm.runInContext("navigate('library',{libraryCategory:'infection'})",ctx);
assert.equal(state.view,'library');
assert.match(vm.runInContext('backMarkup()',ctx),/Homeへ戻る/);
scroll=212;
details=[{open:true},{open:false}];
vm.runInContext("navigate('topic',{selectedTopicId:'infection-candidemia'})",ctx);
assert.equal(state.view,'topic');
assert.match(vm.runInContext('backMarkup()',ctx),/分野別ノート一覧へ戻る/);
scroll=570;details=[{open:true},{open:false},{open:true}];
vm.runInContext("navigate('weekly',{selectedWeeklyPath:'content/weekly/2026-10-09.md'})",ctx);
assert.match(vm.runInContext('backMarkup()',ctx),/Candida血症へ戻る/);
vm.runInContext('goBack()',ctx);
assert.equal(state.view,'topic');
assert.equal(scroll,570);
assert.deepEqual(details.map(d=>d.open),[true,false,true]);
vm.runInContext('goBack()',ctx);
assert.equal(state.view,'library');
assert.equal(scroll,212);
assert.deepEqual(details.map(d=>d.open),[true,false]);
assert.equal(state.libraryCategory,'infection');
vm.runInContext('goBack()',ctx);
assert.equal(state.view,'home');
assert.equal(vm.runInContext('backMarkup()',ctx),'');
assert.equal(vm.runInContext('navigationStack.length',ctx),0);

// Home -> Search -> MSSA note -> back to exact search term and search filter.
vm.runInContext("navigate('search',{query:'MSSA',filter:'ノート'})",ctx);
scroll=125;
vm.runInContext("navigate('note',{selectedNote:state.notes[0],noteOrigin:'search'})",ctx);
assert.match(vm.runInContext('backMarkup()',ctx),/検索結果へ戻る/);
vm.runInContext('goBack()',ctx);
assert.equal(state.view,'search');
assert.equal(state.query,'MSSA');
assert.equal(state.filter,'ノート');
assert.equal(scroll,125);
vm.runInContext('goBack()',ctx);
assert.equal(state.view,'home');

// Home -> direct Weekly -> back to Home, without special-case history.
vm.runInContext("navigate('weekly',{selectedWeeklyPath:null})",ctx);
assert.match(vm.runInContext('backMarkup()',ctx),/Homeへ戻る/);
vm.runInContext('goBack()',ctx);
assert.equal(state.view,'home');

// Home -> Review queue -> related note chain; previous page restored.
vm.runInContext("navigate('integration')",ctx);
vm.runInContext("navigate('note',{selectedNote:state.notes[0]})",ctx);
vm.runInContext('goBack()',ctx);
assert.equal(state.view,'integration');
vm.runInContext('goBack()',ctx);
assert.equal(state.view,'home');

// Same page updates such as filtering or switching mode do not pollute history.
vm.runInContext("navigate('home',{mode:'clinical'})",ctx);
assert.equal(vm.runInContext('navigationStack.length',ctx),0);
console.log('Global return navigation tests passed: category/topic/Weekly, search/note, Review queue, scroll and expansion state');
