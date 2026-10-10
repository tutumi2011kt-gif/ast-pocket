import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ReviewFeature} from '../review-feature.mjs';
const bank=JSON.parse(fs.readFileSync('content/review/bank-v2.json','utf8'));
const feature=new ReviewFeature();
feature.ready=true;
feature.bank=bank;
feature.day='2026-10-10';
feature.ids=[bank[0].id];
let html=feature.html();
assert.ok(html.includes('原典未確認・練習用'));
assert.ok(html.includes('reviewReveal'));
assert.ok(html.includes('reviewChoice'));
assert.ok(html.includes('未学習 12問'));
assert.ok(html.includes('医学的な理解確認・定着の認定ではありません'));

assert.ok(html.includes('JSONを書き出す'));
assert.ok(html.includes('JSONを読み込む'));
assert.ok(!html.includes('学習内容を臨床で利用してよい'),'No clinical clearance');
feature.choice=bank[0].correct_index;
feature.revealed=true;
html=feature.html();
assert.ok(html.includes('理解度を自己評価'));
assert.equal((html.match(/data-review-rating/g)||[]).length,4);
assert.ok(html.includes('治療判断には用いないでください'));
const self=bank.find(q=>q.type==='self');
feature.ids=[self.id];
feature.choice=null;
feature.revealed=true;
html=feature.html();
assert.ok(html.includes(self.model_answer),'Reference answer should be displayed only after reveal');
feature.revealed=false;
html=feature.html();
assert.ok(!html.includes(self.model_answer),'Must hide self answer before reveal');
assert.ok(html.includes('模範回答を見る'));
feature.ids=[bank[0].id];
feature.events=[{
 event_uuid:'test-1',device_id:'test-device',recorded_at_utc:'2026-10-10T12:00:00.000Z',
 question_id:bank[0].id,question_version:bank[0].version,rating:'good',type:'mcq',
 answer_text:null,graded_as:'practice_only',correct:true
}];
html=feature.html();
assert.ok(html.includes('本日の復習は終了です'));
assert.ok(html.includes('バックアップ確認が必要です'));
feature.ready=false;
feature.error='IndexedDB unavailable';
html=feature.html();
assert.ok(html.includes('再試行する'));
assert.ok(!html.includes('reviewReveal'),'Must not accept answers if saving unavailable');
const app=fs.readFileSync('app.js','utf8');
assert.ok(app.includes("if(state.mode!=='study')return"),'Clinical mode cannot show a practice quiz');
assert.ok(app.includes("if(state.view==='review'&&state.mode==='study')void reviewFeature.mount()"),'Quiz mounts only in study mode');
console.log('Review UI tests passed: MCQ, self-assessment, answer reveal, backup and clinical safety.');
