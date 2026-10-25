import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {AMP_C_NOTE,AMP_C_QUIZ,parseAmpcNote,renderAmpcStudy} from '../ampc-study.mjs';
const app=fs.readFileSync('app.js','utf8')
 .replace(/^import .*;\n/gm,'').replace(/^const reviewFeature=new ReviewFeature\(\);\n/m,'');
const end=app.lastIndexOf('\nload().catch(');
assert.ok(end>0);
const chapters=parseAmpcNote(fs.readFileSync(AMP_C_NOTE,'utf8'));
const questions=JSON.parse(fs.readFileSync(AMP_C_QUIZ,'utf8'));
const c={
 console,Date,setTimeout(){return 1},clearTimeout(){},
 renderAmpcStudy,
 document:{querySelector(){return {innerHTML:''}},querySelectorAll(){return []}},
 window:{scrollY:0,scrollTo(){}},
 localStorage:{getItem(){return null},setItem(){}}
};
vm.createContext(c);
vm.runInContext(app.slice(0,end)+
 '\nstate.ampcChapters=globalThis.demoChapters;state.ampcQuestions=globalThis.demoQuestions;'+
 "state.mode='study';state.view='home';globalThis.studyHome=home();"+
 "state.view='review';globalThis.studyReview=reviewView();"+
 "state.view='ampc';state.ampcTab='quiz';globalThis.studyAmpc=ampcView();"+
 "state.view='search';state.query='AmpC';globalThis.studySearch=getSearchResults();"+
 "state.mode='clinical';state.view='home';globalThis.clinicalHome=home();"+
 "state.view='ampc';globalThis.clinicalAmpc=ampcView();"+
 "state.view='search';globalThis.clinicalSearch=getSearchResults();",
 Object.assign(c,{demoChapters:chapters,demoQuestions:questions}));
assert.ok(c.studyHome.includes('ampcStudyOpen'));
assert.ok(c.studyHome.includes('ampcQuizOpen'));
assert.ok(c.studyReview.includes('ampcQuizOpen'));
assert.ok(c.studyReview.includes('reviewFeature'),'Existing daily Review remains present');
assert.ok(c.studyAmpc.includes('問題 1 / 10'));
assert.ok(c.studySearch.some(q=>q.type==='AmpC学習'));
assert.ok(!c.clinicalHome.includes('ampcStudyOpen'));
assert.ok(!c.clinicalHome.includes('ampcQuizOpen'));
assert.ok(!c.clinicalAmpc.includes('ampc-options'));
assert.ok(!c.clinicalAmpc.includes('CFPM'));
assert.ok(!c.clinicalSearch.some(q=>q.type==='AmpC学習'));
console.log('AmpC UI smoke: study Home/Review/search and 10-question screen visible; clinical mode fully isolated.');
