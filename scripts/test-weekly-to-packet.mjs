import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {buildPacketFromWeekly} from './weekly-to-study-packet.mjs';
const weekly='content/weekly/2026-10-15.md';
const index=JSON.parse(fs.readFileSync('content/index.json','utf8'));
execFileSync(process.execPath,['scripts/organize-weekly.mjs','--write'],{stdio:'pipe'});
execFileSync(process.execPath,['scripts/propose-integrations.mjs','--write'],{stdio:'pipe'});
const proposals=JSON.parse(fs.readFileSync('content/integration-proposals.json','utf8'));
const packet=buildPacketFromWeekly({topicId:'infection-pneumonia',date:'2026-10-15',index,proposals,
 readWeekly:p=>fs.readFileSync(p,'utf8')});
assert.equal(packet.public_safe_reviewed,false,'Existing indexed public source does not imply new output safety approval');
assert.equal(packet.topic_id,'infection-pneumonia');
assert.equal(packet.category,'infection');
assert.ok(packet.learning.length>=1,'No mapped pneumonia learning point');
assert.ok(packet.learning.every(x=>x.chapter_id!=='unclassified'));
assert.ok(packet.learning.some(x=>x.point.includes('肺炎')));
assert.equal(packet.sources.length,0,'Never invent evidence');
assert.throws(()=>buildPacketFromWeekly({topicId:'infection-pneumonia',date:'2026-10-20',index,proposals,
 readWeekly:p=>fs.readFileSync(p,'utf8')}),/not in approved/);
assert.throws(()=>buildPacketFromWeekly({topicId:'a-dummy-topic',date:'2026-10-15',index,proposals,
 readWeekly:p=>fs.readFileSync(p,'utf8')}),/no published source/);
assert.throws(()=>buildPacketFromWeekly({topicId:'infection-pneumonia',date:'not-date',index,proposals,
 readWeekly:p=>fs.readFileSync(p,'utf8')}),/date/);
console.log('Weekly-to-AI packet bridge passed: actual source refs, safe explicit review gate, no fake evidence, preserve unclassified.');
