import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src=fs.readFileSync('app.js','utf8');
const start=src.indexOf('function weeklyOriginLabel(');
const end=src.indexOf('function weeklyView(){',start);
assert.ok(start>=0&&end>start,'Weekly navigation functions must exist');
const weeklyEnd=src.indexOf('function parseQA(',end);
assert.ok(weeklyEnd>end,'Weekly view must exist');
let details=[{open:true},{open:false},{open:true}];
let scroll=440;
let restored=null;
const context={
 state:{view:'note',weeklyReturn:null,selectedNote:{fm:{title:'MSSA菌血症'}},selectedWeeklyPath:null,selectedTopicId:null,
   integrations:null,weekly:[{path:'content/weekly/2026-10-09.md',fm:{week:'2026-10-05〜2026-10-09',title:'Test'},sections:{}}]},
 window:{get scrollY(){return scroll},scrollTo(args){restored=args.top;scroll=args.top}},
 document:{querySelectorAll(sel){assert.equal(sel,'details');return details}},
 requestAnimationFrame(cb){cb()},
 render(){details=[{open:false},{open:false},{open:false}];scroll=0},
 brand(){return ''},nav(){return ''},esc(x){return String(x)},mdList(){return []},parseQA(){return []}
};
vm.createContext(context);
vm.runInContext(src.slice(start,end)+src.slice(end,weeklyEnd),context);
vm.runInContext("openWeeklyFromSource('content/weekly/2026-10-09.md')",context);
assert.equal(context.state.view,'weekly');
assert.equal(context.state.weeklyReturn.view,'note');
assert.equal(context.state.weeklyReturn.label,'MSSA菌血症ノート');
assert.equal(context.state.weeklyReturn.scrollY,440);
let html=vm.runInContext('weeklyView()',context);
assert.equal((html.match(/data-weekly-return/g)||[]).length,2,'Back button at top and bottom');
assert.match(html,/MSSA菌血症ノートへ戻る/);
vm.runInContext('backFromWeekly()',context);
assert.equal(context.state.view,'note');
assert.equal(context.state.weeklyReturn,null);
assert.equal(restored,440);
assert.deepEqual(details.map(x=>x.open),[true,false,true]);

context.state.view='topic';
context.state.selectedTopicId='infection-candidemia';
context.state.integrations={topics:[{topic_id:'infection-candidemia',title:'Candida血症'}]};
details=[{open:false}];scroll=180;
vm.runInContext("openWeeklyFromSource('content/weekly/2026-10-09.md')",context);
assert.equal(context.state.weeklyReturn.label,'Candida血症');
vm.runInContext('backFromWeekly()',context);
assert.equal(context.state.view,'topic');

context.state.view='weekly';context.state.weeklyReturn=null;
html=vm.runInContext('weeklyView()',context);
assert.ok(!html.includes('data-weekly-return'),'No misleading back button on direct Weekly entry');
console.log('Weekly return navigation tests passed: note / topic / direct Weekly / scroll / expanded sections');
