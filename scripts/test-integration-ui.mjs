import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

function smokeTest(){
 execFileSync(process.execPath,['scripts/organize-weekly.mjs','--write'],{stdio:'ignore'});
 execFileSync(process.execPath,['scripts/propose-integrations.mjs','--write'],{stdio:'ignore'});
 const index=JSON.parse(fs.readFileSync('content/index.json','utf8'));
 const app=fs.readFileSync('app.js','utf8').replace(/^import .*;\n/gm,'').replace(/^const reviewFeature=new ReviewFeature\(\);\n/m,''),end=app.lastIndexOf('\nload().catch(');
 assert.ok(end>0,'Expected bootstrap');
 const data={
  notes:index.notes.map(p=>({path:p,text:fs.readFileSync(p,'utf8')})),
  weekly:index.weekly.map(p=>({path:p,text:fs.readFileSync(p,'utf8')})),
  organized:JSON.parse(fs.readFileSync('content/organized.json','utf8')),
  integrations:JSON.parse(fs.readFileSync('content/integration-proposals.json','utf8'))
 };
 const context={console,Date,setTimeout(){return 1},clearTimeout(){},localStorage:{getItem(){return null},setItem(){}},document:{querySelector(){return {innerHTML:''}},querySelectorAll(){return []}},window:{scrollTo(){}}};
 vm.createContext(context);
 const setup=[
  `state.notes=${JSON.stringify(data.notes)}.map(x=>parseMD(x.text,x.path));`,
  `state.weekly=${JSON.stringify(data.weekly)}.map(x=>parseMD(x.text,x.path));`,
  `state.organized=${JSON.stringify(data.organized)};`,
  `state.integrations=${JSON.stringify(data.integrations)};`,
  `state.mode='study';state.view='library';`,
  `state.selectedNote=state.notes.find(n=>n.fm.layout==='integrated');`,
  `state.selectedTopicId='infection-candidemia';`,
  `globalThis.testResult={home:home(),library:libraryView(),note:integratedNoteView(state.selectedNote),topic:dynamicTopicView(),queue:integrationReviewView()};`
 ].join('\n');
 vm.runInContext(app.slice(0,end)+'\n'+setup,context);
 const html=context.testResult;
 assert.ok(html.home.includes('openReviewQueue'),'Home review button');
 assert.ok(html.library.includes('open-generated-topic'),'New topic links');
 assert.ok(html.note.includes('Weeklyからの学習メモ'),'Existing note draft additions');
 assert.ok(html.note.includes('原典確認待ち'),'Medical review gate');
 assert.ok(html.topic.includes('Candida血症'),'Candida candidate');
 assert.ok(html.topic.includes('open-weekly-ref'),'Provenance links');
 assert.ok(html.queue.includes('原典確認待ち'),'Medical review queue');
 vm.runInContext(`state.mode='clinical';globalThis.clinicalNote=integratedNoteView(state.selectedNote);globalThis.clinicalTopic=dynamicTopicView();`,context);
 assert.ok(!context.clinicalNote.includes('Weeklyからの学習メモ'),'No unverified integration in clinical note');
 assert.ok(!context.clinicalTopic.includes('学習時の回答'),'No draft claims in clinical topic');
 console.log('Integration UI smoke tests OK: all views and clinical safety');
}
smokeTest();
